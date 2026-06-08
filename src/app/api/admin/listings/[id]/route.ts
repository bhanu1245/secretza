import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logAdminAction } from "@/lib/audit-logger";
import { extractIpAddress } from "@/lib/audit-logger";
import { createStorageService } from "@/lib/storage";
import { logError } from "@/lib/monitoring";
import { syncCityListingCount } from "@/lib/listing-count-sync";
import { computePriorityScore } from "@/lib/ranking-engine";
import { fetchAdminListingDetail } from "@/lib/admin-listing-detail";
import {
  getRejectionReasonLabel,
  isValidRejectionReasonId,
} from "@/lib/listing-moderation";

function rankInputFromListing(listing: {
  id: string;
  isFeatured: boolean;
  isBoosted: boolean;
  isPremium: boolean;
  featuredUntil: Date | null;
  boostUntil: Date | null;
  lastBumpedAt: Date | null;
  viewCount: number;
  createdAt: Date;
  status: string;
}) {
  return {
    id: listing.id,
    isFeatured: listing.isFeatured,
    isBoosted: listing.isBoosted,
    isPremium: listing.isPremium,
    featuredUntil: listing.featuredUntil,
    boostUntil: listing.boostUntil,
    lastBumpedAt: listing.lastBumpedAt,
    viewCount: listing.viewCount,
    createdAt: listing.createdAt,
    status: listing.status,
  };
}

// GET /api/admin/listings/[id] — Full listing detail for admin review
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireMinRole("moderator");
    if (!admin) {
      return NextResponse.json({ error: "Moderator access required" }, { status: 401 });
    }

    const { id } = await params;
    const listing = await fetchAdminListingDetail(id);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ listing });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings/[id]:GET" });
    return NextResponse.json({ error: "Failed to fetch listing" }, { status: 500 });
  }
}

// PATCH /api/admin/listings/[id] — Admin listing moderation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireMinRole("moderator");
    if (!admin) {
      return NextResponse.json({ error: "Moderator access required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, rejectionNote } = body as {
      action?: string;
      rejectionReason?: string;
      rejectionNote?: string;
    };

    if (!action || !["approve", "reject", "feature", "unfeature", "delete"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: approve, reject, feature, unfeature, delete" },
        { status: 400 }
      );
    }

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    let updated;
    let auditAction: "listing_approve" | "listing_reject" | "listing_feature" | "listing_delete" | "settings_change" = "listing_approve";

    switch (action) {
      case "approve": {
        const approvedData = { ...listing, status: "approved" as const };
        updated = await db.listing.update({
          where: { id },
          data: {
            status: "approved",
            priorityScore: computePriorityScore(rankInputFromListing(approvedData)),
          },
        });
        auditAction = "listing_approve";
        if (listing.cityId) await syncCityListingCount(listing.cityId);
        break;
      }

      case "reject": {
        if (rejectionReason && !isValidRejectionReasonId(rejectionReason)) {
          return NextResponse.json({ error: "Invalid rejection reason" }, { status: 400 });
        }
        updated = await db.listing.update({
          where: { id },
          data: { status: "rejected" },
        });
        auditAction = "listing_reject";
        if (listing.cityId && listing.status === "approved") {
          await syncCityListingCount(listing.cityId);
        }
        break;
      }

      case "feature": {
        const featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const featuredData = {
          ...listing,
          isFeatured: true,
          featuredUntil,
        };
        updated = await db.listing.update({
          where: { id },
          data: {
            isFeatured: true,
            featuredUntil,
            priorityScore: computePriorityScore(rankInputFromListing(featuredData)),
          },
        });
        auditAction = "listing_feature";
        break;
      }

      case "unfeature":
        updated = await db.listing.update({
          where: { id },
          data: {
            isFeatured: false,
            featuredUntil: null,
          },
        });
        auditAction = "settings_change";
        break;

      case "delete": {
        // Clean up storage files first
        const images = await db.listingImage.findMany({
          where: { listingId: id },
          select: { storageKey: true },
        });
        if (images.length > 0) {
          const storage = createStorageService();
          await Promise.allSettled(
            images.map((img) => storage.delete(img.storageKey))
          );
        }
        const wasApproved = listing.status === "approved";
        const deletedCityId = listing.cityId;
        await db.listing.delete({ where: { id } });
        auditAction = "listing_delete";
        // Sync city count: if listing was approved, count drops by 1
        if (wasApproved && deletedCityId) await syncCityListingCount(deletedCityId);
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const auditDetails: Record<string, unknown> = {
      action,
      listingTitle: listing.title,
      previousStatus: listing.status,
    };

    if (action === "reject") {
      if (rejectionReason) {
        auditDetails.rejectionReason = rejectionReason;
        auditDetails.rejectionReasonLabel = getRejectionReasonLabel(rejectionReason);
      }
      if (typeof rejectionNote === "string" && rejectionNote.trim()) {
        auditDetails.rejectionNote = rejectionNote.trim();
      }
    }

    logAdminAction(
      admin.id,
      auditAction,
      "Listing",
      id,
      auditDetails,
      extractIpAddress(request)
    );

    if (action === "delete") {
      return NextResponse.json({ success: true, message: "Listing deleted" });
    }

    return NextResponse.json({ success: true, listing: updated });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings/[id]" });
    return NextResponse.json(
      { error: "Failed to moderate listing" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logAdminAction } from "@/lib/audit-logger";
import { extractIpAddress } from "@/lib/audit-logger";

// PATCH /api/admin/listings/[id] — Admin listing moderation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body as { action?: string };

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
      case "approve":
        updated = await db.listing.update({
          where: { id },
          data: { status: "approved" },
        });
        auditAction = "listing_approve";
        break;

      case "reject":
        updated = await db.listing.update({
          where: { id },
          data: { status: "rejected" },
        });
        auditAction = "listing_reject";
        break;

      case "feature":
        updated = await db.listing.update({
          where: { id },
          data: {
            isFeatured: true,
            featuredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });
        auditAction = "listing_feature";
        break;

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
        await db.listing.delete({ where: { id } });
        auditAction = "listing_delete";
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Audit log
    logAdminAction(
      admin.id,
      auditAction,
      "Listing",
      id,
      { action, listingTitle: listing.title, previousStatus: listing.status },
      extractIpAddress(request)
    );

    if (action === "delete") {
      return NextResponse.json({ success: true, message: "Listing deleted" });
    }

    return NextResponse.json({ success: true, listing: updated });
  } catch (error) {
    console.error("Admin listing moderate error:", error);
    return NextResponse.json(
      { error: "Failed to moderate listing" },
      { status: 500 }
    );
  }
}

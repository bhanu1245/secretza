import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type ImageModerationStatus = "pending" | "approved" | "rejected";
export type ImageModerationAction = "approve" | "reject" | "flag" | "unflag";

export type ImageQueueFilter = ImageModerationStatus | "flagged" | "all";

export function buildImageQueueWhere(
  filter: ImageQueueFilter,
  search?: string,
): Prisma.ListingImageWhereInput {
  const where: Prisma.ListingImageWhereInput = {};

  if (filter === "flagged") {
    where.isFlagged = true;
  } else if (filter !== "all") {
    where.moderationStatus = filter;
  }

  if (search?.trim()) {
    const q = search.trim();
    where.listing = {
      OR: [{ title: { contains: q } }, { slug: { contains: q } }],
    };
  }

  return where;
}

export async function getImageModerationStats() {
  const [pending, approved, rejected, flagged] = await Promise.all([
    db.listingImage.count({ where: { moderationStatus: "pending" } }),
    db.listingImage.count({ where: { moderationStatus: "approved" } }),
    db.listingImage.count({ where: { moderationStatus: "rejected" } }),
    db.listingImage.count({ where: { isFlagged: true } }),
  ]);

  return { pending, approved, rejected, flagged, total: pending + approved + rejected };
}

export async function listModerationQueue(options: {
  filter?: ImageQueueFilter;
  search?: string;
  limit?: number;
  page?: number;
}) {
  const filter = options.filter ?? "pending";
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const page = Math.max(1, options.page ?? 1);
  const where = buildImageQueueWhere(filter, options.search);

  const [images, total, stats] = await Promise.all([
    db.listingImage.findMany({
      where,
      orderBy: [{ isFlagged: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        url: true,
        thumbnailUrl: true,
        mediumUrl: true,
        width: true,
        height: true,
        moderationStatus: true,
        moderationReason: true,
        isFlagged: true,
        storageKey: true,
        createdAt: true,
        reviewedAt: true,
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            userId: true,
          },
        },
      },
    }),
    db.listingImage.count({ where }),
    getImageModerationStats(),
  ]);

  return {
    images: images.map((img) => ({
      ...img,
      createdAt: img.createdAt.toISOString(),
      reviewedAt: img.reviewedAt?.toISOString() ?? null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats,
  };
}

export async function moderateListingImage(
  imageId: string,
  action: ImageModerationAction,
  reviewerId: string,
  reason?: string,
) {
  const image = await db.listingImage.findUnique({
    where: { id: imageId },
    select: { id: true, moderationStatus: true },
  });

  if (!image) {
    throw new Error("Image not found");
  }

  const now = new Date();

  switch (action) {
    case "approve":
      return db.listingImage.update({
        where: { id: imageId },
        data: {
          moderationStatus: "approved",
          moderationReason: reason ?? null,
          isFlagged: false,
          reviewedBy: reviewerId,
          reviewedAt: now,
        },
      });
    case "reject":
      return db.listingImage.update({
        where: { id: imageId },
        data: {
          moderationStatus: "rejected",
          moderationReason: reason ?? "Rejected by moderator",
          reviewedBy: reviewerId,
          reviewedAt: now,
        },
      });
    case "flag":
      return db.listingImage.update({
        where: { id: imageId },
        data: {
          isFlagged: true,
          moderationReason: reason ?? "Flagged for review",
          reviewedBy: reviewerId,
          reviewedAt: now,
        },
      });
    case "unflag":
      return db.listingImage.update({
        where: { id: imageId },
        data: {
          isFlagged: false,
          reviewedBy: reviewerId,
          reviewedAt: now,
        },
      });
    default:
      throw new Error("Invalid moderation action");
  }
}

export async function bulkModerateListingImages(
  imageIds: string[],
  action: ImageModerationAction,
  reviewerId: string,
  reason?: string,
) {
  type BulkModerationResult =
    | { imageId: string; success: true; status: string }
    | { imageId: string; success: false; error: string };

  const results: BulkModerationResult[] = [];
  for (const imageId of imageIds) {
    try {
      const updated = await moderateListingImage(imageId, action, reviewerId, reason);
      results.push({ imageId, success: true, status: updated.moderationStatus });
    } catch (err) {
      results.push({
        imageId,
        success: false,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }
  return results;
}

export type FileViewer = { id?: string; role?: string };

/**
 * Central authorization gate for files served via /api/upload/file.
 *
 * Security model (default-deny):
 *   - listings/*     → public once moderation-approved; otherwise owner/admin/moderator only
 *   - screenshots/*  → NEVER public — authenticated admin OR the payment owner only
 *   - seo/*          → public (OG/social images embedded in public pages & read by crawlers)
 *   - payments/qr/*  → public (admin-configured UPI QR displayed at checkout; contains no PII)
 *   - anything else  → denied
 *
 * Returns true only when access is explicitly permitted. There is intentionally
 * no blanket "return true" fallback for unknown prefixes.
 */
export async function authorizeUploadedFileAccess(
  key: string,
  viewer?: FileViewer,
): Promise<boolean> {
  if (typeof key !== "string" || key.length === 0) return false;

  if (key.startsWith("screenshots/")) {
    return canAccessPaymentScreenshot(key, viewer);
  }
  if (key.startsWith("listings/")) {
    return canAccessListingImageFile(key, viewer);
  }
  if (key.startsWith("seo/")) {
    // Public SEO/OG assets — safe to serve to anyone (no PII).
    return true;
  }
  if (key.startsWith("payments/qr/")) {
    // Admin-configured UPI QR code displayed publicly at checkout.
    // The upload route is admin-protected; only retrieval needs to be public.
    return true;
  }

  // Secure default: deny any key with an unrecognized prefix.
  return false;
}

/**
 * Payment proof screenshots are sensitive (UTR / transaction evidence) and must
 * NEVER be public. Access is limited to an authenticated admin or the user who
 * submitted the payment.
 */
export async function canAccessPaymentScreenshot(
  key: string,
  viewer?: FileViewer,
): Promise<boolean> {
  if (!key.startsWith("screenshots/")) return false;

  // Unauthenticated requests are always rejected.
  if (!viewer?.id) return false;

  // Admins may review any payment proof (payment review is admin-gated).
  const role = viewer.role?.toLowerCase();
  if (role === "admin") {
    return true;
  }

  // Otherwise, only the submission owner may view their own screenshot.
  const submission = await db.manualPaymentSubmission.findFirst({
    where: { screenshotUrl: { contains: key } },
    select: { userId: true },
  });

  if (!submission) return false;
  return submission.userId === viewer.id;
}

/**
 * Whether a listing-image storage key may be served to the current viewer.
 * Listing-scoped only — callers should route non-listing keys elsewhere.
 */
export async function canAccessListingImageFile(
  key: string,
  viewer?: FileViewer,
): Promise<boolean> {
  // This helper only governs listing images. Any other prefix is denied here;
  // routing of other prefixes is handled by authorizeUploadedFileAccess().
  if (!key.startsWith("listings/")) {
    return false;
  }

  const image = await db.listingImage.findFirst({
    where: { storageKey: key },
    select: {
      moderationStatus: true,
      listing: { select: { userId: true } },
    },
  });

  if (!image) {
    const ownerSegment = key.split("/")[1];
    if (viewer?.id && ownerSegment === viewer.id) {
      return true;
    }
    return false;
  }

  if (image.moderationStatus === "approved") {
    return true;
  }

  const role = viewer?.role?.toLowerCase();
  if (role === "admin" || role === "moderator") {
    return true;
  }

  if (viewer?.id && image.listing.userId === viewer.id) {
    return true;
  }

  return false;
}

export async function findOrphanedListingImages() {
  const images = await db.listingImage.findMany({
    select: { id: true, storageKey: true, url: true, listingId: true },
  });

  const listingIds = new Set(
    (await db.listing.findMany({ select: { id: true } })).map((l) => l.id),
  );

  return images.filter((img) => !listingIds.has(img.listingId));
}

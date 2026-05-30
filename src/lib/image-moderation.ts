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
  const results = [];
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

/** Whether a storage key may be served to the current viewer. */
export async function canAccessListingImageFile(
  key: string,
  viewer?: { id?: string; role?: string },
): Promise<boolean> {
  if (!key.startsWith("listings/")) {
    return true;
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

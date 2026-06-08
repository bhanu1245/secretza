import { db } from "@/lib/db";
import { parseRejectionFromAuditDetails } from "@/lib/listing-moderation";

export type AdminListingImageDetail = {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  moderationStatus: string;
  moderationReason: string | null;
  isFlagged: boolean;
  sortOrder: number;
};

export type AdminListingDetail = {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  price: string;
  currency: string;
  isFeatured: boolean;
  isBoosted: boolean;
  isPremium: boolean;
  priorityScore: number;
  viewCount: number;
  reportCount: number;
  riskScore: number;
  pendingImageCount: number;
  expiresAt: string | null;
  featuredUntil: string | null;
  boostUntil: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    isVerified: boolean;
    isSuspended: boolean;
  } | null;
  category: { id: string; name: string; slug: string } | null;
  subcategory: { id: string; name: string; slug: string } | null;
  country: { id: string; name: string; code: string } | null;
  state: { id: string; name: string } | null;
  city: { id: string; name: string } | null;
  areaRelation: { id: string; name: string; slug: string } | null;
  listingImages: AdminListingImageDetail[];
  lastRejection: {
    reasonId: string | null;
    reasonLabel: string | null;
    note: string | null;
    rejectedAt: string | null;
  } | null;
};

export async function fetchAdminListingDetail(id: string): Promise<AdminListingDetail | null> {
  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          isSuspended: true,
        },
      },
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      country: { select: { id: true, name: true, code: true } },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      areaRelation: { select: { id: true, name: true, slug: true } },
      _count: { select: { reports: true } },
      listingImages: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          mediumUrl: true,
          moderationStatus: true,
          moderationReason: true,
          isFlagged: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!listing) return null;

  const pendingImageCount = listing.listingImages.filter(
    (img) => img.moderationStatus === "pending",
  ).length;

  const lastRejectLog = await db.auditLog.findFirst({
    where: { entityType: "Listing", entityId: id, action: "listing_reject" },
    orderBy: { createdAt: "desc" },
    select: { details: true, createdAt: true },
  });

  const lastRejection = lastRejectLog
    ? parseRejectionFromAuditDetails(lastRejectLog.details, lastRejectLog.createdAt)
    : null;

  return {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    status: listing.status,
    price: listing.price,
    currency: listing.currency,
    isFeatured: listing.isFeatured,
    isBoosted: listing.isBoosted,
    isPremium: listing.isPremium,
    priorityScore: listing.priorityScore,
    viewCount: listing.viewCount,
    reportCount: listing._count.reports,
    riskScore: listing.riskScore,
    pendingImageCount,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    featuredUntil: listing.featuredUntil?.toISOString() ?? null,
    boostUntil: listing.boostUntil?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    user: listing.user
      ? { ...listing.user, role: listing.user.role.toLowerCase() }
      : null,
    category: listing.category,
    subcategory: listing.subcategory,
    country: listing.country,
    state: listing.state,
    city: listing.city,
    areaRelation: listing.areaRelation,
    listingImages: listing.listingImages,
    lastRejection,
  };
}

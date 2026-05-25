import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computePriorityScore,
  getRankLabel,
  isBoostActive,
  isFeaturedActive,
} from "@/lib/ranking-engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      category: true,
      country: true,
      state: true,
      city: true,
      listingImages: {
        where: { moderationStatus: { in: ["pending", "approved"] } },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          mediumUrl: true,
          width: true,
          height: true,
          sortOrder: true,
          blurHash: true,
          moderationStatus: true,
          sizeBytes: true,
        },
      },
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const rankInput = {
    id: listing.id,
    isFeatured: listing.isFeatured,
    isBoosted: listing.isBoosted,
    featuredUntil: listing.featuredUntil,
    boostUntil: listing.boostUntil,
    lastBumpedAt: listing.lastBumpedAt,
    viewCount: listing.viewCount,
    createdAt: listing.createdAt,
    status: listing.status,
  };

  const computedScore = computePriorityScore(rankInput);
  const rankLabel = getRankLabel(rankInput, computedScore);

  return NextResponse.json({
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    category: listing.category,
    country: listing.country,
    state: listing.state,
    city: listing.city,
    tags: JSON.parse(listing.tags),
    price: listing.price,
    currency: listing.currency,
    contact: {
      email: listing.contactEmail,
      telegram: listing.contactTelegram,
      instagram: listing.contactInstagram,
      website: listing.contactWebsite,
      customText: listing.contactText,
    },
    images: JSON.parse(listing.images),
    listingImages: listing.listingImages.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      mediumUrl: img.mediumUrl,
      width: img.width,
      height: img.height,
      sortOrder: img.sortOrder,
      blurHash: img.blurHash,
      isPrimary: img.sortOrder === 0,
      sizeBytes: img.sizeBytes,
    })),
    status: listing.status,
    isFeatured: listing.isFeatured,
    isBoosted: listing.isBoosted,
    featuredUntil: listing.featuredUntil?.toISOString(),
    boostUntil: listing.boostUntil?.toISOString(),
    lastBumpedAt: listing.lastBumpedAt?.toISOString(),
    priorityScore: listing.priorityScore,
    expiresAt: listing.expiresAt?.toISOString(),
    viewCount: listing.viewCount,
    reportCount: listing.reportCount,
    riskScore: listing.riskScore,
    createdAt: listing.createdAt.toISOString(),
    user: listing.user,
    computedScore,
    rankLabel,
    boostActive: isBoostActive(rankInput),
    featuredActive: isFeaturedActive(rankInput),
  });
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.listing.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to delete listing" },
      { status: 500 }
    );
  }
}
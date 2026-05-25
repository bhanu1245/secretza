import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth guard
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // Verify listing belongs to the current user
    const existing = await db.listing.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const {
      title,
      description,
      categorySlug,
      countrySlug,
      stateSlug,
      citySlug,
      tags,
      contactEmail,
      contactTelegram,
      contactInstagram,
      contactWebsite,
      contactText,
      images,
      imageIds,
    } = body;

    // Validate category and country (same as POST)
    const [category, country] = await Promise.all([
      db.category.findUnique({ where: { slug: categorySlug } }),
      db.country.findUnique({ where: { slug: countrySlug } }),
    ]);

    if (!category || !country) {
      return NextResponse.json(
        { error: "Invalid category or country" },
        { status: 400 }
      );
    }

    let state: any = null;
    if (stateSlug) {
      state = await db.state.findFirst({
        where: { slug: stateSlug, countryId: country.id },
      });
    }

    let city: any = null;
    if (citySlug && state) {
      city = await db.city.findFirst({
        where: { slug: citySlug, stateId: state.id },
      });
    }

    if (!city) {
      return NextResponse.json(
        { error: "Invalid location or category" },
        { status: 400 }
      );
    }

    // Generate new slug from updated title
    const slug =
      (title || existing.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    // Update the listing
    const updated = await db.listing.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        slug,
        description: description ?? existing.description,
        categorySlug: categorySlug ?? existing.categorySlug,
        countrySlug: countrySlug ?? existing.countrySlug,
        stateSlug: stateSlug ?? existing.stateSlug,
        citySlug: citySlug ?? existing.citySlug,
        tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
        contactEmail: contactEmail !== undefined ? contactEmail : existing.contactEmail,
        contactTelegram: contactTelegram !== undefined ? contactTelegram : existing.contactTelegram,
        contactInstagram: contactInstagram !== undefined ? contactInstagram : existing.contactInstagram,
        contactWebsite: contactWebsite !== undefined ? contactWebsite : existing.contactWebsite,
        contactText: contactText !== undefined ? contactText : existing.contactText,
        images: images !== undefined ? JSON.stringify(images) : existing.images,
        categoryId: category.id,
        countryId: country.id,
        stateId: state?.id ?? existing.stateId,
        cityId: city.id,
      },
    });

    // Associate new uploaded images with the listing (if imageIds provided)
    if (Array.isArray(imageIds) && imageIds.length > 0) {
      await db.listingImage.updateMany({
        where: { id: { in: imageIds } },
        data: { listingId: id },
      });
    }

    return NextResponse.json({
      success: true,
      listing: { id: updated.id, slug: updated.slug, status: updated.status },
    });
  } catch (error) {
    console.error("[PUT /api/listings/:id] Failed to update:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
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
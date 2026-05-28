import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService } from "@/lib/storage";
import { logError } from "@/lib/monitoring";
import {
  computePriorityScore,
  getRankLabel,
  isBoostActive,
  isFeaturedActive,
} from "@/lib/ranking-engine";

function safeJsonParse(str: unknown, fallback: unknown): unknown {
  if (typeof str !== 'string') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

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

  // Status-based access control: only owners/admins can see non-approved listings
  const session = await getServerSession(authOptions);
  const isOwnerOrAdmin = session?.user?.id && (session.user.id === listing.userId || session.user.role === "admin");
  if (!isOwnerOrAdmin && listing.status !== "approved") {
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
    tags: safeJsonParse(listing.tags, []),
    price: listing.price,
    currency: listing.currency,
    contact: {
      email: listing.contactEmail,
      telegram: listing.contactTelegram,
      instagram: listing.contactInstagram,
      website: listing.contactWebsite,
      customText: listing.contactText,
    },
    images: safeJsonParse(listing.images, []),
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

    // Status restriction: don't allow editing suspended/banned listings
    if (existing.status === "suspended" || existing.status === "banned") {
      return NextResponse.json(
        { error: "Cannot edit a suspended or banned listing" },
        { status: 403 }
      );
    }

    const {
      title,
      description,
      categorySlug,
      countrySlug,
      stateSlug,
      citySlug,
      tags,
      price,
      contactEmail,
      contactTelegram,
      contactInstagram,
      contactWebsite,
      contactText,
      images,
      imageIds,
    } = body;

    // Validate content fields if provided
    if (title !== undefined) {
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      if (title.length > 100) {
        return NextResponse.json({ error: "Title must be at most 100 characters" }, { status: 400 });
      }
    }

    if (description !== undefined) {
      if (typeof description !== "string" || description.trim().length < 20) {
        return NextResponse.json({ error: "Description must be at least 20 characters" }, { status: 400 });
      }
      if (description.length > 2000) {
        return NextResponse.json({ error: "Description must be at most 2000 characters" }, { status: 400 });
      }
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.length > 10) {
        return NextResponse.json({ error: "Tags must be an array of at most 10 items" }, { status: 400 });
      }
      for (const tag of tags) {
        if (typeof tag !== "string" || tag.trim().length === 0 || tag.length > 30) {
          return NextResponse.json({ error: "Each tag must be a non-empty string of at most 30 characters" }, { status: 400 });
        }
      }
    }

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return NextResponse.json(
          { error: "Price must be a valid non-negative number" },
          { status: 400 }
        );
      }
    }

    // Validate contact fields if provided
    if (contactEmail !== undefined && contactEmail !== null) {
      if (typeof contactEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    }

    // Validate location fields only if they are provided (partial update support)
    let categoryId = existing.categoryId;
    let countryId = existing.countryId;
    let stateId = existing.stateId;
    let cityId = existing.cityId;

    if (categorySlug !== undefined || countrySlug !== undefined) {
      const resolvedCategorySlug = categorySlug ?? existing.categorySlug;
      const resolvedCountrySlug = countrySlug ?? existing.countrySlug;
      if (!resolvedCategorySlug || !resolvedCountrySlug) {
        return NextResponse.json(
          { error: "Category and country are required when updating location" },
          { status: 400 }
        );
      }
      const [category, country] = await Promise.all([
        db.category.findUnique({ where: { slug: resolvedCategorySlug } }),
        db.country.findUnique({ where: { slug: resolvedCountrySlug } }),
      ]);
      if (!category || !country) {
        return NextResponse.json(
          { error: "Invalid category or country" },
          { status: 400 }
        );
      }
      categoryId = category.id;
      countryId = country.id;

      if (stateSlug !== undefined) {
        if (stateSlug) {
          const state = await db.state.findFirst({
            where: { slug: stateSlug, countryId: country.id },
          });
          if (!state) {
            return NextResponse.json(
              { error: "Invalid state" },
              { status: 400 }
            );
          }
          stateId = state.id;
        }
        // else: keep existing stateId (don't set to null)
      }

      if (citySlug !== undefined) {
        if (citySlug && stateId) {
          const city = await db.city.findFirst({
            where: { slug: citySlug, stateId },
          });
          if (!city) {
            return NextResponse.json(
              { error: "Invalid city" },
              { status: 400 }
            );
          }
          cityId = city.id;
        } else {
          return NextResponse.json(
            { error: "Valid state is required to set city" },
            { status: 400 }
          );
        }
      }
    } else if (stateSlug !== undefined || citySlug !== undefined) {
      return NextResponse.json(
        { error: "Category and country are required when updating location" },
        { status: 400 }
      );
    }

    // Only regenerate slug if title actually changed
    const titleChanged = title !== undefined && title !== existing.title;
    const slug = titleChanged
      ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now()
      : existing.slug;

    // Update the listing
    const updated = await db.listing.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        slug,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? Number(price).toString() : existing.price,
        categorySlug: categorySlug !== undefined ? categorySlug : existing.categorySlug,
        countrySlug: countrySlug !== undefined ? countrySlug : existing.countrySlug,
        stateSlug: stateSlug !== undefined ? stateSlug : existing.stateSlug,
        citySlug: citySlug !== undefined ? citySlug : existing.citySlug,
        tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
        contactEmail: contactEmail !== undefined ? contactEmail : existing.contactEmail,
        contactTelegram: contactTelegram !== undefined ? contactTelegram : existing.contactTelegram,
        contactInstagram: contactInstagram !== undefined ? contactInstagram : existing.contactInstagram,
        contactWebsite: contactWebsite !== undefined ? contactWebsite : existing.contactWebsite,
        contactText: contactText !== undefined ? contactText : existing.contactText,
        images: images !== undefined ? JSON.stringify(images) : existing.images,
        categoryId,
        countryId,
        stateId,
        cityId,
      },
    });

    // Associate new uploaded images with the listing (if imageIds provided)
    // Security: Only attach images that are not already claimed by another listing
    if (Array.isArray(imageIds) && imageIds.length > 0) {
      await db.listingImage.updateMany({
        where: {
          id: { in: imageIds },
          listingId: null as any, // Only attach unattached images
        },
        data: { listingId: id },
      });
    }

    return NextResponse.json({
      success: true,
      listing: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        userId: updated.userId,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/listings/[id]" });
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

    // Auth guard: must be authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify listing belongs to the current user
    const existing = await db.listing.findUnique({
      where: { id },
      include: {
        listingImages: { select: { storageKey: true } },
      },
    });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Best-effort cleanup of storage files before deletion
    if (existing.listingImages.length > 0) {
      const storage = createStorageService();
      await Promise.allSettled(
        existing.listingImages.map((img) => storage.delete(img.storageKey))
      );
    }

    await db.listing.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    logError(error, { component: "route:api/listings/[id]" });

    return NextResponse.json(
      { error: "Failed to delete listing" },
      { status: 500 }
    );
  }
}
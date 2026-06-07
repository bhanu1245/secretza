import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService } from "@/lib/storage";
import { logError } from "@/lib/monitoring";
import { syncCityListingCount } from "@/lib/listing-count-sync";
import { computePriorityScore,
  getRankLabel,
  isBoostActive,
  isFeaturedActive,
} from "@/lib/ranking-engine";
import {
  serializeListingContact,
  redactListingContact,
  hasListingContact,
  sanitizeEmail,
  sanitizePhone,
  sanitizeTelegram,
} from "@/lib/listing-contact";
import { validateUserContent } from "@/lib/content-filter";
import { persistListingImages } from "@/lib/listing-image-persist";
import {
  extractStorageKeyFromUrl,
  resolveListingImageUrl,
} from "@/lib/listing-images";

function safeJsonParse(str: unknown, fallback: unknown): unknown {
  if (typeof str !== 'string') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function normalizeGalleryUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(String)
    .map((url) => resolveListingImageUrl(url) || url.trim())
    .filter((url) => url.length > 0 && !url.startsWith("blob:"));
}

function collectKnownStorageKeys(urls: string[], rows: Array<{ storageKey: string; url: string }>) {
  const keys = new Set<string>();
  for (const url of urls) {
    const key = extractStorageKeyFromUrl(url);
    if (key) keys.add(key);
  }
  for (const row of rows) {
    if (row.storageKey) keys.add(row.storageKey);
    const fromUrl = extractStorageKeyFromUrl(row.url);
    if (fromUrl) keys.add(fromUrl);
  }
  return keys;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      category: true,
      subcategory: true,
      country: true,
      state: true,
      city: true,
      areaRelation: true,
      listingImages: {
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

  const isOwnerOrStaff =
    session?.user?.id &&
    (session.user.id === listing.userId ||
      session.user.role === "admin" ||
      session.user.role === "moderator");

  if (!isOwnerOrStaff && listing.status !== "approved") {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const visibleImages = listing.listingImages.filter((img) =>
    isOwnerOrStaff
      ? img.moderationStatus === "pending" || img.moderationStatus === "approved"
      : img.moderationStatus === "approved",
  );

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

  const isOwner = session?.user?.id === listing.userId;
  const contactFields = isOwner
    ? serializeListingContact(listing as any)
    : redactListingContact();
  const hasContact = hasListingContact(listing as any);

  return NextResponse.json({
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    category: listing.category,
    subcategory: listing.subcategory,
    country: listing.country,
    state: listing.state,
    city: listing.city,
    area: listing.area,
    areaRelation: listing.areaRelation,
    tags: safeJsonParse(listing.tags, []),
    services: safeJsonParse((listing as any).services, []),
    price: listing.price,
    currency: listing.currency,
    ...contactFields,
    hasContact,
    images: isOwnerOrStaff ? safeJsonParse(listing.images, []) : [],
    profileImage: isOwnerOrStaff ? (listing as any).profileImage : null,
    galleryImages: isOwnerOrStaff ? safeJsonParse((listing as any).galleryImages, []) : [],
    coverImage:
      visibleImages[0]?.thumbnailUrl ||
      visibleImages[0]?.url ||
      (isOwnerOrStaff ? (listing as any).profileImage : null) ||
      null,
    age: (listing as any).age,
    listingImages: visibleImages.map((img) => ({
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

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isVerified: true },
    });

    if (!user?.isVerified) {
      return NextResponse.json(
        { error: "Email verification required to edit listings" },
        { status: 403 }
      );
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
      services,
      age,
      whatsapp,
      telegram,
      subcategorySlug,
      area,
      areaId,
      profileImage,
      galleryImages,
      contactEmail,
      contactTelegram,
      contactInstagram,
      contactWebsite,
      contactText,
      contactPhone,
      images,
      imageIds,
      uploadResults,
      seoTitle,
      seoDescription,
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

    const contentError = validateUserContent([
      { field: "title", label: "Title", value: title },
      { field: "description", label: "Description", value: description },
      { field: "seoTitle", label: "SEO title", value: seoTitle },
      { field: "seoDescription", label: "SEO description", value: seoDescription },
    ]);
    if (contentError) {
      return NextResponse.json(
        { error: contentError.message, field: contentError.field },
        { status: 400 },
      );
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

    if (age !== undefined && age !== null && age !== "") {
      const numericAge = Number(age);
      if (!Number.isInteger(numericAge) || numericAge < 18 || numericAge > 99) {
        return NextResponse.json({ error: "Age must be between 18 and 99" }, { status: 400 });
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
    let subcategoryId = (existing as any).subcategoryId ?? null;
    let countryId = existing.countryId;
    let stateId = existing.stateId;
    let cityId = existing.cityId;
    let resolvedAreaId = (existing as any).areaId ?? null;

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

      if (subcategorySlug !== undefined) {
        if (subcategorySlug) {
          const subcategory = await db.category.findFirst({
            where: { slug: subcategorySlug, parentId: category.id },
          });
          if (!subcategory) {
            return NextResponse.json({ error: "Invalid subcategory" }, { status: 400 });
          }
          subcategoryId = subcategory.id;
        } else {
          subcategoryId = null;
        }
      }

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

    if (areaId !== undefined) {
      if (areaId) {
        const areaRecord = await db.area.findFirst({
          where: { id: areaId, cityId },
        });
        if (!areaRecord) {
          return NextResponse.json({ error: "Invalid area" }, { status: 400 });
        }
        resolvedAreaId = areaRecord.id;
      } else {
        resolvedAreaId = null;
      }
    }

    // Only regenerate slug if title actually changed
    const titleChanged = title !== undefined && title !== existing.title;
    const slug = titleChanged
      ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now()
      : existing.slug;

    // Detect city change on an approved listing so we can sync both cities
    const oldCityId = existing.cityId;
    const cityChanged = cityId !== oldCityId;
    const isApproved = existing.status === "approved";

    // Update the listing
    const updated = await db.listing.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        slug,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? Number(price).toString() : existing.price,
        categorySlug: categorySlug !== undefined ? categorySlug : existing.categorySlug,
        subcategorySlug: subcategorySlug !== undefined ? subcategorySlug || null : (existing as any).subcategorySlug,
        countrySlug: countrySlug !== undefined ? countrySlug : existing.countrySlug,
        stateSlug: stateSlug !== undefined ? stateSlug : existing.stateSlug,
        citySlug: citySlug !== undefined ? citySlug : existing.citySlug,
        area: area !== undefined ? area || null : (existing as any).area,
        tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
        services: services !== undefined ? JSON.stringify(services) : (existing as any).services,
        age: age !== undefined && age !== "" ? Number(age) : (age === "" ? null : (existing as any).age),
        whatsapp:
          whatsapp !== undefined ? sanitizePhone(whatsapp) ?? null : (existing as any).whatsapp,
        telegram:
          telegram !== undefined ? sanitizeTelegram(telegram) ?? null : (existing as any).telegram,
        contactEmail:
          contactEmail !== undefined ? sanitizeEmail(contactEmail) ?? null : existing.contactEmail,
        contactTelegram:
          telegram !== undefined
            ? sanitizeTelegram(telegram) ?? null
            : contactTelegram !== undefined
              ? sanitizeTelegram(contactTelegram) ?? null
              : existing.contactTelegram,
        contactInstagram: contactInstagram !== undefined ? contactInstagram : existing.contactInstagram,
        contactWebsite: contactWebsite !== undefined ? contactWebsite : existing.contactWebsite,
        contactText:
          contactPhone !== undefined
            ? sanitizePhone(contactPhone) ?? null
            : contactText !== undefined
              ? sanitizePhone(contactText) || contactText || null
              : existing.contactText,
        images: images !== undefined ? JSON.stringify(images) : existing.images,
        profileImage: profileImage !== undefined ? profileImage || null : (existing as any).profileImage,
        galleryImages:
          galleryImages !== undefined
            ? JSON.stringify(normalizeGalleryUrlList(galleryImages))
            : (existing as any).galleryImages,
        categoryId,
        subcategoryId,
        countryId,
        stateId,
        cityId,
        areaId: resolvedAreaId,
      } as any,
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

    const galleryUrls = Array.isArray(galleryImages)
      ? normalizeGalleryUrlList(galleryImages)
      : undefined;

    const previousGallery = normalizeGalleryUrlList(
      safeJsonParse((existing as any).galleryImages, []),
    );
    const incomingGallery = galleryUrls ?? previousGallery;
    const existingDbImages = await db.listingImage.findMany({
      where: { listingId: id },
      select: { storageKey: true, url: true },
    });
    const knownKeys = collectKnownStorageKeys(previousGallery, existingDbImages);
    const addedGalleryUrls = incomingGallery.filter((url) => {
      const key = extractStorageKeyFromUrl(url);
      return Boolean(key && !knownKeys.has(key));
    });

    const normalizedUploadResults = Array.isArray(uploadResults) ? uploadResults : [];

    const shouldPersist =
      normalizedUploadResults.length > 0 || addedGalleryUrls.length > 0;

    if (process.env.NODE_ENV === "development") {
      console.log("[PUT /api/listings/[id]] image persist", {
        listingId: id,
        galleryCount: galleryUrls?.length ?? 0,
        addedGalleryCount: addedGalleryUrls.length,
        uploadResultsCount: normalizedUploadResults.length,
        uploadResults: normalizedUploadResults.map((r: Record<string, unknown>) => ({
          url: r.url,
          storageKey: r.storageKey || r.key,
        })),
        addedGalleryUrls,
        shouldPersist,
      });
    }

    // Sync city listingCount when an approved listing moves between cities
    if (isApproved && cityChanged) {
      const citiesToSync = [...new Set([oldCityId, cityId].filter(Boolean) as string[])];
      await Promise.all(citiesToSync.map(syncCityListingCount));
    }

    let persistedCount = 0;
    if (shouldPersist) {
      persistedCount = await persistListingImages(id, {
        galleryImages: addedGalleryUrls,
        uploadResults: normalizedUploadResults,
      });
    }

    const pendingForListing = await db.listingImage.count({
      where: { listingId: id, moderationStatus: "pending" },
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[PUT /api/listings/[id]] persistListingImages result", {
        listingId: id,
        persistedCount,
        pendingForListing,
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
      _debug: process.env.NODE_ENV === "development"
        ? { persistedCount, pendingForListing }
        : undefined,
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

    const wasApproved = existing.status === "approved";
    const deletedCityId = existing.cityId;

    await db.listing.delete({
      where: { id },
    });

    // Sync city count: if listing was approved, one fewer approved listing
    if (wasApproved && deletedCityId) {
      await syncCityListingCount(deletedCityId);
    }

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
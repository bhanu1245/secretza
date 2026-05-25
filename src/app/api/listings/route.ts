import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  computePriorityScore,
  getRankLabel,
  isBoostActive,
  isFeaturedActive,
} from "@/lib/ranking-engine";
import { rateLimit, RATE_LIMITS, getClientIp, getRateLimitHeaders } from "@/lib/rate-limit";

function safeJsonParse(str: unknown, fallback: unknown): unknown {
  if (typeof str !== 'string') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function GET(request: Request) {
  // Rate limiting for public GET endpoint
  const ip = getClientIp(request);
  const rl = await rateLimit(`api:public:listings:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") || undefined;
  const category = searchParams.get("category") || undefined;
  const country = searchParams.get("country") || undefined;
  const state = searchParams.get("state") || undefined;
  const city = searchParams.get("city") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const featured = searchParams.get("featured") === "true";
  const sortBy = searchParams.get("sortBy") || "ranking";
  const userId = searchParams.get("userId") || undefined;

  // Require authentication when querying by userId — prevents unauthenticated
  // users from enumerating another user's listings (including private statuses).
  if (userId) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const where: Prisma.ListingWhereInput = userId
    ? { userId }
    : { status: "approved" };
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
      { tags: { contains: keyword } },
      { category: { name: { contains: keyword } } },
      { city: { name: { contains: keyword } } },
      { country: { name: { contains: keyword } } },
    ];
  }
  if (category) where.categorySlug = category;
  if (country) where.countrySlug = country;
  if (state) where.stateSlug = state;
  if (city) where.citySlug = city;
  if (featured) where.isFeatured = true;

  // Determine Prisma-level ordering (used when sortBy is not "ranking")
  let orderBy: Prisma.ListingOrderByWithRelationInput;
  switch (sortBy) {
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    case "price_low":
      orderBy = { price: "asc" };
      break;
    case "price_high":
      orderBy = { price: "desc" };
      break;
    case "featured":
      orderBy = [{ isFeatured: "desc" }, { priorityScore: "desc" }] as any;
      break;
    default:
      // Default: order by stored priorityScore (fast DB-level sort)
      // Also use boosted/featured as secondary tie-breakers
      orderBy = { priorityScore: "desc" };
      break;
  }

  const [listings, total] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, image: true } },
        category: true,
        country: true,
        state: true,
        city: true,
        _count: { select: { reviews: { where: { status: "approved" } } } },
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
          },
        },
      },
    }),
    db.listing.count({ where }),
  ]);

  // Average review rating per listing (lightweight follow-up query)
  const listingIds = listings.map((l) => l.id);
  const reviewStats = listingIds.length > 0
    ? await db.review.groupBy({
        by: ["listingId"],
        where: { status: "approved", listingId: { in: listingIds } },
        _avg: { rating: true },
      })
    : [];
  const avgRatingMap = new Map(reviewStats.map((r) => [r.listingId, r._avg.rating ?? 0]));

  // Compute real-time scores and rank labels for each listing
  const transformed = listings.map((l) => {
    const rankInput = {
      id: l.id,
      isFeatured: l.isFeatured,
      isBoosted: l.isBoosted,
      featuredUntil: l.featuredUntil,
      boostUntil: l.boostUntil,
      lastBumpedAt: l.lastBumpedAt,
      viewCount: l.viewCount,
      createdAt: l.createdAt,
      status: l.status,
    };
    const computedScore = computePriorityScore(rankInput);
    const rankLabel = getRankLabel(rankInput, computedScore);

    return {
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      category: {
        id: l.category.id,
        name: l.category.name,
        slug: l.category.slug,
        description: l.category.description,
        icon: l.category.icon,
        color: l.category.color,
        order: l.category.order,
        isActive: l.category.isActive,
        isFeatured: l.category.isFeatured,
        listingCount: l.category.listingCount,
      },
      country: {
        id: l.country.id,
        name: l.country.name,
        code: l.country.code,
        slug: l.country.slug,
        isActive: l.country.isActive,
        listingCount: l.country.listingCount,
      },
      state: {
        id: l.state.id,
        name: l.state.name,
        slug: l.state.slug,
        countryId: l.state.countryId,
        isActive: l.state.isActive,
        listingCount: l.state.listingCount,
      },
      city: {
        id: l.city.id,
        name: l.city.name,
        slug: l.city.slug,
        stateId: l.city.stateId,
        isFeatured: l.city.isFeatured,
        isActive: l.city.isActive,
        listingCount: l.city.listingCount,
      },
      tags: safeJsonParse(l.tags, []),
      price: l.price,
      currency: l.currency,
      contact: {
        email: l.contactEmail,
        telegram: l.contactTelegram,
        instagram: l.contactInstagram,
        website: l.contactWebsite,
        customText: l.contactText,
      },
      images: safeJsonParse(l.images, []),
      listingImages: l.listingImages.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        mediumUrl: img.mediumUrl,
        width: img.width,
        height: img.height,
        sortOrder: img.sortOrder,
        blurHash: img.blurHash,
        isPrimary: img.sortOrder === 0,
      })),
      status: l.status,
      isFeatured: l.isFeatured,
      isBoosted: l.isBoosted,
      featuredUntil: l.featuredUntil?.toISOString(),
      boostUntil: l.boostUntil?.toISOString(),
      lastBumpedAt: l.lastBumpedAt?.toISOString(),
      priorityScore: l.priorityScore,
      expiresAt: l.expiresAt?.toISOString(),
      viewCount: l.viewCount,
      createdAt: l.createdAt.toISOString(),
      user: { id: l.user.id, name: l.user.name, avatar: l.user.image },
      computedScore,
      rankLabel,
      boostActive: isBoostActive(rankInput),
      featuredActive: isFeaturedActive(rankInput),
      reviewCount: l._count.reviews,
      averageRating: Math.round((avgRatingMap.get(l.id) ?? 0) * 10) / 10,
    };
  });

  // If sorting by "ranking", re-sort by computed score in-memory
  // (this handles edge cases where DB priorityScore is stale)
  const finalListings =
    sortBy === "ranking"
      ? [...transformed].sort((a, b) => (b.computedScore ?? 0) - (a.computedScore ?? 0))
      : transformed;

  return NextResponse.json({
    listings: finalListings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  try {
    // Auth guard: must be authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Rate limiting per user for listing creation
    const rl = await rateLimit(`create-listing:${session.user.id}`, { maxRequests: 10, windowSeconds: 60 * 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many listing creation requests. Please try again later.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // Verification guard: must be verified to create listings
    if (!session.user.isVerified) {
      return NextResponse.json(
        { error: "Email verification required to create listings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      categorySlug,
      countrySlug,
      stateSlug,
      citySlug,
      tags,
      price,
      currency,
      contactEmail,
      contactTelegram,
      contactInstagram,
      contactWebsite,
      contactText,
      images,
      imageIds,
      uploadResults,
    } = body;

    // Input validation: require essential fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: "Title must be at most 100 characters" }, { status: 400 });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 20) {
      return NextResponse.json({ error: "Description must be at least 20 characters" }, { status: 400 });
    }
    if (description.length > 2000) {
      return NextResponse.json({ error: "Description must be at most 2000 characters" }, { status: 400 });
    }
    if (!categorySlug || typeof categorySlug !== 'string') {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }
    if (!countrySlug || typeof countrySlug !== 'string') {
      return NextResponse.json({ error: "Country is required" }, { status: 400 });
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 });
    }
    if (price !== undefined && price > 99999999) {
      return NextResponse.json({ error: "Price exceeds maximum allowed value" }, { status: 400 });
    }

    // Validate currency (whitelist of ISO 4217 codes commonly used)
    const VALID_CURRENCIES = new Set(["USD", "INR", "EUR", "GBP", "CAD", "AUD", "SGD", "AED", "JPY", "CNY", "BRL", "MXN", "ZAR", "KRW"]);
    if (currency !== undefined && !VALID_CURRENCIES.has(currency)) {
      return NextResponse.json(
        { error: `Invalid currency. Supported: ${Array.from(VALID_CURRENCIES).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate tags array
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

    // Validate contact field lengths
    if (contactEmail !== undefined && contactEmail !== null) {
      if (typeof contactEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    }
    if (contactTelegram !== undefined && contactTelegram !== null) {
      if (typeof contactTelegram !== "string" || contactTelegram.length > 100) {
        return NextResponse.json({ error: "Telegram handle must be at most 100 characters" }, { status: 400 });
      }
    }
    if (contactInstagram !== undefined && contactInstagram !== null) {
      if (typeof contactInstagram !== "string" || contactInstagram.length > 100) {
        return NextResponse.json({ error: "Instagram handle must be at most 100 characters" }, { status: 400 });
      }
    }
    if (contactWebsite !== undefined && contactWebsite !== null) {
      if (typeof contactWebsite !== "string" || contactWebsite.length > 500) {
        return NextResponse.json({ error: "Website URL must be at most 500 characters" }, { status: 400 });
      }
    }
    if (contactText !== undefined && contactText !== null) {
      if (typeof contactText !== "string" || contactText.length > 500) {
        return NextResponse.json({ error: "Contact text must be at most 500 characters" }, { status: 400 });
      }
    }

    // Generate slug
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    // Get category, country, state, city IDs
    // Phase 1: fetch category and country in parallel
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

    // Phase 2: fetch state (depends on country), then city (depends on state)
    let state = null;
    if (stateSlug) {
      state = await db.state.findFirst({
        where: { slug: stateSlug, countryId: country.id },
      });
    }

    let city = null;
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

    // Create listing + images atomically in a transaction
    const listing = await db.$transaction(async (tx) => {
      const newListing = await tx.listing.create({
        data: {
          title,
          slug,
          description,
          categorySlug,
          countrySlug,
          stateSlug,
          citySlug,
          tags: JSON.stringify(tags || []),
          price,
          currency: currency || "USD",
          contactEmail,
          contactTelegram,
          contactInstagram,
          contactWebsite,
          contactText,
          images: JSON.stringify(images || []),
          status: "pending",
          lastBumpedAt: new Date(),
          priorityScore: 35,
          userId: session.user.id,
          categoryId: category.id,
          countryId: country.id,
          stateId: state.id,
          cityId: city.id,
        },
      });

      // Create ListingImage records from upload results (new flow)
      if (Array.isArray(uploadResults) && uploadResults.length > 0) {
        await tx.listingImage.createMany({
          data: uploadResults.map((img: Record<string, unknown>, idx: number) => ({
            listingId: newListing.id,
            url: img.url as string,
            thumbnailUrl: img.url as string,
            mediumUrl: img.url as string,
            storageKey: img.storageKey as string || `uploads/${(img.fileName as string) || "unknown"}`,
            mimeType: img.mimeType as string || "image/jpeg",
            width: (img.width as number) || 0,
            height: (img.height as number) || 0,
            sizeBytes: (img.sizeBytes as number) || 0,
            sortOrder: idx,
            moderationStatus: "pending",
          })),
        });
      }

      // Legacy: Associate pre-existing uploaded images (edit mode)
      if (Array.isArray(imageIds) && imageIds.length > 0) {
        await tx.listingImage.updateMany({
          where: {
            id: { in: imageIds },
            listingId: null,
          },
          data: { listingId: newListing.id },
        });
      }

      return newListing;
    });

    return NextResponse.json(
      { listing: { id: listing.id, slug: listing.slug, status: listing.status } },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}

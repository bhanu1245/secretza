import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { rateLimit, RATE_LIMITS, getClientIp, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";
import { validateUserContent } from "@/lib/content-filter";

// GET /api/reviews?listingId=xxx&page=1&limit=10&sort=newest
export async function GET(request: Request) {
  try {
    // Rate limiting for public GET endpoint
    const ip = getClientIp(request);
    const rl = await rateLimit(`api:public:reviews:${ip}`, RATE_LIMITS.api);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId is required" },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const sort = searchParams.get("sort") || "newest";

    // Validate sort param
    const validSorts = ["newest", "highest", "lowest", "helpful"];
    if (!validSorts.includes(sort)) {
      return NextResponse.json(
        { error: `Invalid sort. Must be one of: ${validSorts.join(", ")}` },
        { status: 400 }
      );
    }

    // Build orderBy based on sort
    let orderBy: Prisma.ReviewOrderByWithRelationInput;
    switch (sort) {
      case "highest":
        orderBy = { rating: "desc" };
        break;
      case "lowest":
        orderBy = { rating: "asc" };
        break;
      case "helpful":
        orderBy = { helpfulCount: "desc" };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const where: Prisma.ReviewWhereInput = {
      listingId,
      status: "approved",
    };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          isVerified: true,
          isFeatured: true,
          isPremium: true,
          helpfulCount: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              isVerified: true,
            },
          },
        },
      }),
      db.review.count({ where }),
    ]);

    // Build review summary
    const allApproved = await db.review.findMany({
      where: { listingId, status: "approved" },
      select: { rating: true },
    });

    const count = allApproved.length;
    const averageRating =
      count > 0
        ? Math.round((allApproved.reduce((sum, r) => sum + r.rating, 0) / count) * 100) / 100
        : 0;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allApproved) {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating]++;
      }
    }

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      reviewSummary: {
        count,
        averageRating,
        ratingDistribution,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/reviews" });
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST /api/reviews
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting per user for review creation
    const rl = await rateLimit(`review:${session.user.id}`, RATE_LIMITS.reviewCreate);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many review requests. Please try again later.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json();
    const { listingId, rating, title, body: reviewBody } = body as {
      listingId?: string;
      rating?: number;
      title?: string;
      body?: string;
    };

    // Validate required fields
    if (!listingId || !rating) {
      return NextResponse.json(
        { error: "listingId and rating are required" },
        { status: 400 }
      );
    }

    // Validate rating range
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    // Validate body length
    if (reviewBody && reviewBody.length > 2000) {
      return NextResponse.json(
        { error: "Review body must be at most 2000 characters" },
        { status: 400 }
      );
    }

    // Validate title length
    if (title && title.length > 200) {
      return NextResponse.json(
        { error: "Review title must be at most 200 characters" },
        { status: 400 }
      );
    }

    const contentError = validateUserContent([
      { field: "title", label: "Review title", value: title },
      { field: "body", label: "Review", value: reviewBody },
    ]);
    if (contentError) {
      return NextResponse.json(
        { error: contentError.message, field: contentError.field },
        { status: 400 }
      );
    }

    // Check listing exists and is approved
    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, userId: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Prevent self-review
    if (listing.userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot review your own listing" },
        { status: 403 }
      );
    }

    if (listing.status !== "approved") {
      return NextResponse.json(
        { error: "Cannot review a listing that is not approved" },
        { status: 400 }
      );
    }

    // Check user exists and not suspended
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isSuspended: true, isVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isSuspended) {
      return NextResponse.json(
        { error: "Suspended users cannot create reviews" },
        { status: 403 }
      );
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Email verification required to submit reviews" },
        { status: 403 }
      );
    }

    // Anti-spam: check if user already reviewed this listing
    const existingReview = await db.review.findUnique({
      where: {
        listingId_userId: {
          listingId,
          userId: session.user.id,
        },
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this listing" },
        { status: 409 }
      );
    }

    const review = await db.review.create({
      data: {
        listingId,
        userId: session.user.id,
        rating,
        title: title || null,
        body: reviewBody || null,
        isVerified: user.isVerified,
        status: "pending",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isVerified: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Review submitted for moderation",
        review: {
          ...review,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logError(error, { component: "route:api/reviews" });

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You have already reviewed this listing" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}

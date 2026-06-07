import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";

export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("moderator");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const filter = searchParams.get("filter") || status || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: Prisma.ListingWhereInput = {};

    if (filter === "featured") {
      where.isFeatured = true;
    } else if (filter === "boosted") {
      where.isBoosted = true;
    } else if (filter) {
      where.status = filter;
    }

    const [listings, total] = await Promise.all([
      db.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
              isVerified: true,
              isSuspended: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          subcategory: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          country: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          state: {
            select: {
              id: true,
              name: true,
            },
          },
          city: {
            select: {
              id: true,
              name: true,
            },
          },
          areaRelation: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              reports: true,
            },
          },
          listingImages: {
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              moderationStatus: true,
            },
          },
        },
      }),
      db.listing.count({ where }),
    ]);

    return NextResponse.json({
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        slug: l.slug,
        description: l.description,
        status: l.status,
        price: l.price,
        currency: l.currency,
        isFeatured: l.isFeatured,
        isBoosted: l.isBoosted,
        isPremium: (l as any).isPremium,
        priorityScore: l.priorityScore,
        viewCount: l.viewCount,
        views: (l as any).views,
        reportCount: l._count.reports,
        riskScore: l.riskScore,
        expiresAt: l.expiresAt?.toISOString() ?? null,
        featuredUntil: l.featuredUntil?.toISOString() ?? null,
        boostUntil: l.boostUntil?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        user: l.user ? { ...l.user, role: l.user.role.toLowerCase() } : null,
        category: l.category,
        subcategory: (l as any).subcategory,
        country: l.country,
        state: l.state,
        city: l.city,
        area: (l as any).area,
        areaRelation: (l as any).areaRelation,
        profileImage: (l as any).profileImage,
        listingImages: l.listingImages,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings" });
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";

// GET /api/admin/reviews?status=pending&page=1&limit=20&listingId=xxx&userId=xxx
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "moderator") {
      return NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const listingId = searchParams.get("listingId") || undefined;
    const userId = searchParams.get("userId") || undefined;

    const validStatuses = ["pending", "approved", "rejected", "flagged"];
    const where: Prisma.ReviewWhereInput = {};

    if (statusParam && statusParam !== "all") {
      if (!validStatuses.includes(statusParam)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: all, ${validStatuses.join(", ")}` },
          { status: 400 },
        );
      }
      where.status = statusParam;
    }

    if (listingId) {
      where.listingId = listingId;
    }

    if (userId) {
      where.userId = userId;
    }

    const [reviews, total, statusCountsRaw] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          listingId: true,
          userId: true,
          rating: true,
          title: true,
          body: true,
          isVerified: true,
          isFeatured: true,
          isPremium: true,
          status: true,
          flaggedReason: true,
          moderatedBy: true,
          moderatedAt: true,
          adminNote: true,
          helpfulCount: true,
          reportCount: true,
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
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          _count: {
            select: {
              reports: true,
            },
          },
        },
      }),
      db.review.count({ where }),
      db.review.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsRaw) {
      statusCounts[row.status] = row._count.status;
    }

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        moderatedAt: r.moderatedAt?.toISOString() ?? null,
        featuredUntil: undefined, // not selected, but include for completeness
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/reviews" });
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

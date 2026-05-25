import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";

// GET /api/admin/reviews/analytics?days=30
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
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Run all queries in parallel
    const [
      totalReviews,
      approvedReviews,
      pendingReviews,
      rejectedReviews,
      flaggedReviews,
      approvedRatingData,
      recentFlagged,
    ] = await Promise.all([
      // Total reviews in the date range
      db.review.count({
        where: { createdAt: { gte: since } },
      }),
      // Approved reviews in the date range
      db.review.count({
        where: { status: "approved", createdAt: { gte: since } },
      }),
      // Pending reviews
      db.review.count({
        where: { status: "pending" },
      }),
      // Rejected reviews in the date range
      db.review.count({
        where: { status: "rejected", createdAt: { gte: since } },
      }),
      // Flagged reviews
      db.review.count({
        where: { status: "flagged" },
      }),
      // Average rating across all approved reviews
      db.review.aggregate({
        where: { status: "approved" },
        _avg: { rating: true },
        _count: true,
      }),
      // Last 5 flagged reviews
      db.review.findMany({
        where: { status: "flagged" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          flaggedReason: true,
          reportCount: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    const averageRating =
      approvedRatingData._count > 0
        ? Math.round((approvedRatingData._avg.rating || 0) * 100) / 100
        : 0;

    // Reviews by day — group by date
    const reviewsByDayRaw = await db.$queryRaw<
      Array<{ date: string; count: number; avgRating: number | null }>
    >(Prisma.sql`
      SELECT
        DATE(createdAt) as date,
        COUNT(*) as count,
        AVG(rating) as avgRating
      FROM Review
      WHERE createdAt >= ${since.toISOString()}
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
    `);

    const reviewsByDay = reviewsByDayRaw.map((row) => ({
      date: row.date,
      count: row.count,
      avgRating: row.avgRating ? Math.round(row.avgRating * 100) / 100 : 0,
    }));

    // Top 5 listings by average rating (with at least 1 review)
    const topRatedListingsRaw = await db.$queryRaw<
      Array<{ listingId: string; title: string; avgRating: number | null; reviewCount: number }>
    >(Prisma.sql`
      SELECT
        r.listingId,
        l.title,
        AVG(r.rating) as avgRating,
        COUNT(*) as reviewCount
      FROM Review r
      JOIN Listing l ON l.id = r.listingId
      WHERE r.status = 'approved'
      GROUP BY r.listingId, l.title
      HAVING COUNT(*) >= 1
      ORDER BY avgRating DESC, reviewCount DESC
      LIMIT 5
    `);

    const topRatedListings = topRatedListingsRaw.map((row) => ({
      listingId: row.listingId,
      title: row.title,
      avgRating: row.avgRating ? Math.round(row.avgRating * 100) / 100 : 0,
      reviewCount: row.reviewCount,
    }));

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      totalReviews,
      approvedReviews,
      pendingReviews,
      rejectedReviews,
      flaggedReviews,
      averageRating,
      reviewsByDay,
      topRatedListings,
      recentFlagged: recentFlagged.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/reviews/analytics" });
    return NextResponse.json(
      { error: "Failed to fetch review analytics" },
      { status: 500 }
    );
  }
}

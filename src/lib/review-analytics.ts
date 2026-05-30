import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/** SQLite $queryRaw returns COUNT(*) as bigint — JSON.stringify cannot serialize it */
function rawCount(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return Number(value ?? 0);
}

function rawFloat(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export interface ReviewAnalyticsData {
  period: { days: number; since: string };
  totalReviews: number;
  approvedReviews: number;
  pendingReviews: number;
  rejectedReviews: number;
  flaggedReviews: number;
  averageRating: number;
  reviewsByDay: Array<{ date: string; count: number; avgRating: number }>;
  topRatedListings: Array<{
    listingId: string;
    title: string;
    avgRating: number;
    reviewCount: number;
  }>;
  recentFlagged: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    flaggedReason: string | null;
    reportCount: number;
    createdAt: string;
    user: { id: string; name: string | null; image: string | null };
    listing: { id: string; title: string; slug: string };
  }>;
}

export async function getReviewAnalytics(days: number): Promise<ReviewAnalyticsData> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [
    totalReviews,
    approvedReviews,
    pendingReviews,
    rejectedReviews,
    flaggedReviews,
    approvedRatingData,
    recentFlagged,
  ] = await Promise.all([
    db.review.count({ where: { createdAt: { gte: since } } }),
    db.review.count({ where: { status: "approved", createdAt: { gte: since } } }),
    db.review.count({ where: { status: "pending" } }),
    db.review.count({ where: { status: "rejected", createdAt: { gte: since } } }),
    db.review.count({ where: { status: "flagged" } }),
    db.review.aggregate({
      where: { status: "approved" },
      _avg: { rating: true },
      _count: true,
    }),
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
        user: { select: { id: true, name: true, image: true } },
        listing: { select: { id: true, title: true, slug: true } },
      },
    }),
  ]);

  const averageRating =
    approvedRatingData._count > 0
      ? Math.round((approvedRatingData._avg.rating || 0) * 100) / 100
      : 0;

  const reviewsByDayRaw = await db.$queryRaw<
    Array<{ date: string; count: unknown; avgRating: unknown }>
  >(Prisma.sql`
    SELECT
      DATE(createdAt) as date,
      COUNT(*) as count,
      AVG(rating) as avgRating
    FROM Review
    WHERE createdAt >= ${since}
    GROUP BY DATE(createdAt)
    ORDER BY date DESC
  `);

  const topRatedListingsRaw = await db.$queryRaw<
    Array<{ listingId: string; title: string; avgRating: unknown; reviewCount: unknown }>
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

  return {
    period: { days, since: since.toISOString() },
    totalReviews,
    approvedReviews,
    pendingReviews,
    rejectedReviews,
    flaggedReviews,
    averageRating,
    reviewsByDay: reviewsByDayRaw.map((row) => ({
      date: String(row.date),
      count: rawCount(row.count),
      avgRating: rawFloat(row.avgRating),
    })),
    topRatedListings: topRatedListingsRaw.map((row) => ({
      listingId: row.listingId,
      title: row.title,
      avgRating: rawFloat(row.avgRating),
      reviewCount: rawCount(row.reviewCount),
    })),
    recentFlagged: recentFlagged.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

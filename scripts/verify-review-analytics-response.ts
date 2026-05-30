/**
 * Simulate full analytics route response and JSON serialization.
 */
import { db } from "../src/lib/db";
import { Prisma } from "@prisma/client";

async function buildAnalyticsResponse(days = 30) {
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
    Array<{ date: string; count: number; avgRating: number | null }>
  >(Prisma.sql`
    SELECT DATE(createdAt) as date, COUNT(*) as count, AVG(rating) as avgRating
    FROM Review WHERE createdAt >= ${since.toISOString()}
    GROUP BY DATE(createdAt) ORDER BY date DESC
  `);

  const reviewsByDay = reviewsByDayRaw.map((row) => ({
    date: row.date,
    count: row.count,
    avgRating: row.avgRating ? Math.round(row.avgRating * 100) / 100 : 0,
  }));

  const topRatedListingsRaw = await db.$queryRaw<
    Array<{ listingId: string; title: string; avgRating: number | null; reviewCount: number }>
  >(Prisma.sql`
    SELECT r.listingId, l.title, AVG(r.rating) as avgRating, COUNT(*) as reviewCount
    FROM Review r JOIN Listing l ON l.id = r.listingId
    WHERE r.status = 'approved'
    GROUP BY r.listingId, l.title HAVING COUNT(*) >= 1
    ORDER BY avgRating DESC, reviewCount DESC LIMIT 5
  `);

  const topRatedListings = topRatedListingsRaw.map((row) => ({
    listingId: row.listingId,
    title: row.title,
    avgRating: row.avgRating ? Math.round(row.avgRating * 100) / 100 : 0,
    reviewCount: row.reviewCount,
  }));

  return {
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
  };
}

async function main() {
  try {
    const data = await buildAnalyticsResponse();
    console.log("Raw reviewsByDay:", data.reviewsByDay);
    console.log("Raw topRatedListings:", data.topRatedListings);
    console.log("count types:", {
      reviewsByDayCount: data.reviewsByDay[0]?.count,
      countType: data.reviewsByDay[0] ? typeof data.reviewsByDay[0].count : "n/a",
      reviewCountType: data.topRatedListings[0] ? typeof data.topRatedListings[0].reviewCount : "n/a",
    });
    const json = JSON.stringify(data);
    console.log("✓ JSON.stringify OK, length:", json.length);
  } catch (e) {
    console.error("✗ Failed:", e);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();

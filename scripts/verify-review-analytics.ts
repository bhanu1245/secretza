/**
 * Verify GET /api/admin/reviews/analytics logic without auth (direct DB).
 */
import { db } from "../src/lib/db";
import { Prisma } from "@prisma/client";

async function main() {
  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  console.log("=== Review Analytics Verification ===\n");
  console.log("Since:", since.toISOString());

  try {
    const counts = await Promise.all([
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
    ]);
    console.log("✓ Prisma counts/aggregate OK:", counts.map((c) => (typeof c === "object" ? JSON.stringify(c) : c)));
  } catch (e) {
    console.error("✗ Prisma counts failed:", e);
    process.exit(1);
  }

  try {
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
    console.log("✓ reviewsByDay raw OK:", reviewsByDayRaw.length, "rows");
  } catch (e) {
    console.error("✗ reviewsByDay raw query failed:", e);
  }

  try {
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
    console.log("✓ topRatedListings raw OK:", topRatedListingsRaw.length, "rows");
  } catch (e) {
    console.error("✗ topRatedListings raw query failed:", e);
  }

  try {
    const recentFlagged = await db.review.findMany({
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
    });
    console.log("✓ recentFlagged OK:", recentFlagged.length, "rows");
  } catch (e) {
    console.error("✗ recentFlagged failed:", e);
  }

  const total = await db.review.count();
  console.log("\nTotal reviews in DB:", total);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

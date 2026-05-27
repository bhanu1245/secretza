import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computePriorityScore,
  findExpiredListings,
  getNextBumpBatch,
} from "@/lib/ranking-engine";
import { timingSafeEqual } from "crypto";
import { logError } from "@/lib/monitoring";

/**
 * Cron endpoint: Refresh all listing rankings
 * 
 * This endpoint should be called every 30 minutes by a scheduler.
 * It performs three operations:
 * 1. Expires boost/featured flags for listings past their expiry dates
 * 2. Recomputes priorityScore for ALL approved listings
 * 3. Bumps the next batch of free listings for fair rotation
 * 
 * Usage: GET /api/cron/refresh-ranking
 * Security: In production, protect with a cron secret header
 */
export async function GET(request: Request) {
  try {
    // --- Authentication: require cron secret header (constant-time comparison) ---
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;
    if (!cronSecret || !expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const a = Buffer.from(cronSecret, "utf-8");
    const b = Buffer.from(expectedSecret, "utf-8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startTime = Date.now();

    // ==========================================
    // Step 1: Fetch all approved listings for processing
    // ==========================================
    const allApproved = await db.listing.findMany({
      where: { status: "approved" },
      select: {
        id: true,
        isFeatured: true,
        isBoosted: true,
        featuredUntil: true,
        boostUntil: true,
        lastBumpedAt: true,
        viewCount: true,
        createdAt: true,
        status: true,
      },
    });

    // ==========================================
    // Step 2: Find and expire boost/featured listings past their expiry
    // ==========================================
    const { expiredBoosts, expiredFeatured } = findExpiredListings(allApproved);

    const expiredCount = expiredBoosts.length + expiredFeatured.length;

    if (expiredBoosts.length > 0) {
      await db.listing.updateMany({
        where: { id: { in: expiredBoosts } },
        data: { isBoosted: false, boostUntil: null },
      });
    }

    if (expiredFeatured.length > 0) {
      await db.listing.updateMany({
        where: { id: { in: expiredFeatured } },
        data: { isFeatured: false, featuredUntil: null },
      });
    }

    // ==========================================
    // Step 3: Recompute priority scores for all approved listings
    // ==========================================
    const scoreUpdates = allApproved.map((listing) => {
      const score = computePriorityScore(listing);
      return db.listing.update({
        where: { id: listing.id },
        data: { priorityScore: score },
      });
    });

    // Batch update (SQLite handles sequential updates well)
    await db.$transaction(scoreUpdates);

    // ==========================================
    // Step 4: Bump next batch of free listings for rotation
    // ==========================================
    const freeListings = allApproved.filter((l) => {
      const now = Date.now();
      const boostActive = l.isBoosted && l.boostUntil && new Date(l.boostUntil).getTime() > now;
      const featuredActive = l.isFeatured && l.featuredUntil && new Date(l.featuredUntil).getTime() > now;
      return !boostActive && !featuredActive;
    });

    const bumpBatchIds = getNextBumpBatch(freeListings, 20);

    let bumpedCount = 0;
    if (bumpBatchIds.length > 0) {
      await db.listing.updateMany({
        where: { id: { in: bumpBatchIds } },
        data: { lastBumpedAt: new Date() },
      });

      // Recompute scores for bumped listings (they now have new lastBumpedAt)
      const bumpedListings = await db.listing.findMany({
        where: { id: { in: bumpBatchIds } },
        select: {
          id: true,
          isFeatured: true,
          isBoosted: true,
          featuredUntil: true,
          boostUntil: true,
          lastBumpedAt: true,
          viewCount: true,
          createdAt: true,
          status: true,
        },
      });

      for (const listing of bumpedListings) {
        const score = computePriorityScore(listing);
        await db.listing.update({
          where: { id: listing.id },
          data: { priorityScore: score },
        });
      }

      bumpedCount = bumpBatchIds.length;
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Ranking refresh completed",
      stats: {
        totalProcessed: allApproved.length,
        expiredBoosts: expiredBoosts.length,
        expiredFeatured: expiredFeatured.length,
        scoresUpdated: allApproved.length,
        freeListingsRotated: bumpedCount,
        elapsedMs: elapsed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError(error, { component: "route:api/cron/refresh-ranking" });
    return NextResponse.json(
      { error: "Ranking refresh failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computePriorityScore,
  findExpiredListings,
  getNextBumpBatchForTier,
  type ListingTier,
} from "@/lib/ranking-engine";
import { timingSafeEqual } from "crypto";
import { logError } from "@/lib/monitoring";
import { syncAllCityListingCounts } from "@/lib/listing-count-sync";

/**
 * Cron endpoint: Refresh all listing rankings (v2 — four-tier architecture)
 *
 * Must be called every 30 minutes by a scheduler.
 * Protected by the x-cron-secret header (constant-time comparison).
 *
 * Steps performed:
 *   1. Expire User.isPremium where premiumExpiry < now
 *   2. Sync Listing.isPremium from the owning user's live premium status
 *   3. Fetch all approved listings (including up-to-date isPremium)
 *   4. Expire isBoosted / isFeatured flags whose windows have closed
 *   5. Recompute priorityScore for every approved listing
 *   6. Rotate one batch (≤20) from each of the four tiers (oldest-bumped first)
 *
 * Usage: GET /api/cron/refresh-ranking
 */
export async function GET(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
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

    // ── Step 1: Expire User.isPremium where premiumExpiry < now ─────────
    // The JWT callback already enforces this client-side, but the DB must be
    // authoritative for admin stats and fresh sessions.
    const { count: expiredPremiumCount } = await db.user.updateMany({
      where: { isPremium: true, premiumExpiry: { lt: new Date() } },
      data: { isPremium: false },
    });

    // ── Step 2: Sync Listing.isPremium from user's live premium status ──
    // Activate listings whose owner is currently premium.
    await db.listing.updateMany({
      where: {
        user: { isPremium: true, premiumExpiry: { gt: new Date() } },
        status: "approved",
      },
      data: { isPremium: true },
    });
    // Deactivate listings whose owner is no longer premium.
    await db.listing.updateMany({
      where: {
        isPremium: true,
        NOT: {
          user: { isPremium: true, premiumExpiry: { gt: new Date() } },
        },
      },
      data: { isPremium: false },
    });

    // ── Step 3: Fetch all approved listings (with up-to-date isPremium) ─
    const allApproved = await db.listing.findMany({
      where: { status: "approved" },
      select: {
        id: true,
        isFeatured: true,
        isBoosted: true,
        isPremium: true,
        featuredUntil: true,
        boostUntil: true,
        lastBumpedAt: true,
        viewCount: true,
        createdAt: true,
        status: true,
      },
    });

    // ── Step 4: Expire boost / featured flags past their windows ────────
    const { expiredBoosts, expiredFeatured } = findExpiredListings(allApproved);

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

    // ── Step 5: Recompute priorityScore for every approved listing ───────
    // Expire flags from step 4 are already reflected in the in-memory
    // objects because we update the DB before this point, but allApproved
    // was fetched before the updates.  Re-read the expired IDs inline so
    // the score computation sees the cleared flags.
    const expiredBoostSet = new Set(expiredBoosts);
    const expiredFeaturedSet = new Set(expiredFeatured);
    const scoreUpdates = allApproved.map((listing) => {
      const normalized = {
        ...listing,
        isBoosted: expiredBoostSet.has(listing.id) ? false : listing.isBoosted,
        isFeatured: expiredFeaturedSet.has(listing.id)
          ? false
          : listing.isFeatured,
        boostUntil: expiredBoostSet.has(listing.id) ? null : listing.boostUntil,
        featuredUntil: expiredFeaturedSet.has(listing.id)
          ? null
          : listing.featuredUntil,
      };
      return db.listing.update({
        where: { id: listing.id },
        data: { priorityScore: computePriorityScore(normalized) },
      });
    });
    await db.$transaction(scoreUpdates);

    // ── Step 6: Rotate one batch from each tier ─────────────────────────
    // Each tier gets its own fair round-robin bump independently of the others.
    const TIERS: ListingTier[] = ["boosted", "premium", "featured", "free"];
    const tierBumpCounts: Record<string, number> = {};
    let totalBumped = 0;

    for (const tier of TIERS) {
      const batchIds = getNextBumpBatchForTier(allApproved, tier, 20);
      if (batchIds.length === 0) {
        tierBumpCounts[tier] = 0;
        continue;
      }

      await db.listing.updateMany({
        where: { id: { in: batchIds } },
        data: { lastBumpedAt: new Date() },
      });

      // Re-fetch so computePriorityScore sees the fresh lastBumpedAt value.
      const bumpedListings = await db.listing.findMany({
        where: { id: { in: batchIds } },
        select: {
          id: true,
          isFeatured: true,
          isBoosted: true,
          isPremium: true,
          featuredUntil: true,
          boostUntil: true,
          lastBumpedAt: true,
          viewCount: true,
          createdAt: true,
          status: true,
        },
      });

      await db.$transaction(
        bumpedListings.map((l) =>
          db.listing.update({
            where: { id: l.id },
            data: { priorityScore: computePriorityScore(l) },
          }),
        ),
      );

      tierBumpCounts[tier] = batchIds.length;
      totalBumped += batchIds.length;
    }

    // ── Step 7: Reconcile City.listingCount ─────────────────────────────
    // Safety net: recompute every city's approved listing count from scratch.
    // Idempotent — only writes rows whose stored value differs from live count.
    const citySyncResult = await syncAllCityListingCounts();

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Ranking refresh completed (v2 four-tier)",
      stats: {
        expiredPremiumUsers: expiredPremiumCount,
        totalProcessed: allApproved.length,
        expiredBoosts: expiredBoosts.length,
        expiredFeatured: expiredFeatured.length,
        scoresUpdated: allApproved.length,
        rotationByTier: tierBumpCounts,
        totalRotated: totalBumped,
        cityCountsUpdated: citySyncResult.updated,
        cityCountsUnchanged: citySyncResult.unchanged,
        elapsedMs: elapsed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError(error, { component: "route:api/cron/refresh-ranking" });
    return NextResponse.json(
      { error: "Ranking refresh failed" },
      { status: 500 },
    );
  }
}

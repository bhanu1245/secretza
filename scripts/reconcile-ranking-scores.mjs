/**
 * One-off full ranking reconciliation (mirrors /api/cron/refresh-ranking core steps).
 * bun run scripts/reconcile-ranking-scores.mjs
 */
import { PrismaClient } from '@prisma/client';
import {
  computePriorityScore,
  findExpiredListings,
  getActiveTier,
  getNextBumpBatchForTier,
} from '../src/lib/ranking-engine.ts';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? 'file:./prisma/db/custom.db' } },
});

function snapshot(rows) {
  return rows.map((r) => ({
    title: r.title?.slice(0, 32),
    tier: getActiveTier(r),
    dbScore: r.priorityScore,
    computed: computePriorityScore(r),
  }));
}

async function main() {
  const beforeRows = await db.listing.findMany({
    where: { status: 'approved' },
    select: {
      id: true, title: true, priorityScore: true,
      isFeatured: true, isBoosted: true, isPremium: true,
      featuredUntil: true, boostUntil: true, lastBumpedAt: true,
      viewCount: true, createdAt: true, status: true,
    },
    orderBy: { priorityScore: 'desc' },
  });

  console.log('=== BEFORE reconciliation ===');
  console.log(JSON.stringify(snapshot(beforeRows), null, 2));

  // Step 1–2: premium user expiry + listing sync (same as cron)
  await db.user.updateMany({
    where: { isPremium: true, premiumExpiry: { lt: new Date() } },
    data: { isPremium: false },
  });
  await db.listing.updateMany({
    where: { user: { isPremium: true, premiumExpiry: { gt: new Date() } }, status: 'approved' },
    data: { isPremium: true },
  });
  await db.listing.updateMany({
    where: {
      isPremium: true,
      NOT: { user: { isPremium: true, premiumExpiry: { gt: new Date() } } },
    },
    data: { isPremium: false },
  });

  const allApproved = await db.listing.findMany({
    where: { status: 'approved' },
    select: {
      id: true, isFeatured: true, isBoosted: true, isPremium: true,
      featuredUntil: true, boostUntil: true, lastBumpedAt: true,
      viewCount: true, createdAt: true, status: true,
    },
  });

  // Step 3: expire boost/featured flags
  const { expiredBoosts, expiredFeatured } = findExpiredListings(allApproved);
  if (expiredBoosts.length) {
    await db.listing.updateMany({
      where: { id: { in: expiredBoosts } },
      data: { isBoosted: false, boostUntil: null },
    });
  }
  if (expiredFeatured.length) {
    await db.listing.updateMany({
      where: { id: { in: expiredFeatured } },
      data: { isFeatured: false, featuredUntil: null },
    });
  }

  const expiredBoostSet = new Set(expiredBoosts);
  const expiredFeaturedSet = new Set(expiredFeatured);

  // Step 4: recompute all scores
  let updated = 0;
  for (const listing of allApproved) {
    const normalized = {
      ...listing,
      isBoosted: expiredBoostSet.has(listing.id) ? false : listing.isBoosted,
      isFeatured: expiredFeaturedSet.has(listing.id) ? false : listing.isFeatured,
      boostUntil: expiredBoostSet.has(listing.id) ? null : listing.boostUntil,
      featuredUntil: expiredFeaturedSet.has(listing.id) ? null : listing.featuredUntil,
    };
    const score = computePriorityScore(normalized);
    await db.listing.update({
      where: { id: listing.id },
      data: { priorityScore: score },
    });
    updated++;
  }

  // Step 5: rotation bump per tier
  const TIERS = ['boosted', 'premium', 'featured', 'free'];
  for (const tier of TIERS) {
    const batchIds = getNextBumpBatchForTier(allApproved, tier, 20);
    if (!batchIds.length) continue;
    await db.listing.updateMany({
      where: { id: { in: batchIds } },
      data: { lastBumpedAt: new Date() },
    });
    const bumped = await db.listing.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true, isFeatured: true, isBoosted: true, isPremium: true,
        featuredUntil: true, boostUntil: true, lastBumpedAt: true,
        viewCount: true, createdAt: true, status: true,
      },
    });
    for (const l of bumped) {
      await db.listing.update({
        where: { id: l.id },
        data: { priorityScore: computePriorityScore(l) },
      });
    }
  }

  const afterRows = await db.listing.findMany({
    where: { status: 'approved' },
    select: {
      id: true, title: true, priorityScore: true,
      isFeatured: true, isBoosted: true, isPremium: true,
      featuredUntil: true, boostUntil: true, lastBumpedAt: true,
      viewCount: true, createdAt: true, status: true,
    },
    orderBy: { priorityScore: 'desc' },
  });

  const stale = afterRows.filter(
    (r) => Math.abs(computePriorityScore(r) - r.priorityScore) > 0.01,
  );

  console.log('\n=== AFTER reconciliation ===');
  console.log(JSON.stringify(snapshot(afterRows), null, 2));
  console.log(`\nScores updated: ${updated}`);
  console.log(`Expired boosts: ${expiredBoosts.length}, expired featured: ${expiredFeatured.length}`);
  console.log(`Stale after reconcile: ${stale.length}/${afterRows.length}`);
  console.log(stale.length === 0 ? '✓ ALL SCORES MATCH v2 ENGINE' : '✗ STALE SCORES REMAIN');
}

main()
  .catch((e) => { console.error('FATAL:', e.message); process.exit(1); })
  .finally(() => db.$disconnect());

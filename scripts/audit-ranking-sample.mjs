import { PrismaClient } from '@prisma/client';
import { computePriorityScore, getActiveTier } from '../src/lib/ranking-engine.ts';

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? 'file:./prisma/db/custom.db' } } });

const rows = await db.listing.findMany({
  where: { status: 'approved' },
  select: {
    id: true, title: true, priorityScore: true,
    isBoosted: true, isFeatured: true, isPremium: true,
    boostUntil: true, featuredUntil: true, lastBumpedAt: true,
    viewCount: true, createdAt: true, status: true,
  },
  orderBy: { priorityScore: 'desc' },
});

console.log(`Approved listings: ${rows.length}\n`);

const tierCounts = { boosted: 0, premium: 0, featured: 0, free: 0 };
for (const r of rows) {
  const tier = getActiveTier(r);
  tierCounts[tier]++;
}

console.log('Tier distribution:', tierCounts);
console.log('\nTop 10 (DB priorityScore order):');
for (const r of rows.slice(0, 10)) {
  const tier = getActiveTier(r);
  const computed = computePriorityScore(r);
  const drift = Math.abs(computed - r.priorityScore) > 0.01;
  console.log({
    tier,
    dbScore: r.priorityScore,
    computed,
    drift: drift ? 'STALE' : 'ok',
    boost: r.isBoosted,
    feat: r.isFeatured,
    prem: r.isPremium,
    title: r.title?.slice(0, 35),
  });
}

const stale = rows.filter(r => Math.abs(computePriorityScore(r) - r.priorityScore) > 0.01);
console.log(`\nStale priorityScore rows: ${stale.length}/${rows.length}`);

console.log('\nExpiry details:');
for (const r of rows) {
  console.log({
    title: r.title?.slice(0, 30),
    boostUntil: r.boostUntil?.toISOString() ?? null,
    featuredUntil: r.featuredUntil?.toISOString() ?? null,
    isPremium: r.isPremium,
  });
}

await db.$disconnect();

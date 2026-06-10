import { db } from "@/lib/db";
import { computePriorityScore, type ListingRankInput } from "@/lib/ranking-engine";
import type { Prisma } from "@prisma/client";

export const RANKING_LISTING_SELECT = {
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
} as const;

export type RankingListingRow = Prisma.ListingGetPayload<{
  select: typeof RANKING_LISTING_SELECT;
}>;

export function listingToRankInput(listing: RankingListingRow): ListingRankInput {
  return {
    id: listing.id,
    isFeatured: listing.isFeatured,
    isBoosted: listing.isBoosted,
    isPremium: listing.isPremium,
    featuredUntil: listing.featuredUntil,
    boostUntil: listing.boostUntil,
    lastBumpedAt: listing.lastBumpedAt,
    viewCount: listing.viewCount,
    createdAt: listing.createdAt,
    status: listing.status,
  };
}

const BATCH_SIZE = 100;

async function applyScoreUpdates(
  updates: Array<{ id: string; data: { priorityScore: number; lastBumpedAt?: Date } }>,
): Promise<number> {
  let processed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map((item) =>
        db.listing.update({
          where: { id: item.id },
          data: item.data,
        }),
      ),
    );
    processed += batch.length;
  }
  return processed;
}

/** Recompute priorityScore for every listing without changing lastBumpedAt or flags. */
export async function recalculateAllListingRankings(): Promise<number> {
  const listings = await db.listing.findMany({ select: RANKING_LISTING_SELECT });
  const updates = listings.map((listing) => ({
    id: listing.id,
    data: { priorityScore: computePriorityScore(listingToRankInput(listing)) },
  }));
  return applyScoreUpdates(updates);
}

/** Refresh ranking freshness for approved premium listings. */
export async function refreshPremiumListingRankings(
  bumpedAt: Date = new Date(),
): Promise<number> {
  const listings = await db.listing.findMany({
    where: { isPremium: true, status: "approved" },
    select: RANKING_LISTING_SELECT,
  });

  const updates = listings.map((listing) => {
    const rankInput: ListingRankInput = {
      ...listingToRankInput(listing),
      lastBumpedAt: bumpedAt,
    };
    return {
      id: listing.id,
      data: {
        lastBumpedAt: bumpedAt,
        priorityScore: computePriorityScore(rankInput),
      },
    };
  });

  return applyScoreUpdates(updates);
}

/** Count approved listings in a city (preview before refresh). */
export async function countApprovedListingsInCity(cityId: string): Promise<number> {
  return db.listing.count({
    where: { cityId, status: "approved" },
  });
}

/** Refresh ranking freshness for approved listings in one city. */
export async function refreshCityListingRankings(
  cityId: string,
  bumpedAt: Date = new Date(),
): Promise<number> {
  const listings = await db.listing.findMany({
    where: { cityId, status: "approved" },
    select: RANKING_LISTING_SELECT,
  });

  const updates = listings.map((listing) => {
    const rankInput: ListingRankInput = {
      ...listingToRankInput(listing),
      lastBumpedAt: bumpedAt,
    };
    return {
      id: listing.id,
      data: {
        lastBumpedAt: bumpedAt,
        priorityScore: computePriorityScore(rankInput),
      },
    };
  });

  return applyScoreUpdates(updates);
}

export function resolveAdminRankingAccess(role: string | undefined): 401 | 403 | null {
  if (!role) return 401;
  if (role.toLowerCase() !== "admin") return 403;
  return null;
}

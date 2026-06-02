// ==========================================
// SecretZa Ranking Engine — v2 (four-tier)
// ==========================================
//
// Every approved listing belongs to exactly ONE tier — its highest active one.
// Tier ownership rules (requirement 11):
//   Boost + Premium + Featured  =>  Boosted pool only
//   Premium + Featured          =>  Premium pool only
//   Featured                    =>  Featured pool only
//   (default)                   =>  Free pool
//
// Score ranges are separated by 1 000 points so that soft signals
// (rotation bump, engagement, recency) can never move a listing into
// a higher tier, even at their combined maximum:
//
//   Boosted:   3 000 – 3 148
//   Premium:   2 000 – 2 148
//   Featured:  1 000 – 1 148
//   Free:          0 –   148
//
// The cron job (/api/cron/refresh-ranking) runs every 30 minutes and:
//   1. Expires User.isPremium where premiumExpiry < now
//   2. Syncs Listing.isPremium from the owning user's live premium status
//   3. Expires isBoosted / isFeatured flags whose windows have closed
//   4. Recomputes priorityScore for every approved listing
//   5. Rotates one batch (20) from each tier (oldest-bumped first)
// ==========================================

export interface ListingRankInput {
  id: string;
  isFeatured: boolean;
  isBoosted: boolean;
  // Listing-level premium flag — authoritative copy of the owner's User.isPremium.
  // Synced every 30 min by the cron; also updated immediately on premium payment
  // approval and expiry.  Optional so existing call-sites that pre-date v2 still
  // compile (treated as false when absent).
  isPremium?: boolean;
  featuredUntil: string | Date | null;
  boostUntil: string | Date | null;
  lastBumpedAt: string | Date | null;
  viewCount: number;
  createdAt: string | Date;
  status: string;
}

export type ListingTier = "boosted" | "premium" | "featured" | "free";

export type RankedListing<T extends ListingRankInput> = T & {
  computedScore: number;
  rankLabel: "boosted" | "premium" | "featured" | "rotated" | "standard";
};

// ==========================================
// Score Constants
// ==========================================
// Tier base scores (1 000 units apart — must never shrink below the maximum
// combined soft-signal score of 148).
const TIER_BOOSTED = 3000;
const TIER_PREMIUM = 2000;
const TIER_FEATURED = 1000;
const TIER_FREE = 0;

// Within-tier rotation bump: decays from MAX_ROTATION_SCORE → 0 over 30 min.
// Applies to ALL four tiers so rotation is fair within each pool.
const MAX_ROTATION_SCORE = 99;

// Soft signals — engagement + recency combined must stay below 1 000.
// Current combined maximum = 25 + 24 = 49.
const MAX_ENGAGEMENT_SCORE = 25;
const MAX_RECENCY_SCORE = 24;

const VIEW_SCORE_FACTOR = 0.005;
const RECENCY_DECAY_DAYS = 30;
export const BUMP_CYCLE_MINUTES = 30;

// ==========================================
// Tier Determination
// ==========================================
// Returns the single highest active tier for a listing.
// Call-sites should use this instead of inspecting individual flags so the
// "highest-active-tier ownership" rule is enforced in one place.
export function getActiveTier(listing: ListingRankInput): ListingTier {
  const now = Date.now();

  if (
    listing.isBoosted &&
    listing.boostUntil &&
    new Date(listing.boostUntil).getTime() > now
  ) {
    return "boosted";
  }

  if (listing.isPremium) {
    return "premium";
  }

  if (
    listing.isFeatured &&
    listing.featuredUntil &&
    new Date(listing.featuredUntil).getTime() > now
  ) {
    return "featured";
  }

  return "free";
}

// ==========================================
// Core: Compute Priority Score
// ==========================================
export function computePriorityScore(listing: ListingRankInput): number {
  const now = Date.now();
  const tier = getActiveTier(listing);

  // 1. Tier base — enforces absolute tier ordering
  let score: number;
  if (tier === "boosted") score = TIER_BOOSTED;
  else if (tier === "premium") score = TIER_PREMIUM;
  else if (tier === "featured") score = TIER_FEATURED;
  else score = TIER_FREE;

  // 2. Within-tier rotation bump (all four tiers)
  if (listing.lastBumpedAt) {
    const minutesSinceBump =
      (now - new Date(listing.lastBumpedAt).getTime()) / (1000 * 60);
    if (minutesSinceBump >= 0 && minutesSinceBump < BUMP_CYCLE_MINUTES) {
      score +=
        MAX_ROTATION_SCORE * (1 - minutesSinceBump / BUMP_CYCLE_MINUTES);
    }
  }

  // 3. View engagement (capped far below the 1 000-unit tier gap)
  score += Math.min(
    MAX_ENGAGEMENT_SCORE,
    listing.viewCount * VIEW_SCORE_FACTOR,
  );

  // 4. Recency bonus (decays over 30 days; capped far below tier gap)
  const daysSinceCreation = Math.max(
    0,
    (now - new Date(listing.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceCreation < RECENCY_DECAY_DAYS) {
    score +=
      MAX_RECENCY_SCORE * (1 - daysSinceCreation / RECENCY_DECAY_DAYS);
  }

  return Math.round(score * 100) / 100;
}

// ==========================================
// Determine Rank Label
// ==========================================
export function getRankLabel(
  listing: ListingRankInput,
  _score: number,
): RankedListing<ListingRankInput>["rankLabel"] {
  const tier = getActiveTier(listing);

  if (tier === "boosted") return "boosted";
  if (tier === "premium") return "premium";
  if (tier === "featured") return "featured";

  // Free tier: recently rotated vs fully standard
  if (listing.lastBumpedAt) {
    const minutesSinceBump =
      (Date.now() - new Date(listing.lastBumpedAt).getTime()) / (1000 * 60);
    if (minutesSinceBump < BUMP_CYCLE_MINUTES) return "rotated";
  }
  return "standard";
}

// ==========================================
// Sort & Rank (in-memory helper)
// ==========================================
export function rankListings<T extends ListingRankInput>(
  listings: T[],
): RankedListing<T>[] {
  return listings
    .map((listing) => {
      const computedScore = computePriorityScore(listing);
      const rankLabel = getRankLabel(listing, computedScore);
      return { ...listing, computedScore, rankLabel };
    })
    .sort((a, b) => b.computedScore - a.computedScore);
}

// ==========================================
// Per-Tier Bump Batch Calculator
// ==========================================
// Returns the IDs of up to `batchSize` listings in `tier` that are due
// for a rotation bump — oldest lastBumpedAt first (listings never bumped
// use createdAt as a proxy so they are prioritised).
export function getNextBumpBatchForTier<T extends ListingRankInput>(
  allListings: T[],
  tier: ListingTier,
  batchSize = 20,
): string[] {
  const now = Date.now();

  const eligible = allListings.filter((l) => {
    if (l.status !== "approved") return false;
    if (getActiveTier(l) !== tier) return false;
    // Skip listings that were bumped within the current cycle
    if (l.lastBumpedAt) {
      const minutesSinceBump =
        (now - new Date(l.lastBumpedAt).getTime()) / (1000 * 60);
      if (minutesSinceBump < BUMP_CYCLE_MINUTES) return false;
    }
    return true;
  });

  // Oldest-bumped first for round-robin fairness
  eligible.sort((a, b) => {
    const aTime = a.lastBumpedAt
      ? new Date(a.lastBumpedAt).getTime()
      : new Date(a.createdAt).getTime();
    const bTime = b.lastBumpedAt
      ? new Date(b.lastBumpedAt).getTime()
      : new Date(b.createdAt).getTime();
    return aTime - bTime;
  });

  return eligible.slice(0, batchSize).map((l) => l.id);
}

// Legacy alias — kept so any external code referencing the old name still
// compiles.  The cron was updated to call getNextBumpBatchForTier directly.
export function getNextBumpBatch<T extends ListingRankInput>(
  freeListings: T[],
  batchSize = 20,
): string[] {
  return getNextBumpBatchForTier(freeListings, "free", batchSize);
}

// ==========================================
// Active-Status Helpers
// ==========================================
export function isBoostActive(listing: ListingRankInput): boolean {
  if (!listing.isBoosted || !listing.boostUntil) return false;
  return new Date(listing.boostUntil).getTime() > Date.now();
}

export function isFeaturedActive(listing: ListingRankInput): boolean {
  if (!listing.isFeatured || !listing.featuredUntil) return false;
  return new Date(listing.featuredUntil).getTime() > Date.now();
}

// ==========================================
// Duration Helpers
// ==========================================
export function getBoostExpiry(durationMinutes = 60): Date {
  return new Date(Date.now() + durationMinutes * 60 * 1000);
}

export function getFeatureExpiry(durationDays: number): Date {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

// ==========================================
// Bulk Expiry Check
// ==========================================
export interface ExpiryCheckResult {
  expiredBoosts: string[];
  expiredFeatured: string[];
}

export function findExpiredListings(
  listings: ListingRankInput[],
): ExpiryCheckResult {
  const now = Date.now();
  const expiredBoosts: string[] = [];
  const expiredFeatured: string[] = [];

  for (const listing of listings) {
    if (listing.isBoosted && listing.boostUntil) {
      if (new Date(listing.boostUntil).getTime() <= now) {
        expiredBoosts.push(listing.id);
      }
    }
    if (listing.isFeatured && listing.featuredUntil) {
      if (new Date(listing.featuredUntil).getTime() <= now) {
        expiredFeatured.push(listing.id);
      }
    }
  }

  return { expiredBoosts, expiredFeatured };
}

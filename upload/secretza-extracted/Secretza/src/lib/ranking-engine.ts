// ==========================================
// Secretza Ranking Engine
// ==========================================
// Computes priority scores for listings based on:
// 1. Boost status (top for 1 hour) — +1000
// 2. Featured status (top until expiry) — +500
// 3. Free listing rotation (bump every 30 min) — +0 to +100
// 4. View engagement — +0 to +50
// 5. Recency — +0 to +50 (decays over 30 days)
// ==========================================

export interface ListingRankInput {
  id: string;
  isFeatured: boolean;
  isBoosted: boolean;
  featuredUntil: string | Date | null;
  boostUntil: string | Date | null;
  lastBumpedAt: string | Date | null;
  viewCount: number;
  createdAt: string | Date;
  status: string;
}

export interface RankedListing<T extends ListingRankInput> extends T {
  computedScore: number;
  rankLabel: "boosted" | "featured" | "rotated" | "standard";
}

// ==========================================
// Score Constants
// ==========================================
const BOOST_SCORE = 1000;
const FEATURED_SCORE = 500;
const MAX_BUMP_SCORE = 100;
const MAX_VIEW_SCORE = 50;
const MAX_RECENCY_SCORE = 50;
const VIEW_SCORE_FACTOR = 0.01;
const RECENCY_DECAY_DAYS = 30;
const BUMP_CYCLE_MINUTES = 30;

// ==========================================
// Core: Compute Priority Score
// ==========================================
export function computePriorityScore(listing: ListingRankInput): number {
  const now = Date.now();
  let score = 0;

  // 1. Boost bonus: +1000 if boosted and within boost window
  if (listing.isBoosted && listing.boostUntil) {
    const boostEnd = new Date(listing.boostUntil).getTime();
    if (boostEnd > now) {
      score += BOOST_SCORE;
    }
  }

  // 2. Featured bonus: +500 if featured and within expiry
  if (listing.isFeatured && listing.featuredUntil) {
    const featuredEnd = new Date(listing.featuredUntil).getTime();
    if (featuredEnd > now) {
      score += FEATURED_SCORE;
    }
  }

  // 3. Free listing rotation bump: decays over 30-minute cycle
  if (listing.lastBumpedAt) {
    const bumpTime = new Date(listing.lastBumpedAt).getTime();
    const minutesSinceBump = (now - bumpTime) / (1000 * 60);
    if (minutesSinceBump >= 0 && minutesSinceBump < BUMP_CYCLE_MINUTES) {
      // Linear decay from MAX_BUMP_SCORE to 0 over 30 minutes
      score += MAX_BUMP_SCORE * (1 - minutesSinceBump / BUMP_CYCLE_MINUTES);
    }
  }

  // 4. View engagement bonus (capped at MAX_VIEW_SCORE)
  score += Math.min(MAX_VIEW_SCORE, listing.viewCount * VIEW_SCORE_FACTOR);

  // 5. Recency bonus (decays over RECENCY_DECAY_DAYS)
  const createdTime = new Date(listing.createdAt).getTime();
  const daysSinceCreation = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
  if (daysSinceCreation < RECENCY_DECAY_DAYS) {
    score += MAX_RECENCY_SCORE * (1 - daysSinceCreation / RECENCY_DECAY_DAYS);
  }

  return Math.round(score * 100) / 100; // 2 decimal precision
}

// ==========================================
// Determine Rank Label
// ==========================================
export function getRankLabel(
  listing: ListingRankInput,
  score: number
): RankedListing<ListingRankInput>["rankLabel"] {
  const now = Date.now();

  if (listing.isBoosted && listing.boostUntil && new Date(listing.boostUntil).getTime() > now) {
    return "boosted";
  }
  if (listing.isFeatured && listing.featuredUntil && new Date(listing.featuredUntil).getTime() > now) {
    return "featured";
  }
  if (listing.lastBumpedAt) {
    const minutesSinceBump = (now - new Date(listing.lastBumpedAt).getTime()) / (1000 * 60);
    if (minutesSinceBump < BUMP_CYCLE_MINUTES) {
      return "rotated";
    }
  }
  return "standard";
}

// ==========================================
// Sort & Rank a List of Listings
// ==========================================
export function rankListings<T extends ListingRankInput>(
  listings: T[]
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
// Check if a listing's boost/featured has expired
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
// Boost Duration Helpers
// ==========================================
export function getBoostExpiry(durationMinutes = 60): Date {
  return new Date(Date.now() + durationMinutes * 60 * 1000);
}

export function getFeatureExpiry(durationDays: number): Date {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

// ==========================================
// Next Bump Batch Calculator
// ==========================================
// Determines which free listings should be bumped in the next cycle
// to ensure fair rotation among non-boosted, non-featured listings
export function getNextBumpBatch<T extends ListingRankInput>(
  freeListings: T[],
  batchSize = 20
): string[] {
  const now = Date.now();
  const eligible = freeListings.filter((l) => {
    // Only approved, non-boosted, non-featured listings
    if (l.status !== "approved") return false;
    if (isBoostActive(l) || isFeaturedActive(l)) return false;
    // Prefer listings that haven't been bumped recently
    if (l.lastBumpedAt) {
      const minutesSinceBump = (now - new Date(l.lastBumpedAt).getTime()) / (1000 * 60);
      if (minutesSinceBump < BUMP_CYCLE_MINUTES) return false;
    }
    return true;
  });

  // Sort by oldest bumped first (or oldest created if never bumped)
  eligible.sort((a, b) => {
    const aTime = a.lastBumpedAt ? new Date(a.lastBumpedAt).getTime() : new Date(a.createdAt).getTime();
    const bTime = b.lastBumpedAt ? new Date(b.lastBumpedAt).getTime() : new Date(b.createdAt).getTime();
    return aTime - bTime;
  });

  return eligible.slice(0, batchSize).map((l) => l.id);
}

// ==========================================
// Expiry Check for Bulk Operations
// ==========================================
export interface ExpiryCheckResult {
  expiredBoosts: string[];
  expiredFeatured: string[];
}

export function findExpiredListings(listings: ListingRankInput[]): ExpiryCheckResult {
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

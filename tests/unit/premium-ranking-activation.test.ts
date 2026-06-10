import { describe, expect, it } from "vitest";
import {
  buildPremiumActivationUpdate,
  computePriorityScore,
  type ListingRankInput,
} from "@/lib/ranking-engine";

function premiumListing(overrides: Partial<ListingRankInput> = {}): ListingRankInput {
  return {
    id: "listing-1",
    isFeatured: false,
    isBoosted: false,
    isPremium: false,
    featuredUntil: null,
    boostUntil: null,
    lastBumpedAt: null,
    viewCount: 0,
    createdAt: new Date("2025-06-01T00:00:00.000Z"),
    status: "approved",
    ...overrides,
  };
}

describe("buildPremiumActivationUpdate", () => {
  it("sets lastBumpedAt on premium approval", () => {
    const before = Date.now();
    const activation = buildPremiumActivationUpdate(premiumListing());
    const after = Date.now();

    expect(activation.lastBumpedAt).toBeInstanceOf(Date);
    expect(activation.lastBumpedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(activation.lastBumpedAt.getTime()).toBeLessThanOrEqual(after);
    expect(activation.isPremium).toBe(true);
  });

  it("recalculates priorityScore using premium tier and fresh lastBumpedAt", () => {
    const bumpedAt = new Date();
    const listing = premiumListing({ viewCount: 10 });
    const activation = buildPremiumActivationUpdate(listing, bumpedAt);

    const expected = computePriorityScore({
      ...listing,
      isPremium: true,
      lastBumpedAt: bumpedAt,
    });

    expect(activation.priorityScore).toBe(expected);
    expect(activation.priorityScore).toBeGreaterThan(2000);
  });

  it("ranks a newly activated premium listing above an older one with identical metrics", () => {
    const shared = {
      viewCount: 50,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      isFeatured: false,
      isBoosted: false,
      featuredUntil: null,
      boostUntil: null,
      status: "approved" as const,
    };

    const olderPremiumBump = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const olderScore = computePriorityScore({
      id: "older",
      ...shared,
      isPremium: true,
      lastBumpedAt: olderPremiumBump,
    });

    const freshActivation = buildPremiumActivationUpdate({
      id: "newer",
      ...shared,
      isPremium: false,
      lastBumpedAt: null,
    });

    expect(freshActivation.priorityScore).toBeGreaterThan(olderScore);
  });
});

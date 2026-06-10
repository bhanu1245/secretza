import { describe, expect, it } from "vitest";
import {
  resolveActiveListingTiers,
  resolveListingTier,
} from "@/components/secretza/listing/ListingTierBadge";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

describe("resolveActiveListingTiers", () => {
  it("returns all active tiers when premium and featured overlap", () => {
    expect(
      resolveActiveListingTiers({
        isPremium: true,
        isFeatured: true,
        featuredUntil: future,
      }),
    ).toEqual(["premium", "featured"]);
  });

  it("includes boosted with premium and featured when all active", () => {
    expect(
      resolveActiveListingTiers({
        isBoosted: true,
        boostUntil: future,
        isPremium: true,
        isFeatured: true,
        featuredUntil: future,
      }),
    ).toEqual(["boosted", "premium", "featured"]);
  });

  it("omits expired featured", () => {
    expect(
      resolveActiveListingTiers({
        isPremium: true,
        isFeatured: true,
        featuredUntil: past,
      }),
    ).toEqual(["premium"]);
  });

  it("shows featured when only featured is active", () => {
    expect(
      resolveActiveListingTiers({
        isFeatured: true,
        featuredUntil: future,
      }),
    ).toEqual(["featured"]);
  });

  it("returns empty when no active tier", () => {
    expect(
      resolveActiveListingTiers({
        isFeatured: true,
        featuredUntil: past,
      }),
    ).toEqual([]);
  });
});

describe("resolveListingTier", () => {
  it("returns highest-priority active tier for compact display", () => {
    expect(
      resolveListingTier({
        isBoosted: true,
        boostUntil: future,
        isPremium: true,
        isFeatured: true,
        featuredUntil: future,
      }),
    ).toBe("boosted");
  });

  it("returns premium when boost is inactive but premium and featured are active", () => {
    expect(
      resolveListingTier({
        isBoosted: true,
        boostUntil: past,
        isPremium: true,
        isFeatured: true,
        featuredUntil: future,
      }),
    ).toBe("premium");
  });
});

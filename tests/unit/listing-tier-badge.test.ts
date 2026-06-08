import { describe, expect, it } from "vitest";
import { resolveListingTier } from "@/components/secretza/listing/ListingTierBadge";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

describe("resolveListingTier", () => {
  it("prioritizes boosted over premium and featured", () => {
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

  it("shows premium when boost is inactive", () => {
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

  it("shows featured when only featured is active", () => {
    expect(
      resolveListingTier({
        isFeatured: true,
        featuredUntil: future,
      }),
    ).toBe("featured");
  });

  it("returns null when no active tier", () => {
    expect(
      resolveListingTier({
        isPremium: false,
        isFeatured: true,
        featuredUntil: past,
      }),
    ).toBeNull();
  });
});

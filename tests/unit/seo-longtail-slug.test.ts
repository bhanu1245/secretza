import { describe, expect, it } from "vitest";
import {
  buildLongtailSlugAndUrl,
  buildTwoSegmentCanonicalUrl,
  isSingleSegmentSeoSlug,
  proposeLongtailSlugRepair,
  proposeSeoSlugRepair,
} from "@/lib/seo-longtail-slug";

describe("seo-longtail-slug", () => {
  it("builds two-segment slug and canonical from phrase and city", () => {
    const result = buildLongtailSlugAndUrl("Russian Escorts", "hyderabad");
    expect(result.pageSlug).toBe("russian-escorts/hyderabad");
    expect(result.canonicalUrl).toBe("/russian-escorts/hyderabad");
  });

  it("builds vip escorts bangalore format", () => {
    const result = buildLongtailSlugAndUrl("VIP Escorts", "bangalore");
    expect(result.pageSlug).toBe("vip-escorts/bangalore");
    expect(buildTwoSegmentCanonicalUrl("vip-escorts", "bangalore")).toBe("/vip-escorts/bangalore");
  });

  it("detects single-segment slugs", () => {
    expect(isSingleSegmentSeoSlug("russian-escorts-hyderabad")).toBe(true);
    expect(isSingleSegmentSeoSlug("russian-escorts/hyderabad")).toBe(false);
  });

  it("proposes repair from hyphenated slug", () => {
    expect(proposeLongtailSlugRepair("russian-escorts-hyderabad", ["hyderabad", "bangalore"])).toBe(
      "russian-escorts/hyderabad",
    );
    expect(proposeLongtailSlugRepair("vip-escorts-bangalore", ["hyderabad", "bangalore"])).toBe(
      "vip-escorts/bangalore",
    );
  });

  it("returns null when repair is not possible", () => {
    expect(proposeSeoSlugRepair("cheap-escorts/adilabad", "longtail", ["hyderabad"])).toBeNull();
  });
});

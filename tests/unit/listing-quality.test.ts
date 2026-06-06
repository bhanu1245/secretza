import { describe, it, expect } from "vitest";
import {
  computeListingQuality,
  LISTING_SCORE_WEIGHTS,
} from "@/lib/listing-seo/listing-quality";
import { generateListingDescription } from "@/lib/listing-seo/listing-seo-content";

const RICH = {
  title: "Independent VIP Escort in Anna Nagar, Chennai",
  description: generateListingDescription({
    id: "x1",
    category: "escorts",
    subcategory: "independent",
    city: "chennai",
    area: "anna-nagar",
    state: "tamil-nadu",
    keywords: "vip companion, verified",
    services: ["dinner date", "travel companion"],
  }),
  keywords: "vip companion, verified",
  imageCount: 3,
  city: "Chennai",
  area: "Anna Nagar",
  state: "Tamil Nadu",
  contacts: { phone: "+91 98765 43210", whatsapp: "+91 98765 43210" },
  peers: [],
};

describe("Listing SEO V5 Lite — scoring", () => {
  it("weights total exactly 100", () => {
    const sum = Object.values(LISTING_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("scores a rich listing highly with every dimension within its cap", () => {
    const r = computeListingQuality(RICH);
    expect(r.total).toBeGreaterThan(70);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.breakdown.titleQuality).toBeLessThanOrEqual(LISTING_SCORE_WEIGHTS.titleQuality);
    expect(r.breakdown.descriptionQuality).toBeLessThanOrEqual(LISTING_SCORE_WEIGHTS.descriptionQuality);
    expect(r.breakdown.images).toBe(LISTING_SCORE_WEIGHTS.images);
    expect(r.breakdown.locationCompleteness).toBe(LISTING_SCORE_WEIGHTS.locationCompleteness);
    expect(r.breakdown.contactCompleteness).toBe(LISTING_SCORE_WEIGHTS.contactCompleteness);
  });

  it("does NOT use a 500-word target — 150+ words meets the minimum", () => {
    const r = computeListingQuality(RICH);
    expect(r.meetsMinWords).toBe(true);
    expect(r.wordCount).toBeLessThan(500);
  });

  it("penalises a sparse listing", () => {
    const r = computeListingQuality({
      title: "Hi",
      description: "Short.",
      imageCount: 0,
    });
    const rich = computeListingQuality(RICH);
    expect(r.total).toBeLessThan(rich.total);
    expect(r.breakdown.images).toBe(0);
    expect(r.breakdown.contactCompleteness).toBe(0);
  });

  it("keyword coverage rewards keywords present in the copy", () => {
    const withKw = computeListingQuality(RICH);
    const noMatch = computeListingQuality({ ...RICH, keywords: "nonexistentterm zzz" });
    expect(withKw.breakdown.keywordCoverage).toBeGreaterThan(noMatch.breakdown.keywordCoverage);
  });

  it("detects duplicate content against peers (low uniqueness, high risk)", () => {
    const dup = computeListingQuality({
      ...RICH,
      peers: [{ title: RICH.title, description: RICH.description }],
    });
    const unique = computeListingQuality(RICH);
    expect(dup.uniquenessScore).toBeLessThan(unique.uniquenessScore);
    expect(dup.duplicateRisk).toBe("high");
  });

  it("uniqueness carries the heaviest weight (20)", () => {
    const maxOther = Math.max(
      LISTING_SCORE_WEIGHTS.titleQuality,
      LISTING_SCORE_WEIGHTS.descriptionQuality,
      LISTING_SCORE_WEIGHTS.keywordCoverage,
      LISTING_SCORE_WEIGHTS.readability,
      LISTING_SCORE_WEIGHTS.images,
      LISTING_SCORE_WEIGHTS.locationCompleteness,
      LISTING_SCORE_WEIGHTS.contactCompleteness,
    );
    expect(LISTING_SCORE_WEIGHTS.uniqueness).toBe(20);
    expect(LISTING_SCORE_WEIGHTS.uniqueness).toBeGreaterThanOrEqual(maxOther);
  });

  it("applies a duplicate-risk penalty to the headline total", () => {
    const unique = computeListingQuality(RICH);
    const dup = computeListingQuality({
      ...RICH,
      peers: [{ title: RICH.title, description: RICH.description }],
    });
    // High-risk duplicate must drop well below the unique listing: lost
    // uniqueness points AND the headline penalty.
    expect(unique.total - dup.total).toBeGreaterThanOrEqual(20);
  });

  it("excludes FAQ/internal-link/canonical inputs entirely (not in breakdown)", () => {
    const r = computeListingQuality(RICH);
    const keys = Object.keys(r.breakdown);
    expect(keys).not.toContain("faqCount");
    expect(keys).not.toContain("internalLinksCount");
    expect(keys).toEqual([
      "titleQuality",
      "descriptionQuality",
      "keywordCoverage",
      "readability",
      "images",
      "locationCompleteness",
      "contactCompleteness",
      "uniqueness",
    ]);
  });
});

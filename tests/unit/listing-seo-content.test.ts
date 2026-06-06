import { describe, it, expect } from "vitest";
import {
  generateListingTitle,
  generateListingDescription,
  improveListingDescription,
  LISTING_SEO_LIMITS,
  type ListingSeoInput,
} from "@/lib/listing-seo/listing-seo-content";
import { isContentClean } from "@/lib/content-filter";

const BASE: ListingSeoInput = {
  id: "listing-123",
  category: "escorts",
  subcategory: "independent",
  city: "chennai",
  area: "anna-nagar",
  state: "tamil-nadu",
  keywords: "vip companion, verified",
  services: ["dinner date", "travel companion"],
};

function wordCount(t: string): number {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

describe("Listing SEO V5 Lite — content", () => {
  it("title is deterministic for the same input", () => {
    expect(generateListingTitle(BASE)).toBe(generateListingTitle(BASE));
  });

  it("title respects the max length and is contact-clean", () => {
    const title = generateListingTitle(BASE);
    expect(title.length).toBeLessThanOrEqual(LISTING_SEO_LIMITS.TITLE_MAX);
    expect(title.length).toBeGreaterThanOrEqual(40);
    expect(isContentClean(title)).toBe(true);
  });

  it("different listings produce different titles (deterministic uniqueness)", () => {
    const a = generateListingTitle({ ...BASE, id: "aaa", city: "mumbai" });
    const b = generateListingTitle({ ...BASE, id: "zzz", city: "delhi" });
    expect(a).not.toBe(b);
  });

  it("description is deterministic, in the 150–300 word band, multi-paragraph, clean", () => {
    const desc = generateListingDescription(BASE);
    expect(desc).toBe(generateListingDescription(BASE));
    const words = wordCount(desc);
    expect(words).toBeGreaterThanOrEqual(LISTING_SEO_LIMITS.DESC_MIN_WORDS);
    expect(words).toBeLessThanOrEqual(LISTING_SEO_LIMITS.DESC_MAX_WORDS);
    expect(desc.split(/\n\n+/).length).toBeGreaterThanOrEqual(2);
    expect(isContentClean(desc)).toBe(true);
  });

  it("weaves keywords into the description", () => {
    const desc = generateListingDescription(BASE).toLowerCase();
    expect(desc).toContain("vip companion");
  });

  it("uses advertiser services and never invents contact details", () => {
    const desc = generateListingDescription(BASE).toLowerCase();
    expect(desc).toContain("dinner date");
    expect(desc).toContain("travel companion");
    expect(isContentClean(desc)).toBe(true);
  });

  it("improve expands thin content toward the minimum and stays clean", () => {
    const thin = "Friendly and professional.";
    const improved = improveListingDescription(thin, BASE);
    expect(wordCount(improved)).toBeGreaterThan(wordCount(thin));
    expect(isContentClean(improved)).toBe(true);
  });

  it("improve of empty content with context returns a fresh draft", () => {
    expect(improveListingDescription("", BASE).length).toBeGreaterThan(0);
  });

  it("improve of empty content without context returns empty", () => {
    expect(improveListingDescription("")).toBe("");
  });

  it("produces a draft even with almost no input (never throws/empty title)", () => {
    const title = generateListingTitle({ city: "pune" });
    expect(title.length).toBeGreaterThan(0);
    const desc = generateListingDescription({ city: "pune" });
    expect(wordCount(desc)).toBeGreaterThanOrEqual(LISTING_SEO_LIMITS.DESC_MIN_WORDS);
  });

  it("uses adjective-first, singular category phrasing (Independent Escort, not Escorts Independent)", () => {
    expect(generateListingTitle({ id: "t1", category: "escorts", subcategory: "independent", city: "mumbai" }))
      .toContain("Independent Escort");
    expect(generateListingTitle({ id: "t2", category: "massage", subcategory: "thai", city: "delhi" }))
      .toContain("Thai Massage");
    expect(generateListingTitle({ id: "t3", category: "companions", subcategory: "social", city: "goa" }))
      .toContain("Social Companion");
    // never the slug-style reversed form
    expect(generateListingTitle({ id: "t1", category: "escorts", subcategory: "independent", city: "mumbai" }))
      .not.toMatch(/Escorts Independent/);
  });

  it("uppercases known acronyms in the offering (vip → VIP)", () => {
    expect(generateListingTitle({ id: "v1", category: "escorts", subcategory: "vip", city: "mumbai" }))
      .toContain("VIP Escort");
  });

  it("never duplicates the category noun when the subcategory already contains it", () => {
    const cases: Array<[string, string]> = [
      ["female-escorts", "Female Escort"],
      ["male-escorts", "Male Escort"],
      ["vip-escorts", "VIP Escort"],
      ["independent-escorts", "Independent Escort"],
    ];
    for (const [subcategory, expected] of cases) {
      const title = generateListingTitle({ id: `dup-${subcategory}`, category: "escorts", subcategory, city: "mumbai" });
      expect(title).toContain(expected);
      expect(title).not.toMatch(/Escorts?\s+Escort/i); // no "Escorts Escort" / "Escort Escort"
    }
  });

  it("includes Area + City in the title whenever an area exists", () => {
    const title = generateListingTitle({ id: "ac1", category: "escorts", subcategory: "independent", city: "mumbai", area: "andheri", state: "maharashtra" });
    expect(title.toLowerCase()).toContain("andheri");
    expect(title.toLowerCase()).toContain("mumbai");
  });

  it("never duplicates a location fragment in the title", () => {
    for (const city of ["mumbai", "bangalore", "chennai", "pune", "kolkata"]) {
      const title = generateListingTitle({ id: `dup-${city}`, category: "escorts", subcategory: "vip", city, area: `${city}-central`, state: "maharashtra" });
      // no "in X – in X" repetition
      const inCount = (title.toLowerCase().match(new RegExp(`in ${city}`, "g")) ?? []).length;
      expect(inCount).toBeLessThanOrEqual(1);
    }
  });

  it("collapses city == state duplication (Delhi, Delhi → Delhi)", () => {
    const title = generateListingTitle({ id: "cs1", category: "escorts", subcategory: "agency", city: "delhi", state: "delhi" });
    expect(title).not.toMatch(/Delhi,\s*Delhi/i);
    const desc = generateListingDescription({ id: "cs1", category: "escorts", subcategory: "agency", city: "goa", state: "goa" });
    expect(desc).not.toMatch(/Goa,\s*Goa/i);
  });

  it("weaves ALL provided keywords across the description", () => {
    const desc = generateListingDescription({
      id: "kw1", category: "escorts", subcategory: "vip", city: "mumbai", area: "andheri",
      keywords: "vip escort, discreet, verified",
    }).toLowerCase();
    expect(desc).toContain("vip escort");
    expect(desc).toContain("discreet");
    expect(desc).toContain("verified");
  });

  it("two sibling listings (same category + city) produce distinct copy", () => {
    const a = generateListingDescription({ id: "sib-a", category: "escorts", subcategory: "independent", city: "mumbai", area: "andheri", state: "maharashtra", services: ["dinner date"] });
    const b = generateListingDescription({ id: "sib-b", category: "escorts", subcategory: "independent", city: "mumbai", area: "powai", state: "maharashtra", services: ["dinner date"] });
    expect(a).not.toBe(b);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_LONGTAIL_KEYWORDS,
  buildCategoryCityKeywordPhrase,
  buildKeywordCityPhrase,
  buildLongtailPhrase,
} from "@/lib/seo-longtail-templates";

describe("seo-longtail-templates", () => {
  it("exports default longtail templates", () => {
    expect(DEFAULT_LONGTAIL_KEYWORDS).toContain("VIP");
    expect(DEFAULT_LONGTAIL_KEYWORDS).toContain("Independent");
    expect(DEFAULT_LONGTAIL_KEYWORDS.length).toBeGreaterThanOrEqual(10);
  });

  it("builds longtail phrase from template, category, city", () => {
    expect(buildLongtailPhrase("VIP", "Escorts", "Bangalore")).toBe("VIP Escorts Bangalore");
  });

  it("builds category city keyword phrase from prefix", () => {
    expect(buildCategoryCityKeywordPhrase("Russian", "Escorts", "Bangalore")).toBe(
      "Russian Escorts Bangalore",
    );
  });

  it("builds keyword city phrase", () => {
    expect(buildKeywordCityPhrase("VIP Escorts", "Mumbai")).toBe("VIP Escorts Mumbai");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cityFindMany,
  categoryFindMany,
  seoPageFindMany,
  upsertFromContent,
  cityFindUnique,
} = vi.hoisted(() => ({
  cityFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  seoPageFindMany: vi.fn(),
  upsertFromContent: vi.fn(),
  cityFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    city: { findMany: cityFindMany, findUnique: cityFindUnique },
    category: { findMany: categoryFindMany },
    seoPage: { findMany: seoPageFindMany },
  },
}));

vi.mock("@/lib/seo-page-service", () => ({
  upsertFromContent,
}));

vi.mock("@/lib/seo-engine", () => ({
  generateCitySEOContent: vi.fn(() => ({
    title: "City",
    metaDescription: "City meta",
    h1: "City",
    introParagraph: "Intro",
  })),
  generateCategorySEOContent: vi.fn(() => ({
    title: "Category",
    metaDescription: "Category meta",
    h1: "Category",
    introParagraph: "Intro",
  })),
  generateLongTailSEOContent: vi.fn(() => ({
    title: "Longtail",
    metaDescription: "Longtail meta",
    h1: "Longtail",
    introParagraph: "Intro",
  })),
}));

import {
  normalizeKeywordList,
  normalizeKeywordsForGeneration,
  slugFromKeyword,
  parseKeywordCsv,
  mergeKeywordSources,
  extractCityFromKeyword,
  resolveKeywordPageType,
  previewKeywordGeneration,
  generateKeywordPages,
  resetKeywordGenerationCaches,
  resolveSeoKeywordAccess,
} from "@/lib/seo-keyword-generation";

const cities = [
  {
    name: "Bangalore",
    slug: "bangalore",
    stateName: "Karnataka",
    stateSlug: "karnataka",
    countryName: "India",
    countrySlug: "india",
  },
  {
    name: "Mumbai",
    slug: "mumbai",
    stateName: "Maharashtra",
    stateSlug: "maharashtra",
    countryName: "India",
    countrySlug: "india",
  },
];

const categories = [{ name: "Escorts", slug: "escorts" }];

beforeEach(() => {
  vi.clearAllMocks();
  resetKeywordGenerationCaches();
  cityFindMany.mockResolvedValue(
    cities.map((c) => ({
      name: c.name,
      slug: c.slug,
      state: {
        name: c.stateName,
        slug: c.stateSlug,
        country: { name: c.countryName, slug: c.countrySlug },
      },
    })),
  );
  categoryFindMany.mockResolvedValue(categories);
  seoPageFindMany.mockResolvedValue([]);
  upsertFromContent.mockResolvedValue({ id: "page-1" });
  cityFindUnique.mockResolvedValue({
    id: "city-1",
    name: "Bangalore",
    slug: "bangalore",
    state: {
      name: "Karnataka",
      slug: "karnataka",
      country: { name: "India", slug: "india" },
    },
  });
});

describe("keyword normalization", () => {
  it("trims, dedupes, and ignores empty lines", () => {
    expect(
      normalizeKeywordList([
        "  VIP Escorts Bangalore  ",
        "",
        "VIP Escorts Bangalore",
        "Luxury Escorts Bangalore",
      ]),
    ).toEqual(["VIP Escorts Bangalore", "Luxury Escorts Bangalore"]);
  });

  it("slugifies keywords consistently", () => {
    expect(slugFromKeyword("Independent Escorts Bangalore")).toBe("independent-escorts-bangalore");
  });

  it("parses CSV with keyword header", () => {
    const csv = "keyword\nIndependent Escorts Bangalore\nVIP Escorts Bangalore";
    expect(parseKeywordCsv(csv)).toEqual([
      "Independent Escorts Bangalore",
      "VIP Escorts Bangalore",
    ]);
  });

  it("merges textarea and csv sources", () => {
    expect(
      mergeKeywordSources(["VIP Escorts Bangalore"], ["Luxury Escorts Bangalore", "VIP Escorts Bangalore"]),
    ).toEqual(["VIP Escorts Bangalore", "Luxury Escorts Bangalore"]);
  });

  it("dedupes keywords that normalize to the same slug", () => {
    expect(
      normalizeKeywordsForGeneration([
        "VIP Escorts Bangalore",
        "vip escorts bangalore",
        "VIP-Escorts-Bangalore",
      ]),
    ).toEqual(["VIP Escorts Bangalore"]);
  });
});

describe("resolveSeoKeywordAccess", () => {
  it("allows admin only", () => {
    expect(resolveSeoKeywordAccess("admin")).toBeNull();
    expect(resolveSeoKeywordAccess("moderator")).toBe(403);
  });
});

describe("extractCityFromKeyword", () => {
  it("extracts trailing city name", () => {
    const match = extractCityFromKeyword("Independent Escorts Bangalore", cities);
    expect(match?.phrase).toBe("Independent Escorts");
    expect(match?.city.name).toBe("Bangalore");
  });
});

describe("resolveKeywordPageType", () => {
  it("auto-detects longtail when city is embedded", () => {
    expect(
      resolveKeywordPageType("VIP Escorts Bangalore", "vip-escorts-bangalore", "auto", cities, categories),
    ).toBe("longtail");
  });

  it("maps custom option to longtail", () => {
    expect(resolveKeywordPageType("Some Phrase", "some-phrase", "custom", cities, categories)).toBe(
      "longtail",
    );
  });
});

describe("previewKeywordGeneration", () => {
  it("returns preview rows with slug paths", async () => {
    const preview = await previewKeywordGeneration({
      keywords: ["Independent Escorts Bangalore", "VIP Escorts Bangalore"],
      pageTypeOption: "auto",
      mode: "keywords",
    });

    expect(preview?.keywordCount).toBe(2);
    expect(preview?.entries[0]?.slug).toBe("independent-escorts/bangalore");
    expect(preview?.entries[0]?.canonicalUrl).toBe("/independent-escorts/bangalore");
    expect(preview?.toGenerate).toBe(2);
  });

  it("marks existing pages as skip", async () => {
    seoPageFindMany.mockResolvedValue([
      { pageType: "longtail", pageSlug: "vip-escorts/bangalore" },
    ]);

    const preview = await previewKeywordGeneration({
      keywords: ["VIP Escorts Bangalore", "Luxury Escorts Bangalore"],
      pageTypeOption: "auto",
      mode: "keywords",
    });

    expect(preview?.toSkip).toBe(1);
    expect(preview?.toGenerate).toBe(1);
    expect(preview?.entries.find((e) => e.slug === "vip-escorts/bangalore")?.willGenerate).toBe(false);
  });

  it("builds keyword+city combinations", async () => {
    const preview = await previewKeywordGeneration({
      keywords: ["Independent Escorts", "VIP Escorts"],
      pageTypeOption: "auto",
      mode: "keyword_city",
      cityId: "city-1",
    });

    expect(preview?.cityName).toBe("Bangalore");
    expect(preview?.entries[0]?.keyword).toBe("Independent Escorts Bangalore");
    expect(preview?.entries[1]?.keyword).toBe("VIP Escorts Bangalore");
    expect(preview?.entries[0]?.slug).toBe("independent-escorts/bangalore");
    expect(preview?.entries[0]?.canonicalUrl).toBe("/independent-escorts/bangalore");
  });
});

describe("generateKeywordPages", () => {
  it("creates only missing pages and skips existing", async () => {
    seoPageFindMany.mockResolvedValue([
      { pageType: "longtail", pageSlug: "vip-escorts/bangalore" },
    ]);

    const result = await generateKeywordPages({
      keywords: ["VIP Escorts Bangalore", "Luxury Escorts Bangalore"],
      pageTypeOption: "auto",
      mode: "keywords",
    });

    expect(result?.generated).toBe(1);
    expect(result?.skipped).toBe(1);
    expect(result?.failed).toBe(0);
    expect(upsertFromContent).toHaveBeenCalledTimes(1);
  });
});

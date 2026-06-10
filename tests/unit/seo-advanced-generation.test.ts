import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cityFindUnique,
  categoryFindFirst,
  seoPageFindMany,
  upsertFromContent,
} = vi.hoisted(() => ({
  cityFindUnique: vi.fn(),
  categoryFindFirst: vi.fn(),
  seoPageFindMany: vi.fn(),
  upsertFromContent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    city: { findUnique: cityFindUnique },
    category: { findFirst: categoryFindFirst },
    seoPage: { findMany: seoPageFindMany },
  },
}));

vi.mock("@/lib/seo-page-service", () => ({
  upsertFromContent,
}));

vi.mock("@/lib/seo-engine", () => ({
  generateLongTailSEOContent: vi.fn(() => ({
    title: "Longtail",
    metaDescription: "Browse verified listings",
    h1: "Longtail H1",
    introParagraph: "Intro content here",
    faqs: [],
    breadcrumbItems: [],
    internalLinks: [],
  })),
}));

import {
  applyBulkSafetyFlags,
  generateCityCategoryKeywordPages,
  generateCityCategoryLongtailPages,
  generateKeywordMultiCityPages,
  previewCityCategoryKeywords,
  previewCityCategoryLongtail,
  previewKeywordMultiCity,
  resolveSeoAdvancedAccess,
  BULK_STRICT_THRESHOLD,
  BULK_WARNING_THRESHOLD,
  PREVIEW_EXAMPLE_LIMIT,
} from "@/lib/seo-advanced-generation";
import { DEFAULT_LONGTAIL_KEYWORDS } from "@/lib/seo-longtail-templates";

const bangalore = {
  id: "city-1",
  name: "Bangalore",
  slug: "bangalore",
  state: {
    name: "Karnataka",
    slug: "karnataka",
    country: { name: "India", slug: "india" },
  },
};

const mumbai = {
  id: "city-2",
  name: "Mumbai",
  slug: "mumbai",
  state: {
    name: "Maharashtra",
    slug: "maharashtra",
    country: { name: "India", slug: "india" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  cityFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    if (where.id === "city-1") return bangalore;
    if (where.id === "city-2") return mumbai;
    return null;
  });
  categoryFindFirst.mockResolvedValue({ id: "cat-1", name: "Escorts", slug: "escorts" });
  seoPageFindMany.mockResolvedValue([]);
  upsertFromContent.mockResolvedValue({ id: "page-1" });
});

describe("resolveSeoAdvancedAccess", () => {
  it("allows admin and denies moderator", () => {
    expect(resolveSeoAdvancedAccess("admin")).toBeNull();
    expect(resolveSeoAdvancedAccess("moderator")).toBe(403);
    expect(resolveSeoAdvancedAccess(undefined)).toBe(401);
  });
});

describe("applyBulkSafetyFlags", () => {
  it("flags warning at 500 and strict at 2000", () => {
    expect(applyBulkSafetyFlags(100)).toEqual({
      requiresBulkWarning: false,
      requiresStrictConfirmation: false,
    });
    expect(applyBulkSafetyFlags(BULK_WARNING_THRESHOLD).requiresBulkWarning).toBe(true);
    expect(applyBulkSafetyFlags(BULK_STRICT_THRESHOLD).requiresStrictConfirmation).toBe(true);
  });
});

describe("previewKeywordMultiCity", () => {
  it("builds keyword × city combinations", async () => {
    const preview = await previewKeywordMultiCity({
      keywords: ["VIP Escorts", "Luxury Escorts"],
      cityIds: ["city-1", "city-2"],
    });

    expect(preview?.keywordCount).toBe(2);
    expect(preview?.cityCount).toBe(2);
    expect(preview?.total).toBe(4);
    expect(preview?.entries[0]?.keyword).toBe("VIP Escorts Bangalore");
    expect(preview?.entries[0]?.slug).toBe("vip-escorts/bangalore");
    expect(preview?.entries[0]?.canonicalUrl).toBe("/vip-escorts/bangalore");
    expect(preview?.examples.length).toBeLessThanOrEqual(PREVIEW_EXAMPLE_LIMIT);
  });

  it("skips existing slugs", async () => {
    seoPageFindMany.mockResolvedValue([{ pageSlug: "vip-escorts/bangalore" }]);

    const preview = await previewKeywordMultiCity({
      keywords: ["VIP Escorts"],
      cityIds: ["city-1", "city-2"],
    });

    expect(preview?.toSkip).toBe(1);
    expect(preview?.toGenerate).toBe(1);
  });
});

describe("previewCityCategoryLongtail", () => {
  it("generates template combinations for city and category", async () => {
    const preview = await previewCityCategoryLongtail({
      cityId: "city-1",
      categoryId: "cat-1",
    });

    expect(preview?.templateCount).toBe(DEFAULT_LONGTAIL_KEYWORDS.length);
    expect(preview?.total).toBe(DEFAULT_LONGTAIL_KEYWORDS.length);
    expect(preview?.entries[0]?.keyword).toContain("Bangalore");
    expect(preview?.entries[0]?.keyword).toContain("Escorts");
  });
});

describe("previewCityCategoryKeywords", () => {
  it("builds custom keyword phrases", async () => {
    const preview = await previewCityCategoryKeywords({
      cityId: "city-1",
      categoryId: "cat-1",
      keywords: ["Russian", "VIP"],
    });

    expect(preview?.keywordCount).toBe(2);
    expect(preview?.entries[0]?.keyword).toBe("Russian Escorts Bangalore");
    expect(preview?.entries[0]?.slug).toBe("russian-escorts/bangalore");
    expect(preview?.entries[0]?.canonicalUrl).toBe("/russian-escorts/bangalore");
    expect(preview?.entries[0]?.title).toContain("Russian Escorts Bangalore");
  });
});

describe("generateKeywordMultiCityPages", () => {
  it("creates only missing pages", async () => {
    seoPageFindMany.mockResolvedValue([{ pageSlug: "vip-escorts/bangalore" }]);

    const result = await generateKeywordMultiCityPages({
      keywords: ["VIP Escorts"],
      cityIds: ["city-1", "city-2"],
    });

    expect(result?.generated).toBe(1);
    expect(result?.skipped).toBe(1);
    expect(upsertFromContent).toHaveBeenCalledTimes(1);
  });
});

describe("generateCityCategoryLongtailPages", () => {
  it("generates all template pages", async () => {
    const result = await generateCityCategoryLongtailPages({
      cityId: "city-1",
      categoryId: "cat-1",
    });

    expect(result?.generated).toBe(DEFAULT_LONGTAIL_KEYWORDS.length);
    expect(upsertFromContent).toHaveBeenCalledTimes(DEFAULT_LONGTAIL_KEYWORDS.length);
  });
});

describe("generateCityCategoryKeywordPages", () => {
  it("generates custom keyword pages", async () => {
    const result = await generateCityCategoryKeywordPages({
      cityId: "city-1",
      categoryId: "cat-1",
      keywords: ["Celebrity", "Elite"],
    });

    expect(result?.generated).toBe(2);
    expect(result?.categoryName).toBe("Escorts");
  });
});

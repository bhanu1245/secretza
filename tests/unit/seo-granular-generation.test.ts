import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cityFindUnique,
  categoryFindMany,
  categoryFindFirst,
  seoPageFindMany,
  upsertFromContent,
} = vi.hoisted(() => ({
  cityFindUnique: vi.fn(),
  categoryFindMany: vi.fn(),
  categoryFindFirst: vi.fn(),
  seoPageFindMany: vi.fn(),
  upsertFromContent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    city: { findUnique: cityFindUnique },
    category: { findMany: categoryFindMany, findFirst: categoryFindFirst },
    seoPage: { findMany: seoPageFindMany },
  },
}));

vi.mock("@/lib/seo-page-service", () => ({
  upsertFromContent,
}));

vi.mock("@/lib/seo-engine", () => ({
  generateCitySEOContent: vi.fn(() => ({
    title: "City Title",
    metaDescription: "City meta",
    h1: "City H1",
    introContent: "City intro",
    schemaJson: "{}",
  })),
  generateCategoryCitySEOContent: vi.fn(() => ({
    title: "Cat City Title",
    metaDescription: "Cat city meta",
    h1: "Cat City H1",
    introContent: "Cat city intro",
    schemaJson: "{}",
  })),
  generateLongTailSEOContent: vi.fn(() => ({
    title: "Longtail Title",
    metaDescription: "Longtail meta",
    h1: "Longtail H1",
    introContent: "Longtail intro",
    schemaJson: "{}",
  })),
}));

import {
  previewCitySeoPack,
  previewSingleCityPage,
  previewCategoryCityPage,
  generateSingleCitySeoPage,
  generateSingleCategoryCitySeoPage,
  generateCitySeoPack,
  resolveSeoGranularAccess,
} from "@/lib/seo-granular-generation";

const cityContext = {
  id: "city-1",
  name: "Bangalore",
  slug: "bangalore",
  state: {
    name: "Karnataka",
    slug: "karnataka",
    country: { name: "India", slug: "india" },
  },
};

const categories = [
  { id: "cat-1", slug: "escorts", name: "Escorts" },
  { id: "cat-2", slug: "massage", name: "Massage" },
];

beforeEach(() => {
  vi.clearAllMocks();
  cityFindUnique.mockResolvedValue(cityContext);
  categoryFindMany.mockResolvedValue(categories);
  categoryFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    categories.find((c) => c.id === where.id) ?? null,
  );
  upsertFromContent.mockResolvedValue({ id: "page-1" });
});

function mockExistingSlugs(
  entries: Array<{ pageType: string; pageSlug: string }>,
) {
  seoPageFindMany.mockResolvedValue(entries);
}

describe("resolveSeoGranularAccess", () => {
  it("allows admin only", () => {
    expect(resolveSeoGranularAccess("admin")).toBeNull();
    expect(resolveSeoGranularAccess("moderator")).toBe(403);
    expect(resolveSeoGranularAccess(undefined)).toBe(401);
  });
});

describe("previewCitySeoPack", () => {
  it("counts missing pages across city, category_city, and longtail", async () => {
    mockExistingSlugs([
      { pageType: "city", pageSlug: "bangalore" },
      { pageType: "category_city", pageSlug: "escorts/bangalore" },
    ]);

    const preview = await previewCitySeoPack("city-1");
    expect(preview).not.toBeNull();
    expect(preview!.cityName).toBe("Bangalore");
    expect(preview!.total).toBe(1 + categories.length + 8);
    expect(preview!.toSkip).toBe(2);
    expect(preview!.toGenerate).toBe(preview!.total - 2);
    expect(preview!.breakdown.city).toBe(0);
    expect(preview!.breakdown.categoryCity).toBe(1);
    expect(preview!.breakdown.longtail).toBe(8);
  });

  it("returns null when city is missing", async () => {
    cityFindUnique.mockResolvedValue(null);
    expect(await previewCitySeoPack("missing")).toBeNull();
  });
});

describe("previewSingleCityPage", () => {
  it("reports one page to generate when city page is missing", async () => {
    mockExistingSlugs([]);
    const preview = await previewSingleCityPage("city-1");
    expect(preview!.toGenerate).toBe(1);
    expect(preview!.toSkip).toBe(0);
  });

  it("reports skip when city page already exists", async () => {
    mockExistingSlugs([{ pageType: "city", pageSlug: "bangalore" }]);
    const preview = await previewSingleCityPage("city-1");
    expect(preview!.toGenerate).toBe(0);
    expect(preview!.toSkip).toBe(1);
  });
});

describe("previewCategoryCityPage", () => {
  it("previews a single category+city combination", async () => {
    mockExistingSlugs([]);
    const preview = await previewCategoryCityPage("city-1", "cat-1");
    expect(preview!.categoryName).toBe("Escorts");
    expect(preview!.toGenerate).toBe(1);
    expect(preview!.breakdown.categoryCity).toBe(1);
  });

  it("skips when category+city page exists", async () => {
    mockExistingSlugs([{ pageType: "category_city", pageSlug: "escorts/bangalore" }]);
    const preview = await previewCategoryCityPage("city-1", "cat-1");
    expect(preview!.toGenerate).toBe(0);
    expect(preview!.toSkip).toBe(1);
  });
});

describe("generateSingleCitySeoPage", () => {
  it("creates city page when missing", async () => {
    mockExistingSlugs([]);
    const result = await generateSingleCitySeoPage("city-1");
    expect(result!.created).toBe(1);
    expect(result!.skipped).toBe(0);
    expect(upsertFromContent).toHaveBeenCalledWith(
      "city",
      "bangalore",
      expect.any(Object),
      "/india/karnataka/bangalore",
    );
  });

  it("skips existing city page", async () => {
    mockExistingSlugs([{ pageType: "city", pageSlug: "bangalore" }]);
    const result = await generateSingleCitySeoPage("city-1");
    expect(result!.created).toBe(0);
    expect(result!.skipped).toBe(1);
    expect(upsertFromContent).not.toHaveBeenCalled();
  });
});

describe("generateSingleCategoryCitySeoPage", () => {
  it("creates one category+city page", async () => {
    mockExistingSlugs([]);
    const result = await generateSingleCategoryCitySeoPage("city-1", "cat-1");
    expect(result!.created).toBe(1);
    expect(result!.categoryName).toBe("Escorts");
    expect(upsertFromContent).toHaveBeenCalledWith(
      "category_city",
      "escorts/bangalore",
      expect.any(Object),
      "/escorts/bangalore",
    );
  });
});

describe("generateCitySeoPack", () => {
  it("generates only missing pages for the selected city", async () => {
    mockExistingSlugs([
      { pageType: "city", pageSlug: "bangalore" },
      { pageType: "category_city", pageSlug: "escorts/bangalore" },
    ]);

    const result = await generateCitySeoPack("city-1");
    expect(result!.skipped).toBe(2);
    expect(result!.created).toBe(1 + categories.length + 8 - 2);
    expect(upsertFromContent).toHaveBeenCalledTimes(result!.created);
    expect(upsertFromContent).not.toHaveBeenCalledWith("city", "bangalore", expect.anything(), expect.anything());
    expect(upsertFromContent).not.toHaveBeenCalledWith(
      "category_city",
      "escorts/bangalore",
      expect.anything(),
      expect.anything(),
    );
  });
});

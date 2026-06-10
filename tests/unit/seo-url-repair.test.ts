import { beforeEach, describe, expect, it, vi } from "vitest";

const { seoPageFindMany, seoPageUpdate, cityFindMany, categoryFindMany } = vi.hoisted(() => ({
  seoPageFindMany: vi.fn(),
  seoPageUpdate: vi.fn(),
  cityFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    seoPage: { findMany: seoPageFindMany, update: seoPageUpdate },
    city: { findMany: cityFindMany },
    category: { findMany: categoryFindMany },
  },
}));

import { previewSeoUrlRepair, repairSeoUrlStructure } from "@/lib/seo-url-repair";

beforeEach(() => {
  vi.clearAllMocks();
  cityFindMany.mockResolvedValue([{ slug: "hyderabad" }, { slug: "bangalore" }]);
  categoryFindMany.mockResolvedValue([{ slug: "escorts" }]);
  seoPageUpdate.mockResolvedValue({});
});

describe("previewSeoUrlRepair", () => {
  it("finds broken single-segment longtail pages", async () => {
    seoPageFindMany.mockResolvedValue([
      {
        id: "p1",
        pageType: "longtail",
        pageSlug: "russian-escorts-hyderabad",
        canonicalUrl: "/russian-escorts-hyderabad",
      },
      {
        id: "p2",
        pageType: "longtail",
        pageSlug: "cheap-escorts/hyderabad",
        canonicalUrl: "/cheap-escorts/hyderabad",
      },
    ]);

    const preview = await previewSeoUrlRepair();
    expect(preview.brokenCount).toBe(1);
    expect(preview.repairableCount).toBe(1);
    expect(preview.entries[0]?.oldSlug).toBe("russian-escorts-hyderabad");
    expect(preview.entries[0]?.newSlug).toBe("russian-escorts/hyderabad");
  });

  it("skips when target slug already exists", async () => {
    seoPageFindMany.mockResolvedValue([
      {
        id: "p1",
        pageType: "longtail",
        pageSlug: "russian-escorts-hyderabad",
        canonicalUrl: "/russian-escorts-hyderabad",
      },
      {
        id: "p2",
        pageType: "longtail",
        pageSlug: "russian-escorts/hyderabad",
        canonicalUrl: "/russian-escorts/hyderabad",
      },
    ]);

    const preview = await previewSeoUrlRepair();
    expect(preview.repairableCount).toBe(0);
    expect(preview.entries[0]?.willRepair).toBe(false);
  });
});

describe("repairSeoUrlStructure", () => {
  it("updates pageSlug and canonicalUrl only", async () => {
    seoPageFindMany.mockResolvedValue([
      {
        id: "p1",
        pageType: "longtail",
        pageSlug: "female-escorts-hyderabad",
        canonicalUrl: "/female-escorts-hyderabad",
      },
    ]);

    const result = await repairSeoUrlStructure();
    expect(result.repaired).toBe(1);
    expect(seoPageUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        pageSlug: "female-escorts/hyderabad",
        canonicalUrl: "/female-escorts/hyderabad",
      },
    });
  });
});

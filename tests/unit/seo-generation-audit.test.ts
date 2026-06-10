import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditCreate } = vi.hoisted(() => ({
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: auditCreate,
    },
  },
}));

import { logSeoGenerationAction } from "@/lib/seo-generation-audit";

beforeEach(() => {
  vi.clearAllMocks();
  auditCreate.mockResolvedValue({ id: "audit-1" });
});

describe("logSeoGenerationAction", () => {
  it("writes seo_generate_city_pack audit entry", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_city_pack",
      country: "India",
      state: "Karnataka",
      city: "Bangalore",
      generated: 20,
      skipped: 4,
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "admin-1",
        action: "seo_generate_city_pack",
        entityType: "SeoPage",
        entityId: null,
      }),
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.country).toBe("India");
    expect(details.state).toBe("Karnataka");
    expect(details.city).toBe("Bangalore");
    expect(details.generated).toBe(20);
    expect(details.skipped).toBe(4);
    expect(details.timestamp).toBeTruthy();
  });

  it("writes seo_generate_category_city with category metadata", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_category_city",
      country: "India",
      state: "Karnataka",
      city: "Bangalore",
      category: "Escorts",
      generated: 1,
      skipped: 0,
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.action).toBeUndefined();
    expect(details.category).toBe("Escorts");
    expect(details.generated).toBe(1);
  });

  it("writes seo_generate_city for single city page", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-2",
      action: "seo_generate_city",
      city: "Pune",
      generated: 1,
      skipped: 0,
    });

    expect(auditCreate.mock.calls[0][0].data.action).toBe("seo_generate_city");
  });

  it("writes seo_generate_keywords with counts and keyword list", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_keywords",
      generated: 25,
      skipped: 3,
      failed: 1,
      keywords: ["VIP Escorts Bangalore", "Luxury Escorts Bangalore"],
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.generatedCount).toBe(25);
    expect(details.skippedCount).toBe(3);
    expect(details.failedCount).toBe(1);
    expect(details.keywords).toHaveLength(2);
  });

  it("writes seo_generate_keyword_city with cityId", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_keyword_city",
      city: "Bangalore",
      cityId: "city-1",
      generated: 5,
      skipped: 0,
      failed: 0,
      keywords: ["Independent Escorts"],
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.cityId).toBe("city-1");
    expect(details.city).toBe("Bangalore");
  });

  it("writes seo_generate_keyword_multi_city with city lists", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_keyword_multi_city",
      generated: 40,
      skipped: 10,
      failed: 0,
      keywords: ["VIP Escorts"],
      cityIds: ["city-1", "city-2"],
      cityNames: ["Bangalore", "Mumbai"],
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.adminId).toBe("admin-1");
    expect(details.cityIds).toEqual(["city-1", "city-2"]);
    expect(details.generatedCount).toBe(40);
  });

  it("writes seo_generate_city_category_longtail with category metadata", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_city_category_longtail",
      generated: 12,
      skipped: 1,
      cityIds: ["city-1"],
      cityNames: ["Bangalore"],
      categoryId: "cat-1",
      categoryName: "Escorts",
      keywords: ["VIP", "Luxury"],
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.categoryId).toBe("cat-1");
    expect(details.categoryName).toBe("Escorts");
  });

  it("writes seo_generate_city_category_keywords", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_generate_city_category_keywords",
      generated: 5,
      skipped: 0,
      failed: 0,
      categoryId: "cat-1",
      categoryName: "Escorts",
      keywords: ["Russian", "VIP"],
    });

    expect(auditCreate.mock.calls[0][0].data.action).toBe("seo_generate_city_category_keywords");
  });

  it("writes seo_repair_url_structure with processed and repaired counts", async () => {
    await logSeoGenerationAction({
      adminUserId: "admin-1",
      action: "seo_repair_url_structure",
      processed: 4,
      generated: 4,
      skipped: 0,
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.processedCount).toBe(4);
    expect(details.repairedCount).toBe(4);
    expect(details.skippedCount).toBe(0);
  });
});

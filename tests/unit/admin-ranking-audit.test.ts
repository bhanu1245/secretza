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

import { logRankingMaintenanceAction } from "@/lib/admin-ranking-audit";

beforeEach(() => {
  vi.clearAllMocks();
  auditCreate.mockResolvedValue({ id: "audit-1" });
});

describe("logRankingMaintenanceAction", () => {
  it("writes ranking_recalculate_all audit entry", async () => {
    await logRankingMaintenanceAction({
      adminUserId: "admin-1",
      action: "ranking_recalculate_all",
      processed: 523,
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "admin-1",
        action: "ranking_recalculate_all",
        entityType: "Listing",
        details: expect.stringContaining('"processed":523'),
      }),
    });
  });

  it("writes ranking_refresh_city with city metadata", async () => {
    await logRankingMaintenanceAction({
      adminUserId: "admin-1",
      action: "ranking_refresh_city",
      processed: 14,
      cityId: "city-1",
      cityName: "Bangalore",
    });

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.processed).toBe(14);
    expect(details.cityId).toBe("city-1");
    expect(details.cityName).toBe("Bangalore");
    expect(details.timestamp).toBeTruthy();
  });
});

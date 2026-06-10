import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, count, listingUpdate, transaction } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  listingUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    listing: {
      findMany,
      count,
      update: listingUpdate,
    },
    $transaction: transaction,
  },
}));

import {
  recalculateAllListingRankings,
  refreshPremiumListingRankings,
  refreshCityListingRankings,
  countApprovedListingsInCity,
  resolveAdminRankingAccess,
  listingToRankInput,
} from "@/lib/admin-ranking-tools";

const baseListing = {
  id: "listing-1",
  isFeatured: false,
  isBoosted: false,
  isPremium: true,
  featuredUntil: null,
  boostUntil: null,
  lastBumpedAt: new Date("2026-06-01T10:00:00.000Z"),
  viewCount: 10,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  status: "approved",
};

beforeEach(() => {
  vi.clearAllMocks();
  transaction.mockImplementation(async (ops: unknown[]) => {
    if (Array.isArray(ops)) {
      for (const op of ops) await op;
    }
    return ops;
  });
  listingUpdate.mockResolvedValue({});
});

describe("resolveAdminRankingAccess", () => {
  it("allows admin", () => {
    expect(resolveAdminRankingAccess("admin")).toBeNull();
    expect(resolveAdminRankingAccess("ADMIN")).toBeNull();
  });

  it("denies moderator", () => {
    expect(resolveAdminRankingAccess("moderator")).toBe(403);
  });

  it("denies unauthenticated", () => {
    expect(resolveAdminRankingAccess(undefined)).toBe(401);
  });
});

describe("recalculateAllListingRankings", () => {
  it("recomputes priorityScore without changing lastBumpedAt", async () => {
    findMany.mockResolvedValue([baseListing, { ...baseListing, id: "listing-2", isPremium: false }]);

    const processed = await recalculateAllListingRankings();

    expect(processed).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    const updates = transaction.mock.calls[0][0];
    expect(updates).toHaveLength(2);
    expect(listingUpdate).toHaveBeenCalled();
    const firstCall = listingUpdate.mock.calls[0][0];
    expect(firstCall.data.priorityScore).toBeGreaterThan(0);
    expect(firstCall.data.lastBumpedAt).toBeUndefined();
    expect(firstCall.data.status).toBeUndefined();
    expect(firstCall.data.isPremium).toBeUndefined();
  });

  it("preserves listing status in database (no status field in update)", async () => {
    findMany.mockResolvedValue([{ ...baseListing, status: "pending" }]);
    await recalculateAllListingRankings();
    expect(listingUpdate.mock.calls[0][0].data.status).toBeUndefined();
  });
});

describe("refreshPremiumListingRankings", () => {
  it("updates only premium approved listings with fresh bump and score", async () => {
    const bumpedAt = new Date("2026-06-10T12:00:00.000Z");
    findMany.mockResolvedValue([baseListing]);

    const processed = await refreshPremiumListingRankings(bumpedAt);

    expect(processed).toBe(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { isPremium: true, status: "approved" },
      select: expect.any(Object),
    });
    const updateArg = listingUpdate.mock.calls[0][0];
    expect(updateArg.data.lastBumpedAt).toEqual(bumpedAt);
    expect(updateArg.data.priorityScore).toBeGreaterThan(2000);
    expect(updateArg.data.isPremium).toBeUndefined();
  });
});

describe("refreshCityListingRankings", () => {
  it("updates only listings in the selected city", async () => {
    const cityId = "city-bangalore";
    const bumpedAt = new Date("2026-06-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      { ...baseListing, id: "blr-1" },
      { ...baseListing, id: "blr-2" },
    ]);

    const processed = await refreshCityListingRankings(cityId, bumpedAt);

    expect(processed).toBe(2);
    expect(findMany).toHaveBeenCalledWith({
      where: { cityId, status: "approved" },
      select: expect.any(Object),
    });
    expect(listingUpdate).toHaveBeenCalledTimes(2);
    expect(listingUpdate.mock.calls[0][0].data.lastBumpedAt).toEqual(bumpedAt);
  });

  it("returns accurate processed count for city preview helper", async () => {
    count.mockResolvedValue(14);
    const total = await countApprovedListingsInCity("city-bangalore");
    expect(total).toBe(14);
    expect(count).toHaveBeenCalledWith({
      where: { cityId: "city-bangalore", status: "approved" },
    });
  });
});

describe("listingToRankInput", () => {
  it("maps listing rows for score computation", () => {
    const input = listingToRankInput(baseListing);
    expect(input.isPremium).toBe(true);
    expect(input.lastBumpedAt).toEqual(baseListing.lastBumpedAt);
    expect(input.viewCount).toBe(10);
  });
});

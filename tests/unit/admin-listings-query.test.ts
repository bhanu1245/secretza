import { describe, expect, it } from "vitest";
import { buildAdminListingsUrl } from "@/lib/admin-listings-query";

describe("buildAdminListingsUrl", () => {
  it("builds paginated list URL", () => {
    expect(buildAdminListingsUrl({ page: 2, limit: 50, status: "pending" })).toBe(
      "/api/admin/listings?page=2&limit=50&status=pending",
    );
  });

  it("includes search when provided", () => {
    expect(buildAdminListingsUrl({ search: "mumbai@test.com" })).toBe(
      "/api/admin/listings?search=mumbai%40test.com",
    );
  });

  it("returns base path when no params", () => {
    expect(buildAdminListingsUrl()).toBe("/api/admin/listings");
  });
});

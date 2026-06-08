import { describe, expect, it } from "vitest";
import { buildAdminPaymentsUrl } from "@/lib/admin-payments-query";

describe("buildAdminPaymentsUrl", () => {
  it("builds paginated payments URL", () => {
    expect(buildAdminPaymentsUrl({ page: 2, limit: 50, status: "pending" })).toBe(
      "/api/admin/payments/manual?page=2&limit=50&status=pending",
    );
  });

  it("includes search when provided", () => {
    expect(buildAdminPaymentsUrl({ search: "UTR12345" })).toBe(
      "/api/admin/payments/manual?search=UTR12345",
    );
  });

  it("returns base path when no params", () => {
    expect(buildAdminPaymentsUrl()).toBe("/api/admin/payments/manual");
  });
});

import { describe, expect, it } from "vitest";
import { buildManualPaymentSearchOr } from "@/lib/admin-payments-search";

describe("buildManualPaymentSearchOr", () => {
  it("includes UTR, user, payment type, and listing matches", () => {
    const conditions = buildManualPaymentSearchOr("premium", ["listing-1"]);
    expect(conditions).toEqual(
      expect.arrayContaining([
        { utrNumber: { contains: "premium" } },
        { user: { email: { contains: "premium" } } },
        { user: { name: { contains: "premium" } } },
        { paymentType: "premium" },
        { listingId: { in: ["listing-1"] } },
      ]),
    );
  });

  it("maps featured alias to feature payment type", () => {
    const conditions = buildManualPaymentSearchOr("featured", []);
    expect(conditions).toContainEqual({ paymentType: "feature" });
  });
});

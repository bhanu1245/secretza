import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coupon } from "@prisma/client";

const {
  findFirst,
  couponRedemptionCount,
  manualPaymentSubmissionCount,
  couponFindUnique,
  couponRedemptionFindUnique,
  couponUpdate,
  couponRedemptionCreate,
} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  couponRedemptionCount: vi.fn(),
  manualPaymentSubmissionCount: vi.fn(),
  couponFindUnique: vi.fn(),
  couponRedemptionFindUnique: vi.fn(),
  couponUpdate: vi.fn(),
  couponRedemptionCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    coupon: {
      findFirst,
      findUnique: couponFindUnique,
      update: couponUpdate,
    },
    couponRedemption: {
      count: couponRedemptionCount,
      findUnique: couponRedemptionFindUnique,
      create: couponRedemptionCreate,
    },
    manualPaymentSubmission: {
      count: manualPaymentSubmissionCount,
    },
  },
}));

import {
  computeDiscount,
  normalizePaymentTypeForCoupon,
  couponAppliesToPurchase,
  validateCouponForCheckout,
  redeemCouponOnApproval,
} from "@/lib/coupons";

function baseCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "coupon-1",
    code: "TESTCODE",
    description: null,
    discountType: "percentage",
    discountValue: 20,
    maxUses: 0,
    maxUsesPerUser: 0,
    usedCount: 0,
    appliesTo: "all",
    isActive: true,
    expiresAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function mockHappyPath(coupon: Coupon) {
  findFirst.mockResolvedValue(coupon);
  couponRedemptionCount.mockResolvedValue(0);
  manualPaymentSubmissionCount.mockResolvedValue(0);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizePaymentTypeForCoupon", () => {
  it("maps feature to featured", () => {
    expect(normalizePaymentTypeForCoupon("feature")).toBe("featured");
  });

  it("passes through other payment types", () => {
    expect(normalizePaymentTypeForCoupon("premium")).toBe("premium");
    expect(normalizePaymentTypeForCoupon("boost")).toBe("boost");
    expect(normalizePaymentTypeForCoupon("renewal")).toBe("renewal");
  });
});

describe("couponAppliesToPurchase", () => {
  it("allows all coupons on any purchase type", () => {
    expect(couponAppliesToPurchase("all", "boost")).toBe(true);
    expect(couponAppliesToPurchase("all", "feature")).toBe(true);
    expect(couponAppliesToPurchase("all", "premium")).toBe(true);
    expect(couponAppliesToPurchase("all", "renewal")).toBe(true);
  });

  it("matches scoped coupons to the correct purchase type", () => {
    expect(couponAppliesToPurchase("premium", "premium")).toBe(true);
    expect(couponAppliesToPurchase("featured", "feature")).toBe(true);
    expect(couponAppliesToPurchase("boost", "boost")).toBe(true);
    expect(couponAppliesToPurchase("renewal", "renewal")).toBe(true);
  });

  it("rejects mismatched purchase types", () => {
    expect(couponAppliesToPurchase("premium", "boost")).toBe(false);
    expect(couponAppliesToPurchase("featured", "premium")).toBe(false);
  });
});

describe("validateCouponForCheckout", () => {
  it("accepts premium coupon on premium purchase", async () => {
    mockHappyPath(baseCoupon({ appliesTo: "premium", discountValue: 10 }));
    const result = await validateCouponForCheckout({
      code: "PREMIUM10",
      userId: "user-1",
      originalAmount: 999,
      paymentType: "premium",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.finalAmount).toBe(899.1);
      expect(result.coupon.appliesTo).toBe("premium");
    }
  });

  it("rejects premium coupon on boost purchase", async () => {
    mockHappyPath(baseCoupon({ appliesTo: "premium" }));
    const result = await validateCouponForCheckout({
      code: "PREMIUM10",
      userId: "user-1",
      originalAmount: 999,
      paymentType: "boost",
    });
    expect(result).toEqual({
      valid: false,
      error: "This coupon does not apply to this purchase type.",
      code: "WRONG_PURCHASE_TYPE",
    });
  });

  it("accepts featured coupon on feature purchase", async () => {
    mockHappyPath(baseCoupon({ appliesTo: "featured" }));
    const result = await validateCouponForCheckout({
      code: "FEATURE20",
      userId: "user-1",
      originalAmount: 499,
      paymentType: "feature",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts boost coupon on boost purchase", async () => {
    mockHappyPath(baseCoupon({ appliesTo: "boost" }));
    const result = await validateCouponForCheckout({
      code: "BOOST20",
      userId: "user-1",
      originalAmount: 199,
      paymentType: "boost",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts renewal coupon on renewal purchase", async () => {
    mockHappyPath(baseCoupon({ appliesTo: "renewal" }));
    const result = await validateCouponForCheckout({
      code: "RENEW10",
      userId: "user-1",
      originalAmount: 99,
      paymentType: "renewal",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts all coupon on every purchase type", async () => {
    for (const paymentType of ["premium", "feature", "boost", "renewal"] as const) {
      mockHappyPath(baseCoupon({ appliesTo: "all" }));
      const result = await validateCouponForCheckout({
        code: "ALL25",
        userId: "user-1",
        originalAmount: 200,
        paymentType,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects inactive coupons", async () => {
    mockHappyPath(baseCoupon({ isActive: false }));
    const result = await validateCouponForCheckout({
      code: "INACTIVE",
      userId: "user-1",
      originalAmount: 999,
      paymentType: "premium",
    });
    expect(result).toMatchObject({ valid: false, code: "INACTIVE" });
  });

  it("rejects expired coupons", async () => {
    mockHappyPath(
      baseCoupon({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
    );
    const result = await validateCouponForCheckout({
      code: "EXPIRED",
      userId: "user-1",
      originalAmount: 999,
      paymentType: "premium",
    });
    expect(result).toMatchObject({ valid: false, code: "EXPIRED" });
  });

  it("rejects coupons that exceeded global usage limit", async () => {
    mockHappyPath(baseCoupon({ maxUses: 5, usedCount: 5 }));
    const result = await validateCouponForCheckout({
      code: "LIMITED",
      userId: "user-1",
      originalAmount: 999,
      paymentType: "premium",
    });
    expect(result).toMatchObject({ valid: false, code: "GLOBAL_LIMIT_REACHED" });
  });
});

describe("100% coupon behavior", () => {
  it("blocks checkout when a 100% discount would zero out the final amount", async () => {
    mockHappyPath(baseCoupon({ discountValue: 100, appliesTo: "premium" }));
    const result = await validateCouponForCheckout({
      code: "FREEPRO100",
      userId: "user-1",
      originalAmount: 999,
      paymentType: "premium",
    });
    expect(result).toEqual({
      valid: false,
      error: "Coupon discount exceeds the order amount",
      code: "ZERO_FINAL_AMOUNT",
    });
    expect(computeDiscount(999, "percentage", 100)).toEqual({
      discountAmount: 999,
      finalAmount: 0,
    });
  });
});

describe("redeemCouponOnApproval", () => {
  it("skips redemption when payment type does not match coupon scope", async () => {
    couponFindUnique.mockResolvedValue(baseCoupon({ appliesTo: "premium" }));
    couponRedemptionFindUnique.mockResolvedValue(null);

    const result = await redeemCouponOnApproval({
      couponId: "coupon-1",
      userId: "user-1",
      submissionId: "sub-1",
      paymentType: "boost",
    });

    expect(result).toBeNull();
    expect(couponUpdate).not.toHaveBeenCalled();
    expect(couponRedemptionCreate).not.toHaveBeenCalled();
  });

  it("redeems when payment type matches coupon scope", async () => {
    couponFindUnique.mockResolvedValue(baseCoupon({ appliesTo: "featured" }));
    couponRedemptionFindUnique.mockResolvedValue(null);
    couponUpdate.mockResolvedValue({});
    couponRedemptionCreate.mockResolvedValue({ id: "redemption-1" });
    couponRedemptionCount.mockResolvedValue(0);

    const result = await redeemCouponOnApproval({
      couponId: "coupon-1",
      userId: "user-1",
      submissionId: "sub-1",
      paymentType: "feature",
    });

    expect(result).toEqual({ id: "redemption-1" });
    expect(couponUpdate).toHaveBeenCalled();
    expect(couponRedemptionCreate).toHaveBeenCalled();
  });
});

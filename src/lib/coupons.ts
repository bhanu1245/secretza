import { db } from "@/lib/db";
import type { Coupon, Prisma } from "@prisma/client";
import { couponAppliesToPurchase, isValidCouponAppliesTo } from "@/lib/coupon-scope";

export type DiscountType = "percentage" | "fixed";

export {
  COUPON_APPLIES_TO_VALUES,
  COUPON_APPLIES_TO_LABELS,
  couponAppliesToPurchase,
  isValidCouponAppliesTo,
  normalizePaymentTypeForCoupon,
  type CouponAppliesTo,
} from "@/lib/coupon-scope";

export interface CouponDiscountResult {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  coupon: Pick<Coupon, "id" | "code" | "discountType" | "discountValue" | "appliesTo">;
}

export interface CouponValidationError {
  valid: false;
  error: string;
  code: string;
}

export interface CouponValidationSuccess extends CouponDiscountResult {
  valid: true;
}

export type CouponValidationResult = CouponValidationSuccess | CouponValidationError;

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeDiscount(
  originalAmount: number,
  discountType: string,
  discountValue: number,
): { discountAmount: number; finalAmount: number } {
  if (originalAmount <= 0) {
    return { discountAmount: 0, finalAmount: 0 };
  }

  let discountAmount = 0;
  if (discountType === "percentage") {
    discountAmount = roundMoney(originalAmount * (discountValue / 100));
  } else if (discountType === "fixed") {
    discountAmount = roundMoney(Math.min(discountValue, originalAmount));
  } else {
    throw new Error(`Invalid discount type: ${discountType}`);
  }

  const finalAmount = roundMoney(Math.max(0, originalAmount - discountAmount));
  return { discountAmount, finalAmount };
}

async function countPendingUses(couponId: string, userId?: string): Promise<number> {
  const where: Prisma.ManualPaymentSubmissionWhereInput = {
    couponId,
    status: { in: ["pending", "proof_requested"] },
  };
  if (userId) where.userId = userId;
  return db.manualPaymentSubmission.count({ where });
}

export async function getCouponByCode(code: string) {
  const normalized = normalizeCouponCode(code);
  return db.coupon.findFirst({
    where: { code: normalized },
  });
}

export async function validateCouponForCheckout(params: {
  code: string;
  userId: string;
  originalAmount: number;
  paymentType?: string;
}): Promise<CouponValidationResult> {
  const { code, userId, originalAmount, paymentType } = params;
  const normalized = normalizeCouponCode(code);

  if (!normalized) {
    return { valid: false, error: "Coupon code is required", code: "MISSING_CODE" };
  }

  if (originalAmount <= 0) {
    return { valid: false, error: "Invalid order amount", code: "INVALID_AMOUNT" };
  }

  const coupon = await getCouponByCode(normalized);
  if (!coupon) {
    return { valid: false, error: "Invalid coupon code", code: "NOT_FOUND" };
  }

  if (!coupon.isActive) {
    return { valid: false, error: "This coupon is no longer active", code: "INACTIVE" };
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { valid: false, error: "This coupon has expired", code: "EXPIRED" };
  }

  if (!couponAppliesToPurchase(coupon.appliesTo, paymentType)) {
    return {
      valid: false,
      error: "This coupon does not apply to this purchase type.",
      code: "WRONG_PURCHASE_TYPE",
    };
  }

  if (coupon.discountType === "percentage") {
    if (coupon.discountValue <= 0 || coupon.discountValue > 100) {
      return { valid: false, error: "Coupon configuration is invalid", code: "INVALID_CONFIG" };
    }
  } else if (coupon.discountType === "fixed") {
    if (coupon.discountValue <= 0) {
      return { valid: false, error: "Coupon configuration is invalid", code: "INVALID_CONFIG" };
    }
  } else {
    return { valid: false, error: "Coupon configuration is invalid", code: "INVALID_CONFIG" };
  }

  const redemptionCount = await db.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  });

  if (coupon.maxUsesPerUser > 0 && redemptionCount >= coupon.maxUsesPerUser) {
    return {
      valid: false,
      error: "You have already used this coupon",
      code: "USER_LIMIT_REACHED",
    };
  }

  const pendingUserUses = await countPendingUses(coupon.id, userId);
  if (
    coupon.maxUsesPerUser > 0 &&
    redemptionCount + pendingUserUses >= coupon.maxUsesPerUser
  ) {
    return {
      valid: false,
      error: "You already have a pending payment using this coupon",
      code: "USER_PENDING_LIMIT",
    };
  }

  if (coupon.maxUses > 0) {
    const pendingGlobal = await countPendingUses(coupon.id);
    if (coupon.usedCount + pendingGlobal >= coupon.maxUses) {
      return {
        valid: false,
        error: "This coupon has reached its usage limit",
        code: "GLOBAL_LIMIT_REACHED",
      };
    }
  }

  const { discountAmount, finalAmount } = computeDiscount(
    originalAmount,
    coupon.discountType,
    coupon.discountValue,
  );

  if (finalAmount <= 0) {
    return {
      valid: false,
      error: "Coupon discount exceeds the order amount",
      code: "ZERO_FINAL_AMOUNT",
    };
  }

  return {
    valid: true,
    originalAmount: roundMoney(originalAmount),
    discountAmount,
    finalAmount,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      appliesTo: coupon.appliesTo,
    },
  };
}

export async function redeemCouponOnApproval(params: {
  couponId: string;
  userId: string;
  submissionId: string;
  paymentType?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? db;

  const coupon = await client.coupon.findUnique({ where: { id: params.couponId } });

  // The user paid the discounted amount at submission time. The approval must
  // not be blocked by coupon state changes that occurred after submission.
  // All post-submission coupon state issues are logged as warnings and skipped
  // gracefully — the feature activation and Payment record still proceed.

  if (!coupon) {
    // Coupon was deleted after submission — skip redemption, do not block approval.
    console.warn("[redeemCouponOnApproval] coupon deleted after submission — skipping redemption", {
      couponId: params.couponId,
      submissionId: params.submissionId,
    });
    return null;
  }

  // Idempotency guard: return existing redemption if already processed.
  const existingRedemption = await client.couponRedemption.findUnique({
    where: { manualPaymentSubmissionId: params.submissionId },
  });
  if (existingRedemption) {
    return existingRedemption;
  }

  if (!couponAppliesToPurchase(coupon.appliesTo, params.paymentType)) {
    console.warn("[redeemCouponOnApproval] coupon does not apply to submission payment type — skipping redemption", {
      couponId: params.couponId,
      appliesTo: coupon.appliesTo,
      paymentType: params.paymentType,
      submissionId: params.submissionId,
    });
    return null;
  }

  if (!coupon.isActive) {
    // Coupon deactivated after submission — skip redemption, do not block approval.
    console.warn("[redeemCouponOnApproval] coupon deactivated after submission — skipping redemption", {
      couponId: params.couponId,
      submissionId: params.submissionId,
    });
    return null;
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    // Coupon expired after submission — skip redemption, do not block approval.
    console.warn("[redeemCouponOnApproval] coupon expired after submission — skipping redemption", {
      couponId: params.couponId,
      submissionId: params.submissionId,
      expiresAt: coupon.expiresAt.toISOString(),
    });
    return null;
  }

  const userRedemptions = await client.couponRedemption.count({
    where: { couponId: params.couponId, userId: params.userId },
  });
  if (coupon.maxUsesPerUser > 0 && userRedemptions >= coupon.maxUsesPerUser) {
    // Limit reached after submission — skip to avoid double-counting, do not block.
    console.warn("[redeemCouponOnApproval] user coupon limit already reached — skipping redemption", {
      couponId: params.couponId,
      userId: params.userId,
      submissionId: params.submissionId,
    });
    return null;
  }

  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    // Global limit reached after submission — skip to avoid over-redemption.
    console.warn("[redeemCouponOnApproval] global coupon limit already reached — skipping redemption", {
      couponId: params.couponId,
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      submissionId: params.submissionId,
    });
    return null;
  }

  await client.coupon.update({
    where: { id: params.couponId },
    data: { usedCount: { increment: 1 } },
  });

  return client.couponRedemption.create({
    data: {
      couponId: params.couponId,
      userId: params.userId,
      manualPaymentSubmissionId: params.submissionId,
    },
  });
}

export function serializeCoupon(coupon: Coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxUses: coupon.maxUses,
    maxUsesPerUser: coupon.maxUsesPerUser,
    usedCount: coupon.usedCount,
    appliesTo: coupon.appliesTo,
    isActive: coupon.isActive,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export function parseCouponInput(body: Record<string, unknown>) {
  const code = normalizeCouponCode(String(body.code || ""));
  const discountType = String(body.discountType || "percentage") as DiscountType;
  const discountValue = Number(body.discountValue);
  const maxUses = Math.max(0, parseInt(String(body.maxUses ?? 0), 10) || 0);
  const maxUsesPerUser = Math.max(0, parseInt(String(body.maxUsesPerUser ?? 0), 10) || 0);
  const isActive = body.isActive !== false;
  const description = body.description ? String(body.description).trim() : null;
  const expiresAtRaw = body.expiresAt ? String(body.expiresAt) : null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const appliesToRaw = String(body.appliesTo || "all").toLowerCase();
  const appliesTo = isValidCouponAppliesTo(appliesToRaw) ? appliesToRaw : "all";

  return {
    code,
    discountType,
    discountValue,
    maxUses,
    maxUsesPerUser,
    isActive,
    description,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    appliesTo,
  };
}

export function validateCouponInput(input: ReturnType<typeof parseCouponInput>): string | null {
  if (!input.code || input.code.length < 3 || input.code.length > 32) {
    return "Code must be 3–32 characters";
  }
  if (!/^[A-Z0-9_-]+$/.test(input.code)) {
    return "Code may only contain letters, numbers, hyphens, and underscores";
  }
  if (!["percentage", "fixed"].includes(input.discountType)) {
    return "discountType must be percentage or fixed";
  }
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    return "discountValue must be a positive number";
  }
  if (input.discountType === "percentage" && input.discountValue > 100) {
    return "Percentage discount cannot exceed 100";
  }
  if (!isValidCouponAppliesTo(input.appliesTo)) {
    return "appliesTo must be premium, featured, boost, renewal, or all";
  }
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    return "Expiry date must be in the future";
  }
  return null;
}

export function validateCouponInputForUpdate(
  input: ReturnType<typeof parseCouponInput>,
): string | null {
  if (!input.code || input.code.length < 3 || input.code.length > 32) {
    return "Code must be 3–32 characters";
  }
  if (!/^[A-Z0-9_-]+$/.test(input.code)) {
    return "Code may only contain letters, numbers, hyphens, and underscores";
  }
  if (!["percentage", "fixed"].includes(input.discountType)) {
    return "discountType must be percentage or fixed";
  }
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    return "discountValue must be a positive number";
  }
  if (input.discountType === "percentage" && input.discountValue > 100) {
    return "Percentage discount cannot exceed 100";
  }
  if (!isValidCouponAppliesTo(input.appliesTo)) {
    return "appliesTo must be premium, featured, boost, renewal, or all";
  }
  return null;
}

export const COUPON_APPLIES_TO_VALUES = [
  "premium",
  "featured",
  "boost",
  "renewal",
  "all",
] as const;

export type CouponAppliesTo = (typeof COUPON_APPLIES_TO_VALUES)[number];

export const COUPON_APPLIES_TO_LABELS: Record<CouponAppliesTo, string> = {
  all: "All Purchases",
  premium: "Premium Plans",
  featured: "Featured Listings",
  boost: "Listing Boosts",
  renewal: "Renewals",
};

/** Maps checkout payment types to coupon appliesTo values. */
export function normalizePaymentTypeForCoupon(paymentType: string): string {
  if (paymentType === "feature") return "featured";
  return paymentType;
}

export function couponAppliesToPurchase(
  appliesTo: string,
  paymentType: string | undefined,
): boolean {
  if (appliesTo === "all") return true;
  if (!paymentType) return false;
  return appliesTo === normalizePaymentTypeForCoupon(paymentType);
}

export function isValidCouponAppliesTo(value: string): value is CouponAppliesTo {
  return (COUPON_APPLIES_TO_VALUES as readonly string[]).includes(value);
}

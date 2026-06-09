-- Add coupon purchase-type scoping. Existing coupons default to "all" (unchanged behavior).
ALTER TABLE "Coupon" ADD COLUMN "appliesTo" TEXT NOT NULL DEFAULT 'all';

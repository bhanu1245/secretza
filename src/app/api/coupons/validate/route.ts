import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";
import { validateCouponForCheckout } from "@/lib/coupons";
import { requireVerifiedEmail } from "@/lib/email-verification-guard";

/**
 * POST /api/coupons/validate
 * Validate a coupon for checkout (authenticated users only).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const verificationError = await requireVerifiedEmail(
      session.user.id,
      "Email verification required before purchasing premium listings",
    );
    if (verificationError) return verificationError;

    const rl = await rateLimit(`couponValidate:${session.user.id}`, RATE_LIMITS.login);
    if (!rl.success) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = await request.json();
    const code = String(body.code || "");
    const originalAmount = Number(body.originalAmount);

    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return NextResponse.json({ error: "Invalid original amount", field: "originalAmount" }, { status: 400 });
    }

    const result = await validateCouponForCheckout({
      code,
      userId: session.user.id,
      originalAmount,
    });

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error, code: result.code },
        { status: 400 },
      );
    }

    return NextResponse.json({
      valid: true,
      originalAmount: result.originalAmount,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      coupon: result.coupon,
    });
  } catch (error) {
    logError(error, { component: "route:api/coupons/validate" });
    return NextResponse.json({ error: "Failed to validate coupon" }, { status: 500 });
  }
}

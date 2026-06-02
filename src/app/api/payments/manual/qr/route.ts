import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QRCode from "qrcode";
import { getPaymentSettings, getValidAmounts } from "@/lib/payment-settings";
import { validateCouponForCheckout } from "@/lib/coupons";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const amountRaw = searchParams.get("amount");
  if (!amountRaw || isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
    return NextResponse.json(
      { error: "A valid positive amount query parameter is required" },
      { status: 400 },
    );
  }

  const amount = Number(amountRaw);
  const paymentType = searchParams.get("paymentType") as "boost" | "feature" | "premium" | null;
  const originalAmountRaw = searchParams.get("originalAmount");
  const couponCode = searchParams.get("couponCode");

  if (paymentType) {
    const validAmounts = await getValidAmounts(paymentType);
    const originalAmount = originalAmountRaw ? Number(originalAmountRaw) : amount;

    if (!validAmounts.includes(originalAmount)) {
      return NextResponse.json(
        { error: `Invalid original amount for ${paymentType}` },
        { status: 400 },
      );
    }

    if (couponCode) {
      const result = await validateCouponForCheckout({
        code: couponCode,
        userId: session.user.id,
        originalAmount,
      });
      if (!result.valid || Math.abs(result.finalAmount - amount) > 0.01) {
        return NextResponse.json({ error: "Invalid coupon or discounted amount" }, { status: 400 });
      }
    } else if (Math.abs(amount - originalAmount) > 0.01) {
      return NextResponse.json({ error: "Amount must match selected plan" }, { status: 400 });
    }
  } else {
    const settings = await getPaymentSettings();
    const allValidAmounts = [
      ...settings.boostTiers.map((t) => t.amount),
      ...settings.featuredTiers.map((t) => t.amount),
      ...settings.premiumTiers.map((t) => t.amount),
    ];
    const uniqueAmounts = [...new Set(allValidAmounts)];
    if (!uniqueAmounts.includes(amount)) {
      return NextResponse.json(
        { error: `Invalid amount. Must be one of: ₹${uniqueAmounts.join(", ₹")}` },
        { status: 400 },
      );
    }
  }

  const settings = await getPaymentSettings();
  const note = searchParams.get("note") || "SecretZa Payment";
  const sanitizedNote = note.replace(/[<>"'&]/g, "").slice(0, 100);

  const upiDeepLink = [
    "upi://pay",
    `pa=${settings.upiId}`,
    "pn=SecretZa",
    `am=${amount}`,
    "cu=INR",
    `tn=${encodeURIComponent(sanitizedNote)}`,
  ].join("&");

  try {
    const qrDataUrl = await QRCode.toDataURL(upiDeepLink, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({
      qrDataUrl,
      upiId: settings.upiId,
      whatsappNumber: settings.whatsappNumber,
      amount,
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}

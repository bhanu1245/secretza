import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/payment-settings";

// ==========================================
// GET /api/payment-settings
// Public endpoint — returns only what the user needs
// ==========================================
export async function GET() {
  const settings = await getPaymentSettings();

  return NextResponse.json({
    upiId: settings.upiId,
    whatsappNumber: settings.whatsappNumber,
    boostPrice: settings.boostPrice,
    featuredPrice: settings.featuredPrice,
    premiumPrice: settings.premiumPrice,
    qrImageUrl: settings.qrImageUrl,
    instructions: settings.instructions,
    boostTiers: settings.boostTiers,
    featuredTiers: settings.featuredTiers,
    premiumTiers: settings.premiumTiers,
  });
}

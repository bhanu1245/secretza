import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QRCode from "qrcode";
import { getPaymentSettings } from "@/lib/payment-settings";

export async function GET(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const amountRaw = searchParams.get("amount");
  if (!amountRaw || isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
    return NextResponse.json(
      { error: "A valid positive amount query parameter is required" },
      { status: 400 }
    );
  }

  const amount = Number(amountRaw);

  // Load settings dynamically from PaymentSettings
  const settings = await getPaymentSettings();

  // Build valid amounts from all tiers
  const allValidAmounts = [
    ...settings.boostTiers.map((t) => t.amount),
    ...settings.featuredTiers.map((t) => t.amount),
    ...settings.premiumTiers.map((t) => t.amount),
  ];
  const uniqueAmounts = [...new Set(allValidAmounts)];

  // Validate against dynamic amounts
  if (!uniqueAmounts.includes(amount)) {
    return NextResponse.json(
      { error: `Invalid amount. Must be one of: ₹${uniqueAmounts.join(", ₹")}` },
      { status: 400 }
    );
  }

  const note = searchParams.get("note") || "Secretza Payment";

  // Sanitize note to prevent injection in UPI deep link
  const sanitizedNote = note.replace(/[<>"'&]/g, "").slice(0, 100);

  const upiDeepLink = [
    "upi://pay",
    `pa=${settings.upiId}`,
    "pn=Secretza",
    `am=${amount}`,
    "cu=INR",
    `tn=${encodeURIComponent(sanitizedNote)}`,
  ].join("&");

  try {
    const qrDataUrl = await QRCode.toDataURL(upiDeepLink, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({
      qrDataUrl,
      upiId: settings.upiId,
      whatsappNumber: settings.whatsappNumber,
      amount,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}

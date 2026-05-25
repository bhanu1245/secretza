import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const amountRaw = searchParams.get("amount");
  if (!amountRaw || isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
    return NextResponse.json(
      { error: "A valid positive amount query parameter is required" },
      { status: 400 }
    );
  }

  const amount = Number(amountRaw);
  const note = searchParams.get("note") || "Secretza Payment";

  const upiDeepLink = [
    "upi://pay",
    `pa=secretza@ybl`,
    `pn=Secretza`,
    `am=${amount}`,
    "cu=INR",
    `tn=${encodeURIComponent(note)}`,
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
      upiId: "secretza@ybl",
      amount,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}

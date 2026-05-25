import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPaymentSettings,
  validateUpiId,
  validateWhatsappNumber,
  validatePrice,
  validateTier,
  validateInstructions,
  DEFAULT_PAYMENT_SETTINGS,
} from "@/lib/payment-settings";

// ==========================================
// GET /api/admin/payment-settings
// ==========================================
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getPaymentSettings();
  return NextResponse.json({ settings });
}

// ==========================================
// PATCH /api/admin/payment-settings
// ==========================================
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const {
      upiId,
      whatsappNumber,
      boostPrice,
      featuredPrice,
      premiumPrice,
      qrImageUrl,
      instructions,
      boostTiers,
      featuredTiers,
      premiumTiers,
    } = body;

    // --- Validate UPI ID ---
    if (upiId !== undefined) {
      const err = validateUpiId(upiId);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // --- Validate WhatsApp ---
    if (whatsappNumber !== undefined) {
      const err = validateWhatsappNumber(whatsappNumber);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // --- Validate Prices ---
    if (boostPrice !== undefined) {
      const err = validatePrice(boostPrice, "Boost price");
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (featuredPrice !== undefined) {
      const err = validatePrice(featuredPrice, "Featured price");
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (premiumPrice !== undefined) {
      const err = validatePrice(premiumPrice, "Premium price");
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // --- Validate QR Image URL ---
    if (qrImageUrl !== undefined) {
      if (qrImageUrl !== null && typeof qrImageUrl !== "string") {
        return NextResponse.json({ error: "QR image URL must be a string or null" }, { status: 400 });
      }
    }

    // --- Validate Instructions ---
    if (instructions !== undefined) {
      const err = validateInstructions(instructions);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // --- Validate Tiers ---
    if (boostTiers !== undefined) {
      if (!Array.isArray(boostTiers) || boostTiers.length === 0) {
        return NextResponse.json({ error: "Boost tiers must be a non-empty array" }, { status: 400 });
      }
      for (let i = 0; i < boostTiers.length; i++) {
        const err = validateTier(boostTiers[i], i);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }
    if (featuredTiers !== undefined) {
      if (!Array.isArray(featuredTiers) || featuredTiers.length === 0) {
        return NextResponse.json({ error: "Featured tiers must be a non-empty array" }, { status: 400 });
      }
      for (let i = 0; i < featuredTiers.length; i++) {
        const err = validateTier(featuredTiers[i], i);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }
    if (premiumTiers !== undefined) {
      if (!Array.isArray(premiumTiers) || premiumTiers.length === 0) {
        return NextResponse.json({ error: "Premium tiers must be a non-empty array" }, { status: 400 });
      }
      for (let i = 0; i < premiumTiers.length; i++) {
        const err = validateTier(premiumTiers[i], i);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    // --- Build update data ---
    const existing = await getPaymentSettings();
    const updateData: Record<string, unknown> = {};

    if (upiId !== undefined) updateData.upiId = upiId.trim();
    if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber.trim();
    if (boostPrice !== undefined) updateData.boostPrice = Number(boostPrice);
    if (featuredPrice !== undefined) updateData.featuredPrice = Number(featuredPrice);
    if (premiumPrice !== undefined) updateData.premiumPrice = Number(premiumPrice);
    if (qrImageUrl !== undefined) updateData.qrImageUrl = qrImageUrl;
    if (instructions !== undefined) {
      updateData.instructions = typeof instructions === "string" ? instructions : JSON.stringify(instructions);
    }
    if (boostTiers !== undefined) updateData.boostTiers = JSON.stringify(boostTiers);
    if (featuredTiers !== undefined) updateData.featuredTiers = JSON.stringify(featuredTiers);
    if (premiumTiers !== undefined) updateData.premiumTiers = JSON.stringify(premiumTiers);

    const updated = await db.paymentSettings.update({
      where: { id: existing.id },
      data: updateData,
    });

    // Re-parse and return
    const settings = await getPaymentSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update payment settings" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";

// Whitelist of valid feature durations to prevent pricing exploits
const VALID_FEATURE_DURATIONS = [1, 7, 14, 30]; // days
const FEATURE_PRICING: Record<number, number> = {
  1: 4.99,
  7: 14.99,
  14: 24.99,
  30: 39.99,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!session.user.isVerified) {
      return NextResponse.json({ error: "Email verification required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const durationDays = body.durationDays;

    // Validate duration against whitelist to prevent pricing exploits
    if (!VALID_FEATURE_DURATIONS.includes(durationDays)) {
      return NextResponse.json(
        { error: "Invalid feature duration. Choose from: 1, 7, 14, or 30 days." },
        { status: 400 }
      );
    }

    // Find listing
    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Ownership check: only the listing owner or an admin can feature
    if (listing.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "You can only feature your own listings" }, { status: 403 });
    }

    if (listing.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved listings can be featured" },
        { status: 400 }
      );
    }

    // Payment-first flow: create a pending payment WITHOUT applying the featured status.
    // The featured status will be applied only after payment is confirmed through the
    // manual payment approval flow (e.g., admin approval or gateway webhook).
    const payment = await db.payment.create({
      data: {
        userId: listing.userId,
        listingId: id,
        amount: FEATURE_PRICING[durationDays],
        currency: "USD",
        status: "pending", // Awaiting real payment gateway confirmation
        method: "feature",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Feature payment created. Featured status will be applied after payment confirmation.",
      listing: {
        id: listing.id,
        requestedFeatureDays: durationDays,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/listings/[id]/feature" });
    return NextResponse.json(
      { error: "Failed to feature listing" },
      { status: 500 }
    );
  }
}

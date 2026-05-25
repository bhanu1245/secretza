import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";

// Whitelist of valid boost durations to prevent pricing exploits
const VALID_BOOST_DURATIONS = [60, 120, 360]; // minutes
const BOOST_PRICING: Record<number, number> = {
  60: 4.99,
  120: 14.99,
  360: 39.99,
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
    const durationMinutes = body.durationMinutes;

    // Validate duration against whitelist to prevent pricing exploits
    if (!VALID_BOOST_DURATIONS.includes(durationMinutes)) {
      return NextResponse.json(
        { error: "Invalid boost duration. Choose from: 60, 120, or 360 minutes." },
        { status: 400 }
      );
    }

    // Find listing
    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Ownership check: only the listing owner or an admin can boost
    if (listing.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "You can only boost your own listings" }, { status: 403 });
    }

    if (listing.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved listings can be boosted" },
        { status: 400 }
      );
    }

    // Payment-first flow: create a pending payment WITHOUT applying the boost.
    // The boost will be applied only after payment is confirmed through the
    // manual payment approval flow (e.g., admin approval or gateway webhook).
    const payment = await db.payment.create({
      data: {
        userId: listing.userId,
        listingId: id,
        amount: BOOST_PRICING[durationMinutes],
        currency: "USD",
        status: "pending", // Awaiting real payment gateway confirmation
        method: "boost",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Boost payment created. Boost will be applied after payment confirmation.",
      listing: {
        id: listing.id,
        requestedBoostMinutes: durationMinutes,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/listings/[id]/boost" });
    return NextResponse.json(
      { error: "Failed to boost listing" },
      { status: 500 }
    );
  }
}

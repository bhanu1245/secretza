import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computePriorityScore, getBoostExpiry } from "@/lib/ranking-engine";

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
    const durationMinutes = body.durationMinutes || 60; // Default: 1 hour

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

    const boostUntil = getBoostExpiry(durationMinutes);

    // Update listing with boost
    const updated = await db.listing.update({
      where: { id },
      data: {
        isBoosted: true,
        boostUntil,
        lastBumpedAt: new Date(),
      },
    });

    // Recompute priority score
    const score = computePriorityScore({
      id: updated.id,
      isFeatured: updated.isFeatured,
      isBoosted: true,
      featuredUntil: updated.featuredUntil,
      boostUntil: boostUntil.toISOString(),
      lastBumpedAt: updated.lastBumpedAt,
      viewCount: updated.viewCount,
      createdAt: updated.createdAt,
      status: updated.status,
    });

    await db.listing.update({
      where: { id },
      data: { priorityScore: score },
    });

    // Create payment record (hook for payment integration)
    const payment = await db.payment.create({
      data: {
        userId: listing.userId,
        listingId: id,
        amount: durationMinutes <= 60 ? 4.99 : durationMinutes <= 360 ? 14.99 : 39.99,
        currency: "USD",
        status: "pending", // Awaiting real payment gateway confirmation
        method: "boost",
      },
    });

    return NextResponse.json({
      success: true,
      listing: {
        id: updated.id,
        isBoosted: updated.isBoosted,
        boostUntil: updated.boostUntil?.toISOString(),
        priorityScore: score,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Boost error:", error);
    return NextResponse.json(
      { error: "Failed to boost listing" },
      { status: 500 }
    );
  }
}

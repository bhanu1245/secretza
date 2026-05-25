import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computePriorityScore, getFeatureExpiry } from "@/lib/ranking-engine";

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
    const durationDays = body.durationDays || 7; // Default: 7 days

    // Find listing
    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved listings can be featured" },
        { status: 400 }
      );
    }

    const featuredUntil = getFeatureExpiry(durationDays);

    // Update listing with featured status
    const updated = await db.listing.update({
      where: { id },
      data: {
        isFeatured: true,
        featuredUntil,
      },
    });

    // Recompute priority score
    const score = computePriorityScore({
      id: updated.id,
      isFeatured: true,
      isBoosted: updated.isBoosted,
      featuredUntil: featuredUntil.toISOString(),
      boostUntil: updated.boostUntil,
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
    const pricingMap: Record<number, number> = {
      1: 4.99,
      7: 14.99,
      14: 24.99,
      30: 39.99,
    };
    const amount = pricingMap[durationDays] || 14.99;

    const payment = await db.payment.create({
      data: {
        userId: listing.userId,
        listingId: id,
        amount,
        currency: "USD",
        status: "completed", // In production, "pending" until payment confirms
        method: "feature",
      },
    });

    return NextResponse.json({
      success: true,
      listing: {
        id: updated.id,
        isFeatured: updated.isFeatured,
        featuredUntil: updated.featuredUntil?.toISOString(),
        priorityScore: score,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Feature error:", error);
    return NextResponse.json(
      { error: "Failed to feature listing" },
      { status: 500 }
    );
  }
}

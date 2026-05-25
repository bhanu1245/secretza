import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logPaymentAudit } from "@/lib/payment-audit";
import { getClientIp } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";
import { getValidAmounts } from "@/lib/payment-settings";

/**
 * Payment hooks endpoint for external payment gateway callbacks
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!session.user.isVerified) {
      return NextResponse.json({ error: "Email verification required" }, { status: 403 });
    }

    const body = await request.json();
    const { type, listingId, amount, gatewayTxId, couponCode } = body;

    const authenticatedUserId = session.user.id;

    if (!type) {
      return NextResponse.json(
        { error: "Missing required field: type" },
        { status: 400 }
      );
    }

    const validTypes = ["boost", "feature", "premium", "renewal"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid payment type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate amount: must be a positive number, capped at 99999
    if (typeof amount !== "number" || amount <= 0 || amount > 99999) {
      return NextResponse.json(
        { error: "Invalid payment amount. Must be a positive number up to 99999." },
        { status: 400 }
      );
    }

    // Validate amount against dynamic PaymentSettings tiers
    if (type !== "renewal") {
      const validAmounts = await getValidAmounts(type as "boost" | "feature" | "premium");
      if (validAmounts.length > 0 && !validAmounts.includes(amount)) {
        return NextResponse.json(
          { error: `Invalid amount for ${type}. Must be one of: ₹${validAmounts.join(", ₹")}` },
          { status: 400 }
        );
      }
    }

    // Validate listing ownership when listingId is provided
    if (listingId) {
      const listing = await db.listing.findUnique({
        where: { id: listingId },
        select: { userId: true },
      });
      if (!listing) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }
      if (listing.userId !== authenticatedUserId) {
        return NextResponse.json({ error: "You do not own this listing" }, { status: 403 });
      }
    }

    const payment = await db.payment.create({
      data: {
        userId: authenticatedUserId,
        listingId: listingId || null,
        amount: amount || 0,
        currency: "INR",
        status: "pending",
        method: type,
        gatewayTxId: gatewayTxId || null,
        couponCode: couponCode || null,
      },
    });

    const ip = getClientIp(request);
    await logPaymentAudit({
      paymentId: payment.id,
      action: "created",
      oldValue: null,
      newValue: { type, amount, currency: "INR", method: type, listingId, couponCode },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
        createdAt: payment.createdAt,
      },
      message: "Payment record created. Awaiting gateway confirmation.",
    });
  } catch (error) {
    logError(error, { component: "route:api/payments" });
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve payment history for the authenticated user only
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId && userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const payments = await db.payment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        listingId: p.listingId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.method,
        gatewayTxId: p.gatewayTxId,
        couponCode: p.couponCode,
        createdAt: p.createdAt.toISOString(),
      })),
      total: payments.length,
    });
  } catch (error) {
    logError(error, { component: "route:api/payments" });
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}

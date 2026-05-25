import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Payment hooks endpoint for external payment gateway callbacks
 * 
 * In production, integrate with Stripe/PayPal/webhook handlers here.
 * This serves as the hook integration layer.
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
    const { type, listingId, userId, amount, gatewayTxId, couponCode } = body;

    if (!userId || !type) {
      return NextResponse.json(
        { error: "Missing required fields: userId, type" },
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

    // Create payment record
    const payment = await db.payment.create({
      data: {
        userId,
        listingId: listingId || null,
        amount: amount || 0,
        currency: "USD",
        status: "pending",
        method: type,
        gatewayTxId: gatewayTxId || null,
        couponCode: couponCode || null,
      },
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
    console.error("Payment hook error:", error);
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve payment history for a user
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      );
    }

    const payments = await db.payment.findMany({
      where: { userId },
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
    console.error("Payment history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}

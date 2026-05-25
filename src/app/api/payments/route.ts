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

    // Security: Always use the authenticated user's ID — ignore any userId from the request body
    // to prevent users from creating payments under other users' accounts.
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

    // Create payment record — userId is always from the session, never from the body
    const payment = await db.payment.create({
      data: {
        userId: authenticatedUserId,
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
 * GET: Retrieve payment history for the authenticated user only
 * Security: Requires authentication and enforces userId === session.user.id
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Security: Only allow users to view their own payment history.
    // Reject if a userId is provided that doesn't match the session.
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
    console.error("Payment history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}

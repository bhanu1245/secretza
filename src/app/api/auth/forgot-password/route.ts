import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-helpers";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = getClientIp(request);
    const rl = rateLimit(`forgot-password:${ip}`, RATE_LIMITS.forgotPassword);
    if (!rl.success) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        {
          status: 200,
          headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    // Look up user
    const user = await db.user.findUnique({
      where: { email },
    });

    // Security: don't reveal if email exists
    if (!user) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    // Security: don't reveal if email exists or what provider they use
    if (!user.passwordHash) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    // Clean up stale reset tokens before creating new one
    await db.verificationToken.deleteMany({
      where: { identifier: `reset:${email}` },
    });

    // Generate reset token
    const resetToken = generateToken(32);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token: resetToken,
        expires,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail(user.email, user.name || "User", resetToken);

    return NextResponse.json(
      { message: "If an account exists, a reset link has been sent." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { errors: ["An unexpected error occurred. Please try again."] },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { generateToken } from "@/lib/auth-helpers";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting
    const rl = rateLimit(`resend-verify:${session.id}`, RATE_LIMITS.resendVerification);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many verification email requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    // Check if already verified
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, isVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json(
        { message: "Your email is already verified." },
        { status: 200 }
      );
    }

    // Generate new verification token
    const token = generateToken(32);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing verification tokens for this email
    await db.verificationToken.deleteMany({
      where: { identifier: user.email },
    });

    await db.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.name || "User", token);

    return NextResponse.json({
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

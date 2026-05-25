import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting
    const rl = rateLimit(`change-password:${session.id}`, RATE_LIMITS.resetPassword);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    // Validate new password type first
    if (typeof newPassword !== "string") {
      return NextResponse.json(
        { errors: ["New password is required."] },
        { status: 400 }
      );
    }
    
    const errors: string[] = [];
    if (newPassword.length < 8) {
      errors.push("Password must be at least 8 characters long.");
    }
    if (!/[A-Z]/.test(newPassword)) {
      errors.push("Password must contain at least one uppercase letter.");
    }
    if (!/[0-9]/.test(newPassword)) {
      errors.push("Password must contain at least one number.");
    }
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses social login. Change password through your provider." },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: session.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

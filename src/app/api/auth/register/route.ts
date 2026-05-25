import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-helpers";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Validation helpers
function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length < 2) {
    return "Name must be at least 2 characters long.";
  }
  return null;
}

function validateEmail(email: unknown): string | null {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please provide a valid email address.";
  }
  return null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const rl = rateLimit(`register:${ip}`, RATE_LIMITS.register);

    if (!rl.success) {
      return NextResponse.json(
        { errors: ["Too many registration attempts. Please try again later."] },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { name, email, password, confirmPassword } = body;

    // Validate all fields
    const errors: string[] = [];

    const nameError = validateName(name);
    if (nameError) errors.push(nameError);

    const emailError = validateEmail(email);
    if (emailError) errors.push(emailError);

    const passwordError = validatePassword(password);
    if (passwordError) errors.push(passwordError);

    if (typeof confirmPassword !== "string" || password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email as string },
    });

    if (existingUser) {
      return NextResponse.json(
        { errors: ["An account with this email already exists."] },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password as string, saltRounds);

    // Create user
    const user = await db.user.create({
      data: {
        email: email as string,
        name: (name as string).trim(),
        passwordHash,
        role: "user",
        isVerified: false,
        provider: "email",
      },
    });

    // Generate verification token
    const verificationToken = generateToken(32);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.verificationToken.create({
      data: {
        identifier: user.email,
        token: verificationToken,
        expires,
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.name || "User", verificationToken);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
          provider: user.provider,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { errors: ["An unexpected error occurred. Please try again."] },
      { status: 500 }
    );
  }
}

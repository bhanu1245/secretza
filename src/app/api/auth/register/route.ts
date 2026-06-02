import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-helpers";
import { sendVerificationEmail } from "@/lib/email";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  recordFailure,
} from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

// ======================
// VALIDATION HELPERS
// ======================

function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length < 2) {
    return "Name must be at least 2 characters long.";
  }

  if (name.trim().length > 100) {
    return "Name must be less than 100 characters.";
  }

  return null;
}

function validateEmail(email: unknown): string | null {
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return "Please provide a valid email address.";
  }

  return null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (password.length > 128) {
    return "Password must be at most 128 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }

  return null;
}

// ======================
// REGISTER ROUTE
// ======================

export async function POST(request: NextRequest) {
  try {
    // ----------------------
    // RATE LIMITING
    // ----------------------

    const ip = getClientIp(request);
    const registerLimit = await rateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!registerLimit.success) {
      return NextResponse.json(
        {
          errors: ["Too many registration attempts. Please try again later."],
          resetAt: registerLimit.resetAt,
        },
        { status: 429 },
      );
    }

    // ----------------------
    // PARSE BODY
    // ----------------------

    const body = await request.json();

    const {
      name,
      email,
      password,
      confirmPassword,
    } = body;

    // ----------------------
    // VALIDATION
    // ----------------------

    const errors: string[] = [];

    const nameError = validateName(name);
    if (nameError) errors.push(nameError);

    const emailError = validateEmail(email);
    if (emailError) errors.push(emailError);

    const passwordError = validatePassword(password);
    if (passwordError) errors.push(passwordError);

    if (
      typeof confirmPassword !== "string" ||
      password !== confirmPassword
    ) {
      errors.push("Passwords do not match.");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { errors },
        { status: 400 }
      );
    }

    // ----------------------
    // CHECK EXISTING USER
    // ----------------------

    const existingUser = await db.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (existingUser) {
      recordFailure(`register:${ip}`);

      return NextResponse.json(
        {
          errors: [
            "An account with this email already exists.",
          ],
        },
        { status: 409 }
      );
    }

    // ----------------------
    // HASH PASSWORD
    // ----------------------

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // ----------------------
    // CREATE USER
    // IMPORTANT:
    // Ensure enum values match Prisma schema
    // ----------------------

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,

        // VERY IMPORTANT
        // Change these if your Prisma enums differ

        role: "USER",

        // Email/password users must verify the token sent below before
        // accessing flows that require a verified account.
        isVerified: false,

        provider: "email",
      },
    });

    // ----------------------
    // VERIFICATION TOKEN
    // ----------------------

    const verificationToken = generateToken(32);

    const expires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    await db.verificationToken.create({
      data: {
        identifier: user.email,
        token: verificationToken,
        expires,
      },
    });

    // ----------------------
    // EMAIL
    // DO NOT CRASH REGISTRATION
    // IF EMAIL FAILS
    // ----------------------

    try {
      await sendVerificationEmail(
        user.email,
        user.name || "User",
        verificationToken
      );
    } catch (emailError) {
      console.error(
        "Verification email failed:",
        emailError
      );
    }

    // ----------------------
    // SUCCESS
    // ----------------------

    return NextResponse.json(
      {
        success: true,

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
    console.error(
      "REGISTER API ERROR:",
      error
    );

    logError(error, {
      component: "route:api/auth/register",
    });

    return NextResponse.json(
      {
        errors: [
          "An unexpected error occurred. Please try again.",
        ],

        debug:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        isVerified: true,
        isSuspended: true,
        isPremium: true,
        premiumExpiry: true,
        provider: true,
        lastLoginAt: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            listings: true,
            payments: true,
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...dbUser,
        premiumExpiry: dbUser.premiumExpiry?.toISOString() ?? null,
        lastLoginAt: dbUser.lastLoginAt?.toISOString() ?? null,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/user/profile" });
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting per user for profile updates
    const rl = await rateLimit(`update-profile:${user.id}`, { maxRequests: 10, windowSeconds: 60 * 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many profile update requests. Please try again later.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const body = await request.json();
    const { name } = body as { name?: string };

    const updateData: Record<string, string> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Name must be at least 2 characters long." },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        isVerified: true,
        isPremium: true,
        premiumExpiry: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully.",
      user: {
        ...updatedUser,
        premiumExpiry: updatedUser.premiumExpiry?.toISOString() ?? null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/user/profile" });
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}

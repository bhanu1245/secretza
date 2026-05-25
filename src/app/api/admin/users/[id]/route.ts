import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
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
        providerId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        listings: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            isFeatured: true,
            viewCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: {
          select: {
            listings: true,
            payments: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...user,
        premiumExpiry: user.premiumExpiry?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        listings: user.listings.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        })),
        payments: user.payments.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, role } = body as { action: string; role?: string };

    const validActions = ["suspend", "unsuspend", "verify", "setRole"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const validRoles = ["user", "moderator", "admin"];
    let updateData: Record<string, unknown> = {};
    let message = "";

    switch (action) {
      case "suspend":
        updateData = { isSuspended: true, sessionVersion: { increment: 1 } };
        message = "User suspended successfully";
        break;
      case "unsuspend":
        updateData = { isSuspended: false };
        message = "User unsuspended successfully";
        break;
      case "verify":
        updateData = { isVerified: true, emailVerified: new Date() };
        message = "User verified successfully";
        break;
      case "setRole":
        if (!role) {
          return NextResponse.json(
            { error: "Role field is required for setRole action" },
            { status: 400 }
          );
        }
        if (!validRoles.includes(role)) {
          return NextResponse.json(
            { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
            { status: 400 }
          );
        }
        // Prevent admin from demoting themselves
        if (id === admin.id) {
          return NextResponse.json(
            { error: "Cannot modify your own role" },
            { status: 403 }
          );
        }
        updateData = { role };
        message = `User role updated to ${role}`;
        break;
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message,
      user: {
        ...updatedUser,
        premiumExpiry: updatedUser.premiumExpiry?.toISOString() ?? null,
        lastLoginAt: updatedUser.lastLoginAt?.toISOString() ?? null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Admin user action error:", error);
    return NextResponse.json(
      { error: "Failed to perform user action" },
      { status: 500 }
    );
  }
}

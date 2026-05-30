import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  parseCouponInput,
  serializeCoupon,
  validateCouponInput,
} from "@/lib/coupons";

export async function GET() {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coupons = await db.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      coupons: coupons.map(serializeCoupon),
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/coupons" });
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = parseCouponInput(body);
    const validationError = validateCouponInput(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await db.coupon.findUnique({ where: { code: input.code } });
    if (existing) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    }

    const coupon = await db.coupon.create({
      data: {
        code: input.code,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxUses: input.maxUses,
        maxUsesPerUser: input.maxUsesPerUser,
        isActive: input.isActive,
        expiresAt: input.expiresAt,
      },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "coupon_created",
        entityType: "Coupon",
        entityId: coupon.id,
        details: JSON.stringify({ code: coupon.code, discountType: coupon.discountType }),
      },
    });

    return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 });
  } catch (error) {
    logError(error, { component: "route:api/admin/coupons" });
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  normalizeCouponCode,
  parseCouponInput,
  serializeCoupon,
  validateCouponInput,
  validateCouponInputForUpdate,
} from "@/lib/coupons";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ coupon: serializeCoupon(coupon) });
  } catch (error) {
    logError(error, { component: "route:api/admin/coupons/[id]" });
    return NextResponse.json({ error: "Failed to fetch coupon" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const body = await request.json();
    const input = parseCouponInput(body);
    const validationError = validateCouponInputForUpdate(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (input.code !== existing.code) {
      const duplicate = await db.coupon.findUnique({ where: { code: input.code } });
      if (duplicate) {
        return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
      }
    }

    const coupon = await db.coupon.update({
      where: { id },
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
        action: "coupon_updated",
        entityType: "Coupon",
        entityId: coupon.id,
        details: JSON.stringify({ code: coupon.code }),
      },
    });

    return NextResponse.json({ coupon: serializeCoupon(coupon) });
  } catch (error) {
    logError(error, { component: "route:api/admin/coupons/[id]" });
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const redemptionCount = await db.couponRedemption.count({ where: { couponId: id } });
    if (redemptionCount > 0) {
      const coupon = await db.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        coupon: serializeCoupon(coupon),
        message: "Coupon deactivated because it has redemption history",
        softDeleted: true,
      });
    }

    await db.coupon.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "coupon_deleted",
        entityType: "Coupon",
        entityId: id,
        details: JSON.stringify({ code: existing.code }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(error, { component: "route:api/admin/coupons/[id]" });
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}

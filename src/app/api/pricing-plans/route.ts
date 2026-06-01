import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const plans = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT * FROM PricingPlan
    WHERE isActive = 1
    ORDER BY sortOrder ASC
  `;

  return NextResponse.json({
    plans: plans.map((plan) => ({
      ...plan,
      features: JSON.parse(plan.features || "[]"),
      isActive: Boolean(plan.isActive),
      isPopular: Boolean(plan.isPopular),
      premiumBadge: Boolean(plan.premiumBadge),
      createdAt: new Date(plan.createdAt).toISOString(),
      updatedAt: new Date(plan.updatedAt).toISOString(),
    })),
  });
}

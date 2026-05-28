import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";
import { randomUUID } from "crypto";

function parseFeatures(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET() {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT * FROM PricingPlan
    ORDER BY sortOrder ASC, price ASC
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

export async function POST(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const slug = slugify(String(body.slug || name));
  const id = randomUUID();
  const now = new Date();
  await db.$executeRaw`
    INSERT INTO PricingPlan (
      id, name, slug, description, price, currency, durationDays, featuredDays, boostDays,
      listingLimit, imageLimit, premiumBadge, priorityScore, features, isActive, isPopular,
      sortOrder, createdAt, updatedAt
    ) VALUES (
      ${id}, ${name}, ${slug}, ${body.description ? String(body.description) : null},
      ${Number(body.price || 0)}, ${String(body.currency || "INR")},
      ${Number(body.durationDays || 30)}, ${Number(body.featuredDays || 0)},
      ${Number(body.boostDays || 0)}, ${Number(body.listingLimit || 1)},
      ${Number(body.imageLimit || 5)}, ${Boolean(body.premiumBadge) ? 1 : 0},
      ${Number(body.priorityScore || 0)}, ${JSON.stringify(parseFeatures(body.features))},
      ${body.isActive !== false ? 1 : 0}, ${Boolean(body.isPopular) ? 1 : 0},
      ${Number(body.sortOrder || 0)}, ${now}, ${now}
    )
  `;

  return NextResponse.json({ plan: { id, name, slug } }, { status: 201 });
}

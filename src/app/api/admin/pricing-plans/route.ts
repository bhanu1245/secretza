import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";
import { randomUUID } from "crypto";

// ── Shared validation helpers ─────────────────────────────────────────────────

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

/** Returns an error string or null. Price must be a finite number ≥ 0 and ≤ 999 999. */
function validatePrice(value: unknown): string | null {
  const n = Number(value);
  if (value === "" || value === null || value === undefined) return "Price is required";
  if (!isFinite(n) || isNaN(n)) return "Price must be a number";
  if (n < 0) return "Price must be ≥ 0";
  if (n > 999_999) return "Price must be ≤ 999,999";
  return null;
}

/** Returns an error string or null. Whole-number days within [min, 3 650]. */
function validateDays(value: unknown, field: string, min = 0): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
  if (n < min) return `${field} must be ≥ ${min}`;
  if (n > 3_650) return `${field} must be ≤ 3,650`;
  return null;
}

/** Returns an error string or null. Whole-number integer within [min, max]. */
function validateLimit(value: unknown, field: string, min: number, max: number): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
  if (n < min || n > max) return `${field} must be ${min}–${max}`;
  return null;
}

/** Returns an error string or null. Slug must be 2–100 chars after slugify. */
function validateSlug(slug: string): string | null {
  if (slug.length < 2) return "Slug must be at least 2 characters after formatting";
  if (slug.length > 100) return "Slug must be at most 100 characters";
  return null;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM PricingPlan
    ORDER BY sortOrder ASC, price ASC
  `;

  return NextResponse.json({
    plans: plans.map((plan) => ({
      ...plan,
      features: JSON.parse((plan.features as string) || "[]"),
      isActive: Boolean(plan.isActive),
      isPopular: Boolean(plan.isPopular),
      premiumBadge: Boolean(plan.premiumBadge),
      createdAt: new Date(plan.createdAt as string).toISOString(),
      updatedAt: new Date(plan.updatedAt as string).toISOString(),
    })),
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // ── Name ──
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // ── Slug ──
  const slug = slugify(String(body.slug || name));
  const slugErr = validateSlug(slug);
  if (slugErr) return NextResponse.json({ error: slugErr }, { status: 400 });

  // ── Price ──
  const priceErr = validatePrice(body.price);
  if (priceErr) return NextResponse.json({ error: priceErr }, { status: 400 });
  const price = Number(body.price);

  // ── Durations — durationDays requires ≥ 1; bonus days can be 0 ──
  const durErr = validateDays(body.durationDays, "durationDays", 1);
  if (durErr) return NextResponse.json({ error: durErr }, { status: 400 });
  const featErr = validateDays(body.featuredDays, "featuredDays", 0);
  if (featErr) return NextResponse.json({ error: featErr }, { status: 400 });
  const boostErr = validateDays(body.boostDays, "boostDays", 0);
  if (boostErr) return NextResponse.json({ error: boostErr }, { status: 400 });

  // ── Limits ──
  const listErr = validateLimit(body.listingLimit, "listingLimit", 1, 1_000);
  if (listErr) return NextResponse.json({ error: listErr }, { status: 400 });
  const imgErr = validateLimit(body.imageLimit, "imageLimit", 1, 50);
  if (imgErr) return NextResponse.json({ error: imgErr }, { status: 400 });

  // ── Duplicate slug check ──
  const existing = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM PricingPlan WHERE slug = ${slug}
  `;
  if (Number(existing[0]?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: `A pricing plan with slug "${slug}" already exists` },
      { status: 409 }
    );
  }

  const id = randomUUID();
  const now = new Date();

  try {
    await db.$executeRaw`
      INSERT INTO PricingPlan (
        id, name, slug, description, price, currency, durationDays, featuredDays, boostDays,
        listingLimit, imageLimit, premiumBadge, priorityScore, features, isActive, isPopular,
        sortOrder, createdAt, updatedAt
      ) VALUES (
        ${id}, ${name}, ${slug}, ${body.description ? String(body.description) : null},
        ${price}, ${String(body.currency || "INR")},
        ${Number(body.durationDays)}, ${Number(body.featuredDays)},
        ${Number(body.boostDays)}, ${Number(body.listingLimit)},
        ${Number(body.imageLimit)}, ${Boolean(body.premiumBadge) ? 1 : 0},
        ${Number(body.priorityScore || 0)}, ${JSON.stringify(parseFeatures(body.features))},
        ${body.isActive !== false ? 1 : 0}, ${Boolean(body.isPopular) ? 1 : 0},
        ${Number(body.sortOrder || 0)}, ${now}, ${now}
      )
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("unique")) {
      return NextResponse.json(
        { error: `A pricing plan with slug "${slug}" already exists` },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ plan: { id, name, slug } }, { status: 201 });
}

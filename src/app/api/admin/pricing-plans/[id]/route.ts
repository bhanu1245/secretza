import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";

// ── Shared validation helpers (mirrors route.ts) ──────────────────────────────

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

function validatePrice(value: unknown): string | null {
  const n = Number(value);
  if (value === "" || value === null || value === undefined) return "Price is required";
  if (!isFinite(n) || isNaN(n)) return "Price must be a number";
  if (n < 0) return "Price must be ≥ 0";
  if (n > 999_999) return "Price must be ≤ 999,999";
  return null;
}

function validateDays(value: unknown, field: string, min = 0): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
  if (n < min) return `${field} must be ≥ ${min}`;
  if (n > 3_650) return `${field} must be ≤ 3,650`;
  return null;
}

function validateLimit(value: unknown, field: string, min: number, max: number): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
  if (n < min || n > max) return `${field} must be ${min}–${max}`;
  return null;
}

function validateSlug(slug: string): string | null {
  if (slug.length < 2) return "Slug must be at least 2 characters after formatting";
  if (slug.length > 100) return "Slug must be at most 100 characters";
  return null;
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // ── Existence check — 404 if plan does not exist ──
  const found = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM PricingPlan WHERE id = ${id}
  `;
  if (found.length === 0) {
    return NextResponse.json({ error: "Pricing plan not found" }, { status: 404 });
  }

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

  // ── Durations ──
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

  // ── Duplicate slug check — exclude this plan's own id ──
  const slugConflict = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM PricingPlan WHERE slug = ${slug} AND id != ${id}
  `;
  if (Number(slugConflict[0]?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: `A pricing plan with slug "${slug}" already exists` },
      { status: 409 }
    );
  }

  try {
    await db.$executeRaw`
      UPDATE PricingPlan SET
        name = ${name},
        slug = ${slug},
        description = ${body.description ? String(body.description) : null},
        price = ${price},
        currency = ${String(body.currency || "INR")},
        durationDays = ${Number(body.durationDays)},
        featuredDays = ${Number(body.featuredDays)},
        boostDays = ${Number(body.boostDays)},
        listingLimit = ${Number(body.listingLimit)},
        imageLimit = ${Number(body.imageLimit)},
        premiumBadge = ${Boolean(body.premiumBadge) ? 1 : 0},
        priorityScore = ${Number(body.priorityScore || 0)},
        features = ${JSON.stringify(parseFeatures(body.features))},
        isActive = ${body.isActive !== false ? 1 : 0},
        isPopular = ${Boolean(body.isPopular) ? 1 : 0},
        sortOrder = ${Number(body.sortOrder || 0)},
        updatedAt = ${new Date()}
      WHERE id = ${id}
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

  return NextResponse.json({ plan: { id, name, slug } });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // ── Existence check — 404 if plan does not exist ──
  const found = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM PricingPlan WHERE id = ${id}
  `;
  if (found.length === 0) {
    return NextResponse.json({ error: "Pricing plan not found" }, { status: 404 });
  }

  await db.$executeRaw`DELETE FROM PricingPlan WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const slug = slugify(String(body.slug || name));
  await db.$executeRaw`
    UPDATE PricingPlan SET
      name = ${name},
      slug = ${slug},
      description = ${body.description ? String(body.description) : null},
      price = ${Number(body.price || 0)},
      currency = ${String(body.currency || "INR")},
      durationDays = ${Number(body.durationDays || 30)},
      featuredDays = ${Number(body.featuredDays || 0)},
      boostDays = ${Number(body.boostDays || 0)},
      listingLimit = ${Number(body.listingLimit || 1)},
      imageLimit = ${Number(body.imageLimit || 5)},
      premiumBadge = ${Boolean(body.premiumBadge) ? 1 : 0},
      priorityScore = ${Number(body.priorityScore || 0)},
      features = ${JSON.stringify(parseFeatures(body.features))},
      isActive = ${body.isActive !== false ? 1 : 0},
      isPopular = ${Boolean(body.isPopular) ? 1 : 0},
      sortOrder = ${Number(body.sortOrder || 0)},
      updatedAt = ${new Date()}
    WHERE id = ${id}
  `;

  return NextResponse.json({ plan: { id, name, slug } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.$executeRaw`DELETE FROM PricingPlan WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

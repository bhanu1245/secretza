import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getListParams, paginatedResponse, requireAdminResponse, slugify } from "../_utils";

export async function GET(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { page, limit, search } = getListParams(request);
  const where: Prisma.CountryWhereInput = search
    ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }, { code: { contains: search } }] }
    : {};

  const [items, total] = await Promise.all([
    db.country.findMany({
      where,
      include: { _count: { select: { states: true, listings: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.country.count({ where }),
  ]);

  return paginatedResponse(items, total, page, limit);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name);
  const code = String(body.code || slug.slice(0, 2)).trim().toUpperCase();

  if (!name || !slug || !code) {
    return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
  }

  const item = await db.country.create({
    data: {
      name,
      slug,
      code,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const data: Prisma.CountryUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = slugify(body.slug);
  if (typeof body.code === "string") data.code = body.code.trim().toUpperCase();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const item = await db.country.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.country.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

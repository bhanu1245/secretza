import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getListParams, paginatedResponse, requireAdminResponse, slugify } from "../_utils";

export async function GET(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { page, limit, search } = getListParams(request);
  const stateId = new URL(request.url).searchParams.get("stateId") || undefined;
  const where: Prisma.CityWhereInput = {
    ...(stateId ? { stateId } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }, { state: { name: { contains: search } } }] } : {}),
  };

  const [items, total] = await Promise.all([
    db.city.findMany({
      where,
      include: { state: { include: { country: true } }, _count: { select: { areas: true, listings: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.city.count({ where }),
  ]);

  return paginatedResponse(items, total, page, limit);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name);
  const stateId = String(body.stateId || "");

  if (!name || !slug || !stateId) {
    return NextResponse.json({ error: "Cannot create city without state" }, { status: 400 });
  }

  const item = await db.city.create({
    data: {
      name,
      slug,
      stateId,
      isActive: body.isActive ?? true,
      isFeatured: body.isFeatured ?? false,
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

  const data: Prisma.CityUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = slugify(body.slug);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.isFeatured === "boolean") data.isFeatured = body.isFeatured;
  if (typeof body.stateId === "string" && body.stateId) {
    data.state = { connect: { id: body.stateId } };
  }

  const item = await db.city.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.city.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

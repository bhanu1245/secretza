import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getListParams, paginatedResponse, requireAdminResponse, slugify } from "../_utils";

export async function GET(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { page, limit, search } = getListParams(request);
  const cityId = new URL(request.url).searchParams.get("cityId") || undefined;
  const where: Prisma.AreaWhereInput = {
    ...(cityId ? { cityId } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }, { city: { name: { contains: search } } }] } : {}),
  };

  const [items, total] = await Promise.all([
    db.area.findMany({
      where,
      include: { city: { include: { state: { include: { country: true } } } }, _count: { select: { listings: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.area.count({ where }),
  ]);

  return paginatedResponse(items, total, page, limit);
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name);
  const cityId = String(body.cityId || "");

  if (!name || !slug || !cityId) {
    return NextResponse.json({ error: "Cannot create area without city" }, { status: 400 });
  }

  const item = await db.area.create({
    data: {
      name,
      slug,
      cityId,
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

  const data: Prisma.AreaUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = slugify(body.slug);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.cityId === "string" && body.cityId) {
    data.city = { connect: { id: body.cityId } };
  }

  const item = await db.area.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.area.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

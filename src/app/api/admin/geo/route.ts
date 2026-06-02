import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import {
  autoGenerateCitySeoPage,
  autoGenerateStateSeoPage,
} from "@/lib/seo-page-service";

type GeoType = "country" | "state" | "city" | "area";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getType(value: string | null): GeoType {
  if (value === "state" || value === "city" || value === "area") return value;
  return "country";
}

export async function GET(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = getType(searchParams.get("type"));

  if (type === "country") {
    const countries = await db.country.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ items: countries });
  }

  if (type === "state") {
    const states = await db.state.findMany({ include: { country: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ items: states });
  }

  if (type === "city") {
    const cities = await db.city.findMany({ include: { state: { include: { country: true } } }, orderBy: { name: "asc" } });
    return NextResponse.json({ items: cities });
  }

  const areas = await db.area.findMany({ include: { city: { include: { state: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ items: areas });
}

export async function POST(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const type = getType(body.type);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name);

  if (!name || !slug) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (type === "country") {
    const item = await db.country.create({
      data: { name, slug, code: String(body.code || slug.slice(0, 2)).toUpperCase() },
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  if (type === "state") {
    if (!body.countryId) return NextResponse.json({ error: "countryId is required" }, { status: 400 });
    const item = await db.state.create({ data: { name, slug, countryId: body.countryId } });
    autoGenerateStateSeoPage(item.id).catch(() => {});
    return NextResponse.json({ item }, { status: 201 });
  }

  if (type === "city") {
    if (!body.stateId) return NextResponse.json({ error: "stateId is required" }, { status: 400 });
    const item = await db.city.create({ data: { name, slug, stateId: body.stateId } });
    autoGenerateCitySeoPage(item.id).catch(() => {});
    return NextResponse.json({ item }, { status: 201 });
  }

  if (!body.cityId) return NextResponse.json({ error: "cityId is required" }, { status: 400 });
  const item = await db.area.create({ data: { name, slug, cityId: body.cityId } });
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const type = getType(body.type);
  const id = String(body.id || "");
  const data: Record<string, unknown> = {};

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = slugify(body.slug);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (type === "country") return NextResponse.json({ item: await db.country.update({ where: { id }, data }) });
  if (type === "state") return NextResponse.json({ item: await db.state.update({ where: { id }, data }) });
  if (type === "city") return NextResponse.json({ item: await db.city.update({ where: { id }, data }) });
  return NextResponse.json({ item: await db.area.update({ where: { id }, data }) });
}

export async function DELETE(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = getType(searchParams.get("type"));
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (type === "country") await db.country.delete({ where: { id } });
  else if (type === "state") await db.state.delete({ where: { id } });
  else if (type === "city") await db.city.delete({ where: { id } });
  else await db.area.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

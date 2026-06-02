import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ state: string; city: string }> }
) {
  try {
    const { state: stateSlug, city: citySlug } = await params;

    const country = await db.country.findUnique({
      where: { code: "IN" },
      select: { id: true, name: true, slug: true },
    });

    if (!country) {
      return NextResponse.json({ error: "India not found" }, { status: 404 });
    }

    const state = await db.state.findFirst({
      where: { slug: stateSlug, countryId: country.id, isActive: true },
      select: { id: true, name: true, slug: true },
    });

    if (!state) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }

    const city = await db.city.findFirst({
      where: { slug: citySlug, stateId: state.id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        districts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        city: {
          id: city.id,
          name: city.name,
          slug: city.slug,
          isFeatured: city.isFeatured,
        },
        districts: city.districts.map((d) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
        })),
        state,
        country,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logError(error, { component: "route:api/geo/india/[state]/[city]" });
    return NextResponse.json(
      { error: "Failed to fetch city data" },
      { status: 500 }
    );
  }
}

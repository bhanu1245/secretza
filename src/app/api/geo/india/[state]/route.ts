import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ state: string }> }
) {
  try {
    const { state: stateSlug } = await params;

    const country = await db.country.findUnique({
      where: { code: "IN" },
      select: { id: true, name: true, slug: true },
    });

    if (!country) {
      return NextResponse.json({ error: "India not found" }, { status: 404 });
    }

    const state = await db.state.findFirst({
      where: { slug: stateSlug, countryId: country.id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        cities: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            isFeatured: true,
            _count: { select: { districts: { where: { isActive: true } } } },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!state) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        state: { id: state.id, name: state.name, slug: state.slug },
        cities: state.cities.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          isFeatured: c.isFeatured,
          districtCount: c._count.districts,
        })),
        country,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logError(error, { component: "route:api/geo/india/[state]" });
    return NextResponse.json(
      { error: "Failed to fetch state data" },
      { status: 500 }
    );
  }
}

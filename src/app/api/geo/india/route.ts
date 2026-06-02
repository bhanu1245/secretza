import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";

export async function GET() {
  try {
    const country = await db.country.findUnique({
      where: { code: "IN" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
    });

    if (!country || !country.isActive) {
      return NextResponse.json({ error: "India not found" }, { status: 404 });
    }

    const states = await db.state.findMany({
      where: { countryId: country.id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { cities: { where: { isActive: true } } } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      {
        country,
        states: states.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          cityCount: s._count.cities,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logError(error, { component: "route:api/geo/india" });
    return NextResponse.json(
      { error: "Failed to fetch India geo data" },
      { status: 500 }
    );
  }
}

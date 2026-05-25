import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ state: string; city: string; district: string; locality: string }> }
) {
  try {
    const { state: stateSlug, city: citySlug, district: districtSlug, locality: localitySlug } = await params;

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
      select: { id: true, name: true, slug: true },
    });

    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const district = await db.district.findFirst({
      where: { slug: districtSlug, cityId: city.id, isActive: true },
      select: { id: true, name: true, slug: true },
    });

    if (!district) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    const locality = await db.locality.findFirst({
      where: { slug: localitySlug, districtId: district.id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!locality) {
      return NextResponse.json({ error: "Locality not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        locality,
        district,
        city,
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
    logError(error, { component: "route:api/geo/india/[state]/[city]/[district]/[locality]" });
    return NextResponse.json(
      { error: "Failed to fetch locality data" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countrySlug = searchParams.get("country") || undefined;
  const stateSlug = searchParams.get("state") || undefined;

  if (countrySlug && stateSlug) {
    // Return cities for a specific state
    const state = await db.state.findFirst({
      where: { slug: stateSlug, country: { slug: countrySlug } },
      include: {
        cities: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
      },
    });
    if (!state)
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    return NextResponse.json({ state, cities: state.cities });
  }

  if (countrySlug) {
    // Return states with cities for a country
    const country = await db.country.findUnique({
      where: { slug: countrySlug },
      include: {
        states: {
          where: { isActive: true },
          orderBy: { listingCount: "desc" },
          include: {
            cities: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
          },
        },
      },
    });
    if (!country)
      return NextResponse.json({ error: "Country not found" }, { status: 404 });
    return NextResponse.json({ country });
  }

  // Return all countries
  const countries = await db.country.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { states: true } },
    },
    orderBy: { listingCount: "desc" },
  });

  return NextResponse.json({
    countries: countries.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      slug: c.slug,
      isActive: c.isActive,
      listingCount: c.listingCount,
      stateCount: c._count.states,
    })),
    total: countries.length,
  });
}

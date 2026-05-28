import { NextResponse } from "next/server";
import { db } from "@/lib/db";

async function getApprovedLocationCounts() {
  const [countries, states, cities, areas] = await Promise.all([
    db.listing.groupBy({
      by: ["countryId"],
      where: { status: "approved" },
      _count: { _all: true },
    }),
    db.listing.groupBy({
      by: ["stateId"],
      where: { status: "approved", stateId: { not: null } },
      _count: { _all: true },
    }),
    db.listing.groupBy({
      by: ["cityId"],
      where: { status: "approved" },
      _count: { _all: true },
    }),
    db.listing.groupBy({
      by: ["areaId"],
      where: { status: "approved", areaId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  return {
    countries: new Map(countries.map((item) => [item.countryId, item._count._all])),
    states: new Map(states.flatMap((item) => item.stateId ? [[item.stateId, item._count._all] as const] : [])),
    cities: new Map(cities.map((item) => [item.cityId, item._count._all])),
    areas: new Map(areas.flatMap((item) => item.areaId ? [[item.areaId, item._count._all] as const] : [])),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countrySlug = searchParams.get("country") || undefined;
  const stateSlug = searchParams.get("state") || undefined;

  if (countrySlug && stateSlug) {
    const counts = await getApprovedLocationCounts();
    // Return cities for a specific state
    const state = await db.state.findFirst({
      where: { slug: stateSlug, country: { slug: countrySlug } },
      include: {
        cities: {
          where: { isActive: true },
          orderBy: { listingCount: "desc" },
          include: {
            areas: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
          },
        },
      },
    });
    if (!state)
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    return NextResponse.json({
      state: {
        ...state,
        listingCount: counts.states.get(state.id) || 0,
      },
      cities: state.cities.map((city) => ({
        ...city,
        listingCount: counts.cities.get(city.id) || 0,
        areas: city.areas.map((area) => ({
          ...area,
          listingCount: counts.areas.get(area.id) || 0,
        })),
      })),
    });
  }

  if (countrySlug) {
    const counts = await getApprovedLocationCounts();
    // Return states with cities for a country
    const country = await db.country.findUnique({
      where: { slug: countrySlug },
      include: {
        states: {
          where: { isActive: true },
          orderBy: { listingCount: "desc" },
          include: {
            cities: {
              where: { isActive: true },
              orderBy: { listingCount: "desc" },
              include: {
                areas: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
              },
            },
          },
        },
      },
    });
    if (!country)
      return NextResponse.json({ error: "Country not found" }, { status: 404 });
    return NextResponse.json({
      country: {
        ...country,
        listingCount: counts.countries.get(country.id) || 0,
        states: country.states.map((state) => ({
          ...state,
          listingCount: counts.states.get(state.id) || 0,
          cities: state.cities.map((city) => ({
            ...city,
            listingCount: counts.cities.get(city.id) || 0,
            areas: city.areas.map((area) => ({
              ...area,
              listingCount: counts.areas.get(area.id) || 0,
            })),
          })),
        })),
      },
    });
  }

  // Return all countries
  const counts = await getApprovedLocationCounts();
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
      listingCount: counts.countries.get(c.id) || 0,
      stateCount: c._count.states,
    })),
    total: countries.length,
  });
}

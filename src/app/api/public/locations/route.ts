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

export async function GET() {
  const counts = await getApprovedLocationCounts();
  const countries = await db.country.findMany({
    where: { isActive: true },
    orderBy: [{ listingCount: "desc" }, { name: "asc" }],
    include: {
      states: {
        where: { isActive: true },
        orderBy: [{ listingCount: "desc" }, { name: "asc" }],
        include: {
          cities: {
            where: { isActive: true },
            orderBy: [{ listingCount: "desc" }, { name: "asc" }],
            include: {
              areas: {
                where: { isActive: true },
                orderBy: [{ listingCount: "desc" }, { name: "asc" }],
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    countries: countries.map((country) => ({
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
    })),
    total: countries.length,
  });
}

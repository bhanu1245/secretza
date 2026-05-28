import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
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
    countries,
    total: countries.length,
  });
}

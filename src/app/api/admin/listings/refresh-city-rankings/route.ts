import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  countApprovedListingsInCity,
  refreshCityListingRankings,
  resolveAdminRankingAccess,
} from "@/lib/admin-ranking-tools";
import { logRankingMaintenanceAction } from "@/lib/admin-ranking-audit";

/** Preview how many approved listings would be refreshed in a city. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveAdminRankingAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cityId = new URL(request.url).searchParams.get("cityId");
    if (!cityId) {
      return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    }

    const city = await db.city.findUnique({
      where: { id: cityId },
      select: { id: true, name: true },
    });
    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const count = await countApprovedListingsInCity(cityId);
    return NextResponse.json({
      cityId: city.id,
      cityName: city.name,
      count,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings/refresh-city-rankings" });
    return NextResponse.json({ error: "Failed to load city preview" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveAdminRankingAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const cityId = typeof body.cityId === "string" ? body.cityId.trim() : "";
    if (!cityId) {
      return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    }

    const city = await db.city.findUnique({
      where: { id: cityId },
      select: { id: true, name: true },
    });
    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const processed = await refreshCityListingRankings(cityId);

    await logRankingMaintenanceAction({
      adminUserId: user!.id,
      action: "ranking_refresh_city",
      processed,
      cityId: city.id,
      cityName: city.name,
    });

    return NextResponse.json({
      success: true,
      processed,
      cityId: city.id,
      cityName: city.name,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings/refresh-city-rankings" });
    return NextResponse.json({ error: "Failed to refresh city rankings" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import {
  generateCitySeoPack,
  previewCitySeoPack,
  resolveSeoGranularAccess,
} from "@/lib/seo-granular-generation";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoGranularAccess(user?.role);
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

    const preview = await previewCitySeoPack(cityId);
    if (!preview) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-city-pack" });
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoGranularAccess(user?.role);
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

    const result = await generateCitySeoPack(cityId);
    if (!result) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    await logSeoGenerationAction({
      adminUserId: user!.id,
      action: "seo_generate_city_pack",
      country: result.countryName,
      state: result.stateName,
      city: result.cityName,
      generated: result.created,
      skipped: result.skipped,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      total: result.total,
      examples: result.examples,
      cityName: result.cityName,
      message: `Generated ${result.created} page(s), skipped ${result.skipped} existing`,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-city-pack" });
    return NextResponse.json({ error: "Failed to generate city SEO pack" }, { status: 500 });
  }
}

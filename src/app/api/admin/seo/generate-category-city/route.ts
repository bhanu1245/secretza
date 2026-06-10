import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import {
  generateSingleCategoryCitySeoPage,
  previewCategoryCityPage,
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

    const params = new URL(request.url).searchParams;
    const cityId = params.get("cityId");
    const categoryId = params.get("categoryId");

    if (!cityId) {
      return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const preview = await previewCategoryCityPage(cityId, categoryId);
    if (!preview) {
      return NextResponse.json({ error: "City or category not found" }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-category-city" });
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
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";

    if (!cityId) {
      return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const result = await generateSingleCategoryCitySeoPage(cityId, categoryId);
    if (!result) {
      return NextResponse.json({ error: "City or category not found" }, { status: 404 });
    }

    await logSeoGenerationAction({
      adminUserId: user!.id,
      action: "seo_generate_category_city",
      country: result.countryName,
      state: result.stateName,
      city: result.cityName,
      category: result.categoryName,
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
      categoryName: result.categoryName,
      message: `Generated ${result.created} page(s), skipped ${result.skipped} existing`,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-category-city" });
    return NextResponse.json({ error: "Failed to generate category+city SEO page" }, { status: 500 });
  }
}

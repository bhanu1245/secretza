import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  generateCityCategoryKeywordPages,
  previewCityCategoryKeywords,
  resolveSeoAdvancedAccess,
} from "@/lib/seo-advanced-generation";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import {
  normalizeKeywordsForGeneration,
  splitKeywordLines,
} from "@/lib/seo-keyword-generation";

function parseKeywords(keywords?: unknown, keywordsText?: unknown): string[] {
  const fromArray = Array.isArray(keywords)
    ? keywords.filter((k): k is string => typeof k === "string")
    : [];
  const fromText = typeof keywordsText === "string" ? splitKeywordLines(keywordsText) : [];
  return normalizeKeywordsForGeneration(fromArray.length > 0 ? fromArray : fromText);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoAdvancedAccess(user?.role);
    if (denied === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (denied === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const params = new URL(request.url).searchParams;
    const cityId = params.get("cityId") ?? "";
    const categoryId = params.get("categoryId") ?? "";
    const keywords = parseKeywords(undefined, params.get("keywords") ?? "");

    if (!cityId) return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    if (keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    const preview = await previewCityCategoryKeywords({ cityId, categoryId, keywords });
    if (!preview) {
      return NextResponse.json({ error: "City or category not found" }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-city-category-keywords" });
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoAdvancedAccess(user?.role);
    if (denied === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (denied === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const cityId = typeof body.cityId === "string" ? body.cityId.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const keywords = parseKeywords(body.keywords, body.keywordsText);
    const isPreview = body.preview === true;

    if (!cityId) return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    if (keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    if (isPreview) {
      const preview = await previewCityCategoryKeywords({ cityId, categoryId, keywords });
      if (!preview) {
        return NextResponse.json({ error: "City or category not found" }, { status: 404 });
      }
      return NextResponse.json({ preview });
    }

    const result = await generateCityCategoryKeywordPages({ cityId, categoryId, keywords });
    if (!result) {
      return NextResponse.json({ error: "City or category not found" }, { status: 404 });
    }

    await logSeoGenerationAction({
      adminUserId: user!.id,
      action: "seo_generate_city_category_keywords",
      generated: result.generated,
      skipped: result.skipped,
      failed: result.failed,
      keywords: result.keywords.slice(0, 50),
      cityIds: result.cityIds,
      cityNames: result.cityNames,
      categoryId: result.categoryId,
      categoryName: result.categoryName,
    });

    return NextResponse.json({
      success: true,
      generated: result.generated,
      skipped: result.skipped,
      failed: result.failed,
      total: result.total,
      message: `Generated ${result.generated} SEO page(s), skipped ${result.skipped} existing`,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-city-category-keywords" });
    return NextResponse.json({ error: "Failed to generate pages" }, { status: 500 });
  }
}

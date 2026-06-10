import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  generateKeywordMultiCityPages,
  previewKeywordMultiCity,
  resolveSeoAdvancedAccess,
} from "@/lib/seo-advanced-generation";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import {
  normalizeKeywordsForGeneration,
  splitKeywordLines,
} from "@/lib/seo-keyword-generation";

function parseCityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

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
    const keywords = parseKeywords(undefined, params.get("keywords") ?? "");
    const cityIds = parseCityIds(params.get("cityIds")?.split(",").filter(Boolean) ?? []);

    if (keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }
    if (cityIds.length === 0) {
      return NextResponse.json({ error: "At least one city is required" }, { status: 400 });
    }

    const preview = await previewKeywordMultiCity({ keywords, cityIds });
    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-keyword-multi-city" });
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
    const keywords = parseKeywords(body.keywords, body.keywordsText);
    const cityIds = parseCityIds(body.cityIds);
    const isPreview = body.preview === true;

    if (keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }
    if (cityIds.length === 0) {
      return NextResponse.json({ error: "At least one city is required" }, { status: 400 });
    }

    if (isPreview) {
      const preview = await previewKeywordMultiCity({ keywords, cityIds });
      return NextResponse.json({ preview });
    }

    const result = await generateKeywordMultiCityPages({ keywords, cityIds });
    if (!result) {
      return NextResponse.json({ error: "Generation failed" }, { status: 500 });
    }

    await logSeoGenerationAction({
      adminUserId: user!.id,
      action: "seo_generate_keyword_multi_city",
      generated: result.generated,
      skipped: result.skipped,
      failed: result.failed,
      keywords: result.keywords.slice(0, 50),
      cityIds: result.cityIds,
      cityNames: result.cityNames,
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
    logError(error, { component: "route:api/admin/seo/generate-keyword-multi-city" });
    return NextResponse.json({ error: "Failed to generate pages" }, { status: 500 });
  }
}

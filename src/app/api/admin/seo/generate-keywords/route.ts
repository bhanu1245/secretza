import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import {
  generateKeywordPages,
  mergeKeywordSources,
  normalizeKeywordsForGeneration,
  parseKeywordCsv,
  previewKeywordGeneration,
  resolveSeoKeywordAccess,
  splitKeywordLines,
  type KeywordGenerationMode,
  type KeywordPageTypeOption,
} from "@/lib/seo-keyword-generation";

const VALID_PAGE_TYPES: KeywordPageTypeOption[] = [
  "auto",
  "longtail",
  "city",
  "category",
  "custom",
];

const VALID_MODES: KeywordGenerationMode[] = ["keywords", "keyword_city"];

function parseKeywordsFromRequest(
  keywords?: unknown,
  keywordsText?: unknown,
  csv?: unknown,
): string[] {
  const fromArray = Array.isArray(keywords)
    ? keywords.filter((k): k is string => typeof k === "string")
    : [];
  const fromText =
    typeof keywordsText === "string" ? splitKeywordLines(keywordsText) : [];
  const fromCsv = typeof csv === "string" ? parseKeywordCsv(csv) : [];
  return mergeKeywordSources(fromArray.length > 0 ? fromArray : fromText, fromCsv);
}

function parsePreviewParams(searchParams: URLSearchParams) {
  const keywordsText = searchParams.get("keywords") ?? "";
  const csv = searchParams.get("csv") ?? "";
  const pageType = (searchParams.get("pageType") ?? "auto") as KeywordPageTypeOption;
  const mode = (searchParams.get("mode") ?? "keywords") as KeywordGenerationMode;
  const cityId = searchParams.get("cityId") ?? undefined;

  const keywords = mergeKeywordSources(splitKeywordLines(keywordsText), parseKeywordCsv(csv));

  return { keywords, pageType, mode, cityId };
}

function validateInput(
  pageType: KeywordPageTypeOption,
  mode: KeywordGenerationMode,
  cityId?: string,
): string | null {
  if (!VALID_PAGE_TYPES.includes(pageType)) {
    return `pageType must be one of: ${VALID_PAGE_TYPES.join(", ")}`;
  }
  if (!VALID_MODES.includes(mode)) {
    return `mode must be one of: ${VALID_MODES.join(", ")}`;
  }
  if (mode === "keyword_city" && !cityId) {
    return "cityId is required for keyword_city mode";
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoKeywordAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = parsePreviewParams(new URL(request.url).searchParams);
    const validationError = validateInput(params.pageType, params.mode, params.cityId);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const keywords = normalizeKeywordsForGeneration(params.keywords);
    const preview = await previewKeywordGeneration({
      keywords,
      pageTypeOption: params.pageType,
      mode: params.mode,
      cityId: params.cityId,
    });

    if (!preview && params.mode === "keyword_city") {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-keywords" });
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoKeywordAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const pageType = (body.pageType ?? "auto") as KeywordPageTypeOption;
    const mode = (body.mode ?? "keywords") as KeywordGenerationMode;
    const cityId = typeof body.cityId === "string" ? body.cityId.trim() : undefined;
    const isPreview = body.preview === true;

    const validationError = validateInput(pageType, mode, cityId);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const keywords = normalizeKeywordsForGeneration(
      parseKeywordsFromRequest(body.keywords, body.keywordsText, body.csv),
    );

    if (keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    if (isPreview) {
      const preview = await previewKeywordGeneration({
        keywords,
        pageTypeOption: pageType,
        mode,
        cityId,
      });
      if (!preview && mode === "keyword_city") {
        return NextResponse.json({ error: "City not found" }, { status: 404 });
      }
      return NextResponse.json({ preview });
    }

    const result = await generateKeywordPages({
      keywords,
      pageTypeOption: pageType,
      mode,
      cityId,
    });

    if (!result && mode === "keyword_city") {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const auditAction = mode === "keyword_city" ? "seo_generate_keyword_city" : "seo_generate_keywords";
    await logSeoGenerationAction({
      adminUserId: user!.id,
      action: auditAction,
      city: result?.cityName,
      cityId: result?.cityId,
      generated: result?.generated ?? 0,
      skipped: result?.skipped ?? 0,
      failed: result?.failed ?? 0,
      keywords: keywords.slice(0, 50),
    });

    return NextResponse.json({
      success: true,
      generated: result?.generated ?? 0,
      skipped: result?.skipped ?? 0,
      failed: result?.failed ?? 0,
      total: result?.total ?? 0,
      cityName: result?.cityName,
      message: `Generated ${result?.generated ?? 0} SEO page(s), skipped ${result?.skipped ?? 0} existing`,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-keywords" });
    return NextResponse.json({ error: "Failed to generate keyword SEO pages" }, { status: 500 });
  }
}

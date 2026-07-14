import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  buildSeoPagePreview,
  formatDryRunPreviewResponse,
  type SeoDryRunPreview,
} from "@/lib/seo-dry-run-service";
import { getDryRunPreview } from "@/lib/seo-dry-run-cache";
import {
  resolveUniversalPageSlug,
  type UniversalSeoMode,
} from "@/lib/seo-universal-engine";
import type { SeoPageType } from "@/lib/seo-page-service";

const VALID_MODES: UniversalSeoMode[] = [
  "generate",
  "regenerate",
  "optimize",
  "rewrite_intro",
  "rewrite_paragraph",
  "improve_keywords",
  "improve_faq",
  "improve_cta",
];

/** GET /api/seo/dry-run/preview?previewId= — fetch cached preview */
export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const previewId = new URL(request.url).searchParams.get("previewId");
    if (!previewId) {
      return NextResponse.json({ error: "previewId required" }, { status: 400 });
    }

    const preview = getDryRunPreview<SeoDryRunPreview>(previewId);
    if (!preview) {
      return NextResponse.json({ error: "Preview expired or not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      preview: formatDryRunPreviewResponse(preview),
      full: preview,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/dry-run/preview GET" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load preview" },
      { status: 500 },
    );
  }
}

/** POST /api/seo/dry-run/preview — single-page dry run (no DB writes) */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const pageType = body.pageType as SeoPageType;
    if (!pageType) {
      return NextResponse.json({ error: "pageType required" }, { status: 400 });
    }

    const mode = (body.mode ?? "regenerate") as UniversalSeoMode;
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 });
    }

    const { pageSlug } = resolveUniversalPageSlug({
      pageType,
      pageSlug: body.pageSlug,
      citySlug: body.citySlug,
      categorySlug: body.categorySlug,
      keywordSlug: body.keywordSlug,
      stateSlug: body.stateSlug,
      countrySlug: body.countrySlug,
    });

    const result = await buildSeoPagePreview({
      pageType,
      pageSlug,
      mode,
      useCache: body.useCache !== false,
    });

    if (!("previewId" in result)) {
      return NextResponse.json(
        { ok: false, error: result.error, skipped: result.skipped ?? false },
        { status: result.skipped ? 200 : 400 },
      );
    }

    return NextResponse.json({
      success: true,
      ...formatDryRunPreviewResponse(result),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/dry-run/preview POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dry run preview failed" },
      { status: 500 },
    );
  }
}

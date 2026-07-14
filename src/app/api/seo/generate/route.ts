import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  resolveGenerationCandidates,
  runSeoGeneration,
  type SeoPageType,
} from "@/lib/seo-page-service";
import {
  buildSeoPagePreview,
  formatDryRunPreviewResponse,
  runDryRunBatch,
  buildVirtualDryRunProgress,
} from "@/lib/seo-dry-run-service";
import { getSeoEngineInfo } from "@/lib/seo-engine";
import {
  generateUniversalSeoContent,
  resolveUniversalPageSlug,
  SEO_V61_CONFIG,
  type UniversalSeoMode,
} from "@/lib/seo-universal-engine";

const VALID_TYPES: SeoPageType[] = [
  "city",
  "category",
  "category_city",
  "state",
  "country",
  "longtail",
];

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

/**
 * POST /api/seo/generate
 *
 * Universal V6.1 API — single page generation/optimization:
 *   { pageType, citySlug, categorySlug, mode, targetUniqueness, targetSeo }
 *
 * Legacy bulk API (backward compatible):
 *   { type, limit, countrySlug, skipExisting }
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // ── Universal single-page API ──────────────────────────────────────────
    if (body.pageType && !body.type) {
      const pageType = body.pageType as SeoPageType;
      if (!VALID_TYPES.includes(pageType)) {
        return NextResponse.json(
          { error: `pageType must be one of: ${VALID_TYPES.join(", ")}` },
          { status: 400 },
        );
      }

      const mode = (body.mode ?? "generate") as UniversalSeoMode;
      if (!VALID_MODES.includes(mode)) {
        return NextResponse.json(
          { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
          { status: 400 },
        );
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

      if (body.dryRun === true) {
        const preview = await buildSeoPagePreview({
          pageType,
          pageSlug,
          mode,
          useCache: body.useCache !== false,
        });
        if (!("previewId" in preview)) {
          return NextResponse.json(
            { ok: false, error: preview.error, skipped: preview.skipped ?? false },
            { status: preview.skipped ? 200 : 400 },
          );
        }
        return NextResponse.json({
          success: true,
          mode,
          engine: getSeoEngineInfo(),
          config: SEO_V61_CONFIG,
          ...formatDryRunPreviewResponse(preview),
        });
      }

      const result = await generateUniversalSeoContent({
        pageType,
        pageSlug,
        citySlug: body.citySlug,
        categorySlug: body.categorySlug,
        keywordSlug: body.keywordSlug,
        stateSlug: body.stateSlug,
        countrySlug: body.countrySlug,
        mode,
        targetUniqueness: typeof body.targetUniqueness === "number" ? body.targetUniqueness : undefined,
        targetSeo: typeof body.targetSeo === "number" ? body.targetSeo : undefined,
        excludePageId: body.excludePageId,
        paragraphIndex: typeof body.paragraphIndex === "number" ? body.paragraphIndex : undefined,
        conflictSlug: body.conflictSlug,
      });

      return NextResponse.json({
        success: true,
        pageType,
        pageSlug,
        mode,
        engine: getSeoEngineInfo(),
        config: SEO_V61_CONFIG,
        canonicalUrl: result.canonicalUrl,
        content: result.content,
        metadata: result.metadata,
        generationTimeMs: result.generationTimeMs,
      });
    }

    // ── Legacy bulk generation API ─────────────────────────────────────────
    const type = body.type as SeoPageType;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: `Provide pageType (universal) or type (bulk). Valid types: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? body.limit
        : undefined;
    const countrySlug =
      typeof body.countrySlug === "string" && body.countrySlug.trim()
        ? body.countrySlug.trim()
        : "india";
    const skipExisting = body.skipExisting === true;

    if (body.dryRun === true) {
      const candidates = await resolveGenerationCandidates(type, {
        limit: limit ?? 25,
        countrySlug,
        skipExisting,
      });
      const start = Date.now();
      const batch = await runDryRunBatch({
        pages: candidates,
        mode: "generate",
        concurrency: 3,
      });
      const run = buildVirtualDryRunProgress({
        sessionId: batch.sessionId,
        mode: `generate_${type}`,
        dashboard: batch.dashboard,
        errorCount: batch.errors.length,
        elapsedMs: Date.now() - start,
      });
      return NextResponse.json({
        success: true,
        dryRun: true,
        previewOnly: true,
        type,
        engine: getSeoEngineInfo(),
        config: SEO_V61_CONFIG,
        sessionId: batch.sessionId,
        run,
        dashboard: batch.dashboard,
        previews: batch.previews.map(formatDryRunPreviewResponse),
        errors: batch.errors,
        total: candidates.length,
        message: `Dry run preview for ${batch.dashboard.totalPages} ${type} page(s)`,
      });
    }

    const result = await runSeoGeneration(type, { limit, countrySlug, skipExisting });

    return NextResponse.json({
      success: true,
      type,
      engine: getSeoEngineInfo(),
      config: SEO_V61_CONFIG,
      created: result.created,
      skipped: result.skipped,
      total: result.total,
      examples: result.examples,
      message: `Generated ${result.created} ${type} SEO page(s) via V6.1 universal engine`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/generate" });
    const message = error instanceof Error ? error.message : "Failed to generate SEO content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

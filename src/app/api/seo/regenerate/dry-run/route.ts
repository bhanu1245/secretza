import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  buildVirtualDryRunProgress,
  formatDryRunPreviewResponse,
  previewToStudioItem,
  runDryRunBatch,
} from "@/lib/seo-dry-run-service";
import {
  resolvePagesForRegeneration,
  type RegenerationMode,
} from "@/lib/seo-regeneration-service";

/** POST /api/seo/regenerate/dry-run — V6.2 memory-only preview (zero DB writes) */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const mode = (body.mode ?? "all") as RegenerationMode;
    const pageTypeFilter = body.pageTypeFilter ?? "city";
    const batchSize = [10, 25, 50, 100].includes(body.batchSize) ? body.batchSize : 25;

    const allPages = await resolvePagesForRegeneration({
      mode,
      pageTypeFilter,
      citySlugs: body.citySlugs,
      lowScoreThreshold: body.lowScoreThreshold,
      duplicateRisks: body.duplicateRisks,
    });

    const pages = allPages.slice(0, batchSize).map((p) => ({
      pageType: p.pageType,
      pageSlug: p.pageSlug,
    }));

    const start = Date.now();
    const batch = await runDryRunBatch({
      pages,
      mode: "regenerate",
      concurrency: 3,
    });

    const run = buildVirtualDryRunProgress({
      sessionId: batch.sessionId,
      mode,
      dashboard: batch.dashboard,
      errorCount: batch.errors.length,
      createdByEmail: admin.email,
      elapsedMs: Date.now() - start,
    });

    const report = {
      pagesProcessed: batch.dashboard.totalPages,
      pagesUpdated: batch.dashboard.wouldSaveCount,
      pagesImproved: batch.previews.filter((p) => (p.delta.uniqueness ?? 0) > 0).length,
      pagesUnchanged: batch.previews.filter((p) => !p.wouldSave).length,
      pagesSkipped: batch.errors.length,
      failures: batch.errors.length,
      averagePriorUniqueness:
        batch.previews.length > 0
          ? batch.previews.reduce((s, p) => s + (p.before.uniqueness ?? 0), 0) / batch.previews.length
          : null,
      averageUniqueness: batch.dashboard.avgUniqueness,
      averagePriorSeoScore:
        batch.previews.length > 0
          ? batch.previews.reduce((s, p) => s + (p.before.seo ?? 0), 0) / batch.previews.length
          : null,
      averageSeoScore: batch.dashboard.avgSeo,
    };

    return NextResponse.json({
      dryRun: true,
      previewOnly: true,
      sessionId: batch.sessionId,
      totalPages: allPages.length,
      processedPages: pages.length,
      run,
      report,
      dashboard: batch.dashboard,
      previews: batch.previews.map(formatDryRunPreviewResponse),
      items: batch.previews.map((p) => previewToStudioItem(p)),
      errors: batch.errors,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/dry-run" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dry run failed" },
      { status: 500 },
    );
  }
}

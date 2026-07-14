import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  buildVirtualDryRunProgress,
  formatDryRunPreviewResponse,
  runDryRunBatch,
} from "@/lib/seo-dry-run-service";
import type { UniversalSeoMode } from "@/lib/seo-universal-engine";

/** POST /api/seo/dry-run/batch — memory-only batch preview */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const pages = Array.isArray(body.pages)
      ? body.pages.filter(
          (p: unknown): p is { pageType: string; pageSlug: string } =>
            typeof p === "object" &&
            p != null &&
            typeof (p as { pageType?: unknown }).pageType === "string" &&
            typeof (p as { pageSlug?: unknown }).pageSlug === "string",
        )
      : [];

    if (pages.length === 0) {
      return NextResponse.json({ error: "pages array required" }, { status: 400 });
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(body.limit, 500)
        : pages.length;
    const mode = (body.mode ?? "regenerate") as UniversalSeoMode;
    const concurrency = typeof body.concurrency === "number" ? body.concurrency : 3;

    const start = Date.now();
    const batch = await runDryRunBatch({
      pages: pages.slice(0, limit),
      mode,
      concurrency,
    });

    const run = buildVirtualDryRunProgress({
      sessionId: batch.sessionId,
      mode: body.batchMode ?? mode,
      dashboard: batch.dashboard,
      errorCount: batch.errors.length,
      createdByEmail: admin.email,
      elapsedMs: Date.now() - start,
    });

    return NextResponse.json({
      success: true,
      run,
      sessionId: batch.sessionId,
      dryRun: true,
      previewOnly: true,
      previews: batch.previews.map(formatDryRunPreviewResponse),
      dashboard: batch.dashboard,
      errors: batch.errors,
      report: {
        pagesProcessed: batch.dashboard.totalPages,
        pagesUpdated: batch.dashboard.wouldSaveCount,
        pagesImproved: batch.previews.filter((p) => (p.delta.uniqueness ?? 0) > 0).length,
        pagesUnchanged: batch.previews.filter((p) => !p.wouldSave).length,
        pagesSkipped: batch.errors.length,
        failures: batch.errors.length,
        averagePriorUniqueness: batch.dashboard.avgUniqueness,
        averageUniqueness: batch.dashboard.avgUniqueness,
        averagePriorSeoScore: batch.dashboard.avgSeo,
        averageSeoScore: batch.dashboard.avgSeo,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/dry-run/batch POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch dry run failed" },
      { status: 500 },
    );
  }
}

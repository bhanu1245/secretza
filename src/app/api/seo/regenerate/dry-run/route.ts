import { after, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  buildVirtualDryRunProgress,
  formatDryRunPreviewResponse,
  previewToStudioItem,
  runDryRunBatch,
  type SeoDryRunPreview,
} from "@/lib/seo-dry-run-service";
import {
  resolvePagesForRegeneration,
  type RegenerationMode,
} from "@/lib/seo-regeneration-service";
import {
  completeDryRunPending,
  failDryRunPending,
  getDryRunAsyncError,
  getDryRunAsyncState,
  getDryRunPreview,
  getDryRunSession,
  registerDryRunPending,
} from "@/lib/seo-dry-run-cache";

/** POST /api/seo/regenerate/dry-run — starts async V6.2 preview batch */
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

    const sessionId = randomUUID();
    registerDryRunPending(sessionId);

    const pendingDashboard = {
      totalPages: pages.length,
      meetingThreshold: 0,
      failingUniqueness: 0,
      failingSeo: 0,
      avgUniqueness: null,
      avgSeo: null,
      avgGenerationTimeMs: null,
      wouldSaveCount: 0,
    };

    const run = {
      ...buildVirtualDryRunProgress({
        sessionId,
        mode,
        dashboard: pendingDashboard,
        errorCount: 0,
        createdByEmail: admin.email,
        elapsedMs: 0,
      }),
      status: "dry_run_processing" as const,
      // Pending: nothing is done yet
      completed: 0,
      remaining: pages.length,
    };

    // Schedule batch in background — response is already sent before this runs
    const BATCH_TIMEOUT_MS = 5 * 60 * 1000; // 5-minute safety cap
    after(async () => {
      try {
        await Promise.race([
          runDryRunBatch({ pages, mode: "regenerate", concurrency: 3, sessionId }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Dry run timed out after 5 minutes")),
              BATCH_TIMEOUT_MS,
            ),
          ),
        ]);
        completeDryRunPending(sessionId);
      } catch (err) {
        failDryRunPending(
          sessionId,
          err instanceof Error ? err.message : "Dry run failed",
        );
        logError(err, { component: "dry-run:after", sessionId });
      }
    });

    return NextResponse.json({
      dryRun: true,
      previewOnly: true,
      sessionId,
      totalPages: allPages.length,
      processedPages: pages.length,
      run,
      report: null,
      dashboard: null,
      previews: [],
      items: [],
      errors: [],
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/dry-run POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dry run failed" },
      { status: 500 },
    );
  }
}

/** GET /api/seo/regenerate/dry-run?sessionId=… — poll for async batch status */
export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const state = getDryRunAsyncState(sessionId);

    if (state === "not_found") {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (state === "error") {
      return NextResponse.json({
        sessionId,
        status: "dry_run_failed",
        error: getDryRunAsyncError(sessionId) ?? "Dry run failed",
      });
    }

    if (state === "processing") {
      return NextResponse.json({ sessionId, status: "dry_run_processing" });
    }

    // state === "completed" — return full results from in-memory cache
    const session = getDryRunSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session results expired" }, { status: 404 });
    }

    const previews = session.previewIds
      .map((id) => getDryRunPreview<SeoDryRunPreview>(id))
      .filter((p): p is SeoDryRunPreview => p != null);

    const errors: Array<{ pageSlug: string; error: string }> = [];

    const run = buildVirtualDryRunProgress({
      sessionId,
      mode: "regenerate",
      dashboard: session.dashboard,
      errorCount: errors.length,
      createdByEmail: admin.email,
    });

    const report = {
      pagesProcessed: session.dashboard.totalPages,
      pagesUpdated: session.dashboard.wouldSaveCount,
      pagesImproved: previews.filter((p) => (p.delta.uniqueness ?? 0) > 0).length,
      pagesUnchanged: previews.filter((p) => !p.wouldSave).length,
      pagesSkipped: errors.length,
      failures: errors.length,
      averagePriorUniqueness:
        previews.length > 0
          ? previews.reduce((s, p) => s + (p.before.uniqueness ?? 0), 0) / previews.length
          : null,
      averageUniqueness: session.dashboard.avgUniqueness,
      averagePriorSeoScore:
        previews.length > 0
          ? previews.reduce((s, p) => s + (p.before.seo ?? 0), 0) / previews.length
          : null,
      averageSeoScore: session.dashboard.avgSeo,
    };

    return NextResponse.json({
      dryRun: true,
      previewOnly: true,
      sessionId,
      status: "dry_run_completed",
      totalPages: session.dashboard.totalPages,
      processedPages: previews.length,
      run,
      report,
      dashboard: session.dashboard,
      previews: previews.map(formatDryRunPreviewResponse),
      items: previews.map((p) => previewToStudioItem(p)),
      errors,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/dry-run GET" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch dry run status" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { generateCitySeoPages, resolveGenerationCandidates } from "@/lib/seo-page-service";
import {
  runDryRunBatch,
  formatDryRunPreviewResponse,
  buildVirtualDryRunProgress,
} from "@/lib/seo-dry-run-service";
import { logError } from "@/lib/monitoring";

/** @deprecated Use POST /api/seo/generate { type: "city" } */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(body.limit, 1000)
        : undefined;
    const countrySlug =
      typeof body.countrySlug === "string" && body.countrySlug.trim()
        ? body.countrySlug.trim()
        : "india";

    if (body.dryRun === true) {
      const candidates = await resolveGenerationCandidates("city", {
        limit: limit ?? 25,
        countrySlug,
        skipExisting: body.skipExisting === true,
      });
      const start = Date.now();
      const batch = await runDryRunBatch({
        pages: candidates,
        mode: "generate",
        concurrency: 3,
      });
      const run = buildVirtualDryRunProgress({
        sessionId: batch.sessionId,
        mode: "generate_city",
        dashboard: batch.dashboard,
        errorCount: batch.errors.length,
        elapsedMs: Date.now() - start,
      });
      return NextResponse.json({
        success: true,
        dryRun: true,
        previewOnly: true,
        sessionId: batch.sessionId,
        run,
        dashboard: batch.dashboard,
        previews: batch.previews.map(formatDryRunPreviewResponse),
        total: candidates.length,
        message: `Dry run preview for ${batch.dashboard.totalPages} cities`,
      });
    }

    const result = await generateCitySeoPages({ limit, countrySlug });

    return NextResponse.json({
      success: true,
      created: result.created,
      total: result.total,
      examples: result.examples,
      message: `Generated SEO pages for ${result.created} cities`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/generate/cities" });
    return NextResponse.json(
      { error: "Failed to generate city SEO pages" },
      { status: 500 },
    );
  }
}

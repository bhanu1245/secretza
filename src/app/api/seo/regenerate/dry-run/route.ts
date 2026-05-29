import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  createRegenerationRun,
  processRunUntilDone,
  serializeRunProgress,
  resolvePagesForRegeneration,
  type RegenerationMode,
} from "@/lib/seo-regeneration-service";

/** POST /api/seo/regenerate/dry-run — preview without saving */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const mode = (body.mode ?? "all") as RegenerationMode;
    const pageTypeFilter = body.pageTypeFilter ?? "city";

    const pages = await resolvePagesForRegeneration({
      mode,
      pageTypeFilter,
      citySlugs: body.citySlugs,
      lowScoreThreshold: body.lowScoreThreshold,
      duplicateRisks: body.duplicateRisks,
    });

    const { run } = await createRegenerationRun({
      mode,
      dryRun: true,
      batchSize: body.batchSize ?? 50,
      pageTypeFilter,
      citySlugs: body.citySlugs,
      lowScoreThreshold: body.lowScoreThreshold,
      duplicateRisks: body.duplicateRisks,
      createdBy: { id: admin.id, email: admin.email },
    });

    await processRunUntilDone(run.id);

    const updated = await db.seoRegenerationRun.findUnique({
      where: { id: run.id },
      include: {
        items: {
          where: { status: "completed" },
          select: {
            pageSlug: true,
            predictedWords: true,
            predictedUnique: true,
            predictedScore: true,
            predictedRisk: true,
          },
        },
      },
    });

    return NextResponse.json({
      totalPages: pages.length,
      run: updated ? serializeRunProgress(updated) : serializeRunProgress(run),
      report: updated?.reportJson ? JSON.parse(updated.reportJson) : null,
      sampleItems: updated?.items.slice(0, 10) ?? [],
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/dry-run" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dry run failed" },
      { status: 500 },
    );
  }
}

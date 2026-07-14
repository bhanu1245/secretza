import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  confirmRegenerationRun,
  kickOffRegenerationProcessing,
  processRegenerationBatch,
  recomputeRunCounters,
  serializeRunProgress,
} from "@/lib/seo-regeneration-service";

/** POST /api/seo/regenerate/[runId]/confirm — explicit confirmation before writes */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    console.log("SEO_REGEN_CONFIRM", { runId });
    await confirmRegenerationRun(runId);
    await recomputeRunCounters(runId);

    const firstBatch = await processRegenerationBatch(runId);
    console.log("SEO_REGEN_FIRST_BATCH", { runId, processed: firstBatch.processed, done: firstBatch.done });

    if (!firstBatch.done) {
      kickOffRegenerationProcessing(runId);
    }

    const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });

    return NextResponse.json({
      run: run ? serializeRunProgress(run) : null,
      processResult: firstBatch,
      background: !firstBatch.done,
      report: run?.reportJson ? JSON.parse(run.reportJson) : null,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/confirm" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 },
    );
  }
}

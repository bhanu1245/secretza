import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  processRegenerationBatch,
  processRunUntilDone,
  resumeRegenerationRun,
  serializeRunProgress,
} from "@/lib/seo-regeneration-service";

/** POST /api/seo/regenerate/[runId]/process — process batch or resume until done */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    const body = await request.json().catch(() => ({}));
    const untilDone = Boolean(body.untilDone);
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined;

    const result = untilDone
      ? await resumeRegenerationRun(runId, true)
      : await processRegenerationBatch(runId, batchSize);

    const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });

    return NextResponse.json({
      result,
      run: run ? serializeRunProgress(run) : null,
      report: run?.reportJson ? JSON.parse(run.reportJson) : null,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/process" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Process failed" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { processSeoJobBatch } from "@/lib/seo-job-service";
import { beginSeoJobRun, endSeoJobRun } from "@/lib/seo-peer-cache";

/**
 * POST /api/seo/jobs/[jobId]/process — process one batch (admin fallback / manual advance).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const body = await request.json().catch(() => ({}));
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined;

    beginSeoJobRun(jobId);
    let result: Awaited<ReturnType<typeof processSeoJobBatch>>;
    try {
      result = await processSeoJobBatch(jobId, batchSize);
    } finally {
      endSeoJobRun(jobId);
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs/[jobId]/process POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process batch" },
      { status: 500 },
    );
  }
}

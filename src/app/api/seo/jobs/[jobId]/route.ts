import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { getSeoJob } from "@/lib/seo-job-service";

/**
 * GET /api/seo/jobs/[jobId] — job detail with live progress.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const user = await requireMinRole("moderator");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await getSeoJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs/[jobId] GET" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load job" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  createSeoJob,
  listSeoJobs,
  resumeStaleSeoJobs,
} from "@/lib/seo-job-service";
import { isSeoJobType } from "@/lib/seo-job-types";

/**
 * GET /api/seo/jobs — list jobs (moderator+ read).
 * POST /api/seo/jobs — create job (admin only).
 */
export async function GET(request: Request) {
  try {
    const user = await requireMinRole("moderator");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await resumeStaleSeoJobs();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    const result = await listSeoJobs({ status, page, limit });
    console.log("SEO_JOB_LIST", { total: result.total, page, active: result.jobs.filter((j) => j.status === "queued" || j.status === "running").length });
    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs GET" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list jobs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const jobType = typeof body.jobType === "string" ? body.jobType : "";
    const pageIds: string[] = Array.isArray(body.pageIds)
      ? body.pageIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const issueTypes: string[] = Array.isArray(body.issueTypes)
      ? body.issueTypes.filter((t: unknown): t is string => typeof t === "string")
      : [];
    const issueType = typeof body.issueType === "string" ? body.issueType : undefined;
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined;
    const confirmDestructive = body.confirmDestructive === true;

    if (!isSeoJobType(jobType)) {
      return NextResponse.json({ error: `Invalid job type: ${jobType}` }, { status: 400 });
    }
    if (pageIds.length === 0) {
      return NextResponse.json({ error: "No page IDs provided" }, { status: 400 });
    }

    const result = await createSeoJob({
      jobType,
      pageIds,
      batchSize,
      issueTypes: issueTypes.length > 0 ? issueTypes : issueType ? [issueType] : [],
      payload: {
        issueType,
        issueTypes,
        confirmDestructive,
      },
      createdBy: { id: admin.id, email: admin.email },
    });

    if (result.conflict) {
      return NextResponse.json(
        {
          conflict: true,
          message: result.message,
          activeJob: result.activeJob,
        },
        { status: 409 },
      );
    }

    console.log("SEO_JOB_CREATED_RESPONSE", { jobId: result.job.id, status: result.job.status, processed: result.job.processed });
    return NextResponse.json({ success: true, job: result.job });
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create job" },
      { status: 500 },
    );
  }
}

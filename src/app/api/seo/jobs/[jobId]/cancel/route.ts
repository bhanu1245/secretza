import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { cancelSeoJob } from "@/lib/seo-job-service";

/**
 * POST /api/seo/jobs/[jobId]/cancel — cancel a running job (admin only).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await cancelSeoJob(jobId);

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "seo_job_cancelled",
        entityType: "SeoJob",
        entityId: jobId,
        details: JSON.stringify({ status: job.status }),
      },
    });

    return NextResponse.json({ success: true, job });
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs/[jobId]/cancel POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel job" },
      { status: 500 },
    );
  }
}

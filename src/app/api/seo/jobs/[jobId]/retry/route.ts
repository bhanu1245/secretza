import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { retryFailedSeoJobItems } from "@/lib/seo-job-service";

/**
 * POST /api/seo/jobs/[jobId]/retry — requeue failed items only (admin only).
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
    const result = await retryFailedSeoJobItems(jobId, {
      id: admin.id,
      email: admin.email,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs/[jobId]/retry POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry job" },
      { status: 500 },
    );
  }
}

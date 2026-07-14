import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { previewSeoJob } from "@/lib/seo-job-service";

/**
 * POST /api/seo/jobs/preview — estimate duration & affected issue types before bulk run.
 */
export async function POST(request: Request) {
  try {
    const user = await requireMinRole("moderator");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const jobType = typeof body.jobType === "string" ? body.jobType : "";
    const pageIds: string[] = Array.isArray(body.pageIds)
      ? body.pageIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const issueTypes: string[] = Array.isArray(body.issueTypes)
      ? body.issueTypes.filter((t: unknown): t is string => typeof t === "string")
      : typeof body.issueType === "string"
        ? [body.issueType]
        : [];
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined;

    if (pageIds.length === 0) {
      return NextResponse.json({ error: "No page IDs provided" }, { status: 400 });
    }

    const preview = await previewSeoJob({ jobType, pageIds, issueTypes, batchSize });
    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs/preview POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 },
    );
  }
}

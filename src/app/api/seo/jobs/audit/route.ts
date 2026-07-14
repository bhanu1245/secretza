import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { listSeoJobAuditLogs } from "@/lib/seo-job-service";

/**
 * GET /api/seo/jobs/audit — paginated SEO job audit log (moderator+ read).
 */
export async function GET(request: Request) {
  try {
    const user = await requireMinRole("moderator");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    const result = await listSeoJobAuditLogs({ action, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/jobs/audit GET" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load audit log" },
      { status: 500 },
    );
  }
}

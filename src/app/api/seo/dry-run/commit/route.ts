import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  commitDryRunPreviews,
  getDryRunSessionPreviews,
  type CommitMode,
} from "@/lib/seo-dry-run-service";
import { getDryRunSession } from "@/lib/seo-dry-run-cache";

/** POST /api/seo/dry-run/commit — persist cached previews */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const mode = (body.mode ?? "selected") as CommitMode;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

    let previewIds: string[] = Array.isArray(body.previewIds)
      ? body.previewIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (previewIds.length === 0 && sessionId) {
      const session = getDryRunSession(sessionId);
      if (session) previewIds = session.previewIds;
    }

    if (previewIds.length === 0) {
      return NextResponse.json({ error: "No previews to commit" }, { status: 400 });
    }

    if (mode === "all" && sessionId) {
      previewIds = getDryRunSessionPreviews(sessionId).map((p) => p.previewId);
    }

    const result = await commitDryRunPreviews({
      previewIds,
      mode: mode === "improved" ? "improved" : undefined,
      createdBy: { id: admin.id, email: admin.email },
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      previewOnly: false,
      committed: result.committed,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/dry-run/commit POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Commit failed" },
      { status: 500 },
    );
  }
}

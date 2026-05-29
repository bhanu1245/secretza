import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { rollbackRegenerationRun } from "@/lib/seo-regeneration-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    const result = await rollbackRegenerationRun(runId);
    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/rollback-run" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rollback failed" },
      { status: 500 },
    );
  }
}

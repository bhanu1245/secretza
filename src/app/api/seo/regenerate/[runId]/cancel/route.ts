import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { cancelRegenerationRun, serializeRunProgress } from "@/lib/seo-regeneration-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    const run = await cancelRegenerationRun(runId);
    return NextResponse.json({ run: serializeRunProgress(run) });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/cancel" });
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
}

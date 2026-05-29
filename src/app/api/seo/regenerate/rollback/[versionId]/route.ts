import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { rollbackContentVersion } from "@/lib/seo-regeneration-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { versionId } = await params;
    const result = await rollbackContentVersion(versionId);
    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/rollback-version" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rollback failed" },
      { status: 500 },
    );
  }
}

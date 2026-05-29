import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { serializeRunProgress } from "@/lib/seo-regeneration-service";

/** GET /api/seo/regenerate/[runId] — run detail + recent items */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const items = await db.seoRegenerationItem.findMany({
      where: { runId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const versions = await db.seoContentVersion.findMany({
      where: { runId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        pageSlug: true,
        pageType: true,
        title: true,
        wordCount: true,
        uniquenessScore: true,
        seoQualityScore: true,
        duplicateRisk: true,
        createdAt: true,
        rolledBackAt: true,
        createdByEmail: true,
      },
    });

    return NextResponse.json({
      run: serializeRunProgress(run),
      report: run.reportJson ? JSON.parse(run.reportJson) : null,
      items,
      versions,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/[runId] GET" });
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}

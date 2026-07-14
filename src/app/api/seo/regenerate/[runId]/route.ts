import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { serializeRunProgress } from "@/lib/seo-regeneration-service";
import { aggregateRunDashboardStats } from "@/lib/seo-generation-metadata";
import { safeRegenerationItemFindMany } from "@/lib/seo-regeneration-queries";
import {
  getRegenerationSchemaHealth,
  isMissingColumnError,
  logSchemaMismatchOnce,
  schemaOutdatedJson,
} from "@/lib/seo-schema-health";

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

    const health = await getRegenerationSchemaHealth();
    const schemaDegraded = !health.generationMetaJson;

    const items = await safeRegenerationItemFindMany({
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

    const dashboard = await aggregateRunDashboardStats(runId);

    const payload = {
      success: true,
      run: serializeRunProgress(run),
      report: run.reportJson ? JSON.parse(run.reportJson) : null,
      dashboard,
      items,
      versions,
      schemaDegraded,
    };

    if (schemaDegraded) {
      return NextResponse.json({
        ...payload,
        warning: schemaOutdatedJson().error,
        code: "SCHEMA_OUTDATED",
        action: schemaOutdatedJson().action,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (isMissingColumnError(error)) {
      logSchemaMismatchOnce();
      return NextResponse.json(schemaOutdatedJson(), { status: 503 });
    }
    logError(error, { component: "route:api/seo/regenerate/[runId] GET" });
    return NextResponse.json({ success: false, error: "Failed to fetch run" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { clearRegenerationCaches } from "@/lib/seo-regeneration-service";
import {
  resolveAutoFixStrategy,
  runUniversalAutoFix,
} from "@/lib/seo-autofix";
import { clearSeoPeerCache } from "@/lib/seo-peer-cache";

/**
 * POST /api/seo/issues/autofix
 *
 * Universal Auto Fix — single endpoint for single-row and bulk actions.
 * Routes each issue type to the optimal repair strategy automatically.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const pageIds: string[] = Array.isArray(body.pageIds)
      ? body.pageIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const issueType = typeof body.issueType === "string" ? body.issueType : "";

    if (pageIds.length === 0) {
      return NextResponse.json(
        { error: "No page IDs provided" },
        { status: 400 },
      );
    }

    if (!resolveAutoFixStrategy(issueType)) {
      return NextResponse.json(
        { error: `Unsupported issue type: ${issueType}` },
        { status: 400 },
      );
    }

    const result = await runUniversalAutoFix({
      pageIds,
      issueType,
      createdBy: { id: admin.id, email: admin.email },
    });

    // Clear all analyzer caches after a successful run
    clearRegenerationCaches();
    clearSeoPeerCache();

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "seo_autofix",
        entityType: "SeoPage",
        details: JSON.stringify({
          issueType,
          strategy: result.strategy,
          requested: pageIds.length,
          processed: result.processed,
          changed: result.changed,
          skipped: result.skipped,
          failed: result.failed,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      // Legacy fields for backward compatibility
      scanned: result.processed,
      unchanged: result.skipped,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/issues/autofix POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-fix failed" },
      { status: 500 },
    );
  }
}

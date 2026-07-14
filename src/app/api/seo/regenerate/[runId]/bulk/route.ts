import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  createRegenerationRun,
  kickOffRegenerationProcessing,
  processRegenerationBatch,
  requeueRegenerationItems,
  rollbackContentVersion,
} from "@/lib/seo-regeneration-service";
import {
  formatDryRunPreviewResponse,
  previewToStudioItem,
  runDryRunBatch,
} from "@/lib/seo-dry-run-service";

/**
 * POST — bulk regenerate / rollback selected items.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    const body = await request.json();
    const action = body.action as string;
    const itemIds: string[] = Array.isArray(body.itemIds)
      ? body.itemIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    const items = await db.seoRegenerationItem.findMany({
      where: { runId, id: { in: itemIds } },
      select: { id: true, seoPageId: true, versionId: true, pageSlug: true, pageType: true },
    });

    if (action === "rollback") {
      let rolledBack = 0;
      const errors: string[] = [];
      for (const item of items) {
        if (!item.versionId) {
          errors.push(`${item.pageSlug}: no version`);
          continue;
        }
        try {
          await rollbackContentVersion(item.versionId);
          rolledBack++;
        } catch (e) {
          errors.push(`${item.pageSlug}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
      return NextResponse.json({ success: true, rolledBack, errors });
    }

    if (action === "regenerate") {
      const dryRun = body.dryRun === true;
      if (dryRun) {
        const pages = items.map((i) => ({ pageType: i.pageType, pageSlug: i.pageSlug }));
        const batch = await runDryRunBatch({ pages, mode: "regenerate", concurrency: 3 });
        return NextResponse.json({
          success: true,
          dryRun: true,
          previewOnly: true,
          sessionId: batch.sessionId,
          previews: batch.previews.map(formatDryRunPreviewResponse),
          items: batch.previews.map((p) => previewToStudioItem(p)),
          dashboard: batch.dashboard,
          errors: batch.errors,
        });
      }

      const itemIdList = items.map((i) => i.id);
      const reuseRun = body.reuseRun !== false;

      if (reuseRun) {
        const { requeued } = await requeueRegenerationItems(runId, itemIdList);
        return NextResponse.json({
          success: true,
          runId,
          requeued,
          started: true,
          message: `Regeneration started for ${requeued} page(s)`,
        });
      }

      const pageIds = items.map((i) => i.seoPageId).filter((id): id is string => Boolean(id));
      if (pageIds.length === 0) {
        return NextResponse.json({ error: "No valid page IDs" }, { status: 400 });
      }

      const createDryRun = body.dryRun !== false;
      const { run, requiresConfirmation } = await createRegenerationRun({
        mode: "selected_pages",
        dryRun: createDryRun,
        confirmed: createDryRun,
        batchSize: typeof body.batchSize === "number" ? body.batchSize : 10,
        pageIds,
        createdBy: { id: admin.id, email: admin.email },
      });

      if (!requiresConfirmation) {
        const first = await processRegenerationBatch(run.id);
        if (!first.done) kickOffRegenerationProcessing(run.id);
      }

      return NextResponse.json({
        success: true,
        runId: run.id,
        requiresConfirmation,
        total: pageIds.length,
        started: !requiresConfirmation,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/bulk POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk action failed" },
      { status: 500 },
    );
  }
}

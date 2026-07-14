import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  applyStudioOptimize,
  isStudioOptimizeAction,
  type StudioOptimizeAction,
} from "@/lib/seo-studio-optimize";
import {
  buildSeoPagePreview,
  formatDryRunPreviewResponse,
} from "@/lib/seo-dry-run-service";
import type { UniversalSeoMode } from "@/lib/seo-universal-engine";

const ACTION_TO_MODE: Record<StudioOptimizeAction, UniversalSeoMode> = {
  rewrite_intro: "rewrite_intro",
  reduce_repetition: "rewrite_paragraph",
  keyword_density: "improve_keywords",
};

/**
 * POST — partial AI optimization (intro-only mutations with version snapshot).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string; itemId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, itemId } = await params;
    const body = (await request.json()) as { action?: string; dryRun?: boolean };
    const action = body.action;

    if (!action || !isStudioOptimizeAction(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use rewrite_intro, reduce_repetition, or keyword_density." },
        { status: 400 },
      );
    }

    const item = await db.seoRegenerationItem.findFirst({
      where: { id: itemId, runId },
      select: { seoPageId: true, pageType: true, pageSlug: true },
    });
    if (!item?.seoPageId) {
      return NextResponse.json({ error: "Item or linked page not found" }, { status: 404 });
    }

    if (body.dryRun === true) {
      const preview = await buildSeoPagePreview({
        pageType: item.pageType,
        pageSlug: item.pageSlug,
        mode: ACTION_TO_MODE[action as StudioOptimizeAction],
      });
      if (!("previewId" in preview)) {
        return NextResponse.json({ error: preview.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        action,
        unchanged: !preview.diff.intro.changed,
        comparison: {
          content: preview.diff.intro,
          uniqueness: {
            old: preview.before.uniqueness,
            new: preview.after.uniqueness,
            changed: preview.before.uniqueness !== preview.after.uniqueness,
          },
          seoScore: {
            old: preview.before.seo,
            new: preview.after.seo,
            changed: preview.before.seo !== preview.after.seo,
          },
        },
        ...formatDryRunPreviewResponse(preview),
      });
    }

    const result = await applyStudioOptimize({
      seoPageId: item.seoPageId,
      pageType: item.pageType,
      pageSlug: item.pageSlug,
      action: action as StudioOptimizeAction,
      runId,
      createdBy: { id: admin.id, email: admin.email },
    });

    if (result.unchanged) {
      return NextResponse.json({
        ...result,
        message: "No changes were needed — content already optimized.",
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/optimize POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Optimization failed" },
      { status: 500 },
    );
  }
}

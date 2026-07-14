import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { runAutoImprove } from "@/lib/seo-studio-auto-improve";
import {
  buildSeoPagePreview,
  formatDryRunPreviewResponse,
} from "@/lib/seo-dry-run-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string; itemId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, itemId } = await params;
    const item = await db.seoRegenerationItem.findFirst({
      where: { id: itemId, runId },
      select: { seoPageId: true, pageType: true, pageSlug: true, status: true },
    });
    if (!item?.seoPageId) {
      return NextResponse.json({ error: "Item or page not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.dryRun === true) {
      const preview = await buildSeoPagePreview({
        pageType: item.pageType,
        pageSlug: item.pageSlug,
        mode: "optimize",
      });
      if (!("previewId" in preview)) {
        return NextResponse.json({ error: preview.error }, { status: 400 });
      }
      return NextResponse.json({
        startUnique: preview.before.uniqueness ?? 0,
        currentUnique: preview.after.uniqueness,
        currentSeo: preview.after.seo,
        improved: (preview.delta.uniqueness ?? 0) > 0,
        ...formatDryRunPreviewResponse(preview),
      });
    }

    await db.seoRegenerationItem.update({
      where: { id: itemId },
      data: { status: "processing", error: null },
    });

    const result = await runAutoImprove({
      seoPageId: item.seoPageId,
      pageType: item.pageType,
      pageSlug: item.pageSlug,
      runId,
      itemId,
      createdBy: { id: admin.id, email: admin.email },
    });

    await db.seoRegenerationItem.update({
      where: { id: itemId },
      data: {
        status: "completed",
        processedAt: new Date(),
        predictedUnique: result.currentUnique,
        predictedScore: result.currentSeo,
        error: result.improved ? "saved" : "No improvement",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/auto-improve POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto improve failed" },
      { status: 500 },
    );
  }
}

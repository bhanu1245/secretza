import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { getItemProgress } from "@/lib/seo-regen-progress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string; itemId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, itemId } = await params;
    const item = await db.seoRegenerationItem.findFirst({
      where: { id: itemId, runId },
      select: { status: true, pageSlug: true, processedAt: true, error: true },
    });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const stages = getItemProgress(itemId);
    const saved = item.error === "saved" || (item.status === "completed" && item.processedAt != null);

    return NextResponse.json({
      itemId,
      pageSlug: item.pageSlug,
      status: item.status,
      stages,
      saved,
      savedAt: item.processedAt?.toISOString() ?? null,
      discarded: item.status === "skipped",
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/progress GET" });
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}

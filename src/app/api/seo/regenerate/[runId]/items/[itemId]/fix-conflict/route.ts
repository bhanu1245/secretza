import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { applyFixConflict } from "@/lib/seo-studio-optimize";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string; itemId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, itemId } = await params;
    const body = (await request.json()) as { conflictSlug?: string };
    if (!body.conflictSlug?.trim()) {
      return NextResponse.json({ error: "conflictSlug required" }, { status: 400 });
    }

    const item = await db.seoRegenerationItem.findFirst({
      where: { id: itemId, runId },
      select: { seoPageId: true, pageType: true, pageSlug: true },
    });
    if (!item?.seoPageId) {
      return NextResponse.json({ error: "Item or page not found" }, { status: 404 });
    }

    const result = await applyFixConflict({
      seoPageId: item.seoPageId,
      pageType: item.pageType,
      pageSlug: item.pageSlug,
      conflictSlug: body.conflictSlug.trim(),
      runId,
      createdBy: { id: admin.id, email: admin.email },
    });

    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/fix-conflict POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fix conflict failed" },
      { status: 500 },
    );
  }
}

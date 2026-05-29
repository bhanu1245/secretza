import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  createRegenerationRun,
  processRunUntilDone,
  serializeRunProgress,
  type CreateRunInput,
  type RegenerationMode,
} from "@/lib/seo-regeneration-service";

/** GET /api/seo/regenerate — list regeneration runs */
export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10));

    const runs = await db.seoRegenerationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      runs: runs.map(serializeRunProgress),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate GET" });
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}

/** POST /api/seo/regenerate — create run (dry-run or awaiting confirmation) */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const mode = body.mode as RegenerationMode;
    const validModes = ["all", "selected_cities", "duplicate_risk", "low_score", "below_words"];
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const input: CreateRunInput = {
      mode,
      dryRun: Boolean(body.dryRun),
      confirmed: Boolean(body.confirmed),
      batchSize: typeof body.batchSize === "number" ? body.batchSize : 25,
      pageTypeFilter: body.pageTypeFilter ?? null,
      citySlugs: Array.isArray(body.citySlugs) ? body.citySlugs : undefined,
      lowScoreThreshold: typeof body.lowScoreThreshold === "number" ? body.lowScoreThreshold : undefined,
      duplicateRisks: Array.isArray(body.duplicateRisks) ? body.duplicateRisks : undefined,
      createdBy: { id: admin.id, email: admin.email },
    };

    const { run, requiresConfirmation } = await createRegenerationRun(input);

    if (requiresConfirmation) {
      return NextResponse.json({
        run: serializeRunProgress(run),
        requiresConfirmation: true,
        message: "Run created. Confirm explicitly before writes are applied.",
      });
    }

    const processResult = await processRunUntilDone(run.id);

    const updated = await db.seoRegenerationRun.findUnique({ where: { id: run.id } });

    return NextResponse.json({
      run: updated ? serializeRunProgress(updated) : serializeRunProgress(run),
      requiresConfirmation: false,
      processResult,
      report: updated?.reportJson ? JSON.parse(updated.reportJson) : null,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create run" },
      { status: 500 },
    );
  }
}

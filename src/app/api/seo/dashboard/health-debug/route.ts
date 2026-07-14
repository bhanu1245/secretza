import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { loadSeoDashboardMetrics } from "@/lib/seo-dashboard-metrics";
import { logError } from "@/lib/monitoring";

/** Debug breakdown for SEO Health Score factor contributions. */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireMinRole("moderator");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const days = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("days") || "30", 10), 1),
      90,
    );

    const started = Date.now();
    const metrics = await loadSeoDashboardMetrics(days);

    return NextResponse.json({
      healthScore: metrics.healthScore,
      healthBreakdown: metrics.healthBreakdown,
      quality: metrics.quality,
      contentIssues: metrics.contentIssues,
      duplicates: metrics.duplicates,
      seoPages: metrics.seoPages,
      loadTimeMs: Date.now() - started,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logError(error, { component: "route:api/seo/dashboard/health-debug" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load health debug" },
      { status: 500 },
    );
  }
}

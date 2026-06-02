import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { loadSeoDashboardMetrics } from "@/lib/seo-dashboard-metrics";
import { logError } from "@/lib/monitoring";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireMinRole("moderator");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 90);

    const started = Date.now();
    const metrics = await loadSeoDashboardMetrics(days);
    const loadTimeMs = Date.now() - started;

    return NextResponse.json({ ...metrics, loadTimeMs });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logError(error, { component: "route:api/seo/dashboard" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load SEO dashboard" },
      { status: 500 },
    );
  }
}

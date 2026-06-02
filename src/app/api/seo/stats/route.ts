import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { getSeoPageCountsByType } from "@/lib/seo-page-service";
import { logError } from "@/lib/monitoring";

/**
 * GET /api/seo/stats
 * SEO page counts grouped by page type.
 */
export async function GET() {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getSeoPageCountsByType();
    return NextResponse.json(stats);
  } catch (error) {
    logError(error, { component: "route:api/seo/stats" });
    return NextResponse.json(
      { error: "Failed to fetch SEO stats" },
      { status: 500 },
    );
  }
}

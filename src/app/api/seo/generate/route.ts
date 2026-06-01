import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  runSeoGeneration,
  type SeoPageType,
} from "@/lib/seo-page-service";
import { getSeoEngineInfo } from "@/lib/seo-engine";

const VALID_TYPES: SeoPageType[] = [
  "city",
  "category",
  "category_city",
  "state",
  "country",
  "longtail",
];

/**
 * POST /api/seo/generate
 * Bulk-generate SEO pages by type.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type as SeoPageType;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type is required. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? body.limit
        : undefined;
    const countrySlug =
      typeof body.countrySlug === "string" && body.countrySlug.trim()
        ? body.countrySlug.trim()
        : "india";
    const skipExisting = body.skipExisting === true;

    const result = await runSeoGeneration(type, { limit, countrySlug, skipExisting });

    return NextResponse.json({
      success: true,
      type,
      engine: getSeoEngineInfo(),
      created: result.created,
      skipped: result.skipped,
      total: result.total,
      examples: result.examples,
      message: `Generated ${result.created} ${type} SEO page(s)`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/generate" });
    return NextResponse.json(
      { error: "Failed to generate SEO pages" },
      { status: 500 },
    );
  }
}

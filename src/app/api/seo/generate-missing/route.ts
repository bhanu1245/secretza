import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  generateAllMissingSeoPages,
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
 * POST /api/seo/generate-missing
 *
 * Scans all entity types and creates SEO pages only for those that do not
 * yet exist. Existing pages are skipped (never overwritten).
 *
 * Body (all optional):
 *   countrySlug       — default "india"
 *   categoryCityLimit — max new category_city pages per call (default 500)
 *   longtailLimit     — max new longtail pages per call (default 500)
 *   types             — array of page types to process (default: all six)
 *
 * Response:
 *   { generated, skipped, failed, total, breakdown, engine }
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const countrySlug =
      typeof body.countrySlug === "string" && body.countrySlug.trim()
        ? body.countrySlug.trim()
        : "india";

    const categoryCityLimit =
      typeof body.categoryCityLimit === "number" && body.categoryCityLimit > 0
        ? Math.min(body.categoryCityLimit, 2000)
        : 500;

    const longtailLimit =
      typeof body.longtailLimit === "number" && body.longtailLimit > 0
        ? Math.min(body.longtailLimit, 2000)
        : 500;

    const types: SeoPageType[] | undefined =
      Array.isArray(body.types) &&
      body.types.every((t: unknown) => typeof t === "string" && VALID_TYPES.includes(t as SeoPageType))
        ? (body.types as SeoPageType[])
        : undefined;

    const result = await generateAllMissingSeoPages({
      countrySlug,
      categoryCityLimit,
      longtailLimit,
      types,
    });

    return NextResponse.json({
      success: true,
      engine: getSeoEngineInfo(),
      generated: result.generated,
      skipped: result.skipped,
      failed: result.failed,
      total: result.total,
      breakdown: result.breakdown,
      message: `Generated ${result.generated} new page(s), skipped ${result.skipped} existing`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/generate-missing" });
    return NextResponse.json(
      { error: "Failed to generate missing SEO pages" },
      { status: 500 },
    );
  }
}

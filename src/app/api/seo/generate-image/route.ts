import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import {
  generateMissingSeoImages,
  generateSeoPageImage,
  runSeoGeneration,
  type SeoPageType,
} from "@/lib/seo-page-service";
import { logError } from "@/lib/monitoring";

const VALID_TYPES: SeoPageType[] = [
  "city",
  "category",
  "category_city",
  "state",
  "country",
  "longtail",
];

/**
 * POST /api/seo/generate-image
 * Generate featured images for SEO pages (single, missing, or by type).
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    if (body.pageId) {
      const image = await generateSeoPageImage(String(body.pageId));
      if (!image) {
        return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        updated: 1,
        featuredImage: image.featuredImage,
        imageAlt: image.imageAlt,
      });
    }

    if (body.regenerateContent && body.type && VALID_TYPES.includes(body.type)) {
      await runSeoGeneration(body.type as SeoPageType, {
        limit: body.limit,
        countrySlug: body.countrySlug || "india",
      });
    }

    const pageType = body.type && VALID_TYPES.includes(body.type)
      ? (body.type as SeoPageType)
      : undefined;

    const result = await generateMissingSeoImages({
      pageType,
      limit: typeof body.limit === "number" ? body.limit : 100,
    });

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: `Generated SEO images for ${result.updated} page(s)`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/generate-image" });
    return NextResponse.json(
      { error: "Failed to generate SEO images" },
      { status: 500 },
    );
  }
}

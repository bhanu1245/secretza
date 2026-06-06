import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { serializeSeoPageForApi } from "@/lib/seo-helpers";
import { validateUserContent } from "@/lib/content-filter";
import {
  enrichSchemaWithFeaturedImage,
  resolveSeoImageUrl,
} from "@/lib/seo-images";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/seo/pages/[id]
 * Get single SEO page with FAQs
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const page = await db.seoPage.findUnique({
      where: { id },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
    }

    return NextResponse.json({
      page: {
        ...serializeSeoPageForApi(page),
        faqs: page.faqs.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          sortOrder: f.sortOrder,
          isActive: f.isActive,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages/[id]" });
    return NextResponse.json(
      { error: "Failed to fetch SEO page" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/seo/pages/[id]
 * Update SEO page metadata — admin only
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      metaDescription,
      h1,
      introContent,
      canonicalUrl,
      noindex,
      isPublished,
      customData,
      featuredImage,
      imageAlt,
      imageTitle,
      imageCaption,
    } = body as {
      title?: string | null;
      metaDescription?: string | null;
      h1?: string | null;
      introContent?: string | null;
      canonicalUrl?: string | null;
      noindex?: boolean;
      isPublished?: boolean;
      customData?: string | null;
      featuredImage?: string | null;
      imageAlt?: string | null;
      imageTitle?: string | null;
      imageCaption?: string | null;
    };

    const existing = await db.seoPage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
    }

    // Block contact-detail leakage in admin-editable free-text SEO fields.
    // URL-bearing fields (canonicalUrl, featuredImage, customData) are excluded
    // by design since they legitimately contain links.
    const contentError = validateUserContent([
      { field: "title", label: "Title", value: title },
      { field: "h1", label: "H1", value: h1 },
      { field: "metaDescription", label: "Meta description", value: metaDescription },
      { field: "introContent", label: "Intro content", value: introContent },
    ]);
    if (contentError) {
      return NextResponse.json(
        { error: contentError.message, field: contentError.field },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (h1 !== undefined) updateData.h1 = h1;
    if (introContent !== undefined) updateData.introContent = introContent;
    if (canonicalUrl !== undefined) updateData.canonicalUrl = canonicalUrl;
    if (noindex !== undefined) updateData.noindex = noindex;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (featuredImage !== undefined) updateData.featuredImage = featuredImage;
    if (imageAlt !== undefined) updateData.imageAlt = imageAlt;
    if (imageTitle !== undefined) updateData.imageTitle = imageTitle;
    if (imageCaption !== undefined) updateData.imageCaption = imageCaption;

    if (customData !== undefined) {
      updateData.customData = customData;
    } else if (featuredImage !== undefined && featuredImage) {
      const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com";
      const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${canonicalUrl ?? existing.canonicalUrl ?? ""}`;
      const absoluteImage = resolveSeoImageUrl(featuredImage, siteOrigin);
      updateData.customData = enrichSchemaWithFeaturedImage(
        existing.customData,
        absoluteImage,
        imageAlt ?? existing.imageAlt ?? existing.title ?? existing.pageSlug,
        pageUrl,
      );
    }

    const updatedPage = await db.seoPage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      page: serializeSeoPageForApi(updatedPage),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages/[id]" });
    return NextResponse.json(
      { error: "Failed to update SEO page" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/seo/pages/[id]
 * Delete SEO page (cascades to FAQs) — admin only
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.seoPage.findUnique({
      where: { id },
      include: { _count: { select: { faqs: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
    }

    await db.seoPage.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `SEO page deleted along with ${existing._count.faqs} FAQ(s)`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages/[id]" });
    return NextResponse.json(
      { error: "Failed to delete SEO page" },
      { status: 500 },
    );
  }
}

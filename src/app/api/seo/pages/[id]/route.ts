import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";

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
        id: page.id,
        pageType: page.pageType,
        pageSlug: page.pageSlug,
        title: page.title,
        metaDescription: page.metaDescription,
        h1: page.h1,
        introContent: page.introContent,
        canonicalUrl: page.canonicalUrl,
        noindex: page.noindex,
        isPublished: page.isPublished,
        customData: page.customData,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
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
      { status: 500 }
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
    } = body as {
      title?: string | null;
      metaDescription?: string | null;
      h1?: string | null;
      introContent?: string | null;
      canonicalUrl?: string | null;
      noindex?: boolean;
      isPublished?: boolean;
      customData?: string | null;
    };

    // Check page exists
    const existing = await db.seoPage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (h1 !== undefined) updateData.h1 = h1;
    if (introContent !== undefined) updateData.introContent = introContent;
    if (canonicalUrl !== undefined) updateData.canonicalUrl = canonicalUrl;
    if (noindex !== undefined) updateData.noindex = noindex;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (customData !== undefined) updateData.customData = customData;

    const updatedPage = await db.seoPage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      page: {
        id: updatedPage.id,
        pageType: updatedPage.pageType,
        pageSlug: updatedPage.pageSlug,
        title: updatedPage.title,
        metaDescription: updatedPage.metaDescription,
        h1: updatedPage.h1,
        introContent: updatedPage.introContent,
        canonicalUrl: updatedPage.canonicalUrl,
        noindex: updatedPage.noindex,
        isPublished: updatedPage.isPublished,
        customData: updatedPage.customData,
        createdAt: updatedPage.createdAt.toISOString(),
        updatedAt: updatedPage.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages/[id]" });
    return NextResponse.json(
      { error: "Failed to update SEO page" },
      { status: 500 }
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

    // Check page exists
    const existing = await db.seoPage.findUnique({
      where: { id },
      include: { _count: { select: { faqs: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
    }

    // Delete page (cascades to FAQs via onDelete: Cascade)
    await db.seoPage.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `SEO page deleted along with ${existing._count.faqs} FAQ(s)`,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages/[id]" });
    return NextResponse.json(
      { error: "Failed to delete SEO page" },
      { status: 500 }
    );
  }
}

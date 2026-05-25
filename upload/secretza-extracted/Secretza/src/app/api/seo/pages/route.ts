import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";

/**
 * GET /api/seo/pages
 * List SEO pages with pagination, filtering by pageType, search
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get("pageType") || undefined;
    const search = searchParams.get("search") || undefined;
    const isPublished = searchParams.get("isPublished");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: Prisma.SeoPageWhereInput = {};

    if (pageType) {
      where.pageType = pageType;
    }

    if (isPublished !== null && isPublished !== undefined && isPublished !== "") {
      where.isPublished = isPublished === "true";
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { metaDescription: { contains: search } },
        { pageSlug: { contains: search } },
        { h1: { contains: search } },
      ];
    }

    const [pages, total] = await Promise.all([
      db.seoPage.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { faqs: true },
          },
        },
      }),
      db.seoPage.count({ where }),
    ]);

    return NextResponse.json({
      pages: pages.map((p) => ({
        id: p.id,
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        title: p.title,
        metaDescription: p.metaDescription,
        h1: p.h1,
        canonicalUrl: p.canonicalUrl,
        noindex: p.noindex,
        isPublished: p.isPublished,
        faqCount: p._count.faqs,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("SEO pages list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SEO pages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seo/pages
 * Create or update (upsert) SEO page metadata — admin only
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      pageType,
      pageSlug,
      title,
      metaDescription,
      h1,
      introContent,
      canonicalUrl,
      noindex,
      isPublished,
      customData,
    } = body as {
      pageType: string;
      pageSlug: string;
      title?: string | null;
      metaDescription?: string | null;
      h1?: string | null;
      introContent?: string | null;
      canonicalUrl?: string | null;
      noindex?: boolean;
      isPublished?: boolean;
      customData?: string | null;
    };

    if (!pageType || !pageSlug) {
      return NextResponse.json(
        { error: "pageType and pageSlug are required" },
        { status: 400 }
      );
    }

    const validPageTypes = [
      "city",
      "category",
      "category_city",
      "state",
      "country",
      "longtail",
    ];

    if (!validPageTypes.includes(pageType)) {
      return NextResponse.json(
        { error: `Invalid pageType. Must be one of: ${validPageTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const seoPage = await db.seoPage.upsert({
      where: {
        pageType_pageSlug: { pageType, pageSlug },
      },
      create: {
        pageType,
        pageSlug,
        title: title || null,
        metaDescription: metaDescription || null,
        h1: h1 || null,
        introContent: introContent || null,
        canonicalUrl: canonicalUrl || null,
        noindex: noindex ?? false,
        isPublished: isPublished ?? true,
        customData: customData || null,
      },
      update: {
        title: title !== undefined ? title : undefined,
        metaDescription: metaDescription !== undefined ? metaDescription : undefined,
        h1: h1 !== undefined ? h1 : undefined,
        introContent: introContent !== undefined ? introContent : undefined,
        canonicalUrl: canonicalUrl !== undefined ? canonicalUrl : undefined,
        noindex: noindex !== undefined ? noindex : undefined,
        isPublished: isPublished !== undefined ? isPublished : undefined,
        customData: customData !== undefined ? customData : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      page: {
        id: seoPage.id,
        pageType: seoPage.pageType,
        pageSlug: seoPage.pageSlug,
        title: seoPage.title,
        metaDescription: seoPage.metaDescription,
        h1: seoPage.h1,
        introContent: seoPage.introContent,
        canonicalUrl: seoPage.canonicalUrl,
        noindex: seoPage.noindex,
        isPublished: seoPage.isPublished,
        customData: seoPage.customData,
        createdAt: seoPage.createdAt.toISOString(),
        updatedAt: seoPage.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("SEO page create/update error:", error);
    return NextResponse.json(
      { error: "Failed to create/update SEO page" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";
import { serializeSeoPageForApi } from "@/lib/seo-helpers";
import {
  generateAndStoreSeoImage,
  enrichSchemaWithFeaturedImage,
  resolveSeoImageUrl,
} from "@/lib/seo-images";

/**
 * GET /api/seo/pages
 * List SEO pages with pagination, filtering by pageType, search
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get("pageType") || undefined;
    const pageSlug = searchParams.get("pageSlug") || undefined;
    const search = searchParams.get("search") || undefined;
    const isPublished = searchParams.get("isPublished");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: Prisma.SeoPageWhereInput = {};

    if (pageType) {
      where.pageType = pageType;
    }

    if (pageSlug) {
      where.pageSlug = pageSlug;
    }

    if (isPublished !== null && isPublished !== undefined && isPublished !== "") {
      where.isPublished = isPublished === "true";
    }

    if (search && !pageSlug) {
      where.OR = [
        { title: { contains: search } },
        { metaDescription: { contains: search } },
        { pageSlug: { contains: search } },
        { h1: { contains: search } },
        { imageAlt: { contains: search } },
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
      pages: pages.map((p) =>
        serializeSeoPageForApi({
          ...p,
          faqCount: p._count.faqs,
        }),
      ),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages" });
    return NextResponse.json(
      { error: "Failed to fetch SEO pages" },
      { status: 500 },
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
      featuredImage,
      imageAlt,
      imageTitle,
      imageCaption,
      autoGenerateImage,
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
      featuredImage?: string | null;
      imageAlt?: string | null;
      imageTitle?: string | null;
      imageCaption?: string | null;
      autoGenerateImage?: boolean;
    };

    if (!pageType || !pageSlug) {
      return NextResponse.json(
        { error: "pageType and pageSlug are required" },
        { status: 400 },
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
        { status: 400 },
      );
    }

    let resolvedImage = featuredImage ?? null;
    let resolvedAlt = imageAlt ?? null;
    let resolvedTitle = imageTitle ?? null;
    let resolvedCaption = imageCaption ?? null;
    let resolvedCustomData = customData ?? null;

    if (!resolvedImage && autoGenerateImage !== false) {
      const generated = await generateAndStoreSeoImage({
        pageType,
        pageSlug,
        headline: h1 || title || pageSlug,
        subtitle: metaDescription || undefined,
      });
      resolvedImage = generated.featuredImage ?? null;
      resolvedAlt = resolvedAlt || generated.imageAlt || null;
      resolvedTitle = resolvedTitle || generated.imageTitle || null;
      resolvedCaption = resolvedCaption || generated.imageCaption || null;

      if (canonicalUrl) {
        const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
        const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${canonicalUrl}`;
        const absoluteImage = resolveSeoImageUrl(resolvedImage, siteOrigin);
        resolvedCustomData = enrichSchemaWithFeaturedImage(
          resolvedCustomData,
          absoluteImage,
          resolvedAlt || h1 || title || pageSlug,
          pageUrl,
        );
      }
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
        featuredImage: resolvedImage,
        imageAlt: resolvedAlt,
        imageTitle: resolvedTitle,
        imageCaption: resolvedCaption,
        noindex: noindex ?? false,
        isPublished: isPublished ?? true,
        customData: resolvedCustomData,
      },
      update: {
        title: title !== undefined ? title : undefined,
        metaDescription: metaDescription !== undefined ? metaDescription : undefined,
        h1: h1 !== undefined ? h1 : undefined,
        introContent: introContent !== undefined ? introContent : undefined,
        canonicalUrl: canonicalUrl !== undefined ? canonicalUrl : undefined,
        featuredImage: featuredImage !== undefined ? featuredImage : undefined,
        imageAlt: imageAlt !== undefined ? imageAlt : undefined,
        imageTitle: imageTitle !== undefined ? imageTitle : undefined,
        imageCaption: imageCaption !== undefined ? imageCaption : undefined,
        noindex: noindex !== undefined ? noindex : undefined,
        isPublished: isPublished !== undefined ? isPublished : undefined,
        customData: customData !== undefined ? customData : resolvedCustomData,
      },
    });

    return NextResponse.json({
      success: true,
      page: serializeSeoPageForApi(seoPage),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/pages" });
    return NextResponse.json(
      { error: "Failed to create/update SEO page" },
      { status: 500 },
    );
  }
}

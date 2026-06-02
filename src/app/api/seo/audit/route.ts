import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";
import { serializeSeoPageForApi } from "@/lib/seo-helpers";
import { SEO_MIN_WORD_COUNT } from "@/lib/seo-quality";

/**
 * GET /api/seo/audit
 * Paginated SEO audit data with quality scores and duplicate risk.
 */
export async function GET(request: Request) {
  try {
    await requireMinRole("moderator");

    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get("pageType") || undefined;
    const duplicateRisk = searchParams.get("duplicateRisk") || undefined;
    const minQuality = searchParams.get("minQuality");
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: Prisma.SeoPageWhereInput = {};

    if (pageType) where.pageType = pageType;
    if (duplicateRisk) where.duplicateRisk = duplicateRisk;
    if (minQuality) {
      where.seoQualityScore = { gte: parseFloat(minQuality) };
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { pageSlug: { contains: search } },
        { h1: { contains: search } },
      ];
    }

    const [pages, total, aggregates] = await Promise.all([
      db.seoPage.findMany({
        where,
        orderBy: [{ duplicateRisk: "desc" }, { seoQualityScore: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { faqs: true } },
        },
      }),
      db.seoPage.count({ where }),
      db.seoPage.groupBy({
        by: ["duplicateRisk"],
        _count: { _all: true },
      }),
    ]);

    const summary = {
      totalPages: await db.seoPage.count(),
      lowRisk: aggregates.find((a) => a.duplicateRisk === "low")?._count._all ?? 0,
      mediumRisk: aggregates.find((a) => a.duplicateRisk === "medium")?._count._all ?? 0,
      highRisk: aggregates.find((a) => a.duplicateRisk === "high")?._count._all ?? 0,
      belowMinWords: await db.seoPage.count({
        where: { OR: [{ wordCount: { lt: SEO_MIN_WORD_COUNT } }, { wordCount: null }] },
      }),
      avgQuality: await db.seoPage.aggregate({ _avg: { seoQualityScore: true } }),
      minWordCount: SEO_MIN_WORD_COUNT,
    };

    return NextResponse.json({
      pages: pages.map((p) =>
        serializeSeoPageForApi({
          ...p,
          faqCount: p.faqCount ?? p._count.faqs,
        }),
      ),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/audit" });
    return NextResponse.json({ error: "Failed to fetch SEO audit data" }, { status: 500 });
  }
}

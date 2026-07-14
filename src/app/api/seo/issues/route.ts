import { NextRequest, NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";
import { SEO_MIN_WORD_COUNT } from "@/lib/seo-quality";
import {
  MIN_INTERNAL_LINKS_PER_PAGE,
  scanPagesWithBrokenInternalLinks,
} from "@/lib/seo-internal-links";
import { listUnroutableSeoPageIds } from "@/lib/seo-route-validation";

const MIN_INTERNAL_LINKS = MIN_INTERNAL_LINKS_PER_PAGE;

export async function GET(request: NextRequest) {
  try {
    const admin = await requireMinRole("moderator");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const issueType = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const search = searchParams.get("search");
    const pageType = searchParams.get("pageType");
    const isPublished = searchParams.get("isPublished");
    const indexed = searchParams.get("indexed");
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");
    const sortField = searchParams.get("sortField") || "updatedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    if (!issueType) {
      return NextResponse.json({ error: "Missing issue type" }, { status: 400 });
    }

    const unroutable = await listUnroutableSeoPageIds();
    const routableExclusion =
      unroutable.size > 0 ? { id: { notIn: [...unroutable] } } : {};

    let where: Prisma.SeoPageWhereInput = { ...routableExclusion };
    let isRawQuery = false;
    let rawQueryField = "";
    
    // Base filters
    if (pageType) where.pageType = pageType;
    if (isPublished === "true") where.isPublished = true;
    if (isPublished === "false") where.isPublished = false;
    if (indexed === "true") where.noindex = false;
    if (indexed === "false") where.noindex = true;
    
    if (minScore || maxScore) {
      where.seoQualityScore = {};
      if (minScore) where.seoQualityScore.gte = Number(minScore);
      if (maxScore) where.seoQualityScore.lte = Number(maxScore);
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { pageSlug: { contains: search } },
      ];
    }
    
    switch (issueType) {
      case "missing_title":
        where = { ...where, AND: [{ OR: [{ title: null }, { title: "" }] }] };
        break;
      case "missing_meta":
        where = { ...where, AND: [{ OR: [{ metaDescription: null }, { metaDescription: "" }] }] };
        break;
      case "missing_h1":
        where = { ...where, AND: [{ OR: [{ h1: null }, { h1: "" }] }] };
        break;
      case "missing_canonical":
        where = { ...where, AND: [{ OR: [{ canonicalUrl: null }, { canonicalUrl: "" }] }] };
        break;
      case "missing_schema":
        where = {
          ...where,
          AND: [
            {
              OR: [
                { customData: null },
                { customData: "" },
                { NOT: { customData: { contains: '"@type"' } } },
              ],
            }
          ]
        };
        break;
      case "missing_image":
        where = { ...where, AND: [{ OR: [{ featuredImage: null }, { featuredImage: "" }] }] };
        break;
      case "thin_content":
        where = { ...where, AND: [{ OR: [{ wordCount: { lt: SEO_MIN_WORD_COUNT } }, { wordCount: null }] }] };
        break;
      case "missing_internal_links":
        where = { ...where, AND: [{ OR: [{ internalLinksCount: null }, { internalLinksCount: { lt: MIN_INTERNAL_LINKS } }] }] };
        break;
      case "duplicate_titles":
        isRawQuery = true;
        rawQueryField = "title";
        break;
      case "duplicate_meta":
        isRawQuery = true;
        rawQueryField = "metaDescription";
        break;
      case "duplicate_h1":
        isRawQuery = true;
        rawQueryField = "h1";
        break;
      case "duplicate_content":
        isRawQuery = true;
        rawQueryField = "contentHash";
        break;
      case "broken_internal_links":
        break;
      default:
        return NextResponse.json({ error: "Invalid issue type" }, { status: 400 });
    }

    let pages: any[] = [];
    let total = 0;

    if (issueType === "broken_internal_links") {
      const affected = await scanPagesWithBrokenInternalLinks({
        search: search ?? undefined,
        pageType: pageType ?? undefined,
        isPublished:
          isPublished === "true" ? true : isPublished === "false" ? false : undefined,
      });
      total = affected.length;
      const slice = affected.slice(skip, skip + limit);
      pages = slice.map((p) => ({
        id: p.id,
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        title: p.title,
        metaDescription: p.metaDescription,
        h1: p.h1,
        canonicalUrl: p.canonicalUrl,
        wordCount: p.wordCount,
        internalLinksCount: p.internalLinksCount,
        seoQualityScore: p.seoQualityScore,
        updatedAt: p.updatedAt,
        duplicateRisk: p.duplicateRisk,
        isPublished: p.isPublished,
        brokenLinks: p.brokenLinks,
        brokenLinkCount: p.brokenLinks.length,
      }));
    } else if (isRawQuery) {
      // rawQueryField is set only from a switch statement to one of 4 known column names —
      // whitelisted, not user input, safe for Prisma.raw().
      const col = Prisma.raw(rawQueryField);

      const sqlConditions: Prisma.Sql[] = [
        Prisma.sql`${col} IS NOT NULL AND TRIM(${col}) != ''`,
      ];

      if (pageType) sqlConditions.push(Prisma.sql`pageType = ${pageType}`);
      if (isPublished === "true") sqlConditions.push(Prisma.sql`isPublished = ${1}`);
      if (isPublished === "false") sqlConditions.push(Prisma.sql`isPublished = ${0}`);
      if (indexed === "true") sqlConditions.push(Prisma.sql`noindex = ${0}`);
      if (indexed === "false") sqlConditions.push(Prisma.sql`noindex = ${1}`);
      if (minScore) sqlConditions.push(Prisma.sql`seoQualityScore >= ${Number(minScore)}`);
      if (maxScore) sqlConditions.push(Prisma.sql`seoQualityScore <= ${Number(maxScore)}`);
      if (search) sqlConditions.push(Prisma.sql`(title LIKE ${'%' + search + '%'} OR pageSlug LIKE ${'%' + search + '%'})`);

      const whereConditions = Prisma.join(sqlConditions, ' AND ');

      const rawCount = await db.$queryRaw<Array<{ cnt: bigint }>>(Prisma.sql`
        SELECT COUNT(*) as cnt FROM SeoPage p
        WHERE ${whereConditions}
        AND ${col} IN (
          SELECT ${col} FROM SeoPage
          WHERE ${col} IS NOT NULL AND TRIM(${col}) != ''
          GROUP BY ${col} HAVING COUNT(*) > 1
        )
      `);
      total = Number(rawCount[0]?.cnt ?? 0);

      const resolvedSortField = ["updatedAt", "seoQualityScore", "pageSlug", "duplicateValue"].includes(sortField) ? (sortField === "duplicateValue" ? rawQueryField : sortField) : "updatedAt";
      const safeSortCol = Prisma.raw(resolvedSortField);
      const safeOrder = Prisma.raw(sortOrder === "asc" ? "ASC" : "DESC");

      const rawPages = await db.$queryRaw<any[]>(Prisma.sql`
        SELECT id, pageType, pageSlug, title, metaDescription, h1, canonicalUrl, wordCount, internalLinksCount, seoQualityScore, updatedAt, duplicateRisk, isPublished, ${col} as duplicateValue
        FROM SeoPage p
        WHERE ${whereConditions}
        AND ${col} IN (
          SELECT ${col} FROM SeoPage
          WHERE ${col} IS NOT NULL AND TRIM(${col}) != ''
          GROUP BY ${col} HAVING COUNT(*) > 1
        )
        ORDER BY ${safeSortCol} ${safeOrder}, updatedAt DESC
        LIMIT ${limit} OFFSET ${skip}
      `);
      pages = rawPages;
    } else {
      const safeSortField = ["updatedAt", "seoQualityScore", "pageSlug"].includes(sortField) ? sortField : "updatedAt";
      
      const [fetchedPages, count] = await Promise.all([
        db.seoPage.findMany({
          where,
          select: {
            id: true,
            pageType: true,
            pageSlug: true,
            title: true,
            metaDescription: true,
            h1: true,
            canonicalUrl: true,
            wordCount: true,
            internalLinksCount: true,
            seoQualityScore: true,
            updatedAt: true,
            duplicateRisk: true,
            isPublished: true,
          },
          orderBy: { [safeSortField]: sortOrder },
          skip,
          take: limit,
        }),
        db.seoPage.count({ where }),
      ]);
      pages = fetchedPages;
      total = count;
    }

    return NextResponse.json({
      pages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      issueType,
    });
  } catch (error: unknown) {
    logError(error, { component: "route:api/seo/issues" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load SEO issues" },
      { status: 500 },
    );
  }
}

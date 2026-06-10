/**
 * Live SEO dashboard aggregates — no content loading, Prisma/SQL only.
 */
import { db } from "@/lib/db";
import { SEO_MIN_WORD_COUNT } from "@/lib/seo-quality";
import { getAllVerificationConfigs } from "@/lib/seo-verification";
import { generateSitemapStats } from "@/lib/seo-operations";
import { calculateReadabilityScore } from "@/lib/readability";

const MIN_INTERNAL_LINKS = 15;

export type SeoDashboardMetrics = Awaited<ReturnType<typeof loadSeoDashboardMetrics>>;

export async function loadSeoDashboardMetrics(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalPages,
    publishedPages,
    draftPages,
    noindexPages,
    aggregates,
    riskGroups,
    belowMinWords,
    missingMetaDescription,
    missingH1,
    missingCanonical,
    missingFeaturedImage,
    missingFaq,
    missingStructuredData,
    missingInternalLinks,
    wordLt500,
    word500to999,
    word1000to1499,
    word1500plus,
    score0to39,
    score40to59,
    score60to79,
    score80to100,
    duplicateTitleGroups,
    duplicateMetaGroups,
    duplicateH1Groups,
    pagesWithDuplicateTitle,
    pagesWithDuplicateMeta,
    pagesWithDuplicateH1,
    duplicateContentGroups,
    pagesWithDuplicateContent,
    highRiskPages,
    recentPages,
    recentRuns,
    regenItemStats,
    rollbackCount,
    totalRegeneratedPages,
    lastRegeneration,
    verificationConfigs,
    indexationSummary,
    crawlSummary,
    sitemapStats,
    crawlEvents,
    regenHistoryRows,
    recentReadabilitySample,
  ] = await Promise.all([
    db.seoPage.count(),
    db.seoPage.count({ where: { isPublished: true } }),
    db.seoPage.count({ where: { isPublished: false } }),
    db.seoPage.count({ where: { noindex: true } }),
    db.seoPage.aggregate({
      _avg: {
        seoQualityScore: true,
        uniquenessScore: true,
        wordCount: true,
        faqCount: true,
        internalLinksCount: true,
      },
    }),
    db.seoPage.groupBy({
      by: ["duplicateRisk"],
      _count: { _all: true },
    }),
    db.seoPage.count({
      where: { OR: [{ wordCount: { lt: SEO_MIN_WORD_COUNT } }, { wordCount: null }] },
    }),
    db.seoPage.count({
      where: { OR: [{ metaDescription: null }, { metaDescription: "" }] },
    }),
    db.seoPage.count({ where: { OR: [{ h1: null }, { h1: "" }] } }),
    db.seoPage.count({ where: { OR: [{ canonicalUrl: null }, { canonicalUrl: "" }] } }),
    db.seoPage.count({ where: { OR: [{ featuredImage: null }, { featuredImage: "" }] } }),
    db.seoPage.count({
      where: {
        AND: [
          { OR: [{ faqCount: null }, { faqCount: 0 }] },
          { faqs: { none: { isActive: true } } },
        ],
      },
    }),
    db.seoPage.count({
      where: {
        OR: [
          { customData: null },
          { customData: "" },
          { NOT: { customData: { contains: '"@type"' } } },
        ],
      },
    }),
    db.seoPage.count({
      where: {
        OR: [{ internalLinksCount: null }, { internalLinksCount: { lt: MIN_INTERNAL_LINKS } }],
      },
    }),
    db.seoPage.count({ where: { wordCount: { lt: 500 } } }),
    db.seoPage.count({ where: { wordCount: { gte: 500, lt: 1000 } } }),
    db.seoPage.count({ where: { wordCount: { gte: 1000, lt: 1500 } } }),
    db.seoPage.count({ where: { wordCount: { gte: 1500 } } }),
    db.seoPage.count({
      where: { OR: [{ seoQualityScore: null }, { seoQualityScore: { lt: 40 } }] },
    }),
    db.seoPage.count({ where: { seoQualityScore: { gte: 40, lt: 60 } } }),
    db.seoPage.count({ where: { seoQualityScore: { gte: 60, lt: 80 } } }),
    db.seoPage.count({ where: { seoQualityScore: { gte: 80 } } }),
    countDuplicateFieldGroups("title"),
    countDuplicateFieldGroups("metaDescription"),
    countDuplicateFieldGroups("h1"),
    countPagesInDuplicateField("title"),
    countPagesInDuplicateField("metaDescription"),
    countPagesInDuplicateField("h1"),
    countDuplicateContentHashGroups(),
    countPagesInDuplicateContentHash(),
    db.seoPage.findMany({
      where: { duplicateRisk: { in: ["high", "medium"] } },
      orderBy: [{ duplicateRisk: "desc" }, { seoQualityScore: "asc" }],
      take: 20,
      select: {
        pageSlug: true,
        pageType: true,
        duplicateRisk: true,
        seoQualityScore: true,
        canonicalUrl: true,
      },
    }),
    db.seoPage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        pageType: true,
        pageSlug: true,
        title: true,
        updatedAt: true,
        seoQualityScore: true,
        wordCount: true,
      },
    }),
    db.seoRegenerationRun.findMany({
      where: { dryRun: false, status: { in: ["completed", "dry_run_completed"] } },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        completedCount: true,
        failedCount: true,
        completedAt: true,
        createdAt: true,
        avgSeoScore: true,
        avgUniqueness: true,
      },
    }),
    db.seoRegenerationItem.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.seoContentVersion.count({ where: { rolledBackAt: { not: null } } }),
    db.seoRegenerationItem.count({
      where: { status: "completed", run: { dryRun: false } },
    }),
    db.seoRegenerationRun.findFirst({
      where: { dryRun: false, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    getAllVerificationConfigs(),
    loadIndexationSummary(),
    loadCrawlSummary(days),
    generateSitemapStats(),
    db.crawlEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    db.seoRegenerationRun.findMany({
      where: {
        dryRun: false,
        completedAt: { not: null },
        createdAt: { gte: since },
      },
      orderBy: { completedAt: "asc" },
      select: { completedAt: true, completedCount: true },
    }),
    db.seoPage.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: { introContent: true, customData: true },
    }),
  ]);

  const riskCount = (risk: string) =>
    riskGroups.find((r) => r.duplicateRisk === risk)?._count._all ?? 0;

  const lowRisk = riskCount("low");
  const mediumRisk = riskCount("medium");
  const highRisk = riskCount("high");
  const unscoredRisk = totalPages - lowRisk - mediumRisk - highRisk;

  const completedItems =
    regenItemStats.find((s) => s.status === "completed")?._count._all ?? 0;
  const failedItems =
    regenItemStats.find((s) => s.status === "failed")?._count._all ?? 0;
  const regenAttempted = completedItems + failedItems;
  const regenerationSuccessRate =
    regenAttempted > 0 ? Math.round((completedItems / regenAttempted) * 1000) / 10 : null;

  const avgSeoScore = aggregates._avg.seoQualityScore ?? 0;
  const healthScore = Math.round(Math.min(100, Math.max(0, avgSeoScore)));

  const recentActivity = [
    ...recentPages.map((p) => ({
      type: "seo_update" as const,
      message: `SEO page updated: ${p.pageType}/${p.pageSlug}`,
      timestamp: p.updatedAt.toISOString(),
    })),
    ...crawlEvents.slice(0, 10).map((event) => {
      let type = "crawl";
      let message = `Crawl: ${event.path}`;
      if (event.botName === "googlebot") {
        type = "googlebot";
        message = `Googlebot crawled ${event.path} (${event.statusCode})`;
      } else if (event.isBot) {
        type = "bot";
        message = `${event.botName || "Bot"} crawled ${event.path}`;
      } else if (event.statusCode >= 400) {
        type = "error";
        message = `Error ${event.statusCode} on ${event.path}`;
      }
      return { type, message, timestamp: event.createdAt.toISOString() };
    }),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  const verifications = [
    {
      name: "Google Search Console",
      configured: Boolean(verificationConfigs.google_site_verification?.value),
    },
    {
      name: "Bing Webmaster Tools",
      configured: Boolean(verificationConfigs.bing_site_verification?.value),
    },
    {
      name: "Yandex Webmaster",
      configured: Boolean(verificationConfigs.yandex_site_verification?.value),
    },
  ];

  let avgReadability = 0;
  if (recentReadabilitySample?.length > 0) {
    const scores = recentReadabilitySample.map(p => calculateReadabilityScore(p.introContent || p.customData)).filter(s => s > 0);
    if (scores.length > 0) {
      avgReadability = round1(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    healthScore,
    quality: {
      avgSeoScore: round1(aggregates._avg.seoQualityScore),
      avgUniqueness: round1(aggregates._avg.uniquenessScore),
      avgWordCount: round1(aggregates._avg.wordCount),
      avgFaqCount: round1(aggregates._avg.faqCount),
      avgInternalLinks: round1(aggregates._avg.internalLinksCount),
      avgReadability,
    },
    seoPages: {
      total: totalPages,
      published: publishedPages,
      drafts: draftPages,
      noindex: noindexPages,
    },
    risk: {
      low: lowRisk,
      medium: mediumRisk,
      high: highRisk,
      unscored: unscoredRisk,
    },
    contentIssues: {
      belowMinWords,
      missingMetaDescription,
      missingH1,
      missingCanonical,
      missingFeaturedImage,
      missingFaq,
      missingStructuredData,
      missingInternalLinks,
      minWordCount: SEO_MIN_WORD_COUNT,
      minInternalLinks: MIN_INTERNAL_LINKS,
    },
    duplicates: {
      titleGroups: duplicateTitleGroups,
      metaGroups: duplicateMetaGroups,
      h1Groups: duplicateH1Groups,
      pagesWithDuplicateTitle,
      pagesWithDuplicateMeta,
      pagesWithDuplicateH1,
      contentHashGroups: duplicateContentGroups,
      pagesWithDuplicateContent,
    },
    charts: {
      qualityDistribution: [
        { bucket: "0-39", count: score0to39 },
        { bucket: "40-59", count: score40to59 },
        { bucket: "60-79", count: score60to79 },
        { bucket: "80-100", count: score80to100 },
      ],
      duplicateRiskDistribution: [
        { bucket: "Low", count: lowRisk },
        { bucket: "Medium", count: mediumRisk },
        { bucket: "High", count: highRisk },
        ...(unscoredRisk > 0 ? [{ bucket: "Unscored", count: unscoredRisk }] : []),
      ],
      wordCountDistribution: [
        { bucket: "<500", count: wordLt500 },
        { bucket: "500-999", count: word500to999 },
        { bucket: "1000-1499", count: word1000to1499 },
        { bucket: "1500+", count: word1500plus },
      ],
      regenerationHistory: regenHistoryRows.map((r) => ({
        date: r.completedAt?.toISOString().slice(0, 10) ?? "",
        pages: r.completedCount,
      })),
    },
    regeneration: {
      totalRegeneratedPages,
      lastRegenerationDate: lastRegeneration?.completedAt?.toISOString() ?? null,
      successRate: regenerationSuccessRate,
      rollbackCount,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        status: r.status,
        completedCount: r.completedCount,
        failedCount: r.failedCount,
        completedAt: r.completedAt?.toISOString() ?? null,
        avgSeoScore: r.avgSeoScore,
        avgUniqueness: r.avgUniqueness,
      })),
    },
    duplicateRiskPages: highRiskPages.map((p) => ({
      slug: p.pageSlug,
      type: p.pageType,
      risk: p.duplicateRisk ?? "unknown",
      score: p.seoQualityScore ?? 0,
      canonical: p.canonicalUrl,
    })),
    recentlyUpdated: recentPages.map((p) => ({
      pageType: p.pageType,
      pageSlug: p.pageSlug,
      title: p.title,
      updatedAt: p.updatedAt.toISOString(),
      seoQualityScore: p.seoQualityScore,
      wordCount: p.wordCount,
    })),
    indexation: indexationSummary,
    crawl: crawlSummary,
    sitemap: {
      totalUrls: sitemapStats.totalUrls,
      chunks: sitemapStats.totalChunks,
      noindexExcluded: noindexPages,
      lastGenerated: sitemapStats.generatedAt,
      breakdown: sitemapStats.chunks.map((c) => ({ section: c.section, count: c.count })),
    },
    recentActivity,
    verifications,
    auditSummary: {
      totalPages,
      belowMinWords,
      avgQuality: round1(aggregates._avg.seoQualityScore),
      lowRisk,
      mediumRisk,
      highRisk,
    },
  };
}

function round1(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.round(n * 10) / 10;
}

async function loadIndexationSummary() {
  const [total, indexed, noindexed, lowConfidence] = await Promise.all([
    db.seoPage.count({ where: { isPublished: true } }),
    db.seoPage.count({ where: { isPublished: true, noindex: false } }),
    db.seoPage.count({ where: { noindex: true } }),
    db.seoPage.count({
      where: {
        isPublished: true,
        OR: [{ seoQualityScore: null }, { seoQualityScore: { lt: 40 } }],
      },
    }),
  ]);
  return { total, indexed, noindexed, lowConfidence };
}

async function loadCrawlSummary(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [totalCrawls, botCrawls, googlebotCrawls] = await Promise.all([
    db.crawlEvent.count({ where: { createdAt: { gte: since } } }),
    db.crawlEvent.count({ where: { isBot: true, createdAt: { gte: since } } }),
    db.crawlEvent.count({
      where: { isBot: true, botName: "googlebot", createdAt: { gte: since } },
    }),
  ]);
  return { totalCrawls, botCrawls, googlebotCrawls };
}

async function countDuplicateContentHashGroups(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM (
      SELECT contentHash FROM SeoPage
      WHERE contentHash IS NOT NULL AND TRIM(contentHash) != ''
      GROUP BY contentHash HAVING COUNT(*) > 1
    )`;
  return Number(rows[0]?.cnt ?? 0);
}

async function countPagesInDuplicateContentHash(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM SeoPage p
    WHERE contentHash IS NOT NULL AND TRIM(contentHash) != ''
    AND contentHash IN (
      SELECT contentHash FROM SeoPage
      WHERE contentHash IS NOT NULL AND TRIM(contentHash) != ''
      GROUP BY contentHash HAVING COUNT(*) > 1
    )`;
  return Number(rows[0]?.cnt ?? 0);
}

async function countDuplicateFieldGroups(field: "title" | "metaDescription" | "h1"): Promise<number> {
  if (field === "title") {
    const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) as cnt FROM (
        SELECT LOWER(TRIM(title)) as val FROM SeoPage
        WHERE title IS NOT NULL AND TRIM(title) != ''
        GROUP BY LOWER(TRIM(title)) HAVING COUNT(*) > 1
      )`;
    return Number(rows[0]?.cnt ?? 0);
  }
  if (field === "metaDescription") {
    const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) as cnt FROM (
        SELECT LOWER(TRIM(metaDescription)) as val FROM SeoPage
        WHERE metaDescription IS NOT NULL AND TRIM(metaDescription) != ''
        GROUP BY LOWER(TRIM(metaDescription)) HAVING COUNT(*) > 1
      )`;
    return Number(rows[0]?.cnt ?? 0);
  }
  const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM (
      SELECT LOWER(TRIM(h1)) as val FROM SeoPage
      WHERE h1 IS NOT NULL AND TRIM(h1) != ''
      GROUP BY LOWER(TRIM(h1)) HAVING COUNT(*) > 1
    )`;
  return Number(rows[0]?.cnt ?? 0);
}

async function countPagesInDuplicateField(
  field: "title" | "metaDescription" | "h1",
): Promise<number> {
  if (field === "title") {
    const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) as cnt FROM SeoPage p
      WHERE title IS NOT NULL AND TRIM(title) != ''
      AND LOWER(TRIM(title)) IN (
        SELECT LOWER(TRIM(title)) FROM SeoPage
        WHERE title IS NOT NULL AND TRIM(title) != ''
        GROUP BY LOWER(TRIM(title)) HAVING COUNT(*) > 1
      )`;
    return Number(rows[0]?.cnt ?? 0);
  }
  if (field === "metaDescription") {
    const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) as cnt FROM SeoPage p
      WHERE metaDescription IS NOT NULL AND TRIM(metaDescription) != ''
      AND LOWER(TRIM(metaDescription)) IN (
        SELECT LOWER(TRIM(metaDescription)) FROM SeoPage
        WHERE metaDescription IS NOT NULL AND TRIM(metaDescription) != ''
        GROUP BY LOWER(TRIM(metaDescription)) HAVING COUNT(*) > 1
      )`;
    return Number(rows[0]?.cnt ?? 0);
  }
  const rows = await db.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM SeoPage p
    WHERE h1 IS NOT NULL AND TRIM(h1) != ''
    AND LOWER(TRIM(h1)) IN (
      SELECT LOWER(TRIM(h1)) FROM SeoPage
      WHERE h1 IS NOT NULL AND TRIM(h1) != ''
      GROUP BY LOWER(TRIM(h1)) HAVING COUNT(*) > 1
    )`;
  return Number(rows[0]?.cnt ?? 0);
}

/**
 * Live SEO dashboard aggregates — no content loading, Prisma/SQL only.
 */
import { db } from "@/lib/db";
import { SEO_MIN_WORD_COUNT } from "@/lib/seo-quality";
import { getAllVerificationConfigs } from "@/lib/seo-verification";
import { generateSitemapStats } from "@/lib/seo-operations";
import { calculateReadabilityScore } from "@/lib/readability";
import { MIN_INTERNAL_LINKS_PER_PAGE } from "@/lib/seo-internal-links";
import { listUnroutableSeoPageIds } from "@/lib/seo-route-validation";
import { buildHealthScoreBreakdown } from "@/lib/seo-health-score";

const MIN_INTERNAL_LINKS = MIN_INTERNAL_LINKS_PER_PAGE;
const SLOW_QUERY_MS = 500;

async function timedQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await fn();
  const elapsed = Date.now() - started;
  if (elapsed > SLOW_QUERY_MS) {
    console.warn(`SEO_DASHBOARD_SLOW_QUERY ${label} ${elapsed}ms`);
  }
  return result;
}

export type SeoDashboardMetrics = Awaited<ReturnType<typeof loadSeoDashboardMetrics>>;

export async function loadSeoDashboardMetrics(days = 30) {
  const loadStarted = Date.now();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const unroutableIds = await timedQuery("listUnroutableSeoPageIds", () =>
    listUnroutableSeoPageIds(),
  );
  const routableFilter =
    unroutableIds.size > 0 ? { id: { notIn: [...unroutableIds] } } : {};
  const rf = <T extends Record<string, unknown>>(where: T = {} as T) =>
    ({ ...where, ...routableFilter }) as T & typeof routableFilter;

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
    timedQuery("seoPage.count.total", () => db.seoPage.count({ where: routableFilter })),
    timedQuery("seoPage.count.published", () =>
      db.seoPage.count({ where: { ...routableFilter, isPublished: true } }),
    ),
    timedQuery("seoPage.count.drafts", () =>
      db.seoPage.count({ where: { ...routableFilter, isPublished: false } }),
    ),
    timedQuery("seoPage.count.noindex", () =>
      db.seoPage.count({ where: { ...routableFilter, noindex: true } }),
    ),
    timedQuery("seoPage.aggregate", () => db.seoPage.aggregate({
      where: routableFilter,
      _avg: {
        seoQualityScore: true,
        uniquenessScore: true,
        wordCount: true,
        faqCount: true,
        internalLinksCount: true,
      },
    })),
    timedQuery("seoPage.groupBy.duplicateRisk", () => db.seoPage.groupBy({
      by: ["duplicateRisk"],
      where: routableFilter,
      _count: { _all: true },
    })),
    timedQuery("seoPage.count.belowMinWords", () => db.seoPage.count({
      where: rf({ OR: [{ wordCount: { lt: SEO_MIN_WORD_COUNT } }, { wordCount: null }] }),
    })),
    timedQuery("seoPage.count.missingMeta", () => db.seoPage.count({
      where: rf({ OR: [{ metaDescription: null }, { metaDescription: "" }] }),
    })),
    timedQuery("seoPage.count.missingH1", () =>
      db.seoPage.count({ where: rf({ OR: [{ h1: null }, { h1: "" }] }) }),
    ),
    timedQuery("seoPage.count.missingCanonical", () =>
      db.seoPage.count({ where: rf({ OR: [{ canonicalUrl: null }, { canonicalUrl: "" }] }) }),
    ),
    timedQuery("seoPage.count.missingImage", () =>
      db.seoPage.count({ where: rf({ OR: [{ featuredImage: null }, { featuredImage: "" }] }) }),
    ),
    timedQuery("seoPage.count.missingFaq", () => db.seoPage.count({
      where: rf({
        AND: [
          { OR: [{ faqCount: null }, { faqCount: 0 }] },
          { faqs: { none: { isActive: true } } },
        ],
      }),
    })),
    timedQuery("seoPage.count.missingSchema", () => db.seoPage.count({
      where: rf({
        OR: [
          { customData: null },
          { customData: "" },
          { NOT: { customData: { contains: '"@type"' } } },
        ],
      }),
    })),
    timedQuery("seoPage.count.missingInternalLinks", () => db.seoPage.count({
      where: rf({
        OR: [{ internalLinksCount: null }, { internalLinksCount: { lt: MIN_INTERNAL_LINKS } }],
      }),
    })),
    timedQuery("seoPage.count.wordLt500", () =>
      db.seoPage.count({ where: rf({ wordCount: { lt: 500 } }) }),
    ),
    timedQuery("seoPage.count.word500to999", () =>
      db.seoPage.count({ where: rf({ wordCount: { gte: 500, lt: 1000 } }) }),
    ),
    timedQuery("seoPage.count.word1000to1499", () =>
      db.seoPage.count({ where: rf({ wordCount: { gte: 1000, lt: 1500 } }) }),
    ),
    timedQuery("seoPage.count.word1500plus", () =>
      db.seoPage.count({ where: rf({ wordCount: { gte: 1500 } }) }),
    ),
    timedQuery("seoPage.count.score0to39", () => db.seoPage.count({
      where: rf({ OR: [{ seoQualityScore: null }, { seoQualityScore: { lt: 40 } }] }),
    })),
    timedQuery("seoPage.count.score40to59", () =>
      db.seoPage.count({ where: rf({ seoQualityScore: { gte: 40, lt: 60 } }) }),
    ),
    timedQuery("seoPage.count.score60to79", () =>
      db.seoPage.count({ where: rf({ seoQualityScore: { gte: 60, lt: 80 } }) }),
    ),
    timedQuery("seoPage.count.score80to100", () =>
      db.seoPage.count({ where: rf({ seoQualityScore: { gte: 80 } }) }),
    ),
    timedQuery("duplicateTitleGroups", () => countDuplicateFieldGroups("title")),
    timedQuery("duplicateMetaGroups", () => countDuplicateFieldGroups("metaDescription")),
    timedQuery("duplicateH1Groups", () => countDuplicateFieldGroups("h1")),
    timedQuery("pagesWithDuplicateTitle", () => countPagesInDuplicateField("title")),
    timedQuery("pagesWithDuplicateMeta", () => countPagesInDuplicateField("metaDescription")),
    timedQuery("pagesWithDuplicateH1", () => countPagesInDuplicateField("h1")),
    timedQuery("duplicateContentHashGroups", () => countDuplicateContentHashGroups()),
    timedQuery("pagesWithDuplicateContent", () => countPagesInDuplicateContentHash()),
    timedQuery("seoPage.findMany.highRisk", () => db.seoPage.findMany({
      where: rf({ duplicateRisk: { in: ["high", "medium"] } }),
      orderBy: [{ duplicateRisk: "desc" }, { seoQualityScore: "asc" }],
      take: 20,
      select: {
        pageSlug: true,
        pageType: true,
        duplicateRisk: true,
        seoQualityScore: true,
        canonicalUrl: true,
      },
    })),
    timedQuery("seoPage.findMany.recent", () => db.seoPage.findMany({
      where: routableFilter,
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
    })),
    timedQuery("seoRegenerationRun.findMany.recent", () => db.seoRegenerationRun.findMany({
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
    })),
    timedQuery("seoRegenerationItem.groupBy", () => db.seoRegenerationItem.groupBy({
      by: ["status"],
      _count: { _all: true },
    })),
    timedQuery("seoContentVersion.count.rollback", () =>
      db.seoContentVersion.count({ where: { rolledBackAt: { not: null } } }),
    ),
    timedQuery("seoRegenerationItem.count.completed", () =>
      db.seoRegenerationItem.count({
        where: { status: "completed", run: { dryRun: false } },
      }),
    ),
    timedQuery("seoRegenerationRun.findFirst.last", () => db.seoRegenerationRun.findFirst({
      where: { dryRun: false, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    })),
    timedQuery("getAllVerificationConfigs", () => getAllVerificationConfigs()),
    timedQuery("loadIndexationSummary", () => loadIndexationSummary()),
    timedQuery("loadCrawlSummary", () => loadCrawlSummary(days)),
    timedQuery("generateSitemapStats", () => generateSitemapStats()),
    timedQuery("crawlEvent.findMany", () => db.crawlEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 15,
    })),
    timedQuery("seoRegenerationRun.findMany.history", () => db.seoRegenerationRun.findMany({
      where: {
        dryRun: false,
        completedAt: { not: null },
        createdAt: { gte: since },
      },
      orderBy: { completedAt: "asc" },
      select: { completedAt: true, completedCount: true },
    })),
    timedQuery("seoPage.findMany.readabilitySample", () => db.seoPage.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: { introContent: true, customData: true },
    })),
  ]);

  // Broken links are validated on demand via Issues drill-down — not scanned on dashboard load.
  const brokenInternalLinks = 0;

  const loadElapsed = Date.now() - loadStarted;
  if (loadElapsed > SLOW_QUERY_MS) {
    console.warn(`SEO_DASHBOARD_SLOW_LOAD total ${loadElapsed}ms`);
  }

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
  const healthBreakdown = buildHealthScoreBreakdown({
    totalPages,
    contentIssues: {
      belowMinWords,
      missingMetaDescription,
      missingH1,
      missingCanonical,
      missingFeaturedImage,
      missingStructuredData,
      missingInternalLinks,
      brokenInternalLinks,
      minWordCount: SEO_MIN_WORD_COUNT,
      minInternalLinks: MIN_INTERNAL_LINKS,
    },
    duplicates: {
      pagesWithDuplicateTitle,
      pagesWithDuplicateMeta,
      pagesWithDuplicateH1,
      pagesWithDuplicateContent,
    },
    aggregates: {
      avgSeoQualityScore: avgSeoScore,
      avgWordCount: aggregates._avg.wordCount ?? 0,
      avgUniqueness: aggregates._avg.uniquenessScore ?? 0,
      avgInternalLinks: aggregates._avg.internalLinksCount ?? 0,
      avgFaqCount: aggregates._avg.faqCount ?? 0,
    },
  });

  const healthScore = healthBreakdown.healthScore;

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

  if (process.env.SEO_HEALTH_DEBUG === "1") {
    console.log("SEO_HEALTH_BREAKDOWN", JSON.stringify(healthBreakdown, null, 2));
  }

  return {
    generatedAt: new Date().toISOString(),
    healthScore,
    healthBreakdown,
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
      unroutable: unroutableIds.size,
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
      brokenInternalLinks,
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

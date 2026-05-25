import { NextRequest, NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/auth-helpers';
import { scoreAllPages } from '@/lib/indexation-scorer';
import { getCrawlStats } from '@/lib/crawl-analytics';
import { db } from '@/lib/db';
import { indiaCities, indiaStates } from '@/lib/india-geo-data';

const CATEGORIES = [
  'escorts', 'massage', 'dating', 'trans', 'male-escorts',
  'couples', 'adult-jobs', 'adult-services', 'webcam', 'phone-chat',
];

export async function GET(request: NextRequest) {
  try {
    const admin = await requireMinRole('admin');
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 90);

    // Fetch all data sources in parallel
    const [indexation, crawlStats, seoPagesGrouped, noindexSeoPages, seoPagesWithCustom, seoPagesWithFaqs, publishedSeoPages, draftSeoPages, recentCrawlEvents, topLandingListings, sitemapNoindexPages] =
      await Promise.all([
        scoreAllPages(),
        getCrawlStats(days),

        // SEO pages grouped by pageType
        db.seoPage.groupBy({
          by: ['pageType'],
          _count: { id: true },
        }),

        // SEO pages with noindex flag
        db.seoPage.count({ where: { noindex: true } }),

        // SEO pages with custom content (intro or custom title)
        db.seoPage.count({
          where: {
            OR: [
              { introContent: { not: null, not: '' } },
              { title: { not: null, not: '' } },
            ],
          },
        }),

        // SEO pages with FAQs
        db.seoPage.count({
          where: {
            faqs: { some: { isActive: true } },
          },
        }),

        // Published SEO pages
        db.seoPage.count({ where: { isPublished: true } }),

        // Draft SEO pages
        db.seoPage.count({ where: { isPublished: false } }),

        // Recent crawl events for activity feed
        db.crawlEvent.findMany({
          where: { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),

        // Top landing pages based on listing counts per city
        db.listing.groupBy({
          by: ['citySlug'],
          where: { status: 'approved' },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),

        // Count noindex pages for sitemap exclusion
        db.seoPage.count({ where: { noindex: true } }),
      ]);

    const seoPagesTotal = seoPagesGrouped.reduce((sum, g) => sum + g._count.id, 0);

    // ---- Sitemap stats ----
    const tier1Cities = indiaCities.filter((c) => c.tier === 1);
    const tier2Cities = indiaCities.filter((c) => c.tier === 2);
    const tier3Cities = indiaCities.filter((c) => c.tier === 3);
    const sitemapTotalUrls =
      indiaStates.length +
      indiaCities.length +
      CATEGORIES.length +
      tier1Cities.length * CATEGORIES.length +
      tier2Cities.length * CATEGORIES.length;

    // Approximate chunks: 50k URLs per sitemap chunk
    const sitemapChunks = Math.max(1, Math.ceil(sitemapTotalUrls / 50000));

    const sitemapBreakdown = [
      { section: 'States', count: indiaStates.length },
      { section: 'Cities', count: indiaCities.length },
      { section: 'Categories', count: CATEGORIES.length },
      { section: 'City-Category (Tier 1)', count: tier1Cities.length * CATEGORIES.length },
      { section: 'City-Category (Tier 2)', count: tier2Cities.length * CATEGORIES.length },
      { section: 'Country', count: 1 },
    ];

    // ---- Duplicate risk ----
    const duplicateRisk: Array<{ slug: string; type: string; duplicates: string[]; risk: string }> = [];
    const slugMap = new Map<string, { city: (typeof indiaCities)[0]; alias: string }[]>();

    for (const city of indiaCities) {
      for (const alias of city.aliases) {
        const normalized = alias.toLowerCase().replace(/\s+/g, '-');
        if (!slugMap.has(normalized)) {
          slugMap.set(normalized, []);
        }
        slugMap.get(normalized)!.push({ city, alias });
      }
    }

    for (const [slug, entries] of slugMap) {
      if (entries.length > 1) {
        // Multiple cities share the same alias slug — potential duplicate
        const duplicateSlugs = entries.map((e) => e.city.slug);
        const allSame = entries.every((e) => e.city.slug === entries[0].city.slug);
        if (!allSame) {
          duplicateRisk.push({
            slug,
            type: 'alias_conflict',
            duplicates: duplicateSlugs,
            risk: 'high',
          });
        }
      }
      // Check if alias slug collides with an actual city slug
      const matchingCity = indiaCities.find((c) => c.slug === slug);
      if (matchingCity && entries.some((e) => e.city.slug !== slug)) {
        duplicateRisk.push({
          slug,
          type: 'alias_collision',
          duplicates: [matchingCity.slug, ...entries.map((e) => e.city.slug).filter((s) => s !== slug)],
          risk: 'high',
        });
      }
    }

    // Also check for city names that are substrings of other city names
    const cityNames = indiaCities.map((c) => c.name.toLowerCase());
    for (const city of indiaCities.filter((c) => c.tier <= 3)) {
      const name = city.name.toLowerCase();
      const similar = indiaCities.filter(
        (c) => c.slug !== city.slug && (c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()))
      );
      if (similar.length > 0 && similar.length <= 3) {
        const existing = duplicateRisk.find((d) => d.slug === city.slug);
        if (!existing) {
          duplicateRisk.push({
            slug: city.slug,
            type: 'name_similarity',
            duplicates: similar.map((s) => s.slug),
            risk: 'medium',
          });
        }
      }
    }

    // ---- Top landing pages ----
    const topLandingPages = topLandingListings.map((item) => {
      const city = indiaCities.find((c) => c.slug === item.citySlug);
      return {
        url: `https://secretza.com/${item.citySlug}`,
        title: city ? `${city.name} Classifieds` : item.citySlug,
        type: 'city',
        listings: item._count.id,
      };
    });

    // ---- Health score calculation ----
    // Indexation health (0-100): based on indexed ratio
    const indexationHealth = indexation.total > 0
      ? Math.round((indexation.indexed / indexation.total) * 100)
      : 0;

    // Crawl health (0-100): based on googlebot presence and broken page ratio
    const brokenRatio = crawlStats.totalCrawls > 0
      ? crawlStats.brokenPages.reduce((sum, b) => sum + b.count, 0) / crawlStats.totalCrawls
      : 0;
    const googlePresence = crawlStats.totalCrawls > 0
      ? crawlStats.googlebotCrawls / crawlStats.totalCrawls
      : 0;
    const crawlHealth = Math.round(
      Math.max(0, 100 - brokenRatio * 500) * 0.6 + googlePresence * 100 * 0.4
    );

    // Content health (0-100): based on SEO pages with custom content, FAQs, published ratio
    const contentCustomRatio = seoPagesTotal > 0
      ? seoPagesWithCustom / seoPagesTotal
      : 0;
    const contentFaqRatio = seoPagesTotal > 0
      ? seoPagesWithFaqs / seoPagesTotal
      : 0;
    const contentPublishedRatio = seoPagesTotal > 0
      ? publishedSeoPages / seoPagesTotal
      : 0;
    const contentHealth = Math.round(
      contentCustomRatio * 40 + contentFaqRatio * 30 + contentPublishedRatio * 30
    );

    const healthScore = Math.round(
      indexationHealth * 0.4 + crawlHealth * 0.3 + contentHealth * 0.3
    );

    // ---- Recent activity ----
    const recentActivity = recentCrawlEvents.slice(0, 15).map((event) => {
      let type = 'crawl';
      let message = `Crawl: ${event.path}`;

      if (event.botName === 'googlebot') {
        type = 'googlebot';
        message = `Googlebot crawled ${event.path} (${event.statusCode})`;
      } else if (event.isBot) {
        type = 'bot';
        message = `${event.botName || 'Bot'} crawled ${event.path}`;
      } else if (event.statusCode >= 400) {
        type = 'error';
        message = `Error ${event.statusCode} on ${event.path}`;
      }

      return {
        type,
        message,
        timestamp: event.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      indexation: {
        total: indexation.total,
        indexed: indexation.indexed,
        noindexed: indexation.noindexed,
        lowConfidence: indexation.lowConfidence,
        topIssues: indexation.topIssues.map((issue) => ({
          pageType: issue.pageType,
          pageSlug: issue.pageSlug,
          url: issue.url,
          overallScore: issue.overallScore,
          recommendation: issue.recommendation,
          reasons: issue.reasons,
        })),
      },
      crawl: {
        totalCrawls: crawlStats.totalCrawls,
        botCrawls: crawlStats.botCrawls,
        googlebotCrawls: crawlStats.googlebotCrawls,
        topCrawledPages: crawlStats.topCrawledPages.slice(0, 10),
        orphanedPages: crawlStats.orphanedPages.slice(0, 10),
        brokenPages: crawlStats.brokenPages.slice(0, 10),
        crawlFrequency: crawlStats.crawlFrequency.slice(0, 10),
      },
      sitemap: {
        totalUrls: sitemapTotalUrls,
        chunks: sitemapChunks,
        noindexExcluded: sitemapNoindexPages,
        lastGenerated: new Date().toISOString(),
        breakdown: sitemapBreakdown,
      },
      seoPages: {
        total: seoPagesTotal,
        published: publishedSeoPages,
        drafts: draftSeoPages,
        noindex: noindexSeoPages,
        withCustomContent: seoPagesWithCustom,
        withFaqs: seoPagesWithFaqs,
      },
      duplicateRisk: duplicateRisk.slice(0, 20),
      topLandingPages,
      healthScore: Math.min(100, Math.max(0, healthScore)),
      recentActivity,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('SEO dashboard error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load SEO dashboard' },
      { status: 500 }
    );
  }
}

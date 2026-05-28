import { NextRequest, NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/auth-helpers';
import { scoreAllPages } from '@/lib/indexation-scorer';
import { getCrawlStats } from '@/lib/crawl-analytics';
import { db } from '@/lib/db';
import { logError } from '@/lib/monitoring';

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
              { introContent: { not: '' } },
              { title: { not: '' } },
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
    const [
      countryCount,
      stateCount,
      cityCount,
      categoryCount,
      approvedListings,
      pendingListings,
      totalListings,
      userCount,
      cmsPageRows,
      cityRows,
      categoryRows,
    ] = await Promise.all([
      db.country.count({ where: { isActive: true } }),
      db.state.count({ where: { isActive: true } }),
      db.city.count({ where: { isActive: true } }),
      db.category.count({ where: { isActive: true } }),
      db.listing.count({ where: { status: 'approved' } }),
      db.listing.count({ where: { status: 'pending' } }),
      db.listing.count(),
      db.user.count(),
      db.$queryRaw<Array<{ slug: string; isPublished: number }>>`
        SELECT slug, isPublished FROM CmsPage
      `.catch(() => []),
      db.city.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          state: { select: { slug: true, country: { select: { slug: true } } } },
          _count: { select: { listings: { where: { status: 'approved' } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    // ---- Sitemap stats ----
    const publishedCmsPages = cmsPageRows.filter((page) => Boolean(page.isPublished)).length;
    const cityCategoryUrls = cityRows.length * categoryRows.length;
    const sitemapTotalUrls =
      countryCount +
      stateCount +
      cityCount +
      categoryCount +
      cityCategoryUrls +
      approvedListings +
      publishedSeoPages +
      publishedCmsPages;

    // Approximate chunks: 50k URLs per sitemap chunk
    const sitemapChunks = Math.max(1, Math.ceil(sitemapTotalUrls / 50000));

    const sitemapBreakdown = [
      { section: 'Countries', count: countryCount },
      { section: 'States', count: stateCount },
      { section: 'Cities', count: cityCount },
      { section: 'Categories', count: categoryCount },
      { section: 'City-Category', count: cityCategoryUrls },
      { section: 'Listings', count: approvedListings },
      { section: 'CMS Pages', count: publishedCmsPages },
      { section: 'SEO Pages', count: publishedSeoPages },
    ];

    // ---- Duplicate risk ----
    const duplicateRisk: Array<{ slug: string; type: string; duplicates: string[]; risk: string }> = [];
    const slugMap = new Map<string, string[]>();
    for (const city of cityRows) {
      const key = city.slug.toLowerCase();
      slugMap.set(key, [...(slugMap.get(key) || []), `city:${city.id}`]);
    }
    for (const category of categoryRows) {
      const key = category.slug.toLowerCase();
      slugMap.set(key, [...(slugMap.get(key) || []), `category:${category.id}`]);
    }
    for (const page of cmsPageRows) {
      const key = page.slug.toLowerCase();
      slugMap.set(key, [...(slugMap.get(key) || []), `cms:${page.slug}`]);
    }
    for (const [slug, owners] of slugMap) {
      if (owners.length > 1) {
        duplicateRisk.push({
          slug,
          type: 'slug_collision',
          duplicates: owners,
          risk: 'high',
        });
      }
    }

    // ---- Top landing pages ----
    const cityBySlug = new Map(cityRows.map((city) => [city.slug, city]));
    const topLandingPages = topLandingListings.map((item) => {
      const city = cityBySlug.get(item.citySlug);
      const countrySlug = city?.state.country.slug || 'country';
      const stateSlug = city?.state.slug || 'state';
      return {
        url: city ? `/${countrySlug}/${stateSlug}/${city.slug}` : `/search?city=${item.citySlug}`,
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
        listings: totalListings,
        approvedListings,
        pendingListings,
        users: userCount,
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
    logError(error, { component: "route:api/seo/dashboard" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load SEO dashboard' },
      { status: 500 }
    );
  }
}

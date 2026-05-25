// ==========================================
// SEO Operations Engine
// ==========================================
// Provides high-level SEO operations: ping search engines, indexation status,
// orphan page detection, crawl health reports, and sitemap statistics.

import { db } from '@/lib/db';
import { generateSitemapChunks } from '@/lib/sitemap-helpers';

// ==========================================
// Types
// ==========================================

export interface IndexationStatus {
  totalPages: number;
  indexedPages: number;
  noindexedPages: number;
  pendingPages: number;
}

export interface OrphanPage {
  path: string;
  lastBotCrawl: string;
  botCrawlCount: number;
}

export interface BotBreakdown {
  botName: string;
  count: number;
  percentage: number;
}

export interface CrawlHealthReport {
  periodDays: number;
  totalCrawls: number;
  botCrawls: number;
  humanCrawls: number;
  botBreakdown: BotBreakdown[];
  topCrawledPages: Array<{ path: string; count: number; lastCrawl: string }>;
  crawlFrequencyMinutes: number;
  orphanedPagesCount: number;
  generatedAt: string;
}

export interface SitemapStats {
  totalChunks: number;
  totalUrls: number;
  chunks: Array<{ id: string; section: string; count: number }>;
  generatedAt: string;
}

export interface PingResult {
  google: { success: boolean; status?: number; message: string };
  bing: { success: boolean; status?: number; message: string };
  pingedAt: string;
}

// ==========================================
// Ping Search Engines
// ==========================================

const SITEMAP_URL = 'https://secretza.com/sitemap.xml';

async function pingEngine(url: string, engineName: string): Promise<PingResult[typeof engineName extends 'google' ? 'google' : 'bing']> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      return {
        success: true,
        status: response.status,
        message: `Successfully submitted sitemap to ${engineName}`,
      };
    }

    return {
      success: false,
      status: response.status,
      message: `${engineName} returned status ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to ping ${engineName}: ${message}`,
    };
  }
}

/**
 * Submit the sitemap URL to Google and Bing for re-crawling.
 */
export async function pingSearchEngines(): Promise<PingResult> {
  const [google, bing] = await Promise.all([
    pingEngine(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`, 'google'),
    pingEngine(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`, 'bing'),
  ]);

  return {
    google,
    bing,
    pingedAt: new Date().toISOString(),
  };
}

// ==========================================
// Indexation Status
// ==========================================

/**
 * Returns overall indexation health by counting SeoPage records.
 * - totalPages: all SEO pages in the system
 * - indexedPages: pages where noindex is false and isPublished is true
 * - noindexedPages: pages where noindex is true
 * - pendingPages: unpublished pages (isPublished is false, noindex is false)
 */
export async function getIndexationStatus(): Promise<IndexationStatus> {
  try {
    const [totalPages, indexedPages, noindexedPages] = await Promise.all([
      db.seoPage.count(),
      db.seoPage.count({ where: { noindex: false, isPublished: true } }),
      db.seoPage.count({ where: { noindex: true } }),
    ]);

    const pendingPages = totalPages - indexedPages - noindexedPages;

    return {
      totalPages,
      indexedPages,
      noindexedPages,
      pendingPages: Math.max(0, pendingPages),
    };
  } catch {
    return {
      totalPages: 0,
      indexedPages: 0,
      noindexedPages: 0,
      pendingPages: 0,
    };
  }
}

// ==========================================
// Orphan Page Detection
// ==========================================

/**
 * Find pages that exist in our generated sitemap but have only ever been visited
 * by bots, never by real users. These are potential orphan pages that lack
 * internal links or user discoverability.
 */
export async function detectOrphanPages(): Promise<OrphanPage[]> {
  try {
    // Default lookback: 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get all paths crawled by bots
    const botCrawls = await db.crawlEvent.groupBy({
      by: ['path'],
      where: { isBot: true, createdAt: { gte: since } },
      _count: { id: true },
      _max: { createdAt: true },
    });

    // Get all paths visited by real users (non-bot)
    const userPaths = new Set(
      (
        await db.crawlEvent.findMany({
          where: { isBot: false, createdAt: { gte: since } },
          select: { path: true },
          distinct: ['path'],
        })
      ).map((e) => e.path),
    );

    // Filter to pages only ever visited by bots
    const orphans = botCrawls
      .filter((g) => g._count.id > 0 && !userPaths.has(g.path))
      .map((g) => ({
        path: g.path,
        lastBotCrawl: g._max.createdAt?.toISOString() ?? '',
        botCrawlCount: g._count.id,
      }))
      .sort((a, b) => b.botCrawlCount - a.botCrawlCount);

    return orphans;
  } catch {
    return [];
  }
}

// ==========================================
// Crawl Health Report
// ==========================================

/**
 * Generate a comprehensive crawl health report for the given time period.
 * Includes bot breakdown, top crawled pages, crawl frequency, and orphan count.
 */
export async function getCrawlHealthReport(days: number = 30): Promise<CrawlHealthReport> {
  const clampedDays = Math.max(1, Math.min(days, 90));
  const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000);

  try {
    const [totalCrawls, botCrawls, crawledPaths, botBreakdownRaw] = await Promise.all([
      db.crawlEvent.count({ where: { createdAt: { gte: since } } }),
      db.crawlEvent.count({ where: { isBot: true, createdAt: { gte: since } } }),
      db.crawlEvent.groupBy({
        by: ['path'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      db.crawlEvent.groupBy({
        by: ['botName'],
        where: { isBot: true, createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    const humanCrawls = totalCrawls - botCrawls;

    // Bot breakdown with percentages
    const botBreakdown: BotBreakdown[] = botBreakdownRaw
      .filter((g) => g.botName)
      .sort((a, b) => b._count.id - a._count.id)
      .map((g) => ({
        botName: g.botName!,
        count: g._count.id,
        percentage: botCrawls > 0 ? Math.round((g._count.id / botCrawls) * 10000) / 100 : 0,
      }));

    // Top crawled pages
    const topCrawledPages = crawledPaths
      .filter((g) => g._count.id > 0)
      .map((g) => ({
        path: g.path,
        count: g._count.id,
        lastCrawl: g._max.createdAt?.toISOString() ?? '',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Average crawl frequency: avg interval between bot visits across all paths
    const botFrequencyPaths = await db.crawlEvent.groupBy({
      by: ['path'],
      where: { isBot: true, createdAt: { gte: since } },
      _count: { id: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    });

    const multiCrawlPaths = botFrequencyPaths.filter((g) => g._count.id > 1);
    let crawlFrequencyMinutes = 0;
    if (multiCrawlPaths.length > 0) {
      const totalIntervals = multiCrawlPaths.reduce((sum, g) => {
        const interval = g._max.createdAt!.getTime() - g._min.createdAt!.getTime();
        return sum + interval / (g._count.id - 1);
      }, 0);
      crawlFrequencyMinutes = Math.round(totalIntervals / multiCrawlPaths.length / (60 * 1000));
    }

    // Orphaned pages count
    const userPaths = new Set(
      (
        await db.crawlEvent.findMany({
          where: { isBot: false, createdAt: { gte: since } },
          select: { path: true },
          distinct: ['path'],
        })
      ).map((e) => e.path),
    );

    const orphanedPagesCount = crawledPaths.filter(
      (g) => {
        // Check if any bot crawled this path
        const isBotOnly = botFrequencyPaths.some((bp) => bp.path === g.path);
        return isBotOnly && g._count.id > 0 && !userPaths.has(g.path);
      },
    ).length;

    return {
      periodDays: clampedDays,
      totalCrawls,
      botCrawls,
      humanCrawls: Math.max(0, humanCrawls),
      botBreakdown,
      topCrawledPages,
      crawlFrequencyMinutes: Math.max(0, crawlFrequencyMinutes),
      orphanedPagesCount,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      periodDays: clampedDays,
      totalCrawls: 0,
      botCrawls: 0,
      humanCrawls: 0,
      botBreakdown: [],
      topCrawledPages: [],
      crawlFrequencyMinutes: 0,
      orphanedPagesCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ==========================================
// Sitemap Statistics
// ==========================================

/**
 * Returns sitemap generation statistics including total chunks, total URLs,
 * and per-chunk breakdowns.
 */
export async function generateSitemapStats(): Promise<SitemapStats> {
  try {
    const chunks = await generateSitemapChunks();
    const totalChunks = chunks.length;
    const totalUrls = chunks.reduce((sum, chunk) => sum + chunk.count, 0);

    return {
      totalChunks,
      totalUrls,
      chunks: chunks.map((c) => ({ id: c.id, section: c.section, count: c.count })),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      totalChunks: 0,
      totalUrls: 0,
      chunks: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

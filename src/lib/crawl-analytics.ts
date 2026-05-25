import type { Prisma } from '@prisma/client';

// Lazy-load db to avoid Edge Runtime issues when imported from middleware
let _db: typeof import('@/lib/db').db | null = null;
async function getDb() {
  if (!_db) {
    const mod = await import('@/lib/db');
    _db = mod.db;
  }
  return _db;
}

export interface CrawlStats {
  totalCrawls: number;
  botCrawls: number;
  googlebotCrawls: number;
  topCrawledPages: Array<{ path: string; count: number; lastCrawl: string }>;
  recentCrawls: Array<{
    path: string; userAgent: string; statusCode: number;
    responseTime: number; isBot: boolean; botName: string | null;
    createdAt: string;
  }>;
  orphanedPages: Array<{ path: string; lastCrawl: string }>;
  brokenPages: Array<{ path: string; statusCode: number; count: number }>;
  crawlFrequency: Array<{ path: string; avgInterval: number; lastCrawl: string }>;
}

const KNOWN_BOTS: Record<string, string> = {
  'Googlebot': 'googlebot',
  'Googlebot-Image': 'googlebot-image',
  'Googlebot-Video': 'googlebot-video',
  'Bingbot': 'bingbot',
  'Slurp': 'slurp',
  'DuckDuckBot': 'duckduckbot',
  'Baiduspider': 'baiduspider',
  'YandexBot': 'yandexbot',
  'facebookexternalhit': 'facebookexternalhit',
  'Twitterbot': 'twitterbot',
  'AhrefsBot': 'ahrefsbot',
  'SemrushBot': 'semrushbot',
  'MegaIndex': 'megaindex',
  'MJ12bot': 'mj12bot',
  'DotBot': 'dotbot',
  'Gigabot': 'gigabot',
  'hrefli': 'hrefli',
  'phantomjs': 'phantomjs',
};

function detectBot(userAgent: string): { isBot: boolean; name: string | null } {
  const lower = userAgent.toLowerCase();
  for (const [name] of Object.entries(KNOWN_BOTS)) {
    if (lower.includes(name.toLowerCase())) {
      return { isBot: true, name };
    }
  }
  return { isBot: false, name: null };
}

export async function recordCrawlEvent(data: {
  userAgent: string;
  path: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  referer?: string;
  ipAddress?: string;
}) {
  const { isBot, name: botName } = detectBot(data.userAgent || '');

  try {
    const db = await getDb();
    await db.crawlEvent.create({
      data: {
        userAgent: data.userAgent.slice(0, 500),
        path: data.path.slice(0, 2000),
        method: (data.method || 'GET').toUpperCase().slice(0, 10),
        statusCode: data.statusCode ?? 200,
        responseTime: Math.min(data.responseTime ?? 0, 30000),
        isBot,
        botName,
        referer: data.referer?.slice(0, 1000),
        ipAddress: data.ipAddress?.slice(0, 45),
      },
    });
  } catch {
    // Silent fail — don't let analytics break the app
  }
}

export async function getCrawlStats(days: number = 30): Promise<CrawlStats> {
  const db = await getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalCrawls, botCrawls, recentCrawls, crawledPaths] = await Promise.all([
    db.crawlEvent.count({ where: { createdAt: { gte: since } } }),
    db.crawlEvent.count({ where: { isBot: true, createdAt: { gte: since } } }),
    db.crawlEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.crawlEvent.groupBy({
      by: ['path'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _max: { createdAt: true },
    }),
  ]);

  const googlebotCrawls = await db.crawlEvent.count({
    where: { isBot: true, botName: 'googlebot', createdAt: { gte: since } },
  });

  // Top crawled pages
  const topCrawledPages = crawledPaths
    .filter((g: any) => g._count.id > 0)
    .map((g: any) => ({
      path: g.path,
      count: g._count.id,
      lastCrawl: g._max.createdAt?.toISOString() ?? '',
    }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 20);

  // Orphaned pages: paths crawled only by bots, never by real users
  const botOnlyPaths = new Set(
    (await db.crawlEvent.findMany({
      where: { isBot: true, createdAt: { gte: since } },
      select: { path: true },
    })).map((e) => e.path),
  );
  const userPaths = new Set(
    (await db.crawlEvent.findMany({
      where: { isBot: false, createdAt: { gte: since } },
      select: { path: true },
    })).map((e) => e.path),
  );

  const orphanedPages = [...botOnlyPaths].filter((p) => !userPaths.has(p)).map((path) => {
    const crawl = crawledPaths.find((g: any) => g.path === path);
    return {
      path,
      lastCrawl: crawl?._max?.createdAt?.toISOString() ?? '',
    };
  });

  // Broken pages: bot 4xx responses
  const brokenPaths = await db.crawlEvent.groupBy({
    by: ['path', 'statusCode'],
    where: {
      isBot: true,
      createdAt: { gte: since },
      statusCode: { gte: 400, lt: 500 },
    },
    _count: { id: true },
    _max: { createdAt: true },
  });
  const brokenPages = brokenPaths
    .filter((g: any) => g._count.id > 0)
    .map((g: any) => ({
      path: g.path,
      statusCode: g.statusCode,
      count: g._count.id,
      lastCrawl: g._max.createdAt?.toISOString() ?? '',
    }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 20);

  // Crawl frequency
  const frequencyPaths = await db.crawlEvent.groupBy({
    by: ['path'],
    where: { isBot: true, createdAt: { gte: since } },
    _count: { id: true },
    _max: { createdAt: true },
    _min: { createdAt: true },
  });

  const crawlFrequency = frequencyPaths
    .filter((g: any) => g._count.id > 1)
    .map((g: any) => {
      const interval = g._max.createdAt!.getTime() - g._min.createdAt!.getTime();
      return {
        path: g.path,
        avgInterval: Math.round(interval / g._count.id / (60 * 1000)), // in minutes
        lastCrawl: g._max.createdAt?.toISOString() ?? '',
      };
    })
    .filter((f) => f.avgInterval > 0)
    .sort((a: any, b: any) => a.avgInterval - b.avgInterval)
    .slice(0, 20);

  return {
    totalCrawls,
    botCrawls,
    googlebotCrawls,
    topCrawledPages,
    recentCrawls: recentCrawls.map((e) => ({
      path: e.path,
      userAgent: e.userAgent,
      statusCode: e.statusCode,
      responseTime: e.responseTime,
      isBot: e.isBot,
      botName: e.botName,
      createdAt: e.createdAt.toISOString(),
    })),
    orphanedPages,
    brokenPages,
    crawlFrequency,
  };
}

export { KNOWN_BOTS, detectBot };

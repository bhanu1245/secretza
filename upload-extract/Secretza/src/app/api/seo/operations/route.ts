// ==========================================
// SEO Operations API
// ==========================================
// GET  /api/seo/operations — full SEO operations dashboard data
// POST /api/seo/operations — trigger actions (ping, refresh-sitemap)

import { NextRequest, NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/auth-helpers';
import {
  getIndexationStatus,
  getCrawlHealthReport,
  generateSitemapStats,
  detectOrphanPages,
  pingSearchEngines,
} from '@/lib/seo-operations';

// ==========================================
// GET — Full SEO Operations Dashboard
// ==========================================

export async function GET(request: NextRequest) {
  try {
    await requireMinRole('admin');

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);

    const [indexation, crawlHealth, sitemapStats, orphanPages] = await Promise.all([
      getIndexationStatus(),
      getCrawlHealthReport(days),
      generateSitemapStats(),
      detectOrphanPages(),
    ]);

    return NextResponse.json({
      indexation,
      crawlHealth,
      sitemapStats,
      orphanPages: orphanPages.slice(0, 50),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch SEO operations data';
    return NextResponse.json({ error: message }, { status: error instanceof Error && message === 'Unauthorized' ? 401 : 500 });
  }
}

// ==========================================
// POST — Trigger SEO Actions
// ==========================================

export async function POST(request: NextRequest) {
  try {
    await requireMinRole('admin');

    const body = await request.json();
    const { action } = body as { action?: string };

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid action. Use "ping" or "refresh-sitemap".' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'ping': {
        const result = await pingSearchEngines();
        return NextResponse.json({ action: 'ping', result });
      }

      case 'refresh-sitemap': {
        const stats = await generateSitemapStats();
        // Re-generating the sitemap stats forces the sitemap chunk computation,
        // which clears any stale internal cache used by generateSitemapChunks.
        return NextResponse.json({
          action: 'refresh-sitemap',
          success: true,
          message: `Sitemap refreshed: ${stats.totalChunks} chunks, ${stats.totalUrls} URLs`,
          stats,
        });
      }

      default: {
        return NextResponse.json(
          { error: `Unknown action: "${action}". Supported: "ping", "refresh-sitemap".` },
          { status: 400 },
        );
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute SEO operation';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

// ==========================================
// Sitemap Chunk — /sitemap/{id}
// ==========================================
// Handles individual sitemap chunk requests.
// The rewrite in next.config.ts maps /sitemap/{id}.xml → /sitemap/{id}
// so crawlers see SEO-friendly .xml URLs while Next.js serves this handler.

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import {
  loadNoindexSlugs,
  generateChunkUrls,
  buildSitemapChunkXml,
} from '@/lib/sitemap-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Rebuild chunks every hour

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return new NextResponse('Invalid sitemap chunk ID', { status: 400 });
    }

    // Sanitize: only allow alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return new NextResponse('Invalid sitemap chunk ID', { status: 400 });
    }

    const noindexSlugs = await loadNoindexSlugs();
    const urls = await generateChunkUrls(id, noindexSlugs);

    if (urls.length === 0) {
      return new NextResponse('Sitemap chunk not found', { status: 404 });
    }

    const xml = buildSitemapChunkXml(urls);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error(`[Sitemap Chunk] Error generating chunk:`, error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

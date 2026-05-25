// ==========================================
// Sitemap Index — /sitemap.xml
// ==========================================
// Explicit route handler that takes precedence over [slug] dynamic route.
// Static segment "sitemap.xml" > dynamic segment "[slug]" in Next.js routing.

import { NextResponse } from 'next/server';
import {
  generateSitemapChunks,
  buildSitemapIndexXml,
} from '@/lib/sitemap-helpers';
import { logError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Rebuild index every hour

export async function GET() {
  try {
    const chunks = await generateSitemapChunks();
    const xml = buildSitemapIndexXml(chunks);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logError(error, { component: "route:sitemap.xml" });
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      },
    );
  }
}

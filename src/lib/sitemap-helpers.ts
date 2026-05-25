// ==========================================
// Sitemap Helpers — shared chunk generation logic
// ==========================================
// Used by both /sitemap.xml (index) and /sitemap/[id] (chunks)

import { db } from '@/lib/db';
import { indiaCities, indiaStates } from '@/lib/india-geo-data';

export const BASE_URL = 'https://secretza.com';
export const MAX_URLS_PER_SITEMAP = 5000;

export interface SitemapChunk {
  id: string;
  section: string;
  count: number;
}

/**
 * Generate the list of all sitemap chunks.
 * Returns metadata about each chunk (id, section name, URL count).
 */
export async function generateSitemapChunks(): Promise<SitemapChunk[]> {
  const chunks: SitemapChunk[] = [];

  // Chunk 1: Static pages
  chunks.push({ id: 'static', section: 'Static', count: 2 });

  // Chunk 2: Categories
  const catCount = await db.category.count({ where: { isActive: true } });
  chunks.push({ id: 'categories', section: 'Categories', count: catCount });
  if (catCount > MAX_URLS_PER_SITEMAP) {
    chunks.push({
      id: 'categories-2',
      section: 'Categories (continued)',
      count: Math.max(0, catCount - MAX_URLS_PER_SITEMAP),
    });
  }

  // Chunk 3: Cities (tier 1-3)
  const cityPages = indiaCities.filter((c) => c.tier <= 3);
  const cityChunks = Math.ceil(cityPages.length / MAX_URLS_PER_SITEMAP);
  for (let i = 0; i < cityChunks; i++) {
    chunks.push({
      id: `cities-${i + 1}`,
      section: `Cities (${cityPages.length} total)`,
      count: Math.min(MAX_URLS_PER_SITEMAP, cityPages.length - i * MAX_URLS_PER_SITEMAP),
    });
  }

  // Chunk 4: States
  chunks.push({ id: 'states', section: 'States', count: indiaStates.length });

  // Chunk 5+: Category+City combos
  const categories = await db.category.findMany({ where: { isActive: true }, select: { slug: true } });
  const topCities = indiaCities.filter((c) => c.tier <= 2).slice(0, 50);
  let catCityCount = 0;
  let catCityChunk = 0;
  for (const cat of categories) {
    for (const city of topCities) {
      catCityCount++;
      if (catCityCount > MAX_URLS_PER_SITEMAP) {
        chunks.push({
          id: `catcity-${catCityChunk + 1}`,
          section: `Category+City (${catCityCount - 1} pages)`,
          count: MAX_URLS_PER_SITEMAP,
        });
        catCityCount = 0;
        catCityChunk++;
      }
    }
  }
  if (catCityCount > 0) {
    chunks.push({
      id: `catcity-${catCityChunk + 1}`,
      section: `Category+City (${catCityCount} pages)`,
      count: catCityCount,
    });
  }

  // Chunk: Listings
  const listingCount = await db.listing.count({ where: { status: 'approved' } });
  const listingChunks = Math.ceil(listingCount / MAX_URLS_PER_SITEMAP);
  for (let i = 0; i < listingChunks; i++) {
    chunks.push({
      id: `listings-${i + 1}`,
      section: `Listings (${listingCount} total)`,
      count: Math.min(MAX_URLS_PER_SITEMAP, listingCount - i * MAX_URLS_PER_SITEMAP),
    });
  }

  return chunks;
}

// ==========================================
// Priority Calculation
// ==========================================

function getDynamicPriority(path: string, basePriority: number): number {
  const priorityBoost: Record<string, number> = {
    '/': 20,
    '/india': 15,
    '/escorts': 10,
    '/mumbai': 10,
    '/delhi': 10,
    '/bangalore': 10,
  };
  const boost = priorityBoost[path] || 0;
  return Math.min(1.0, Math.max(0.1, basePriority + boost / 100));
}

// ==========================================
// Noindex Slug Loader
// ==========================================

export async function loadNoindexSlugs(): Promise<Set<string>> {
  try {
    const pages = await db.seoPage.findMany({
      where: { noindex: true },
      select: { pageSlug: true },
    });
    return new Set(pages.map((p) => p.pageSlug));
  } catch {
    return new Set();
  }
}

// ==========================================
// URL Entry Builder
// ==========================================

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Generate URLs for a specific sitemap chunk.
 * Returns an array of sitemap URL entries ready for XML serialization.
 */
export async function generateChunkUrls(
  id: string,
  noindexSlugs: Set<string>,
): Promise<SitemapUrlEntry[]> {
  const now = new Date();
  const today = formatDate(now);

  // Static pages
  if (id === 'static') {
    return [
      {
        loc: BASE_URL,
        lastmod: today,
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: `${BASE_URL}/india`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.9,
      },
    ];
  }

  // Categories
  if (id === 'categories' || id === 'categories-2') {
    const categories = await db.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    });
    const skip = id === 'categories-2' ? MAX_URLS_PER_SITEMAP : 0;
    return categories
      .filter((cat) => !noindexSlugs.has(cat.slug))
      .slice(skip)
      .map((cat) => {
        const url = `${BASE_URL}/${cat.slug}`;
        return {
          loc: url,
          lastmod: formatDate(cat.updatedAt),
          changefreq: 'daily',
          priority: getDynamicPriority(url, 0.8),
        };
      });
  }

  // City pages
  if (id?.startsWith('cities-')) {
    const match = id.match(/cities-(\d+)/);
    const chunkIndex = match ? parseInt(match[1]) - 1 : 0;
    const cityPages = indiaCities.filter((c) => c.tier <= 3 && !noindexSlugs.has(c.slug));
    const start = chunkIndex * MAX_URLS_PER_SITEMAP;
    return cityPages
      .slice(start, start + MAX_URLS_PER_SITEMAP)
      .map((city) => {
        const url = `${BASE_URL}/${city.slug}`;
        return {
          loc: url,
          lastmod: today,
          changefreq: 'daily',
          priority: getDynamicPriority(url, city.tier === 1 ? 0.7 : city.tier === 2 ? 0.6 : 0.5),
        };
      });
  }

  // State pages
  if (id === 'states') {
    return indiaStates
      .filter((state) => !noindexSlugs.has(state.slug))
      .map((state) => {
        const url = `${BASE_URL}/india/${state.slug}`;
        return {
          loc: url,
          lastmod: today,
          changefreq: 'weekly',
          priority: getDynamicPriority(url, 0.6),
        };
      });
  }

  // Category+City combos
  if (id?.startsWith('catcity-')) {
    const categories = await db.category.findMany({
      where: { isActive: true },
      select: { slug: true },
    });
    const topCities = indiaCities.filter((c) => c.tier <= 2).slice(0, 50);
    const match = id.match(/catcity-(\d+)/);
    const chunkIndex = match ? parseInt(match[1]) - 1 : 0;
    let skip = chunkIndex * MAX_URLS_PER_SITEMAP;
    const results: SitemapUrlEntry[] = [];
    for (const cat of categories) {
      for (const city of topCities) {
        if (noindexSlugs.has(cat.slug) || noindexSlugs.has(city.slug)) continue;
        skip--;
        if (skip >= 0) continue;
        const url = `${BASE_URL}/${cat.slug}/${city.slug}`;
        results.push({
          loc: url,
          lastmod: today,
          changefreq: 'daily',
          priority: getDynamicPriority(url, city.tier === 1 ? 0.65 : 0.5),
        });
      }
    }
    return results;
  }

  // Listing pages
  if (id?.startsWith('listings-')) {
    const match = id.match(/listings-(\d+)/);
    const chunkIndex = match ? parseInt(match[1]) - 1 : 0;
    const skip = chunkIndex * MAX_URLS_PER_SITEMAP;
    const listings = await db.listing.findMany({
      where: { status: 'approved' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: MAX_URLS_PER_SITEMAP,
    });
    return listings.map((listing) => {
      const url = `${BASE_URL}/listing/${listing.slug}`;
      return {
        loc: url,
        lastmod: formatDate(listing.updatedAt),
        changefreq: 'weekly',
        priority: getDynamicPriority(url, 0.4),
      };
    });
  }

  return [];
}

// ==========================================
// XML Serializers
// ==========================================

/**
 * Generate sitemap index XML (for /sitemap.xml).
 */
export function buildSitemapIndexXml(chunks: SitemapChunk[]): string {
  const today = new Date().toISOString().split('T')[0];
  const sitemapEntries = chunks
    .map(
      (chunk) => `  <sitemap>
    <loc>${BASE_URL}/sitemap/${chunk.id}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
}

/**
 * Generate sitemap chunk XML (for /sitemap/{id}).
 */
export function buildSitemapChunkXml(urls: SitemapUrlEntry[]): string {
  const urlEntries = urls
    .map(
      (url) => `  <url>
    <loc>${url.loc}</loc>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ''}${url.changefreq ? `\n    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority ? `\n    <priority>${url.priority.toFixed(1)}</priority>` : ''}
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

import { NextRequest, NextResponse } from 'next/server';
import {
  generateRelatedSearches,
  getTrendingCities,
  getSeasonalSearches,
  getAutoInternalLinks,
  getSiloLinks,
  getBreadcrumbLinks,
} from '@/lib/internal-linking';
import { logError } from '@/lib/monitoring';

/**
 * GET /api/seo/linking - Get internal linking suggestions
 *
 * Query params:
 *   pageType: string (city, category, category_city)
 *   slug: string (the page slug)
 *   type: 'related' | 'trending' | 'seasonal' | 'silo' | 'all' (default: 'all')
 *   limit: number (default 20)
 *
 * No auth required — public data for SEO rendering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const pageType = searchParams.get('pageType') ?? '';
    const slug = searchParams.get('slug') ?? '';
    const type = searchParams.get('type') ?? 'all';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    // Validate pageType
    const validPageTypes = ['city', 'category', 'category_city', 'state', 'country'];
    if (pageType && !validPageTypes.includes(pageType)) {
      return NextResponse.json(
        { error: `Invalid pageType. Must be one of: ${validPageTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate type
    const validTypes = ['related', 'trending', 'seasonal', 'silo', 'all'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Build response based on requested type
    if (type === 'related') {
      return NextResponse.json({
        type: 'related',
        relatedSearches: generateRelatedSearches(pageType, slug, limit),
      });
    }

    if (type === 'trending') {
      return NextResponse.json({
        type: 'trending',
        trendingCities: getTrendingCities(limit),
      });
    }

    if (type === 'seasonal') {
      return NextResponse.json({
        type: 'seasonal',
        seasonalSearches: getSeasonalSearches(limit),
      });
    }

    if (type === 'silo') {
      return NextResponse.json({
        type: 'silo',
        siloLinks: getSiloLinks(pageType, slug, limit),
      });
    }

    // type === 'all' — return everything
    const effectivePageType = pageType || 'city';
    const effectiveSlug = slug || '';

    return NextResponse.json({
      type: 'all',
      relatedSearches: generateRelatedSearches(effectivePageType, effectiveSlug, limit),
      trendingCities: getTrendingCities(limit),
      seasonalSearches: getSeasonalSearches(limit),
      siloLinks: getSiloLinks(effectivePageType, effectiveSlug, limit),
      breadcrumbLinks: getBreadcrumbLinks(effectivePageType, effectiveSlug),
      autoLinks: getAutoInternalLinks(effectivePageType, effectiveSlug, limit),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/linking" });
    return NextResponse.json(
      { error: 'Failed to generate linking data' },
      { status: 500 },
    );
  }
}

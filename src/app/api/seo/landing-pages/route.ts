import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { indiaCities, indiaStates, getCityBySlug, getStateBySlug } from '@/lib/india-geo-data';
import { CATEGORIES, isCategorySlug } from '@/lib/seo-resolver';
import { logError } from '@/lib/monitoring';

// ------------------------------------------
// Types
// ------------------------------------------

interface CityLandingPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  type: string;
  priority: number;
  listingCount: number;
  tier: number;
  stateName: string;
}

interface TrendingLandingPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  type: string;
  priority: number;
}

interface SeasonalLandingPage {
  url: string;
  title: string;
  metaDescription: string;
  season: string;
  keywords: string[];
}

// ------------------------------------------
// Season Detection
// ------------------------------------------

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8, 9].includes(month)) return 'monsoon';
  return 'autumn';
}

const SEASONAL_KEYWORDS: Record<string, string[]> = {
  winter: [
    'new year parties',
    'winter getaways',
    'holiday companionship',
    'festive season',
    'year-end celebrations',
    'cozy encounters',
    'winter retreats',
    'new year escorts',
    'holiday escorts',
    'christmas parties',
  ],
  spring: [
    'spring break',
    'holi celebrations',
    'summer preview',
    'outdoor adventures',
    'festival companions',
    'travel partners',
    'weekend getaways',
    'holi escorts',
    'spring parties',
    'holiday getaways',
  ],
  monsoon: [
    'monsoon retreats',
    'rainy day companions',
    'indoor experiences',
    'weekend escapes',
    'cozy evenings',
    'romantic getaways',
    'monsoon dates',
    'indoor spa',
    'rainy day plans',
    'monsoon specials',
  ],
  autumn: [
    'diwali celebrations',
    'festive season',
    'puja companions',
    'navratri events',
    'wedding season',
    'holiday trips',
    'party companions',
    'diwali escorts',
    'festive parties',
    'autumn getaways',
  ],
};

// ------------------------------------------
// Helper: title/meta templates
// ------------------------------------------

function cityTitle(cityName: string, stateName: string): string {
  return `Adult Services in ${cityName}, ${stateName} — SecretZa`;
}

function cityMeta(cityName: string, stateName: string, count: number): string {
  return `Browse ${count}+ verified adult service listings in ${cityName}, ${stateName}. Find escorts, massage, dating and more on SecretZa — India's trusted classifieds platform.`;
}

function cityH1(cityName: string): string {
  return `Adult Services in ${cityName}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getStateName(stateSlug: string): string {
  const state = indiaStates.find((s) => s.slug === stateSlug);
  return state?.name ?? stateSlug;
}

// ------------------------------------------
// GET Handler
// ------------------------------------------

/**
 * GET /api/seo/landing-pages - Get landing page generation data
 *
 * Query params:
 *   type: 'cities' | 'trending' | 'premium' | 'seasonal' (default: 'cities')
 *   limit: number (default 50)
 *
 * No auth required for GET — public SEO data.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') ?? 'cities';
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

    const validTypes = ['cities', 'trending', 'premium', 'seasonal'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    switch (type) {
      case 'cities':
        return handleCities(limit);
      case 'trending':
        return handleTrending(limit);
      case 'premium':
        return handlePremium(limit);
      case 'seasonal':
        return handleSeasonal(limit);
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    logError(error, { component: "route:api/seo/landing-pages" });
    return NextResponse.json(
      { error: 'Failed to generate landing page data' },
      { status: 500 },
    );
  }
}

// ------------------------------------------
// Type: cities
// ------------------------------------------

/**
 * Query DB for top cities with most approved listings.
 * Returns top N cities sorted by listing count (desc), then tier, then population.
 */
async function handleCities(limit: number) {
  // Aggregate listing counts by citySlug from DB (approved listings only)
  const listingCountsRaw = await db.listing.groupBy({
    by: ['citySlug'],
    where: { status: 'approved' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 200,
  });

  // Build a map: citySlug -> count
  const countMap = new Map<string, number>();
  for (const row of listingCountsRaw) {
    countMap.set(row.citySlug, row._count.id);
  }

  // Get geo cities with listing data
  const geoCitiesWithCounts = indiaCities
    .map((city) => ({
      ...city,
      listingCount: countMap.get(city.slug) ?? 0,
      stateName: getStateName(city.stateSlug),
    }))
    .filter((c) => c.listingCount > 0 || c.tier <= 2)
    .sort((a, b) => {
      // Sort by listing count desc, then tier, then population
      if (a.listingCount !== b.listingCount) return b.listingCount - a.listingCount;
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.population - a.population;
    });

  const pages: CityLandingPage[] = geoCitiesWithCounts.slice(0, limit).map((city, index) => ({
    url: `/${city.slug}`,
    title: cityTitle(city.name, city.stateName),
    metaDescription: cityMeta(city.name, city.stateName, city.listingCount),
    h1: cityH1(city.name),
    type: 'city',
    priority: city.tier === 1 ? 10 : city.tier === 2 ? 7 : city.listingCount > 50 ? 5 : 3,
    listingCount: city.listingCount,
    tier: city.tier,
    stateName: city.stateName,
  }));

  return NextResponse.json({
    type: 'cities',
    pages,
    total: geoCitiesWithCounts.length,
  });
}

// ------------------------------------------
// Type: trending
// ------------------------------------------

/**
 * Generate trending search landing pages based on current date.
 * Combines top cities + categories into high-value search combos.
 */
async function handleTrending(limit: number) {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );

  // Get top cities with actual listing data
  const listingCountsRaw = await db.listing.groupBy({
    by: ['citySlug'],
    where: { status: 'approved' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  const countMap = new Map<string, number>();
  for (const row of listingCountsRaw) {
    countMap.set(row.citySlug, row._count.id);
  }

  const topCities = indiaCities
    .map((city) => ({ ...city, listingCount: countMap.get(city.slug) ?? 0 }))
    .filter((c) => c.listingCount > 0)
    .sort((a, b) => {
      // Trending score: listing count weighted by recency signal (dayOfYear hash)
      const scoreA = a.listingCount * (0.8 + 0.2 * (hashString(a.slug + dayOfYear) % 100) / 100);
      const scoreB = b.listingCount * (0.8 + 0.2 * (hashString(b.slug + dayOfYear) % 100) / 100);
      return scoreB - scoreA;
    })
    .slice(0, 15);

  // Also get trending categories by listing count
  const categoryCountsRaw = await db.listing.groupBy({
    by: ['categorySlug'],
    where: { status: 'approved' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const categoryCountMap = new Map<string, number>();
  for (const row of categoryCountsRaw) {
    categoryCountMap.set(row.categorySlug, row._count.id);
  }

  const topCategories = CATEGORIES
    .map((cat) => ({ ...cat, listingCount: categoryCountMap.get(cat.slug) ?? 0 }))
    .filter((c) => c.listingCount > 0)
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 5);

  // Generate trending city+category combo pages
  const pages: TrendingLandingPage[] = [];

  for (const city of topCities) {
    for (const cat of topCategories) {
      const comboKey = `${cat.slug}/${city.slug}`;
      const comboCount = await db.listing.count({
        where: {
          status: 'approved',
          categorySlug: cat.slug,
          citySlug: city.slug,
        },
      });

      if (comboCount > 0) {
        pages.push({
          url: `/${comboKey}`,
          title: `${cat.name} in ${city.name} — Trending on SecretZa`,
          metaDescription: `Discover ${comboCount}+ trending ${cat.name.toLowerCase()} listings in ${city.name}. Browse verified profiles with real photos on SecretZa.`,
          h1: `Trending ${cat.name} in ${city.name}`,
          type: 'category_city',
          priority: city.tier === 1 ? 10 : 7,
        });
      }
    }

    // Also add the city page itself as trending
    pages.push({
      url: `/${city.slug}`,
      title: `Trending Adult Services in ${city.name} — SecretZa`,
      metaDescription: `Explore ${city.listingCount}+ trending adult service listings in ${city.name}. Updated daily with verified profiles on SecretZa.`,
      h1: `Trending Services in ${city.name}`,
      type: 'city',
      priority: city.tier === 1 ? 9 : 6,
    });
  }

  // Sort by priority desc and limit
  pages.sort((a, b) => b.priority - a.priority);

  return NextResponse.json({
    type: 'trending',
    pages: pages.slice(0, limit),
    total: pages.length,
  });
}

// ------------------------------------------
// Type: premium
// ------------------------------------------

/**
 * Return high-priority category+city combos.
 * Premium = Tier 1 & 2 cities with highest listing counts across all categories.
 */
async function handlePremium(limit: number) {
  // Get approved listing counts grouped by city and category
  const comboData = await db.listing.groupBy({
    by: ['categorySlug', 'citySlug'],
    where: { status: 'approved' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 500,
  });

  const premiumCities = new Set(
    indiaCities
      .filter((c) => c.tier <= 2)
      .map((c) => c.slug),
  );

  // Filter to only premium city combos, sort by count
  const premiumCombos = comboData
    .filter((row) => premiumCities.has(row.citySlug))
    .sort((a, b) => b._count.id - a._count.id);

  const pages: TrendingLandingPage[] = premiumCombos.slice(0, limit).map((combo) => {
    const city = getCityBySlug(combo.citySlug);
    const category = CATEGORIES.find((c) => c.slug === combo.categorySlug);
    const cityName = city?.name ?? combo.citySlug;
    const catName = category?.name ?? combo.categorySlug;
    const isTier1 = city?.tier === 1;
    const count = combo._count.id;

    return {
      url: `/${combo.categorySlug}/${combo.citySlug}`,
      title: `${catName} in ${cityName} — Premium Listings on SecretZa`,
      metaDescription: `Browse ${count}+ premium verified ${catName.toLowerCase()} listings in ${cityName}. Top-rated providers with real photos on SecretZa.`,
      h1: `Premium ${catName} in ${cityName}`,
      type: 'category_city',
      priority: isTier1 ? 10 : 8,
    };
  });

  return NextResponse.json({
    type: 'premium',
    pages,
    total: premiumCombos.length,
  });
}

// ------------------------------------------
// Type: seasonal
// ------------------------------------------

/**
 * Auto-detect current season and generate seasonal landing pages.
 * Creates keyword-rich seasonal pages combining seasonal themes with top cities.
 */
async function handleSeasonal(limit: number) {
  const season = getCurrentSeason();
  const keywords = SEASONAL_KEYWORDS[season] ?? SEASONAL_KEYWORDS.winter!;

  // Get top cities by listing count
  const listingCountsRaw = await db.listing.groupBy({
    by: ['citySlug'],
    where: { status: 'approved' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 30,
  });

  const countMap = new Map<string, number>();
  for (const row of listingCountsRaw) {
    countMap.set(row.citySlug, row._count.id);
  }

  const topCities = indiaCities
    .filter((c) => c.tier <= 2 || (countMap.get(c.slug) ?? 0) > 10)
    .map((c) => ({ ...c, listingCount: countMap.get(c.slug) ?? 0 }))
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 10);

  const pages: SeasonalLandingPage[] = [];

  // Generate seasonal + city pages
  for (const city of topCities) {
    const relevantKeywords = keywords.slice(0, 4);
    const metaKeywords = keywords.slice(0, 6);

    pages.push({
      url: `/${city.slug}`,
      title: `${season.charAt(0).toUpperCase() + season.slice(1)} ${relevantKeywords[0]} in ${city.name} — SecretZa`,
      metaDescription: `Discover the best ${relevantKeywords[0]} and ${relevantKeywords[1]} in ${city.name} this ${season}. ${city.listingCount}+ verified listings on SecretZa.`,
      season,
      keywords: metaKeywords,
    });
  }

  // Generate seasonal + category pages
  for (const keyword of keywords.slice(0, 5)) {
    for (const category of CATEGORIES.slice(0, 3)) {
      const slug = keyword.toLowerCase().replace(/\s+/g, '-');
      pages.push({
        url: `/${category.slug}`,
        title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} — ${category.name} on SecretZa`,
        metaDescription: `Find the best ${keyword} and ${category.name.toLowerCase()} across India. Verified providers and daily-updated listings on SecretZa.`,
        season,
        keywords: [keyword, category.slug, `${keyword} ${category.name.toLowerCase()}`],
      });
    }
  }

  // Sort deterministically and limit
  pages.sort((a, b) => a.url.localeCompare(b.url));

  return NextResponse.json({
    type: 'seasonal',
    season,
    pages: pages.slice(0, limit),
    total: pages.length,
  });
}

/**
 * Internal Linking Optimization Engine
 *
 * Generates related searches, trending cities, seasonal suggestions,
 * anchor variations, breadcrumbs, auto-links, and silo structures
 * for the SecretZa adult classifieds platform.
 *
 * This module is server-side only — it uses no client-side APIs.
 */

import { indiaCities, indiaStates, getCityBySlug } from '@/lib/india-geo-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single related search suggestion with varied anchor text and priority. */
export interface RelatedSearch {
  query: string;
  url: string;
  type: 'category_city' | 'category' | 'city' | 'longtail';
  anchor: string; // The visible text (varied from query)
  priority: number; // 0-100
}

/** Trending city data with daily-deterministic direction indicator. */
export interface TrendingCityData {
  name: string;
  slug: string;
  listingCount: number;
  isMetro: boolean;
  stateName: string;
  trendDirection: 'up' | 'down' | 'stable';
}

/** Seasonal search suggestion. */
export interface SeasonalSearch {
  query: string;
  url: string;
  season: 'summer' | 'winter' | 'monsoon' | 'festival' | 'new-year' | 'valentine';
  relevance: number;
}

/** Anchor text variations for a keyword. */
export interface AnchorVariation {
  original: string;
  variations: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Master list of all categories on SecretZa.
 * Used throughout the internal linking engine.
 */
export const ALL_CATEGORIES = [
  { name: 'Escorts', slug: 'escorts' },
  { name: 'Massage', slug: 'massage' },
  { name: 'Dating', slug: 'dating' },
  { name: 'Trans', slug: 'trans' },
  { name: 'Male Escorts', slug: 'male-escorts' },
  { name: 'Couples', slug: 'couples' },
  { name: 'Adult Jobs', slug: 'adult-jobs' },
  { name: 'Adult Services', slug: 'adult-services' },
  { name: 'Webcam', slug: 'webcam' },
  { name: 'Phone & Chat', slug: 'phone-chat' },
] as const;

/** Cities with the highest SEO authority — used as defaults when no city context is available. */
const TOP_Metro_SLUGS = [
  'mumbai', 'new-delhi', 'bangalore', 'hyderabad', 'chennai',
  'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow',
  'surat', 'kanpur', 'nagpur', 'indore', 'thane',
  'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'gurgaon',
];

/**
 * Anchor templates used to create varied link text.
 * Each template has `{keyword}` / `{city}` placeholders.
 */
const CITY_ANCHOR_TEMPLATES = [
  '{city}',
  'Services in {city}',
  '{city}\'s best',
  'Explore {city}',
  '{city} listings',
  'Top picks in {city}',
  '{city} classifieds',
  'Find in {city}',
];

const CATEGORY_ANCHOR_TEMPLATES = [
  '{category}',
  'Best {category}',
  'Top {category}',
  '{category} near you',
  'Find {category}',
  'Premium {category}',
  'Verified {category}',
  '{category} ads',
];

const LONGTAIL_ANCHOR_TEMPLATES = [
  '{keyword}',
  'Find {keyword}',
  'Best {keyword} in India',
  '{keyword} nearby',
  'Top {keyword} results',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple deterministic string hash (djb2 variant) returning a positive 32-bit integer.
 * Used for deterministic daily trending without needing `Date.now()`.
 */
function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Format a slug like "new-delhi" into a readable "New Delhi" title. */
function slugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Build the URL for a category page. */
function categoryUrl(catSlug: string): string {
  return `/category/${catSlug}`;
}

/** Build the URL for a city landing page (two-segment category+city route). */
function cityUrl(citySlug: string): string {
  return `/escorts/${citySlug}`;
}

/** Build the URL for a category+city combination page. */
function categoryCityUrl(catSlug: string, citySlug: string): string {
  return `/${catSlug}/${citySlug}`;
}

/** Return a random-seeming element from an array based on a hash seed. */
function pickByHash<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Simulate a deterministic "listing count" based on population and city tier. */
function simulatedListingCount(city: { population: number; tier: 1 | 2 | 3 | 4 }): number {
  const base = Math.floor(city.population / 5000);
  const tierMultiplier = city.tier === 1 ? 8 : city.tier === 2 ? 4 : city.tier === 3 ? 2 : 1;
  return Math.floor(base * tierMultiplier);
}

/** Find the state name for a given state slug. */
function getStateName(stateSlug: string): string {
  return indiaStates.find((s) => s.slug === stateSlug)?.name ?? stateSlug;
}

// ---------------------------------------------------------------------------
// 1. generateRelatedSearches
// ---------------------------------------------------------------------------

/**
 * Generate 10-15 related search suggestions based on the current page context.
 *
 * @param pageType  - One of `'city'`, `'category'`, or `'category_city'`.
 * @param slug      - Primary slug of the page (city slug for city pages, category slug for category pages).
 * @param citySlug  - (Optional) City slug when `pageType` is `'category_city'`.
 * @param categorySlug - (Optional) Category slug when `pageType` is `'category_city'`.
 */
export function generateRelatedSearches(
  pageType: string,
  slug: string,
  citySlug?: string,
  categorySlug?: string,
): RelatedSearch[] {
  const results: RelatedSearch[] = [];
  const seed = hashString(`${pageType}-${slug}-${new Date().toISOString().slice(0, 10)}`);

  // ---- City page: suggest categories in this city + nearby cities ----
  if (pageType === 'city') {
    const city = getCityBySlug(slug);
    if (!city) return results;

    // Categories in this city (pick 5-7)
    const catCount = 5 + (seed % 3);
    for (let i = 0; i < Math.min(catCount, ALL_CATEGORIES.length); i++) {
      const cat = ALL_CATEGORIES[i];
      const template = CATEGORY_ANCHOR_TEMPLATES[(seed + i) % CATEGORY_ANCHOR_TEMPLATES.length];
      results.push({
        query: `${cat.name} in ${city.name}`,
        url: categoryCityUrl(cat.slug, city.slug),
        type: 'category_city',
        anchor: template.replace('{category}', cat.name).replace('{city}', city.name),
        priority: cat.slug === 'escorts' ? 95 : 80 - i * 4,
      });
    }

    // Nearby cities (same state, pick 5-8)
    const nearbyCities = indiaCities
      .filter((c) => c.stateSlug === city.stateSlug && c.slug !== city.slug)
      .sort((a, b) => b.population - a.population)
      .slice(0, 8);

    for (let i = 0; i < nearbyCities.length; i++) {
      const nearby = nearbyCities[i];
      const template = CITY_ANCHOR_TEMPLATES[(seed + i + 3) % CITY_ANCHOR_TEMPLATES.length];
      results.push({
        query: `${slugToTitle(nearby.slug)} escorts`,
        url: categoryCityUrl('escorts', nearby.slug),
        type: 'category_city',
        anchor: template.replace('{city}', nearby.name),
        priority: 65 - i * 3,
      });
    }
  }

  // ---- Category page: suggest top cities + related categories ----
  if (pageType === 'category') {
    const cat = ALL_CATEGORIES.find((c) => c.slug === slug);
    const catName = cat ? cat.name : slugToTitle(slug);

    // Top cities for this category (pick 7-10)
    const topCities = TOP_Metro_SLUGS.slice(0, 10);
    for (let i = 0; i < topCities.length; i++) {
      const cityObj = getCityBySlug(topCities[i]);
      if (!cityObj) continue;
      const template = CITY_ANCHOR_TEMPLATES[(seed + i) % CITY_ANCHOR_TEMPLATES.length];
      results.push({
        query: `${catName} in ${cityObj.name}`,
        url: categoryCityUrl(slug, cityObj.slug),
        type: 'category_city',
        anchor: template.replace('{city}', cityObj.name),
        priority: i < 5 ? 90 - i * 4 : 60 - (i - 5) * 5,
      });
    }

    // Related categories (pick 3-5)
    const relatedSlugs = ALL_CATEGORIES.filter((c) => c.slug !== slug).slice(0, 5);
    for (let i = 0; i < relatedSlugs.length; i++) {
      const rel = relatedSlugs[i];
      results.push({
        query: rel.name,
        url: categoryUrl(rel.slug),
        type: 'category',
        anchor: CATEGORY_ANCHOR_TEMPLATES[(seed + i + 7) % CATEGORY_ANCHOR_TEMPLATES.length].replace('{category}', rel.name),
        priority: 50 - i * 5,
      });
    }
  }

  // ---- Category + City page: nearby cities with same category + other categories in same city ----
  if (pageType === 'category_city' && citySlug && categorySlug) {
    const city = getCityBySlug(citySlug);
    const cat = ALL_CATEGORIES.find((c) => c.slug === categorySlug);
    const catName = cat ? cat.name : slugToTitle(categorySlug);

    // Nearby cities with the same category
    if (city) {
      const nearbyCities = indiaCities
        .filter((c) => c.stateSlug === city.stateSlug && c.slug !== city.slug)
        .sort((a, b) => b.population - a.population)
        .slice(0, 6);

      for (let i = 0; i < nearbyCities.length; i++) {
        const nearby = nearbyCities[i];
        const template = CITY_ANCHOR_TEMPLATES[(seed + i) % CITY_ANCHOR_TEMPLATES.length];
        results.push({
          query: `${catName} in ${nearby.name}`,
          url: categoryCityUrl(categorySlug, nearby.slug),
          type: 'category_city',
          anchor: template.replace('{city}', nearby.name),
          priority: 85 - i * 5,
        });
      }
    }

    // Other categories in the same city
    const otherCats = ALL_CATEGORIES.filter((c) => c.slug !== categorySlug);
    for (let i = 0; i < Math.min(7, otherCats.length); i++) {
      const other = otherCats[i];
      const template = CATEGORY_ANCHOR_TEMPLATES[(seed + i + 5) % CATEGORY_ANCHOR_TEMPLATES.length];
      results.push({
        query: `${other.name} in ${city ? city.name : slugToTitle(citySlug)}`,
        url: categoryCityUrl(other.slug, citySlug),
        type: 'category_city',
        anchor: template.replace('{category}', other.name),
        priority: 70 - i * 4,
      });
    }
  }

  // Ensure at least 10 results by appending longtail suggestions if needed
  if (results.length < 10) {
    const fillers: RelatedSearch[] = [
      { query: 'premium independent services', url: '/category/escorts', type: 'longtail' as const, anchor: 'Premium independent services', priority: 40 },
      { query: 'verified classifieds India', url: '/country/india', type: 'longtail' as const, anchor: 'Verified classifieds across India', priority: 35 },
      { query: 'top rated adult services', url: '/category/adult-services', type: 'longtail' as const, anchor: 'Top rated adult services', priority: 38 },
    ];
    for (const filler of fillers) {
      if (results.length >= 10) break;
      results.push(filler);
    }
  }

  return results.slice(0, 15);
}

// ---------------------------------------------------------------------------
// 2. getTrendingCities
// ---------------------------------------------------------------------------

/**
 * Return top 20 trending cities from the India geo database (tier 1 and tier 2).
 *
 * Uses a deterministic "trending" algorithm based on a hash of the current date
 * + city slug, so results change daily but remain consistent within a single day.
 */
export function getTrendingCities(): TrendingCityData[] {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayHash = hashString(today);

  const eligible = indiaCities
    .filter((c) => c.tier === 1 || c.tier === 2)
    .map((city) => {
      const cityScore = hashString(`${today}-${city.slug}`);
      // Derive a "trend direction" from the score (deterministic)
      const mod = cityScore % 3;
      const trendDirection: TrendingCityData['trendDirection'] =
        mod === 0 ? 'up' : mod === 1 ? 'stable' : 'down';

      return {
        name: city.name,
        slug: city.slug,
        listingCount: simulatedListingCount(city) + (cityScore % 200) - 100,
        isMetro: city.isMetro,
        stateName: getStateName(city.stateSlug),
        trendDirection,
        // Use combined hash for sorting to keep it deterministic per day
        _sortKey: (todayHash ^ cityScore) >>> 0,
      };
    })
    .sort((a, b) => b._sortKey - a._sortKey);

  // Strip internal sort key before returning
  return eligible.slice(0, 20).map(({ _sortKey, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// 3. getSeasonalSearches
// ---------------------------------------------------------------------------

/** Season-specific search templates keyed by season. */
const SEASONAL_TEMPLATES: Record<SeasonalSearch['season'], Array<{ query: string; catSlugs: string[] }>> = {
  summer: [
    { query: 'summer specials', catSlugs: ['escorts', 'massage'] },
    { query: 'vacation escorts', catSlugs: ['escorts'] },
    { query: 'summer getaway companions', catSlugs: ['escorts', 'dating'] },
    { query: 'beach holiday escorts', catSlugs: ['escorts'] },
    { query: 'summer massage deals', catSlugs: ['massage'] },
    { query: 'hot summer nights', catSlugs: ['escorts', 'dating'] },
    { query: 'hill station companions', catSlugs: ['escorts', 'dating'] },
    { query: 'summer party dates', catSlugs: ['dating', 'couples'] },
    { query: 'holiday romance', catSlugs: ['dating'] },
    { query: 'resort escorts', catSlugs: ['escorts'] },
    { query: 'weekend getaway escorts', catSlugs: ['escorts'] },
    { query: 'summer dating', catSlugs: ['dating'] },
  ],
  monsoon: [
    { query: 'rainy day specials', catSlugs: ['escorts', 'massage'] },
    { query: 'monsoon romance', catSlugs: ['dating'] },
    { query: 'indoor companions', catSlugs: ['escorts', 'dating'] },
    { query: 'cozy massage sessions', catSlugs: ['massage'] },
    { query: 'monsoon dating ideas', catSlugs: ['dating'] },
    { query: 'rainy night escorts', catSlugs: ['escorts'] },
    { query: 'monsoon webcam shows', catSlugs: ['webcam'] },
    { query: 'stay-at-home adult services', catSlugs: ['adult-services'] },
    { query: 'monsoon phone chat', catSlugs: ['phone-chat'] },
    { query: 'indoor date companions', catSlugs: ['dating'] },
  ],
  winter: [
    { query: 'winter companions', catSlugs: ['escorts', 'dating'] },
    { query: 'new year party escorts', catSlugs: ['escorts'] },
    { query: 'winter massage therapy', catSlugs: ['massage'] },
    { query: 'holiday season dating', catSlugs: ['dating'] },
    { query: 'christmas eve companions', catSlugs: ['escorts', 'dating'] },
    { query: 'cozy winter dates', catSlugs: ['dating'] },
    { query: 'year-end celebrations', catSlugs: ['couples', 'escorts'] },
    { query: 'winter getaway escorts', catSlugs: ['escorts'] },
    { query: 'cold weather companions', catSlugs: ['escorts', 'dating'] },
    { query: 'holiday party dates', catSlugs: ['dating'] },
    { query: 'new year celebration escorts', catSlugs: ['escorts'] },
    { query: 'winter romance', catSlugs: ['dating'] },
  ],
  festival: [
    { query: 'diwali specials', catSlugs: ['escorts', 'massage'] },
    { query: 'diwali party escorts', catSlugs: ['escorts'] },
    { query: 'festival season companions', catSlugs: ['escorts', 'dating'] },
    { query: 'diwali night celebrations', catSlugs: ['couples', 'dating'] },
    { query: 'navratri specials', catSlugs: ['escorts', 'dating'] },
    { query: 'durga puja escorts', catSlugs: ['escorts'] },
    { query: 'puja holiday companions', catSlugs: ['dating'] },
    { query: 'diwali massage offers', catSlugs: ['massage'] },
    { query: 'festive dating', catSlugs: ['dating'] },
    { query: 'ganesh chaturthi specials', catSlugs: ['escorts', 'dating'] },
  ],
  'new-year': [
    { query: 'new year party escorts', catSlugs: ['escorts'] },
    { query: 'new year eve dates', catSlugs: ['dating'] },
    { query: 'new year celebration companions', catSlugs: ['escorts', 'dating'] },
    { query: 'new year midnight specials', catSlugs: ['escorts'] },
    { query: 'new year getaway escorts', catSlugs: ['escorts'] },
    { query: 'january fresh listings', catSlugs: ['escorts', 'adult-services'] },
    { query: 'new year couple parties', catSlugs: ['couples'] },
    { query: ' nye party companions', catSlugs: ['escorts', 'dating'] },
    { query: 'new year massage specials', catSlugs: ['massage'] },
  ],
  valentine: [
    { query: 'valentine gifts', catSlugs: ['adult-services'] },
    { query: 'romantic dates', catSlugs: ['dating'] },
    { query: 'valentine day escorts', catSlugs: ['escorts'] },
    { query: 'valentine couples specials', catSlugs: ['couples'] },
    { query: 'romantic massage', catSlugs: ['massage'] },
    { query: 'valentine dating ideas', catSlugs: ['dating'] },
    { query: 'feb 14 companions', catSlugs: ['escorts', 'dating'] },
    { query: 'valentine webcam dates', catSlugs: ['webcam'] },
    { query: 'love day specials', catSlugs: ['escorts', 'dating'] },
    { query: 'valentine night celebrations', catSlugs: ['escorts', 'couples'] },
    { query: 'romantic getaways', catSlugs: ['dating', 'escorts'] },
    { query: 'valentine phone chat', catSlugs: ['phone-chat'] },
  ],
};

/**
 * Detect the current season from the month. Multiple seasons can overlap
 * (e.g. February is both 'winter' and 'valentine', October is 'winter' and 'festival').
 */
function detectSeason(month: number): SeasonalSearch['season'] {
  // Indian season calendar
  if (month === 2) return 'valentine'; // February → Valentine
  if (month >= 3 && month <= 5) return 'summer'; // Mar-May → Summer
  if (month >= 6 && month <= 9) return 'monsoon'; // Jun-Sep → Monsoon
  if (month === 10 || month === 11) return 'festival'; // Oct-Nov → Festival
  if (month === 12 || month === 1) return 'new-year'; // Dec-Jan → New Year
  return 'winter'; // fallback
}

/**
 * Return seasonal search suggestions.
 *
 * If no season is specified, auto-detect from the current month:
 * - Summer (Mar-May)
 * - Monsoon (Jun-Sep)
 * - Winter (Oct, Dec)
 * - Festival (Oct-Nov)
 * - New Year (Dec-Jan)
 * - Valentine (Feb)
 *
 * Returns 8-12 suggestions per season, each with a metro city URL appended.
 *
 * @param season - Optional season override. If omitted, auto-detects from current month.
 */
export function getSeasonalSearches(season?: string): SeasonalSearch[] {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  // Determine the primary season
  const primary: SeasonalSearch['season'] = (season as SeasonalSearch['season']) ?? detectSeason(month);

  // Also include an overlapping season when applicable
  const secondary: SeasonalSearch['season'] | null =
    primary === 'valentine' ? 'winter'
    : primary === 'festival' ? 'winter'
    : primary === 'new-year' ? 'winter'
    : primary === 'winter' && (month === 10 || month === 11) ? 'festival'
    : primary === 'winter' && month === 2 ? 'valentine'
    : null;

  const results: SeasonalSearch[] = [];
  const seed = hashString(`seasonal-${primary}-${now.toISOString().slice(0, 10)}`);

  const seasonsToInclude = secondary ? [primary, secondary] : [primary];

  for (const s of seasonsToInclude) {
    const templates = SEASONAL_TEMPLATES[s];
    if (!templates) continue;

    // Pick a metro city to pair with the seasonal query
    const metroCity = getCityBySlug(TOP_Metro_SLUGS[seed % TOP_Metro_SLUGS.length]);

    for (let i = 0; i < templates.length; i++) {
      const tmpl = templates[i];
      // Use the first cat slug for the URL
      const catSlug = tmpl.catSlugs[0];
      const url = metroCity
        ? categoryCityUrl(catSlug, metroCity.slug)
        : categoryUrl(catSlug);

      results.push({
        query: tmpl.query,
        url,
        season: s,
        relevance: s === primary ? 90 - i * 3 : 60 - i * 3,
      });
    }
  }

  return results.slice(0, 12);
}

// ---------------------------------------------------------------------------
// 4. generateAnchorVariations
// ---------------------------------------------------------------------------

/**
 * Generate 3-5 varied anchor text options for a keyword.
 *
 * For a city keyword like "mumbai", variations could include:
 * "Mumbai", "services in Mumbai", "Mumbai's best", "explore Mumbai".
 *
 * For a category keyword like "escorts", variations could include:
 * "Escorts", "Best Escorts", "Top Escorts", "Escorts near you".
 *
 * @param keyword - The base keyword (can be a slug or a human-readable string).
 * @param type    - Whether the keyword represents a city, category, or longtail phrase.
 */
export function generateAnchorVariations(
  keyword: string,
  type: 'city' | 'category' | 'longtail',
): AnchorVariation {
  // Normalise keyword to a readable title
  const title = slugToTitle(keyword);

  const templates =
    type === 'city'
      ? CITY_ANCHOR_TEMPLATES
      : type === 'category'
        ? CATEGORY_ANCHOR_TEMPLATES
        : LONGTAIL_ANCHOR_TEMPLATES;

  const placeholder = type === 'city' ? '{city}' : type === 'category' ? '{category}' : '{keyword}';

  // Generate unique variations (at least 3, at most 5)
  const seen = new Set<string>();
  const variations: string[] = [];

  for (const tmpl of templates) {
    const variation = tmpl.replace(placeholder, title);
    if (!seen.has(variation)) {
      seen.add(variation);
      variations.push(variation);
    }
    if (variations.length >= 5) break;
  }

  return {
    original: title,
    variations: variations.slice(0, Math.max(3, variations.length)),
  };
}

// ---------------------------------------------------------------------------
// 5. getBreadcrumbLinks
// ---------------------------------------------------------------------------

/**
 * Generate breadcrumb navigation items based on page type and slug.
 *
 * @param pageType - One of `'city'`, `'category'`, or `'category_city'`.
 * @param slug     - Primary slug of the page.
 * @returns Array of breadcrumb items ordered from home (leftmost) to current page (rightmost).
 */
export function getBreadcrumbLinks(
  pageType: string,
  slug: string,
): Array<{ name: string; url: string }> {
  const crumbs: Array<{ name: string; url: string }> = [
    { name: 'Home', url: '/' },
    { name: 'India', url: '/india' },
  ];

  if (pageType === 'city') {
    const city = getCityBySlug(slug);
    const cityName = city ? city.name : slugToTitle(slug);
    const stateSlug = city?.stateSlug;
    if (stateSlug && stateSlug !== slug) {
      const stateName = getStateName(stateSlug);
      crumbs.push({ name: stateName, url: cityUrl(stateSlug) });
    }
    crumbs.push({ name: cityName, url: cityUrl(slug) });
  }

  if (pageType === 'category') {
    const cat = ALL_CATEGORIES.find((c) => c.slug === slug);
    const catName = cat ? cat.name : slugToTitle(slug);
    crumbs.push({ name: catName, url: categoryUrl(slug) });
  }

  if (pageType === 'category_city') {
    // We expect slug to be the city slug and the category to be inferred from context,
    // but since the function signature only takes slug, we use slug as the combined identifier.
    // The URL pattern is `/india/{category}/{city}`, so we split accordingly.
    // However, with only a single slug, we return a minimal breadcrumb.
    const city = getCityBySlug(slug);
    const cityName = city ? city.name : slugToTitle(slug);
    crumbs.push({ name: cityName, url: cityUrl(slug) });
  }

  return crumbs;
}

// ---------------------------------------------------------------------------
// 6. getAutoInternalLinks
// ---------------------------------------------------------------------------

/**
 * Generate automatic internal link suggestions for a page.
 *
 * Includes a mix of related cities, related categories, and cross-links.
 * Each link has a `rel` attribute:
 * - `"dofollow"` for organic editorial links
 * - `"sponsored"` for featured / promoted placements
 *
 * @param pageType - One of `'city'`, `'category'`, or `'category_city'`.
 * @param slug     - Primary slug of the page.
 * @param limit    - Maximum number of links to return (default 20).
 */
export function getAutoInternalLinks(
  pageType: string,
  slug: string,
  limit: number = 20,
): Array<{ text: string; url: string; rel: string; type: string }> {
  const links: Array<{ text: string; url: string; rel: string; type: string }> = [];
  const seed = hashString(`auto-link-${pageType}-${slug}-${new Date().toISOString().slice(0, 10)}`);

  // ---- City page links ----
  if (pageType === 'city') {
    const city = getCityBySlug(slug);
    if (!city) return links;

    // Categories in this city
    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
      const cat = ALL_CATEGORIES[i];
      const tmpl = CATEGORY_ANCHOR_TEMPLATES[(seed + i) % CATEGORY_ANCHOR_TEMPLATES.length];
      links.push({
        text: tmpl.replace('{category}', `${cat.name} in ${city.name}`),
        url: categoryCityUrl(cat.slug, city.slug),
        rel: i < 3 ? 'sponsored' : 'dofollow',
        type: 'category_in_city',
      });
    }

    // Nearby cities (top 10)
    const nearbyCities = indiaCities
      .filter((c) => c.stateSlug === city.stateSlug && c.slug !== city.slug)
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);

    for (let i = 0; i < nearbyCities.length; i++) {
      const nearby = nearbyCities[i];
      const tmpl = CITY_ANCHOR_TEMPLATES[(seed + i + 5) % CITY_ANCHOR_TEMPLATES.length];
      links.push({
        text: tmpl.replace('{city}', nearby.name),
        url: cityUrl(nearby.slug),
        rel: i < 2 ? 'sponsored' : 'dofollow',
        type: 'nearby_city',
      });
    }
  }

  // ---- Category page links ----
  if (pageType === 'category') {
    const cat = ALL_CATEGORIES.find((c) => c.slug === slug);
    const catName = cat ? cat.name : slugToTitle(slug);

    // Top cities for this category
    const topCities = TOP_Metro_SLUGS.slice(0, 12);
    for (let i = 0; i < topCities.length; i++) {
      const cityObj = getCityBySlug(topCities[i]);
      if (!cityObj) continue;
      const tmpl = CITY_ANCHOR_TEMPLATES[(seed + i) % CITY_ANCHOR_TEMPLATES.length];
      links.push({
        text: `${catName} ${tmpl.replace('{city}', cityObj.name)}`,
        url: categoryCityUrl(slug, cityObj.slug),
        rel: i < 4 ? 'sponsored' : 'dofollow',
        type: 'category_in_city',
      });
    }

    // Cross-category links
    const otherCats = ALL_CATEGORIES.filter((c) => c.slug !== slug);
    for (let i = 0; i < Math.min(6, otherCats.length); i++) {
      const other = otherCats[i];
      links.push({
        text: `Also try ${other.name}`,
        url: categoryUrl(other.slug),
        rel: 'dofollow',
        type: 'cross_category',
      });
    }
  }

  // ---- Category + City page links ----
  if (pageType === 'category_city') {
    // Attempt to split slug: if it contains "/", the first part is category, second is city
    // But since the function signature only gives one slug, we use it as city
    // and link to other categories
    const city = getCityBySlug(slug);
    if (!city) return links;

    // Other categories in this city
    const otherCats = ALL_CATEGORIES;
    for (let i = 0; i < otherCats.length; i++) {
      const cat = otherCats[i];
      const tmpl = CATEGORY_ANCHOR_TEMPLATES[(seed + i) % CATEGORY_ANCHOR_TEMPLATES.length];
      links.push({
        text: tmpl.replace('{category}', cat.name),
        url: categoryCityUrl(cat.slug, city.slug),
        rel: i < 2 ? 'sponsored' : 'dofollow',
        type: 'category_in_city',
      });
    }

    // Nearby cities with escorts (cross-link)
    const nearbyCities = indiaCities
      .filter((c) => c.stateSlug === city.stateSlug && c.slug !== city.slug)
      .sort((a, b) => b.population - a.population)
      .slice(0, 6);

    for (let i = 0; i < nearbyCities.length; i++) {
      const nearby = nearbyCities[i];
      links.push({
        text: `${nearby.name} escorts`,
        url: categoryCityUrl('escorts', nearby.slug),
        rel: 'dofollow',
        type: 'nearby_city_category',
      });
    }
  }

  return links.slice(0, limit);
}

// ---------------------------------------------------------------------------
// 7. getSiloLinks
// ---------------------------------------------------------------------------

/**
 * Generate topic cluster / silo structure links.
 *
 * - For a **city** page, this returns all categories available in that city.
 * - For a **category** page, this returns all top cities for that category.
 * - For a **category_city** page, this returns both related categories in the city
 *   and nearby cities with the same category.
 *
 * Each link includes a short description for use in silo pages.
 *
 * @param pageType - One of `'city'`, `'category'`, or `'category_city'`.
 * @param slug     - Primary slug of the page.
 */
export function getSiloLinks(
  pageType: string,
  slug: string,
): Array<{ title: string; url: string; description: string }> {
  const links: Array<{ title: string; url: string; description: string }> = [];

  if (pageType === 'city') {
    const city = getCityBySlug(slug);
    const cityName = city ? city.name : slugToTitle(slug);
    const stateName = city ? getStateName(city.stateSlug) : '';

    for (const cat of ALL_CATEGORIES) {
      links.push({
        title: `${cat.name} in ${cityName}`,
        url: categoryCityUrl(cat.slug, slug),
        description: `Browse the latest ${cat.name.toLowerCase()} listings in ${cityName}${stateName ? `, ${stateName}` : ''}. Find verified ${cat.name.toLowerCase()} providers near you.`,
      });
    }
  }

  if (pageType === 'category') {
    const cat = ALL_CATEGORIES.find((c) => c.slug === slug);
    const catName = cat ? cat.name : slugToTitle(slug);

    // Return top 20 cities for this category
    const topCitySlugs = TOP_Metro_SLUGS.slice(0, 20);
    for (const citySlug of topCitySlugs) {
      const cityObj = getCityBySlug(citySlug);
      if (!cityObj) continue;
      const stateName = getStateName(cityObj.stateSlug);
      links.push({
        title: `${catName} in ${cityObj.name}`,
        url: categoryCityUrl(slug, citySlug),
        description: `Discover ${catName.toLowerCase()} in ${cityObj.name}, ${stateName}. Browse verified and premium ${catName.toLowerCase()} listings.`,
      });
    }
  }

  if (pageType === 'category_city') {
    const city = getCityBySlug(slug);
    if (!city) return links;
    const cityName = city.name;
    const stateName = getStateName(city.stateSlug);

    // All categories in this city
    for (const cat of ALL_CATEGORIES) {
      links.push({
        title: `${cat.name} in ${cityName}`,
        url: categoryCityUrl(cat.slug, slug),
        description: `Find ${cat.name.toLowerCase()} in ${cityName}, ${stateName}. Updated daily with new ${cat.name.toLowerCase()} listings.`,
      });
    }

    // Nearby cities for cross-silo linking
    const nearbyCities = indiaCities
      .filter((c) => c.stateSlug === city.stateSlug && c.slug !== city.slug)
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);

    for (const nearby of nearbyCities) {
      links.push({
        title: `Escorts in ${nearby.name}`,
        url: categoryCityUrl('escorts', nearby.slug),
        description: `Explore escorts in ${nearby.name}, ${getStateName(nearby.stateSlug)}. Part of the ${cityName} area coverage.`,
      });
    }
  }

  return links;
}

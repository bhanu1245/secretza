// ==========================================
// SEO Slug Resolution Engine
// ==========================================
// Determines what type of page a URL slug represents.
// Used by all SEO page routes to resolve slugs.

import { indiaCities, indiaStates, type IndiaCity, type IndiaState } from "@/lib/india-geo-data";

// ------------------------------------------
// Category Data
// ------------------------------------------

export const CATEGORY_SLUGS = [
  "escorts",
  "massage",
  "dating",
  "trans",
  "male-escorts",
  "couples",
  "adult-jobs",
  "adult-services",
  "webcam",
  "phone-chat",
] as const;

export const CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: "Escorts", slug: "escorts" },
  { name: "Massage", slug: "massage" },
  { name: "Dating", slug: "dating" },
  { name: "Trans", slug: "trans" },
  { name: "Male Escorts", slug: "male-escorts" },
  { name: "Couples", slug: "couples" },
  { name: "Adult Jobs", slug: "adult-jobs" },
  { name: "Adult Services", slug: "adult-services" },
  { name: "Webcam", slug: "webcam" },
  { name: "Phone & Chat", slug: "phone-chat" },
];

// ------------------------------------------
// Resolution Types
// ------------------------------------------

interface CategoryResolved {
  type: "category";
  data: { name: string; slug: string };
}

interface CityResolved {
  type: "city";
  data: IndiaCity;
}

interface StateResolvedDirect {
  type: "state";
  data: IndiaState;
}

interface LongtailResolved {
  type: "longtail";
  data: null;
}

interface StateResolved {
  type: "state";
  data: IndiaState;
}

interface CityResolvedIndia {
  type: "city";
  data: IndiaCity;
}

type SlugResolved = CategoryResolved | CityResolved | StateResolvedDirect | LongtailResolved;
type IndiaSlugResolved = StateResolved | CityResolvedIndia | null;

// ------------------------------------------
// Resolver Functions
// ------------------------------------------

/**
 * Resolve a top-level slug (/slug).
 * Checks category first, then city, then falls back to longtail.
 */
export function resolveSlug(slug: string): SlugResolved {
  // 1. Check if it's a category slug
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (category) {
    return { type: "category", data: category };
  }

  // 2. Check if it's a city slug (direct match or alias)
  const city = getCityBySlug(slug);
  if (city) {
    return { type: "city", data: city };
  }

  // 3. Check if it's a state slug (e.g., /goa → Goa state page)
  const state = getStateBySlug(slug);
  if (state) {
    return { type: "state", data: state };
  }

  // 4. Longtail (will 404)
  return { type: "longtail", data: null };
}

/**
 * Resolve a slug under /india/india-[slug].
 * Checks state first, then city.
 */
export function resolveIndiaSlug(slug: string): IndiaSlugResolved {
  // 1. Check if it's a state slug
  const state = getStateBySlug(slug);
  if (state) {
    return { type: "state", data: state };
  }

  // 2. Check if it's a city slug
  const city = getCityBySlug(slug);
  if (city) {
    return { type: "city", data: city };
  }

  // 3. No match - will 404
  return null;
}

// ------------------------------------------
// Lookup Functions
// ------------------------------------------

/**
 * Find a city by its slug or any of its aliases.
 */
export function getCityBySlug(slug: string): IndiaCity | undefined {
  const normalizedSlug = slug.toLowerCase();

  // Direct slug match
  const directMatch = indiaCities.find((c) => c.slug === normalizedSlug);
  if (directMatch) return directMatch;

  // Alias match
  return indiaCities.find((c) =>
    c.aliases.some((a) => a.toLowerCase() === normalizedSlug)
  );
}

/**
 * Find a state by its slug.
 */
export function getStateBySlug(slug: string): IndiaState | undefined {
  return indiaStates.find((s) => s.slug === slug.toLowerCase());
}

/**
 * Get the state name for a given state slug.
 */
export function getStateName(stateSlug: string): string {
  const state = getStateBySlug(stateSlug);
  return state?.name ?? stateSlug;
}

/**
 * Get all cities belonging to a specific state.
 */
export function getCitiesByState(stateSlug: string): IndiaCity[] {
  return indiaCities.filter((c) => c.stateSlug === stateSlug);
}

/**
 * Get nearby cities for a given city.
 * Returns cities in the same state first, then Tier-1 metros.
 */
export function getNearbyCitiesForCity(citySlug: string, limit: number = 6): IndiaCity[] {
  const city = getCityBySlug(citySlug);
  if (!city) return indiaCities.filter((c) => c.isMetro).slice(0, limit);

  // Get other cities in the same state
  const sameStateCities = indiaCities
    .filter((c) => c.stateSlug === city.stateSlug && c.slug !== city.slug)
    .sort((a, b) => b.population - a.population)
    .slice(0, limit);

  // If not enough, add nearby metros
  if (sameStateCities.length < limit) {
    const metroSlugs = sameStateCities.map((c) => c.slug);
    const additional = indiaCities
      .filter(
        (c) =>
          c.isMetro &&
          c.slug !== city.slug &&
          !metroSlugs.includes(c.slug)
      )
      .sort((a, b) => b.population - a.population)
      .slice(0, limit - sameStateCities.length);
    sameStateCities.push(...additional);
  }

  return sameStateCities.slice(0, limit);
}

/**
 * Get all unique city slugs.
 */
export function getAllCitySlugs(): string[] {
  return indiaCities.map((c) => c.slug);
}

/**
 * Get all unique state slugs.
 */
export function getAllStateSlugs(): string[] {
  return indiaStates.map((s) => s.slug);
}

/**
 * Get top N cities by population (Tier 1 first).
 */
export function getTopCities(limit: number = 50): IndiaCity[] {
  return [...indiaCities]
    .sort((a, b) => {
      // Sort by tier first, then population
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.population - a.population;
    })
    .slice(0, limit);
}

/**
 * Get a category by its slug.
 */
export function getCategoryBySlug(slug: string): { name: string; slug: string } | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/**
 * Check if a slug is a known category.
 */
export function isCategorySlug(slug: string): boolean {
  return CATEGORY_SLUGS.includes(slug as (typeof CATEGORY_SLUGS)[number]);
}

/**
 * Check if a slug is a known city (direct or alias).
 */
export function isCitySlug(slug: string): boolean {
  return getCityBySlug(slug) !== undefined;
}

/**
 * Check if a slug is a known state.
 */
export function isStateSlug(slug: string): boolean {
  return getStateBySlug(slug) !== undefined;
}

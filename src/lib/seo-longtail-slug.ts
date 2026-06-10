import { slugify } from "@/lib/slugify";

/** Two-segment SEO slug: "{segment1}/{segment2}" (e.g. vip-escorts/bangalore). */
export function buildTwoSegmentSeoSlug(segment1: string, segment2: string): string {
  const a = segment1.trim().replace(/^\/+|\/+$/g, "");
  const b = segment2.trim().replace(/^\/+|\/+$/g, "");
  return `${a}/${b}`;
}

/** Public path for two-segment SEO pages. */
export function buildTwoSegmentCanonicalUrl(segment1: string, segment2: string): string {
  return `/${buildTwoSegmentSeoSlug(segment1, segment2)}`;
}

/** Strip trailing city name from a keyword phrase. */
export function extractPhraseBeforeCity(keyword: string, cityName: string): string {
  return keyword.replace(new RegExp(`\\s*${cityName}\\s*$`, "i"), "").trim() || keyword;
}

/** Longtail pageSlug + canonical from phrase text and city slug. */
export function buildLongtailSlugAndUrl(phrase: string, citySlug: string): {
  pageSlug: string;
  canonicalUrl: string;
  phraseSlug: string;
} {
  const phraseSlug = slugify(phrase);
  const pageSlug = buildTwoSegmentSeoSlug(phraseSlug, citySlug);
  return {
    phraseSlug,
    pageSlug,
    canonicalUrl: buildTwoSegmentCanonicalUrl(phraseSlug, citySlug),
  };
}

export function isSingleSegmentSeoSlug(pageSlug: string): boolean {
  return !!pageSlug.trim() && !pageSlug.includes("/");
}

/**
 * Convert hyphenated single-segment slug to two-segment when suffix matches a city slug.
 * russian-escorts-hyderabad → russian-escorts/hyderabad
 */
export function proposeLongtailSlugRepair(pageSlug: string, citySlugs: string[]): string | null {
  const sorted = [...citySlugs].sort((a, b) => b.length - a.length);
  for (const citySlug of sorted) {
    const suffix = `-${citySlug}`;
    if (pageSlug.endsWith(suffix) && pageSlug.length > suffix.length) {
      const prefix = pageSlug.slice(0, -suffix.length);
      if (prefix) return buildTwoSegmentSeoSlug(prefix, citySlug);
    }
  }
  return null;
}

/**
 * Convert category_city hyphen form: escorts-hyderabad → escorts/hyderabad
 */
export function proposeCategoryCitySlugRepair(
  pageSlug: string,
  categorySlugs: string[],
  citySlugs: string[],
): string | null {
  const citySet = new Set(citySlugs);
  for (const catSlug of categorySlugs) {
    const prefix = `${catSlug}-`;
    if (pageSlug.startsWith(prefix)) {
      const rest = pageSlug.slice(prefix.length);
      if (citySet.has(rest)) {
        return buildTwoSegmentSeoSlug(catSlug, rest);
      }
    }
  }
  return null;
}

export function proposeSeoSlugRepair(
  pageSlug: string,
  pageType: string,
  citySlugs: string[],
  categorySlugs: string[] = [],
): string | null {
  if (!isSingleSegmentSeoSlug(pageSlug)) return null;
  if (pageType === "category_city") {
    return proposeCategoryCitySlugRepair(pageSlug, categorySlugs, citySlugs);
  }
  if (pageType === "longtail") {
    return proposeLongtailSlugRepair(pageSlug, citySlugs);
  }
  return null;
}

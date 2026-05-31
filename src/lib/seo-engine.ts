/**
 * Production SEO content engine router.
 * Set SEO_ENGINE=v5 (default). All generation paths must import from this module.
 */

import { generateV5CitySEO } from "@/lib/seo-city-content-v5";
import {
  generateCategorySEO,
  generateCategoryCitySEO,
  generateStateSEO,
  generateCountrySEO,
  generateLongTailSEO,
  getDateModified,
  type SEOContent,
} from "@/lib/seo-content";

export const SEO_ENGINE_VERSION = "v5" as const;
export type SeoEngineVersion = typeof SEO_ENGINE_VERSION;

/** Active engine — only v5 is supported in production. */
export function getActiveSeoEngine(): SeoEngineVersion {
  const env = process.env.SEO_ENGINE?.trim().toLowerCase();
  if (env && env !== "v5") {
    throw new Error(
      `Unsupported SEO_ENGINE="${process.env.SEO_ENGINE}". Only SEO_ENGINE=v5 is supported.`,
    );
  }
  return "v5";
}

function assertV5Engine(): void {
  getActiveSeoEngine();
}

function dedupeLinks<T extends { url: string }>(links: T[]): T[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function mergeV5CityBody(shell: SEOContent, v5: ReturnType<typeof generateV5CitySEO>): SEOContent {
  const introParagraph = v5.introContent.split("\n\n")[0] ?? v5.introContent;
  return {
    ...shell,
    introParagraph,
    fullIntroContent: v5.introContent,
    faqs: v5.faqs.length > 0 ? v5.faqs : shell.faqs,
    internalLinks: dedupeLinks([...v5.internalLinks, ...shell.internalLinks]),
    cityEnrichment: v5.cityEnrichment,
    lastUpdated: getDateModified(),
    // Phase 2: keyword fields
    primaryKeyword: v5.primaryKeyword,
    secondaryKeywords: v5.secondaryKeywords,
  };
}

function v5CityToSEOContent(
  v5: ReturnType<typeof generateV5CitySEO>,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  countryName: string,
): SEOContent {
  const countrySlug =
    countryName.toLowerCase() === "india"
      ? "india"
      : countryName.toLowerCase().replace(/\s+/g, "-");
  const introParagraph = v5.introContent.split("\n\n")[0] ?? v5.introContent;
  const highlights = [
    ...v5.cityEnrichment.neighborhoods,
    ...v5.cityEnrichment.landmarks,
    ...v5.cityEnrichment.nightlife,
  ].slice(0, 8);

  return {
    title: v5.title,
    metaDescription: v5.metaDescription,
    h1: v5.h1,
    introParagraph,
    fullIntroContent: v5.introContent,
    cityEnrichment: v5.cityEnrichment,
    faqs: v5.faqs,
    breadcrumbItems: [
      { name: "Home", url: "/" },
      { name: countryName, url: `/${countrySlug}` },
      { name: stateName, url: `/${countrySlug}/${stateSlug || v5.cityEnrichment.stateSlug || "state"}` },
      { name: cityName, url: `/${countrySlug}/${stateSlug}/${citySlug}` },
    ],
    internalLinks: v5.internalLinks,
    cityHighlights: highlights,
    authorInfo: {
      name: "SecretZa Editorial Team",
      role: "SEO Content Editor",
    },
    pageType: "city",
    lastUpdated: getDateModified(),
    // Phase 2: keyword fields
    primaryKeyword: v5.primaryKeyword,
    secondaryKeywords: v5.secondaryKeywords,
  };
}

/** V5 city page content (/india/state/city). */
export function generateCitySEOContent(
  cityName: string,
  citySlug: string,
  stateName: string,
  countryName: string = "India",
  options?: { stateSlug?: string; dbAreas?: string[] },
): SEOContent {
  assertV5Engine();
  const stateSlug = options?.stateSlug ?? "";
  const v5 = generateV5CitySEO(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    options?.dbAreas,
  );
  return v5CityToSEOContent(v5, cityName, citySlug, stateName, stateSlug, countryName);
}

/** V5 category page content (/category/slug). */
export function generateCategorySEOContent(
  categoryName: string,
  categorySlug: string,
  description?: string,
): SEOContent {
  assertV5Engine();
  return generateCategorySEO(categoryName, categorySlug, description);
}

/** V5 category+city content (/{category}/{city}). */
export function generateCategoryCitySEOContent(
  categoryName: string,
  categorySlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
): SEOContent {
  assertV5Engine();
  const v5 = generateV5CitySEO(cityName, citySlug, stateName, stateSlug, dbAreas);
  const shell = generateCategoryCitySEO(
    categoryName,
    categorySlug,
    cityName,
    citySlug,
    stateName,
  );
  return mergeV5CityBody(shell, v5);
}

/** V5 state page content. */
export function generateStateSEOContent(
  stateName: string,
  stateSlug: string,
  countryName: string = "India",
): SEOContent {
  assertV5Engine();
  return generateStateSEO(stateName, stateSlug, countryName);
}

/** V5 country page content. */
export function generateCountrySEOContent(
  countryName: string,
  countrySlug: string,
): SEOContent {
  assertV5Engine();
  return generateCountrySEO(countryName, countrySlug);
}

/** V5 longtail keyword+city content (/{keyword}/{city}). */
export function generateLongTailSEOContent(
  keyword: string,
  keywordSlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
): SEOContent {
  assertV5Engine();
  const v5 = generateV5CitySEO(cityName, citySlug, stateName, stateSlug, dbAreas);
  const shell = generateLongTailSEO(keyword, keywordSlug, cityName, citySlug);
  return mergeV5CityBody(shell, v5);
}

/** Engine metadata for admin dashboards and audits. */
export function getSeoEngineInfo() {
  return {
    activeEngine: getActiveSeoEngine(),
    version: SEO_ENGINE_VERSION,
    envVar: process.env.SEO_ENGINE ?? "(default v5)",
    cityEngine: "seo-city-content-v5",
    enrichment: "seo-city-enrichment-improved (via V5)",
    removedPaths: ["v3 city variants (seo-content generateCitySEO)", "v4 generateImprovedCitySEO production"],
  };
}

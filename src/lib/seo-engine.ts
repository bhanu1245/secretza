/**
 * Low-level SEO city body router (V6.1 modules).
 *
 * **Canonical entry point:** `@/lib/seo-universal-engine` → `generateUniversalSeoContent()`.
 * All production workflows (bulk, regen, studio, admin) route through the universal engine.
 * This module provides city-body primitives; set SEO_ENGINE=v5 only for legacy fallback.
 */

import { generateV5CitySEO } from "@/lib/seo-city-content-v5";
import { generateUniqueV5CitySEO } from "@/lib/seo-unique-generation";
import { generateV6CitySEO } from "@/lib/seo-city-content-v6";
import { generateUniqueV6CitySEO } from "@/lib/seo-unique-generation-v6";
import { fetchCityListingContext } from "@/lib/seo-dynamic-listing-context";
import type { CityEnrichment } from "@/lib/seo-city-enrichment";
import {
  generateCategorySEO,
  generateCategoryCitySEO,
  generateStateSEO,
  generateCountrySEO,
  generateLongTailSEO,
  getDateModified,
  type SEOContent,
} from "@/lib/seo-content";

export type SeoEngineVersion = "v5" | "v6" | "v6.1";
export const SEO_ENGINE_VERSION: SeoEngineVersion = "v6.1";

/** Active engine — v6.1 default; set SEO_ENGINE=v5 for legacy only. */
export function getActiveSeoEngine(): SeoEngineVersion {
  const env = process.env.SEO_ENGINE?.trim().toLowerCase();
  if (env === "v5") return "v5";
  if (env === "v6.1" || env === "v6" || !env) return "v6.1";
  throw new Error(
    `Unsupported SEO_ENGINE="${process.env.SEO_ENGINE}". Use SEO_ENGINE=v6.1 or SEO_ENGINE=v5.`,
  );
}

function dedupeLinks<T extends { url: string }>(links: T[]): T[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

type CityBody = {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ text: string; url: string; type: "city" | "category" | "search" }>;
  primaryKeyword: string;
  secondaryKeywords: string[];
  cityEnrichment: CityEnrichment;
  generationMeta?: Record<string, unknown>;
};

function v6ToCityBody(v6: Awaited<ReturnType<typeof generateUniqueV6CitySEO>>): CityBody {
  const i = v6.localIntelligence;
  const enrichment: CityEnrichment = {
    slug: i.slug,
    name: i.city,
    stateName: i.stateName,
    stateSlug: i.stateSlug,
    description: i.description,
    landmarks: i.landmarks,
    neighborhoods: i.luxuryAreas,
    nightlife: i.nightlife,
    tourism: i.touristAttractions,
    business: i.businessDistricts,
    hotels: i.hotels,
    transportHubs: [...i.railwayStations, ...i.busStands, ...i.airports],
    searchIntents: [],
    nearbyCities: i.nearbyCities,
    sellingPoints: i.economy.slice(0, 3),
    tier: 2,
    contentVariant: 0,
    faqGroup: 0,
  };
  return {
    title: v6.title,
    metaDescription: v6.metaDescription,
    h1: v6.h1,
    introContent: v6.introContent,
    faqs: v6.faqs,
    internalLinks: v6.internalLinks,
    primaryKeyword: v6.primaryKeyword,
    secondaryKeywords: v6.secondaryKeywords,
    cityEnrichment: enrichment,
    generationMeta: {
      engine: v6.uniquenessMeta.engine,
      mode: v6.uniquenessMeta.mode,
      retriesUsed: v6.uniquenessMeta.retriesUsed,
      attemptsUsed: v6.uniquenessMeta.retriesUsed,
      candidatesEvaluated: v6.uniquenessMeta.candidatesEvaluated,
      candidateCount: v6.uniquenessMeta.candidateCount,
      candidateSelected: v6.uniquenessMeta.candidateSelected,
      paragraphsRewritten: v6.uniquenessMeta.paragraphsRewritten,
      intelligenceSource: v6.uniquenessMeta.intelligenceSource,
      writingStyle: v6.uniquenessMeta.writingStyle,
      architecture: v6.uniquenessMeta.architecture,
      localReferenceCount: v6.uniquenessMeta.localReferenceCount,
      earlyExit: v6.uniquenessMeta.earlyExit,
      listingContextFetchedAt: v6.uniquenessMeta.listingContextFetchedAt,
      duplicateConflictsFixed: v6.uniquenessMeta.duplicateConflictsFixed,
    },
  };
}

function v5ToCityBody(v5: ReturnType<typeof generateV5CitySEO>): CityBody {
  return {
    title: v5.title,
    metaDescription: v5.metaDescription,
    h1: v5.h1,
    introContent: v5.introContent,
    faqs: v5.faqs,
    internalLinks: v5.internalLinks,
    primaryKeyword: v5.primaryKeyword,
    secondaryKeywords: v5.secondaryKeywords,
    cityEnrichment: v5.cityEnrichment,
  };
}

function mergeCityBody(shell: SEOContent, body: CityBody): SEOContent {
  const introParagraph = body.introContent.split("\n\n")[0] ?? body.introContent;
  return {
    ...shell,
    introParagraph,
    fullIntroContent: body.introContent,
    faqs: body.faqs.length > 0 ? body.faqs : shell.faqs,
    internalLinks: dedupeLinks([...body.internalLinks, ...shell.internalLinks]),
    cityEnrichment: body.cityEnrichment,
    lastUpdated: getDateModified(),
    primaryKeyword: body.primaryKeyword,
    secondaryKeywords: body.secondaryKeywords,
    generationMeta: body.generationMeta,
  };
}

function cityBodyToSEOContent(
  body: CityBody,
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
  const introParagraph = body.introContent.split("\n\n")[0] ?? body.introContent;
  const highlights = [
    ...body.cityEnrichment.neighborhoods,
    ...body.cityEnrichment.landmarks,
    ...body.cityEnrichment.nightlife,
  ].slice(0, 8);

  return {
    title: body.title,
    metaDescription: body.metaDescription,
    h1: body.h1,
    introParagraph,
    fullIntroContent: body.introContent,
    cityEnrichment: body.cityEnrichment,
    faqs: body.faqs,
    breadcrumbItems: [
      { name: "Home", url: "/" },
      { name: countryName, url: `/country/${countrySlug}` },
      { name: stateName, url: `/${countrySlug}/${stateSlug || body.cityEnrichment.stateSlug || "state"}` },
      { name: cityName, url: `/${countrySlug}/${stateSlug}/${citySlug}` },
    ],
    internalLinks: body.internalLinks,
    cityHighlights: highlights,
    authorInfo: {
      name: "SecretZa Editorial Team",
      role: "SEO Content Editor",
    },
    pageType: "city",
    lastUpdated: getDateModified(),
    primaryKeyword: body.primaryKeyword,
    secondaryKeywords: body.secondaryKeywords,
    generationMeta: body.generationMeta,
  };
}

async function generateUniqueCityBody(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  countrySlug = "india",
  excludePageId?: string,
): Promise<CityBody> {
  const engine = getActiveSeoEngine();
  if (engine !== "v5") {
    const listingContext = await fetchCityListingContext(citySlug);
    const v6 = await generateUniqueV6CitySEO(
      cityName,
      citySlug,
      stateName,
      stateSlug,
      dbAreas,
      countrySlug,
      { excludePageId, listingContext },
    );
    return v6ToCityBody(v6);
  }
  const v5 = await generateUniqueV5CitySEO(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    dbAreas,
    countrySlug,
    { excludePageId },
  );
  return v5ToCityBody(v5);
}

function generateCityBody(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  countrySlug = "india",
): CityBody {
  const engine = getActiveSeoEngine();
  if (engine !== "v5") {
    const v6 = generateV6CitySEO(cityName, citySlug, stateName, stateSlug, dbAreas, countrySlug);
    const body = v6ToCityBody({
      ...v6,
      uniquenessMeta: {
        engine: "v6.1",
        mode: "full",
        writingStyle: v6.writingStyle,
        architecture: v6.architecture,
        attempt: 0,
        candidateCount: 1,
        candidateSelected: 0,
        candidatesEvaluated: 1,
        earlyExit: false,
        uniquenessReport: {
          overall: 0,
          introScore: 0,
          paragraphMinScore: 0,
          faqScore: 0,
          lexicalDiversity: 0,
          semanticPenalty: 0,
          duplicatePhraseCount: 0,
          fingerprintCollisions: 0,
          maxIntroSimilarity: 0,
          seoEstimate: 0,
        },
        v6Score: {
          overall: 0,
          introScore: 0,
          paragraphMinScore: 0,
          faqScore: 0,
          lexicalDiversity: 0,
          semanticPenalty: 0,
          duplicatePhraseCount: 0,
          fingerprintCollisions: 0,
          maxIntroSimilarity: 0,
          seoEstimate: 0,
          compositeScore: 0,
          localRelevance: 0,
          readability: 0,
        },
        localReferenceCount: v6.localReferenceCount,
        paragraphsRewritten: 0,
        intelligenceSource: v6.localIntelligence.source,
        retriesUsed: 0,
      },
    });
    return body;
  }
  return v5ToCityBody(
    generateV5CitySEO(cityName, citySlug, stateName, stateSlug, dbAreas, countrySlug),
  );
}

/** Uniqueness-targeted city content (V6: 85%+ via local intelligence engine). */
export async function generateUniqueCitySEOContent(
  cityName: string,
  citySlug: string,
  stateName: string,
  countryName: string = "India",
  options?: { stateSlug?: string; dbAreas?: string[]; excludePageId?: string },
): Promise<SEOContent> {
  const stateSlug = options?.stateSlug ?? "";
  const countrySlug =
    countryName.toLowerCase() === "india"
      ? "india"
      : countryName.toLowerCase().replace(/\s+/g, "-");
  const body = await generateUniqueCityBody(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    options?.dbAreas,
    countrySlug,
    options?.excludePageId,
  );
  return cityBodyToSEOContent(body, cityName, citySlug, stateName, stateSlug, countryName);
}

/** City page content (/india/state/city). */
export function generateCitySEOContent(
  cityName: string,
  citySlug: string,
  stateName: string,
  countryName: string = "India",
  options?: { stateSlug?: string; dbAreas?: string[] },
): SEOContent {
  const stateSlug = options?.stateSlug ?? "";
  const countrySlug =
    countryName.toLowerCase() === "india"
      ? "india"
      : countryName.toLowerCase().replace(/\s+/g, "-");
  const body = generateCityBody(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    options?.dbAreas,
    countrySlug,
  );
  return cityBodyToSEOContent(body, cityName, citySlug, stateName, stateSlug, countryName);
}

export function generateCategorySEOContent(
  categoryName: string,
  categorySlug: string,
  description?: string,
): SEOContent {
  return generateCategorySEO(categoryName, categorySlug, description);
}

export function generateCategoryCitySEOContent(
  categoryName: string,
  categorySlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
): SEOContent {
  const countrySlug = "india";
  const body = generateCityBody(cityName, citySlug, stateName, stateSlug, dbAreas, countrySlug);
  const shell = generateCategoryCitySEO(
    categoryName,
    categorySlug,
    cityName,
    citySlug,
    stateName,
  );
  return mergeCityBody(shell, body);
}

export async function generateUniqueCategoryCitySEOContent(
  categoryName: string,
  categorySlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  excludePageId?: string,
): Promise<SEOContent> {
  const countrySlug = "india";
  const body = await generateUniqueCityBody(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    dbAreas,
    countrySlug,
    excludePageId,
  );
  const shell = generateCategoryCitySEO(
    categoryName,
    categorySlug,
    cityName,
    citySlug,
    stateName,
  );
  return mergeCityBody(shell, body);
}

export function generateStateSEOContent(
  stateName: string,
  stateSlug: string,
  countryName: string = "India",
): SEOContent {
  return generateStateSEO(stateName, stateSlug, countryName);
}

export function generateCountrySEOContent(
  countryName: string,
  countrySlug: string,
): SEOContent {
  return generateCountrySEO(countryName, countrySlug);
}

export function generateLongTailSEOContent(
  keyword: string,
  keywordSlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
): SEOContent {
  const countrySlug = "india";
  const body = generateCityBody(cityName, citySlug, stateName, stateSlug, dbAreas, countrySlug);
  const shell = generateLongTailSEO(keyword, keywordSlug, cityName, citySlug);
  return mergeCityBody(shell, body);
}

export async function generateUniqueLongTailSEOContent(
  keyword: string,
  keywordSlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  excludePageId?: string,
): Promise<SEOContent> {
  const countrySlug = "india";
  const body = await generateUniqueCityBody(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    dbAreas,
    countrySlug,
    excludePageId,
  );
  const shell = generateLongTailSEO(keyword, keywordSlug, cityName, citySlug);
  return mergeCityBody(shell, body);
}

/** Engine metadata for admin dashboards and audits. */
export function getSeoEngineInfo() {
  const engine = getActiveSeoEngine();
  if (engine === "v5") {
    return {
      activeEngine: "v5",
      version: "v5",
      envVar: process.env.SEO_ENGINE ?? "(default v6.1)",
      cityEngine: "seo-city-content-v5 + seo-unique-generation (legacy)",
      enrichment: "seo-city-enrichment-improved (via V5)",
      uniquenessEngine: "V5: 4 candidates, 10 attempts, 80%+ target",
      localIntelligence: false,
      universalService: "seo-universal-engine (v5 fallback)",
      removedPaths: ["v3 city variants", "v4 generateImprovedCitySEO production"],
    };
  }
  return {
    activeEngine: "v6.1",
    version: "v6.1",
    envVar: process.env.SEO_ENGINE ?? "(default v6.1)",
    cityEngine: "seo-universal-engine → seo-city-content-v6 + seo-unique-generation-v6",
    enrichment: "seo-local-intelligence + seo-dynamic-listing-context",
    uniquenessEngine: "V6.1: 3 candidates, 3 attempts, partial rewrite, fingerprinting",
    localIntelligence: true,
    universalService: "seo-universal-engine",
    removedPaths: ["v3 city variants", "v4 generateImprovedCitySEO production", "parallel page generators"],
  };
}

import { db } from "@/lib/db";
import { generateUniversalSeoContent } from "@/lib/seo-universal-engine";
import { generateKeywordPhraseSEO } from "@/lib/seo-keyword-content";
import { loadCitySeoContext, type CitySeoContext } from "@/lib/seo-granular-generation";
import {
  buildLongtailSlugAndUrl,
  buildTwoSegmentCanonicalUrl,
  extractPhraseBeforeCity,
} from "@/lib/seo-longtail-slug";
import { slugify } from "@/lib/slugify";
import {
  upsertFromContent,
  type SeoPageType,
} from "@/lib/seo-page-service";
import type { SEOContent } from "@/lib/seo-content";

export type KeywordPageTypeOption = "auto" | "longtail" | "city" | "category" | "custom";

export type KeywordGenerationMode = "keywords" | "keyword_city";

export interface KeywordEntry {
  keyword: string;
  slug: string;
  pageType: SeoPageType;
  canonicalUrl: string;
  exists: boolean;
  willGenerate: boolean;
}

export interface KeywordPreviewResult {
  mode: KeywordGenerationMode;
  pageTypeOption: KeywordPageTypeOption;
  keywordCount: number;
  toGenerate: number;
  toSkip: number;
  total: number;
  cityId?: string;
  cityName?: string;
  entries: KeywordEntry[];
}

export interface KeywordGenerateResult {
  generated: number;
  skipped: number;
  failed: number;
  total: number;
  entries: Array<KeywordEntry & { error?: string }>;
  cityName?: string;
  cityId?: string;
}

type CityMatcher = {
  name: string;
  slug: string;
  stateName: string;
  stateSlug: string;
  countryName: string;
  countrySlug: string;
};

type CategoryMatcher = { name: string; slug: string };

let cityMatcherCache: CityMatcher[] | null = null;
let categoryMatcherCache: CategoryMatcher[] | null = null;

export function resolveSeoKeywordAccess(role: string | undefined): 401 | 403 | null {
  if (!role) return 401;
  if (role.toLowerCase() !== "admin") return 403;
  return null;
}

/** Trim, drop empty lines, dedupe case-insensitively while preserving first casing. */
export function normalizeKeywordList(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of raw) {
    const trimmed = line.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/** Normalize keywords and dedupe by slug so preview matches final generation. */
export function normalizeKeywordsForGeneration(raw: string[]): string[] {
  const seenSlugs = new Set<string>();
  const result: string[] = [];
  for (const keyword of normalizeKeywordList(raw)) {
    const slug = slugFromKeyword(keyword);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    result.push(keyword);
  }
  return result;
}

export function slugFromKeyword(keyword: string): string {
  return slugify(keyword);
}

/** Parse CSV text; uses first column when header row contains "keyword". */
export function parseKeywordCsv(csvText: string): string[] {
  const lines = csvText.split(/\r?\n/);
  const keywords: string[] = [];
  let startIndex = 0;

  if (lines.length > 0) {
    const header = lines[0]!.toLowerCase();
    if (header.includes("keyword")) startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const firstCell = line.split(",")[0]?.trim().replace(/^"|"$/g, "") ?? "";
    if (firstCell) keywords.push(firstCell);
  }
  return keywords;
}

export function mergeKeywordSources(textareaLines: string[], csvLines: string[]): string[] {
  return normalizeKeywordsForGeneration([...textareaLines, ...csvLines]);
}

export function splitKeywordLines(text: string): string[] {
  return text.split(/\r?\n/);
}

async function loadCityMatchers(): Promise<CityMatcher[]> {
  if (cityMatcherCache) return cityMatcherCache;
  const rows = await db.city.findMany({
    select: {
      name: true,
      slug: true,
      state: {
        select: {
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
      },
    },
  });
  cityMatcherCache = rows
    .filter((r) => r.state)
    .map((r) => ({
      name: r.name,
      slug: r.slug,
      stateName: r.state!.name,
      stateSlug: r.state!.slug,
      countryName: r.state!.country?.name || "India",
      countrySlug: r.state!.country?.slug || "india",
    }))
    .sort((a, b) => b.name.length - a.name.length);
  return cityMatcherCache;
}

async function loadCategoryMatchers(): Promise<CategoryMatcher[]> {
  if (categoryMatcherCache) return categoryMatcherCache;
  const rows = await db.category.findMany({
    where: { isActive: true, parentId: null },
    select: { name: true, slug: true },
  });
  categoryMatcherCache = rows;
  return categoryMatcherCache;
}

export function extractCityFromKeyword(
  keyword: string,
  cities: CityMatcher[],
): { phrase: string; city: CityMatcher } | null {
  const normalized = keyword.trim();
  const lower = normalized.toLowerCase();
  for (const city of cities) {
    const cityLower = city.name.toLowerCase();
    if (lower === cityLower) {
      return { phrase: city.name, city };
    }
    if (lower.endsWith(` ${cityLower}`)) {
      const phrase = normalized.slice(0, normalized.length - city.name.length).trim();
      return { phrase: phrase || normalized, city };
    }
  }
  return null;
}

export function resolveKeywordPageType(
  keyword: string,
  slug: string,
  option: KeywordPageTypeOption,
  cities: CityMatcher[],
  categories: CategoryMatcher[],
): SeoPageType {
  if (option === "longtail" || option === "custom") return "longtail";
  if (option === "city") return "city";
  if (option === "category") return "category";

  const category = categories.find((c) => c.slug === slug || c.name.toLowerCase() === keyword.toLowerCase());
  if (category) return "category";

  const city = cities.find((c) => c.slug === slug || c.name.toLowerCase() === keyword.toLowerCase());
  if (city) return "city";

  if (extractCityFromKeyword(keyword, cities)) return "longtail";

  return "longtail";
}

export function buildCanonicalUrl(
  pageType: SeoPageType,
  slug: string,
  context?: {
    city?: CityMatcher;
    category?: CategoryMatcher;
    parsed?: { phraseSlug: string; city: CityMatcher };
  },
): string {
  if (pageType === "category" && context?.category) {
    return `/${context.category.slug}`;
  }
  if (pageType === "city" && context?.city) {
    return `/${context.city.countrySlug}/${context.city.stateSlug}/${context.city.slug}`;
  }
  if (pageType === "longtail" && context?.parsed) {
    return buildTwoSegmentCanonicalUrl(context.parsed.phraseSlug, context.parsed.city.slug);
  }
  return `/${slug}`;
}

function resolveKeywordSlugAndUrl(
  keyword: string,
  pageType: SeoPageType,
  context: {
    exactCity?: CityMatcher;
    exactCategory?: CategoryMatcher;
    parsed?: { phrase: string; city: CityMatcher } | null;
    cityContext?: CitySeoContext | null;
  },
): { slug: string; canonicalUrl: string } {
  if (pageType === "longtail") {
    if (context.parsed) {
      const { pageSlug, canonicalUrl } = buildLongtailSlugAndUrl(
        context.parsed.phrase,
        context.parsed.city.slug,
      );
      return { slug: pageSlug, canonicalUrl };
    }
    if (context.cityContext) {
      const phrase = extractPhraseBeforeCity(keyword, context.cityContext.cityName);
      const { pageSlug, canonicalUrl } = buildLongtailSlugAndUrl(phrase, context.cityContext.citySlug);
      return { slug: pageSlug, canonicalUrl };
    }
  }

  const slug = slugFromKeyword(keyword);
  const canonicalUrl = buildCanonicalUrl(pageType, slug, {
    city: context.exactCity,
    category: context.exactCategory,
    parsed: context.parsed
      ? { phraseSlug: slugify(context.parsed.phrase), city: context.parsed.city }
      : undefined,
  });
  return { slug, canonicalUrl };
}

export async function buildKeywordEntries(params: {
  keywords: string[];
  pageTypeOption: KeywordPageTypeOption;
  mode: KeywordGenerationMode;
  cityContext?: CitySeoContext | null;
}): Promise<KeywordEntry[]> {
  const [cities, categories] = await Promise.all([loadCityMatchers(), loadCategoryMatchers()]);
  const lines =
    params.mode === "keyword_city" && params.cityContext
      ? params.keywords.map((k) => `${k.trim()} ${params.cityContext!.cityName}`.trim())
      : params.keywords;

  const entries: KeywordEntry[] = [];
  for (const keyword of lines) {
    const fallbackSlug = slugFromKeyword(keyword);
    if (!fallbackSlug) continue;

    const pageType = resolveKeywordPageType(
      keyword,
      fallbackSlug,
      params.pageTypeOption,
      cities,
      categories,
    );
    const exactCity = cities.find(
      (c) => c.slug === fallbackSlug || c.name.toLowerCase() === keyword.toLowerCase(),
    );
    const exactCategory = categories.find(
      (c) => c.slug === fallbackSlug || c.name.toLowerCase() === keyword.toLowerCase(),
    );
    const parsed = extractCityFromKeyword(keyword, cities);

    const { slug, canonicalUrl } = resolveKeywordSlugAndUrl(keyword, pageType, {
      exactCity,
      exactCategory,
      parsed,
      cityContext: params.cityContext,
    });

    entries.push({
      keyword,
      slug,
      pageType,
      canonicalUrl,
      exists: false,
      willGenerate: true,
    });
  }

  return entries;
}

async function markExistingEntries(entries: KeywordEntry[]): Promise<KeywordEntry[]> {
  if (entries.length === 0) return entries;

  const existingRows = await db.seoPage.findMany({
    where: {
      OR: entries.map((e) => ({ pageType: e.pageType, pageSlug: e.slug })),
    },
    select: { pageType: true, pageSlug: true },
  });
  const existing = new Set(existingRows.map((r) => `${r.pageType}:${r.pageSlug}`));

  return entries.map((entry) => {
    const exists = existing.has(`${entry.pageType}:${entry.slug}`);
    return {
      ...entry,
      exists,
      willGenerate: !exists,
    };
  });
}

export async function previewKeywordGeneration(params: {
  keywords: string[];
  pageTypeOption: KeywordPageTypeOption;
  mode: KeywordGenerationMode;
  cityId?: string;
}): Promise<KeywordPreviewResult | null> {
  const normalized = normalizeKeywordsForGeneration(params.keywords);
  if (normalized.length === 0) {
    return {
      mode: params.mode,
      pageTypeOption: params.pageTypeOption,
      keywordCount: 0,
      toGenerate: 0,
      toSkip: 0,
      total: 0,
      entries: [],
    };
  }

  let cityContext: CitySeoContext | null = null;
  if (params.mode === "keyword_city") {
    if (!params.cityId) return null;
    cityContext = await loadCitySeoContext(params.cityId);
    if (!cityContext) return null;
  }

  const built = await buildKeywordEntries({
    keywords: normalized,
    pageTypeOption: params.pageTypeOption,
    mode: params.mode,
    cityContext,
  });
  const entries = await markExistingEntries(built);
  const toSkip = entries.filter((e) => e.exists).length;

  return {
    mode: params.mode,
    pageTypeOption: params.pageTypeOption,
    keywordCount: normalized.length,
    toGenerate: entries.length - toSkip,
    toSkip,
    total: entries.length,
    cityId: cityContext?.cityId,
    cityName: cityContext?.cityName,
    entries,
  };
}

async function generateContentForEntry(
  entry: KeywordEntry,
  cities: CityMatcher[],
  categories: CategoryMatcher[],
  cityContext?: CitySeoContext | null,
): Promise<SEOContent> {
  const exactCity = cities.find(
    (c) => c.slug === entry.slug || c.name.toLowerCase() === entry.keyword.toLowerCase(),
  );
  const exactCategory = categories.find(
    (c) => c.slug === entry.slug || c.name.toLowerCase() === entry.keyword.toLowerCase(),
  );

  if (entry.pageType === "city" && exactCity) {
    const result = await generateUniversalSeoContent({
      pageType: "city",
      citySlug: exactCity.slug,
      mode: "generate",
    });
    return result.content;
  }

  if (entry.pageType === "category" && exactCategory) {
    const result = await generateUniversalSeoContent({
      pageType: "category",
      categorySlug: exactCategory.slug,
      mode: "generate",
    });
    return result.content;
  }

  let phrase: string;
  let city: CityMatcher;

  if (cityContext) {
    phrase = entry.keyword.replace(new RegExp(`\\s*${cityContext.cityName}\\s*$`, "i"), "").trim();
    city = {
      name: cityContext.cityName,
      slug: cityContext.citySlug,
      stateName: cityContext.stateName,
      stateSlug: cityContext.stateSlug,
      countryName: cityContext.countryName,
      countrySlug: cityContext.countrySlug,
    };
  } else {
    const parsed = extractCityFromKeyword(entry.keyword, cities);
    if (parsed) {
      phrase = parsed.phrase;
      city = parsed.city;
    } else {
      return generateKeywordPhraseSEO(entry.keyword, entry.slug);
    }
  }

  const phraseSlug = slugify(phrase) || entry.slug;
  const pageSlug = `${phraseSlug}/${city.slug}`;
  const result = await generateUniversalSeoContent({
    pageType: "longtail",
    pageSlug,
    mode: "generate",
  });

  return {
    ...result.content,
    title: `${entry.keyword} - Verified ${phrase} Listings | SecretZa`,
    h1: entry.keyword,
    metaDescription:
      result.content.metaDescription ||
      `Browse verified ${phrase.toLowerCase()} in ${city.name}. Premium companion listings, photos, reviews, and direct contact details.`,
    primaryKeyword: entry.keyword,
  };
}

export async function generateKeywordPages(params: {
  keywords: string[];
  pageTypeOption: KeywordPageTypeOption;
  mode: KeywordGenerationMode;
  cityId?: string;
}): Promise<KeywordGenerateResult | null> {
  const preview = await previewKeywordGeneration(params);
  if (!preview) return null;

  const [cities, categories] = await Promise.all([loadCityMatchers(), loadCategoryMatchers()]);
  const cityContext =
    params.mode === "keyword_city" && params.cityId
      ? await loadCitySeoContext(params.cityId)
      : null;

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const resultEntries: Array<KeywordEntry & { error?: string }> = [];

  for (const entry of preview.entries) {
    if (entry.exists) {
      skipped++;
      resultEntries.push(entry);
      continue;
    }

    try {
      const content = await generateContentForEntry(entry, cities, categories, cityContext);
      await upsertFromContent(entry.pageType, entry.slug, content, entry.canonicalUrl, {
        skipImage: true,
      });
      generated++;
      resultEntries.push({ ...entry, willGenerate: true, exists: false });
    } catch (error) {
      failed++;
      resultEntries.push({
        ...entry,
        willGenerate: false,
        error: error instanceof Error ? error.message : "Generation failed",
      });
    }
  }

  return {
    generated,
    skipped,
    failed,
    total: preview.entries.length,
    entries: resultEntries,
    cityId: preview.cityId,
    cityName: preview.cityName,
  };
}

/** Reset cached matchers (for tests). */
export function resetKeywordGenerationCaches(): void {
  cityMatcherCache = null;
  categoryMatcherCache = null;
}

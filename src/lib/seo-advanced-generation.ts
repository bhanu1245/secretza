import { db } from "@/lib/db";
import { generateUniversalSeoContent } from "@/lib/seo-universal-engine";
import { loadCitySeoContext, type CitySeoContext } from "@/lib/seo-granular-generation";
import {
  normalizeKeywordsForGeneration,
  slugFromKeyword,
} from "@/lib/seo-keyword-generation";
import {
  buildCategoryCityKeywordPhrase,
  buildKeywordCityPhrase,
  buildLongtailPhrase,
  DEFAULT_LONGTAIL_KEYWORDS,
} from "@/lib/seo-longtail-templates";
import { buildLongtailSlugAndUrl, extractPhraseBeforeCity } from "@/lib/seo-longtail-slug";
import { slugify } from "@/lib/slugify";
import type { SEOContent } from "@/lib/seo-content";
import { upsertFromContent } from "@/lib/seo-page-service";
import {
  applyBulkSafetyFlags,
  PREVIEW_EXAMPLE_LIMIT,
  type AdvancedSeoEntry,
  type AdvancedSeoGenerateResult,
  type AdvancedSeoGeneratorMode,
  type AdvancedSeoPreview,
} from "@/lib/seo-advanced-generation-shared";

export {
  applyBulkSafetyFlags,
  BULK_STRICT_THRESHOLD,
  BULK_WARNING_THRESHOLD,
  PREVIEW_EXAMPLE_LIMIT,
  type AdvancedSeoEntry,
  type AdvancedSeoGenerateResult,
  type AdvancedSeoGeneratorMode,
  type AdvancedSeoPreview,
} from "@/lib/seo-advanced-generation-shared";

export function resolveSeoAdvancedAccess(role: string | undefined): 401 | 403 | null {
  if (!role) return 401;
  if (role.toLowerCase() !== "admin") return 403;
  return null;
}

function buildTitle(keyword: string, phrase: string): string {
  return `${keyword} - Verified ${phrase} Listings | SecretZa`;
}

async function buildLongtailContent(
  keyword: string,
  phrase: string,
  city: CitySeoContext,
): Promise<SEOContent> {
  const phraseSlug = slugify(phrase) || slugFromKeyword(keyword);
  const pageSlug = `${phraseSlug}/${city.citySlug}`;
  const result = await generateUniversalSeoContent({
    pageType: "longtail",
    pageSlug,
    mode: "generate",
  });

  return {
    ...result.content,
    title: buildTitle(keyword, phrase),
    h1: keyword,
    metaDescription:
      result.content.metaDescription ||
      `Browse verified ${phrase.toLowerCase()} in ${city.cityName}. Premium companion listings, photos, reviews, and direct contact details.`,
    primaryKeyword: keyword,
    pageType: "longtail",
  };
}

function toEntry(
  keyword: string,
  city: CitySeoContext,
  exists: boolean,
): AdvancedSeoEntry {
  const phrase = extractPhraseBeforeCity(keyword, city.cityName);
  const { pageSlug, canonicalUrl } = buildLongtailSlugAndUrl(phrase, city.citySlug);
  return {
    keyword,
    title: buildTitle(keyword, phrase),
    slug: pageSlug,
    pageType: "longtail",
    canonicalUrl,
    exists,
    willGenerate: !exists,
    cityId: city.cityId,
    cityName: city.cityName,
  };
}

async function loadCityContexts(cityIds: string[]): Promise<CitySeoContext[]> {
  const unique = [...new Set(cityIds.filter(Boolean))];
  const contexts = await Promise.all(unique.map((id) => loadCitySeoContext(id)));
  return contexts.filter((c): c is CitySeoContext => c !== null);
}

async function loadCategory(categoryId: string) {
  return db.category.findFirst({
    where: { id: categoryId, isActive: true, parentId: null },
    select: { id: true, name: true, slug: true },
  });
}

async function markExistingByPageSlug(entries: AdvancedSeoEntry[]): Promise<AdvancedSeoEntry[]> {
  if (entries.length === 0) return entries;

  const slugs = [...new Set(entries.map((e) => e.slug))];
  const existingRows = await db.seoPage.findMany({
    where: { pageSlug: { in: slugs } },
    select: { pageSlug: true },
  });
  const existing = new Set(existingRows.map((r) => r.pageSlug));

  return entries.map((entry) => ({
    ...entry,
    exists: existing.has(entry.slug),
    willGenerate: !existing.has(entry.slug),
  }));
}

function finalizePreview(
  mode: AdvancedSeoGeneratorMode,
  entries: AdvancedSeoEntry[],
  meta: {
    keywordCount: number;
    cityCount: number;
    cityIds: string[];
    cityNames: string[];
    categoryId?: string;
    categoryName?: string;
    templateCount?: number;
    keywords: string[];
  },
): AdvancedSeoPreview {
  const toSkip = entries.filter((e) => e.exists).length;
  const toGenerate = entries.length - toSkip;
  const safety = applyBulkSafetyFlags(entries.length);

  return {
    mode,
    keywordCount: meta.keywordCount,
    cityCount: meta.cityCount,
    cityIds: meta.cityIds,
    cityNames: meta.cityNames,
    categoryId: meta.categoryId,
    categoryName: meta.categoryName,
    templateCount: meta.templateCount,
    toGenerate,
    toSkip,
    total: entries.length,
    estimatedTotal: entries.length,
    examples: entries.slice(0, PREVIEW_EXAMPLE_LIMIT),
    entries,
    ...safety,
  };
}

export async function previewKeywordMultiCity(params: {
  keywords: string[];
  cityIds: string[];
}): Promise<AdvancedSeoPreview | null> {
  const keywords = normalizeKeywordsForGeneration(params.keywords);
  const cities = await loadCityContexts(params.cityIds);
  if (keywords.length === 0 || cities.length === 0) {
    return finalizePreview("keyword_multi_city", [], {
      keywordCount: keywords.length,
      cityCount: cities.length,
      cityIds: cities.map((c) => c.cityId),
      cityNames: cities.map((c) => c.cityName),
      keywords,
    });
  }

  const rawEntries: AdvancedSeoEntry[] = [];
  for (const keyword of keywords) {
    for (const city of cities) {
      const phrase = buildKeywordCityPhrase(keyword, city.cityName);
      rawEntries.push(toEntry(phrase, city, false));
    }
  }

  const entries = await markExistingByPageSlug(rawEntries);
  return finalizePreview("keyword_multi_city", entries, {
    keywordCount: keywords.length,
    cityCount: cities.length,
    cityIds: cities.map((c) => c.cityId),
    cityNames: cities.map((c) => c.cityName),
    keywords,
  });
}

export async function previewCityCategoryLongtail(params: {
  cityId: string;
  categoryId: string;
}): Promise<AdvancedSeoPreview | null> {
  const [city, category] = await Promise.all([
    loadCitySeoContext(params.cityId),
    loadCategory(params.categoryId),
  ]);
  if (!city || !category) return null;

  const rawEntries = DEFAULT_LONGTAIL_KEYWORDS.map((template) => {
    const phrase = buildLongtailPhrase(template, category.name, city.cityName);
    return toEntry(phrase, city, false);
  });

  const entries = await markExistingByPageSlug(rawEntries);
  return finalizePreview("city_category_longtail", entries, {
    keywordCount: DEFAULT_LONGTAIL_KEYWORDS.length,
    cityCount: 1,
    cityIds: [city.cityId],
    cityNames: [city.cityName],
    categoryId: category.id,
    categoryName: category.name,
    templateCount: DEFAULT_LONGTAIL_KEYWORDS.length,
    keywords: [...DEFAULT_LONGTAIL_KEYWORDS],
  });
}

export async function previewCityCategoryKeywords(params: {
  cityId: string;
  categoryId: string;
  keywords: string[];
}): Promise<AdvancedSeoPreview | null> {
  const keywords = normalizeKeywordsForGeneration(params.keywords);
  const [city, category] = await Promise.all([
    loadCitySeoContext(params.cityId),
    loadCategory(params.categoryId),
  ]);
  if (!city || !category) return null;

  const rawEntries = keywords.map((prefix) => {
    const phrase = buildCategoryCityKeywordPhrase(prefix, category.name, city.cityName);
    return toEntry(phrase, city, false);
  });

  const entries = await markExistingByPageSlug(rawEntries);
  return finalizePreview("city_category_keywords", entries, {
    keywordCount: keywords.length,
    cityCount: 1,
    cityIds: [city.cityId],
    cityNames: [city.cityName],
    categoryId: category.id,
    categoryName: category.name,
    keywords,
  });
}

async function generateFromPreview(
  preview: AdvancedSeoPreview,
  keywords: string[],
): Promise<AdvancedSeoGenerateResult> {
  const cityMap = new Map<string, CitySeoContext>();
  for (const id of preview.cityIds) {
    const ctx = await loadCitySeoContext(id);
    if (ctx) cityMap.set(id, ctx);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of preview.entries) {
    if (entry.exists || !entry.willGenerate) {
      skipped++;
      continue;
    }

    const cityId = entry.cityId ?? preview.cityIds[0];
    const city = cityId ? cityMap.get(cityId) : undefined;
    if (!city) {
      failed++;
      continue;
    }

    try {
      const phrase =
        entry.keyword.replace(new RegExp(`\\s*${city.cityName}\\s*$`, "i"), "").trim() ||
        entry.keyword;
      const content = await buildLongtailContent(entry.keyword, phrase, city);
      await upsertFromContent("longtail", entry.slug, content, entry.canonicalUrl, {
        skipImage: true,
      });
      generated++;
    } catch {
      failed++;
    }
  }

  return {
    generated,
    skipped,
    failed,
    total: preview.entries.length,
    cityIds: preview.cityIds,
    cityNames: preview.cityNames,
    categoryId: preview.categoryId,
    categoryName: preview.categoryName,
    keywords,
  };
}

export async function generateKeywordMultiCityPages(params: {
  keywords: string[];
  cityIds: string[];
}): Promise<AdvancedSeoGenerateResult | null> {
  const preview = await previewKeywordMultiCity(params);
  if (!preview) return null;
  const keywords = normalizeKeywordsForGeneration(params.keywords);
  return generateFromPreview(preview, keywords);
}

export async function generateCityCategoryLongtailPages(params: {
  cityId: string;
  categoryId: string;
}): Promise<AdvancedSeoGenerateResult | null> {
  const preview = await previewCityCategoryLongtail(params);
  if (!preview) return null;
  return generateFromPreview(preview, [...DEFAULT_LONGTAIL_KEYWORDS]);
}

export async function generateCityCategoryKeywordPages(params: {
  cityId: string;
  categoryId: string;
  keywords: string[];
}): Promise<AdvancedSeoGenerateResult | null> {
  const preview = await previewCityCategoryKeywords(params);
  if (!preview) return null;
  const keywords = normalizeKeywordsForGeneration(params.keywords);
  return generateFromPreview(preview, keywords);
}

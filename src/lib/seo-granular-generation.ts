import { db } from "@/lib/db";
import { SEO_LONGTAIL_KEYWORDS } from "@/lib/seo-internal-links";
import {
  generateCategoryCitySEOContent,
  generateCitySEOContent,
  generateLongTailSEOContent,
} from "@/lib/seo-engine";
import {
  upsertFromContent,
  type GenerateResult,
  type SeoPageType,
} from "@/lib/seo-page-service";

export interface CitySeoContext {
  cityId: string;
  cityName: string;
  citySlug: string;
  stateName: string;
  stateSlug: string;
  countryName: string;
  countrySlug: string;
}

export interface GranularSeoPreview {
  cityId: string;
  cityName: string;
  stateName: string;
  countryName: string;
  categoryName?: string;
  categorySlug?: string;
  toGenerate: number;
  toSkip: number;
  total: number;
  breakdown: {
    city: number;
    categoryCity: number;
    longtail: number;
  };
}

export interface GranularGenerateResult extends GenerateResult {
  cityName: string;
  stateName: string;
  countryName: string;
  categoryName?: string;
}

async function getExistingSlugsForTypes(
  types: SeoPageType[],
): Promise<Record<SeoPageType, Set<string>>> {
  const rows = await db.seoPage.findMany({
    where: { pageType: { in: types } },
    select: { pageType: true, pageSlug: true },
  });
  const map: Record<SeoPageType, Set<string>> = {
    city: new Set(),
    category: new Set(),
    category_city: new Set(),
    state: new Set(),
    country: new Set(),
    longtail: new Set(),
  };
  for (const row of rows) {
    const type = row.pageType as SeoPageType;
    if (map[type]) map[type].add(row.pageSlug);
  }
  return map;
}

export async function loadCitySeoContext(cityId: string): Promise<CitySeoContext | null> {
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: {
      id: true,
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
  if (!city?.state) return null;
  return {
    cityId: city.id,
    cityName: city.name,
    citySlug: city.slug,
    stateName: city.state.name,
    stateSlug: city.state.slug,
    countryName: city.state.country?.name || "India",
    countrySlug: city.state.country?.slug || "india",
  };
}

async function loadActiveCategories() {
  return db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

function countCityPackCandidates(
  ctx: CitySeoContext,
  categories: Array<{ slug: string }>,
  existing: Record<SeoPageType, Set<string>>,
): GranularSeoPreview {
  let cityMissing = existing.city.has(ctx.citySlug) ? 0 : 1;
  let categoryCityMissing = 0;
  let longtailMissing = 0;

  for (const category of categories) {
    const slug = `${category.slug}/${ctx.citySlug}`;
    if (!existing.category_city.has(slug)) categoryCityMissing++;
  }
  for (const keyword of SEO_LONGTAIL_KEYWORDS) {
    const slug = `${keyword.slug}/${ctx.citySlug}`;
    if (!existing.longtail.has(slug)) longtailMissing++;
  }

  const toGenerate = cityMissing + categoryCityMissing + longtailMissing;
  const total = 1 + categories.length + SEO_LONGTAIL_KEYWORDS.length;
  const toSkip = total - toGenerate;

  return {
    cityId: ctx.cityId,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    toGenerate,
    toSkip,
    total,
    breakdown: {
      city: cityMissing,
      categoryCity: categoryCityMissing,
      longtail: longtailMissing,
    },
  };
}

export async function previewCitySeoPack(cityId: string): Promise<GranularSeoPreview | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;
  const [categories, existing] = await Promise.all([
    loadActiveCategories(),
    getExistingSlugsForTypes(["city", "category_city", "longtail"]),
  ]);
  return countCityPackCandidates(ctx, categories, existing);
}

export async function previewSingleCityPage(cityId: string): Promise<GranularSeoPreview | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;
  const existing = await getExistingSlugsForTypes(["city"]);
  const toGenerate = existing.city.has(ctx.citySlug) ? 0 : 1;
  return {
    cityId: ctx.cityId,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    toGenerate,
    toSkip: 1 - toGenerate,
    total: 1,
    breakdown: { city: toGenerate, categoryCity: 0, longtail: 0 },
  };
}

export async function previewCategoryCityPage(
  cityId: string,
  categoryId: string,
): Promise<GranularSeoPreview | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;
  const category = await db.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (!category) return null;

  const existing = await getExistingSlugsForTypes(["category_city"]);
  const pageSlug = `${category.slug}/${ctx.citySlug}`;
  const toGenerate = existing.category_city.has(pageSlug) ? 0 : 1;

  return {
    cityId: ctx.cityId,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    categoryName: category.name,
    categorySlug: category.slug,
    toGenerate,
    toSkip: 1 - toGenerate,
    total: 1,
    breakdown: { city: 0, categoryCity: toGenerate, longtail: 0 },
  };
}

export async function generateCitySeoPack(cityId: string): Promise<GranularGenerateResult | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;

  const categories = await loadActiveCategories();
  const existing = await getExistingSlugsForTypes(["city", "category_city", "longtail"]);

  const examples: GenerateResult["examples"] = [];
  let created = 0;
  let skipped = 0;

  if (existing.city.has(ctx.citySlug)) {
    skipped++;
  } else {
    const seo = generateCitySEOContent(
      ctx.cityName,
      ctx.citySlug,
      ctx.stateName,
      ctx.countryName,
      { stateSlug: ctx.stateSlug },
    );
    const canonicalUrl = `/${ctx.countrySlug}/${ctx.stateSlug}/${ctx.citySlug}`;
    await upsertFromContent("city", ctx.citySlug, seo, canonicalUrl);
    created++;
    examples.push({ pageType: "city", pageSlug: ctx.citySlug, canonicalUrl, title: seo.title });
  }

  for (const category of categories) {
    const pageSlug = `${category.slug}/${ctx.citySlug}`;
    if (existing.category_city.has(pageSlug)) {
      skipped++;
      continue;
    }
    const seo = generateCategoryCitySEOContent(
      category.name,
      category.slug,
      ctx.cityName,
      ctx.citySlug,
      ctx.stateName,
      ctx.stateSlug,
    );
    const canonicalUrl = `/${category.slug}/${ctx.citySlug}`;
    await upsertFromContent("category_city", pageSlug, seo, canonicalUrl);
    created++;
    if (examples.length < 5) {
      examples.push({ pageType: "category_city", pageSlug, canonicalUrl, title: seo.title });
    }
  }

  for (const keyword of SEO_LONGTAIL_KEYWORDS) {
    const pageSlug = `${keyword.slug}/${ctx.citySlug}`;
    if (existing.longtail.has(pageSlug)) {
      skipped++;
      continue;
    }
    const seo = generateLongTailSEOContent(
      keyword.keyword,
      keyword.slug,
      ctx.cityName,
      ctx.citySlug,
      ctx.stateName,
      ctx.stateSlug,
    );
    const canonicalUrl = `/${keyword.slug}/${ctx.citySlug}`;
    await upsertFromContent("longtail", pageSlug, seo, canonicalUrl);
    created++;
    if (examples.length < 5) {
      examples.push({ pageType: "longtail", pageSlug, canonicalUrl, title: seo.title });
    }
  }

  const total = 1 + categories.length + SEO_LONGTAIL_KEYWORDS.length;
  return {
    created,
    skipped,
    total,
    examples,
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
  };
}

export async function generateSingleCitySeoPage(
  cityId: string,
): Promise<GranularGenerateResult | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;

  const existing = await getExistingSlugsForTypes(["city"]);
  if (existing.city.has(ctx.citySlug)) {
    return {
      created: 0,
      skipped: 1,
      total: 1,
      examples: [],
      cityName: ctx.cityName,
      stateName: ctx.stateName,
      countryName: ctx.countryName,
    };
  }

  const seo = generateCitySEOContent(
    ctx.cityName,
    ctx.citySlug,
    ctx.stateName,
    ctx.countryName,
    { stateSlug: ctx.stateSlug },
  );
  const canonicalUrl = `/${ctx.countrySlug}/${ctx.stateSlug}/${ctx.citySlug}`;
  await upsertFromContent("city", ctx.citySlug, seo, canonicalUrl);

  return {
    created: 1,
    skipped: 0,
    total: 1,
    examples: [{ pageType: "city", pageSlug: ctx.citySlug, canonicalUrl, title: seo.title }],
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
  };
}

export async function generateSingleCategoryCitySeoPage(
  cityId: string,
  categoryId: string,
): Promise<GranularGenerateResult | null> {
  const ctx = await loadCitySeoContext(cityId);
  if (!ctx) return null;

  const category = await db.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { slug: true, name: true },
  });
  if (!category) return null;

  const existing = await getExistingSlugsForTypes(["category_city"]);
  const pageSlug = `${category.slug}/${ctx.citySlug}`;

  if (existing.category_city.has(pageSlug)) {
    return {
      created: 0,
      skipped: 1,
      total: 1,
      examples: [],
      cityName: ctx.cityName,
      stateName: ctx.stateName,
      countryName: ctx.countryName,
      categoryName: category.name,
    };
  }

  const seo = generateCategoryCitySEOContent(
    category.name,
    category.slug,
    ctx.cityName,
    ctx.citySlug,
    ctx.stateName,
    ctx.stateSlug,
  );
  const canonicalUrl = `/${category.slug}/${ctx.citySlug}`;
  await upsertFromContent("category_city", pageSlug, seo, canonicalUrl);

  return {
    created: 1,
    skipped: 0,
    total: 1,
    examples: [{
      pageType: "category_city",
      pageSlug,
      canonicalUrl,
      title: seo.title,
    }],
    cityName: ctx.cityName,
    stateName: ctx.stateName,
    countryName: ctx.countryName,
    categoryName: category.name,
  };
}

export function resolveSeoGranularAccess(role: string | undefined): 401 | 403 | null {
  if (!role) return 401;
  if (role.toLowerCase() !== "admin") return 403;
  return null;
}

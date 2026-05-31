import { db } from "@/lib/db";
import {
  generateAndStoreSeoImage,
  enrichSchemaWithFeaturedImage,
  resolveSeoImageUrl,
  type SeoImageFields,
} from "@/lib/seo-images";
import {
  resolveIntroContentForStorage,
  type SEOContent,
} from "@/lib/seo-content";
import { buildSchemaJsonFromContent } from "@/lib/seo-schema";
import {
  generateCitySEOContent,
  generateCategorySEOContent,
  generateCategoryCitySEOContent,
  generateStateSEOContent,
  generateCountrySEOContent,
  generateLongTailSEOContent,
  getActiveSeoEngine,
} from "@/lib/seo-engine";
import {
  analyzeSeoContent,
  countWords,
  detectDuplicateFields,
  computeCompositeUniqueness,
  textSimilarity,
  type SeoPageSnapshot,
  type UniquenessBreakdown,
} from "@/lib/seo-quality";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";

export type SeoPageType =
  | "city"
  | "category"
  | "category_city"
  | "state"
  | "country"
  | "longtail";

/**
 * All generated SEO pages render through the standard public layout chain:
 * PublicSiteLayout → SeoPageView (see load*SeoPageView helpers in seo-public-page.ts).
 * Content generation uses SEO_ENGINE=v5 via @/lib/seo-engine.
 */
export const SEO_PUBLIC_PAGE_LAYOUT = "PublicSiteLayout>SeoPageView" as const;

const LONGTAIL_KEYWORDS = [
  { keyword: "Cheap Escorts", slug: "cheap-escorts" },
  { keyword: "Independent Escorts", slug: "independent-escorts" },
  { keyword: "VIP Escorts", slug: "vip-escorts" },
  { keyword: "Russian Escorts", slug: "russian-escorts" },
  { keyword: "Housewife Escorts", slug: "housewife-escorts" },
  { keyword: "College Escorts", slug: "college-escorts" },
  { keyword: "High Profile Escorts", slug: "high-profile-escorts" },
  { keyword: "Verified Escorts", slug: "verified-escorts" },
] as const;

export function buildSchemaJson(content: SEOContent, absolutePageUrl?: string): string {
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
  const lastCrumb = content.breadcrumbItems[content.breadcrumbItems.length - 1];
  const path = lastCrumb?.url || "/";
  const pageUrl =
    absolutePageUrl ||
    `${siteOrigin.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  return buildSchemaJsonFromContent(content, pageUrl);
}

export interface UpsertSeoPageInput {
  pageType: SeoPageType;
  pageSlug: string;
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  canonicalUrl: string;
  customData?: string | null;
  isPublished?: boolean;
  noindex?: boolean;
  featuredImage?: string | null;
  imageAlt?: string | null;
  imageTitle?: string | null;
  imageCaption?: string | null;
  wordCount?: number | null;
  faqCount?: number | null;
  internalLinksCount?: number | null;
  uniquenessScore?: number | null;
  duplicateRisk?: string | null;
  seoQualityScore?: number | null;
  contentHash?: string | null;
  /** Phase 2: primary keyword for this page */
  primaryKeyword?: string | null;
  /** Phase 2: JSON-serialised secondary keyword array */
  secondaryKeywords?: string | null;
}

export interface SeoQualityMetrics {
  wordCount: number;
  faqCount: number;
  internalLinksCount: number;
  uniquenessScore: number;
  duplicateRisk: string;
  seoQualityScore: number;
  contentHash: string;
  duplicateFields: ReturnType<typeof detectDuplicateFields>;
  uniquenessBreakdown?: UniquenessBreakdown;
}

/** Persist FAQs to SeoFaq table (replaces existing). */
export async function persistSeoFaqs(
  seoPageId: string,
  faqs: Array<{ question: string; answer: string }>,
): Promise<void> {
  await db.seoFaq.deleteMany({ where: { seoPageId } });
  if (faqs.length === 0) return;
  await db.seoFaq.createMany({
    data: faqs.map((faq, index) => ({
      seoPageId,
      question: faq.question,
      answer: faq.answer,
      sortOrder: index,
      isActive: true,
    })),
  });
}

/**
 * Phase 2 — persist keyword fields via raw SQL (bypasses Prisma type
 * regeneration requirement while the client DLL is locked by the dev server).
 */
export async function updateSeoPageKeywords(
  pageId: string,
  primaryKeyword: string | null | undefined,
  secondaryKeywords: string[] | null | undefined,
): Promise<void> {
  const pk = primaryKeyword ?? null;
  const sk = secondaryKeywords?.length ? JSON.stringify(secondaryKeywords) : null;
  await db.$executeRaw`
    UPDATE "SeoPage"
    SET "primaryKeyword" = ${pk},
        "secondaryKeywords" = ${sk}
    WHERE "id" = ${pageId}
  `;
}

/** Compute quality metrics for content vs existing pages. */
export async function computePageQualityMetrics(
  pageType: SeoPageType,
  pageSlug: string,
  content: SEOContent,
  introContent: string,
  options?: {
    featuredImage?: string | null;
    canonicalUrl?: string;
    excludePageId?: string;
    peers?: SeoPageSnapshot[];
  },
): Promise<SeoQualityMetrics> {
  const peers = options?.peers ?? (await getCachedPeerPages(pageType, pageSlug));
  const faqText = content.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
  const candidate: SeoPageSnapshot = {
    id: options?.excludePageId,
    pageType,
    pageSlug,
    title: content.title,
    metaDescription: content.metaDescription,
    h1: content.h1,
    introContent,
    faqText,
  };

  const duplicateFields = detectDuplicateFields(candidate, peers);

  // Exclude legacy thin-template pages (<350 words) from similarity baseline until bulk regen
  const substantivePeers = peers.filter((p) => countWords(p.introContent) >= 350);
  const comparisonPeers = substantivePeers.length >= 2 ? substantivePeers : peers;

  const otherIntros = comparisonPeers.map((p) => p.introContent ?? "").filter(Boolean);

  const breakdown = computeCompositeUniqueness({
    introContent,
    faqText,
    title: content.title,
    metaDescription: content.metaDescription,
    peerIntros: otherIntros,
    peerFaqs: comparisonPeers.map((p) => p.faqText ?? ""),
    peerTitles: comparisonPeers.map((p) => p.title ?? ""),
    peerMetas: comparisonPeers.map((p) => p.metaDescription ?? ""),
  });

  const uniquenessScore = breakdown.overall;

  let maxSimilarity = breakdown.maxIntroSimilarity;
  for (const other of otherIntros) {
    maxSimilarity = Math.max(maxSimilarity, textSimilarity(introContent, other));
  }

  const wordCount = countWords(introContent);
  const faqCount = content.faqs.length;
  const internalLinksCount = content.internalLinks?.length ?? 0;

  const analysis = analyzeSeoContent(
    {
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      introContent,
      canonicalUrl: options?.canonicalUrl,
      featuredImage: options?.featuredImage,
      faqCount,
      internalLinksCount,
      wordCount,
      uniquenessScore,
      duplicateFields,
    },
    maxSimilarity,
  );

  return {
    wordCount: analysis.wordCount,
    faqCount: analysis.faqCount,
    internalLinksCount: analysis.internalLinksCount,
    uniquenessScore: analysis.uniquenessScore,
    duplicateRisk: analysis.duplicateRisk,
    seoQualityScore: analysis.seoQualityScore,
    contentHash: analysis.contentHash,
    duplicateFields: analysis.duplicateFields,
    uniquenessBreakdown: breakdown,
  };
}

/** Upsert by unique (pageType, pageSlug) — prevents duplicate SEO pages. */
export async function upsertSeoPage(input: UpsertSeoPageInput) {
  return db.seoPage.upsert({
    where: {
      pageType_pageSlug: {
        pageType: input.pageType,
        pageSlug: input.pageSlug,
      },
    },
    create: {
      pageType: input.pageType,
      pageSlug: input.pageSlug,
      title: input.title,
      metaDescription: input.metaDescription,
      h1: input.h1,
      introContent: input.introContent,
      canonicalUrl: input.canonicalUrl,
      customData: input.customData ?? null,
      featuredImage: input.featuredImage ?? null,
      imageAlt: input.imageAlt ?? null,
      imageTitle: input.imageTitle ?? null,
      imageCaption: input.imageCaption ?? null,
      isPublished: input.isPublished ?? true,
      noindex: input.noindex ?? false,
      wordCount: input.wordCount ?? null,
      faqCount: input.faqCount ?? null,
      internalLinksCount: input.internalLinksCount ?? null,
      uniquenessScore: input.uniquenessScore ?? null,
      duplicateRisk: input.duplicateRisk ?? null,
      seoQualityScore: input.seoQualityScore ?? null,
      contentHash: input.contentHash ?? null,
    },
    update: {
      title: input.title,
      metaDescription: input.metaDescription,
      h1: input.h1,
      introContent: input.introContent,
      canonicalUrl: input.canonicalUrl,
      customData: input.customData ?? null,
      featuredImage: input.featuredImage ?? null,
      imageAlt: input.imageAlt ?? null,
      imageTitle: input.imageTitle ?? null,
      imageCaption: input.imageCaption ?? null,
      isPublished: input.isPublished ?? true,
      noindex: input.noindex ?? false,
      wordCount: input.wordCount ?? null,
      faqCount: input.faqCount ?? null,
      internalLinksCount: input.internalLinksCount ?? null,
      uniquenessScore: input.uniquenessScore ?? null,
      duplicateRisk: input.duplicateRisk ?? null,
      seoQualityScore: input.seoQualityScore ?? null,
      contentHash: input.contentHash ?? null,
    },
  });
}

export async function upsertFromContent(
  pageType: SeoPageType,
  pageSlug: string,
  content: SEOContent,
  canonicalUrl: string,
  options?: {
    skipImage?: boolean;
    existingFeaturedImage?: string | null;
    precomputedMetrics?: SeoQualityMetrics;
    excludePageId?: string;
  },
) {
  const introContent = resolveIntroContentForStorage(content);

  let featuredImage = options?.existingFeaturedImage ?? null;
  let imageAlt: string | null = null;
  let imageTitle: string | null = null;
  let imageCaption: string | null = null;

  if (!options?.skipImage) {
    const image = await generateAndStoreSeoImage({
      pageType,
      pageSlug,
      headline: content.h1,
      subtitle: content.metaDescription,
    });
    featuredImage = image.featuredImage ?? null;
    imageAlt = image.imageAlt ?? null;
    imageTitle = image.imageTitle ?? null;
    imageCaption = image.imageCaption ?? null;
  }

  const metrics =
    options?.precomputedMetrics ??
    (await computePageQualityMetrics(pageType, pageSlug, content, introContent, {
      featuredImage,
      canonicalUrl,
      excludePageId: options?.excludePageId,
    }));

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
  const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${canonicalUrl}`;
  const absoluteImage = resolveSeoImageUrl(featuredImage ?? null, siteOrigin);
  const customData = enrichSchemaWithFeaturedImage(
    buildSchemaJson(content, pageUrl),
    absoluteImage,
    imageAlt || content.h1,
    pageUrl,
  );

  const page = await upsertSeoPage({
    pageType,
    pageSlug,
    title: content.title,
    metaDescription: content.metaDescription,
    h1: content.h1,
    introContent,
    canonicalUrl,
    customData,
    featuredImage,
    imageAlt,
    imageTitle,
    imageCaption,
    isPublished: true,
    noindex: false,
    wordCount: metrics.wordCount,
    faqCount: metrics.faqCount,
    internalLinksCount: metrics.internalLinksCount,
    uniquenessScore: metrics.uniquenessScore,
    duplicateRisk: metrics.duplicateRisk,
    seoQualityScore: metrics.seoQualityScore,
    contentHash: metrics.contentHash,
  });

  if (content.faqs?.length) {
    await persistSeoFaqs(page.id, content.faqs);
  }

  // Phase 2: persist keyword fields (raw SQL — Prisma types updated on next generate)
  if (content.primaryKeyword !== undefined || content.secondaryKeywords !== undefined) {
    await updateSeoPageKeywords(page.id, content.primaryKeyword, content.secondaryKeywords);
  }

  return page;
}

/** Generate or regenerate featured image for an existing SEO page. */
export async function generateSeoPageImage(pageId: string): Promise<SeoImageFields | null> {
  const page = await db.seoPage.findUnique({ where: { id: pageId } });
  if (!page) return null;

  const image = await generateAndStoreSeoImage({
    pageType: page.pageType,
    pageSlug: page.pageSlug,
    headline: page.h1 || page.title || page.pageSlug,
    subtitle: page.metaDescription || undefined,
  });

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
  const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${page.canonicalUrl || ""}`;
  const absoluteImage = resolveSeoImageUrl(image.featuredImage ?? null, siteOrigin);
  const customData = enrichSchemaWithFeaturedImage(
    page.customData,
    absoluteImage,
    image.imageAlt || page.title || page.pageSlug,
    pageUrl,
  );

  await db.seoPage.update({
    where: { id: pageId },
    data: {
      featuredImage: image.featuredImage,
      imageAlt: image.imageAlt,
      imageTitle: image.imageTitle,
      imageCaption: image.imageCaption,
      customData,
    },
  });

  return image;
}

/** Bulk-generate images for pages missing featuredImage. */
export async function generateMissingSeoImages(options: {
  pageType?: SeoPageType;
  limit?: number;
} = {}): Promise<{ updated: number }> {
  const pages = await db.seoPage.findMany({
    where: {
      ...(options.pageType ? { pageType: options.pageType } : {}),
      OR: [{ featuredImage: null }, { featuredImage: "" }],
    },
    take: options.limit ?? 100,
    select: { id: true },
  });

  let updated = 0;
  for (const page of pages) {
    await generateSeoPageImage(page.id);
    updated++;
  }

  return { updated };
}

export async function autoGenerateCitySeoPage(cityId: string) {
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: {
      slug: true,
      name: true,
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

  const seo = generateCitySEOContent(
    city.name,
    city.slug,
    city.state.name,
    city.state.country?.name || "India",
    { stateSlug: city.state.slug },
  );
  const canonicalUrl = `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
  return upsertFromContent("city", city.slug, seo, canonicalUrl);
}

export async function autoGenerateCategorySeoPage(categoryId: string) {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { slug: true, name: true, description: true },
  });
  if (!category) return null;

  const seo = generateCategorySEOContent(
    category.name,
    category.slug,
    category.description || undefined,
  );
  return upsertFromContent("category", category.slug, seo, `/category/${category.slug}`);
}

export async function autoGenerateStateSeoPage(stateId: string) {
  const state = await db.state.findUnique({
    where: { id: stateId },
    select: {
      slug: true,
      name: true,
      country: { select: { name: true, slug: true } },
    },
  });
  if (!state) return null;

  const seo = generateStateSEOContent(
    state.name,
    state.slug,
    state.country?.name || "India",
  );
  const canonicalUrl = `/${state.country?.slug || "india"}/${state.slug}`;
  return upsertFromContent("state", state.slug, seo, canonicalUrl);
}

export interface GenerateResult {
  created: number;
  total: number;
  examples: Array<{ pageType: string; pageSlug: string; canonicalUrl: string; title: string }>;
}

export async function generateCitySeoPages(options: {
  limit?: number;
  countrySlug?: string;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  const cities = await db.city.findMany({
    where: {
      isActive: true,
      state: { country: { slug: countrySlug, isActive: true } },
    },
    orderBy: { name: "asc" },
    take: options.limit,
    select: {
      slug: true,
      name: true,
      state: {
        select: {
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const city of cities) {
    const seo = generateCitySEOContent(
      city.name,
      city.slug,
      city.state.name,
      city.state.country?.name || "India",
      { stateSlug: city.state.slug },
    );
    const canonicalUrl = `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
    await upsertFromContent("city", city.slug, seo, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({ pageType: "city", pageSlug: city.slug, canonicalUrl, title: seo.title });
    }
  }

  return { created, total: cities.length, examples };
}

export async function generateCategorySeoPages(options: { limit?: number } = {}): Promise<GenerateResult> {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { name: "asc" },
    take: options.limit,
    select: { slug: true, name: true, description: true },
  });

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const category of categories) {
    const seo = generateCategorySEOContent(
      category.name,
      category.slug,
      category.description || undefined,
    );
    const canonicalUrl = `/category/${category.slug}`;
    await upsertFromContent("category", category.slug, seo, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "category",
        pageSlug: category.slug,
        canonicalUrl,
        title: seo.title,
      });
    }
  }

  return { created, total: categories.length, examples };
}

export async function generateCategoryCitySeoPages(options: {
  limit?: number;
  countrySlug?: string;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  const limit = options.limit ?? 100;

  const [categories, cities] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { name: "asc" },
      take: 10,
      select: { slug: true, name: true },
    }),
    db.city.findMany({
      where: {
        isActive: true,
        state: { country: { slug: countrySlug, isActive: true } },
      },
      orderBy: { name: "asc" },
      take: 20,
      select: {
        slug: true,
        name: true,
        state: { select: { name: true, slug: true } },
      },
    }),
  ]);

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  outer: for (const category of categories) {
    for (const city of cities) {
      if (created >= limit) break outer;

      const pageSlug = `${category.slug}/${city.slug}`;
      const seo = generateCategoryCitySEOContent(
        category.name,
        category.slug,
        city.name,
        city.slug,
        city.state.name,
        city.state.slug,
      );
      const canonicalUrl = `/${category.slug}/${city.slug}`;
      await upsertFromContent("category_city", pageSlug, seo, canonicalUrl);
      created++;
      if (examples.length < 3) {
        examples.push({
          pageType: "category_city",
          pageSlug,
          canonicalUrl,
          title: seo.title,
        });
      }
    }
  }

  return { created, total: created, examples };
}

export async function generateStateSeoPages(options: {
  limit?: number;
  countrySlug?: string;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  const states = await db.state.findMany({
    where: {
      isActive: true,
      country: { slug: countrySlug, isActive: true },
    },
    orderBy: { name: "asc" },
    take: options.limit,
    select: {
      slug: true,
      name: true,
      country: { select: { name: true, slug: true } },
    },
  });

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const state of states) {
    const seo = generateStateSEOContent(
      state.name,
      state.slug,
      state.country?.name || "India",
    );
    const canonicalUrl = `/${state.country?.slug || "india"}/${state.slug}`;
    await upsertFromContent("state", state.slug, seo, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "state",
        pageSlug: state.slug,
        canonicalUrl,
        title: seo.title,
      });
    }
  }

  return { created, total: states.length, examples };
}

export async function generateCountrySeoPages(options: { limit?: number } = {}): Promise<GenerateResult> {
  const countries = await db.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: options.limit,
    select: { slug: true, name: true },
  });

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const country of countries) {
    const seo = generateCountrySEOContent(country.name, country.slug);
    const canonicalUrl = `/${country.slug}`;
    await upsertFromContent("country", country.slug, seo, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "country",
        pageSlug: country.slug,
        canonicalUrl,
        title: seo.title,
      });
    }
  }

  return { created, total: countries.length, examples };
}

export async function generateLongtailSeoPages(options: {
  limit?: number;
  countrySlug?: string;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  const limit = options.limit ?? 50;

  const cities = await db.city.findMany({
    where: {
      isActive: true,
      state: { country: { slug: countrySlug, isActive: true } },
    },
    orderBy: { name: "asc" },
    take: 15,
    select: {
      slug: true,
      name: true,
      state: { select: { name: true, slug: true } },
    },
  });

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  outer: for (const keyword of LONGTAIL_KEYWORDS) {
    for (const city of cities) {
      if (created >= limit) break outer;

      const pageSlug = `${keyword.slug}/${city.slug}`;
      const seo = generateLongTailSEOContent(
        keyword.keyword,
        keyword.slug,
        city.name,
        city.slug,
        city.state?.name ?? "",
        city.state?.slug ?? "",
      );
      const canonicalUrl = `/${keyword.slug}/${city.slug}`;
      await upsertFromContent("longtail", pageSlug, seo, canonicalUrl);
      created++;
      if (examples.length < 3) {
        examples.push({
          pageType: "longtail",
          pageSlug,
          canonicalUrl,
          title: seo.title,
        });
      }
    }
  }

  return { created, total: created, examples };
}

export async function getSeoPageCountsByType() {
  const grouped = await db.seoPage.groupBy({
    by: ["pageType"],
    _count: { id: true },
  });

  const counts: Record<string, number> = {
    city: 0,
    category: 0,
    category_city: 0,
    state: 0,
    country: 0,
    longtail: 0,
  };

  for (const row of grouped) {
    counts[row.pageType] = row._count.id;
  }

  return {
    counts,
    total: grouped.reduce((sum, row) => sum + row._count.id, 0),
  };
}

export async function runSeoGeneration(
  type: SeoPageType,
  options: { limit?: number; countrySlug?: string } = {},
): Promise<GenerateResult> {
  switch (type) {
    case "city":
      return generateCitySeoPages(options);
    case "category":
      return generateCategorySeoPages(options);
    case "category_city":
      return generateCategoryCitySeoPages(options);
    case "state":
      return generateStateSeoPages(options);
    case "country":
      return generateCountrySeoPages(options);
    case "longtail":
      return generateLongtailSeoPages(options);
    default:
      throw new Error(`Unknown SEO page type: ${type}`);
  }
}

import "server-only";

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
import { generateUniversalSeoContent } from "@/lib/seo-universal-engine";
import {
  analyzeSeoContent,
  countWords,
  calculateVisibleWordCount,
  computeContentHash,
  SEO_MIN_WORD_COUNT,
  detectDuplicateFields,
  computeCompositeUniqueness,
  textSimilarity,
  type SeoPageSnapshot,
  type UniquenessBreakdown,
} from "@/lib/seo-quality";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import {
  buildLinkContextFromPage,
  calculateInternalLinksCount,
  finalizeIntroForPersistence,
  MIN_INTERNAL_LINKS_PER_PAGE,
  sanitizeSeoContentLinks,
  sanitizeStoredIntroContent,
  sanitizeStoredCustomData,
} from "@/lib/seo-internal-links";
import {
  getServedPathForSeoPage,
  isSeoPageRoutable,
} from "@/lib/seo-route-validation";

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
 * Content generation uses SEO V6.1 universal engine via @/lib/seo-universal-engine.
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
  const internalLinksCount = calculateInternalLinksCount(introContent);

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
  const introContent = input.introContent
    ? await sanitizeStoredIntroContent(input.introContent, input.pageType, input.pageSlug)
    : input.introContent;
  const customData = sanitizeStoredCustomData(input.customData);
  const persistedWordCount = introContent
    ? calculateVisibleWordCount(introContent)
    : (input.wordCount ?? null);
  const persistedInternalLinksCount = introContent
    ? calculateInternalLinksCount(introContent)
    : (input.internalLinksCount ?? null);
  const persistedContentHash = introContent
    ? computeContentHash(introContent)
    : (input.contentHash ?? null);

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
      introContent,
      canonicalUrl: input.canonicalUrl,
      customData: customData ?? null,
      featuredImage: input.featuredImage ?? null,
      imageAlt: input.imageAlt ?? null,
      imageTitle: input.imageTitle ?? null,
      imageCaption: input.imageCaption ?? null,
      isPublished: input.isPublished ?? true,
      noindex: input.noindex ?? false,
      wordCount: persistedWordCount,
      faqCount: input.faqCount ?? null,
      internalLinksCount: persistedInternalLinksCount,
      uniquenessScore: input.uniquenessScore ?? null,
      duplicateRisk: input.duplicateRisk ?? null,
      seoQualityScore: input.seoQualityScore ?? null,
      contentHash: persistedContentHash,
    },
    update: {
      title: input.title,
      metaDescription: input.metaDescription,
      h1: input.h1,
      introContent,
      canonicalUrl: input.canonicalUrl,
      customData: customData ?? null,
      featuredImage: input.featuredImage ?? null,
      imageAlt: input.imageAlt ?? null,
      imageTitle: input.imageTitle ?? null,
      imageCaption: input.imageCaption ?? null,
      isPublished: input.isPublished ?? true,
      noindex: input.noindex ?? false,
      wordCount: persistedWordCount,
      faqCount: input.faqCount ?? null,
      internalLinksCount: persistedInternalLinksCount,
      uniquenessScore: input.uniquenessScore ?? null,
      duplicateRisk: input.duplicateRisk ?? null,
      seoQualityScore: input.seoQualityScore ?? null,
      contentHash: persistedContentHash,
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
  const routeCheck = await isSeoPageRoutable({ pageType, pageSlug, canonicalUrl });
  if (!routeCheck.routable) {
    throw new Error(
      `Cannot save SEO page ${pageType}/${pageSlug}: ${routeCheck.reason ?? "no valid route"}`,
    );
  }

  const resolvedCanonical = getServedPathForSeoPage({
    pageType,
    pageSlug,
    canonicalUrl,
  });

  const linkContext = buildLinkContextFromPage(pageType, pageSlug);
  const sanitizedContent = await sanitizeSeoContentLinks(content, linkContext);
  const introContent = await finalizeIntroForPersistence(
    resolveIntroContentForStorage(sanitizedContent),
    pageType,
    pageSlug,
    sanitizedContent.internalLinks,
  );
  sanitizedContent.fullIntroContent = introContent;
  sanitizedContent.introParagraph = introContent.split("\n\n")[0] ?? introContent;

  const faqText = (sanitizedContent.faqs ?? [])
    .map((f) => `${f.question} ${f.answer}`)
    .join(" ");
  const visibleWords = calculateVisibleWordCount(introContent) + calculateVisibleWordCount(faqText);
  if (visibleWords < SEO_MIN_WORD_COUNT) {
    throw new Error(
      `Generated content below minimum threshold (${visibleWords} < ${SEO_MIN_WORD_COUNT} words) for ${pageType}/${pageSlug}`,
    );
  }

  const visibleLinks = calculateInternalLinksCount(introContent);
  if (visibleLinks < MIN_INTERNAL_LINKS_PER_PAGE) {
    throw new Error(
      `Generated content below internal link threshold (${visibleLinks} < ${MIN_INTERNAL_LINKS_PER_PAGE} links) for ${pageType}/${pageSlug}`,
    );
  }

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

  const baseMetrics =
    options?.precomputedMetrics ??
    (await computePageQualityMetrics(pageType, pageSlug, sanitizedContent, introContent, {
      featuredImage,
      canonicalUrl: resolvedCanonical,
      excludePageId: options?.excludePageId,
    }));
  const metrics = {
    ...baseMetrics,
    wordCount: calculateVisibleWordCount(introContent) + calculateVisibleWordCount(faqText),
    internalLinksCount: calculateInternalLinksCount(introContent),
    contentHash: computeContentHash(introContent),
  };

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";
  const pageUrl = `${siteOrigin.replace(/\/+$/, "")}${resolvedCanonical}`;
  const absoluteImage = resolveSeoImageUrl(featuredImage ?? null, siteOrigin);
  const customData = enrichSchemaWithFeaturedImage(
    buildSchemaJson(sanitizedContent, pageUrl),
    absoluteImage,
    imageAlt || sanitizedContent.h1,
    pageUrl,
  );

  const page = await upsertSeoPage({
    pageType,
    pageSlug,
    title: sanitizedContent.title,
    metaDescription: sanitizedContent.metaDescription,
    h1: sanitizedContent.h1,
    introContent,
    canonicalUrl: resolvedCanonical,
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

  if (sanitizedContent.faqs?.length) {
    await persistSeoFaqs(page.id, sanitizedContent.faqs);
  }

  // Phase 2: persist keyword fields (raw SQL — Prisma types updated on next generate)
  if (sanitizedContent.primaryKeyword !== undefined || sanitizedContent.secondaryKeywords !== undefined) {
    await updateSeoPageKeywords(page.id, sanitizedContent.primaryKeyword, sanitizedContent.secondaryKeywords);
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

  const result = await generateUniversalSeoContent({
    pageType: "city",
    citySlug: city.slug,
    mode: "generate",
  });
  const canonicalUrl =
    result.canonicalUrl ??
    `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
  return upsertFromContent("city", city.slug, result.content, canonicalUrl);
}

export async function autoGenerateCategorySeoPage(categoryId: string) {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { slug: true, name: true, description: true },
  });
  if (!category) return null;

  const result = await generateUniversalSeoContent({
    pageType: "category",
    categorySlug: category.slug,
    mode: "generate",
  });
  return upsertFromContent(
    "category",
    category.slug,
    result.content,
    result.canonicalUrl ?? `/category/${category.slug}`,
  );
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

  const result = await generateUniversalSeoContent({
    pageType: "state",
    stateSlug: state.slug,
    mode: "generate",
  });
  const canonicalUrl =
    result.canonicalUrl ?? `/${state.country?.slug || "india"}/${state.slug}`;
  return upsertFromContent("state", state.slug, result.content, canonicalUrl);
}

export interface GenerateResult {
  created: number;
  skipped: number;
  total: number;
  examples: Array<{ pageType: string; pageSlug: string; canonicalUrl: string; title: string }>;
}

export interface GenerateMissingResult {
  generated: number;
  skipped: number;
  failed: number;
  total: number;
  breakdown: Partial<Record<SeoPageType, {
    generated: number;
    skipped: number;
    failed: number;
    total: number;
  }>>;
}

/**
 * Returns the set of pageSlug values already stored for a given page type.
 * Used by skipExisting logic to avoid re-generating pages that exist.
 */
async function getExistingPageSlugs(pageType: SeoPageType): Promise<Set<string>> {
  const rows = await db.seoPage.findMany({
    where: { pageType },
    select: { pageSlug: true },
  });
  return new Set(rows.map((r) => r.pageSlug));
}

/** Resolve candidate pages for bulk generate dry run (read-only). */
export async function resolveGenerationCandidates(
  type: SeoPageType,
  options: { limit?: number; countrySlug?: string; skipExisting?: boolean } = {},
): Promise<Array<{ pageType: string; pageSlug: string }>> {
  const limit = options.limit;
  const countrySlug = options.countrySlug || "india";
  const existingSlugs = options.skipExisting ? await getExistingPageSlugs(type) : null;

  switch (type) {
    case "city": {
      const cities = await db.city.findMany({
        where: {
          isActive: true,
          state: { country: { slug: countrySlug, isActive: true } },
          ...(existingSlugs && existingSlugs.size > 0
            ? { slug: { notIn: [...existingSlugs] } }
            : {}),
        },
        orderBy: { name: "asc" },
        take: limit,
        select: { slug: true },
      });
      return cities.map((c) => ({ pageType: "city", pageSlug: c.slug }));
    }
    case "category": {
      const categories = await db.category.findMany({
        where: {
          isActive: true,
          parentId: null,
          ...(existingSlugs && existingSlugs.size > 0
            ? { slug: { notIn: [...existingSlugs] } }
            : {}),
        },
        orderBy: { name: "asc" },
        take: limit,
        select: { slug: true },
      });
      return categories.map((c) => ({ pageType: "category", pageSlug: c.slug }));
    }
    case "state": {
      const states = await db.state.findMany({
        where: {
          isActive: true,
          country: { slug: countrySlug, isActive: true },
          ...(existingSlugs && existingSlugs.size > 0
            ? { slug: { notIn: [...existingSlugs] } }
            : {}),
        },
        orderBy: { name: "asc" },
        take: limit,
        select: { slug: true },
      });
      return states.map((s) => ({ pageType: "state", pageSlug: s.slug }));
    }
    case "country": {
      const countries = await db.country.findMany({
        where: {
          isActive: true,
          ...(existingSlugs && existingSlugs.size > 0
            ? { slug: { notIn: [...existingSlugs] } }
            : {}),
        },
        orderBy: { name: "asc" },
        take: limit,
        select: { slug: true },
      });
      return countries.map((c) => ({ pageType: "country", pageSlug: c.slug }));
    }
    default:
      return [];
  }
}

export async function generateCitySeoPages(options: {
  limit?: number;
  countrySlug?: string;
  skipExisting?: boolean;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  const baseWhere = {
    isActive: true,
    state: { country: { slug: countrySlug, isActive: true } },
  } as const;

  // Pre-fetch existing slugs so the DB-level filter and skipped count are consistent.
  const existingSlugs = options.skipExisting ? await getExistingPageSlugs("city") : null;

  // Run fetch + count in parallel. notIn filter ensures `take: limit` means
  // "generate N new pages", not "fetch N cities then skip some".
  const [cities, totalActive] = await Promise.all([
    db.city.findMany({
      where: {
        ...baseWhere,
        ...(existingSlugs && existingSlugs.size > 0
          ? { slug: { notIn: [...existingSlugs] } }
          : {}),
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
    }),
    db.city.count({ where: baseWhere }),
  ]);

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const city of cities) {
    const result = await generateUniversalSeoContent({
      pageType: "city",
      citySlug: city.slug,
      mode: "generate",
    });
    const canonicalUrl =
      result.canonicalUrl ??
      `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
    await upsertFromContent("city", city.slug, result.content, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "city",
        pageSlug: city.slug,
        canonicalUrl,
        title: result.content.title,
      });
    }
  }

  return { created, skipped: existingSlugs?.size ?? 0, total: totalActive, examples };
}

export async function generateCategorySeoPages(options: { limit?: number; skipExisting?: boolean } = {}): Promise<GenerateResult> {
  const baseWhere = { isActive: true, parentId: null } as const;
  const existingSlugs = options.skipExisting ? await getExistingPageSlugs("category") : null;

  const [categories, totalActive] = await Promise.all([
    db.category.findMany({
      where: {
        ...baseWhere,
        ...(existingSlugs && existingSlugs.size > 0
          ? { slug: { notIn: [...existingSlugs] } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: options.limit,
      select: { slug: true, name: true, description: true },
    }),
    db.category.count({ where: baseWhere }),
  ]);

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const category of categories) {
    const result = await generateUniversalSeoContent({
      pageType: "category",
      categorySlug: category.slug,
      mode: "generate",
    });
    const canonicalUrl = result.canonicalUrl ?? `/category/${category.slug}`;
    await upsertFromContent("category", category.slug, result.content, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "category",
        pageSlug: category.slug,
        canonicalUrl,
        title: result.content.title,
      });
    }
  }

  return { created, skipped: existingSlugs?.size ?? 0, total: totalActive, examples };
}

export async function generateCategoryCitySeoPages(options: {
  limit?: number;
  countrySlug?: string;
  skipExisting?: boolean;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  // Removed hardcoded take:10 (categories) and take:20 (cities).
  // Fetch all active entities; the caller's limit controls how many pages are written per run.
  const limit = options.limit;

  const [categories, cities] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    db.city.findMany({
      where: {
        isActive: true,
        state: { country: { slug: countrySlug, isActive: true } },
      },
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
        state: { select: { name: true, slug: true } },
      },
    }),
  ]);

  const existingSlugs = options.skipExisting ? await getExistingPageSlugs("category_city") : null;
  const totalCandidates = categories.length * cities.length;
  const examples: GenerateResult["examples"] = [];
  let created = 0;

  outer: for (const category of categories) {
    for (const city of cities) {
      if (limit !== undefined && created >= limit) break outer;

      const pageSlug = `${category.slug}/${city.slug}`;
      if (existingSlugs?.has(pageSlug)) { continue; }

      const result = await generateUniversalSeoContent({
        pageType: "category_city",
        pageSlug,
        mode: "generate",
      });
      const canonicalUrl = result.canonicalUrl ?? `/${category.slug}/${city.slug}`;
      await upsertFromContent("category_city", pageSlug, result.content, canonicalUrl);
      created++;
      if (examples.length < 3) {
        examples.push({
          pageType: "category_city",
          pageSlug,
          canonicalUrl,
          title: result.content.title,
        });
      }
    }
  }

  return { created, skipped: existingSlugs?.size ?? 0, total: totalCandidates, examples };
}

export async function generateStateSeoPages(options: {
  limit?: number;
  countrySlug?: string;
  skipExisting?: boolean;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  const baseWhere = {
    isActive: true,
    country: { slug: countrySlug, isActive: true },
  } as const;
  const existingSlugs = options.skipExisting ? await getExistingPageSlugs("state") : null;

  const [states, totalActive] = await Promise.all([
    db.state.findMany({
      where: {
        ...baseWhere,
        ...(existingSlugs && existingSlugs.size > 0
          ? { slug: { notIn: [...existingSlugs] } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: options.limit,
      select: {
        slug: true,
        name: true,
        country: { select: { name: true, slug: true } },
      },
    }),
    db.state.count({ where: baseWhere }),
  ]);

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const state of states) {
    const result = await generateUniversalSeoContent({
      pageType: "state",
      stateSlug: state.slug,
      mode: "generate",
    });
    const canonicalUrl =
      result.canonicalUrl ?? `/${state.country?.slug || "india"}/${state.slug}`;
    await upsertFromContent("state", state.slug, result.content, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "state",
        pageSlug: state.slug,
        canonicalUrl,
        title: result.content.title,
      });
    }
  }

  return { created, skipped: existingSlugs?.size ?? 0, total: totalActive, examples };
}

export async function generateCountrySeoPages(options: { limit?: number; skipExisting?: boolean } = {}): Promise<GenerateResult> {
  const baseWhere = { isActive: true } as const;
  const existingSlugs = options.skipExisting ? await getExistingPageSlugs("country") : null;

  const [countries, totalActive] = await Promise.all([
    db.country.findMany({
      where: {
        ...baseWhere,
        ...(existingSlugs && existingSlugs.size > 0
          ? { slug: { notIn: [...existingSlugs] } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: options.limit,
      select: { slug: true, name: true },
    }),
    db.country.count({ where: baseWhere }),
  ]);

  const examples: GenerateResult["examples"] = [];
  let created = 0;

  for (const country of countries) {
    const result = await generateUniversalSeoContent({
      pageType: "country",
      countrySlug: country.slug,
      mode: "generate",
    });
    const canonicalUrl = result.canonicalUrl ?? `/country/${country.slug}`;
    await upsertFromContent("country", country.slug, result.content, canonicalUrl);
    created++;
    if (examples.length < 3) {
      examples.push({
        pageType: "country",
        pageSlug: country.slug,
        canonicalUrl,
        title: result.content.title,
      });
    }
  }

  return { created, skipped: existingSlugs?.size ?? 0, total: totalActive, examples };
}

export async function generateLongtailSeoPages(options: {
  limit?: number;
  countrySlug?: string;
  skipExisting?: boolean;
} = {}): Promise<GenerateResult> {
  const countrySlug = options.countrySlug || "india";
  // Removed hardcoded take:15 cap on cities.
  // The caller's limit controls how many pages are written per run.
  const limit = options.limit;

  const cities = await db.city.findMany({
    where: {
      isActive: true,
      state: { country: { slug: countrySlug, isActive: true } },
    },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      state: { select: { name: true, slug: true } },
    },
  });

  const existingSlugs = options.skipExisting ? await getExistingPageSlugs("longtail") : null;
  const totalCandidates = LONGTAIL_KEYWORDS.length * cities.length;
  const examples: GenerateResult["examples"] = [];
  let created = 0;

  outer: for (const keyword of LONGTAIL_KEYWORDS) {
    for (const city of cities) {
      if (limit !== undefined && created >= limit) break outer;

      const pageSlug = `${keyword.slug}/${city.slug}`;
      if (existingSlugs?.has(pageSlug)) { continue; }

      const result = await generateUniversalSeoContent({
        pageType: "longtail",
        pageSlug,
        mode: "generate",
      });
      const canonicalUrl = result.canonicalUrl ?? `/${keyword.slug}/${city.slug}`;
      await upsertFromContent("longtail", pageSlug, result.content, canonicalUrl);
      created++;
      if (examples.length < 3) {
        examples.push({
          pageType: "longtail",
          pageSlug,
          canonicalUrl,
          title: result.content.title,
        });
      }
    }
  }

  return { created, skipped: existingSlugs?.size ?? 0, total: totalCandidates, examples };
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
  options: { limit?: number; countrySlug?: string; skipExisting?: boolean } = {},
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

/**
 * Generate SEO pages for every entity type, skipping pages that already exist.
 *
 * - city / category / state / country: processed in full (entity counts are small).
 * - category_city: up to `categoryCityLimit` (default 500) new pages per call.
 *   Candidate space = categories × cities ≈ 10 000+; call repeatedly to finish.
 * - longtail: up to `longtailLimit` (default 500) new pages per call.
 *   Candidate space = 8 keywords × cities ≈ 6 000+; call repeatedly to finish.
 *
 * All types are run sequentially; a failure on one type is captured in `breakdown`
 * and does not abort the remaining types.
 */
export async function generateAllMissingSeoPages(options: {
  countrySlug?: string;
  categoryCityLimit?: number;
  longtailLimit?: number;
  types?: SeoPageType[];
} = {}): Promise<GenerateMissingResult> {
  const countrySlug = options.countrySlug ?? "india";
  const categoryCityLimit = options.categoryCityLimit ?? 500;
  const longtailLimit = options.longtailLimit ?? 500;
  const types: SeoPageType[] = options.types ?? [
    "city",
    "category",
    "state",
    "country",
    "category_city",
    "longtail",
  ];

  const aggregate: GenerateMissingResult = {
    generated: 0, skipped: 0, failed: 0, total: 0, breakdown: {},
  };

  const perTypeLimits: Partial<Record<SeoPageType, number | undefined>> = {
    city: undefined,
    category: undefined,
    state: undefined,
    country: undefined,
    category_city: categoryCityLimit,
    longtail: longtailLimit,
  };

  for (const type of types) {
    try {
      const r = await runSeoGeneration(type, {
        countrySlug,
        limit: perTypeLimits[type],
        skipExisting: true,
      });
      const typeResult = {
        generated: r.created,
        skipped: r.skipped,
        failed: 0,
        total: r.total,
      };
      aggregate.generated += typeResult.generated;
      aggregate.skipped += typeResult.skipped;
      aggregate.total += typeResult.total;
      aggregate.breakdown[type] = typeResult;
    } catch {
      aggregate.failed++;
      aggregate.breakdown[type] = { generated: 0, skipped: 0, failed: 1, total: 0 };
    }
  }

  return aggregate;
}

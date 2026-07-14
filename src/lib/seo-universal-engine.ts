/**
 * SEO V6.1 — Universal SEO Engine for SecretZa.
 * Single source of truth for generation, regeneration, optimization, and AI-assisted rewriting.
 */
import { db } from "@/lib/db";
import type { SEOContent } from "@/lib/seo-content";
import type { SeoPageType } from "@/lib/seo-page-service";
import type { SeoGenerationMeta } from "@/lib/seo-generation-metadata";
import {
  generateUniqueCitySEOContent,
  generateUniqueCategoryCitySEOContent,
  generateUniqueLongTailSEOContent,
  generateCategorySEOContent,
  generateStateSEOContent,
  generateCountrySEOContent,
  getActiveSeoEngine,
} from "@/lib/seo-engine";
import {
  loadPageForPartialRegen,
  tryPartialCityRegeneration,
} from "@/lib/seo-partial-regeneration";
import {
  applySectionConflictFixes,
  detectSectionConflicts,
} from "@/lib/seo-content-fingerprints";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import { rewriteSimilarParagraphs } from "@/lib/seo-uniqueness-engine";
import { extractFingerprintParagraphs } from "@/lib/seo-paragraph-fingerprints";
import { evaluateV61SaveDecision } from "@/lib/seo-regen-save-policy";
import { SECTION_SIMILARITY_THRESHOLD as FP_THRESHOLD } from "@/lib/seo-content-fingerprints";

export type SeoEngineId = "v6.1" | "v5" | "v6";

/** Central V6.1 configuration — all workflows read from here. */
export const SEO_V61_CONFIG = {
  engine: "v6.1" as const,
  targetUniqueness: numEnv("TARGET_UNIQUENESS", 90),
  minUniqueness: numEnv("MIN_UNIQUENESS", 80),
  targetSeo: numEnv("TARGET_SEO", 90),
  minSeo: numEnv("MIN_SEO", 85),
  maxAttempts: numEnv("MAX_ATTEMPTS", 3),
  maxCandidates: numEnv("MAX_CANDIDATES", 3),
};

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type UniversalSeoMode =
  | "generate"
  | "regenerate"
  | "optimize"
  | "rewrite_intro"
  | "rewrite_paragraph"
  | "improve_keywords"
  | "improve_faq"
  | "improve_cta";

export type GenerateUniversalSeoInput = {
  pageType: SeoPageType;
  /** Explicit page slug (e.g. `vip-escorts/mumbai` for category_city). */
  pageSlug?: string;
  citySlug?: string;
  categorySlug?: string;
  keywordSlug?: string;
  stateSlug?: string;
  countrySlug?: string;
  mode?: UniversalSeoMode;
  targetUniqueness?: number;
  targetSeo?: number;
  excludePageId?: string;
  ignoreExistingCanonical?: boolean;
  /** For rewrite_paragraph mode */
  paragraphIndex?: number;
  conflictSlug?: string;
  /** Existing content to optimize in-place (skips DB load when provided). */
  existingContent?: SEOContent;
  /** Prior scores for save-policy evaluation */
  priorUniqueness?: number | null;
  priorSeoScore?: number | null;
};

export type UniversalSeoResult = {
  content: SEOContent;
  canonicalUrl: string | null;
  metadata: Record<string, unknown>;
  engine: typeof SEO_V61_CONFIG;
  mode: UniversalSeoMode;
  generationTimeMs: number;
};

/** Alias required by spec. */
export const generateSeoContentV61 = generateUniversalSeoContent;

export function resolveUniversalPageSlug(input: GenerateUniversalSeoInput): {
  pageType: SeoPageType;
  pageSlug: string;
} {
  if (input.pageSlug?.trim()) {
    return { pageType: input.pageType, pageSlug: input.pageSlug.trim() };
  }
  switch (input.pageType) {
    case "city":
      if (!input.citySlug) throw new Error("citySlug required for city pages");
      return { pageType: "city", pageSlug: input.citySlug };
    case "category":
      if (!input.categorySlug) throw new Error("categorySlug required for category pages");
      return { pageType: "category", pageSlug: input.categorySlug };
    case "category_city":
      if (!input.categorySlug || !input.citySlug) {
        throw new Error("categorySlug and citySlug required for category_city pages");
      }
      return { pageType: "category_city", pageSlug: `${input.categorySlug}/${input.citySlug}` };
    case "longtail":
      if (!input.keywordSlug || !input.citySlug) {
        throw new Error("keywordSlug and citySlug required for longtail pages");
      }
      return { pageType: "longtail", pageSlug: `${input.keywordSlug}/${input.citySlug}` };
    case "state":
      if (!input.stateSlug) throw new Error("stateSlug required for state pages");
      return { pageType: "state", pageSlug: input.stateSlug };
    case "country":
      if (!input.countrySlug) throw new Error("countrySlug required for country pages");
      return { pageType: "country", pageSlug: input.countrySlug };
    default:
      throw new Error(`Unsupported page type: ${input.pageType}`);
  }
}

export function getUniversalSeoEngineInfo() {
  const legacy = getActiveSeoEngine();
  return {
    activeEngine: SEO_V61_CONFIG.engine,
    legacyEngine: legacy,
    version: SEO_V61_CONFIG.engine,
    envVar: process.env.SEO_ENGINE ?? "(default v6.1)",
    config: SEO_V61_CONFIG,
    cityEngine: "seo-universal-engine → seo-city-content-v6 + seo-unique-generation-v6",
    enrichment: "seo-local-intelligence + seo-dynamic-listing-context",
    uniquenessEngine: `V6.1: ${SEO_V61_CONFIG.maxCandidates} candidates, ${SEO_V61_CONFIG.maxAttempts} attempts, partial rewrite, fingerprinting`,
    localIntelligence: true,
    removedPaths: ["v3 city variants", "v4 generateImprovedCitySEO production", "parallel AI page generators"],
  };
}

/**
 * Universal SEO content generation — all features must call this.
 */
export async function generateUniversalSeoContent(
  input: GenerateUniversalSeoInput,
): Promise<UniversalSeoResult> {
  const start = Date.now();
  const mode = input.mode ?? "generate";
  const { pageType, pageSlug } = resolveUniversalPageSlug(input);

  if (isOptimizeMode(mode)) {
    return runOptimizeMode({ ...input, pageType, pageSlug, mode, start });
  }

  const built = await buildPageContent({
    pageType,
    pageSlug,
    mode,
    excludePageId: input.excludePageId,
    ignoreExistingCanonical: input.ignoreExistingCanonical,
    start,
  });

  return {
    content: built.content,
    canonicalUrl: built.canonicalUrl,
    metadata: built.content.generationMeta ?? { engine: SEO_V61_CONFIG.engine, mode },
    engine: SEO_V61_CONFIG,
    mode,
    generationTimeMs: Date.now() - start,
  };
}

function isOptimizeMode(mode: UniversalSeoMode): boolean {
  return [
    "optimize",
    "rewrite_intro",
    "rewrite_paragraph",
    "improve_keywords",
    "improve_faq",
    "improve_cta",
  ].includes(mode);
}

// ─── Page generation (generate / regenerate) ───────────────────────────────

async function loadCityContext(slug: string) {
  return db.city.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      areas: { where: { isActive: true }, select: { name: true }, take: 12 },
      state: {
        select: {
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

async function resolveCityDisplayName(city: { name: string; slug: string }) {
  return city.name?.trim() || city.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function buildPageContent(input: {
  pageType: SeoPageType;
  pageSlug: string;
  mode: UniversalSeoMode;
  excludePageId?: string;
  ignoreExistingCanonical?: boolean;
  start: number;
}): Promise<{ content: SEOContent; canonicalUrl: string }> {
  const existing = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType: input.pageType, pageSlug: input.pageSlug } },
  });
  const useExistingCanonical = !input.ignoreExistingCanonical;
  const tryPartial = input.mode === "regenerate" && getActiveSeoEngine() !== "v5";

  if (input.pageType === "city") {
    const city = await loadCityContext(input.pageSlug);
    if (!city?.state) throw new Error(`City not found: ${input.pageSlug}`);
    const cityDisplayName = await resolveCityDisplayName(city);

    if (tryPartial && existing?.introContent) {
      const partial = await tryPartialRegenForPage(
        input.pageType,
        input.pageSlug,
        cityDisplayName,
        existing.id,
      );
      if (partial) {
        const canonicalUrl =
          (useExistingCanonical ? existing.canonicalUrl : null) ??
          `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
        return { content: partial, canonicalUrl };
      }
    }

    const content = await generateUniqueCitySEOContent(
      cityDisplayName,
      city.slug,
      city.state.name,
      city.state.country?.name || "India",
      {
        stateSlug: city.state.slug,
        dbAreas: city.areas.map((a) => a.name),
        excludePageId: input.excludePageId ?? existing?.id,
      },
    );
    stampGenerationMeta(content, input.mode, input.start);
    const canonicalUrl =
      (useExistingCanonical ? existing?.canonicalUrl : null) ??
      `/${city.state.country?.slug || "india"}/${city.state.slug}/${city.slug}`;
    return { content, canonicalUrl };
  }

  if (input.pageType === "category") {
    const cat = await db.category.findFirst({
      where: { slug: input.pageSlug },
      select: { name: true, slug: true, description: true },
    });
    if (!cat) throw new Error(`Category not found: ${input.pageSlug}`);
    const content = generateCategorySEOContent(cat.name, cat.slug, cat.description ?? undefined);
    stampGenerationMeta(content, input.mode, input.start);
    return {
      content,
      canonicalUrl: (useExistingCanonical ? existing?.canonicalUrl : null) ?? `/category/${cat.slug}`,
    };
  }

  if (input.pageType === "category_city") {
    const slash = input.pageSlug.indexOf("/");
    const resolvedCat = slash >= 0 ? input.pageSlug.slice(0, slash) : input.pageSlug.split("-")[0];
    const resolvedCity = slash >= 0 ? input.pageSlug.slice(slash + 1) : input.pageSlug.split("-").slice(1).join("-");
    if (!resolvedCat || !resolvedCity) throw new Error(`Invalid category_city slug: ${input.pageSlug}`);

    const category = await db.category.findFirst({ where: { slug: resolvedCat } });
    const city = await loadCityContext(resolvedCity);
    if (!category || !city?.state) throw new Error(`Category or city not found: ${input.pageSlug}`);

    const cityDisplayName = await resolveCityDisplayName(city);
    const content = await generateUniqueCategoryCitySEOContent(
      category.name,
      category.slug,
      cityDisplayName,
      city.slug,
      city.state.name,
      city.state.slug,
      city.areas.map((a) => a.name),
      input.excludePageId ?? existing?.id,
    );
    stampGenerationMeta(content, input.mode, input.start);
    return {
      content,
      canonicalUrl: (useExistingCanonical ? existing?.canonicalUrl : null) ?? `/${category.slug}/${city.slug}`,
    };
  }

  if (input.pageType === "state") {
    const state = await db.state.findFirst({
      where: { slug: input.pageSlug },
      select: { name: true, slug: true, country: { select: { name: true, slug: true } } },
    });
    if (!state) throw new Error(`State not found: ${input.pageSlug}`);
    const content = generateStateSEOContent(state.name, state.slug, state.country?.name || "India");
    stampGenerationMeta(content, input.mode, input.start);
    return {
      content,
      canonicalUrl:
        (useExistingCanonical ? existing?.canonicalUrl : null) ??
        `/${state.country?.slug || "india"}/${state.slug}`,
    };
  }

  if (input.pageType === "country") {
    const country = await db.country.findFirst({ where: { slug: input.pageSlug } });
    if (!country) throw new Error(`Country not found: ${input.pageSlug}`);
    const content = generateCountrySEOContent(country.name, country.slug);
    stampGenerationMeta(content, input.mode, input.start);
    return {
      content,
      canonicalUrl:
        (useExistingCanonical && existing?.canonicalUrl?.startsWith("/country/")
          ? existing.canonicalUrl
          : null) ?? `/country/${country.slug}`,
    };
  }

  if (input.pageType === "longtail") {
    const slash = input.pageSlug.indexOf("/");
    const keywordSlug = slash >= 0 ? input.pageSlug.slice(0, slash) : input.pageSlug;
    const citySlug = slash >= 0 ? input.pageSlug.slice(slash + 1) : "";
    const city = await loadCityContext(citySlug);
    if (!city) throw new Error(`City not found for longtail: ${input.pageSlug}`);
    const cityDisplayName = await resolveCityDisplayName(city);
    const keyword = keywordSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const content = await generateUniqueLongTailSEOContent(
      keyword,
      keywordSlug,
      cityDisplayName,
      city.slug,
      city.state?.name ?? "",
      city.state?.slug ?? "",
      city.areas.map((a) => a.name),
      input.excludePageId ?? existing?.id,
    );
    stampGenerationMeta(content, input.mode, input.start);
    return {
      content,
      canonicalUrl: (useExistingCanonical ? existing?.canonicalUrl : null) ?? `/${keywordSlug}/${citySlug}`,
    };
  }

  throw new Error(`Unsupported page type: ${input.pageType}`);
}

async function tryPartialRegenForPage(
  pageType: string,
  pageSlug: string,
  cityName: string,
  pageId: string,
): Promise<SEOContent | null> {
  const pageRow = await loadPageForPartialRegen(pageType, pageSlug);
  if (!pageRow) return null;

  const shell: SEOContent = {
    title: pageRow.title ?? "",
    metaDescription: pageRow.metaDescription ?? "",
    h1: pageRow.h1 ?? "",
    introParagraph: pageRow.introContent?.split("\n\n")[0] ?? "",
    fullIntroContent: pageRow.introContent ?? "",
    faqs: pageRow.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    breadcrumbItems: [],
    internalLinks: [],
  };

  const partial = await tryPartialCityRegeneration({
    pageType,
    pageSlug,
    cityName,
    existing: {
      id: pageId,
      title: pageRow.title,
      metaDescription: pageRow.metaDescription,
      h1: pageRow.h1,
      introContent: pageRow.introContent,
      uniquenessScore: pageRow.uniquenessScore,
      faqs: pageRow.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      canonicalUrl: pageRow.canonicalUrl,
      featuredImage: pageRow.featuredImage,
    },
    baseContent: shell,
  });

  if (!partial) return null;

  partial.content.generationMeta = {
    ...partial.content.generationMeta,
    engine: SEO_V61_CONFIG.engine,
    mode: "partial",
    generationTimeMs: partial.generationTimeMs,
    paragraphsRewritten: partial.paragraphsRewritten,
    duplicateConflictsFixed: partial.conflictsFixed,
  };
  return partial.content;
}

function stampGenerationMeta(content: SEOContent, mode: UniversalSeoMode, start: number) {
  content.generationMeta = {
    ...content.generationMeta,
    engine: SEO_V61_CONFIG.engine,
    mode: mode === "regenerate" ? "full" : "full",
    generationTimeMs: (content.generationMeta?.generationTimeMs as number | undefined) ?? Date.now() - start,
    config: SEO_V61_CONFIG,
  };
}

// ─── Optimize / rewrite modes ─────────────────────────────────────────────

async function runOptimizeMode(input: GenerateUniversalSeoInput & {
  pageType: SeoPageType;
  pageSlug: string;
  mode: UniversalSeoMode;
  start: number;
}): Promise<UniversalSeoResult> {
  let content = input.existingContent;
  let canonicalUrl: string | null = null;

  if (!content) {
    const page = await db.seoPage.findUnique({
      where: { pageType_pageSlug: { pageType: input.pageType, pageSlug: input.pageSlug } },
      include: { faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!page) throw new Error("Page not found");
    canonicalUrl = page.canonicalUrl;
    const intro = page.introContent ?? "";
    content = {
      title: page.title ?? "",
      metaDescription: page.metaDescription ?? "",
      h1: page.h1 ?? "",
      introParagraph: intro.split("\n\n")[0] ?? intro,
      fullIntroContent: intro,
      faqs: page.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      breadcrumbItems: [],
      internalLinks: [],
    };
  }

  const cityName = await resolveOptimizeCityName(input.pageType, input.pageSlug);
  const peers = await getCachedPeerPages(input.pageType, input.pageSlug);
  let paragraphsRewritten = 0;
  let conflictsFixed = 0;

  if (input.mode === "rewrite_paragraph" && input.paragraphIndex != null) {
    const intro = content.fullIntroContent ?? content.introParagraph;
    const peerIntros = input.conflictSlug
      ? peers.filter((p) => p.pageSlug === input.conflictSlug).map((p) => p.introContent ?? "")
      : peers.map((p) => p.introContent ?? "").filter(Boolean);

    const fingerprintParas = extractFingerprintParagraphs(intro);
    const targetPara = fingerprintParas[input.paragraphIndex];
    if (!targetPara) throw new Error("Paragraph not found");

    const rewritten = rewriteSimilarParagraphs(
      targetPara,
      peerIntros.filter(Boolean),
      cityName,
      input.paragraphIndex * 17,
      FP_THRESHOLD,
    );
    const blocks = intro.split(/\n\n+/).map((block) => {
      const body = block.replace(/^##H2::.*?##\s*/i, "").trim();
      if (body === targetPara || block.includes(targetPara)) {
        return block.replace(targetPara, rewritten);
      }
      return block;
    });
    content = { ...content, fullIntroContent: blocks.join("\n\n"), introParagraph: blocks[0] ?? "" };
    paragraphsRewritten = 1;
  } else if (input.mode === "rewrite_intro" || input.mode === "improve_keywords" || input.mode === "optimize") {
    const built = await buildPageContent({
      pageType: input.pageType,
      pageSlug: input.pageSlug,
      mode: "regenerate",
      excludePageId: input.excludePageId,
      start: input.start,
    });
    const regenIntro = built.content.fullIntroContent ?? built.content.introParagraph;
    const { intro: currentIntro, body } = splitIntroBody(content.fullIntroContent ?? content.introParagraph);
    const { intro: newIntro } = splitIntroBody(regenIntro);
    const merged = body ? `${newIntro || currentIntro}\n\n${body}` : (newIntro || regenIntro);
    content = {
      ...content,
      title: built.content.title || content.title,
      metaDescription: built.content.metaDescription || content.metaDescription,
      h1: built.content.h1 || content.h1,
      fullIntroContent: merged,
      introParagraph: merged.split("\n\n")[0] ?? merged,
      faqs: built.content.faqs.length > 0 ? built.content.faqs : content.faqs,
    };
    paragraphsRewritten = 1;
  } else if (input.mode === "improve_faq" || input.mode === "improve_cta") {
    const intro = content.fullIntroContent ?? content.introParagraph;
    const conflicts = detectSectionConflicts({
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      introContent: intro,
      faqs: content.faqs,
      peers: peers.map((p) => ({
        pageSlug: p.pageSlug,
        title: p.title,
        metaDescription: p.metaDescription,
        h1: p.h1,
        introContent: p.introContent,
        faqText: p.faqText,
      })),
      excludeSlug: input.pageSlug,
    });

    const relevant = input.mode === "improve_faq"
      ? conflicts.filter((c) => c.section === "faq_question" || c.section === "faq_answer")
      : conflicts.filter((c) => c.section === "cta");

    if (relevant.length > 0) {
      const fixed = applySectionConflictFixes({
        title: content.title,
        metaDescription: content.metaDescription,
        h1: content.h1,
        introContent: intro,
        faqs: content.faqs,
        conflicts: relevant,
        cityName,
      });
      content = {
        ...content,
        title: fixed.title,
        metaDescription: fixed.metaDescription,
        h1: fixed.h1,
        fullIntroContent: fixed.introContent,
        introParagraph: fixed.introContent.split("\n\n")[0] ?? fixed.introContent,
        faqs: fixed.faqs,
      };
      conflictsFixed = fixed.fixedCount;
    }
  }

  const metadata: Record<string, unknown> = {
    engine: SEO_V61_CONFIG.engine,
    mode: input.mode,
    paragraphsRewritten,
    duplicateConflictsFixed: conflictsFixed,
    generationTimeMs: Date.now() - input.start,
    config: SEO_V61_CONFIG,
  };

  if (input.priorUniqueness != null || input.priorSeoScore != null) {
    metadata.uniquenessBefore = input.priorUniqueness;
    metadata.seoBefore = input.priorSeoScore;
  }

  return {
    content,
    canonicalUrl,
    metadata,
    engine: SEO_V61_CONFIG,
    mode: input.mode,
    generationTimeMs: Date.now() - input.start,
  };
}

function splitIntroBody(markdown: string): { intro: string; body: string } {
  const lines = markdown.split("\n");
  let h2Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i] ?? "")) {
      h2Idx = i;
      break;
    }
  }
  if (h2Idx < 0) return { intro: markdown.trim(), body: "" };
  return {
    intro: lines.slice(0, h2Idx).join("\n").trim(),
    body: lines.slice(h2Idx).join("\n"),
  };
}

async function resolveOptimizeCityName(pageType: string, pageSlug: string): Promise<string> {
  if (pageType === "city") {
    const row = await db.city.findFirst({ where: { slug: pageSlug }, select: { name: true } });
    return row?.name ?? pageSlug.replace(/-/g, " ");
  }
  if (pageType === "category_city") {
    const slash = pageSlug.indexOf("/");
    const citySlug = slash >= 0 ? pageSlug.slice(slash + 1) : "";
    if (citySlug) {
      const row = await db.city.findFirst({ where: { slug: citySlug }, select: { name: true } });
      return row?.name ?? citySlug.replace(/-/g, " ");
    }
  }
  return pageSlug.replace(/-/g, " ");
}

/** Evaluate save policy using universal V6.1 thresholds. */
export function evaluateUniversalSaveDecision(input: {
  priorUniqueness: number | null | undefined;
  priorSeoScore: number | null | undefined;
  newUniqueness: number;
  newSeoScore: number;
  attemptsExhausted?: boolean;
}) {
  return evaluateV61SaveDecision(input);
}

/** Build standard generation metadata for persistence. */
export function buildUniversalGenerationMeta(input: {
  mode: UniversalSeoMode;
  priorUniqueness?: number | null;
  priorSeoScore?: number | null;
  newUniqueness?: number | null;
  newSeoScore?: number | null;
  rawMeta?: Record<string, unknown>;
  generationTimeMs: number;
  requiresManualReview?: boolean;
  failureReason?: string;
}): SeoGenerationMeta {
  const raw = input.rawMeta ?? {};
  return {
    engineVersion: String(raw.engine ?? SEO_V61_CONFIG.engine),
    mode: (raw.mode as SeoGenerationMeta["mode"]) ?? (input.mode === "regenerate" ? "full" : "full"),
    attemptsUsed: Number(raw.retriesUsed ?? raw.attemptsUsed ?? 1),
    candidatesEvaluated: Number(raw.candidatesEvaluated ?? raw.candidateCount ?? 1),
    candidateSelected: Number(raw.candidateSelected ?? 0),
    paragraphsRewritten: Number(raw.paragraphsRewritten ?? 0),
    duplicateConflictsFixed: Number(raw.conflictsFixed ?? raw.duplicateConflictsFixed ?? 0),
    uniquenessBefore: input.priorUniqueness ?? null,
    uniquenessAfter: input.newUniqueness ?? null,
    seoBefore: input.priorSeoScore ?? null,
    seoAfter: input.newSeoScore ?? null,
    generationTimeMs: input.generationTimeMs,
    intelligenceSources: [String(raw.intelligenceSource ?? "local_intelligence")],
    requiresManualReview: input.requiresManualReview,
    failureReason: input.failureReason,
    writingStyle: raw.writingStyle as string | undefined,
    architecture: raw.architecture as string | undefined,
    localReferenceCount: raw.localReferenceCount as number | undefined,
    listingContextFetchedAt: raw.listingContextFetchedAt as string | undefined,
  };
}

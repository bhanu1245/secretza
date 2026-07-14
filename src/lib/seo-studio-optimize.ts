/**
 * SEO Studio — partial AI optimizations (intro only, never full-page regen).
 */
import { generateCompletion, isAiConfigured } from "@/lib/ai/client";
import { buildSeoContext } from "@/lib/ai/context";
import {
  keywordDensityPrompt,
  reduceRepetitionPrompt,
  rewriteIntroPrompt,
} from "@/lib/ai/prompts";
import { isContentClean } from "@/lib/content-filter";
import { db } from "@/lib/db";
import type { SEOContent } from "@/lib/seo-content";
import { snapshotContentVersion } from "@/lib/seo-regeneration-service";
import { generateUniversalSeoContent } from "@/lib/seo-universal-engine";
import {
  computePageQualityMetrics,
  upsertSeoPage,
  type SeoPageType,
} from "@/lib/seo-page-service";
import { diffHighlight } from "@/lib/seo-studio-analysis";
import { finalizeIntroForPersistence } from "@/lib/seo-internal-links";
import { textSimilarity } from "@/lib/seo-quality";
import { rewriteSimilarParagraphs } from "@/lib/seo-uniqueness-engine";
import { extractFingerprintParagraphs } from "@/lib/seo-paragraph-fingerprints";

export type StudioOptimizeAction =
  | "rewrite_intro"
  | "reduce_repetition"
  | "keyword_density";

export const STUDIO_OPTIMIZE_ACTIONS: ReadonlySet<StudioOptimizeAction> = new Set([
  "rewrite_intro",
  "reduce_repetition",
  "keyword_density",
]);

export function isStudioOptimizeAction(id: string): id is StudioOptimizeAction {
  return STUDIO_OPTIMIZE_ACTIONS.has(id as StudioOptimizeAction);
}

export type StudioOptimizeResult = {
  success: boolean;
  action: StudioOptimizeAction;
  rollbackVersionId: string | null;
  before: {
    uniqueness: number | null;
    seoScore: number | null;
    introContent: string | null;
  };
  after: {
    uniqueness: number | null;
    seoScore: number | null;
    introContent: string | null;
  };
  comparison: {
    content: ReturnType<typeof diffHighlight>;
    uniqueness: { old: number | null; new: number | null; changed: boolean };
    seoScore: { old: number | null; new: number | null; changed: boolean };
  };
  unchanged?: boolean;
  message?: string;
  error?: string;
};

const TEMPLATE_PHRASES = [
  "browse verified listings",
  "find trusted providers",
  "discover the best",
  "explore our platform",
  "whether you are looking for",
  "secretza offers",
  "our platform connects",
];

const SENTENCE_OPENERS = [
  "In this area,",
  "Locally,",
  "For visitors,",
  "Across the district,",
  "Throughout the city,",
  "Nearby neighbourhoods offer",
];

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

function mergeIntroBody(intro: string, body: string): string {
  const trimmedIntro = intro.trim();
  if (!body.trim()) return trimmedIntro;
  return `${trimmedIntro}\n\n${body.trimStart()}`;
}

function cleanAiOutput(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

async function enforceCleanAiOutput(raw: string): Promise<string> {
  const text = cleanAiOutput(raw);
  if (!text) throw new Error("AI returned empty content");
  if (!isContentClean(text)) throw new Error("AI output failed safety checks");
  return text;
}

function pageToSeoContent(
  page: {
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    introContent: string | null;
  },
  faqs: Array<{ question: string; answer: string }>,
): SEOContent {
  const intro = page.introContent ?? "";
  return {
    title: page.title ?? "",
    metaDescription: page.metaDescription ?? "",
    h1: page.h1 ?? "",
    introParagraph: intro.split("\n\n")[0] ?? intro,
    fullIntroContent: intro,
    faqs,
    breadcrumbItems: [],
    internalLinks: [],
  };
}

async function loadOptimizeContext(pageType: string, pageSlug: string) {
  let city: string | null = null;
  let category: string | null = null;
  let state: string | null = null;

  if (pageType === "city") {
    const row = await db.city.findFirst({
      where: { slug: pageSlug },
      select: { name: true, state: { select: { name: true } } },
    });
    city = row?.name ?? pageSlug.replace(/-/g, " ");
    state = row?.state?.name ?? null;
  } else if (pageType === "category_city") {
    const slash = pageSlug.indexOf("/");
    const catSlug = slash >= 0 ? pageSlug.slice(0, slash) : pageSlug;
    const citySlug = slash >= 0 ? pageSlug.slice(slash + 1) : "";
    const cat = await db.category.findFirst({
      where: { slug: catSlug },
      select: { name: true },
    });
    category = cat?.name ?? catSlug.replace(/-/g, " ");
    if (citySlug) {
      const row = await db.city.findFirst({
        where: { slug: citySlug },
        select: { name: true, state: { select: { name: true } } },
      });
      city = row?.name ?? citySlug.replace(/-/g, " ");
      state = row?.state?.name ?? null;
    }
  } else if (pageType === "category") {
    const cat = await db.category.findFirst({
      where: { slug: pageSlug },
      select: { name: true },
    });
    category = cat?.name ?? pageSlug.replace(/-/g, " ");
  }

  return { city, category, state };
}

function buildTargetKeywords(
  h1: string | null,
  city: string | null,
  category: string | null,
): string[] {
  const keywords: string[] = [];
  if (city && category) keywords.push(`${category.toLowerCase()} in ${city}`);
  if (city) keywords.push(city);
  if (category) keywords.push(category);
  if (h1?.trim()) keywords.push(h1.trim());
  const seen = new Set<string>();
  return keywords.filter((k) => {
    const key = k.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findRepetitiveParagraphs(content: string): string[] {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim() && !/^#{1,3}\s/.test(p));
  const sentenceCounts = new Map<string, number>();
  const flagged: string[] = [];

  for (const para of paragraphs) {
    const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
    let dupCount = 0;
    for (const sentence of sentences) {
      const norm = normalizeSentence(sentence);
      if (norm.length < 20) continue;
      const count = (sentenceCounts.get(norm) ?? 0) + 1;
      sentenceCounts.set(norm, count);
      if (count > 1) dupCount++;
    }
    const lower = para.toLowerCase();
    const hasTemplate = TEMPLATE_PHRASES.some((t) => lower.includes(t));
    if (dupCount > 0 || hasTemplate) flagged.push(para);
  }

  return flagged;
}

function fallbackRewriteIntro(
  currentIntro: string,
  regeneratedIntro: string,
  body: string,
): string {
  const newIntro = regeneratedIntro.trim() || currentIntro;
  return mergeIntroBody(newIntro, body);
}

function fallbackReduceRepetition(content: string, city: string | null): string {
  const lines = content.split("\n");
  const seenSentences = new Map<string, number>();
  let openerIdx = 0;

  return lines
    .map((line) => {
      if (/^#{1,3}\s/.test(line)) return line;
      if (!line.trim()) return line;

      const sentences = line.split(/(?<=[.!?])\s+/);
      const rewritten = sentences.map((sentence) => {
        const norm = normalizeSentence(sentence);
        if (norm.length < 20) return sentence;

        const count = (seenSentences.get(norm) ?? 0) + 1;
        seenSentences.set(norm, count);

        if (count <= 1) return sentence;

        const opener = SENTENCE_OPENERS[openerIdx % SENTENCE_OPENERS.length]!;
        openerIdx++;
        const trimmed = sentence.trim();
        const rest = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
        let next = `${opener} ${rest}`;

        if (city && !next.toLowerCase().includes(city.toLowerCase())) {
          next = next.replace(/\.$/, ` in ${city}.`);
        }
        return next;
      });

      let result = rewritten.join(" ");
      for (const phrase of TEMPLATE_PHRASES) {
        if (result.toLowerCase().includes(phrase) && city) {
          result = result.replace(
            new RegExp(phrase, "gi"),
            `explore ${city}'s local listings`,
          );
        }
      }
      return result;
    })
    .join("\n");
}

function fallbackKeywordDensity(
  content: string,
  keywords: string[],
  city: string | null,
  category: string | null,
): string {
  const primary = keywords[0] ?? (city && category ? `${category} in ${city}` : city ?? "");
  if (!primary) return content;

  const lines = content.split("\n");
  let paraSinceKeyword = 0;

  return lines
    .map((line) => {
      if (/^##\s+/.test(line)) {
        const heading = line.replace(/^##\s+/, "");
        if (city && !heading.toLowerCase().includes(city.toLowerCase())) {
          return `## ${heading} in ${city}`;
        }
        if (category && !heading.toLowerCase().includes(category.toLowerCase())) {
          return `## ${category} — ${heading}`;
        }
        return line;
      }

      if (!line.trim() || /^#{1,3}\s/.test(line)) return line;

      paraSinceKeyword++;
      const lower = line.toLowerCase();
      const hasPrimary =
        lower.includes(primary.toLowerCase()) ||
        (city && lower.includes(city.toLowerCase()));

      if (!hasPrimary && paraSinceKeyword >= 3 && city) {
        paraSinceKeyword = 0;
        const suffix = ` ${city} listings are updated regularly on SecretZa.`;
        return line.endsWith(".") ? `${line}${suffix}` : `${line}.${suffix}`;
      }
      return line;
    })
    .join("\n");
}

async function runAiRewriteIntro(
  intro: string,
  body: string,
  ctx: ReturnType<typeof buildSeoContext>,
  city: string | null,
  category: string | null,
  keywords: string[],
): Promise<string> {
  const { system, prompt } = rewriteIntroPrompt({
    summary: ctx.summary,
    city: city ?? undefined,
    category: category ?? undefined,
    keywords,
    intro,
    preserveAfter: body ? "H2 sections follow and must not be changed." : "",
  });
  const raw = await generateCompletion({ system, prompt, maxTokens: 1200, temperature: 0.55 });
  const rewritten = await enforceCleanAiOutput(raw);
  return mergeIntroBody(rewritten, body);
}

async function runAiReduceRepetition(
  content: string,
  ctx: ReturnType<typeof buildSeoContext>,
  city: string | null,
  repetitive: string[],
): Promise<string> {
  const { system, prompt } = reduceRepetitionPrompt({
    summary: ctx.summary,
    city: city ?? undefined,
    repetitiveSections: repetitive.join("\n\n---\n\n"),
    fullContent: content,
  });
  const raw = await generateCompletion({ system, prompt, maxTokens: 2000, temperature: 0.5 });
  return enforceCleanAiOutput(raw);
}

async function runAiKeywordDensity(
  content: string,
  ctx: ReturnType<typeof buildSeoContext>,
  city: string | null,
  category: string | null,
  keywords: string[],
): Promise<string> {
  const { system, prompt } = keywordDensityPrompt({
    summary: ctx.summary,
    city: city ?? undefined,
    category: category ?? undefined,
    keywords,
    content,
  });
  const raw = await generateCompletion({ system, prompt, maxTokens: 2000, temperature: 0.45 });
  return enforceCleanAiOutput(raw);
}

async function optimizeIntroContent(
  action: StudioOptimizeAction,
  pageType: string,
  pageSlug: string,
  introContent: string,
  h1: string | null,
): Promise<string> {
  const { intro, body } = splitIntroBody(introContent);
  const { city, category } = await loadOptimizeContext(pageType, pageSlug);
  const keywords = buildTargetKeywords(h1, city, category);
  const seoCtx = buildSeoContext({
    listingTitle: h1,
    city,
    category,
    pageType,
    keywords,
    description: introContent.slice(0, 600),
  });

  if (action === "rewrite_intro") {
    if (isAiConfigured()) {
      try {
        return await runAiRewriteIntro(intro, body, seoCtx, city, category, keywords);
      } catch {
        // fall through to template merge
      }
    }
    const built = await generateUniversalSeoContent({
      pageType: pageType as SeoPageType,
      pageSlug,
      mode: "rewrite_intro",
    });
    const regenIntro = splitIntroBody(
      built.content.fullIntroContent ?? built.content.introParagraph,
    ).intro;
    return fallbackRewriteIntro(intro, regenIntro, body);
  }

  if (action === "reduce_repetition") {
    const repetitive = findRepetitiveParagraphs(introContent);
    if (isAiConfigured()) {
      try {
        return await runAiReduceRepetition(introContent, seoCtx, city, repetitive);
      } catch {
        // fall through to V6.1 universal engine
      }
    }
    try {
      const built = await generateUniversalSeoContent({
        pageType: pageType as SeoPageType,
        pageSlug,
        mode: "optimize",
        existingContent: {
          title: h1 ?? "",
          metaDescription: "",
          h1: h1 ?? "",
          introParagraph: introContent.split("\n\n")[0] ?? introContent,
          fullIntroContent: introContent,
          faqs: [],
          breadcrumbItems: [],
          internalLinks: [],
        },
      });
      return built.content.fullIntroContent ?? built.content.introParagraph;
    } catch {
      return fallbackReduceRepetition(introContent, city);
    }
  }

  if (action === "keyword_density") {
    if (isAiConfigured()) {
      try {
        return await runAiKeywordDensity(introContent, seoCtx, city, category, keywords);
      } catch {
        // fall through to V6.1 universal engine
      }
    }
    try {
      const built = await generateUniversalSeoContent({
        pageType: pageType as SeoPageType,
        pageSlug,
        mode: "improve_keywords",
        existingContent: {
          title: h1 ?? "",
          metaDescription: "",
          h1: h1 ?? "",
          introParagraph: introContent.split("\n\n")[0] ?? introContent,
          fullIntroContent: introContent,
          faqs: [],
          breadcrumbItems: [],
          internalLinks: [],
        },
      });
      return built.content.fullIntroContent ?? built.content.introParagraph;
    } catch {
      return fallbackKeywordDensity(introContent, keywords, city, category);
    }
  }

  throw new Error("Unknown optimization action");
}

/** Rewrite only paragraphs overlapping a specific conflicting peer page. */
export async function applyFixConflict(input: {
  seoPageId: string;
  pageType: string;
  pageSlug: string;
  conflictSlug: string;
  runId?: string | null;
  createdBy?: { id: string; email: string };
}): Promise<StudioOptimizeResult> {
  const page = await db.seoPage.findUnique({
    where: { id: input.seoPageId },
    include: { faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!page?.introContent?.trim()) throw new Error("Page has no content");

  const peer = await db.seoPage.findFirst({
    where: { pageType: input.pageType, pageSlug: input.conflictSlug },
    select: { introContent: true },
  });
  if (!peer?.introContent?.trim()) throw new Error("Conflict page not found");

  const { city } = await loadOptimizeContext(input.pageType, input.pageSlug);
  const cityName = city ?? input.pageSlug.replace(/-/g, " ");
  const flagged = extractFingerprintParagraphs(page.introContent).filter((para) => {
    for (const peerPara of extractFingerprintParagraphs(peer.introContent)) {
      if (textSimilarity(para, peerPara) > 0.25) return true;
    }
    return false;
  });

  if (flagged.length === 0) {
    return applyStudioOptimize({
      seoPageId: input.seoPageId,
      pageType: input.pageType,
      pageSlug: input.pageSlug,
      action: "reduce_repetition",
      runId: input.runId,
      createdBy: input.createdBy,
    });
  }

  const optimizedRaw = rewriteSimilarParagraphs(
    page.introContent,
    [peer.introContent],
    cityName,
    Date.now() % 1000,
    0.2,
  );

  const beforeMetrics = {
    uniqueness: page.uniquenessScore,
    seoScore: page.seoQualityScore,
    introContent: page.introContent,
  };

  const introContent = await finalizeIntroForPersistence(
    optimizedRaw,
    input.pageType,
    input.pageSlug,
  );

  if (introContent.trim() === page.introContent.trim()) {
    return {
      success: true,
      action: "reduce_repetition",
      rollbackVersionId: null,
      before: beforeMetrics,
      after: beforeMetrics,
      comparison: {
        content: diffHighlight(page.introContent, introContent),
        uniqueness: { old: beforeMetrics.uniqueness, new: beforeMetrics.uniqueness, changed: false },
        seoScore: { old: beforeMetrics.seoScore, new: beforeMetrics.seoScore, changed: false },
      },
      unchanged: true,
    };
  }

  const faqs = page.faqs.map((f) => ({ question: f.question, answer: f.answer }));
  const content = pageToSeoContent(page, faqs);
  content.fullIntroContent = introContent;
  content.introParagraph = introContent.split("\n\n")[0] ?? introContent;

  const metrics = await computePageQualityMetrics(
    input.pageType as SeoPageType,
    input.pageSlug,
    content,
    introContent,
    {
      featuredImage: page.featuredImage,
      canonicalUrl: page.canonicalUrl ?? "",
      excludePageId: page.id,
    },
  );

  const version = await snapshotContentVersion(
    page.id,
    input.runId ?? null,
    input.createdBy,
    { optimizationAction: `fix_conflict:${input.conflictSlug}` },
  );

  await upsertSeoPage({
    pageType: input.pageType as SeoPageType,
    pageSlug: input.pageSlug,
    title: page.title ?? "",
    metaDescription: page.metaDescription ?? "",
    h1: page.h1 ?? "",
    introContent,
    canonicalUrl: page.canonicalUrl ?? "",
    customData: page.customData,
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt,
    imageTitle: page.imageTitle,
    imageCaption: page.imageCaption,
    isPublished: page.isPublished,
    noindex: page.noindex,
    wordCount: metrics.wordCount,
    faqCount: metrics.faqCount,
    internalLinksCount: metrics.internalLinksCount,
    uniquenessScore: metrics.uniquenessScore,
    duplicateRisk: metrics.duplicateRisk,
    seoQualityScore: metrics.seoQualityScore,
    contentHash: metrics.contentHash,
  });

  const afterMetrics = {
    uniqueness: metrics.uniquenessScore,
    seoScore: metrics.seoQualityScore,
    introContent,
  };

  return {
    success: true,
    action: "reduce_repetition",
    rollbackVersionId: version?.id ?? null,
    before: beforeMetrics,
    after: afterMetrics,
    comparison: {
      content: diffHighlight(beforeMetrics.introContent, afterMetrics.introContent),
      uniqueness: {
        old: beforeMetrics.uniqueness,
        new: afterMetrics.uniqueness,
        changed: beforeMetrics.uniqueness !== afterMetrics.uniqueness,
      },
      seoScore: {
        old: beforeMetrics.seoScore,
        new: afterMetrics.seoScore,
        changed: beforeMetrics.seoScore !== afterMetrics.seoScore,
      },
    },
  };
}

/** Rewrite a single paragraph that exceeds duplicate threshold. */
export async function applyFixParagraph(input: {
  seoPageId: string;
  pageType: string;
  pageSlug: string;
  paragraphIndex: number;
  conflictSlug?: string;
  runId?: string | null;
  createdBy?: { id: string; email: string };
}): Promise<StudioOptimizeResult> {
  const page = await db.seoPage.findUnique({
    where: { id: input.seoPageId },
    include: { faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!page?.introContent?.trim()) throw new Error("Page has no content");

  const blocks = page.introContent.split(/\n\n+/);
  const fingerprintParas = extractFingerprintParagraphs(page.introContent);
  const targetPara = fingerprintParas[input.paragraphIndex];
  if (!targetPara) throw new Error("Paragraph not found");

  let peerIntros: string[] = [];
  if (input.conflictSlug) {
    const peer = await db.seoPage.findFirst({
      where: { pageType: input.pageType, pageSlug: input.conflictSlug },
      select: { introContent: true },
    });
    if (peer?.introContent) peerIntros = [peer.introContent];
  } else {
    const peers = await db.seoPage.findMany({
      where: { pageType: input.pageType, pageSlug: { not: input.pageSlug } },
      select: { introContent: true },
      take: 30,
    });
    peerIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);
  }

  const { city } = await loadOptimizeContext(input.pageType, input.pageSlug);
  const cityName = city ?? input.pageSlug.replace(/-/g, " ");
  const rewritten = rewriteSimilarParagraphs(
    targetPara,
    peerIntros,
    cityName,
    input.paragraphIndex * 17 + Date.now() % 100,
    0.2,
  );

  const newBlocks = blocks.map((block) => {
    const body = block.replace(/^##H2::.*?##\s*/i, "").trim();
    if (body === targetPara || block.includes(targetPara)) {
      return block.replace(targetPara, rewritten);
    }
    return block;
  });
  const optimizedRaw = newBlocks.join("\n\n");

  const beforeMetrics = {
    uniqueness: page.uniquenessScore,
    seoScore: page.seoQualityScore,
    introContent: page.introContent,
  };

  const introContent = await finalizeIntroForPersistence(
    optimizedRaw,
    input.pageType,
    input.pageSlug,
  );

  if (introContent.trim() === page.introContent.trim()) {
    return {
      success: true,
      action: "reduce_repetition",
      rollbackVersionId: null,
      before: beforeMetrics,
      after: beforeMetrics,
      comparison: {
        content: diffHighlight(page.introContent, introContent),
        uniqueness: { old: beforeMetrics.uniqueness, new: beforeMetrics.uniqueness, changed: false },
        seoScore: { old: beforeMetrics.seoScore, new: beforeMetrics.seoScore, changed: false },
      },
      unchanged: true,
      message: "Paragraph already unique",
    };
  }

  const faqs = page.faqs.map((f) => ({ question: f.question, answer: f.answer }));
  const content = pageToSeoContent(page, faqs);
  content.fullIntroContent = introContent;
  content.introParagraph = introContent.split("\n\n")[0] ?? introContent;

  const metrics = await computePageQualityMetrics(
    input.pageType as SeoPageType,
    input.pageSlug,
    content,
    introContent,
    {
      featuredImage: page.featuredImage,
      canonicalUrl: page.canonicalUrl ?? "",
      excludePageId: page.id,
    },
  );

  const version = await snapshotContentVersion(
    page.id,
    input.runId ?? null,
    input.createdBy,
    {
      optimizationAction: `fix_paragraph:${input.paragraphIndex}${input.conflictSlug ? `:${input.conflictSlug}` : ""}`,
    },
  );

  await upsertSeoPage({
    pageType: input.pageType as SeoPageType,
    pageSlug: input.pageSlug,
    title: page.title ?? "",
    metaDescription: page.metaDescription ?? "",
    h1: page.h1 ?? "",
    introContent,
    canonicalUrl: page.canonicalUrl ?? "",
    featuredImage: page.featuredImage,
    noindex: page.noindex,
    wordCount: metrics.wordCount,
    faqCount: metrics.faqCount,
    internalLinksCount: metrics.internalLinksCount,
    uniquenessScore: metrics.uniquenessScore,
    duplicateRisk: metrics.duplicateRisk,
    seoQualityScore: metrics.seoQualityScore,
    contentHash: metrics.contentHash,
  });

  const afterMetrics = {
    uniqueness: metrics.uniquenessScore,
    seoScore: metrics.seoQualityScore,
    introContent,
  };

  return {
    success: true,
    action: "reduce_repetition",
    rollbackVersionId: version?.id ?? null,
    before: beforeMetrics,
    after: afterMetrics,
    comparison: {
      content: diffHighlight(beforeMetrics.introContent, afterMetrics.introContent),
      uniqueness: {
        old: beforeMetrics.uniqueness,
        new: afterMetrics.uniqueness,
        changed: beforeMetrics.uniqueness !== afterMetrics.uniqueness,
      },
      seoScore: {
        old: beforeMetrics.seoScore,
        new: afterMetrics.seoScore,
        changed: beforeMetrics.seoScore !== afterMetrics.seoScore,
      },
    },
  };
}

export async function applyStudioOptimize(input: {
  seoPageId: string;
  pageType: string;
  pageSlug: string;
  action: StudioOptimizeAction;
  runId?: string | null;
  createdBy?: { id: string; email: string };
}): Promise<StudioOptimizeResult> {
  const page = await db.seoPage.findUnique({
    where: { id: input.seoPageId },
    include: { faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!page) throw new Error("Page not found");
  if (!page.introContent?.trim()) throw new Error("Page has no intro content to optimize");

  const beforeMetrics = {
    uniqueness: page.uniquenessScore,
    seoScore: page.seoQualityScore,
    introContent: page.introContent,
  };

  const optimizedRaw = await optimizeIntroContent(
    input.action,
    input.pageType,
    input.pageSlug,
    page.introContent,
    page.h1,
  );

  const introContent = await finalizeIntroForPersistence(
    optimizedRaw,
    input.pageType,
    input.pageSlug,
  );

  if (introContent.trim() === page.introContent.trim()) {
    return {
      success: true,
      action: input.action,
      rollbackVersionId: null,
      before: beforeMetrics,
      after: beforeMetrics,
      comparison: {
        content: diffHighlight(page.introContent, introContent),
        uniqueness: {
          old: beforeMetrics.uniqueness,
          new: beforeMetrics.uniqueness,
          changed: false,
        },
        seoScore: {
          old: beforeMetrics.seoScore,
          new: beforeMetrics.seoScore,
          changed: false,
        },
      },
      unchanged: true,
    };
  }

  const faqs = page.faqs.map((f) => ({ question: f.question, answer: f.answer }));
  const content = pageToSeoContent(page, faqs);
  content.fullIntroContent = introContent;
  content.introParagraph = introContent.split("\n\n")[0] ?? introContent;

  const metrics = await computePageQualityMetrics(
    input.pageType as SeoPageType,
    input.pageSlug,
    content,
    introContent,
    {
      featuredImage: page.featuredImage,
      canonicalUrl: page.canonicalUrl ?? "",
      excludePageId: page.id,
    },
  );

  const version = await snapshotContentVersion(
    page.id,
    input.runId ?? null,
    input.createdBy,
  );

  await upsertSeoPage({
    pageType: input.pageType as SeoPageType,
    pageSlug: input.pageSlug,
    title: page.title ?? "",
    metaDescription: page.metaDescription ?? "",
    h1: page.h1 ?? "",
    introContent,
    canonicalUrl: page.canonicalUrl ?? "",
    customData: page.customData,
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt,
    imageTitle: page.imageTitle,
    imageCaption: page.imageCaption,
    isPublished: page.isPublished,
    noindex: page.noindex,
    wordCount: metrics.wordCount,
    faqCount: metrics.faqCount,
    internalLinksCount: metrics.internalLinksCount,
    uniquenessScore: metrics.uniquenessScore,
    duplicateRisk: metrics.duplicateRisk,
    seoQualityScore: metrics.seoQualityScore,
    contentHash: metrics.contentHash,
  });

  const afterMetrics = {
    uniqueness: metrics.uniquenessScore,
    seoScore: metrics.seoQualityScore,
    introContent,
  };

  return {
    success: true,
    action: input.action,
    rollbackVersionId: version?.id ?? null,
    before: beforeMetrics,
    after: afterMetrics,
    comparison: {
      content: diffHighlight(beforeMetrics.introContent, afterMetrics.introContent),
      uniqueness: {
        old: beforeMetrics.uniqueness,
        new: afterMetrics.uniqueness,
        changed: beforeMetrics.uniqueness !== afterMetrics.uniqueness,
      },
      seoScore: {
        old: beforeMetrics.seoScore,
        new: afterMetrics.seoScore,
        changed: beforeMetrics.seoScore !== afterMetrics.seoScore,
      },
    },
  };
}

/** Score how repetitive a block is vs the rest of the page (0–1). */
export function repetitionScore(block: string, fullContent: string): number {
  if (!block.trim() || !fullContent.trim()) return 0;
  return textSimilarity(block, fullContent.replace(block, ""));
}

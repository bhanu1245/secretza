/**
 * SEO Quality & Duplicate Detection Engine
 * Validates content length, computes uniqueness scores, and flags duplicate risk.
 */

export type DuplicateRisk = "low" | "medium" | "high";

export interface SeoPageSnapshot {
  id?: string;
  pageType: string;
  pageSlug: string;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introContent?: string | null;
  faqText?: string | null;
}

export interface DuplicateFieldFlags {
  title: boolean;
  metaDescription: boolean;
  h1: boolean;
  introContent: boolean;
  faqContent: boolean;
}

export interface SeoQualityInput {
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introContent?: string | null;
  canonicalUrl?: string | null;
  featuredImage?: string | null;
  faqCount: number;
  internalLinksCount: number;
  wordCount: number;
  uniquenessScore: number;
  duplicateFields: DuplicateFieldFlags;
}

export interface SeoQualityResult {
  wordCount: number;
  faqCount: number;
  internalLinksCount: number;
  uniquenessScore: number;
  duplicateRisk: DuplicateRisk;
  seoQualityScore: number;
  duplicateFields: DuplicateFieldFlags;
  contentHash: string;
  meetsMinWordCount: boolean;
}

const MIN_WORD_COUNT = 500;

/** Target word count for generators (buffer above minimum for sanitization losses). */
export const SEO_GENERATION_TARGET_WORDS = 650;

/**
 * Strip markup to human-readable visible text for word counting.
 * Ignores HTML, markdown syntax, URLs, and JSON-LD blocks.
 */
export function stripToVisibleText(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\{[\s\S]*?"@type"[\s\S]*?\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>#\-|]+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Count visible human-readable words — shared by dashboard, DB metrics, and audits. */
export function calculateVisibleWordCount(text: string | null | undefined): number {
  const plain = stripToVisibleText(text);
  if (!plain) return 0;
  return plain.split(/\s+/).filter((w) => w.length > 0).length;
}

/** @alias calculateVisibleWordCount — all SEO pipelines use visible text counting. */
export function countWords(text: string | null | undefined): number {
  return calculateVisibleWordCount(text);
}

export function meetsMinWordCount(text: string | null | undefined): boolean {
  return calculateVisibleWordCount(text) >= MIN_WORD_COUNT;
}

/** Normalize text for comparison — lowercase, strip punctuation, collapse whitespace. */
export function normalizeForComparison(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BOILERPLATE_TOKENS = new Set([
  "SecretZa", "verified", "listings", "listing", "adult", "services", "service",
  "browse", "platform", "directory", "classifieds", "providers", "provider",
  "profiles", "profile", "photos", "reviews", "search", "filters", "filter",
  "india", "indian", "every", "through", "whether", "across", "daily",
  "quality", "authentic", "genuine", "secure", "messaging", "moderation",
  "discreet", "updated", "connect", "communication", "encounters",
]);

/** Extract meaningful tokens (4+ chars) for similarity, de-emphasizing boilerplate. */
export function tokenize(text: string): Set<string> {
  return new Set(
    normalizeForComparison(text)
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !BOILERPLATE_TOKENS.has(w)),
  );
}

/** Jaccard similarity between two texts (0–1). */
export function textSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  let union = setA.size;
  for (const token of setB) { if (!setA.has(token)) union++; }
  return union === 0 ? 0 : intersection / union;
}

/** Stable hash for duplicate intro detection. */
export function computeContentHash(text: string | null | undefined): string {
  const normalized = normalizeForComparison(text);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/** Compare a candidate page against existing pages for exact/normalized duplicates. */
export function detectDuplicateFields(
  candidate: SeoPageSnapshot,
  existingPages: SeoPageSnapshot[],
): DuplicateFieldFlags {
  const flags: DuplicateFieldFlags = {
    title: false,
    metaDescription: false,
    h1: false,
    introContent: false,
    faqContent: false,
  };

  const normTitle = normalizeForComparison(candidate.title);
  const normMeta = normalizeForComparison(candidate.metaDescription);
  const normH1 = normalizeForComparison(candidate.h1);
  const normIntro = normalizeForComparison(candidate.introContent);
  const normFaq = normalizeForComparison(candidate.faqText);
  const introHash = computeContentHash(candidate.introContent);

  for (const page of existingPages) {
    if (page.id && candidate.id && page.id === candidate.id) continue;
    if (page.pageType === candidate.pageType && page.pageSlug === candidate.pageSlug) continue;

    if (normTitle && normTitle === normalizeForComparison(page.title)) {
      flags.title = true;
    }
    if (normMeta && normMeta === normalizeForComparison(page.metaDescription)) {
      flags.metaDescription = true;
    }
    if (normH1 && normH1 === normalizeForComparison(page.h1)) {
      flags.h1 = true;
    }
    if (
      normIntro &&
      (normIntro === normalizeForComparison(page.introContent) ||
        introHash === computeContentHash(page.introContent))
    ) {
      flags.introContent = true;
    }
    if (normFaq && normFaq === normalizeForComparison(page.faqText)) {
      flags.faqContent = true;
    }
  }

  return flags;
}

export interface UniquenessBreakdown {
  overall: number;
  introScore: number;
  paragraphMinScore: number;
  faqScore: number;
  titleScore: number;
  metaScore: number;
  maxIntroSimilarity: number;
  maxFaqSimilarity: number;
  maxTitleSimilarity: number;
  maxMetaSimilarity: number;
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 40);
}

/** Worst-case paragraph uniqueness — penalises template paragraphs. */
export function computeParagraphMinUniqueness(
  intro: string,
  peerIntros: string[],
  maxPeers = 30,
): number {
  const paragraphs = splitParagraphs(intro);
  if (paragraphs.length === 0) return 0;

  const peers = peerIntros.slice(0, maxPeers);
  let minScore = 100;
  for (const para of paragraphs) {
    let maxSim = 0;
    for (const peer of peers) {
      const peerParagraphs = splitParagraphs(peer).slice(0, 6);
      for (const peerPara of peerParagraphs) {
        maxSim = Math.max(maxSim, textSimilarity(para, peerPara));
      }
    }
    minScore = Math.min(minScore, Math.round((1 - maxSim) * 100));
  }
  return minScore;
}

function maxFieldSimilarity(
  value: string | null | undefined,
  peers: Array<string | null | undefined>,
): number {
  if (!value?.trim()) return 0;
  let max = 0;
  for (const p of peers) {
    if (!p?.trim()) continue;
    max = Math.max(max, textSimilarity(value, p));
  }
  return max;
}

/**
 * Composite uniqueness (0–100):
 * 50% paragraph-min intro, 25% FAQ, 12.5% title, 12.5% meta.
 * Legacy whole-doc Jaccard kept as introScore for diagnostics.
 */
export function computeCompositeUniqueness(input: {
  introContent: string;
  faqText: string;
  title: string;
  metaDescription: string;
  peerIntros: string[];
  peerFaqs: string[];
  peerTitles: string[];
  peerMetas: string[];
}): UniquenessBreakdown {
  const introScore = computeUniquenessScore(input.introContent, input.peerIntros);
  const paragraphMinScore = computeParagraphMinUniqueness(input.introContent, input.peerIntros);

  const maxIntroSimilarity = introScore === 100 ? 0 : (100 - introScore) / 100;
  const maxFaqSimilarity = maxFieldSimilarity(input.faqText, input.peerFaqs);
  const maxTitleSimilarity = maxFieldSimilarity(input.title, input.peerTitles);
  const maxMetaSimilarity = maxFieldSimilarity(input.metaDescription, input.peerMetas);

  const faqScore = Math.round((1 - maxFaqSimilarity) * 100);
  const titleScore = Math.round((1 - maxTitleSimilarity) * 100);
  const metaScore = Math.round((1 - maxMetaSimilarity) * 100);

  const overall = Math.round(
    paragraphMinScore * 0.5 +
    faqScore * 0.25 +
    titleScore * 0.125 +
    metaScore * 0.125,
  );

  return {
    overall,
    introScore,
    paragraphMinScore,
    faqScore,
    titleScore,
    metaScore,
    maxIntroSimilarity,
    maxFaqSimilarity,
    maxTitleSimilarity,
    maxMetaSimilarity,
  };
}

/** Max similarity vs other intros → uniqueness score 0–100. @deprecated Use computeCompositeUniqueness */
export function computeUniquenessScore(
  introContent: string,
  otherIntros: string[],
): number {
  if (!introContent.trim()) return 0;
  if (otherIntros.length === 0) return 100;

  let maxSimilarity = 0;
  for (const other of otherIntros) {
    if (!other.trim()) continue;
    maxSimilarity = Math.max(maxSimilarity, textSimilarity(introContent, other));
  }

  return Math.round((1 - maxSimilarity) * 100);
}

export function computeDuplicateRisk(
  uniquenessScore: number,
  duplicateFields: DuplicateFieldFlags,
  maxIntroSimilarity?: number,
): DuplicateRisk {
  const hasExactDuplicate = Object.values(duplicateFields).some(Boolean);
  const similarity = maxIntroSimilarity ?? (100 - uniquenessScore) / 100;

  if (hasExactDuplicate || similarity >= 0.85) return "high";
  if (uniquenessScore >= 70 && !hasExactDuplicate) return "low";
  if (similarity >= 0.55 || uniquenessScore < 50) return "high";
  if (uniquenessScore < 70) return "medium";
  return "low";
}

/** Weighted SEO quality score 0–100. */
export function computeSeoQualityScore(input: SeoQualityInput): number {
  let score = 0;

  // Content length (25 pts) — full at 500+ words
  const wordRatio = Math.min(input.wordCount / MIN_WORD_COUNT, 1);
  score += wordRatio * 25;

  // Uniqueness (25 pts)
  score += (input.uniquenessScore / 100) * 25;

  // Internal links (15 pts) — full at 5+
  score += Math.min(input.internalLinksCount / 5, 1) * 15;

  // FAQ count (15 pts) — full at 5+
  score += Math.min(input.faqCount / 5, 1) * 15;

  // Metadata completeness (20 pts)
  let metaScore = 0;
  if (input.title?.trim()) metaScore += 4;
  if (input.metaDescription?.trim()) metaScore += 4;
  if (input.h1?.trim()) metaScore += 4;
  if (input.canonicalUrl?.trim()) metaScore += 4;
  if (input.featuredImage?.trim()) metaScore += 4;
  score += metaScore;

  // Penalty for duplicate fields
  const dupCount = Object.values(input.duplicateFields).filter(Boolean).length;
  score -= dupCount * 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeSeoContent(
  input: SeoQualityInput,
  maxIntroSimilarity?: number,
): SeoQualityResult {
  const duplicateRisk = computeDuplicateRisk(
    input.uniquenessScore,
    input.duplicateFields,
    maxIntroSimilarity,
  );

  return {
    wordCount: input.wordCount,
    faqCount: input.faqCount,
    internalLinksCount: input.internalLinksCount,
    uniquenessScore: input.uniquenessScore,
    duplicateRisk,
    seoQualityScore: computeSeoQualityScore(input),
    duplicateFields: input.duplicateFields,
    contentHash: computeContentHash(input.introContent),
    meetsMinWordCount: input.wordCount >= MIN_WORD_COUNT,
  };
}

export const SEO_MIN_WORD_COUNT = MIN_WORD_COUNT;

/**
 * DuplicateContentMetricsProvider
 *
 * Purpose:
 *   Measures intra-document duplicate and repetition signals.
 *   Measurement only — no scoring, no thresholds, no inter-page comparison.
 *
 * Owned QualityMetrics fields:
 *   duplicateSentenceCount, duplicateParagraphCount, duplicateHeadingCount,
 *   duplicateFaqQuestionCount, duplicateFaqAnswerCount, duplicateLeadInCount,
 *   duplicateIntroSentenceCount, repeatedPhraseCount,
 *   repeatedBigramCount, repeatedTrigramCount, repeatedFourGramCount,
 *   maxDuplicateRunLength, uniqueSentenceRatio, uniqueParagraphRatio,
 *   uniqueHeadingRatio, uniqueFaqQuestionRatio, uniqueFaqAnswerRatio,
 *   templateReuseRatio, boilerplateParagraphCount, boilerplateSentenceCount,
 *   selfSimilarityScore, introSectionSimilarity, headingSimilarity,
 *   faqSimilarity, duplicateWordRunCount, duplicateTokenRatio,
 *   largestRepeatedBlockLength
 *
 * Execution order: 8 (wave 1 — no provider dependencies)
 *
 * Duplicate detection strategy:
 *   All comparison is exact, on normalised text (lowercase + collapsed whitespace
 *   + collapsed repeated punctuation). Units (sentences, paragraphs, headings)
 *   are hashed into a frequency Map in a single pass.
 *
 * N-gram strategy:
 *   Token array built once from full content.
 *   Sliding window of widths 2, 3, 4 produces frequency Maps.
 *   Largest n with any n-gram frequency > 1 = largestRepeatedBlockLength.
 *   Max checked: 20 tokens.
 *
 * Similarity:
 *   Jaccard coefficient on token type sets (not multisets).
 *   Self-similarity = Jaccard(intro, faq).
 *   Pairwise averages for intro/heading/faq groups.
 *
 * Performance:
 *   O(n) passes for unit extraction and frequency counting.
 *   N-gram pass is O(n × MAX_N). Token-set Jaccard is O(min(|A|,|B|)).
 *
 * Thread safety:
 *   All functions are pure. The class holds no mutable state.
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
} from "@/lib/seo-quality-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAD_IN_WORDS       = 3;
const MAX_NGRAM_SIZE      = 20;  // upper bound for largestRepeatedBlockLength

/**
 * Common boilerplate phrases (applied to normalised text as substring matches).
 * Each phrase is already lowercased and whitespace-collapsed.
 */
const BOILERPLATE_PHRASES: readonly string[] = [
  "contact us today",
  "book an appointment",
  "we are dedicated to",
  "high quality services",
  "professional services",
  "satisfaction guaranteed",
  "we pride ourselves",
  "look no further",
  "we offer a wide range",
  "years of experience",
  "best in class",
  "second to none",
  "state of the art",
  "world class",
  "cutting edge",
  "above and beyond",
  "at your convenience",
  "round the clock",
  "available around the clock",
  "discreet and professional",
  "complete discretion",
  "rest assured",
  "dont hesitate to",
  "we invite you to",
  "your needs are our priority",
  "we are committed to",
  "top quality",
  "unmatched quality",
  "unparalleled experience",
  "second to none",
  "best experience",
  "our team of professionals",
  "our experienced team",
];

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Normalise a text unit for exact comparison:
 *   - Lowercase
 *   - Collapse runs of whitespace to a single space
 *   - Collapse runs of the same punctuation character (e.g. "..." → ".")
 *   - Trim
 */
export function normaliseUnit(text: string): string {
  return text
    .toLowerCase()
    .replace(/([.!?,;:–—])\1+/g, "$1")  // "..." → ".", "!!" → "!"
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Tokenisation ─────────────────────────────────────────────────────────────

/** Unicode-safe tokenisation — letters, combining marks, digits. */
export function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

// ─── Sentence splitting ───────────────────────────────────────────────────────

/**
 * Split text into sentences on `.`, `!`, `?` followed by whitespace or end-of-string.
 * Returns normalised, non-empty sentences.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?<=[.!?])$/)
    .map((s) => normaliseUnit(s))
    .filter(Boolean);
}

// ─── Paragraph splitting ──────────────────────────────────────────────────────

/** Split on one or more blank lines. Returns normalised, non-empty paragraphs. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => normaliseUnit(p.replace(/\n/g, " ")))
    .filter(Boolean);
}

// ─── Heading extraction ───────────────────────────────────────────────────────

/** Extract text from HTML heading tags (h2–h6) and markdown-style headings. */
export function extractHeadingsFromContent(text: string): string[] {
  const headings: string[] = [];

  // HTML headings
  const htmlPattern = /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlPattern.exec(text)) !== null) {
    const inner = m[1]!.replace(/<[^>]+>/g, "").trim();
    if (inner) headings.push(normaliseUnit(inner));
  }

  // Markdown-style (## Heading or ### Heading)
  for (const line of text.split("\n")) {
    const mdMatch = line.match(/^#{2,6}\s+(.+)/);
    if (mdMatch) headings.push(normaliseUnit(mdMatch[1]!));
  }

  return headings;
}

// ─── N-gram utilities ─────────────────────────────────────────────────────────

/** Generate all n-grams of width `n` from `tokens`. Returns joined strings. */
export function getNgrams(tokens: string[], n: number): string[] {
  if (n < 1 || n > tokens.length) return [];
  const result: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    result.push(tokens.slice(i, i + n).join(" "));
  }
  return result;
}

/**
 * Count n-grams appearing more than once.
 * Returns the count of distinct n-gram types that are repeated.
 */
export function countRepeatedNgrams(tokens: string[], n: number): number {
  const freq = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const key = tokens.slice(i, i + n).join("\x00");
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  let count = 0;
  for (const f of freq.values()) if (f > 1) count++;
  return count;
}

/**
 * Find the largest n (up to maxN) for which any n-gram in `tokens` appears
 * more than once. Returns 0 if no repeated n-gram of size ≥ 2 exists.
 */
export function largestRepeatedNgramSize(tokens: string[], maxN: number): number {
  for (let n = maxN; n >= 2; n--) {
    if (countRepeatedNgrams(tokens, n) > 0) return n;
  }
  return 0;
}

// ─── Frequency map helpers ────────────────────────────────────────────────────

/** Build a Map<normalised_unit, count> from an array of text units. */
function buildFreqMap(units: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const u of units) freq.set(u, (freq.get(u) ?? 0) + 1);
  return freq;
}

/** Count distinct units with frequency > 1. */
function countDuplicates(freq: Map<string, number>): number {
  let c = 0;
  for (const f of freq.values()) if (f > 1) c++;
  return c;
}

/**
 * Count total occurrences of units that appear more than once.
 * Used for templateReuseRatio numerator.
 */
function countDuplicateOccurrences(freq: Map<string, number>): number {
  let c = 0;
  for (const f of freq.values()) if (f > 1) c += f;
  return c;
}

// ─── Jaccard similarity ───────────────────────────────────────────────────────

/**
 * Jaccard coefficient on token type sets (not multisets).
 * Returns 1 for two empty inputs, 0 if one is empty.
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union > 0 ? round4(intersection / union) : 0;
}

/**
 * Average pairwise Jaccard similarity across a list of token arrays.
 * Returns 0 if fewer than 2 arrays are provided.
 */
export function averagePairwiseJaccard(tokenArrays: string[][]): number {
  const k = tokenArrays.length;
  if (k <= 1) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      total += jaccardSimilarity(tokenArrays[i]!, tokenArrays[j]!);
      pairs++;
    }
  }
  return pairs > 0 ? round4(total / pairs) : 0;
}

// ─── Boilerplate detection ────────────────────────────────────────────────────

/** True if the normalised unit contains any boilerplate phrase. */
export function isBoilerplate(normUnit: string): boolean {
  return BOILERPLATE_PHRASES.some((p) => normUnit.includes(p));
}

// ─── Consecutive-duplicate-run detection ─────────────────────────────────────

type RunStats = { count: number; maxLength: number };

/**
 * Find maximal runs of 2+ identical consecutive tokens.
 * Returns the number of such runs and the length of the longest.
 */
export function findDuplicateRuns(tokens: string[]): RunStats {
  let runCount = 0;
  let maxLength = 0;
  let i = 1;
  while (i < tokens.length) {
    if (tokens[i] === tokens[i - 1]) {
      // Start of a run
      let runLen = 2;
      while (i + 1 < tokens.length && tokens[i + 1] === tokens[i]) {
        runLen++;
        i++;
      }
      runCount++;
      if (runLen > maxLength) maxLength = runLen;
    }
    i++;
  }
  return { count: runCount, maxLength };
}

// ─── Duplicate token ratio ────────────────────────────────────────────────────

/**
 * Fraction of total token occurrences that belong to token types appearing
 * more than once (i.e., repeated token types).
 */
export function computeDuplicateTokenRatio(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  let repeatedOccurrences = 0;
  for (const f of freq.values()) if (f > 1) repeatedOccurrences += f;
  return round4(repeatedOccurrences / tokens.length);
}

// ─── Lead-in duplicate detection ─────────────────────────────────────────────

function getLeadIn(sentence: string, n: number = LEAD_IN_WORDS): string {
  return sentence.split(/\s+/).slice(0, n).join(" ");
}

// ─── Rounding helpers ─────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "duplicateSentenceCount",
  "duplicateParagraphCount",
  "duplicateHeadingCount",
  "duplicateFaqQuestionCount",
  "duplicateFaqAnswerCount",
  "duplicateLeadInCount",
  "duplicateIntroSentenceCount",
  "repeatedPhraseCount",
  "repeatedBigramCount",
  "repeatedTrigramCount",
  "repeatedFourGramCount",
  "maxDuplicateRunLength",
  "uniqueSentenceRatio",
  "uniqueParagraphRatio",
  "uniqueHeadingRatio",
  "uniqueFaqQuestionRatio",
  "uniqueFaqAnswerRatio",
  "templateReuseRatio",
  "boilerplateParagraphCount",
  "boilerplateSentenceCount",
  "selfSimilarityScore",
  "introSectionSimilarity",
  "headingSimilarity",
  "faqSimilarity",
  "duplicateWordRunCount",
  "duplicateTokenRatio",
  "largestRepeatedBlockLength",
];

// ─── Zero result ──────────────────────────────────────────────────────────────

function zeroResult(): Partial<QualityMetrics> {
  return {
    duplicateSentenceCount:      0,
    duplicateParagraphCount:     0,
    duplicateHeadingCount:       0,
    duplicateFaqQuestionCount:   0,
    duplicateFaqAnswerCount:     0,
    duplicateLeadInCount:        0,
    duplicateIntroSentenceCount: 0,
    repeatedPhraseCount:         0,
    repeatedBigramCount:         0,
    repeatedTrigramCount:        0,
    repeatedFourGramCount:       0,
    maxDuplicateRunLength:       0,
    uniqueSentenceRatio:         1,
    uniqueParagraphRatio:        1,
    uniqueHeadingRatio:          1,
    uniqueFaqQuestionRatio:      1,
    uniqueFaqAnswerRatio:        1,
    templateReuseRatio:          0,
    boilerplateParagraphCount:   0,
    boilerplateSentenceCount:    0,
    selfSimilarityScore:         0,
    introSectionSimilarity:      0,
    headingSimilarity:           0,
    faqSimilarity:               0,
    duplicateWordRunCount:       0,
    duplicateTokenRatio:         0,
    largestRepeatedBlockLength:  0,
  };
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class DuplicateContentMetricsProvider implements MetricsProvider {
  readonly id             = "duplicate-content-metrics";
  readonly name           = "Duplicate Content Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 8;
  readonly dependencies: string[] = [];
  readonly estimatedCost: EstimatedCost = "fast";
  readonly cacheStrategy  = CACHE_STRATEGY_NONE;
  readonly outputFields   = OUTPUT_FIELDS;

  provide(
    input: MetricsCollectorInput,
    _priorMetrics: Partial<QualityMetrics>,
  ): Partial<QualityMetrics> {
    return measure(input);
  }
}

/**
 * Pure measurement function — separated from the class for direct testability.
 */
export function measure(input: MetricsCollectorInput): Partial<QualityMetrics> {
  const { introContent, faqItems, h1, headings: suppliedHeadings } = input;

  const intro = introContent ?? "";

  // ── Unit extraction ─────────────────────────────────────────────────────────

  // Sentences: intro + all FAQ text
  const introSentences   = splitSentences(intro);
  const introParagraphs  = splitParagraphs(intro);

  const faqQuestionTexts = faqItems.map((f) => normaliseUnit(f.question));
  const faqAnswerTexts   = faqItems.map((f) => normaliseUnit(f.answer));

  // All sentences across the document
  const faqSentences: string[] = [];
  for (const f of faqItems) {
    faqSentences.push(...splitSentences(`${f.question} ${f.answer}`));
  }
  const allSentences = [...introSentences, ...faqSentences];

  // Headings: caller-supplied → extract from intro as fallback, always add H1
  const extractedHeadings = extractHeadingsFromContent(intro);
  const h1Norm            = h1 ? normaliseUnit(h1) : null;
  const allHeadings: string[] = [
    ...(suppliedHeadings?.map(normaliseUnit) ?? extractedHeadings),
    ...(h1Norm ? [h1Norm] : []),
  ].filter(Boolean);

  // ── Frequency maps (single-pass per unit type) ────────────────────────────

  const sentenceFreq  = buildFreqMap(allSentences);
  const paraFreq      = buildFreqMap(introParagraphs);
  const headingFreq   = buildFreqMap(allHeadings);
  const faqQFreq      = buildFreqMap(faqQuestionTexts.filter(Boolean));
  const faqAFreq      = buildFreqMap(faqAnswerTexts.filter(Boolean));
  const introSentFreq = buildFreqMap(introSentences);

  // ── Duplicate counts ──────────────────────────────────────────────────────

  const dupSentenceCount      = countDuplicates(sentenceFreq);
  const dupParagraphCount     = countDuplicates(paraFreq);
  const dupHeadingCount       = countDuplicates(headingFreq);
  const dupFaqQuestionCount   = countDuplicates(faqQFreq);
  const dupFaqAnswerCount     = countDuplicates(faqAFreq);
  const dupIntroSentenceCount = countDuplicates(introSentFreq);

  // ── Lead-in duplicates (across all sentences) ────────────────────────────
  const leadInFreq = new Map<string, number>();
  for (const s of allSentences) {
    if (!s) continue;
    const li = getLeadIn(s);
    if (li) leadInFreq.set(li, (leadInFreq.get(li) ?? 0) + 1);
  }
  const dupLeadInCount = countDuplicates(leadInFreq);

  // ── Unique ratios ────────────────────────────────────────────────────────

  const uniqueSentenceRatio    = allSentences.length > 0
    ? round4((allSentences.length - countDuplicateOccurrences(sentenceFreq) + countDuplicates(sentenceFreq)) / allSentences.length)
    : 1;
  const uniqueParagraphRatio   = introParagraphs.length > 0
    ? round4((introParagraphs.length - countDuplicateOccurrences(paraFreq) + countDuplicates(paraFreq)) / introParagraphs.length)
    : 1;
  const uniqueHeadingRatio     = allHeadings.length > 0
    ? round4((allHeadings.length - countDuplicateOccurrences(headingFreq) + countDuplicates(headingFreq)) / allHeadings.length)
    : 1;

  const faqQAll = faqQuestionTexts.filter(Boolean);
  const faqAAll = faqAnswerTexts.filter(Boolean);
  const uniqueFaqQuestionRatio = faqQAll.length > 0
    ? round4((faqQAll.length - countDuplicateOccurrences(faqQFreq) + countDuplicates(faqQFreq)) / faqQAll.length)
    : 1;
  const uniqueFaqAnswerRatio   = faqAAll.length > 0
    ? round4((faqAAll.length - countDuplicateOccurrences(faqAFreq) + countDuplicates(faqAFreq)) / faqAAll.length)
    : 1;

  // ── Template reuse ratio ─────────────────────────────────────────────────
  // = (total sentence occurrences that are duplicates) / total sentence count
  const dupOccurrences     = countDuplicateOccurrences(sentenceFreq);
  const templateReuseRatio = allSentences.length > 0
    ? round4(dupOccurrences / allSentences.length)
    : 0;

  // ── Boilerplate detection ────────────────────────────────────────────────
  let boilerplateSentenceCount  = 0;
  for (const s of sentenceFreq.keys()) {
    if (isBoilerplate(s)) boilerplateSentenceCount++;
  }

  let boilerplateParagraphCount = 0;
  for (const p of paraFreq.keys()) {
    if (isBoilerplate(p)) boilerplateParagraphCount++;
  }

  // ── Full-content token array ─────────────────────────────────────────────
  const faqFullText  = faqItems.map((f) => `${f.question} ${f.answer}`).join(" ");
  const fullText     = [intro, faqFullText, h1 ?? ""].filter(Boolean).join(" ");
  const allTokens    = tokenise(fullText);

  // ── N-gram repeated counts ───────────────────────────────────────────────
  const repeatedBigramCount  = countRepeatedNgrams(allTokens, 2);
  const repeatedTrigramCount = countRepeatedNgrams(allTokens, 3);
  const repeatedFourGramCount= countRepeatedNgrams(allTokens, 4);
  const repeatedPhraseCount  = repeatedBigramCount + repeatedTrigramCount + repeatedFourGramCount;

  // ── Largest repeated block ───────────────────────────────────────────────
  const largestRepeatedBlockLength = largestRepeatedNgramSize(allTokens, MAX_NGRAM_SIZE);

  // ── Consecutive-duplicate-run stats ─────────────────────────────────────
  const { count: duplicateWordRunCount, maxLength: maxDuplicateRunLength } =
    findDuplicateRuns(allTokens);

  // ── Duplicate token ratio ────────────────────────────────────────────────
  const duplicateTokenRatio = computeDuplicateTokenRatio(allTokens);

  // ── Similarity scores ────────────────────────────────────────────────────
  const introTokens  = tokenise(intro);
  const faqTokens    = tokenise(faqFullText);
  const selfSimilarityScore = jaccardSimilarity(introTokens, faqTokens);

  // introSectionSimilarity: average pairwise Jaccard between intro paragraphs
  const introParaTokens = introParagraphs.map(tokenise);
  const introSectionSimilarity = averagePairwiseJaccard(introParaTokens);

  // headingSimilarity: average pairwise Jaccard between heading token sets
  const headingTokens = allHeadings.map(tokenise);
  const headingSimilarity = averagePairwiseJaccard(headingTokens);

  // faqSimilarity: average pairwise Jaccard between FAQ answer token sets
  const faqAnswerTokens = faqAnswerTexts
    .filter(Boolean)
    .map(tokenise);
  const faqSimilarity = averagePairwiseJaccard(faqAnswerTokens);

  return {
    duplicateSentenceCount:      dupSentenceCount,
    duplicateParagraphCount:     dupParagraphCount,
    duplicateHeadingCount:       dupHeadingCount,
    duplicateFaqQuestionCount:   dupFaqQuestionCount,
    duplicateFaqAnswerCount:     dupFaqAnswerCount,
    duplicateLeadInCount:        dupLeadInCount,
    duplicateIntroSentenceCount: dupIntroSentenceCount,
    repeatedPhraseCount,
    repeatedBigramCount,
    repeatedTrigramCount,
    repeatedFourGramCount,
    maxDuplicateRunLength,
    uniqueSentenceRatio,
    uniqueParagraphRatio,
    uniqueHeadingRatio,
    uniqueFaqQuestionRatio,
    uniqueFaqAnswerRatio,
    templateReuseRatio,
    boilerplateParagraphCount,
    boilerplateSentenceCount,
    selfSimilarityScore,
    introSectionSimilarity,
    headingSimilarity,
    faqSimilarity,
    duplicateWordRunCount,
    duplicateTokenRatio,
    largestRepeatedBlockLength,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const duplicateContentMetricsProvider = new DuplicateContentMetricsProvider();

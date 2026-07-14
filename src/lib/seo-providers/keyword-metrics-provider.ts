/**
 * KeywordMetricsProvider
 *
 * Purpose:
 *   Measures objective keyword-usage metrics for a page.
 *   Measurement only — no scoring, no thresholds, no quality judgments.
 *
 * Owned QualityMetrics fields:
 *   primaryKeywordPresent, primaryKeywordOccurrences, primaryKeywordDensity,
 *   primaryKeywordFirstPosition, primaryKeywordLastPosition,
 *   primaryKeywordInTitle, primaryKeywordInH1, primaryKeywordInMeta,
 *   primaryKeywordInIntro, primaryKeywordInFaq,
 *   primaryKeywordInInternalLinks, primaryKeywordInSlug, primaryKeywordInCanonical,
 *   secondaryKeywordHits, secondaryKeywordCount, secondaryKeywordCoverage,
 *   secondaryKeywordOccurrences, secondaryKeywordDensity,
 *   semanticVariantCount, semanticVariantCoverage,
 *   exactMatchCount, partialMatchCount,
 *   keywordDistributionScore, keywordSpread,
 *   sectionCoverage, headingCoverage, faqCoverage, introCoverage
 *
 * Execution order: 4 (wave 1 — no provider dependencies)
 *
 * Tokenization strategy:
 *   The full text is tokenized once into lowercase word tokens using
 *   Unicode-aware splitting on \p{L}\p{N} codepoints. A position index
 *   (token → [word positions]) is built in a single O(n) pass and shared
 *   across all keyword lookups.
 *
 * Matching strategy:
 *   Whole-word phrase matching via the token index (false-positive-safe):
 *   each "word" is an isolated Unicode letter/digit run, so "escort" can
 *   never match "escorted" because they tokenize to different entries.
 *   Substring (partial) matching uses a secondary lowercased-text scan
 *   to count appearances inside larger words.
 *
 * Thread safety:
 *   All functions are pure. The class holds no mutable state.
 *
 * Extension points:
 *   - Add new output fields to QualityMetrics and compute them in measure().
 *   - DISTRIBUTION_SECTIONS controls how many equal sections are used for
 *     keywordDistributionScore.
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
  FaqItem,
  InternalLink,
} from "@/lib/seo-quality-types";
import { stripToVisibleText } from "@/lib/seo-quality";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of equal-length sections for distribution scoring. */
const DISTRIBUTION_SECTIONS = 5;

// ─── Token index ──────────────────────────────────────────────────────────────

/**
 * Tokenized representation of a text corpus.
 * Built once; queried many times.
 */
interface TokenIndex {
  /** Lowercased word tokens in document order. */
  tokens: string[];
  /** Token → sorted list of word positions (0-based). */
  positions: Map<string, number[]>;
}

/**
 * Build a token index from visible text in a single O(n) pass.
 * Uses Unicode-aware tokenization: \p{L} (letters) and \p{N} (digits).
 * Each match is an isolated "word" — no substring ambiguity.
 */
export function buildTokenIndex(text: string): TokenIndex {
  // \p{M} includes combining marks (vowel matras, diacritics) — needed for
// Devanagari (Hindi), Arabic, Thai, and other scripts where letters and
// their diacritics are separate codepoints.
const rawTokens = text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  const positions = new Map<string, number[]>();

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i]!;
    let list = positions.get(token);
    if (!list) { list = []; positions.set(token, list); }
    list.push(i);
  }

  return { tokens: rawTokens, positions };
}

/**
 * Tokenize a keyword phrase into its component word tokens.
 */
export function tokenizePhrase(phrase: string): string[] {
  return phrase.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

// ─── Phrase matching ──────────────────────────────────────────────────────────

/**
 * Count whole-word exact-phrase occurrences of `phrase` in `index`.
 *
 * Algorithm:
 *   1. Tokenize the phrase into phrase-tokens.
 *   2. Look up positions of the first phrase-token.
 *   3. For each candidate start position, verify all subsequent tokens match.
 *
 * Guarantees:
 *   - "escort" never matches "escorted" (different tokens).
 *   - "Delhi Escorts" matches "delhi escorts" (lowercased).
 *   - Unicode keywords tokenize correctly via \p{L}\p{N}.
 *   - Overlapping keyword phrases are counted independently.
 *
 * Complexity: O(positions(firstToken) * phraseLength) — effectively O(n / vocabSize)
 */
export function countPhraseMatches(index: TokenIndex, phrase: string): number {
  const phraseTokens = tokenizePhrase(phrase);
  if (phraseTokens.length === 0) return 0;

  const firstPositions = index.positions.get(phraseTokens[0]!) ?? [];
  if (phraseTokens.length === 1) return firstPositions.length;

  let count = 0;
  for (const startPos of firstPositions) {
    let matches = true;
    for (let j = 1; j < phraseTokens.length; j++) {
      if (index.tokens[startPos + j] !== phraseTokens[j]) {
        matches = false;
        break;
      }
    }
    if (matches) count++;
  }
  return count;
}

/**
 * Return the word positions of all whole-word matches of `phrase` in `index`.
 * Position reported is the index of the first token of the phrase.
 */
export function findPhrasePositions(index: TokenIndex, phrase: string): number[] {
  const phraseTokens = tokenizePhrase(phrase);
  if (phraseTokens.length === 0) return [];

  const firstPositions = index.positions.get(phraseTokens[0]!) ?? [];
  if (phraseTokens.length === 1) return [...firstPositions];

  const result: number[] = [];
  for (const startPos of firstPositions) {
    let matches = true;
    for (let j = 1; j < phraseTokens.length; j++) {
      if (index.tokens[startPos + j] !== phraseTokens[j]) {
        matches = false;
        break;
      }
    }
    if (matches) result.push(startPos);
  }
  return result;
}

/**
 * Count how many times `phrase` appears as a substring (no word boundary).
 * Used to measure partial matches (keyword inside a larger word).
 */
export function countSubstringMatches(text: string, phrase: string): number {
  if (!phrase) return 0;
  const lowerText   = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  let count = 0;
  let pos   = 0;
  while ((pos = lowerText.indexOf(lowerPhrase, pos)) !== -1) {
    count++;
    pos += lowerPhrase.length; // non-overlapping
  }
  return count;
}

// ─── Heading & section extraction ────────────────────────────────────────────

/**
 * Extract heading text (H2 and H3) from raw HTML/markdown content.
 */
function extractHeadings(raw: string): string[] {
  const headings: string[] = [];
  // HTML headings
  const htmlPattern = /<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlPattern.exec(raw)) !== null) {
    const text = stripToVisibleText(m[1] ?? "").trim();
    if (text) headings.push(text);
  }
  // Markdown headings
  const mdPattern = /^#{2,3}\s+(.+)$/gm;
  while ((m = mdPattern.exec(raw)) !== null) {
    const text = (m[1] ?? "").trim();
    if (text) headings.push(text);
  }
  return headings;
}

/**
 * Split raw intro content into paragraph-sized chunks.
 * Uses the same split strategy as ContentMetricsProvider.
 */
function splitParagraphs(raw: string): string[] {
  return raw
    .split(/(?:<\/p>|<br\s*\/?\s*>\s*<br\s*\/?\s*>|\n{2,})/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split intro content into heading-delimited sections.
 * Each section is the text between two consecutive headings (or start/end).
 */
function splitSections(raw: string): string[] {
  // Split on HTML h2/h3 or markdown ## / ###
  const sectionParts = raw.split(/<h[2-3][\s>]|^#{2,3}\s/gmi);
  return sectionParts
    .map((s) => stripToVisibleText(s).trim())
    .filter((s) => s.length > 0);
}

// ─── Distribution metrics ──────────────────────────────────────────────────

/**
 * Fraction of equal-length document sections (by word count) that contain
 * at least one whole-word occurrence of the keyword.
 */
function keywordDistributionScore(
  totalWords: number,
  positions: number[],
): number {
  if (totalWords === 0 || positions.length === 0) return 0;
  const sectionSize = Math.ceil(totalWords / DISTRIBUTION_SECTIONS);
  const sectionsHit = new Set<number>();
  for (const pos of positions) {
    sectionsHit.add(Math.floor(pos / sectionSize));
  }
  return round4(sectionsHit.size / DISTRIBUTION_SECTIONS);
}

/**
 * Fraction of the document spanned between first and last keyword occurrence.
 * 0 if keyword appears zero or one times.
 */
function keywordSpread(
  totalWords: number,
  firstPos: number,
  lastPos: number,
): number {
  if (totalWords <= 1 || firstPos < 0 || lastPos < 0 || firstPos === lastPos) return 0;
  return round4((lastPos - firstPos) / Math.max(totalWords - 1, 1));
}

// ─── Rounding helpers ─────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Slug / URL keyword detection ─────────────────────────────────────────────

/**
 * Check whether a keyword appears in a slug or URL.
 * Normalises dashes/underscores to spaces before comparing.
 */
function containsKeywordInSlugOrUrl(
  slugOrUrl: string | null | undefined,
  phraseTokens: string[],
): boolean {
  if (!slugOrUrl || phraseTokens.length === 0) return false;
  // Normalise separators to space, then tokenize
  const normalised = slugOrUrl.replace(/[-_/]/g, " ").toLowerCase();
  const index = buildTokenIndex(normalised);
  return countPhraseMatches(index, phraseTokens.join(" ")) > 0;
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "primaryKeywordPresent",
  "primaryKeywordOccurrences",
  "primaryKeywordDensity",
  "primaryKeywordFirstPosition",
  "primaryKeywordLastPosition",
  "primaryKeywordInTitle",
  "primaryKeywordInH1",
  "primaryKeywordInMeta",
  "primaryKeywordInIntro",
  "primaryKeywordInFaq",
  "primaryKeywordInInternalLinks",
  "primaryKeywordInSlug",
  "primaryKeywordInCanonical",
  "secondaryKeywordHits",
  "secondaryKeywordCount",
  "secondaryKeywordCoverage",
  "secondaryKeywordOccurrences",
  "secondaryKeywordDensity",
  "semanticVariantCount",
  "semanticVariantCoverage",
  "exactMatchCount",
  "partialMatchCount",
  "keywordDistributionScore",
  "keywordSpread",
  "sectionCoverage",
  "headingCoverage",
  "faqCoverage",
  "introCoverage",
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class KeywordMetricsProvider implements MetricsProvider {
  readonly id             = "keyword-metrics";
  readonly name           = "Keyword Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 4;
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
  const {
    primaryKeyword,
    secondaryKeywords,
    semanticVariants,
    introContent,
    faqItems,
    title,
    metaDescription,
    h1,
    canonicalUrl,
    internalLinks,
    pageContext,
  } = input;

  // ── Step 1: build combined visible text (intro + FAQ) ─────────────────────
  const visibleIntro = stripToVisibleText(introContent);
  const faqText = faqItems
    .map((f: FaqItem) => `${f.question} ${f.answer}`)
    .join(" ");
  const visibleFaq  = stripToVisibleText(faqText);
  const fullText    = visibleFaq
    ? `${visibleIntro}\n\n${visibleFaq}`.trim()
    : visibleIntro;

  // ── Step 2: build token index over full text (single pass) ────────────────
  const index     = buildTokenIndex(fullText);
  const totalWords = index.tokens.length;

  // ── Step 3: primary keyword metrics ──────────────────────────────────────
  const pk = primaryKeyword?.trim() ?? null;

  // Whole-word exact phrase positions and count
  const pkPositions   = pk ? findPhrasePositions(index, pk) : [];
  const exactCount    = pkPositions.length;
  const pkFirstPos    = exactCount > 0 ? pkPositions[0]!     : -1;
  const pkLastPos     = exactCount > 0 ? pkPositions[pkPositions.length - 1]! : -1;

  // Substring (partial) match count — only meaningful when exactCount > 0
  const substringCount = pk ? countSubstringMatches(fullText, pk) : 0;
  const partialCount   = Math.max(0, substringCount - exactCount);

  // Density
  const pkDensity = totalWords > 0 && exactCount > 0
    ? round2((exactCount / totalWords) * 100)
    : 0;

  // ── Step 4: field presence flags ──────────────────────────────────────────
  const pkTokens = pk ? tokenizePhrase(pk) : [];

  function fieldContainsKeyword(field: string | null | undefined): boolean {
    if (!pk || !field) return false;
    const fieldIndex = buildTokenIndex(stripToVisibleText(field));
    return countPhraseMatches(fieldIndex, pk) > 0;
  }

  const pkInTitle    = fieldContainsKeyword(title);
  const pkInH1       = fieldContainsKeyword(h1);
  const pkInMeta     = fieldContainsKeyword(metaDescription);

  // Intro-only index (built separately to keep field checks accurate)
  const introIndex   = buildTokenIndex(visibleIntro);
  const pkInIntro    = pk ? countPhraseMatches(introIndex, pk) > 0 : false;

  // FAQ check: does ANY FAQ item (question or answer) contain the keyword?
  const pkInFaq = pk
    ? faqItems.some((f: FaqItem) => {
        const faqItemIndex = buildTokenIndex(
          stripToVisibleText(`${f.question} ${f.answer}`),
        );
        return countPhraseMatches(faqItemIndex, pk) > 0;
      })
    : false;

  // Internal links — keyword in any anchor text
  const pkInInternalLinks = pk
    ? internalLinks.some((link: InternalLink) => {
        const anchorIndex = buildTokenIndex(link.anchor.toLowerCase());
        return countPhraseMatches(anchorIndex, pk) > 0;
      })
    : false;

  // Slug and canonical URL
  const pkInSlug      = containsKeywordInSlugOrUrl(pageContext.pageSlug, pkTokens);
  const pkInCanonical = containsKeywordInSlugOrUrl(canonicalUrl, pkTokens);

  // ── Step 5: secondary keyword metrics ────────────────────────────────────
  const secondaryList = secondaryKeywords ?? [];
  let secHits        = 0;
  let secOccurrences = 0;

  for (const sk of secondaryList) {
    const occ = countPhraseMatches(index, sk);
    if (occ > 0) secHits++;
    secOccurrences += occ;
  }

  const secCount    = secondaryList.length;
  const secCoverage = secCount > 0 ? round4(secHits / secCount) : 0;
  const secDensity  = totalWords > 0 && secOccurrences > 0
    ? round2((secOccurrences / totalWords) * 100)
    : 0;

  // ── Step 6: semantic variant metrics ─────────────────────────────────────
  const variantList = semanticVariants ?? [];
  let varHits       = 0;

  for (const variant of variantList) {
    if (countPhraseMatches(index, variant) > 0) varHits++;
  }

  const varCount    = variantList.length;
  const varCoverage = varCount > 0 ? round4(varHits / varCount) : 0;

  // ── Step 7: distribution and spread ──────────────────────────────────────
  const distScore = keywordDistributionScore(totalWords, pkPositions);
  const spread    = keywordSpread(totalWords, pkFirstPos, pkLastPos);

  // ── Step 8: section-level coverage ───────────────────────────────────────
  // Headings
  const headings = extractHeadings(introContent);
  const headingsWithKeyword = pk
    ? headings.filter((h) => countPhraseMatches(buildTokenIndex(h.toLowerCase()), pk) > 0)
    : [];
  const hCoverage = headings.length > 0
    ? round4(headingsWithKeyword.length / headings.length)
    : 0;

  // Heading-delimited sections
  const sections = splitSections(introContent);
  const sectionsWithKeyword = pk
    ? sections.filter((s) => countPhraseMatches(buildTokenIndex(s.toLowerCase()), pk) > 0)
    : [];
  const sCoverage = sections.length > 0
    ? round4(sectionsWithKeyword.length / sections.length)
    : 0;

  // Intro paragraphs
  const introParagraphs = splitParagraphs(introContent);
  const parasWithKeyword = pk
    ? introParagraphs.filter((p) => {
        const vis = stripToVisibleText(p);
        return countPhraseMatches(buildTokenIndex(vis.toLowerCase()), pk) > 0;
      })
    : [];
  const iCoverage = introParagraphs.length > 0
    ? round4(parasWithKeyword.length / introParagraphs.length)
    : 0;

  // FAQ items
  const faqWithKeyword = pk
    ? faqItems.filter((f: FaqItem) => {
        const combined = buildTokenIndex(
          stripToVisibleText(`${f.question} ${f.answer}`).toLowerCase(),
        );
        return countPhraseMatches(combined, pk) > 0;
      })
    : [];
  const fCoverage = faqItems.length > 0
    ? round4(faqWithKeyword.length / faqItems.length)
    : 0;

  return {
    primaryKeywordPresent:        exactCount > 0,
    primaryKeywordOccurrences:    exactCount,
    primaryKeywordDensity:        pkDensity,
    primaryKeywordFirstPosition:  pkFirstPos,
    primaryKeywordLastPosition:   pkLastPos,
    primaryKeywordInTitle:        pkInTitle,
    primaryKeywordInH1:           pkInH1,
    primaryKeywordInMeta:         pkInMeta,
    primaryKeywordInIntro:        pkInIntro,
    primaryKeywordInFaq:          pkInFaq,
    primaryKeywordInInternalLinks: pkInInternalLinks,
    primaryKeywordInSlug:         pkInSlug,
    primaryKeywordInCanonical:    pkInCanonical,
    secondaryKeywordHits:         secHits,
    secondaryKeywordCount:        secCount,
    secondaryKeywordCoverage:     secCoverage,
    secondaryKeywordOccurrences:  secOccurrences,
    secondaryKeywordDensity:      secDensity,
    semanticVariantCount:         varCount,
    semanticVariantCoverage:      varCoverage,
    exactMatchCount:              exactCount,
    partialMatchCount:            partialCount,
    keywordDistributionScore:     distScore,
    keywordSpread:                spread,
    sectionCoverage:              sCoverage,
    headingCoverage:              hCoverage,
    faqCoverage:                  fCoverage,
    introCoverage:                iCoverage,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const keywordMetricsProvider = new KeywordMetricsProvider();

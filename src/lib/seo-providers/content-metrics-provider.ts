/**
 * ContentMetricsProvider
 *
 * Purpose:
 *   Measures structural and quantitative facts about page content.
 *   This provider performs objective measurement only — no scoring,
 *   no weights, no thresholds, no quality decisions.
 *
 * Responsibilities:
 *   - Count words in intro content and FAQ combined
 *   - Measure paragraph and sentence statistics
 *   - Count structural HTML/markdown elements (headings, lists, tables, images)
 *   - Compute density ratios (heading density, content density)
 *
 * Owned QualityMetrics fields:
 *   wordCount, wordCountIntro, characterCount,
 *   paragraphCount, avgParagraphWords,
 *   sentenceCount, avgSentenceWords, sentenceLengthVariance, longSentenceRatio,
 *   headingCount, h2Count, h3Count,
 *   listCount, tableCount, imageCount, externalLinksCount,
 *   headingDensity, contentDensity
 *
 * Execution order: 1 (wave 1 — no dependencies)
 *
 * Extension points:
 *   - Add new output fields to QualityMetrics and compute them in measure()
 *   - No changes to the engine or other providers required
 *
 * Thread safety:
 *   All methods are pure functions; the class holds no mutable state.
 *
 * Usage notes:
 *   Input content may be HTML, markdown, or a mix of both — the provider
 *   handles both formats without external parsing libraries.
 *   Reuses stripToVisibleText / calculateVisibleWordCount from seo-quality.ts.
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
} from "@/lib/seo-quality-types";
import {
  stripToVisibleText,
  calculateVisibleWordCount,
} from "@/lib/seo-quality";

// ─── Internal result shapes ─────────────────────────────────────────────────

interface StructuralCounts {
  h2Count: number;
  h3Count: number;
  headingCount: number;
  listCount: number;
  tableCount: number;
  imageCount: number;
  externalLinksCount: number;
}

interface SentenceStats {
  count: number;
  avgWords: number;
  variance: number;
  longRatio: number;
}

interface ParagraphStats {
  count: number;
  avgWords: number;
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

/**
 * Count structural HTML and markdown elements in raw content.
 * One logical pass per element type using non-overlapping regexes.
 */
function countStructuralElements(raw: string): StructuralCounts {
  // Headings — HTML and markdown variants
  const htmlH2   = (raw.match(/<h2[\s>][^]*?<\/h2>/gi) ?? []).length;
  const markdownH2 = (raw.match(/^#{2}(?!#)\s+\S/gm) ?? []).length;
  const h2Count  = htmlH2 + markdownH2;

  const htmlH3   = (raw.match(/<h3[\s>][^]*?<\/h3>/gi) ?? []).length;
  const markdownH3 = (raw.match(/^#{3}(?!#)\s+\S/gm) ?? []).length;
  const h3Count  = htmlH3 + markdownH3;

  // Heading count = H2 + H3 + any other heading tags (H4–H6)
  const otherHeadings = (raw.match(/<h[4-6][\s>]/gi) ?? []).length
    + (raw.match(/^#{4,6}\s+\S/gm) ?? []).length;
  const headingCount = h2Count + h3Count + otherHeadings;

  // Lists — count list blocks, not individual items
  const htmlLists     = (raw.match(/<(?:ul|ol)[\s>]/gi) ?? []).length;
  const markdownLists = countMarkdownListBlocks(raw);
  const listCount     = htmlLists + markdownLists;

  // Tables
  const htmlTables     = (raw.match(/<table[\s>]/gi) ?? []).length;
  const markdownTables = countMarkdownTableBlocks(raw);
  const tableCount     = htmlTables + markdownTables;

  // Images — <img …> and ![alt](url)
  const htmlImages     = (raw.match(/<img[\s>]/gi) ?? []).length;
  const markdownImages = (raw.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length;
  const imageCount     = htmlImages + markdownImages;

  // External links — href="http..." and [text](http...)
  const htmlExternal     = (raw.match(/<a\s[^>]*href=["']https?:\/\//gi) ?? []).length;
  const markdownExternal = (raw.match(/(?<!!)\[[^\]]*\]\(https?:\/\//g) ?? []).length;
  const externalLinksCount = htmlExternal + markdownExternal;

  return { h2Count, h3Count, headingCount, listCount, tableCount, imageCount, externalLinksCount };
}

/**
 * Count distinct markdown list blocks.
 * A block is a contiguous group of lines starting with `-`, `*`, `+`, or `N.`.
 */
function countMarkdownListBlocks(raw: string): number {
  const lines = raw.split("\n");
  let inList = false;
  let blocks = 0;
  for (const line of lines) {
    const isListLine = /^\s*(?:[-*+]|\d+\.)\s/.test(line);
    if (isListLine && !inList) {
      blocks++;
      inList = true;
    } else if (!isListLine) {
      inList = false;
    }
  }
  return blocks;
}

/**
 * Count distinct markdown table blocks.
 * A table is a contiguous group of lines starting and ending with `|`.
 */
function countMarkdownTableBlocks(raw: string): number {
  const lines = raw.split("\n");
  let inTable = false;
  let blocks = 0;
  for (const line of lines) {
    const isTableLine = /^\s*\|/.test(line.trim());
    if (isTableLine && !inTable) {
      blocks++;
      inTable = true;
    } else if (!isTableLine) {
      inTable = false;
    }
  }
  return blocks;
}

/**
 * Split visible text into individual sentences.
 * Uses a practical heuristic: sentence terminators (.!?) followed by
 * whitespace. Short fragments (< 3 words) are discarded as non-sentences.
 */
function splitSentences(visibleText: string): string[] {
  if (!visibleText.trim()) return [];
  // Match text sequences ending with one or more sentence terminators
  const raw = visibleText.match(/[^.!?]*[.!?]+/g) ?? [];
  return raw
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);
}

/**
 * Split raw content (HTML or markdown) into paragraph-sized chunks.
 * Splits on: </p> tag boundaries, <br><br> sequences, and double newlines.
 * Each chunk is returned as raw text for individual visible-text extraction.
 */
function splitRawParagraphs(raw: string): string[] {
  return raw
    .split(/(?:<\/p>|<br\s*\/?\s*>\s*<br\s*\/?\s*>|\n{2,})/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Compute sentence statistics from an array of sentence strings.
 */
function computeSentenceStats(sentences: string[]): SentenceStats {
  if (sentences.length === 0) {
    return { count: 0, avgWords: 0, variance: 0, longRatio: 0 };
  }

  const wordCounts = sentences.map(
    (s) => s.split(/\s+/).filter(Boolean).length,
  );

  const total   = wordCounts.reduce((a, b) => a + b, 0);
  const avg     = total / wordCounts.length;
  const longCount = wordCounts.filter((n) => n > 35).length;

  // Population variance of sentence word counts
  const squaredDiffs = wordCounts.map((n) => (n - avg) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / wordCounts.length;

  return {
    count: sentences.length,
    avgWords: round2(avg),
    variance: round2(variance),
    longRatio: round4(longCount / sentences.length),
  };
}

/**
 * Compute paragraph statistics from an array of per-paragraph word counts.
 */
function computeParagraphStats(wordCounts: number[]): ParagraphStats {
  if (wordCounts.length === 0) {
    return { count: 0, avgWords: 0 };
  }
  const total = wordCounts.reduce((a, b) => a + b, 0);
  return {
    count: wordCounts.length,
    avgWords: round2(total / wordCounts.length),
  };
}

// ─── Rounding helpers ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Provider implementation ────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "wordCount",
  "wordCountIntro",
  "characterCount",
  "paragraphCount",
  "avgParagraphWords",
  "sentenceCount",
  "avgSentenceWords",
  "sentenceLengthVariance",
  "longSentenceRatio",
  "headingCount",
  "h2Count",
  "h3Count",
  "listCount",
  "tableCount",
  "imageCount",
  "externalLinksCount",
  "headingDensity",
  "contentDensity",
];

export class ContentMetricsProvider implements MetricsProvider {
  readonly id             = "content-metrics";
  readonly name           = "Content Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 1;
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
  const { introContent, faqItems } = input;

  // ── Step 1: structural element counts (raw content pass) ────────────────
  const structural = countStructuralElements(introContent);

  // ── Step 2: strip to visible text ───────────────────────────────────────
  const visibleIntro = stripToVisibleText(introContent);
  const faqText      = faqItems.map((f) => `${f.question} ${f.answer}`).join(" ");
  const visibleFaq   = stripToVisibleText(faqText);
  const visibleAll   = visibleFaq
    ? `${visibleIntro}\n\n${visibleFaq}`.trim()
    : visibleIntro;

  // ── Step 3: word counts ─────────────────────────────────────────────────
  const wordCountIntro = calculateVisibleWordCount(visibleIntro);
  const wordCount      = wordCountIntro + calculateVisibleWordCount(visibleFaq);
  const characterCount = visibleIntro.length; // intro visible chars only

  // ── Step 4: sentence statistics (on intro visible text only) ────────────
  const sentences   = splitSentences(visibleIntro);
  const sentStats   = computeSentenceStats(sentences);

  // ── Step 5: paragraph statistics — split raw intro, strip each chunk ───
  const rawParagraphs = splitRawParagraphs(introContent);
  const paraWordCounts = rawParagraphs
    .map((p) => calculateVisibleWordCount(stripToVisibleText(p)))
    .filter((n) => n > 0);
  const paraStats = computeParagraphStats(paraWordCounts);

  // ── Step 6: density ratios ───────────────────────────────────────────────
  const headingDensity =
    wordCountIntro > 0
      ? round2((structural.headingCount / wordCountIntro) * 100)
      : 0;

  // contentDensity: ratio of visible chars to raw intro chars
  const rawLength      = introContent.length;
  const contentDensity =
    rawLength > 0 ? round4(characterCount / rawLength) : 1;

  return {
    wordCount,
    wordCountIntro,
    characterCount,
    paragraphCount:        paraStats.count,
    avgParagraphWords:     paraStats.avgWords,
    sentenceCount:         sentStats.count,
    avgSentenceWords:      sentStats.avgWords,
    sentenceLengthVariance: sentStats.variance,
    longSentenceRatio:     sentStats.longRatio,
    h2Count:               structural.h2Count,
    h3Count:               structural.h3Count,
    headingCount:          structural.headingCount,
    listCount:             structural.listCount,
    tableCount:            structural.tableCount,
    imageCount:            structural.imageCount,
    externalLinksCount:    structural.externalLinksCount,
    headingDensity,
    contentDensity,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const contentMetricsProvider = new ContentMetricsProvider();

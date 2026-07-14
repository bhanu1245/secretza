/**
 * ReadabilityMetricsProvider
 *
 * Purpose:
 *   Measures objective readability characteristics of page content.
 *   This provider performs measurement only — no scoring, no thresholds,
 *   no quality decisions, no recommendations.
 *
 * Owned QualityMetrics fields:
 *   readabilityScore, typeTokenRatio,
 *   longSentenceCount, shortSentenceCount, shortSentenceRatio,
 *   punctuationDensity, questionSentenceCount, exclamationSentenceCount,
 *   complexWordCount, complexWordRatio,
 *   estimatedReadingTimeMinutes, estimatedSpeakingTimeMinutes,
 *   paragraphFlow,
 *   transitionWordCount, transitionDensity, transitionCoverage
 *
 * Execution order: 2 (wave 1 — depends on visible text; no provider deps)
 *
 * Parsing strategy:
 *   Single logical pass per text unit. Visible text is extracted once,
 *   then sentences are iterated once to accumulate all per-sentence stats.
 *   No repeated regex scans. Time complexity O(n) in content length.
 *
 * Thread safety:
 *   All methods are pure functions; the class holds no mutable state.
 *
 * Extension points:
 *   - Pass a custom TRANSITION_WORDS set to the constructor to override
 *     the default dictionary without changing any other code.
 *   - Add fields to QualityMetrics and compute them in measure().
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

// ─── Transition word dictionary ──────────────────────────────────────────────

/**
 * Default single-word transition markers.
 * Kept as a Set<string> for O(1) lookup per token.
 */
export const DEFAULT_TRANSITION_WORDS: ReadonlySet<string> = new Set([
  // contrast
  "however", "although", "nevertheless", "nonetheless", "yet", "still",
  "instead", "whereas", "while", "despite",
  // addition
  "furthermore", "moreover", "additionally", "also", "besides",
  "likewise", "similarly",
  // causation / result
  "therefore", "thus", "hence", "consequently", "accordingly", "because",
  // sequence / time
  "first", "second", "third", "finally", "next", "then", "afterward",
  "before", "meanwhile", "subsequently",
  // example / emphasis
  "specifically", "notably", "particularly", "indeed",
  // conclusion
  "overall", "ultimately", "essentially", "importantly",
]);

// ─── Constants ───────────────────────────────────────────────────────────────

/** Average adult silent reading speed (words per minute). */
const READING_WPM = 238;

/** Average adult speaking speed (words per minute). */
const SPEAKING_WPM = 150;

/** Sentence word-count threshold above which a sentence is "long". */
const LONG_SENTENCE_THRESHOLD = 35;

/** Sentence word-count threshold below which a sentence is "short". */
const SHORT_SENTENCE_THRESHOLD = 8;

// ─── Internal result shapes ──────────────────────────────────────────────────

interface SentenceRecord {
  text: string;
  wordCount: number;
  isQuestion: boolean;
  isExclamation: boolean;
  syllableCount: number;
  hasTransition: boolean;
}

interface ParagraphRecord {
  wordCount: number;
  hasTransition: boolean;
}

// ─── Syllable counting ───────────────────────────────────────────────────────

/**
 * Heuristic syllable count for one English word.
 * Counts vowel groups (a e i o u y), subtracts silent trailing 'e',
 * clamps to a minimum of 1.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  // count vowel clusters
  const clusters = w.match(/[aeiouy]+/g);
  let count = clusters ? clusters.length : 1;
  // subtract silent trailing 'e' — but NOT when preceded by l/r (table, centre)
  // and NOT when preceded by another vowel (agree, goalie)
  if (w.length > 3 && w.endsWith("e")) {
    const prev = w[w.length - 2]!;
    const prevIsVowelOrSonant = /[aeiouyrl]/.test(prev);
    if (!prevIsVowelOrSonant) {
      count = Math.max(1, count - 1);
    }
  }
  return Math.max(1, count);
}

// ─── Sentence parsing ────────────────────────────────────────────────────────

/**
 * Split visible text into sentence records.
 * Classifies each sentence and computes per-sentence stats in a single pass.
 */
function parseSentences(
  visibleText: string,
  transitionWords: ReadonlySet<string>,
): SentenceRecord[] {
  if (!visibleText.trim()) return [];

  // Split on sentence terminators (.!?) followed by whitespace or end-of-string.
  // Keep the terminator with its sentence.
  const rawFragments = visibleText.match(/[^.!?]*[.!?]+/g) ?? [];

  const records: SentenceRecord[] = [];
  for (const fragment of rawFragments) {
    const trimmed = fragment.trim();
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue; // discard fragments too short to be sentences

    const isQuestion   = trimmed.endsWith("?");
    const isExclamation = trimmed.endsWith("!");

    // Per-word stats: syllables and transition detection (first token only for transition)
    let syllableCount = 0;
    let hasTransition = false;
    const firstToken = tokens[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    if (transitionWords.has(firstToken)) hasTransition = true;

    for (const token of tokens) {
      const clean = token.replace(/[^a-zA-Z'-]/g, "");
      if (clean.length > 0) {
        syllableCount += countSyllables(clean);
      }
    }

    records.push({
      text: trimmed,
      wordCount: tokens.length,
      isQuestion,
      isExclamation,
      syllableCount,
      hasTransition,
    });
  }

  return records;
}

/**
 * Split raw content into paragraph-sized chunks and measure each.
 * Also checks whether each paragraph opens with a transition word.
 */
function parseParagraphs(
  raw: string,
  transitionWords: ReadonlySet<string>,
): ParagraphRecord[] {
  const chunks = raw
    .split(/(?:<\/p>|<br\s*\/?\s*>\s*<br\s*\/?\s*>|\n{2,})/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return chunks.map((chunk) => {
    const visible = stripToVisibleText(chunk);
    const wordCount = calculateVisibleWordCount(visible);

    // Check if the paragraph opens with a transition word
    const firstWord = visible.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    const hasTransition = transitionWords.has(firstWord);

    return { wordCount, hasTransition };
  }).filter((p) => p.wordCount > 0);
}

// ─── Punctuation counting ────────────────────────────────────────────────────

/**
 * Count punctuation characters (excluding sentence-terminal . ! ?
 * already implicit in sentence count) — commas, semicolons, colons,
 * dashes, parentheses, quotes.
 */
function countPunctuation(visibleText: string): number {
  return (visibleText.match(/[,;:()\-–—"']/g) ?? []).length;
}

// ─── Flesch Reading Ease ─────────────────────────────────────────────────────

/**
 * Flesch Reading Ease score.
 *   206.835 − 1.015 × (words/sentences) − 84.6 × (syllables/words)
 * Clamped to [0, 100].
 */
function fleschReadingEase(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number,
): number {
  if (totalWords === 0 || totalSentences === 0) return 0;
  const asl = totalWords / totalSentences;   // avg sentence length
  const asw = totalSyllables / totalWords;    // avg syllables per word
  const score = 206.835 - 1.015 * asl - 84.6 * asw;
  return round2(Math.min(100, Math.max(0, score)));
}

// ─── Type–Token Ratio ────────────────────────────────────────────────────────

/**
 * Type–Token Ratio: unique word forms / total word forms.
 * Computed on lowercased, punctuation-stripped tokens.
 */
function typeTokenRatio(visibleText: string): number {
  const tokens = visibleText
    .toLowerCase()
    .match(/\b[a-z']+\b/g) ?? [];
  if (tokens.length === 0) return 0;
  const unique = new Set(tokens);
  return round4(unique.size / tokens.length);
}

// ─── Rounding helpers ────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Provider configuration ───────────────────────────────────────────────────

export interface ReadabilityProviderOptions {
  transitionWords?: ReadonlySet<string>;
}

// ─── Provider implementation ──────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "readabilityScore",
  "typeTokenRatio",
  "longSentenceCount",
  "shortSentenceCount",
  "shortSentenceRatio",
  "punctuationDensity",
  "questionSentenceCount",
  "exclamationSentenceCount",
  "complexWordCount",
  "complexWordRatio",
  "estimatedReadingTimeMinutes",
  "estimatedSpeakingTimeMinutes",
  "paragraphFlow",
  "transitionWordCount",
  "transitionDensity",
  "transitionCoverage",
];

export class ReadabilityMetricsProvider implements MetricsProvider {
  readonly id             = "readability-metrics";
  readonly name           = "Readability Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 2;
  readonly dependencies: string[] = [];
  readonly estimatedCost: EstimatedCost = "fast";
  readonly cacheStrategy  = CACHE_STRATEGY_NONE;
  readonly outputFields   = OUTPUT_FIELDS;

  private readonly transitionWords: ReadonlySet<string>;

  constructor(options: ReadabilityProviderOptions = {}) {
    this.transitionWords = options.transitionWords ?? DEFAULT_TRANSITION_WORDS;
  }

  provide(
    input: MetricsCollectorInput,
    _priorMetrics: Partial<QualityMetrics>,
  ): Partial<QualityMetrics> {
    return measure(input, this.transitionWords);
  }
}

/**
 * Pure measurement function — separated from the class for direct testability.
 */
export function measure(
  input: MetricsCollectorInput,
  transitionWords: ReadonlySet<string> = DEFAULT_TRANSITION_WORDS,
): Partial<QualityMetrics> {
  const { introContent, faqItems } = input;

  // ── Step 1: build visible text (intro only for readability; FAQ excluded) ──
  const visibleIntro = stripToVisibleText(introContent);

  // ── Step 2: parse sentences in one pass ─────────────────────────────────
  const sentences = parseSentences(visibleIntro, transitionWords);
  const sentenceCount = sentences.length;

  // ── Step 3: accumulate sentence-level stats ──────────────────────────────
  let totalWords       = 0;
  let totalSyllables   = 0;
  let longSentenceCount  = 0;
  let shortSentenceCount = 0;
  let questionCount    = 0;
  let exclamationCount = 0;
  let transitionWordCount = 0;

  for (const s of sentences) {
    totalWords     += s.wordCount;
    totalSyllables += s.syllableCount;
    if (s.wordCount > LONG_SENTENCE_THRESHOLD)  longSentenceCount++;
    if (s.wordCount < SHORT_SENTENCE_THRESHOLD) shortSentenceCount++;
    if (s.isQuestion)    questionCount++;
    if (s.isExclamation) exclamationCount++;
    if (s.hasTransition) transitionWordCount++;
  }

  // ── Step 4: complex word count (3+ syllables) ───────────────────────────
  // We need per-word syllable granularity: iterate visible words once
  let complexWordCount = 0;
  const wordTokens = visibleIntro.match(/\b[a-zA-Z'-]+\b/g) ?? [];
  for (const token of wordTokens) {
    if (countSyllables(token) >= 3) complexWordCount++;
  }
  const visibleWordCount = wordTokens.length;

  // ── Step 5: paragraph-level stats ───────────────────────────────────────
  const paragraphs = parseParagraphs(introContent, transitionWords);
  const paragraphCount = paragraphs.length;
  const paragraphsWithTransition = paragraphs.filter((p) => p.hasTransition).length;

  // ── Step 6: punctuation density ─────────────────────────────────────────
  const punctuationCount = countPunctuation(visibleIntro);
  const punctuationDensity =
    visibleWordCount > 0 ? round2((punctuationCount / visibleWordCount) * 100) : 0;

  // ── Step 7: derived ratios ───────────────────────────────────────────────
  const shortSentenceRatio =
    sentenceCount > 0 ? round4(shortSentenceCount / sentenceCount) : 0;
  const complexWordRatio =
    visibleWordCount > 0 ? round4(complexWordCount / visibleWordCount) : 0;
  const transitionDensity =
    visibleWordCount > 0 ? round2((transitionWordCount / visibleWordCount) * 100) : 0;
  const transitionCoverage =
    paragraphCount > 0 ? round4(paragraphsWithTransition / paragraphCount) : 0;
  const paragraphFlow = transitionCoverage; // alias: same measurement

  // ── Step 8: Flesch score and TTR ────────────────────────────────────────
  const readabilityScore = fleschReadingEase(totalWords, sentenceCount, totalSyllables);
  const ttr = typeTokenRatio(visibleIntro);

  // ── Step 9: reading/speaking time (also includes FAQ) ───────────────────
  const faqText = faqItems.map((f) => `${f.question} ${f.answer}`).join(" ");
  const faqVisible = stripToVisibleText(faqText);
  const totalWordCount = totalWords + calculateVisibleWordCount(faqVisible);
  const estimatedReadingTimeMinutes  = round2(totalWordCount / READING_WPM);
  const estimatedSpeakingTimeMinutes = round2(totalWordCount / SPEAKING_WPM);

  return {
    readabilityScore,
    typeTokenRatio:             ttr,
    longSentenceCount,
    shortSentenceCount,
    shortSentenceRatio,
    punctuationDensity,
    questionSentenceCount:      questionCount,
    exclamationSentenceCount:   exclamationCount,
    complexWordCount,
    complexWordRatio,
    estimatedReadingTimeMinutes,
    estimatedSpeakingTimeMinutes,
    paragraphFlow,
    transitionWordCount,
    transitionDensity,
    transitionCoverage,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const readabilityMetricsProvider = new ReadabilityMetricsProvider();

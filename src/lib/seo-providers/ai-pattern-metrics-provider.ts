/**
 * AIPatternMetricsProvider
 *
 * Purpose:
 *   Measures deterministic writing patterns commonly associated with repetitive
 *   AI-generated content.  Measurement only — no scoring, no AI detection,
 *   no probability estimates, no classification.
 *
 * Owned QualityMetrics fields:
 *   aiPhraseCount, aiPhraseRatio,                              (legacy — also owned here)
 *   aiPhraseDensity, aiTransitionPhraseCount, aiHedgingPhraseCount,
 *   aiMarketingPhraseCount, templatePhraseCount, stockPhraseCount,
 *   genericClaimCount, repetitiveOpeningCount, repetitiveClosingCount,
 *   sentenceLengthUniformity, paragraphLengthUniformity, headingLengthUniformity,
 *   lexicalBurstiness, paragraphBurstiness, vocabularyRepetition,
 *   templateSentenceCount, templateSentenceRatio, templateParagraphCount,
 *   passiveVoiceProxy, listHeavyRatio, conclusionPatternCount,
 *   callToActionPatternCount, exclamationDensity, questionDensity,
 *   repetitionRisk, humanVariationScore, transitionOveruseScore,
 *   openingVariationScore, closingVariationScore,
 *   averageSentenceVariance, averageParagraphVariance
 *
 * Execution order: 10 (wave 1 — no provider dependencies)
 *
 * Matching strategy:
 *   All matching is case-insensitive via prior normalisation (lowercase +
 *   whitespace collapse).  Whole-phrase boundary matching via indexOf loop
 *   with Unicode-aware char boundary checks.  No NLP, no embeddings,
 *   no external services.
 *
 * Phrase dictionaries:
 *   AI_TRANSITION_PHRASES    — connector / cohesion phrases
 *   AI_HEDGING_PHRASES       — epistemic hedges
 *   AI_MARKETING_PHRASES     — marketing superlatives
 *   GENERIC_CLAIM_PHRASES    — generic quality claims
 *   STOCK_AI_PHRASES         — canonical stock AI phrases
 *   CONCLUSION_PHRASES       — conclusion-opener patterns
 *   CTA_PHRASES              — call-to-action patterns
 *   PASSIVE_IRREGULAR_PHRASES — common irregular passive constructions (proxy)
 *
 * Uniformity formula:   1 / (1 + CV)   where CV = σ / μ
 * Burstiness:           raw CV of the measured distribution
 * repetitionRisk:       weighted mean of four 0-1 sub-signals
 * humanVariationScore:  1 − repetitionRisk
 *
 * Performance:
 *   Phrase dictionaries are precompiled constants (module-level).
 *   Content zones are normalised once.  Single pass over sentences /
 *   paragraphs / headings for all per-unit metrics.  O(n × d) where
 *   n = content length, d = total dictionary size.
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
} from "@/lib/seo-quality-types";

// ─── Phrase dictionaries ──────────────────────────────────────────────────────

/** Classic AI connector / cohesion phrases. */
export const AI_TRANSITION_PHRASES: readonly string[] = [
  "additionally",
  "furthermore",
  "moreover",
  "in conclusion",
  "overall",
  "similarly",
  "consequently",
  "meanwhile",
  "however",
  "in summary",
  "to summarize",
  "it is worth noting",
  "on the other hand",
  "as a result",
  "therefore",
  "thus",
  "hence",
  "in addition",
  "first and foremost",
  "last but not least",
  "in other words",
  "to conclude",
  "as mentioned",
  "as stated",
  "as noted",
  "having said that",
  "that being said",
  "with that being said",
  "all things considered",
];

/** Epistemic hedging phrases. */
export const AI_HEDGING_PHRASES: readonly string[] = [
  "it is important to note",
  "it should be noted",
  "it is worth noting",
  "one key aspect",
  "another important aspect",
  "one important factor",
  "another key factor",
  "it is essential to",
  "it is crucial to",
  "it is vital to",
  "it goes without saying",
  "needless to say",
  "it is fair to say",
  "it is safe to say",
  "generally speaking",
  "broadly speaking",
  "in many cases",
  "in most cases",
  "in some cases",
];

/** Marketing superlative phrases. */
export const AI_MARKETING_PHRASES: readonly string[] = [
  "best choice",
  "industry leading",
  "premium quality",
  "trusted solution",
  "world class",
  "next generation",
  "cutting edge",
  "state of the art",
  "best in class",
  "top notch",
  "second to none",
  "unparalleled",
  "unmatched",
  "exceptional quality",
  "superior quality",
  "industry standard",
  "seamless experience",
  "top of the line",
];

/** Generic quality claim phrases. */
export const GENERIC_CLAIM_PHRASES: readonly string[] = [
  "easy to use",
  "user friendly",
  "high quality",
  "excellent service",
  "works perfectly",
  "best experience",
  "amazing experience",
  "great results",
  "outstanding results",
  "proven results",
  "guaranteed results",
  "effective solution",
  "comprehensive solution",
  "tailored to your needs",
  "designed to meet your needs",
  "all your needs",
];

/** Canonical stock AI phrases. */
export const STOCK_AI_PHRASES: readonly string[] = [
  "it is important to note",
  "it should be noted",
  "one key aspect",
  "another important aspect",
  "in today's world",
  "in today's digital age",
  "in the modern world",
  "as we know",
  "look no further",
  "without further ado",
  "at the end of the day",
  "in a nutshell",
  "to put it simply",
  "long story short",
  "the bottom line is",
  "rest assured",
  "dive into",
  "delve into",
  "harness the power",
  "unlock the potential",
  "explore the world",
  "take your",
];

/** Conclusion-opener patterns. */
export const CONCLUSION_PHRASES: readonly string[] = [
  "in conclusion",
  "to conclude",
  "to summarize",
  "in summary",
  "in closing",
  "to wrap up",
  "finally",
  "in the end",
  "as we can see",
  "as you can see",
  "ultimately",
  "to sum up",
  "in short",
  "all in all",
];

/** Call-to-action patterns. */
export const CTA_PHRASES: readonly string[] = [
  "contact us",
  "book now",
  "call us",
  "get in touch",
  "reach out",
  "click here",
  "sign up",
  "learn more",
  "find out more",
  "start today",
  "get started",
  "try now",
  "buy now",
  "order now",
  "schedule now",
  "request a quote",
  "book today",
  "call today",
  "contact today",
];

/**
 * Common irregular past participles used in passive constructions.
 * Supplements the -ed regex for cases not caught by suffix matching.
 */
const PASSIVE_IRREGULAR_PHRASES: readonly string[] = [
  "was made", "was done", "was built", "was written", "was driven",
  "was given", "was shown", "was known", "was found", "was chosen",
  "were made", "were done", "were built", "were written", "were driven",
  "were given", "were shown", "were known", "were found",
  "is known", "is found", "is given", "is shown", "is seen",
  "are known", "are found", "are given", "are shown",
  "has been made", "has been done", "has been built", "has been written",
  "have been made", "have been done", "have been built",
  "had been made", "had been done",
  "will be done", "will be given", "will be shown",
  "can be done", "can be found", "can be given", "can be seen",
  "could be done", "could be found",
  "should be done", "should be used",
  "being used", "being created", "being provided", "being developed",
];

/**
 * Deduplicated union of all phrase dictionaries.
 * Used for computing aiPhraseCount, templateSentenceCount, templateParagraphCount.
 */
export const ALL_AI_PHRASES: readonly string[] = [
  ...new Set([
    ...AI_TRANSITION_PHRASES,
    ...AI_HEDGING_PHRASES,
    ...AI_MARKETING_PHRASES,
    ...GENERIC_CLAIM_PHRASES,
    ...STOCK_AI_PHRASES,
    ...CONCLUSION_PHRASES,
    ...CTA_PHRASES,
  ]),
];

/**
 * Template phrase list = STOCK_AI_PHRASES ∪ CONCLUSION_PHRASES.
 * "Template-like" phrases are those most likely to appear in boilerplate structures.
 */
const TEMPLATE_PHRASES_DEDUP: readonly string[] = [
  ...new Set([...STOCK_AI_PHRASES, ...CONCLUSION_PHRASES]),
];

// ─── Passive voice regex ──────────────────────────────────────────────────────

/**
 * Matches auxiliary + regular past participle (-ed suffix).
 * This is a proxy — not full grammatical parsing.
 */
const PASSIVE_ED_REGEX =
  /\b(?:was|were|is|are|has been|have been|had been|will be|can be|could be|should be|being)\s+\w+ed\b/i;

// ─── Normalisation ────────────────────────────────────────────────────────────

/** Lowercase + collapse whitespace + trim. */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// ─── Phrase matching ──────────────────────────────────────────────────────────

/**
 * Count whole-phrase occurrences of `normPhrase` in `normText`.
 * The character immediately before/after must NOT be a Unicode letter,
 * combining mark, or digit.
 */
export function countPhraseOccurrences(normText: string, normPhrase: string): number {
  if (!normPhrase || !normText) return 0;
  let count = 0;
  let pos   = 0;
  for (;;) {
    const i = normText.indexOf(normPhrase, pos);
    if (i === -1) break;
    const before = i > 0 ? normText[i - 1]! : " ";
    const after  = i + normPhrase.length < normText.length
      ? normText[i + normPhrase.length]!
      : " ";
    if (!/[\p{L}\p{M}\p{N}]/u.test(before) && !/[\p{L}\p{M}\p{N}]/u.test(after)) {
      count++;
    }
    pos = i + 1;
  }
  return count;
}

/** Total occurrences of all phrases from `list` in `normText`. */
function countList(normText: string, list: readonly string[]): number {
  let total = 0;
  for (const phrase of list) total += countPhraseOccurrences(normText, phrase);
  return total;
}

/** True if `normText` contains any phrase from `list`. */
function containsAny(normText: string, list: readonly string[]): boolean {
  return list.some((p) => countPhraseOccurrences(normText, p) > 0);
}

// ─── Sentence / paragraph splitting ──────────────────────────────────────────

/** Split normalised text into sentences on `.`, `!`, `?`. */
export function splitSentences(normText: string): string[] {
  return normText.split(/(?<=[.!?])\s+|(?<=[.!?])$/).filter(Boolean);
}

/** Split raw text into normalised paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => normalise(p.replace(/\n/g, " ")))
    .filter(Boolean);
}

// ─── Word counting ────────────────────────────────────────────────────────────

/** Unicode-safe word token count (letters, combining marks, digits). */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).length;
}

/** Tokenise normalised text into word tokens. */
function tokenise(normText: string): string[] {
  return normText.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function varianceFn(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  return Math.sqrt(varianceFn(nums));
}

/**
 * Coefficient of variation = σ / μ.  Returns 0 when μ = 0 (no content).
 */
function coefficientOfVariation(nums: number[]): number {
  const m = mean(nums);
  return m === 0 ? 0 : stdDev(nums) / m;
}

/**
 * Length uniformity = 1 / (1 + CV).
 *   CV = 0  → uniformity = 1  (all same length — most AI-like)
 *   CV → ∞  → uniformity → 0  (wildly varying)
 * Returns 0 for empty input.
 */
function uniformityScore(nums: number[]): number {
  if (nums.length === 0) return 0;
  const cv = coefficientOfVariation(nums);
  return round4(1 / (1 + cv));
}

// ─── List detection ───────────────────────────────────────────────────────────

/**
 * Returns true when a paragraph appears to be list-heavy (HTML or markdown).
 * Uses ≥2 list-item indicators as the threshold.
 */
export function isListHeavy(paragraph: string): boolean {
  if (/<li\b|<ul\b|<ol\b/i.test(paragraph)) return true;
  const lines     = paragraph.split("\n");
  const listLines = lines.filter(
    (l) => /^\s*[-*+]\s/.test(l) || /^\s*\d+\.\s/.test(l)
  );
  return listLines.length >= 2;
}

// ─── Passive voice proxy ──────────────────────────────────────────────────────

/**
 * Heuristic passive-voice detection for a single normalised sentence.
 * Combines a regex for regular -ed forms and a phrase list for common
 * irregular past participles.
 */
export function hasPassiveConstruction(normSentence: string): boolean {
  if (PASSIVE_ED_REGEX.test(normSentence)) return true;
  return PASSIVE_IRREGULAR_PHRASES.some((p) => normSentence.includes(p));
}

// ─── Opening / closing extraction ─────────────────────────────────────────────

const OPENING_WORDS = 3;
const CLOSING_WORDS = 3;

function sentenceOpening(normSentence: string): string {
  return normSentence.split(/\s+/).slice(0, OPENING_WORDS).join(" ");
}

function sentenceClosing(normSentence: string): string {
  const words = normSentence.split(/\s+/);
  return words.slice(Math.max(0, words.length - CLOSING_WORDS)).join(" ");
}

// ─── Rounding helper ──────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope:                "none",
  ttlMs:                null,
  keyFields:            [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  // Legacy fields (also owned here)
  "aiPhraseCount",
  "aiPhraseRatio",
  "templateSentenceCount",
  "templateSentenceRatio",
  // Extended fields
  "aiPhraseDensity",
  "aiTransitionPhraseCount",
  "aiHedgingPhraseCount",
  "aiMarketingPhraseCount",
  "templatePhraseCount",
  "stockPhraseCount",
  "genericClaimCount",
  "repetitiveOpeningCount",
  "repetitiveClosingCount",
  "sentenceLengthUniformity",
  "paragraphLengthUniformity",
  "headingLengthUniformity",
  "lexicalBurstiness",
  "paragraphBurstiness",
  "vocabularyRepetition",
  "templateParagraphCount",
  "passiveVoiceProxy",
  "listHeavyRatio",
  "conclusionPatternCount",
  "callToActionPatternCount",
  "exclamationDensity",
  "questionDensity",
  "repetitionRisk",
  "humanVariationScore",
  "transitionOveruseScore",
  "openingVariationScore",
  "closingVariationScore",
  "averageSentenceVariance",
  "averageParagraphVariance",
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class AIPatternMetricsProvider implements MetricsProvider {
  readonly id             = "ai-pattern-metrics";
  readonly name           = "AI Pattern Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 10;
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
    introContent,
    faqItems,
    h1,
    headings: suppliedHeadings,
  } = input;

  const intro = introContent ?? "";

  // ── Content zones ─────────────────────────────────────────────────────────

  const faqText      = faqItems.map((f) => `${f.question} ${f.answer}`).join(" ");
  const bodyRaw      = [intro, faqText].filter(Boolean).join(" ");
  const bodyNorm     = normalise(bodyRaw);

  // Headings: caller-supplied then h1
  const allHeadings: string[] = [
    ...(suppliedHeadings?.map(normalise) ?? []),
    ...(h1 ? [normalise(h1)] : []),
  ].filter(Boolean);
  const headingsNorm = allHeadings.join(" ");

  const fullNorm     = [bodyNorm, headingsNorm].filter(Boolean).join(" ");

  // ── Unit splits ───────────────────────────────────────────────────────────

  const introParagraphs  = splitParagraphs(intro);
  const bodySentences    = splitSentences(bodyNorm);

  const totalWords       = countWords(fullNorm);
  const totalSentences   = bodySentences.length;
  const totalParagraphs  = introParagraphs.length;

  // ── Phrase category counts (over full body text) ──────────────────────────

  const aiTransitionPhraseCount  = countList(bodyNorm, AI_TRANSITION_PHRASES);
  const aiHedgingPhraseCount     = countList(bodyNorm, AI_HEDGING_PHRASES);
  const aiMarketingPhraseCount   = countList(bodyNorm, AI_MARKETING_PHRASES);
  const genericClaimCount        = countList(bodyNorm, GENERIC_CLAIM_PHRASES);
  const stockPhraseCount         = countList(bodyNorm, STOCK_AI_PHRASES);
  const conclusionPatternCount   = countList(bodyNorm, CONCLUSION_PHRASES);
  const callToActionPatternCount = countList(bodyNorm, CTA_PHRASES);

  // Combined "template" occurrences (STOCK ∪ CONCLUSION, deduped list)
  const templatePhraseCount = countList(bodyNorm, TEMPLATE_PHRASES_DEDUP);

  // Total AI phrase occurrences (all dictionaries, deduped union)
  const aiPhraseCount = countList(bodyNorm, ALL_AI_PHRASES);

  // Density / ratio
  const aiPhraseDensity = totalWords > 0 ? round4(aiPhraseCount / totalWords * 100) : 0;
  const aiPhraseRatio   = totalWords > 0 ? round4(aiPhraseCount / totalWords) : 0;

  // ── Template sentence / paragraph counts ─────────────────────────────────

  let templateSentenceCount = 0;
  let transitionSentenceCount = 0;    // for transitionOveruseScore

  for (const sent of bodySentences) {
    if (containsAny(sent, ALL_AI_PHRASES)) templateSentenceCount++;
    if (containsAny(sent, AI_TRANSITION_PHRASES)) transitionSentenceCount++;
  }

  const templateSentenceRatio = totalSentences > 0
    ? round4(templateSentenceCount / totalSentences) : 0;

  const transitionOveruseScore = totalSentences > 0
    ? round4(transitionSentenceCount / totalSentences) : 0;

  let templateParagraphCount = 0;
  for (const para of introParagraphs) {
    if (containsAny(para, ALL_AI_PHRASES)) templateParagraphCount++;
  }

  // ── Sentence length statistics ────────────────────────────────────────────

  const sentenceWordCounts = bodySentences.map(countWords);
  const sentenceLengthUniformity = uniformityScore(sentenceWordCounts);
  const averageSentenceVariance  = round4(varianceFn(sentenceWordCounts));

  // ── Paragraph length statistics ───────────────────────────────────────────

  const paraWordCounts = introParagraphs.map(countWords);
  const paragraphLengthUniformity = uniformityScore(paraWordCounts);
  const averageParagraphVariance  = round4(varianceFn(paraWordCounts));
  const paragraphBurstiness       = round4(coefficientOfVariation(paraWordCounts));

  // ── Heading length statistics ─────────────────────────────────────────────

  const headingWordCounts      = allHeadings.map(countWords);
  const headingLengthUniformity = uniformityScore(headingWordCounts);

  // ── Vocabulary repetition ─────────────────────────────────────────────────

  const allTokens   = tokenise(fullNorm);
  const tokenTotal  = allTokens.length;

  const tokenFreq = new Map<string, number>();
  for (const t of allTokens) tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1);

  let repeatedTokenCount = 0;
  for (const f of tokenFreq.values()) if (f > 1) repeatedTokenCount += f;

  const vocabularyRepetition = tokenTotal > 0
    ? round4(repeatedTokenCount / tokenTotal) : 0;

  // ── Lexical burstiness (CV of word frequencies) ───────────────────────────

  const freqValues  = [...tokenFreq.values()];
  const lexicalBurstiness = round4(coefficientOfVariation(freqValues));

  // ── Opening / closing patterns ────────────────────────────────────────────

  const openingFreq = new Map<string, number>();
  const closingFreq = new Map<string, number>();

  for (const sent of bodySentences) {
    const op = sentenceOpening(sent);
    const cl = sentenceClosing(sent);
    if (op) openingFreq.set(op, (openingFreq.get(op) ?? 0) + 1);
    if (cl) closingFreq.set(cl, (closingFreq.get(cl) ?? 0) + 1);
  }

  let repetitiveOpeningCount = 0;
  for (const f of openingFreq.values()) if (f > 1) repetitiveOpeningCount++;

  let repetitiveClosingCount = 0;
  for (const f of closingFreq.values()) if (f > 1) repetitiveClosingCount++;

  const openingVariationScore = totalSentences > 0
    ? round4(openingFreq.size / totalSentences) : 0;

  const closingVariationScore = totalSentences > 0
    ? round4(closingFreq.size / totalSentences) : 0;

  // ── Passive voice proxy ───────────────────────────────────────────────────

  let passiveSentenceCount = 0;
  for (const sent of bodySentences) {
    if (hasPassiveConstruction(sent)) passiveSentenceCount++;
  }
  const passiveVoiceProxy = totalSentences > 0
    ? round4(passiveSentenceCount / totalSentences) : 0;

  // ── List heavy ratio ──────────────────────────────────────────────────────

  const listHeavyParas = introParagraphs.filter(isListHeavy).length;
  const listHeavyRatio = totalParagraphs > 0
    ? round4(listHeavyParas / totalParagraphs) : 0;

  // ── Exclamation / question density ───────────────────────────────────────

  const exclamationCount = (bodyRaw.match(/!/g) ?? []).length;
  const questionCount    = (bodyRaw.match(/\?/g) ?? []).length;
  const exclamationDensity = totalWords > 0
    ? round4(exclamationCount / totalWords * 100) : 0;
  const questionDensity    = totalWords > 0
    ? round4(questionCount / totalWords * 100) : 0;

  // ── Composite: repetitionRisk & humanVariationScore ───────────────────────
  //
  // Four equally-weighted sub-signals, each normalised to [0, 1]:
  //   ① sentenceLengthUniformity (already 0-1, 1=AI-like uniform)
  //   ② vocabularyRepetition     (already 0-1, 1=all tokens are repeated types)
  //   ③ transitionOveruseScore   (already 0-1, 1=every sentence has a transition)
  //   ④ aiPhraseDensity / 10     (0-∞ → cap at 1; 10 phrases/100 words ≈ saturation)

  const aiDensityCapped = Math.min(aiPhraseDensity / 10, 1);
  const repetitionRisk  = round4(
    (sentenceLengthUniformity + vocabularyRepetition + transitionOveruseScore + aiDensityCapped) / 4
  );
  const humanVariationScore = round4(1 - repetitionRisk);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // Legacy fields
    aiPhraseCount,
    aiPhraseRatio,
    templateSentenceCount,
    templateSentenceRatio,
    // Extended fields
    aiPhraseDensity,
    aiTransitionPhraseCount,
    aiHedgingPhraseCount,
    aiMarketingPhraseCount,
    templatePhraseCount,
    stockPhraseCount,
    genericClaimCount,
    repetitiveOpeningCount,
    repetitiveClosingCount,
    sentenceLengthUniformity,
    paragraphLengthUniformity,
    headingLengthUniformity,
    lexicalBurstiness,
    paragraphBurstiness,
    vocabularyRepetition,
    templateParagraphCount,
    passiveVoiceProxy,
    listHeavyRatio,
    conclusionPatternCount,
    callToActionPatternCount,
    exclamationDensity,
    questionDensity,
    repetitionRisk,
    humanVariationScore,
    transitionOveruseScore,
    openingVariationScore,
    closingVariationScore,
    averageSentenceVariance,
    averageParagraphVariance,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const aiPatternMetricsProvider = new AIPatternMetricsProvider();

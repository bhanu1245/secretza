/**
 * FAQMetricsProvider
 *
 * Purpose:
 *   Measures objective FAQ characteristics of a page.
 *   Measurement only — no scoring, no thresholds, no quality judgments.
 *
 * Owned QualityMetrics fields:
 *   faqCount, faqAvgAnswerWords, faqDuplicateLeadIns,
 *   questionCount, answerCount,
 *   averageQuestionLength, averageAnswerLength,
 *   averageQuestionWords, averageAnswerWords,
 *   longestQuestionLength, longestAnswerLength,
 *   shortestQuestionLength, shortestAnswerLength,
 *   duplicateQuestionCount, duplicateAnswerCount, duplicateFaqPairCount,
 *   emptyQuestionCount, emptyAnswerCount,
 *   questionMarkCount,
 *   questionStartsWithWhWord / How / What / Where / When / Why / Can / Is / Are,
 *   answerContainsList / InternalLink / Keyword / Number / Location / CallToAction,
 *   answerReadingTimeMinutes,
 *   faqCompleteness,
 *   structuredFaqParity, structuredFaqQuestionCoverage, structuredFaqAnswerCoverage,
 *   missingStructuredFaqCount, extraStructuredFaqCount
 *
 * Execution order: 5 (wave 1 — no provider dependencies)
 *
 * Parsing strategy:
 *   Single-pass iteration over faqItems accumulates all per-item stats.
 *   Duplicate detection uses normalised-text Sets built during the same pass.
 *   Schema parity is a second-pass comparison (O(schema + content)).
 *   Total complexity: O(n) where n = total FAQ character count.
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
  FaqItem,
  CityIntelSnapshot,
} from "@/lib/seo-quality-types";
import { stripToVisibleText } from "@/lib/seo-quality";

// ─── Constants ────────────────────────────────────────────────────────────────

const READING_WPM = 238;
const LEAD_IN_WORDS = 3; // how many leading words define the "lead-in"

// ─── WH-word sets ────────────────────────────────────────────────────────────

const WH_WORDS = new Set([
  "who", "whom", "whose", "which", "what", "where", "when", "why", "how",
]);

// ─── CTA phrases ─────────────────────────────────────────────────────────────

const CTA_PHRASES = [
  "contact us", "call us", "book now", "visit us", "click here",
  "get in touch", "reach out", "book your", "reserve", "enquire",
  "inquire", "whatsapp", "telegram", "message us", "send us",
  "schedule", "sign up", "register",
];

// ─── Generic location words ───────────────────────────────────────────────────

const LOCATION_WORDS = [
  "city", "area", "district", "local", "location", "address",
  "nearby", "neighbourhood", "neighborhood", "locality", "zone",
  "sector", "block", "colony", "road", "street",
];

// ─── Text normalisation ───────────────────────────────────────────────────────

/**
 * Normalise FAQ text for duplicate detection:
 * lowercase, collapse whitespace, strip leading/trailing punctuation.
 */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .trim();
}

// ─── Word counting ────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Question format detection ────────────────────────────────────────────────

/**
 * Return the first lowercased word of a question, stripping punctuation.
 */
function firstWord(text: string): string {
  const m = text.toLowerCase().match(/^[^\w]*([\w']+)/);
  return m ? m[1]! : "";
}

// ─── Answer signal detection ──────────────────────────────────────────────────

/** Returns true if the answer text contains an HTML or markdown list. */
function hasListContent(answer: string): boolean {
  return (
    /<\s*ul[\s>]|<\s*ol[\s>]/i.test(answer) ||
    /^\s*[-*•]\s+\S/m.test(answer) ||
    /^\s*\d+[.)]\s+\S/m.test(answer)
  );
}

/** Returns true if the answer contains a relative internal link. */
function hasInternalLink(answer: string): boolean {
  // Relative href: href="/" or href="/path" or markdown [text](/path)
  return (
    /<a\s[^>]*href=["']\//i.test(answer) ||
    /(?<!!)\[[^\]]*\]\(\/[^)]*\)/g.test(answer)
  );
}

/** Returns true if the answer contains any digit sequence. */
function hasNumber(answer: string): boolean {
  return /\d/.test(answer);
}

/** Returns true if the answer references a location. */
function hasLocation(
  answer: string,
  cityIntel: CityIntelSnapshot | null,
): boolean {
  const lower = answer.toLowerCase();

  if (LOCATION_WORDS.some((w) => lower.includes(w))) return true;

  if (cityIntel) {
    const entities = [
      cityIntel.city,
      ...cityIntel.areas,
      ...cityIntel.landmarks,
      ...cityIntel.transportHubs,
      ...cityIntel.businessDistricts,
    ];
    if (entities.some((e) => e && lower.includes(e.toLowerCase()))) return true;
  }

  return false;
}

/** Returns true if the answer contains a call-to-action phrase. */
function hasCallToAction(answer: string): boolean {
  const lower = answer.toLowerCase();
  return CTA_PHRASES.some((phrase) => lower.includes(phrase));
}

/** Returns true if the answer contains the primary keyword (whole-word, case-insensitive). */
function hasKeyword(answer: string, primaryKeyword: string | null): boolean {
  if (!primaryKeyword) return false;
  const escaped = primaryKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use Unicode-safe word boundary via lookahead/lookbehind
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  return pattern.test(answer);
}

// ─── Lead-in extraction ───────────────────────────────────────────────────────

/**
 * Extract the first N word tokens of a question as its "lead-in".
 * Used to detect template-style duplicate question openings.
 */
function getLeadIn(question: string, n: number = LEAD_IN_WORDS): string {
  return question
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .slice(0, n)
    .join(" ");
}

// ─── Structured FAQ schema extraction ────────────────────────────────────────

interface SchemaFaqItem {
  question: string;
  answer: string;
}

/**
 * Parse FAQPage JSON-LD schema to extract question/answer pairs.
 * Handles single object, array, and @graph wrappers.
 * Returns an empty array if structuredData is absent or malformed.
 */
export function extractSchemaFaqs(structuredData: string | null): SchemaFaqItem[] {
  if (!structuredData?.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(structuredData);
  } catch {
    return [];
  }

  // Normalise to array of top-level blocks
  let blocks: Record<string, unknown>[] = [];
  if (Array.isArray(parsed)) {
    blocks = parsed as Record<string, unknown>[];
  } else if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      blocks = obj["@graph"] as Record<string, unknown>[];
    } else {
      blocks = [obj];
    }
  }

  const faqs: SchemaFaqItem[] = [];

  for (const block of blocks) {
    if (block["@type"] !== "FAQPage") continue;
    const mainEntity = block["mainEntity"];
    if (!Array.isArray(mainEntity)) continue;

    for (const entity of mainEntity) {
      if (typeof entity !== "object" || entity === null) continue;
      const e = entity as Record<string, unknown>;
      const q = e["name"];
      const accepted = e["acceptedAnswer"];
      const a =
        typeof accepted === "object" && accepted !== null
          ? (accepted as Record<string, unknown>)["text"]
          : null;

      if (typeof q === "string" && typeof a === "string") {
        faqs.push({ question: q, answer: a });
      }
    }
  }

  return faqs;
}

// ─── Parity comparison ────────────────────────────────────────────────────────

/**
 * Compare content FAQ items against schema FAQ items.
 * Matching is done on normalised question text only — answers are
 * checked separately for coverage.
 */
function computeSchemaFaqParity(
  contentFaqs: FaqItem[],
  schemaFaqs: SchemaFaqItem[],
): {
  parity: number;
  questionCoverage: number;
  answerCoverage: number;
  missingCount: number;
  extraCount: number;
} {
  if (schemaFaqs.length === 0 && contentFaqs.length === 0) {
    return {
      parity: 1,
      questionCoverage: 1,
      answerCoverage: 1,
      missingCount: 0,
      extraCount: 0,
    };
  }

  if (schemaFaqs.length === 0) {
    return {
      parity: 0,
      questionCoverage: 0,
      answerCoverage: 0,
      missingCount: contentFaqs.length,
      extraCount: 0,
    };
  }

  // Build normalised question sets for O(1) lookup
  const contentQuestions = new Map<string, string>(
    contentFaqs.map((f) => [normaliseText(f.question), normaliseText(f.answer)]),
  );
  const schemaQuestions = new Map<string, string>(
    schemaFaqs.map((f) => [normaliseText(f.question), normaliseText(f.answer)]),
  );

  // Questions in schema that exist in content
  let schemaQuestionsFound = 0;
  let schemaAnswersMatched = 0;
  for (const [sq, sa] of schemaQuestions) {
    if (contentQuestions.has(sq)) {
      schemaQuestionsFound++;
      if (contentQuestions.get(sq) === sa) schemaAnswersMatched++;
    }
  }

  // Content FAQs missing from schema
  let missingCount = 0;
  for (const cq of contentQuestions.keys()) {
    if (!schemaQuestions.has(cq)) missingCount++;
  }

  // Schema FAQs not in content
  let extraCount = 0;
  for (const sq of schemaQuestions.keys()) {
    if (!contentQuestions.has(sq)) extraCount++;
  }

  const schemaLen = schemaFaqs.length;
  const parity         = round4(schemaQuestionsFound / schemaLen);
  const qCoverage      = round4(schemaQuestionsFound / schemaLen);
  const aCoverage      = schemaQuestionsFound > 0
    ? round4(schemaAnswersMatched / schemaQuestionsFound)
    : 0;

  return {
    parity,
    questionCoverage: qCoverage,
    answerCoverage:   aCoverage,
    missingCount,
    extraCount,
  };
}

// ─── Rounding helper ──────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "faqCount",
  "faqAvgAnswerWords",
  "faqDuplicateLeadIns",
  "questionCount",
  "answerCount",
  "averageQuestionLength",
  "averageAnswerLength",
  "averageQuestionWords",
  "averageAnswerWords",
  "longestQuestionLength",
  "longestAnswerLength",
  "shortestQuestionLength",
  "shortestAnswerLength",
  "duplicateQuestionCount",
  "duplicateAnswerCount",
  "duplicateFaqPairCount",
  "emptyQuestionCount",
  "emptyAnswerCount",
  "questionMarkCount",
  "questionStartsWithWhWord",
  "questionStartsWithHow",
  "questionStartsWithWhat",
  "questionStartsWithWhere",
  "questionStartsWithWhen",
  "questionStartsWithWhy",
  "questionStartsWithCan",
  "questionStartsWithIs",
  "questionStartsWithAre",
  "answerContainsList",
  "answerContainsInternalLink",
  "answerContainsKeyword",
  "answerContainsNumber",
  "answerContainsLocation",
  "answerContainsCallToAction",
  "answerReadingTimeMinutes",
  "faqCompleteness",
  "structuredFaqParity",
  "structuredFaqQuestionCoverage",
  "structuredFaqAnswerCoverage",
  "missingStructuredFaqCount",
  "extraStructuredFaqCount",
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class FaqMetricsProvider implements MetricsProvider {
  readonly id             = "faq-metrics";
  readonly name           = "FAQ Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 5;
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
  const { faqItems, structuredData, primaryKeyword, cityIntel } = input;
  const n = faqItems.length;

  // ── Empty FAQ list fast path ──────────────────────────────────────────────
  if (n === 0) {
    const schemaFaqs = extractSchemaFaqs(structuredData);
    return {
      faqCount:                    0,
      faqAvgAnswerWords:           0,
      faqDuplicateLeadIns:         0,
      questionCount:               0,
      answerCount:                 0,
      averageQuestionLength:       0,
      averageAnswerLength:         0,
      averageQuestionWords:        0,
      averageAnswerWords:          0,
      longestQuestionLength:       0,
      longestAnswerLength:         0,
      shortestQuestionLength:      0,
      shortestAnswerLength:        0,
      duplicateQuestionCount:      0,
      duplicateAnswerCount:        0,
      duplicateFaqPairCount:       0,
      emptyQuestionCount:          0,
      emptyAnswerCount:            0,
      questionMarkCount:           0,
      questionStartsWithWhWord:    0,
      questionStartsWithHow:       0,
      questionStartsWithWhat:      0,
      questionStartsWithWhere:     0,
      questionStartsWithWhen:      0,
      questionStartsWithWhy:       0,
      questionStartsWithCan:       0,
      questionStartsWithIs:        0,
      questionStartsWithAre:       0,
      answerContainsList:          0,
      answerContainsInternalLink:  0,
      answerContainsKeyword:       0,
      answerContainsNumber:        0,
      answerContainsLocation:      0,
      answerContainsCallToAction:  0,
      answerReadingTimeMinutes:    0,
      faqCompleteness:             0,
      structuredFaqParity:         schemaFaqs.length > 0 ? 0 : 1,
      structuredFaqQuestionCoverage: schemaFaqs.length > 0 ? 0 : 1,
      structuredFaqAnswerCoverage:   schemaFaqs.length > 0 ? 0 : 1,
      missingStructuredFaqCount:     0,
      extraStructuredFaqCount:       schemaFaqs.length,
    };
  }

  // ── Accumulators ─────────────────────────────────────────────────────────
  let totalQLen    = 0;
  let totalALen    = 0;
  let totalQWords  = 0;
  let totalAWords  = 0;
  let maxQLen      = 0;
  let maxALen      = 0;
  let minQLen      = Infinity;
  let minALen      = Infinity;

  let emptyQuestionCount = 0;
  let emptyAnswerCount   = 0;
  let completeCount      = 0;
  let questionMarkCount  = 0;

  // Question-starter counts
  let startsWithWhWord = 0;
  let startsWithHow    = 0;
  let startsWithWhat   = 0;
  let startsWithWhere  = 0;
  let startsWithWhen   = 0;
  let startsWithWhy    = 0;
  let startsWithCan    = 0;
  let startsWithIs     = 0;
  let startsWithAre    = 0;

  // Answer-signal counts
  let hasList     = 0;
  let hasLink     = 0;
  let hasKw       = 0;
  let hasNum      = 0;
  let hasLoc      = 0;
  let hasCta      = 0;

  // Duplicate detection (built during single pass)
  const seenQuestions = new Map<string, number>(); // normalised → first-seen index
  const seenAnswers   = new Map<string, number>();
  const seenPairs     = new Map<string, number>();
  const dupQuestions  = new Set<string>();
  const dupAnswers    = new Set<string>();
  const dupPairs      = new Set<string>();

  // Lead-in duplicate detection
  const leadInCounts  = new Map<string, number>();

  // ── Single-pass over FAQ items ────────────────────────────────────────────
  for (const item of faqItems) {
    const q = (item.question ?? "").trim();
    const a = (item.answer   ?? "").trim();

    // Empty checks
    if (!q) emptyQuestionCount++;
    if (!a) emptyAnswerCount++;
    if (q && a) completeCount++;

    // Lengths
    totalQLen += q.length;
    totalALen += a.length;
    if (q.length > maxQLen) maxQLen = q.length;
    if (a.length > maxALen) maxALen = a.length;
    if (q.length > 0 && q.length < minQLen) minQLen = q.length;
    if (a.length > 0 && a.length < minALen) minALen = a.length;

    // Word counts
    const qW = wordCount(q);
    const aW = wordCount(a);
    totalQWords += qW;
    totalAWords += aW;

    // Question format
    if (q.endsWith("?")) questionMarkCount++;
    const fw = firstWord(q);
    if (WH_WORDS.has(fw)) startsWithWhWord++;
    if (fw === "how")   startsWithHow++;
    if (fw === "what")  startsWithWhat++;
    if (fw === "where") startsWithWhere++;
    if (fw === "when")  startsWithWhen++;
    if (fw === "why")   startsWithWhy++;
    if (fw === "can")   startsWithCan++;
    if (fw === "is")    startsWithIs++;
    if (fw === "are")   startsWithAre++;

    // Answer signals
    if (hasListContent(a))                    hasList++;
    if (hasInternalLink(a))                   hasLink++;
    if (hasKeyword(a, primaryKeyword))         hasKw++;
    if (hasNumber(a))                          hasNum++;
    if (hasLocation(a, cityIntel))             hasLoc++;
    if (hasCallToAction(a))                    hasCta++;

    // Duplicate detection
    const normQ    = normaliseText(q);
    const normA    = normaliseText(a);
    const normPair = `${normQ}\x00${normA}`;

    if (q && seenQuestions.has(normQ)) dupQuestions.add(normQ);
    else if (q) seenQuestions.set(normQ, 1);

    if (a && seenAnswers.has(normA)) dupAnswers.add(normA);
    else if (a) seenAnswers.set(normA, 1);

    if (q && a && seenPairs.has(normPair)) dupPairs.add(normPair);
    else if (q && a) seenPairs.set(normPair, 1);

    // Lead-in counting
    if (q) {
      const li = getLeadIn(q);
      leadInCounts.set(li, (leadInCounts.get(li) ?? 0) + 1);
    }
  }

  // Clamp infinity (when all questions/answers are empty)
  if (!isFinite(minQLen)) minQLen = 0;
  if (!isFinite(minALen)) minALen = 0;

  // Lead-in duplicates = count of lead-ins that appear more than once
  let leadInDups = 0;
  for (const count of leadInCounts.values()) {
    if (count > 1) leadInDups++;
  }

  // Total answer word count for reading time
  const totalAWordsFinal = totalAWords;
  const answerReadingTimeMinutes = round2(totalAWordsFinal / READING_WPM);

  // ── Structured FAQ parity ─────────────────────────────────────────────────
  const schemaFaqs = extractSchemaFaqs(structuredData);
  const parity     = computeSchemaFaqParity(faqItems, schemaFaqs);

  return {
    faqCount:                    n,
    faqAvgAnswerWords:           n > 0 ? round2(totalAWords / n) : 0,
    faqDuplicateLeadIns:         leadInDups,
    questionCount:               n,
    answerCount:                 n,
    averageQuestionLength:       n > 0 ? round2(totalQLen / n) : 0,
    averageAnswerLength:         n > 0 ? round2(totalALen / n) : 0,
    averageQuestionWords:        n > 0 ? round2(totalQWords / n) : 0,
    averageAnswerWords:          n > 0 ? round2(totalAWords / n) : 0,
    longestQuestionLength:       maxQLen,
    longestAnswerLength:         maxALen,
    shortestQuestionLength:      minQLen,
    shortestAnswerLength:        minALen,
    duplicateQuestionCount:      dupQuestions.size,
    duplicateAnswerCount:        dupAnswers.size,
    duplicateFaqPairCount:       dupPairs.size,
    emptyQuestionCount,
    emptyAnswerCount,
    questionMarkCount,
    questionStartsWithWhWord:    startsWithWhWord,
    questionStartsWithHow:       startsWithHow,
    questionStartsWithWhat:      startsWithWhat,
    questionStartsWithWhere:     startsWithWhere,
    questionStartsWithWhen:      startsWithWhen,
    questionStartsWithWhy:       startsWithWhy,
    questionStartsWithCan:       startsWithCan,
    questionStartsWithIs:        startsWithIs,
    questionStartsWithAre:       startsWithAre,
    answerContainsList:          hasList,
    answerContainsInternalLink:  hasLink,
    answerContainsKeyword:       hasKw,
    answerContainsNumber:        hasNum,
    answerContainsLocation:      hasLoc,
    answerContainsCallToAction:  hasCta,
    answerReadingTimeMinutes,
    faqCompleteness:             round4(completeCount / n),
    structuredFaqParity:         parity.parity,
    structuredFaqQuestionCoverage: parity.questionCoverage,
    structuredFaqAnswerCoverage:   parity.answerCoverage,
    missingStructuredFaqCount:     parity.missingCount,
    extraStructuredFaqCount:       parity.extraCount,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const faqMetricsProvider = new FaqMetricsProvider();

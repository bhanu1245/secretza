/**
 * SEO Quality Engine — FAQ Quality Scorer
 *
 * Module ID: "faq-quality"
 *
 * Profile slot: CITY_SEO_V6_PROFILE["faq-quality"] — weight 15 (seo-profile-registry.ts).
 * This scorer maps to the final unimplemented CITY_SEO_V6_PROFILE slot. It remains
 * DORMANT until QualityEngineConfig wires it in (see seo-quality-engine.ts). The scorer
 * is not imported by any production execution path and does not alter
 * computeSeoQualityScore(), the SEO Dashboard, Review Studio, regeneration
 * decisions, or API contracts.
 *
 * Responsibility:
 *   Transform FAQMetricsProvider-owned QualityMetrics fields into a normalised
 *   0–100 ModuleResult evaluating FAQ quality: answer depth, question formatting,
 *   answer specificity, completeness, and question diversity.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not registered in any production scoring path.
 *
 * Metrics consumed (all FAQMetricsProvider-owned):
 *   faqCount, averageAnswerWords, questionMarkCount,
 *   answerContainsList, answerContainsNumber, answerContainsLocation, answerContainsCallToAction,
 *   faqCompleteness, faqDuplicateLeadIns,
 *   duplicateQuestionCount, emptyAnswerCount, emptyQuestionCount
 *
 * Metrics intentionally NOT consumed:
 *   answerContainsKeyword       → KeywordQualityScorer owns all keyword-placement signals
 *   answerContainsInternalLink  → InternalLinksQualityScorer owns all internal-link signals
 *   duplicateAnswerCount / duplicateFaqPairCount / uniqueFaqQuestionRatio / uniqueFaqAnswerRatio /
 *   faqSimilarity               → UniquenessQualityScorer owns cross-page FAQ uniqueness
 *                                  (its components use DuplicateContentMetricsProvider fields, not
 *                                  FAQMetricsProvider fields, so there is no field overlap; but the
 *                                  concern "are FAQ answers unique?" belongs there)
 *   faqAvgAnswerWords           → alias for averageAnswerWords; use the canonical name instead
 *   faqThinAnswers              → legacy field; NOT owned by FAQMetricsProvider (see seo-quality-types.ts)
 *   questionCount / answerCount → always equal to faqCount; no additional signal
 *   averageQuestionLength / averageAnswerLength → char-length equivalents of word metrics; redundant
 *   longestQuestionLength / longestAnswerLength / shortestQuestionLength / shortestAnswerLength →
 *     corner-case metrics; not directionally better or worse for quality
 *   duplicateAnswerCount        → cross-item duplication; covered by UniquenessQualityScorer concern
 *   questionStartsWithWhWord / How / What / Where / When / Why / Can / Is / Are →
 *     useful for diversity analysis but not better/worse signals; covered by questionDiversity via
 *     faqDuplicateLeadIns
 *   answerReadingTimeMinutes    → derivative of averageAnswerWords × faqCount; redundant with answerDepth
 *   structuredFaqParity / structuredFaqQuestionCoverage / structuredFaqAnswerCoverage /
 *   missingStructuredFaqCount / extraStructuredFaqCount →
 *     MetadataQualityScorer owns schema presence (faqSchemaExists). Parity without schema is
 *     indistinguishable from missing schema, causing double-penalisation. Excluded.
 *
 * Ownership boundary (no-double-scoring audit):
 *   ContentQualityScorer    — wordCount, paragraphCount, headingCount, contentDensity.
 *                             References faqCount only in its NOT-consumed list. No overlap.
 *   MetadataQualityScorer   — title/meta/canonical/OG/schema fields. No overlap.
 *   KeywordQualityScorer    — keyword density, placement, faqCoverage (keyword in FAQ).
 *                             answerContainsKeyword excluded from this scorer. No overlap.
 *   SemanticQualityScorer   — SemanticMetricsProvider fields. No overlap.
 *   UniquenessQualityScorer — DuplicateContentMetricsProvider fields (uniqueSentenceRatio,
 *                             uniqueFaqQuestionRatio, uniqueFaqAnswerRatio, faqSimilarity).
 *                             NOT the FAQMetricsProvider duplicateQuestionCount field.
 *                             IntraPage duplicateQuestionCount (within-page exact Q duplicate)
 *                             is a distinct signal owned by this scorer as a penalty.
 *   InternalLinksQualityScorer — InternalLinkMetricsProvider fields. No overlap.
 *
 * faqCount === 0 semantics (SKIP):
 *   When no FAQ items are present, FAQ quality cannot be meaningfully evaluated.
 *   Returning a SKIPPED result is honest: there is literally no quality to measure.
 *   The profile-level "weak-faq" quality rule (seo-quality-rules.ts, penalty=0) already
 *   surfaces FAQ absence as an advisory signal. SKIPPED modules contribute 0 to the
 *   aggregate score — the same numeric effect as scoring 0 — so no separate "scored
 *   failure" path is needed.
 *
 * Component model (weights sum to 100):
 *   Answer Depth        35 — averageAnswerWords via piecewise curve
 *   Question Quality    20 — questionMarkCount/faqCount ratio via piecewise curve
 *   Answer Specificity  25 — richness signals per FAQ via piecewise curve
 *   FAQ Completeness    10 — faqCompleteness (0–1) via piecewise curve
 *   Question Diversity  10 — faqDuplicateLeadIns/faqCount (inverse) via piecewise curve
 *
 * SKIP condition:
 *   faqCount === 0 (no FAQ data to evaluate)
 *
 * Penalty (applied to raw score before cap):
 *   duplicateQuestionCount ≥ 2 → −5 pts  (HIGH_DUPLICATE_QUESTIONS)
 *   (within-page exact question duplication; distinct from cross-page FAQ uniqueness)
 *
 * Performance: O(1) — consumes pre-computed metrics only. No parsing, no DB, no AI.
 */

import type {
  ScorerModule,
  ModuleContext,
  ModuleResult,
} from "@/lib/seo-quality-types";
import {
  ModuleScoreBuilder,
  buildSkippedModuleResult,
} from "@/lib/seo-module-score-builder";
import { piecewiseLinear, safeNumber } from "@/lib/seo-scoring-core";

// ─── Identity ──────────────────────────────────────────────────────────────────────

/** Module ID matching CITY_SEO_V6_PROFILE slot "faq-quality". */
export const FAQ_QUALITY_MODULE_ID = "faq-quality";

// ─── Penalty thresholds and amounts ───────────────────────────────────────────────

/** duplicateQuestionCount at or above which HIGH_DUPLICATE_QUESTIONS penalty fires. */
const HIGH_DUPLICATE_QUESTIONS_THRESHOLD = 2;

/** Points deducted when duplicateQuestionCount ≥ HIGH_DUPLICATE_QUESTIONS_THRESHOLD. */
const HIGH_DUPLICATE_QUESTIONS_PENALTY = 5;

// ─── Recommendation thresholds ────────────────────────────────────────────────────

/** averageAnswerWords below which FQ_THIN_ANSWERS fires. */
const THIN_ANSWER_WORDS_THRESHOLD = 30;

/** questionMarkRatio below which FQ_MISSING_QUESTION_MARKS fires. */
const QUESTION_MARK_RATIO_THRESHOLD = 0.7;

/** richnessSumPerFaq below which FQ_LOW_ANSWER_SPECIFICITY fires. */
const LOW_SPECIFICITY_THRESHOLD = 0.5;

/** faqDuplicateLeadIns at or above which FQ_DUPLICATE_LEAD_INS fires. */
const DUPLICATE_LEAD_IN_THRESHOLD = 2;

// ─── Component weights (sum to 100) ───────────────────────────────────────────────

const W_ANSWER_DEPTH       = 35;
const W_QUESTION_QUALITY   = 20;
const W_ANSWER_SPECIFICITY = 25;
const W_FAQ_COMPLETENESS   = 10;
const W_QUESTION_DIVERSITY = 10;
// Sum: 100

// ─── Scoring curves ────────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints.
// piecewiseLinear() interpolates linearly, left-clamps, and right-clamps.

/**
 * averageAnswerWords (integer ≥ 0) → answer depth score [0–100].
 * Sub-30 answers are thin; 40–60 is acceptable; 80–100 words is excellent.
 * Anchored to typical SEO FAQ content expectations.
 */
const ANSWER_DEPTH_CURVE: [number, number][] = [
  [0,    0],
  [20,  15],
  [40,  55],
  [60,  80],
  [80,  92],
  [100, 100],
];

/**
 * questionMarkRatio = questionMarkCount / faqCount (0–1) → question quality score [0–100].
 * A ratio of 1.0 means every question ends with a proper question mark.
 */
const QUESTION_QUALITY_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  35],
  [0.8,  75],
  [1.0, 100],
];

/**
 * richnessSumPerFaq = (answerContainsList + answerContainsNumber +
 *                      answerContainsLocation + answerContainsCallToAction) / faqCount.
 * Measures average number of specificity signals per answer.
 * Baseline of 10: any non-empty FAQ answer is better than absence.
 * 2.5+ signals per answer is excellent.
 */
const ANSWER_SPECIFICITY_CURVE: [number, number][] = [
  [0.0,  10],
  [0.5,  35],
  [1.0,  60],
  [1.5,  80],
  [2.5, 100],
];

/**
 * faqCompleteness (0–1, fraction of items with both Q and A) → score [0–100].
 * 1.0 means every FAQ item has both a question and an answer.
 */
const FAQ_COMPLETENESS_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  25],
  [0.8,  65],
  [1.0, 100],
];

/**
 * dupLeadInRatio = faqDuplicateLeadIns / faqCount (0–1) → question diversity score [0–100].
 * Inverse signal: lower ratio = more diverse question openings = better.
 * A ratio of 0 means every question has a unique 3-word lead-in.
 */
const QUESTION_DIVERSITY_CURVE: [number, number][] = [
  [0.0, 100],
  [0.2,  80],
  [0.4,  50],
  [0.6,  25],
  [1.0,   0],
];

// ─── Exported scoring helpers (pure — testable independently) ──────────────────────

/**
 * Score the average depth of FAQ answers.
 *
 * @param averageAnswerWords  average word count of all non-empty answers (≥ 0).
 */
export function scoreAnswerDepth(averageAnswerWords: number): number {
  return piecewiseLinear(safeNumber(averageAnswerWords), ANSWER_DEPTH_CURVE);
}

/**
 * Score the formatting quality of FAQ questions.
 *
 * @param questionMarkCount  number of questions ending with '?'.
 * @param faqCount           total FAQ items. Returns 0 when faqCount === 0
 *                           (caller should SKIP first).
 */
export function scoreQuestionQuality(
  questionMarkCount: number,
  faqCount: number,
): number {
  const safeTotal = Math.max(0, safeNumber(faqCount));
  if (safeTotal === 0) return 0;
  const ratio = Math.min(1, Math.max(0, safeNumber(questionMarkCount) / safeTotal));
  return piecewiseLinear(ratio, QUESTION_QUALITY_CURVE);
}

/**
 * Score the specificity and richness of FAQ answers.
 *
 * @param answerContainsList          count of FAQs whose answer contains a list.
 * @param answerContainsNumber        count of FAQs whose answer contains a digit/number.
 * @param answerContainsLocation      count of FAQs whose answer references a location.
 * @param answerContainsCallToAction  count of FAQs whose answer contains a CTA phrase.
 * @param faqCount                    total FAQ items. Returns baseline when faqCount === 0.
 */
export function scoreAnswerSpecificity(
  answerContainsList: number,
  answerContainsNumber: number,
  answerContainsLocation: number,
  answerContainsCallToAction: number,
  faqCount: number,
): number {
  const safeTotal = Math.max(0, safeNumber(faqCount));
  if (safeTotal === 0) return piecewiseLinear(0, ANSWER_SPECIFICITY_CURVE);
  const richnessSumPerFaq =
    (safeNumber(answerContainsList) +
      safeNumber(answerContainsNumber) +
      safeNumber(answerContainsLocation) +
      safeNumber(answerContainsCallToAction)) /
    safeTotal;
  return piecewiseLinear(Math.max(0, richnessSumPerFaq), ANSWER_SPECIFICITY_CURVE);
}

/**
 * Score FAQ item completeness (fraction of items with both Q and A).
 *
 * @param faqCompleteness  fraction [0–1] already computed by FAQMetricsProvider.
 */
export function scoreFaqCompleteness(faqCompleteness: number): number {
  return piecewiseLinear(
    Math.min(1, Math.max(0, safeNumber(faqCompleteness))),
    FAQ_COMPLETENESS_CURVE,
  );
}

/**
 * Score question diversity (inverse of duplicate lead-in ratio).
 *
 * @param faqDuplicateLeadIns  count of distinct lead-in phrases that appear > 1 time.
 * @param faqCount             total FAQ items. Returns 100 (neutral) when faqCount === 0.
 */
export function scoreQuestionDiversity(
  faqDuplicateLeadIns: number,
  faqCount: number,
): number {
  const safeTotal = Math.max(0, safeNumber(faqCount));
  if (safeTotal === 0) return 100;
  const ratio = Math.min(1, Math.max(0, safeNumber(faqDuplicateLeadIns) / safeTotal));
  return piecewiseLinear(ratio, QUESTION_DIVERSITY_CURVE);
}

// ─── Recommendation builder ────────────────────────────────────────────────────────

interface RecommendationDef {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field: string | null;
}

function buildRecommendations(
  faqCount: number,
  averageAnswerWords: number,
  questionMarkRatio: number,
  richnessSumPerFaq: number,
  emptyAnswerCount: number,
  emptyQuestionCount: number,
  faqDuplicateLeadIns: number,
  duplicateQuestionCount: number,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  if (averageAnswerWords < THIN_ANSWER_WORDS_THRESHOLD) {
    recs.push({
      code: "FQ_THIN_ANSWERS",
      severity: averageAnswerWords < 15 ? "error" : "warning",
      message:
        `Average FAQ answer length is ${Math.round(averageAnswerWords)} words ` +
        `(recommended minimum: ${THIN_ANSWER_WORDS_THRESHOLD}). ` +
        "Expand answers with specific details, examples, and context to improve helpfulness.",
      field: "faqItems",
    });
  }

  if (questionMarkRatio < QUESTION_MARK_RATIO_THRESHOLD) {
    recs.push({
      code: "FQ_MISSING_QUESTION_MARKS",
      severity: "warning",
      message:
        `${Math.round(questionMarkRatio * 100)}% of FAQ questions end with a question mark ` +
        `(threshold: ${Math.round(QUESTION_MARK_RATIO_THRESHOLD * 100)}%). ` +
        "Ensure all questions are properly formatted with a trailing '?'.",
      field: "faqItems",
    });
  }

  if (richnessSumPerFaq < LOW_SPECIFICITY_THRESHOLD) {
    recs.push({
      code: "FQ_LOW_ANSWER_SPECIFICITY",
      severity: "info",
      message:
        "FAQ answers lack specific details. " +
        "Include lists, numbers, local references, or calls to action to add specificity and value.",
      field: "faqItems",
    });
  }

  if (emptyAnswerCount > 0 || emptyQuestionCount > 0) {
    recs.push({
      code: "FQ_INCOMPLETE_FAQ_ITEMS",
      severity: "error",
      message:
        `${emptyQuestionCount} empty question${emptyQuestionCount === 1 ? "" : "s"} and ` +
        `${emptyAnswerCount} empty answer${emptyAnswerCount === 1 ? "" : "s"} found. ` +
        "All FAQ items must have both a non-empty question and a non-empty answer.",
      field: "faqItems",
    });
  }

  if (faqDuplicateLeadIns >= DUPLICATE_LEAD_IN_THRESHOLD) {
    recs.push({
      code: "FQ_DUPLICATE_LEAD_INS",
      severity: "info",
      message:
        `${faqDuplicateLeadIns} FAQ question${faqDuplicateLeadIns === 1 ? "" : "s"} share ` +
        "the same opening phrase. " +
        "Vary question openings to avoid template-style repetition and improve engagement.",
      field: "faqItems",
    });
  }

  if (duplicateQuestionCount >= HIGH_DUPLICATE_QUESTIONS_THRESHOLD) {
    recs.push({
      code: "FQ_DUPLICATE_QUESTIONS",
      severity: "error",
      message:
        `${duplicateQuestionCount} duplicate question${duplicateQuestionCount === 1 ? "" : "s"} detected. ` +
        "Remove or rewrite duplicate questions to avoid content redundancy.",
      field: "faqItems",
    });
  }

  return recs;
}

// ─── Scorer module ──────────────────────────────────────────────────────────────────

export class FAQQualityScorer implements ScorerModule {
  readonly id          = FAQ_QUALITY_MODULE_ID;
  readonly name        = "FAQ Quality Scorer";
  readonly description =
    "Evaluates the quality of FAQ content: answer depth, question formatting, " +
    "answer specificity (lists, numbers, locations, CTAs), FAQ completeness, " +
    "and question diversity (lead-in variety).";
  readonly version     = "1.0.0";
  readonly priority    = 450;
  readonly requiredMetrics = [
    // FAQMetricsProvider-owned (scoring inputs)
    "faqCount",
    "averageAnswerWords",
    "questionMarkCount",
    "answerContainsList",
    "answerContainsNumber",
    "answerContainsLocation",
    "answerContainsCallToAction",
    "faqCompleteness",
    "faqDuplicateLeadIns",
    "duplicateQuestionCount",
    "emptyAnswerCount",
    "emptyQuestionCount",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    if (!metrics) {
      return buildSkippedModuleResult(this.id, "No metrics available for faq-quality scoring.");
    }

    // ── SKIP guard ─────────────────────────────────────────────────────────────
    const faqCount = safeNumber(metrics.faqCount);

    if (faqCount === 0) {
      return buildSkippedModuleResult(
        this.id,
        "No FAQ items found on this page. FAQ quality cannot be evaluated without content.",
      );
    }

    // ── FAQMetricsProvider-owned metrics ──────────────────────────────────────
    const averageAnswerWords       = safeNumber(metrics.averageAnswerWords,       0);
    const questionMarkCount        = safeNumber(metrics.questionMarkCount,         0);
    const answerContainsList       = safeNumber(metrics.answerContainsList,        0);
    const answerContainsNumber     = safeNumber(metrics.answerContainsNumber,      0);
    const answerContainsLocation   = safeNumber(metrics.answerContainsLocation,    0);
    const answerContainsCallToAction = safeNumber(metrics.answerContainsCallToAction, 0);
    const faqCompleteness          = safeNumber(metrics.faqCompleteness,           0);
    const faqDuplicateLeadIns      = safeNumber(metrics.faqDuplicateLeadIns,       0);
    const duplicateQuestionCount   = safeNumber(metrics.duplicateQuestionCount,    0);
    const emptyAnswerCount         = safeNumber(metrics.emptyAnswerCount,          0);
    const emptyQuestionCount       = safeNumber(metrics.emptyQuestionCount,        0);

    // ── Component scores ───────────────────────────────────────────────────────
    const answerDepthScore    = scoreAnswerDepth(averageAnswerWords);
    const questionQualScore   = scoreQuestionQuality(questionMarkCount, faqCount);
    const answerSpecScore     = scoreAnswerSpecificity(
      answerContainsList, answerContainsNumber, answerContainsLocation,
      answerContainsCallToAction, faqCount,
    );
    const completenessScore   = scoreFaqCompleteness(faqCompleteness);
    const diversityScore      = scoreQuestionDiversity(faqDuplicateLeadIns, faqCount);

    // ── Build result ──────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("answerDepth",       answerDepthScore,  W_ANSWER_DEPTH)
      .addContribution("questionQuality",   questionQualScore, W_QUESTION_QUALITY)
      .addContribution("answerSpecificity", answerSpecScore,   W_ANSWER_SPECIFICITY)
      .addContribution("faqCompleteness",   completenessScore, W_FAQ_COMPLETENESS)
      .addContribution("questionDiversity", diversityScore,    W_QUESTION_DIVERSITY)
      .setExecutionMs(Date.now() - start);

    // ── Penalty ───────────────────────────────────────────────────────────────
    if (duplicateQuestionCount >= HIGH_DUPLICATE_QUESTIONS_THRESHOLD) {
      builder.addPenalty(
        "high-duplicate-questions",
        `${duplicateQuestionCount} duplicate question${duplicateQuestionCount === 1 ? "" : "s"} ` +
          "found within the FAQ section.",
        HIGH_DUPLICATE_QUESTIONS_PENALTY,
      );
    }

    // ── Recommendations ───────────────────────────────────────────────────────
    const questionMarkRatio = questionMarkCount / faqCount;
    const richnessSumPerFaq =
      (answerContainsList + answerContainsNumber + answerContainsLocation + answerContainsCallToAction) /
      faqCount;
    const recs = buildRecommendations(
      faqCount,
      averageAnswerWords,
      questionMarkRatio,
      richnessSumPerFaq,
      emptyAnswerCount,
      emptyQuestionCount,
      faqDuplicateLeadIns,
      duplicateQuestionCount,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const faqQualityScorer = new FAQQualityScorer();

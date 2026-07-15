/**
 * SEO Quality Engine — Uniqueness Quality Scorer
 *
 * Module ID: "uniqueness"
 *
 * Profile slot: CITY_SEO_V6_PROFILE["uniqueness"] — weight 25 (seo-profile-registry.ts).
 * This scorer maps cleanly to the "uniqueness" profile slot. It remains DORMANT
 * until QualityEngineConfig wires it in (see seo-quality-engine.ts). The scorer
 * is not imported by any production execution path and does not alter
 * computeSeoQualityScore(), the SEO Dashboard, Review Studio, regeneration
 * decisions, or API contracts.
 *
 * Responsibility:
 *   Transform DuplicateContentMetricsProvider-owned QualityMetrics fields into a
 *   normalised 0–100 ModuleResult evaluating intra-document content originality:
 *   sentence uniqueness, template reuse resistance, structural diversity, FAQ
 *   originality, and boilerplate guard.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not registered in any production scoring path.
 *
 * Metrics consumed (all DuplicateContentMetricsProvider-owned):
 *   uniqueSentenceRatio, templateReuseRatio,
 *   uniqueParagraphRatio, introSectionSimilarity,
 *   uniqueFaqQuestionRatio, uniqueFaqAnswerRatio, faqSimilarity,
 *   boilerplateParagraphCount
 *
 * Context guards (ContentMetricsProvider-owned, read-only):
 *   wordCountIntro, faqCount, paragraphCount
 *
 * Metrics intentionally NOT consumed:
 *   duplicateSentenceCount / duplicateParagraphCount — integer counts; no total
 *     count counterpart available; captured indirectly via uniqueSentenceRatio
 *   uniqueHeadingRatio / headingSimilarity — low signal weight for SEO uniqueness;
 *     not enough heading data to merit a dedicated component
 *   selfSimilarityScore / duplicateTokenRatio — redundant with sentenceOriginality
 *     and templateResistance; adding would dilute rather than enrich the model
 *   repeatedBigramCount / repeatedTrigramCount / repeatedFourGramCount — covered
 *     by templateReuseRatio at the sentence level
 *   duplicateFaqQuestionCount / duplicateFaqAnswerCount — covered by ratio metrics
 *   largestRepeatedBlockLength — corner-case metric; covered by templateReuseRatio
 *   aiPhraseRatio / templateSentenceRatio — AIPatternMetricsProvider-owned;
 *     reserved for a future AI Pattern scorer
 *
 * No-double-scoring audit (vs existing scorers):
 *   ContentQualityScorer  — structural length and structure metrics (wordCount,
 *     headingCount, faqCount, paragraphCount as structure, imageCount). Not
 *     uniqueness. No overlap.
 *   MetadataQualityScorer — title/metaDescription length and canonical format.
 *     Not uniqueness. No overlap.
 *   KeywordQualityScorer  — keyword placement/density/distribution. Not
 *     uniqueness. No overlap.
 *   SemanticQualityScorer — semantic cluster concepts and diversity. Uses
 *     SemanticMetricsProvider-owned fields. No overlap.
 *
 * Component model (weights sum to 100):
 *   Sentence Originality  35 — uniqueSentenceRatio via piecewise curve
 *   Template Resistance   25 — (1 − templateReuseRatio) via piecewise curve
 *   Structural Diversity  20 — blend of uniqueParagraphRatio and (1 − introSectionSimilarity)
 *   FAQ Originality       15 — blend of uniqueFaqQuestion/AnswerRatio + (1 − faqSimilarity);
 *                               returns 100 (neutral) when faqCount === 0
 *   Boilerplate Guard      5 — (1 − boilerplateParagraphRate) via piecewise curve
 *
 * Structural Diversity sub-weights: paraUniqueness(65) + sectionFreshness(35)
 * FAQ Originality sub-weights: question(30) + answer(50) + diversity(20)
 *
 * SKIP condition:
 *   wordCountIntro === 0 && faqCount === 0 (no content to measure)
 *
 * Penalties (applied to final score):
 *   templateReuseRatio > 0.30 (30%) → −10 pts   (HIGH_TEMPLATE_REUSE)
 *   boilerplateParagraphCount / paragraphCount > 0.50 → −5 pts  (HIGH_BOILERPLATE)
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
import { piecewiseLinear, safeNumber, weightedAverage } from "@/lib/seo-scoring-core";

// ─── Identity ──────────────────────────────────────────────────────────────────────

/** Module ID matching CITY_SEO_V6_PROFILE slot "uniqueness". */
export const UNIQUENESS_QUALITY_MODULE_ID = "uniqueness";

// ─── Penalty thresholds and amounts ───────────────────────────────────────────────

/** templateReuseRatio above which HIGH_TEMPLATE_REUSE penalty is applied. */
const HIGH_TEMPLATE_REUSE_THRESHOLD = 0.3;

/** Points deducted for templateReuseRatio exceeding HIGH_TEMPLATE_REUSE_THRESHOLD. */
const HIGH_TEMPLATE_REUSE_PENALTY = 10;

/** boilerplateParagraphCount / paragraphCount above which HIGH_BOILERPLATE penalty fires. */
const HIGH_BOILERPLATE_THRESHOLD = 0.5;

/** Points deducted for boilerplate paragraph rate exceeding HIGH_BOILERPLATE_THRESHOLD. */
const HIGH_BOILERPLATE_PENALTY = 5;

// ─── Component weights (sum to 100) ───────────────────────────────────────────────

const W_SENTENCE_ORIGINALITY = 35;
const W_TEMPLATE_RESISTANCE  = 25;
const W_STRUCTURAL_DIVERSITY = 20;
const W_FAQ_ORIGINALITY      = 15;
const W_BOILERPLATE_GUARD    =  5;
// Sum: 100

// ─── Structural diversity sub-weights (sum to 100) ────────────────────────────────

const SW_PARA_UNIQUENESS   = 65;
const SW_SECTION_FRESHNESS = 35;
// Sum: 100

// ─── FAQ originality sub-weights (sum to 100) ─────────────────────────────────────

const SW_FAQ_QUESTION  = 30;
const SW_FAQ_ANSWER    = 50;
const SW_FAQ_DIVERSITY = 20;
// Sum: 100

// ─── Scoring curves ────────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints.
// piecewiseLinear() interpolates linearly between breakpoints, left-clamps
// below the lowest x, and right-clamps above the highest x.

/**
 * uniqueSentenceRatio (0–1) → sentence originality score [0–100].
 * A ratio of 1.0 means all sentences are unique.
 * Deteriorates steeply below 0.85 to penalise significant sentence repetition.
 */
const SENTENCE_UNIQUENESS_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  20],
  [0.7,  55],
  [0.85, 80],
  [0.95, 95],
  [1.0, 100],
];

/**
 * (1 − templateReuseRatio) → template resistance score [0–100].
 * templateReuseRatio = fraction of total sentences that are duplicate occurrences.
 * 0 reuse → resistance = 1.0 → score 100 (best); 1.0 reuse → resistance = 0 → score 0.
 */
const TEMPLATE_RESISTANCE_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  20],
  [0.7,  60],
  [0.85, 85],
  [1.0, 100],
];

/**
 * uniqueParagraphRatio (0–1) → paragraph uniqueness sub-score [0–100].
 */
const PARA_UNIQUENESS_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  25],
  [0.75, 65],
  [0.9,  90],
  [1.0, 100],
];

/**
 * (1 − introSectionSimilarity) → section freshness sub-score [0–100].
 * introSectionSimilarity is the average pairwise Jaccard similarity between
 * intro paragraphs. Low similarity (high freshness) indicates diverse paragraphs.
 */
const SECTION_FRESHNESS_CURVE: [number, number][] = [
  [0.0,   0],
  [0.3,  40],
  [0.5,  65],
  [0.75, 90],
  [1.0, 100],
];

/**
 * uniqueFaqQuestionRatio / uniqueFaqAnswerRatio (0–1) → FAQ uniqueness sub-score [0–100].
 * Shared curve for both question and answer uniqueness ratios.
 */
const FAQ_UNIQUENESS_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  30],
  [0.75, 65],
  [0.9,  88],
  [1.0, 100],
];

/**
 * (1 − faqSimilarity) → FAQ diversity sub-score [0–100].
 * faqSimilarity is the average pairwise Jaccard similarity between FAQ answers.
 * Low similarity means FAQ answers are topically diverse.
 */
const FAQ_DIVERSITY_CURVE: [number, number][] = [
  [0.0,   0],
  [0.3,  40],
  [0.5,  65],
  [0.75, 90],
  [1.0, 100],
];

/**
 * (1 − boilerplateParagraphRate) → boilerplate guard score [0–100].
 * boilerplateParagraphRate = boilerplateParagraphCount / paragraphCount.
 * A rate of 0 (no boilerplate) maps to 100; a rate of 1 (all boilerplate) maps to 0.
 */
const BOILERPLATE_FREE_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  40],
  [0.75, 70],
  [0.9,  90],
  [1.0, 100],
];

// ─── Exported scoring helpers (pure — testable independently) ──────────────────────

/**
 * Score sentence-level content originality.
 *
 * @param uniqueSentenceRatio  fraction 0–1 of unique sentences across all document
 *                             sentences (DuplicateContentMetricsProvider).
 */
export function scoreSentenceOriginality(uniqueSentenceRatio: number): number {
  return piecewiseLinear(safeNumber(uniqueSentenceRatio), SENTENCE_UNIQUENESS_CURVE);
}

/**
 * Score resistance to template and boilerplate reuse at the sentence level.
 *
 * @param templateReuseRatio  fraction 0–1 of total sentences that are duplicate
 *                            occurrences (DuplicateContentMetricsProvider).
 *                            0 = no reuse (best); 1 = fully templated (worst).
 */
export function scoreTemplateResistance(templateReuseRatio: number): number {
  const resistance = 1 - safeNumber(templateReuseRatio);
  return piecewiseLinear(resistance, TEMPLATE_RESISTANCE_CURVE);
}

/**
 * Score structural diversity of the introduction section.
 * Blends paragraph-level uniqueness with cross-paragraph freshness.
 *
 * @param uniqueParagraphRatio    fraction 0–1 of unique intro paragraphs.
 * @param introSectionSimilarity  avg pairwise Jaccard between intro paragraphs (0–1).
 *                                Low similarity = diverse paragraphs = high freshness.
 */
export function scoreStructuralDiversity(
  uniqueParagraphRatio: number,
  introSectionSimilarity: number,
): number {
  const paraScore = piecewiseLinear(
    safeNumber(uniqueParagraphRatio),
    PARA_UNIQUENESS_CURVE,
  );
  const freshness = 1 - safeNumber(introSectionSimilarity);
  const freshnessScore = piecewiseLinear(freshness, SECTION_FRESHNESS_CURVE);
  return weightedAverage([
    { value: paraScore,      weight: SW_PARA_UNIQUENESS   },
    { value: freshnessScore, weight: SW_SECTION_FRESHNESS },
  ]);
}

/**
 * Score FAQ content originality.
 * Blends question uniqueness, answer uniqueness, and answer-set diversity.
 * Only called when faqCount > 0.
 *
 * @param uniqueFaqQuestionRatio  fraction 0–1 of unique FAQ questions.
 * @param uniqueFaqAnswerRatio    fraction 0–1 of unique FAQ answers.
 * @param faqSimilarity           avg pairwise Jaccard between FAQ answers (0–1).
 *                                Low value = diverse answers = high quality.
 */
export function scoreFaqOriginality(
  uniqueFaqQuestionRatio: number,
  uniqueFaqAnswerRatio: number,
  faqSimilarity: number,
): number {
  const questionScore = piecewiseLinear(
    safeNumber(uniqueFaqQuestionRatio),
    FAQ_UNIQUENESS_CURVE,
  );
  const answerScore = piecewiseLinear(
    safeNumber(uniqueFaqAnswerRatio),
    FAQ_UNIQUENESS_CURVE,
  );
  const diversity = 1 - safeNumber(faqSimilarity);
  const diversityScore = piecewiseLinear(diversity, FAQ_DIVERSITY_CURVE);
  return weightedAverage([
    { value: questionScore,  weight: SW_FAQ_QUESTION  },
    { value: answerScore,    weight: SW_FAQ_ANSWER    },
    { value: diversityScore, weight: SW_FAQ_DIVERSITY },
  ]);
}

/**
 * Score the absence of boilerplate paragraphs.
 *
 * @param boilerplateParagraphCount  count of paragraphs matching boilerplate patterns.
 * @param paragraphCount             total intro paragraph count (context guard).
 *                                   Returns 100 when paragraphCount === 0.
 */
export function scoreBoilerplateGuard(
  boilerplateParagraphCount: number,
  paragraphCount: number,
): number {
  const safeParaCount = Math.max(0, safeNumber(paragraphCount));
  if (safeParaCount === 0) return 100;
  const bpRate    = Math.min(1, Math.max(0, safeNumber(boilerplateParagraphCount) / safeParaCount));
  const bpFreeRate = 1 - bpRate;
  return piecewiseLinear(bpFreeRate, BOILERPLATE_FREE_CURVE);
}

// ─── Recommendation helpers ────────────────────────────────────────────────────────

interface RecommendationDef {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field: string | null;
}

function buildRecommendations(
  uniqueSentenceRatio: number,
  templateReuseRatio: number,
  introSectionSimilarity: number,
  paragraphCount: number,
  faqCount: number,
  uniqueFaqQuestionRatio: number,
  uniqueFaqAnswerRatio: number,
  faqSimilarity: number,
  boilerplateParagraphCount: number,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  if (uniqueSentenceRatio < 0.8) {
    recs.push({
      code: "UQ_DUPLICATE_SENTENCES",
      severity: uniqueSentenceRatio < 0.6 ? "error" : "warning",
      message:
        `Only ${Math.round(uniqueSentenceRatio * 100)}% of sentences are unique. ` +
        "Review and rewrite repeated or near-identical sentences to improve content originality.",
      field: "introContent",
    });
  }

  if (templateReuseRatio > HIGH_TEMPLATE_REUSE_THRESHOLD) {
    recs.push({
      code: "UQ_HIGH_TEMPLATE_REUSE",
      severity: "error",
      message:
        `${Math.round(templateReuseRatio * 100)}% of sentences are duplicated occurrences ` +
        `(threshold: ${HIGH_TEMPLATE_REUSE_THRESHOLD * 100}%). ` +
        "Replace templated or copy-pasted sentences with original phrasing.",
      field: "introContent",
    });
  }

  if (paragraphCount >= 2 && introSectionSimilarity > 0.6) {
    recs.push({
      code: "UQ_INTRO_SECTIONS_SIMILAR",
      severity: "warning",
      message:
        "Introduction paragraphs share too much vocabulary " +
        `(similarity: ${Math.round(introSectionSimilarity * 100)}%). ` +
        "Vary phrasing and vocabulary across paragraphs for richer, more original content.",
      field: "introContent",
    });
  }

  if (faqCount > 0 && faqSimilarity > 0.5) {
    recs.push({
      code: "UQ_FAQ_ANSWERS_SIMILAR",
      severity: "warning",
      message:
        `FAQ answers share too much vocabulary (similarity: ${Math.round(faqSimilarity * 100)}%). ` +
        "Write each FAQ answer with distinct phrasing and topic-specific details.",
      field: "faqItems",
    });
  }

  if (faqCount > 0 && uniqueFaqAnswerRatio < 0.8) {
    recs.push({
      code: "UQ_DUPLICATE_FAQ_ANSWERS",
      severity: "warning",
      message:
        `Only ${Math.round(uniqueFaqAnswerRatio * 100)}% of FAQ answers are unique. ` +
        "Remove or rewrite duplicate FAQ answers to provide genuine value for each question.",
      field: "faqItems",
    });
  }

  if (faqCount > 0 && uniqueFaqQuestionRatio < 0.9) {
    recs.push({
      code: "UQ_DUPLICATE_FAQ_QUESTIONS",
      severity: "warning",
      message:
        `Only ${Math.round(uniqueFaqQuestionRatio * 100)}% of FAQ questions are unique. ` +
        "Consolidate or rewrite duplicate FAQ questions.",
      field: "faqItems",
    });
  }

  if (boilerplateParagraphCount > 0) {
    recs.push({
      code: "UQ_BOILERPLATE_DETECTED",
      severity: boilerplateParagraphCount >= 3 ? "error" : "info",
      message:
        `${boilerplateParagraphCount} paragraph${boilerplateParagraphCount === 1 ? "" : "s"} ` +
        "contain common boilerplate phrases. Replace with original, specific content " +
        "that describes the actual service or location.",
      field: "introContent",
    });
  }

  return recs;
}

// ─── Scorer module ──────────────────────────────────────────────────────────────────

export class UniquenessQualityScorer implements ScorerModule {
  readonly id          = UNIQUENESS_QUALITY_MODULE_ID;
  readonly name        = "Uniqueness Quality Scorer";
  readonly description =
    "Evaluates intra-document content originality: sentence uniqueness, " +
    "resistance to template and boilerplate reuse, structural paragraph diversity, " +
    "FAQ answer originality, and boilerplate paragraph detection.";
  readonly version     = "1.0.0";
  readonly priority    = 300;
  readonly requiredMetrics = [
    // DuplicateContentMetricsProvider-owned
    "uniqueSentenceRatio",
    "templateReuseRatio",
    "uniqueParagraphRatio",
    "introSectionSimilarity",
    "uniqueFaqQuestionRatio",
    "uniqueFaqAnswerRatio",
    "faqSimilarity",
    "boilerplateParagraphCount",
    // ContentMetricsProvider-owned (context guards)
    "wordCountIntro",
    "faqCount",
    "paragraphCount",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    if (!metrics) {
      return buildSkippedModuleResult(this.id, "No metrics available for uniqueness scoring.");
    }

    // ── Context guards (ContentMetricsProvider-owned) ──────────────────────────
    const wordCountIntro = safeNumber(metrics.wordCountIntro);
    const faqCount       = safeNumber(metrics.faqCount);
    const paragraphCount = safeNumber(metrics.paragraphCount);

    // SKIP: no content to measure
    if (wordCountIntro === 0 && faqCount === 0) {
      return buildSkippedModuleResult(
        this.id,
        "Uniqueness scoring requires at least some body content or FAQ items.",
      );
    }

    // ── DuplicateContentMetricsProvider-owned metrics ──────────────────────────
    const uniqueSentenceRatio    = safeNumber(metrics.uniqueSentenceRatio,    1);
    const templateReuseRatio     = safeNumber(metrics.templateReuseRatio,     0);
    const uniqueParagraphRatio   = safeNumber(metrics.uniqueParagraphRatio,   1);
    const introSectionSimilarity = safeNumber(metrics.introSectionSimilarity, 0);
    const uniqueFaqQuestionRatio = safeNumber(metrics.uniqueFaqQuestionRatio, 1);
    const uniqueFaqAnswerRatio   = safeNumber(metrics.uniqueFaqAnswerRatio,   1);
    const faqSimilarity          = safeNumber(metrics.faqSimilarity,          0);
    const boilerplateParagraphCount = safeNumber(metrics.boilerplateParagraphCount, 0);

    // ── Component scores ───────────────────────────────────────────────────────
    const sentenceScore  = scoreSentenceOriginality(uniqueSentenceRatio);
    const templateScore  = scoreTemplateResistance(templateReuseRatio);

    // Structural diversity: neutral (100) when fewer than 2 paragraphs
    // (not enough paragraphs to measure inter-paragraph similarity)
    const structuralScore = paragraphCount < 2
      ? 100
      : scoreStructuralDiversity(uniqueParagraphRatio, introSectionSimilarity);

    // FAQ originality: neutral (100) when no FAQs — absence is not a quality failure
    const faqScore = faqCount === 0
      ? 100
      : scoreFaqOriginality(uniqueFaqQuestionRatio, uniqueFaqAnswerRatio, faqSimilarity);

    const boilerplateScore = scoreBoilerplateGuard(boilerplateParagraphCount, paragraphCount);

    // ── Build result ──────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("sentenceOriginality", sentenceScore,    W_SENTENCE_ORIGINALITY)
      .addContribution("templateResistance",  templateScore,    W_TEMPLATE_RESISTANCE)
      .addContribution("structuralDiversity", structuralScore,  W_STRUCTURAL_DIVERSITY)
      .addContribution("faqOriginality",      faqScore,         W_FAQ_ORIGINALITY)
      .addContribution("boilerplateGuard",    boilerplateScore, W_BOILERPLATE_GUARD)
      .setExecutionMs(Date.now() - start);

    // ── Penalties ─────────────────────────────────────────────────────────────
    if (templateReuseRatio > HIGH_TEMPLATE_REUSE_THRESHOLD) {
      builder.addPenalty(
        "high-template-reuse",
        `Template reuse ratio ${(templateReuseRatio * 100).toFixed(1)}% ` +
          `exceeds the ${HIGH_TEMPLATE_REUSE_THRESHOLD * 100}% threshold.`,
        HIGH_TEMPLATE_REUSE_PENALTY,
      );
    }

    const bpRate = paragraphCount > 0
      ? boilerplateParagraphCount / paragraphCount
      : 0;
    if (bpRate > HIGH_BOILERPLATE_THRESHOLD) {
      builder.addPenalty(
        "high-boilerplate-density",
        `Boilerplate paragraph rate ${(bpRate * 100).toFixed(1)}% ` +
          `exceeds the ${HIGH_BOILERPLATE_THRESHOLD * 100}% threshold.`,
        HIGH_BOILERPLATE_PENALTY,
      );
    }

    // ── Recommendations ───────────────────────────────────────────────────────
    const recs = buildRecommendations(
      uniqueSentenceRatio,
      templateReuseRatio,
      introSectionSimilarity,
      paragraphCount,
      faqCount,
      uniqueFaqQuestionRatio,
      uniqueFaqAnswerRatio,
      faqSimilarity,
      boilerplateParagraphCount,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const uniquenessQualityScorer = new UniquenessQualityScorer();

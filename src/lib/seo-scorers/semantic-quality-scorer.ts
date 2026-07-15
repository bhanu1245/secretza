/**
 * SEO Quality Engine — Semantic Quality Scorer
 *
 * Module ID: "semantic-quality"
 *
 * Profile conflict: CITY_SEO_V6_PROFILE (seo-profile-registry.ts) currently has
 * five module slots: "content-length", "uniqueness", "internal-links", "faq-quality",
 * "metadata". There is NO semantic module slot. This file uses "semantic-quality" as the
 * stable module ID (consistent with the naming pattern: "keyword-quality", "metadata", etc.),
 * and documents here that seo-profile-registry.ts must be updated to add this slot when the
 * engine is promoted to production. The scorer is DORMANT until that update occurs.
 *
 * Responsibility:
 *   Transform already-computed SemanticMetricsProvider-owned QualityMetrics fields
 *   into a normalised 0–100 ModuleResult evaluating semantic concept quality.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not imported by any production execution path.
 *   computeSeoQualityScore() in seo-quality.ts is not changed. The SEO Dashboard,
 *   Review Studio, regeneration decisions, and API contracts are all unchanged.
 *
 * Metrics consumed (all SemanticMetricsProvider-owned except context guards):
 *   semanticClusterCount, semanticClusterCoverage, sectionSemanticCoverage,
 *   introSemanticCoverage, headingSemanticCoverage, faqSemanticCoverage,
 *   conceptDiversity, conceptRedundancy,
 *   phraseVariationScore, coOccurrenceDensity,
 *   semanticConsistency, semanticTransitionScore,
 *   topicDistribution, semanticGapCount
 *
 * Context guards (owned by other providers — read-only, not scored):
 *   wordCountIntro        (ContentMetricsProvider) — detect absent intro zone
 *   headingCount          (ContentMetricsProvider) — detect absent heading zone
 *   faqCount              (FAQMetricsProvider)      — detect absent FAQ zone
 *   paragraphCount        (ContentMetricsProvider) — guard transition scoring
 *   primaryKeywordPresent (KeywordMetricsProvider)  — guard consistency scoring
 *
 * Metrics intentionally NOT consumed:
 *   semanticKeywordCoverage  — overlaps KQS placement/secondary coverage; reserved for KQS
 *   keywordVariantCoverage   — KQS already scores semanticVariantCoverage (KMP field)
 *   entityCoverage           — local entity penetration; reserved for LocalAuthenticityScorer
 *   entityDistribution       — zone entity spread; reserved for LocalAuthenticityScorer
 *   entityReuseRatio         — entity reuse depth; reserved for LocalAuthenticityScorer
 *   topicCoverage            — always divides by all 4 slots including empty clusters;
 *                              semanticClusterCoverage (non-empty denominator) is more accurate
 *   variantReuseRatio        — adjacent to KQS variant concern; marginal utility
 *   coOccurrenceCount        — raw count; coOccurrenceDensity captures the same signal normalised
 *   conceptCount             — raw count; not a normalised quality signal
 *   uniqueConceptCount       — raw count; conceptDiversity captures this normalised
 *   conceptDensity           — complex to calibrate without separating concept vs content density
 *   semanticOverlapRatio     — informative but subsumed by sectionSemanticCoverage + topicDistribution
 *
 * Component model (weights sum to 100):
 *   Coverage      30 — semanticClusterCoverage(60%) + sectionSemanticCoverage(40%)
 *   Section       25 — introSemanticCoverage(40%) + headingSemanticCoverage(30%) + faqSemanticCoverage(30%)
 *   Diversity     20 — max(0, piecewise(conceptDiversity) − piecewise(conceptRedundancy))
 *   Relationships 15 — phraseVariationScore(60%) + coOccurrenceDensity(40%)
 *   Coherence     10 — semanticConsistency(60%) + semanticTransitionScore(40%)
 *
 * Skip condition:
 *   semanticClusterCount === 0 (no concept data provided; score is undefined)
 *
 * Neutral guards (avoid penalising for absent input data):
 *   Section zone score → 100 when zone has no content segments
 *   Relationships → 100 for both sub-signals when semanticClusterCount < 2
 *   Coherence consistency → 100 when !primaryKeywordPresent
 *   Coherence transition → 100 when !hasSemanticContent || paragraphCount < 2
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

// ─── Identity ─────────────────────────────────────────────────────────────────────

/**
 * Module ID for this scorer. Not yet in CITY_SEO_V6_PROFILE — see file header
 * for the documented conflict and the required profile update before production use.
 */
export const SEMANTIC_QUALITY_MODULE_ID = "semantic-quality";

// ─── Component weights (must sum to 100) ──────────────────────────────────────────

const W_COVERAGE      = 30;
const W_SECTION       = 25;
const W_DIVERSITY     = 20;
const W_RELATIONSHIPS = 15;
const W_COHERENCE     = 10;
// Sum: 100

// ─── Coverage sub-weights (must sum to 100) ───────────────────────────────────────

const CW_CLUSTER  = 60;
const CW_SECTION  = 40;
// Sum: 100

// ─── Section sub-weights (must sum to 100) ────────────────────────────────────────

const SW_INTRO    = 40;
const SW_HEADINGS = 30;
const SW_FAQ      = 30;
// Sum: 100

// ─── Relationships sub-weights (must sum to 100) ──────────────────────────────────

const RW_PHRASE      = 60;
const RW_COOCCURRENCE = 40;
// Sum: 100

// ─── Coherence sub-weights (must sum to 100) ──────────────────────────────────────

const COH_CONSISTENCY = 60;
const COH_TRANSITION  = 40;
// Sum: 100

// ─── Scoring curves ───────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints.
// piecewiseLinear() interpolates linearly, clamps outside the defined range,
// and is independent of breakpoint input ordering.

/**
 * semanticClusterCoverage (0–1) → cluster score [0–100].
 * Rewards breadth: having at least one mention per defined concept cluster type.
 * First non-zero cluster earns 40 points; full coverage earns 100.
 */
const CLUSTER_COVERAGE_CURVE: [number, number][] = [
  [0,    0],
  [0.25, 40],
  [0.5,  70],
  [0.75, 90],
  [1.0, 100],
];

/**
 * sectionSemanticCoverage (0–1) → section coverage score [0–100].
 * Fraction of all content segments (intro paras + headings + FAQ items) containing
 * at least one semantic concept. Slightly steeper threshold than cluster coverage.
 */
const SECTION_COVERAGE_CURVE: [number, number][] = [
  [0,    0],
  [0.25, 30],
  [0.5,  60],
  [0.75, 85],
  [1.0, 100],
];

/**
 * Zonal semantic coverage (0–1) → zone score [0–100].
 * Shared curve for introSemanticCoverage, headingSemanticCoverage, faqSemanticCoverage.
 * Reaches 65 at 50% saturation and 100 at full saturation.
 */
const SECTION_DIST_CURVE: [number, number][] = [
  [0,    0],
  [0.25, 30],
  [0.5,  65],
  [0.75, 90],
  [1.0, 100],
];

/**
 * conceptDiversity (0–1) → diversity score [0–100].
 * uniqueConceptCount / totalConceptsAvailable. Rewards broad concept vocabulary.
 */
const DIVERSITY_CURVE: [number, number][] = [
  [0,   0],
  [0.3, 40],
  [0.6, 75],
  [0.8, 95],
  [1.0, 100],
];

/**
 * conceptRedundancy (0–1) → redundancy factor [0–40].
 * 1 − (uniqueConceptCount / conceptCount). This value is SUBTRACTED from diversityScore.
 * Caps at 40 so extreme redundancy cannot alone zero-out the diversity component.
 */
const REDUNDANCY_FACTOR_CURVE: [number, number][] = [
  [0,   0],
  [0.3, 10],
  [0.6, 25],
  [1.0, 40],
];

/**
 * phraseVariationScore (0–1) → phrase variation score [0–100].
 * Fraction of secondary/variant concepts co-occurring with the primary keyword
 * in at least one sentence. Only scored when semanticClusterCount >= 2.
 */
const PHRASE_VARIATION_CURVE: [number, number][] = [
  [0,    0],
  [0.25, 40],
  [0.5,  70],
  [0.75, 90],
  [1.0, 100],
];

/**
 * coOccurrenceDensity (pairs/sentence ≥ 0) → co-occurrence score [0–100].
 * Rewards concept pairs co-occurring within sentences. Plateaus at 2.0 pairs/sentence.
 * Only scored when semanticClusterCount >= 2.
 */
const COOCCURRENCE_CURVE: [number, number][] = [
  [0,   0],
  [0.5, 50],
  [1.0, 80],
  [2.0, 100],
];

/**
 * semanticConsistency (0–1) → consistency score [0–100].
 * Fraction of content sections (intro paragraphs + FAQ items) referencing at least
 * one primary-cluster term. Only scored when primaryKeywordPresent === true.
 */
const CONSISTENCY_CURVE: [number, number][] = [
  [0,    0],
  [0.25, 30],
  [0.5,  65],
  [0.75, 90],
  [1.0, 100],
];

/**
 * semanticTransitionScore (0–1) → transition score [0–100].
 * Fraction of consecutive intro paragraph pairs sharing at least one concept.
 * Only scored when hasSemanticContent && paragraphCount >= 2.
 */
const TRANSITION_CURVE: [number, number][] = [
  [0,    0],
  [0.25, 40],
  [0.5,  70],
  [1.0, 100],
];

// ─── Exported scoring helpers (pure — testable independently) ─────────────────────

/**
 * Score semantic cluster breadth (Coverage component).
 *
 * clusterCoverage: semanticClusterCoverage (fraction of non-empty clusters with ≥1 mention)
 * sectionCoverage: sectionSemanticCoverage (fraction of all content segments with ≥1 concept)
 */
export function scoreCoverage(clusterCoverage: number, sectionCoverage: number): number {
  const clusterScore = piecewiseLinear(safeNumber(clusterCoverage), CLUSTER_COVERAGE_CURVE);
  const sectionScore = piecewiseLinear(safeNumber(sectionCoverage), SECTION_COVERAGE_CURVE);
  return weightedAverage([
    { value: clusterScore, weight: CW_CLUSTER },
    { value: sectionScore, weight: CW_SECTION },
  ]);
}

/**
 * Score per-zone semantic saturation (Section Distribution component).
 *
 * Returns 100 (neutral) for any zone that has no content segments, so that absent
 * optional zones (e.g. no FAQ, no headings) do not lower the score.
 *
 * intro:       introSemanticCoverage
 * headings:    headingSemanticCoverage
 * faq:         faqSemanticCoverage
 * hasIntro:    wordCountIntro > 0
 * hasHeadings: headingCount > 0
 * hasFaq:      faqCount > 0
 */
export function scoreSectionDistribution(
  intro: number,
  headings: number,
  faq: number,
  hasIntro: boolean,
  hasHeadings: boolean,
  hasFaq: boolean,
): number {
  const introScore    = hasIntro    ? piecewiseLinear(safeNumber(intro),    SECTION_DIST_CURVE) : 100;
  const headingsScore = hasHeadings ? piecewiseLinear(safeNumber(headings), SECTION_DIST_CURVE) : 100;
  const faqScore      = hasFaq      ? piecewiseLinear(safeNumber(faq),      SECTION_DIST_CURVE) : 100;
  return weightedAverage([
    { value: introScore,    weight: SW_INTRO    },
    { value: headingsScore, weight: SW_HEADINGS },
    { value: faqScore,      weight: SW_FAQ      },
  ]);
}

/**
 * Score concept diversity with redundancy adjustment (Diversity component).
 *
 * diversity:   conceptDiversity (uniqueConceptCount / totalConceptsAvailable)
 * redundancy:  conceptRedundancy (1 − uniqueConceptCount / conceptCount, 0 when empty)
 *
 * Formula: max(0, piecewise(diversity) − piecewise(redundancy))
 * The redundancy factor is subtracted from the diversity score, clamped at ≥ 0.
 */
export function scoreDiversity(diversity: number, redundancy: number): number {
  const diversityScore    = piecewiseLinear(safeNumber(diversity),  DIVERSITY_CURVE);
  const redundancyFactor  = piecewiseLinear(safeNumber(redundancy), REDUNDANCY_FACTOR_CURVE);
  return Math.max(0, diversityScore - redundancyFactor);
}

/**
 * Score semantic concept relationships (Relationships component).
 *
 * Returns 100 (neutral) when semanticClusterCount < 2, because phrase variation and
 * co-occurrence require at least two concept types to be meaningful.
 *
 * phraseVariationScore: fraction of secondary/variant concepts co-occurring with primary
 * coOccurrenceDensity:  coOccurrenceCount / sentence count
 * hasMultipleClusters:  semanticClusterCount >= 2
 */
export function scoreRelationships(
  phraseVariation: number,
  coOccurrenceDensity: number,
  hasMultipleClusters: boolean,
): number {
  if (!hasMultipleClusters) return 100;
  const phraseScore       = piecewiseLinear(safeNumber(phraseVariation),    PHRASE_VARIATION_CURVE);
  const coOccurrenceScore = piecewiseLinear(safeNumber(coOccurrenceDensity), COOCCURRENCE_CURVE);
  return weightedAverage([
    { value: phraseScore,       weight: RW_PHRASE       },
    { value: coOccurrenceScore, weight: RW_COOCCURRENCE },
  ]);
}

/**
 * Score semantic consistency and paragraph-to-paragraph coherence (Coherence component).
 *
 * consistencyScore → 100 (neutral) when !primaryKeywordPresent:
 *   The primary keyword was not found in content, so consistency can't be evaluated
 *   independently (KeywordQualityScorer already penalises the absent keyword).
 *
 * transitionScore → 100 (neutral) when !hasSemanticContent || paragraphCount < 2:
 *   No concepts in content means no transitions possible; single paragraph means
 *   no consecutive pairs exist.
 *
 * semanticConsistency:    fraction of sections referencing ≥1 primary-cluster term
 * semanticTransition:     fraction of consecutive intro paragraph pairs sharing ≥1 concept
 * primaryKeywordPresent:  KMP primaryKeywordPresent (boolean)
 * hasSemanticContent:     semanticClusterCoverage > 0
 * hasMultipleParagraphs:  paragraphCount >= 2
 */
export function scoreCoherence(
  semanticConsistency: number,
  semanticTransition: number,
  primaryKeywordPresent: boolean,
  hasSemanticContent: boolean,
  hasMultipleParagraphs: boolean,
): number {
  const consistencyScore = primaryKeywordPresent
    ? piecewiseLinear(safeNumber(semanticConsistency), CONSISTENCY_CURVE)
    : 100;
  const transitionScore = (hasSemanticContent && hasMultipleParagraphs)
    ? piecewiseLinear(safeNumber(semanticTransition), TRANSITION_CURVE)
    : 100;
  return weightedAverage([
    { value: consistencyScore, weight: COH_CONSISTENCY },
    { value: transitionScore,  weight: COH_TRANSITION  },
  ]);
}

// ─── Recommendation helpers ───────────────────────────────────────────────────────

interface RecommendationDef {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field: string | null;
}

function buildRecommendations(
  clusterCount: number,
  clusterCoverage: number,
  sectionCoverage: number,
  intro: number,
  headings: number,
  faq: number,
  hasIntro: boolean,
  hasHeadings: boolean,
  hasFaq: boolean,
  conceptDiversity: number,
  conceptRedundancy: number,
  phraseVariation: number,
  hasMultipleClusters: boolean,
  primaryKeywordPresent: boolean,
  semanticConsistency: number,
  hasSemanticContent: boolean,
  hasMultipleParagraphs: boolean,
  semanticTransition: number,
  topicDistribution: number,
  gapCount: number,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  if (clusterCoverage < 0.5) {
    recs.push({
      code: "SQ_LOW_CLUSTER_COVERAGE",
      severity: "warning",
      message:
        `Only ${Math.round(clusterCoverage * 100)}% of defined concept cluster types appear in content. ` +
        "Ensure the primary keyword, secondary topics, semantic variants, and any local entities " +
        "are all represented in the page body.",
      field: "introContent",
    });
  }

  if (gapCount >= 2) {
    recs.push({
      code: "SQ_SEMANTIC_GAPS",
      severity: "warning",
      message:
        `${gapCount} of ${clusterCount} defined concept cluster types have zero mentions in content. ` +
        "Add content covering the missing concept types to improve semantic breadth.",
      field: "introContent",
    });
  }

  if (sectionCoverage < 0.5) {
    recs.push({
      code: "SQ_LOW_SECTION_COVERAGE",
      severity: "warning",
      message:
        `Only ${Math.round(sectionCoverage * 100)}% of content segments contain at least one semantic concept. ` +
        "Distribute concept references more evenly across the page body.",
      field: "introContent",
    });
  }

  if (hasIntro && intro < 0.5) {
    recs.push({
      code: "SQ_LOW_INTRO_COVERAGE",
      severity: "warning",
      message:
        `Only ${Math.round(intro * 100)}% of introduction paragraphs contain semantic concepts. ` +
        "Weave primary and secondary topic terms into the opening paragraphs.",
      field: "introContent",
    });
  }

  if (hasHeadings && headings < 0.5) {
    recs.push({
      code: "SQ_LOW_HEADING_COVERAGE",
      severity: "info",
      message:
        `Only ${Math.round(headings * 100)}% of headings contain semantic concepts. ` +
        "Include relevant topic terms in H2/H3 headings to strengthen topical signals.",
      field: "h1",
    });
  }

  if (hasFaq && faq < 0.5) {
    recs.push({
      code: "SQ_LOW_FAQ_COVERAGE",
      severity: "info",
      message:
        `Only ${Math.round(faq * 100)}% of FAQ items contain semantic concepts. ` +
        "Incorporate topic-relevant terms into FAQ questions and answers.",
      field: "faqItems",
    });
  }

  if (conceptDiversity < 0.4 && hasSemanticContent) {
    recs.push({
      code: "SQ_LOW_CONCEPT_DIVERSITY",
      severity: "warning",
      message:
        `Only ${Math.round(conceptDiversity * 100)}% of defined semantic concepts appear in content. ` +
        "Use a broader vocabulary of related terms, variants, and entity references.",
      field: "introContent",
    });
  }

  if (conceptRedundancy > 0.6 && hasSemanticContent) {
    recs.push({
      code: "SQ_HIGH_CONCEPT_REDUNDANCY",
      severity: "info",
      message:
        `Concept redundancy is ${Math.round(conceptRedundancy * 100)}% — the same terms are heavily repeated. ` +
        "Vary the phrasing by using synonyms, related terms, and alternate forms.",
      field: "introContent",
    });
  }

  if (hasMultipleClusters && topicDistribution < 0.25) {
    recs.push({
      code: "SQ_MISSING_TOPIC_DISTRIBUTION",
      severity: "info",
      message:
        "Concept cluster types are not distributed across multiple content zones. " +
        "Ensure topic terms appear in the introduction, headings, and FAQ sections.",
      field: "introContent",
    });
  }

  if (hasMultipleClusters && phraseVariation < 0.25) {
    recs.push({
      code: "SQ_WEAK_RELATIONSHIPS",
      severity: "info",
      message:
        `Only ${Math.round(phraseVariation * 100)}% of secondary and variant concepts co-occur with the primary keyword in the same sentence. ` +
        "Write sentences that naturally combine the primary topic with related concepts.",
      field: "introContent",
    });
  }

  if (primaryKeywordPresent && semanticConsistency < 0.5) {
    recs.push({
      code: "SQ_LOW_COHERENCE",
      severity: "info",
      message:
        `The primary keyword appears in only ${Math.round(semanticConsistency * 100)}% of content sections. ` +
        "Include a primary topic reference in each major section to maintain topical consistency.",
      field: "introContent",
    });
  }

  if (hasSemanticContent && hasMultipleParagraphs && semanticTransition < 0.33) {
    recs.push({
      code: "SQ_WEAK_TRANSITIONS",
      severity: "info",
      message:
        `Only ${Math.round(semanticTransition * 100)}% of consecutive paragraph pairs share a common concept. ` +
        "Link paragraphs thematically so the content flows from one idea to the next.",
      field: "introContent",
    });
  }

  return recs;
}

// ─── Scorer module ────────────────────────────────────────────────────────────────

export class SemanticQualityScorer implements ScorerModule {
  readonly id          = SEMANTIC_QUALITY_MODULE_ID;
  readonly name        = "Semantic Quality Scorer";
  readonly description =
    "Evaluates semantic concept quality: cluster breadth coverage, per-zone concept " +
    "saturation, concept diversity vs redundancy, phrase variation and co-occurrence " +
    "relationships, and semantic consistency and flow across content sections.";
  readonly version     = "1.0.0";
  readonly priority    = 250;
  readonly requiredMetrics = [
    // SemanticMetricsProvider-owned
    "semanticClusterCount",
    "semanticClusterCoverage",
    "sectionSemanticCoverage",
    "introSemanticCoverage",
    "headingSemanticCoverage",
    "faqSemanticCoverage",
    "conceptDiversity",
    "conceptRedundancy",
    "phraseVariationScore",
    "coOccurrenceDensity",
    "semanticConsistency",
    "semanticTransitionScore",
    "topicDistribution",
    "semanticGapCount",
    // Context guards (other providers, read-only)
    "wordCountIntro",
    "headingCount",
    "faqCount",
    "paragraphCount",
    "primaryKeywordPresent",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    if (!metrics) {
      return buildSkippedModuleResult(this.id, "No metrics available for semantic scoring.");
    }

    // ── Extract and sanitise inputs ────────────────────────────────────────────
    const clusterCount        = safeNumber(metrics.semanticClusterCount);
    const clusterCoverage     = safeNumber(metrics.semanticClusterCoverage);
    const sectionCoverage     = safeNumber(metrics.sectionSemanticCoverage);
    const intro               = safeNumber(metrics.introSemanticCoverage);
    const headings            = safeNumber(metrics.headingSemanticCoverage);
    const faq                 = safeNumber(metrics.faqSemanticCoverage);
    const conceptDiversity    = safeNumber(metrics.conceptDiversity);
    const conceptRedundancy   = safeNumber(metrics.conceptRedundancy);
    const phraseVariation     = safeNumber(metrics.phraseVariationScore);
    const coOccurrenceDensity = safeNumber(metrics.coOccurrenceDensity);
    const consistency         = safeNumber(metrics.semanticConsistency);
    const transition          = safeNumber(metrics.semanticTransitionScore);
    const topicDist           = safeNumber(metrics.topicDistribution);
    const gapCount            = safeNumber(metrics.semanticGapCount);

    const wordCountIntro   = safeNumber(metrics.wordCountIntro);
    const headingCount     = safeNumber(metrics.headingCount);
    const faqCount         = safeNumber(metrics.faqCount);
    const paragraphCount   = safeNumber(metrics.paragraphCount);
    const primaryPresent   = Boolean(metrics.primaryKeywordPresent);

    // ── SKIP: no concept data provided ────────────────────────────────────────
    if (clusterCount === 0) {
      return buildSkippedModuleResult(
        this.id,
        "No semantic concept clusters defined — skipping semantic quality scoring.",
      );
    }

    // ── Derived boolean guards ─────────────────────────────────────────────────
    const hasIntro             = wordCountIntro > 0;
    const hasHeadings          = headingCount > 0;
    const hasFaq               = faqCount > 0;
    const hasMultipleClusters  = clusterCount >= 2;
    const hasSemanticContent   = clusterCoverage > 0;
    const hasMultipleParagraphs = paragraphCount >= 2;

    // ── Compute per-component scores ───────────────────────────────────────────
    const coverageComp      = scoreCoverage(clusterCoverage, sectionCoverage);
    const sectionDistComp   = scoreSectionDistribution(intro, headings, faq, hasIntro, hasHeadings, hasFaq);
    const diversityComp     = scoreDiversity(conceptDiversity, conceptRedundancy);
    const relationshipsComp = scoreRelationships(phraseVariation, coOccurrenceDensity, hasMultipleClusters);
    const coherenceComp     = scoreCoherence(consistency, transition, primaryPresent, hasSemanticContent, hasMultipleParagraphs);

    // ── Build result ───────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("coverage",      coverageComp,      W_COVERAGE)
      .addContribution("section",       sectionDistComp,   W_SECTION)
      .addContribution("diversity",     diversityComp,     W_DIVERSITY)
      .addContribution("relationships", relationshipsComp, W_RELATIONSHIPS)
      .addContribution("coherence",     coherenceComp,     W_COHERENCE)
      .setExecutionMs(Date.now() - start);

    // ── Recommendations ────────────────────────────────────────────────────────
    const recs = buildRecommendations(
      clusterCount, clusterCoverage, sectionCoverage,
      intro, headings, faq,
      hasIntro, hasHeadings, hasFaq,
      conceptDiversity, conceptRedundancy,
      phraseVariation, hasMultipleClusters,
      primaryPresent, consistency,
      hasSemanticContent, hasMultipleParagraphs, transition,
      topicDist, gapCount,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const semanticQualityScorer = new SemanticQualityScorer();

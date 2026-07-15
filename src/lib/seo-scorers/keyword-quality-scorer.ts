/**
 * SEO Quality Engine — Keyword Quality Scorer
 *
 * Module ID: "keyword-quality"
 *
 * Profile conflict: CITY_SEO_V6_PROFILE (seo-profile-registry.ts) currently has
 * five module slots: "content-length", "uniqueness", "internal-links", "faq-quality",
 * "metadata". There is NO keyword module slot. Spec step 3 says "use the exact
 * keyword module ID already referenced by CITY_SEO_V6_PROFILE" — that precondition
 * is false: no such ID exists. This file uses "keyword-quality" as the stable module
 * ID (consistent with the naming pattern of other modules), and documents here that
 * seo-profile-registry.ts must be updated to add this slot when the engine is
 * promoted to production. The scorer is DORMANT until that update occurs.
 *
 * Responsibility:
 *   Transform already-computed KeywordMetricsProvider-owned QualityMetrics fields
 *   into a normalised 0–100 ModuleResult evaluating keyword targeting quality.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not imported by any production execution path.
 *   computeSeoQualityScore() in seo-quality.ts is not changed. The SEO Dashboard,
 *   Review Studio, regeneration decisions, and API contracts are all unchanged.
 *
 * Metrics consumed (all KeywordMetricsProvider-owned):
 *   primaryKeywordPresent, primaryKeywordDensity,
 *   primaryKeywordInTitle, primaryKeywordInH1, primaryKeywordInMeta,
 *   primaryKeywordInIntro, primaryKeywordInFaq, primaryKeywordInSlug,
 *   secondaryKeywordCount, secondaryKeywordCoverage,
 *   semanticVariantCount, semanticVariantCoverage,
 *   keywordDistributionScore, keywordSpread
 *
 * Metrics intentionally NOT consumed:
 *   keywordDensity / keywordStuffingRisk   — legacy fields, not KMP-owned
 *   headingKeywordCoverage                 — orphaned field (no provider owns it)
 *   keywordVariantCoverage                 — SMP-owned, reserved for SemanticQualityScorer
 *   semanticKeywordCoverage / topicCoverage — SMP-owned, reserved for SemanticQualityScorer
 *   aiPhrase*, template*                   — AIPatternScorer
 *   internalLink*, anchorText*             — InternalLinkScorer ("internal-links" module)
 *   faq*                                   — FAQQualityScorer ("faq-quality" module)
 *   title length / meta length             — MetadataQualityScorer ("metadata" module)
 *
 * Ownership boundary vs MetadataQualityScorer:
 *   MetadataQualityScorer evaluates STRUCTURAL metadata quality (title character
 *   count, meta description length, canonical URL format). This scorer evaluates
 *   whether the primary keyword APPEARS in those fields — a distinct quality axis.
 *   No double-scoring occurs because the two scorers measure different properties
 *   of the same fields.
 *
 * Component model (weights sum to 100):
 *   Placement    35 — keyword presence in title/H1/meta/intro/FAQ/slug (weighted flags)
 *   Density      20 — primaryKeywordDensity (%) via piecewise curve
 *   Distribution 20 — keywordDistributionScore (0–1) via piecewise curve
 *   Spread       10 — keywordSpread (0–1) via piecewise curve
 *   Secondary    10 — secondaryKeywordCoverage (0–1); full score when none supplied
 *   Semantic      5 — semanticVariantCoverage (0–1); full score when none supplied
 *
 * Placement sub-weights (sum to 100):
 *   Title 30 | H1 20 | Meta 20 | Intro 15 | FAQ 10 | Slug 5
 *
 * Hard cap:
 *   primaryKeywordPresent === false → score capped at 10 (ABSENT_KEYWORD_CAP)
 *
 * Penalties:
 *   primaryKeywordDensity > STUFFING_THRESHOLD (4.0%) → 10 pt deduction
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
export const KEYWORD_QUALITY_MODULE_ID = "keyword-quality";

// ─── Thresholds and constants ─────────────────────────────────────────────────────

/** primaryKeywordDensity (%) above which keyword stuffing penalty is applied. */
const STUFFING_THRESHOLD = 4.0;

/** Score deduction (points) applied when density exceeds STUFFING_THRESHOLD. */
const STUFFING_PENALTY = 10;

/** Hard cap applied when the primary keyword is completely absent from content. */
const ABSENT_KEYWORD_CAP = 10;

// ─── Component weights (must sum to 100) ─────────────────────────────────────────

const W_PLACEMENT    = 35;
const W_DENSITY      = 20;
const W_DISTRIBUTION = 20;
const W_SPREAD       = 10;
const W_SECONDARY    = 10;
const W_SEMANTIC     =  5;
// Sum: 100

// ─── Placement sub-weights (must sum to 100) ──────────────────────────────────────

const PW_TITLE = 30;
const PW_H1    = 20;
const PW_META  = 20;
const PW_INTRO = 15;
const PW_FAQ   = 10;
const PW_SLUG  =  5;
// Sum: 100

// ─── Scoring curves ───────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints.
// piecewiseLinear() interpolates linearly, clamps outside the defined range,
// and is independent of breakpoint input ordering.

/**
 * primaryKeywordDensity (%) → density score [0–100].
 * Healthy range: 1–3%. Stuffing threshold: 4% (matches seo-quality-rules.ts).
 * Curve degrades above 3% and reaches 0 at 5%.
 */
const KEYWORD_DENSITY_CURVE: [number, number][] = [
  [0,    0],
  [0.3,  20],
  [0.5,  50],
  [1.0,  80],
  [1.5, 100],
  [2.5, 100],
  [3.0,  80],
  [3.5,  60],
  [4.0,  30],
  [5.0,   0],
];

/**
 * keywordDistributionScore (0–1 fraction, 5 equal sections) → score [0–100].
 * Higher distribution means the keyword appears across more sections of the page.
 */
const DISTRIBUTION_CURVE: [number, number][] = [
  [0,     0],
  [0.2,  30],
  [0.4,  60],
  [0.6,  85],
  [0.8,  95],
  [1.0, 100],
];

/**
 * keywordSpread (0–1 fraction: distance between first and last occurrence) → score [0–100].
 * Higher spread indicates the keyword is used throughout the document rather than
 * concentrated in one section; right-clamps to 100 at 0.8.
 */
const SPREAD_CURVE: [number, number][] = [
  [0,    0],
  [0.2,  40],
  [0.5,  80],
  [0.8, 100],
];

/**
 * secondaryKeywordCoverage (0–1 fraction) → score [0–100].
 * Only used when secondaryKeywordCount > 0; otherwise the component scores 100.
 */
const SECONDARY_COVERAGE_CURVE: [number, number][] = [
  [0,     0],
  [0.25,  40],
  [0.5,   70],
  [0.75,  90],
  [1.0,  100],
];

/**
 * semanticVariantCoverage (0–1 fraction) → score [0–100].
 * Only used when semanticVariantCount > 0; otherwise the component scores 100.
 */
const SEMANTIC_COVERAGE_CURVE: [number, number][] = [
  [0,     0],
  [0.25,  40],
  [0.5,   75],
  [1.0,  100],
];

// ─── Exported scoring helpers (pure — testable independently) ─────────────────────

/**
 * Score primary keyword placement across six page zones.
 *
 * Each zone is binary (present=100 / absent=0) and contributes a weighted fraction
 * to the final placement score. Sub-weights: title(30) h1(20) meta(20) intro(15)
 * faq(10) slug(5).
 */
export function scorePlacement(
  inTitle: boolean,
  inH1: boolean,
  inMeta: boolean,
  inIntro: boolean,
  inFaq: boolean,
  inSlug: boolean,
): number {
  return weightedAverage([
    { value: inTitle ? 100 : 0, weight: PW_TITLE },
    { value: inH1   ? 100 : 0, weight: PW_H1   },
    { value: inMeta ? 100 : 0, weight: PW_META  },
    { value: inIntro ? 100 : 0, weight: PW_INTRO },
    { value: inFaq  ? 100 : 0, weight: PW_FAQ   },
    { value: inSlug ? 100 : 0, weight: PW_SLUG  },
  ]);
}

/**
 * Score primary keyword density (expressed as a percentage: occurrences / totalWords × 100).
 * Healthy range 1–3%. Scores 0 below 0 and at/above 5%.
 */
export function scoreKeywordDensity(densityPct: number): number {
  return piecewiseLinear(safeNumber(densityPct), KEYWORD_DENSITY_CURVE);
}

/**
 * Score keyword distribution across equal document sections.
 * @param distributionScore fraction 0–1 (KMP keywordDistributionScore)
 */
export function scoreKeywordDistribution(distributionScore: number): number {
  return piecewiseLinear(safeNumber(distributionScore), DISTRIBUTION_CURVE);
}

/**
 * Score keyword document spread (distance between first and last occurrence).
 * @param spread fraction 0–1 (KMP keywordSpread)
 */
export function scoreKeywordSpread(spread: number): number {
  return piecewiseLinear(safeNumber(spread), SPREAD_CURVE);
}

/**
 * Score secondary keyword coverage.
 * Returns 100 when no secondary keywords were supplied (not penalised for absence).
 * @param coverage  fraction 0–1 (KMP secondaryKeywordCoverage)
 * @param count     number of secondary keywords (KMP secondaryKeywordCount)
 */
export function scoreSecondaryKeywords(coverage: number, count: number): number {
  if (safeNumber(count) <= 0) return 100;
  return piecewiseLinear(safeNumber(coverage), SECONDARY_COVERAGE_CURVE);
}

/**
 * Score semantic variant coverage (caller-supplied variant list, KMP-counted).
 * Returns 100 when no semantic variants were supplied (not penalised for absence).
 * @param coverage fraction 0–1 (KMP semanticVariantCoverage)
 * @param count    number of variants (KMP semanticVariantCount)
 */
export function scoreSemanticVariants(coverage: number, count: number): number {
  if (safeNumber(count) <= 0) return 100;
  return piecewiseLinear(safeNumber(coverage), SEMANTIC_COVERAGE_CURVE);
}

// ─── Recommendation helpers ───────────────────────────────────────────────────────

interface RecommendationDef {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field: string | null;
}

function buildRecommendations(
  primaryKeywordPresent: boolean,
  densityPct: number,
  inTitle: boolean,
  inH1: boolean,
  inMeta: boolean,
  inIntro: boolean,
  inFaq: boolean,
  inSlug: boolean,
  secondaryCount: number,
  secondaryCoverage: number,
  variantCount: number,
  variantCoverage: number,
  distributionScore: number,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  if (!primaryKeywordPresent) {
    recs.push({
      code: "KQ_PRIMARY_ABSENT",
      severity: "error",
      message: "Primary keyword not found in page content. Ensure the target keyword " +
        "appears naturally throughout the page body.",
      field: "introContent",
    });
    return recs;
  }

  if (densityPct > STUFFING_THRESHOLD) {
    recs.push({
      code: "KQ_DENSITY_HIGH",
      severity: "error",
      message: `Primary keyword density is ${densityPct.toFixed(1)}% — above the ${STUFFING_THRESHOLD}% ` +
        "stuffing threshold. Reduce repetitive keyword usage to avoid search engine penalties.",
      field: "introContent",
    });
  } else if (densityPct < 0.5 && densityPct > 0) {
    recs.push({
      code: "KQ_DENSITY_LOW",
      severity: "warning",
      message: `Primary keyword density is ${densityPct.toFixed(1)}% — below the recommended ` +
        "0.5–3% range. Add more natural keyword mentions in the content body.",
      field: "introContent",
    });
  }

  if (!inTitle) {
    recs.push({
      code: "KQ_MISSING_TITLE",
      severity: "error",
      message: "Primary keyword is absent from the page title. " +
        "Include the primary keyword in the title tag for strong on-page SEO signals.",
      field: "title",
    });
  }

  if (!inH1) {
    recs.push({
      code: "KQ_MISSING_H1",
      severity: "warning",
      message: "Primary keyword is absent from the H1 heading. " +
        "Include the primary keyword in the top-level heading to reinforce topical relevance.",
      field: "h1",
    });
  }

  if (!inMeta) {
    recs.push({
      code: "KQ_MISSING_META",
      severity: "warning",
      message: "Primary keyword is absent from the meta description. " +
        "Including it improves click-through rates and search snippet relevance.",
      field: "metaDescription",
    });
  }

  if (!inIntro) {
    recs.push({
      code: "KQ_MISSING_INTRO",
      severity: "warning",
      message: "Primary keyword is absent from the page introduction. " +
        "Use the keyword within the first 100–150 words to establish topical relevance early.",
      field: "introContent",
    });
  }

  if (!inFaq) {
    recs.push({
      code: "KQ_MISSING_FAQ",
      severity: "info",
      message: "Primary keyword does not appear in the FAQ section. " +
        "Consider adding FAQ questions that naturally incorporate the primary keyword.",
      field: "faqItems",
    });
  }

  if (!inSlug) {
    recs.push({
      code: "KQ_MISSING_SLUG",
      severity: "info",
      message: "Primary keyword is absent from the URL slug. " +
        "Including the keyword in the slug strengthens URL relevance signals.",
      field: "canonicalUrl",
    });
  }

  if (distributionScore < 0.4 && primaryKeywordPresent) {
    recs.push({
      code: "KQ_POOR_DISTRIBUTION",
      severity: "warning",
      message: "Primary keyword is concentrated in few sections of the page. " +
        "Distribute keyword usage more evenly across the full content to improve topical depth.",
      field: "introContent",
    });
  }

  if (secondaryCount > 0 && secondaryCoverage < 0.5) {
    recs.push({
      code: "KQ_SECONDARY_GAPS",
      severity: "info",
      message: `Only ${Math.round(secondaryCoverage * 100)}% of secondary keywords appear in content ` +
        `(${Math.round(secondaryCoverage * secondaryCount)} of ${secondaryCount}). ` +
        "Incorporate missing secondary keywords to broaden topical coverage.",
      field: "introContent",
    });
  }

  if (variantCount > 0 && variantCoverage < 0.5) {
    recs.push({
      code: "KQ_VARIANT_GAPS",
      severity: "info",
      message: `Only ${Math.round(variantCoverage * 100)}% of semantic variants appear in content ` +
        `(${Math.round(variantCoverage * variantCount)} of ${variantCount}). ` +
        "Use more keyword variants to improve semantic coverage.",
      field: "introContent",
    });
  }

  return recs;
}

// ─── Scorer module ────────────────────────────────────────────────────────────────

export class KeywordQualityScorer implements ScorerModule {
  readonly id          = KEYWORD_QUALITY_MODULE_ID;
  readonly name        = "Keyword Quality Scorer";
  readonly description =
    "Evaluates keyword targeting quality: primary keyword placement in critical page " +
    "zones, density, distribution, spread across the document, secondary keyword " +
    "coverage, and semantic variant coverage.";
  readonly version     = "1.0.0";
  readonly priority    = 200;
  readonly requiredMetrics = [
    "primaryKeywordPresent",
    "primaryKeywordDensity",
    "primaryKeywordInTitle",
    "primaryKeywordInH1",
    "primaryKeywordInMeta",
    "primaryKeywordInIntro",
    "primaryKeywordInFaq",
    "primaryKeywordInSlug",
    "secondaryKeywordCount",
    "secondaryKeywordCoverage",
    "semanticVariantCount",
    "semanticVariantCoverage",
    "keywordDistributionScore",
    "keywordSpread",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    if (!metrics) {
      return buildSkippedModuleResult(this.id, "No metrics available for keyword scoring.");
    }

    // ── Extract and sanitise inputs ────────────────────────────────────────────
    const primaryPresent    = Boolean(metrics.primaryKeywordPresent);
    const densityPct        = safeNumber(metrics.primaryKeywordDensity);
    const inTitle           = Boolean(metrics.primaryKeywordInTitle);
    const inH1              = Boolean(metrics.primaryKeywordInH1);
    const inMeta            = Boolean(metrics.primaryKeywordInMeta);
    const inIntro           = Boolean(metrics.primaryKeywordInIntro);
    const inFaq             = Boolean(metrics.primaryKeywordInFaq);
    const inSlug            = Boolean(metrics.primaryKeywordInSlug);
    const secondaryCount    = safeNumber(metrics.secondaryKeywordCount);
    const secondaryCoverage = safeNumber(metrics.secondaryKeywordCoverage);
    const variantCount      = safeNumber(metrics.semanticVariantCount);
    const variantCoverage   = safeNumber(metrics.semanticVariantCoverage);
    const distributionScore = safeNumber(metrics.keywordDistributionScore);
    const spread            = safeNumber(metrics.keywordSpread);

    // ── Compute per-component scores ───────────────────────────────────────────
    const placementScore    = scorePlacement(inTitle, inH1, inMeta, inIntro, inFaq, inSlug);
    const densityScore      = scoreKeywordDensity(densityPct);
    const distributionComp  = scoreKeywordDistribution(distributionScore);
    const spreadComp        = scoreKeywordSpread(spread);
    const secondaryComp     = scoreSecondaryKeywords(secondaryCoverage, secondaryCount);
    const semanticComp      = scoreSemanticVariants(variantCoverage, variantCount);

    // ── Build result ───────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("placement",    placementScore,   W_PLACEMENT)
      .addContribution("density",      densityScore,     W_DENSITY)
      .addContribution("distribution", distributionComp, W_DISTRIBUTION)
      .addContribution("spread",       spreadComp,       W_SPREAD)
      .addContribution("secondary",    secondaryComp,    W_SECONDARY)
      .addContribution("semantic",     semanticComp,     W_SEMANTIC)
      .setExecutionMs(Date.now() - start);

    // ── Hard cap: keyword absent from content ──────────────────────────────────
    if (!primaryPresent) {
      builder.setCap(ABSENT_KEYWORD_CAP);
    }

    // ── Stuffing penalty ───────────────────────────────────────────────────────
    if (densityPct > STUFFING_THRESHOLD) {
      builder.addPenalty(
        "keyword-stuffing",
        `Keyword density ${densityPct.toFixed(1)}% exceeds ${STUFFING_THRESHOLD}% stuffing threshold.`,
        STUFFING_PENALTY,
      );
    }

    // ── Recommendations ────────────────────────────────────────────────────────
    const recs = buildRecommendations(
      primaryPresent, densityPct,
      inTitle, inH1, inMeta, inIntro, inFaq, inSlug,
      secondaryCount, secondaryCoverage,
      variantCount, variantCoverage,
      distributionScore,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const keywordQualityScorer = new KeywordQualityScorer();

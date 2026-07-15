/**
 * SEO Quality Engine — Internal Links Quality Scorer
 *
 * Module ID: "internal-links"
 *
 * Profile slot: CITY_SEO_V6_PROFILE["internal-links"] — weight 15 (seo-profile-registry.ts).
 * This scorer maps cleanly to the "internal-links" profile slot. It remains DORMANT
 * until QualityEngineConfig wires it in (see seo-quality-engine.ts). The scorer
 * is not imported by any production execution path and does not alter
 * computeSeoQualityScore(), the SEO Dashboard, Review Studio, regeneration
 * decisions, or API contracts.
 *
 * Responsibility:
 *   Transform InternalLinkMetricsProvider-owned QualityMetrics fields into a
 *   normalised 0–100 ModuleResult evaluating internal-link quantity and quality:
 *   link volume, anchor text quality, anchor diversity, link page-distribution,
 *   and target URL diversity.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not registered in any production scoring path.
 *
 * Metrics consumed (all InternalLinkMetricsProvider-owned):
 *   internalLinkCount, anchorTextCount, descriptiveAnchorCount, genericAnchorCount,
 *   uniqueAnchorTextCount, duplicateAnchorTextCount, sectionLinkDistribution,
 *   uniqueTargetCount, duplicateTargetCount, anchorKeywordCoverage, emptyAnchorCount
 *
 * Metrics intentionally NOT consumed:
 *   externalLinkCount / externalHttpLinkCount — always 0 from this provider; unavailable
 *   absoluteInternalLinkCount — always 0 from this provider
 *   followLinkCount / nofollowLinkCount — nofollow is rarely set on internal links; low signal
 *   mailtoLinkCount / telLinkCount — protocol links unrelated to internal-link quality
 *   categoryLinkCount / cityLinkCount / listingLinkCount / faqInternalLinkCount —
 *     individual destination-type counts; covered at the aggregate level by internalLinkCount
 *   ctaInternalLinkCount — CTA anchors overlap with genericAnchorCount; not scored separately
 *   firstLinkPosition / lastLinkPosition — raw positions; linkSpread is more useful but linkDensity
 *     and sectionLinkDistribution already capture page-spread signals
 *   linkSpread / linkDensity — sectionLinkDistribution provides cleaner normalised spread signal
 *   averageAnchorLength / longestAnchorLength / shortestAnchorLength — granular length metrics;
 *     signal is captured indirectly through descriptive vs generic anchor classification
 *   samePageAnchorCount — same-page jump links (#hash); not informative for inter-page quality
 *   relativeLinkCount — absolute vs relative is deployment convention; no SEO quality signal
 *   imageLinkCount — empty-anchor links (likely icon links); neutral; neutrality guard handles this
 *
 * No-double-scoring audit:
 *   ContentQualityScorer  — uses wordCount, paragraphCount, headingCount, imageCount, listCount,
 *     contentDensity. No InternalLinkMetricsProvider fields. No overlap.
 *   MetadataQualityScorer — uses title/meta/canonical/OG/schema fields. No overlap.
 *   KeywordQualityScorer  — uses KeywordMetricsProvider-owned density and position fields.
 *     anchorKeywordCoverage belongs to InternalLinkMetricsProvider; no overlap.
 *   SemanticQualityScorer — uses SemanticMetricsProvider-owned fields. No overlap.
 *   UniquenessQualityScorer — uses DuplicateContentMetricsProvider-owned fields. No overlap.
 *
 * Component model (weights sum to 100):
 *   Link Volume       25 — internalLinkCount via piecewise curve
 *   Anchor Quality    30 — descriptiveAnchorCount / anchorTextCount via piecewise curve;
 *                          neutral (100) when anchorTextCount === 0
 *   Anchor Diversity  20 — uniqueAnchorTextCount / anchorTextCount via piecewise curve;
 *                          neutral (100) when anchorTextCount === 0
 *   Link Distribution 15 — sectionLinkDistribution (already 0–1) via piecewise curve
 *   Target Diversity  10 — uniqueTargetCount / internalLinkCount via piecewise curve
 *
 * SKIP condition:
 *   internalLinkCount === 0 (no link data to evaluate)
 *
 * Penalty (applied to raw score before cap):
 *   duplicateTargetCount ≥ 2 → −5 pts  (HIGH_DUPLICATE_TARGETS)
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

/** Module ID matching CITY_SEO_V6_PROFILE slot "internal-links". */
export const INTERNAL_LINKS_QUALITY_MODULE_ID = "internal-links";

// ─── Penalty thresholds and amounts ───────────────────────────────────────────────

/** duplicateTargetCount at or above which HIGH_DUPLICATE_TARGETS penalty fires. */
const HIGH_DUPLICATE_TARGETS_THRESHOLD = 2;

/** Points deducted when duplicateTargetCount ≥ HIGH_DUPLICATE_TARGETS_THRESHOLD. */
const HIGH_DUPLICATE_TARGETS_PENALTY = 5;

// ─── Recommendation thresholds ────────────────────────────────────────────────────

/** internalLinkCount below which IL_LOW_INTERNAL_LINKS fires. */
const LOW_LINK_COUNT_THRESHOLD = 3;

/** anchorQualityRatio below which IL_GENERIC_ANCHOR_TEXT fires. */
const POOR_ANCHOR_QUALITY_THRESHOLD = 0.5;

/** anchorQualityRatio below which IL_GENERIC_ANCHOR_TEXT becomes error severity. */
const POOR_ANCHOR_QUALITY_ERROR_THRESHOLD = 0.3;

/** duplicateAnchorTextCount at or above which IL_DUPLICATE_ANCHOR_TEXTS fires. */
const DUPLICATE_ANCHOR_THRESHOLD = 3;

/** sectionLinkDistribution below which IL_POOR_LINK_DISTRIBUTION fires. */
const POOR_DISTRIBUTION_THRESHOLD = 0.4;

/** Minimum anchorTextCount required for IL_NO_KEYWORD_IN_ANCHORS recommendation. */
const MIN_ANCHORS_FOR_KEYWORD_REC = 3;

// ─── Component weights (sum to 100) ───────────────────────────────────────────────

const W_LINK_VOLUME       = 25;
const W_ANCHOR_QUALITY    = 30;
const W_ANCHOR_DIVERSITY  = 20;
const W_LINK_DISTRIBUTION = 15;
const W_TARGET_DIVERSITY  = 10;
// Sum: 100

// ─── Scoring curves ────────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints.
// piecewiseLinear() interpolates linearly, left-clamps, and right-clamps.

/**
 * internalLinkCount (integer ≥ 0) → link volume score [0–100].
 * 0 links  → page is SKIPPED (handled before scoring).
 * 1 link   → minimal credit (10).
 * 5 links  → good (70 — mirrors production threshold of 5 links for 15 pts max).
 * 12 links → excellent (100, right-clamped).
 */
const LINK_VOLUME_CURVE: [number, number][] = [
  [0,    0],
  [1,   10],
  [3,   40],
  [5,   70],
  [8,   88],
  [12, 100],
];

/**
 * anchorQualityRatio = descriptiveAnchorCount / anchorTextCount (0–1) → score [0–100].
 * A ratio of 1.0 means all non-empty anchors are descriptive (not generic).
 */
const ANCHOR_QUALITY_CURVE: [number, number][] = [
  [0.0,   0],
  [0.3,  20],
  [0.5,  45],
  [0.7,  70],
  [0.85, 90],
  [1.0, 100],
];

/**
 * anchorDiversityRatio = uniqueAnchorTextCount / anchorTextCount (0–1) → score [0–100].
 * A ratio of 1.0 means every non-empty anchor text is unique (no repetition).
 */
const ANCHOR_DIVERSITY_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  30],
  [0.75, 60],
  [0.9,  85],
  [1.0, 100],
];

/**
 * sectionLinkDistribution (0–1, already normalised by provider) → score [0–100].
 * The provider divides links into 5 equal-index buckets; this is the fraction of
 * buckets that contain at least one link. A score of 1.0 means all sections have links.
 */
const LINK_DISTRIBUTION_CURVE: [number, number][] = [
  [0.0,   0],
  [0.2,  20],
  [0.4,  50],
  [0.6,  75],
  [0.8,  90],
  [1.0, 100],
];

/**
 * targetDiversityRatio = uniqueTargetCount / internalLinkCount (0–1) → score [0–100].
 * A ratio of 1.0 means every link points to a distinct URL (no repeated destinations).
 */
const TARGET_DIVERSITY_CURVE: [number, number][] = [
  [0.0,   0],
  [0.5,  30],
  [0.75, 65],
  [1.0, 100],
];

// ─── Exported scoring helpers (pure — testable independently) ──────────────────────

/**
 * Score the quantity of internal links on the page.
 * The page must have ≥ 1 link to call this (SKIP guards against 0).
 *
 * @param internalLinkCount  total links in the internalLinks array (≥ 0).
 */
export function scoreLinkVolume(internalLinkCount: number): number {
  return piecewiseLinear(safeNumber(internalLinkCount), LINK_VOLUME_CURVE);
}

/**
 * Score the quality of anchor texts (descriptive vs generic).
 *
 * @param descriptiveAnchorCount  links with non-generic, non-empty anchor text.
 * @param anchorTextCount         total links with any non-empty anchor text.
 *                                Returns 100 (neutral) when anchorTextCount === 0.
 */
export function scoreAnchorQuality(
  descriptiveAnchorCount: number,
  anchorTextCount: number,
): number {
  const safeTotal = Math.max(0, safeNumber(anchorTextCount));
  if (safeTotal === 0) return 100;
  const ratio = Math.min(1, Math.max(0, safeNumber(descriptiveAnchorCount) / safeTotal));
  return piecewiseLinear(ratio, ANCHOR_QUALITY_CURVE);
}

/**
 * Score anchor text diversity (unique anchor texts vs total).
 *
 * @param uniqueAnchorTextCount  distinct non-empty anchor texts.
 * @param anchorTextCount        total non-empty anchor texts.
 *                               Returns 100 (neutral) when anchorTextCount === 0.
 */
export function scoreAnchorDiversity(
  uniqueAnchorTextCount: number,
  anchorTextCount: number,
): number {
  const safeTotal = Math.max(0, safeNumber(anchorTextCount));
  if (safeTotal === 0) return 100;
  const ratio = Math.min(1, Math.max(0, safeNumber(uniqueAnchorTextCount) / safeTotal));
  return piecewiseLinear(ratio, ANCHOR_DIVERSITY_CURVE);
}

/**
 * Score page-level distribution of links across equal-size sections.
 *
 * @param sectionLinkDistribution  fraction [0–1] of equal-index link-array sections
 *                                 that contain at least one link.
 */
export function scoreLinkDistribution(sectionLinkDistribution: number): number {
  return piecewiseLinear(
    Math.min(1, Math.max(0, safeNumber(sectionLinkDistribution))),
    LINK_DISTRIBUTION_CURVE,
  );
}

/**
 * Score URL target diversity (unique destinations vs total links).
 *
 * @param uniqueTargetCount   count of distinct normalised hrefs.
 * @param internalLinkCount   total links (denominator).
 *                            When internalLinkCount is 0, returns 0 (caller should SKIP first).
 */
export function scoreTargetDiversity(
  uniqueTargetCount: number,
  internalLinkCount: number,
): number {
  const safeTotal = Math.max(0, safeNumber(internalLinkCount));
  if (safeTotal === 0) return 0;
  const ratio = Math.min(1, Math.max(0, safeNumber(uniqueTargetCount) / safeTotal));
  return piecewiseLinear(ratio, TARGET_DIVERSITY_CURVE);
}

// ─── Recommendation builder ────────────────────────────────────────────────────────

interface RecommendationDef {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field: string | null;
}

function buildRecommendations(
  internalLinkCount: number,
  anchorTextCount: number,
  anchorQualityRatio: number,
  duplicateAnchorTextCount: number,
  sectionLinkDistribution: number,
  duplicateTargetCount: number,
  anchorKeywordCoverage: number,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  if (internalLinkCount < LOW_LINK_COUNT_THRESHOLD) {
    recs.push({
      code: "IL_LOW_INTERNAL_LINKS",
      severity: "warning",
      message:
        `Only ${internalLinkCount} internal link${internalLinkCount === 1 ? "" : "s"} found ` +
        `(recommended minimum: ${LOW_LINK_COUNT_THRESHOLD}). ` +
        "Add contextually relevant internal links to improve crawlability and page authority.",
      field: "introContent",
    });
  }

  if (anchorTextCount > 0 && anchorQualityRatio < POOR_ANCHOR_QUALITY_THRESHOLD) {
    recs.push({
      code: "IL_GENERIC_ANCHOR_TEXT",
      severity: anchorQualityRatio < POOR_ANCHOR_QUALITY_ERROR_THRESHOLD ? "error" : "warning",
      message:
        `${Math.round(anchorQualityRatio * 100)}% of anchor texts are descriptive ` +
        `(threshold: ${POOR_ANCHOR_QUALITY_THRESHOLD * 100}%). ` +
        "Replace generic phrases like 'click here' and 'read more' with keyword-rich descriptive text.",
      field: "introContent",
    });
  }

  if (duplicateAnchorTextCount >= DUPLICATE_ANCHOR_THRESHOLD) {
    recs.push({
      code: "IL_DUPLICATE_ANCHOR_TEXTS",
      severity: "info",
      message:
        `${duplicateAnchorTextCount} anchor text${duplicateAnchorTextCount === 1 ? "" : "s"} ` +
        "appear more than once. Vary anchor texts to improve semantic diversity and avoid over-optimisation.",
      field: "introContent",
    });
  }

  if (sectionLinkDistribution < POOR_DISTRIBUTION_THRESHOLD) {
    recs.push({
      code: "IL_POOR_LINK_DISTRIBUTION",
      severity: "info",
      message:
        `Internal links are concentrated in ${Math.round(sectionLinkDistribution * 100)}% of page sections. ` +
        "Spread links throughout the content to improve crawl depth and user navigation.",
      field: "introContent",
    });
  }

  if (duplicateTargetCount >= HIGH_DUPLICATE_TARGETS_THRESHOLD) {
    recs.push({
      code: "IL_DUPLICATE_TARGETS",
      severity: "warning",
      message:
        `${duplicateTargetCount} URL${duplicateTargetCount === 1 ? "" : "s"} are linked to more than once. ` +
        "Link to additional distinct pages instead to maximise internal-link diversity.",
      field: "introContent",
    });
  }

  if (anchorTextCount >= MIN_ANCHORS_FOR_KEYWORD_REC && anchorKeywordCoverage === 0) {
    recs.push({
      code: "IL_NO_KEYWORD_IN_ANCHORS",
      severity: "info",
      message:
        "None of the anchor texts contain the primary keyword. " +
        "Include the primary keyword in at least one anchor to strengthen topical relevance.",
      field: "introContent",
    });
  }

  return recs;
}

// ─── Scorer module ──────────────────────────────────────────────────────────────────

export class InternalLinksQualityScorer implements ScorerModule {
  readonly id          = INTERNAL_LINKS_QUALITY_MODULE_ID;
  readonly name        = "Internal Links Quality Scorer";
  readonly description =
    "Evaluates the quantity and quality of internal links: link volume, " +
    "anchor text descriptiveness, anchor diversity, link distribution across " +
    "page sections, and URL target diversity.";
  readonly version     = "1.0.0";
  readonly priority    = 400;
  readonly requiredMetrics = [
    // InternalLinkMetricsProvider-owned (scoring inputs)
    "internalLinkCount",
    "anchorTextCount",
    "descriptiveAnchorCount",
    "genericAnchorCount",
    "uniqueAnchorTextCount",
    "duplicateAnchorTextCount",
    "sectionLinkDistribution",
    "uniqueTargetCount",
    "duplicateTargetCount",
    "anchorKeywordCoverage",
    "emptyAnchorCount",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    if (!metrics) {
      return buildSkippedModuleResult(this.id, "No metrics available for internal-links scoring.");
    }

    // ── Context guard ─────────────────────────────────────────────────────────
    const internalLinkCount = safeNumber(metrics.internalLinkCount);

    // SKIP: no links to evaluate
    if (internalLinkCount === 0) {
      return buildSkippedModuleResult(
        this.id,
        "No internal links found on this page. Add internal links for quality evaluation.",
      );
    }

    // ── InternalLinkMetricsProvider-owned metrics ──────────────────────────────
    const anchorTextCount         = safeNumber(metrics.anchorTextCount,         0);
    const descriptiveAnchorCount  = safeNumber(metrics.descriptiveAnchorCount,  0);
    const uniqueAnchorTextCount   = safeNumber(metrics.uniqueAnchorTextCount,   0);
    const duplicateAnchorTextCount = safeNumber(metrics.duplicateAnchorTextCount, 0);
    const sectionLinkDist         = safeNumber(metrics.sectionLinkDistribution, 0);
    const uniqueTargetCount       = safeNumber(metrics.uniqueTargetCount,       0);
    const duplicateTargetCount    = safeNumber(metrics.duplicateTargetCount,    0);
    const anchorKeywordCoverage   = safeNumber(metrics.anchorKeywordCoverage,   0);

    // ── Component scores ───────────────────────────────────────────────────────
    const linkVolumeScore      = scoreLinkVolume(internalLinkCount);
    const anchorQualityScore   = scoreAnchorQuality(descriptiveAnchorCount, anchorTextCount);
    const anchorDiversityScore = scoreAnchorDiversity(uniqueAnchorTextCount, anchorTextCount);
    const linkDistScore        = scoreLinkDistribution(sectionLinkDist);
    const targetDiversityScore = scoreTargetDiversity(uniqueTargetCount, internalLinkCount);

    // ── Build result ──────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("linkVolume",       linkVolumeScore,      W_LINK_VOLUME)
      .addContribution("anchorQuality",    anchorQualityScore,   W_ANCHOR_QUALITY)
      .addContribution("anchorDiversity",  anchorDiversityScore, W_ANCHOR_DIVERSITY)
      .addContribution("linkDistribution", linkDistScore,        W_LINK_DISTRIBUTION)
      .addContribution("targetDiversity",  targetDiversityScore, W_TARGET_DIVERSITY)
      .setExecutionMs(Date.now() - start);

    // ── Penalty ───────────────────────────────────────────────────────────────
    if (duplicateTargetCount >= HIGH_DUPLICATE_TARGETS_THRESHOLD) {
      builder.addPenalty(
        "high-duplicate-targets",
        `${duplicateTargetCount} URL${duplicateTargetCount === 1 ? "" : "s"} ` +
          "are linked to more than once.",
        HIGH_DUPLICATE_TARGETS_PENALTY,
      );
    }

    // ── Recommendations ───────────────────────────────────────────────────────
    const anchorQualityRatio = anchorTextCount > 0
      ? descriptiveAnchorCount / anchorTextCount
      : 1;
    const recs = buildRecommendations(
      internalLinkCount,
      anchorTextCount,
      anchorQualityRatio,
      duplicateAnchorTextCount,
      sectionLinkDist,
      duplicateTargetCount,
      anchorKeywordCoverage,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const internalLinksQualityScorer = new InternalLinksQualityScorer();

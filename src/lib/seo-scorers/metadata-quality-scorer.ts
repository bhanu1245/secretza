/**
 * SEO Quality Engine — Metadata Quality Scorer
 *
 * Module ID: "metadata" (matches CITY_SEO_V6_PROFILE.modules entry, weight 20).
 *
 * Responsibility:
 *   Transform already-computed QualityMetrics into a normalized 0–100 ModuleResult
 *   evaluating the metadata completeness and quality signals of the page.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not imported by any production execution path.
 *   computeSeoQualityScore() in seo-quality.ts is not changed. The SEO Dashboard,
 *   Review Studio, regeneration decisions, and API contracts are all unchanged.
 *
 * Metrics consumed (all provided by MetadataMetricsProvider):
 *   titlePresent, titleLength
 *   metaPresent, metaLength
 *   canonicalPresent
 *   h1Present
 *   featuredImagePresent, imageAltPresent
 *   robotsNoindex, robotsNofollow
 *   openGraphExists, openGraphPropertyCount
 *   twitterCardExists, twitterMetaCount
 *
 * Metrics intentionally NOT consumed:
 *   titleInOptimalRange, metaInOptimalRange — not populated by MetadataMetricsProvider;
 *     scorer computes length quality directly from titleLength/metaLength.
 *   estimatedTitlePixelWidth, metaDescriptionPixelWidth — not used; char count is primary.
 *   h1EqualsTitle, h1Count — keyword optimization belongs to KeywordQualityScorer.
 *   structuredData*, jsonLd*, *SchemaExists — future Schema/Technical scorer.
 *   hreflang*, alternateLinkCount — future Technical scorer.
 *   viewportMetaExists, charsetMetaExists, faviconExists, manifestExists — future Technical scorer.
 *   primaryKeywordInTitle, primaryKeywordInMeta, primaryKeywordInH1 — KeywordQualityScorer.
 *
 * Component model (weights sum to 100):
 *   Title Quality          30 — presence guard + piecewise length curve (optimal 30–65 chars)
 *   Meta Description       25 — presence guard + piecewise length curve (optimal 100–165 chars)
 *   Canonical Quality      15 — presence boolean
 *   Page Completeness      15 — H1 (60%) + featured image (30%) + image alt (10%)
 *   Indexability           10 — robotsNoindex boolean
 *   Social Metadata         5 — Open Graph (60%) + Twitter Card (40%)
 *
 * Hard cap:
 *   robotsNoindex === true → cap at 10 (NON_INDEXABLE_CAP)
 *   Rationale: an unindexable city SEO page has near-zero SEO value regardless of
 *   how well other metadata is optimized.
 *
 * Thresholds are anchored to seo-quality-rules.ts constants:
 *   Title optimal range: 30–65 chars
 *   Meta description optimal range: 100–165 chars
 *
 * Performance: O(1) — consumes pre-computed metrics only. No parsing, no DB, no AI.
 */

import type {
  ScorerModule,
  ModuleContext,
  ModuleResult,
} from "@/lib/seo-quality-types";
import { ModuleScoreBuilder } from "@/lib/seo-module-score-builder";
import { piecewiseLinear, safeNumber, weightedAverage } from "@/lib/seo-scoring-core";

// ─── Identity ────────────────────────────────────────────────────────────────────

/**
 * Module ID used by CITY_SEO_V6_PROFILE for the metadata module slot.
 * Intentionally matches the profile entry so weight resolution is correct.
 */
export const METADATA_QUALITY_MODULE_ID = "metadata";

// ─── Quality-rules-anchored thresholds ───────────────────────────────────────────

/** Shortest title before quality degrades meaningfully (quality-rules.ts: optimal 30–65). */
const TITLE_OPTIMAL_MIN = 30;
/** Longest title before truncation risk (quality-rules.ts: optimal 30–65). */
const TITLE_OPTIMAL_MAX = 65;
/** Title length where curve degradation becomes severe (SERP pixel truncation zone). */
const TITLE_SEVERE_MAX = 80;

/** Shortest meta description before quality degrades meaningfully (quality-rules.ts: 100–165). */
const META_OPTIMAL_MIN = 100;
/** Longest meta description before truncation risk (quality-rules.ts: 100–165). */
const META_OPTIMAL_MAX = 165;

/** Score cap when robotsNoindex is true on an SEO-critical city page. */
const NON_INDEXABLE_CAP = 10;

// ─── Component weights (must sum to 100) ─────────────────────────────────────────

const W_TITLE            = 30;
const W_META             = 25;
const W_CANONICAL        = 15;
const W_PAGE_COMPLETENESS = 15;
const W_INDEXABILITY     = 10;
const W_SOCIAL           =  5;
// Sum: 100

// ─── Scoring curves ───────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints sorted ascending by x.
// piecewiseLinear() interpolates linearly between adjacent breakpoints,
// clamps to first/last y outside the defined range.

/** Title character count → length quality [0–100].
 *  Optimal band: 30–65 chars (quality-rules.ts). Severe degradation above ~80. */
const TITLE_LENGTH_CURVE: [number, number][] = [
  [0,                  0],
  [15,                20],
  [TITLE_OPTIMAL_MIN, 70],
  [45,                95],
  [55,               100],
  [TITLE_OPTIMAL_MAX, 100],
  [TITLE_SEVERE_MAX,  75],
  [100,               45],
  [120,               20],
];

/** Meta description character count → length quality [0–100].
 *  Optimal band: 100–165 chars (quality-rules.ts). Degrades above 200. */
const META_LENGTH_CURVE: [number, number][] = [
  [0,                0],
  [50,              20],
  [META_OPTIMAL_MIN, 75],
  [120,             95],
  [META_OPTIMAL_MAX, 100],
  [200,             80],
  [320,             40],
];

/** Open Graph property count → OG quality [0–100].
 *  Core OG set: og:title, og:description, og:type, og:url, og:image (5 props). */
const OG_PROPERTY_CURVE: [number, number][] = [
  [0,   0],
  [1,  40],
  [3,  70],
  [5,  90],
  [7, 100],
];

/** Twitter meta count → Twitter card quality [0–100].
 *  Minimum set: twitter:card, twitter:title, twitter:description, twitter:image (4). */
const TWITTER_META_CURVE: [number, number][] = [
  [0,   0],
  [1,  40],
  [3,  70],
  [5, 100],
];

// ─── Exported scoring helpers (pure — testable independently) ─────────────────────

/**
 * Score title quality from presence and character length.
 *
 * Absent title → 0 (error; not a length issue).
 * Present title → piecewiseLinear(titleLength, TITLE_LENGTH_CURVE).
 * Optimal range: 30–65 characters.
 */
export function scoreTitleQuality(titlePresent: boolean, titleLength: number): number {
  if (!titlePresent) return 0;
  return piecewiseLinear(safeNumber(titleLength), TITLE_LENGTH_CURVE);
}

/**
 * Score meta description quality from presence and character length.
 *
 * Absent meta → 0 (error; not a length issue).
 * Present meta → piecewiseLinear(metaLength, META_LENGTH_CURVE).
 * Optimal range: 100–165 characters.
 */
export function scoreMetaQuality(metaPresent: boolean, metaLength: number): number {
  if (!metaPresent) return 0;
  return piecewiseLinear(safeNumber(metaLength), META_LENGTH_CURVE);
}

/**
 * Score canonical URL quality from its presence.
 *
 * Binary: present → 100, absent → 0.
 * A canonical tag is mandatory on city SEO pages to prevent duplicate content.
 */
export function scoreCanonicalQuality(canonicalPresent: boolean): number {
  return canonicalPresent ? 100 : 0;
}

/**
 * Score page completeness from H1, featured image, and image alt presence.
 *
 * Sub-components (weighted average):
 *   H1 presence        (60%) — page-head structural signal
 *   Featured image     (30%) — CTR and visual completeness
 *   Image alt text     (10%) — accessibility and image indexing
 */
export function scorePageCompleteness(
  h1Present: boolean,
  featuredImagePresent: boolean,
  imageAltPresent: boolean,
): number {
  return weightedAverage([
    { value: h1Present           ? 100 : 0, weight: 60 },
    { value: featuredImagePresent ? 100 : 0, weight: 30 },
    { value: imageAltPresent      ? 100 : 0, weight: 10 },
  ]);
}

/**
 * Score indexability from the robotsNoindex signal.
 *
 * Binary: not noindex → 100, noindex → 0.
 * A separate hard cap (NON_INDEXABLE_CAP) is applied at the module level
 * so that an accidentally noindexed page cannot score above 10 overall.
 */
export function scoreIndexability(robotsNoindex: boolean): number {
  return robotsNoindex ? 0 : 100;
}

/**
 * Score social metadata quality from Open Graph and Twitter Card signals.
 *
 * Sub-components (weighted average):
 *   Open Graph   (60%) — property count via OG_PROPERTY_CURVE; 0 if absent.
 *   Twitter Card (40%) — meta count via TWITTER_META_CURVE; 0 if absent.
 */
export function scoreSocialMetadata(
  openGraphExists: boolean,
  openGraphPropertyCount: number,
  twitterCardExists: boolean,
  twitterMetaCount: number,
): number {
  const ogScore = openGraphExists
    ? piecewiseLinear(safeNumber(openGraphPropertyCount), OG_PROPERTY_CURVE)
    : 0;
  const twitterScore = twitterCardExists
    ? piecewiseLinear(safeNumber(twitterMetaCount), TWITTER_META_CURVE)
    : 0;

  return weightedAverage([
    { value: ogScore,      weight: 60 },
    { value: twitterScore, weight: 40 },
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
  titlePresent: boolean,
  titleLength: number,
  metaPresent: boolean,
  metaLength: number,
  canonicalPresent: boolean,
  h1Present: boolean,
  featuredImagePresent: boolean,
  robotsNoindex: boolean,
  robotsNofollow: boolean,
  openGraphExists: boolean,
  twitterCardExists: boolean,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  // Title
  if (!titlePresent) {
    recs.push({
      code: "MQ_MISSING_TITLE",
      severity: "error",
      message: `Page title is missing. Add a descriptive title in the ${TITLE_OPTIMAL_MIN}–${TITLE_OPTIMAL_MAX} character optimal range.`,
      field: "title",
    });
  } else if (titleLength < TITLE_OPTIMAL_MIN) {
    recs.push({
      code: "MQ_TITLE_TOO_SHORT",
      severity: "warning",
      message: `Title is too short (${titleLength} chars). Aim for ${TITLE_OPTIMAL_MIN}–${TITLE_OPTIMAL_MAX} characters for optimal SERP display.`,
      field: "title",
    });
  } else if (titleLength > TITLE_SEVERE_MAX) {
    recs.push({
      code: "MQ_TITLE_TOO_LONG",
      severity: "warning",
      message: `Title is too long (${titleLength} chars) and may be truncated in search results. Keep it under ${TITLE_SEVERE_MAX} characters.`,
      field: "title",
    });
  }

  // Meta description
  if (!metaPresent) {
    recs.push({
      code: "MQ_MISSING_META_DESCRIPTION",
      severity: "error",
      message: `Meta description is missing. Add one in the ${META_OPTIMAL_MIN}–${META_OPTIMAL_MAX} character optimal range to improve SERP click-through rate.`,
      field: "metaDescription",
    });
  } else if (metaLength < META_OPTIMAL_MIN) {
    recs.push({
      code: "MQ_META_TOO_SHORT",
      severity: "warning",
      message: `Meta description is too short (${metaLength} chars). Aim for ${META_OPTIMAL_MIN}–${META_OPTIMAL_MAX} characters.`,
      field: "metaDescription",
    });
  } else if (metaLength > META_OPTIMAL_MAX) {
    recs.push({
      code: "MQ_META_TOO_LONG",
      severity: "warning",
      message: `Meta description is too long (${metaLength} chars) and may be truncated. Keep it under ${META_OPTIMAL_MAX} characters.`,
      field: "metaDescription",
    });
  }

  // Canonical
  if (!canonicalPresent) {
    recs.push({
      code: "MQ_MISSING_CANONICAL",
      severity: "warning",
      message: "Canonical URL tag is missing. Add a canonical tag to prevent duplicate content issues.",
      field: "canonicalUrl",
    });
  }

  // H1
  if (!h1Present) {
    recs.push({
      code: "MQ_MISSING_H1",
      severity: "warning",
      message: "Page is missing an H1 heading. Add a single H1 that clearly describes the page topic.",
      field: "h1",
    });
  }

  // Indexability
  if (robotsNoindex) {
    recs.push({
      code: "MQ_NOINDEX_DETECTED",
      severity: "error",
      message: "Page has a robots noindex directive. This prevents the page from appearing in search results. Remove if unintentional.",
      field: "robotsMeta",
    });
  }
  if (robotsNofollow) {
    recs.push({
      code: "MQ_NOFOLLOW_DETECTED",
      severity: "warning",
      message: "Page has a robots nofollow directive. Internal links on this page will not pass PageRank. Remove if unintentional.",
      field: "robotsMeta",
    });
  }

  // Featured image
  if (!featuredImagePresent) {
    recs.push({
      code: "MQ_MISSING_FEATURED_IMAGE",
      severity: "info",
      message: "No featured image detected. Adding one improves visual appearance in social shares and search results.",
      field: "featuredImage",
    });
  }

  // Social metadata
  if (!openGraphExists) {
    recs.push({
      code: "MQ_ADD_OPEN_GRAPH",
      severity: "info",
      message: "Open Graph tags are missing. Add og:title, og:description, og:image, and og:url for richer social sharing previews.",
      field: null,
    });
  }
  if (!twitterCardExists) {
    recs.push({
      code: "MQ_ADD_TWITTER_CARD",
      severity: "info",
      message: "Twitter Card tags are missing. Add twitter:card, twitter:title, twitter:description, and twitter:image.",
      field: null,
    });
  }

  return recs;
}

// ─── Scorer module ────────────────────────────────────────────────────────────────

export class MetadataQualityScorer implements ScorerModule {
  readonly id          = METADATA_QUALITY_MODULE_ID;
  readonly name        = "Metadata Quality Scorer";
  readonly description =
    "Evaluates metadata completeness and quality: title length, meta description " +
    "length, canonical URL presence, H1 and featured image completeness, page " +
    "indexability, and social metadata coverage (Open Graph, Twitter Card).";
  readonly version     = "1.0.0";
  readonly priority    = 100;
  readonly requiredMetrics = [
    "titlePresent",
    "titleLength",
    "metaPresent",
    "metaLength",
    "canonicalPresent",
    "h1Present",
    "featuredImagePresent",
    "imageAltPresent",
    "robotsNoindex",
    "robotsNofollow",
    "openGraphExists",
    "openGraphPropertyCount",
    "twitterCardExists",
    "twitterMetaCount",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    // ── Extract inputs ───────────────────────────────────────────────────────
    const titlePresent           = Boolean(metrics.titlePresent);
    const titleLength            = safeNumber(metrics.titleLength);
    const metaPresent            = Boolean(metrics.metaPresent);
    const metaLength             = safeNumber(metrics.metaLength);
    const canonicalPresent       = Boolean(metrics.canonicalPresent);
    const h1Present              = Boolean(metrics.h1Present);
    const featuredImagePresent   = Boolean(metrics.featuredImagePresent);
    const imageAltPresent        = Boolean(metrics.imageAltPresent);
    const robotsNoindex          = Boolean(metrics.robotsNoindex);
    const robotsNofollow         = Boolean(metrics.robotsNofollow);
    const openGraphExists        = Boolean(metrics.openGraphExists);
    const openGraphPropertyCount = safeNumber(metrics.openGraphPropertyCount);
    const twitterCardExists      = Boolean(metrics.twitterCardExists);
    const twitterMetaCount       = safeNumber(metrics.twitterMetaCount);

    // ── Compute per-component scores ─────────────────────────────────────────
    const titleScore        = scoreTitleQuality(titlePresent, titleLength);
    const metaScore         = scoreMetaQuality(metaPresent, metaLength);
    const canonicalScore    = scoreCanonicalQuality(canonicalPresent);
    const pageCompScore     = scorePageCompleteness(h1Present, featuredImagePresent, imageAltPresent);
    const indexabilityScore = scoreIndexability(robotsNoindex);
    const socialScore       = scoreSocialMetadata(
      openGraphExists, openGraphPropertyCount,
      twitterCardExists, twitterMetaCount,
    );

    // ── Build result ─────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("title",        titleScore,        W_TITLE)
      .addContribution("meta",         metaScore,         W_META)
      .addContribution("canonical",    canonicalScore,    W_CANONICAL)
      .addContribution("completeness", pageCompScore,     W_PAGE_COMPLETENESS)
      .addContribution("indexability", indexabilityScore, W_INDEXABILITY)
      .addContribution("social",       socialScore,       W_SOCIAL)
      .setExecutionMs(Date.now() - start);

    // ── Hard cap for non-indexable SEO pages ─────────────────────────────────
    if (robotsNoindex) {
      builder.setCap(NON_INDEXABLE_CAP);
    }

    // ── Add deterministic recommendations ────────────────────────────────────
    const recs = buildRecommendations(
      titlePresent, titleLength,
      metaPresent, metaLength,
      canonicalPresent,
      h1Present,
      featuredImagePresent,
      robotsNoindex,
      robotsNofollow,
      openGraphExists,
      twitterCardExists,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const metadataQualityScorer = new MetadataQualityScorer();

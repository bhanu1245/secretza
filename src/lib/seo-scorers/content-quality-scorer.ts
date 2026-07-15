/**
 * SEO Quality Engine — Content Quality Scorer
 *
 * Module ID: "content-length" (matches CITY_SEO_V6_PROFILE.modules entry, weight 25).
 * Note: the profile ID pre-dates this scorer; a future profile version will rename
 * the module to "content-quality" once the engine replaces computeSeoQualityScore().
 *
 * Responsibility:
 *   Transform already-computed QualityMetrics into a normalized 0–100 ModuleResult
 *   evaluating structural and completeness signals of the page content.
 *
 * Isolation guarantee:
 *   This scorer is DORMANT. It is not imported by any production execution path.
 *   computeSeoQualityScore() in seo-quality.ts is not changed. The SEO Dashboard,
 *   Review Studio, regeneration decisions, and API contracts are all unchanged.
 *
 * Metrics consumed:
 *   wordCount, wordCountIntro, paragraphCount, avgParagraphWords,
 *   sentenceCount, avgSentenceWords, longSentenceRatio,
 *   headingCount, h2Count, h3Count, headingDensity,
 *   listCount, tableCount, contentDensity
 *   (all provided by ContentMetricsProvider)
 *
 * Metrics intentionally NOT consumed:
 *   readabilityScore, typeTokenRatio  → ReadabilityScorer
 *   uniqueness*                        → UniquenessScorer ("uniqueness" module)
 *   keyword*, semantic*               → KeywordScorer / SemanticScorer
 *   aiPhrase*, template*              → AIPatternScorer
 *   faq*                              → FAQQualityScorer ("faq-quality" module)
 *   internalLink*, anchorText*        → InternalLinkScorer ("internal-links" module)
 *   duplicate* (inter-page)           → DuplicateContentScorer
 *   localEntity*, localAuth*          → LocalAuthenticityScorer
 *   title*, meta*, h1*, canonical*    → MetadataScorer ("metadata" module)
 *
 * Component model (weights sum to 100):
 *   Content Depth           25  — word count via graduated piecewise curve
 *   Structural Organization 20  — headings presence, H2/H3 distribution, density
 *   Paragraph Quality       15  — paragraph count and word-count balance
 *   Sentence Structure      10  — sentence count, avg length, long-sentence ratio
 *   Content Richness        10  — lists, tables (structural elements)
 *   Intro Completeness      10  — intro word count graduated curve
 *   Structural Health       10  — content density (visible/raw ratio)
 *
 * Hard caps:
 *   wordCount === 0       → cap at 0   (EMPTY_CONTENT_CAP)
 *   wordCount < 100       → cap at 15  (CRITICALLY_THIN_CAP)
 *
 * Thresholds are anchored to production constants:
 *   MIN_WORD_COUNT = 500 (seo-quality.ts)
 *   SEO_GENERATION_TARGET_WORDS = 650 (seo-quality.ts)
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

// ─── Identity ────────────────────────────────────────────────────────────────────

/**
 * Module ID used by CITY_SEO_V6_PROFILE for the content-quality module slot.
 * Intentionally matches the profile entry so weight resolution is correct.
 */
export const CONTENT_QUALITY_MODULE_ID = "content-length";

// ─── Production-anchored thresholds ──────────────────────────────────────────────

/** Minimum word count for production quality gate (mirrors seo-quality.ts). */
const PROD_MIN_WORD_COUNT = 500;
/** Generation target word count (mirrors seo-quality.ts). */
const PROD_TARGET_WORD_COUNT = 650;
/** Hard cap threshold for critically thin content. */
const CRITICALLY_THIN_THRESHOLD = 100;
/** Cap score for critically thin content. */
const CRITICALLY_THIN_CAP = 15;
/** Cap score for completely empty content. */
const EMPTY_CONTENT_CAP = 0;

// ─── Component weights (must sum to 100) ─────────────────────────────────────────

const W_DEPTH     = 25;
const W_STRUCTURE = 20;
const W_PARAGRAPHS = 15;
const W_SENTENCES  = 10;
const W_RICHNESS   = 10;
const W_INTRO      = 10;
const W_HEALTH     = 10;
// Sum: 100

// ─── Scoring curves ───────────────────────────────────────────────────────────────
//
// All curves are [x, y] breakpoints.
// piecewiseLinear() interpolates linearly between adjacent breakpoints,
// clamps to first/last y outside the defined range, and is order-independent.

/** Word count → depth score [0–100]. Anchored to production min (500) and target (650). */
const DEPTH_CURVE: [number, number][] = [
  [0,                    0],
  [200,                 25],
  [PROD_MIN_WORD_COUNT, 70],
  [PROD_TARGET_WORD_COUNT, 87],
  [800,                100],
];

/** Heading count → heading presence score [0–100]. */
const HEADING_COUNT_CURVE: [number, number][] = [
  [0,  0],
  [1, 40],
  [2, 65],
  [4, 88],
  [6, 100],
];

/** Paragraph count → count quality score [0–100].
 *  Very high counts (>15) degrade: too many suggests very short, thin paragraphs. */
const PARA_COUNT_CURVE: [number, number][] = [
  [0,  0],
  [1, 20],
  [3, 55],
  [5, 80],
  [8, 95],
  [15, 100],
  [30,  65],
];

/** Average paragraph word count → balance score [0–100].
 *  Ideal range: 40–150 words per paragraph. */
const PARA_BALANCE_CURVE: [number, number][] = [
  [0,   0],
  [20,  20],
  [40,  60],
  [80,  100],
  [150, 100],
  [200,  70],
  [300,  20],
];

/** Sentence count → count quality score [0–100]. */
const SENT_COUNT_CURVE: [number, number][] = [
  [0,   0],
  [5,  25],
  [15, 65],
  [25, 90],
  [40, 100],
];

/** Average sentence word count → length quality score [0–100].
 *  Ideal range: 10–25 words per sentence. */
const SENT_LEN_CURVE: [number, number][] = [
  [0,   0],
  [6,  30],
  [10, 75],
  [18, 100],
  [25, 100],
  [35,  65],
  [50,  20],
];

/** Long-sentence ratio → score [0–100]. Lower ratio is better (structural clarity). */
const LONG_SENT_RATIO_CURVE: [number, number][] = [
  [0,    100],
  [0.10,  90],
  [0.20,  70],
  [0.35,  40],
  [0.50,  15],
  [1.00,   0],
];

/** Element count (lists + tables) → richness score [0–100].
 *  Baseline of 20: text-only content without structural elements is still valid. */
const RICHNESS_CURVE: [number, number][] = [
  [0,  20],
  [1,  60],
  [2,  80],
  [3,  95],
  [5, 100],
];

/** Intro word count → completeness score [0–100]. */
const INTRO_CURVE: [number, number][] = [
  [0,    0],
  [50,  20],
  [150, 60],
  [250, 87],
  [350, 100],
];

/** Content density (visible chars / raw chars) → health score [0–100].
 *  Low density suggests excessive markup, empty blocks, or malformed content. */
const DENSITY_CURVE: [number, number][] = [
  [0.00,   0],
  [0.20,  20],
  [0.50,  65],
  [0.70,  90],
  [0.85, 100],
];

// ─── Exported scoring helpers (pure — testable independently) ─────────────────────

/**
 * Score content depth from word count using a graduated piecewise curve.
 * Anchored to production MIN_WORD_COUNT (500) and SEO_GENERATION_TARGET_WORDS (650).
 */
export function scoreContentDepth(wordCount: number): number {
  return piecewiseLinear(safeNumber(wordCount), DEPTH_CURVE);
}

/**
 * Score structural organization from heading metrics.
 *
 * Two sub-components (weighted average):
 *   headingPresence (70%) — heading count via piecewise curve; spam-penalised
 *                           when headingDensity > 5 per 100 intro words.
 *   headingDepth    (30%) — rewards proper H2/H3 hierarchy.
 */
export function scoreStructure(
  headingCount: number,
  h2Count: number,
  h3Count: number,
  headingDensity: number,
): number {
  const hCount   = safeNumber(headingCount);
  const h2       = safeNumber(h2Count);
  const h3       = safeNumber(h3Count);
  const density  = safeNumber(headingDensity);

  let headingPresenceScore = piecewiseLinear(hCount, HEADING_COUNT_CURVE);

  // Spam penalty: > 5 headings per 100 intro words degrades the signal
  if (density > 5 && hCount > 0) {
    headingPresenceScore = headingPresenceScore * 0.7;
  }

  // Depth sub-score: rewards H2/H3 hierarchy
  let depthScore = 0;
  if (h2 >= 2 && h3 >= 1) depthScore = 100;
  else if (h2 >= 1 && h3 >= 1) depthScore = 70;
  else if (h2 >= 2) depthScore = 55;
  else if (h2 >= 1) depthScore = 40;

  return weightedAverage([
    { value: headingPresenceScore, weight: 70 },
    { value: depthScore,           weight: 30 },
  ]);
}

/**
 * Score paragraph quality from paragraph count and average length.
 *
 * Two sub-components (weighted average):
 *   count   (60%) — paragraph count via piecewise curve; very high counts degraded.
 *   balance (40%) — avg paragraph word count; ideal 40–150 words.
 *
 * Returns 0 when paragraphCount is 0.
 */
export function scoreParagraphQuality(
  paragraphCount: number,
  avgParagraphWords: number,
): number {
  const count = safeNumber(paragraphCount);
  if (count <= 0) return 0;

  const countScore   = piecewiseLinear(count, PARA_COUNT_CURVE);
  const balanceScore = piecewiseLinear(safeNumber(avgParagraphWords), PARA_BALANCE_CURVE);

  return weightedAverage([
    { value: countScore,   weight: 60 },
    { value: balanceScore, weight: 40 },
  ]);
}

/**
 * Score sentence structure from three signals.
 *
 * Three sub-components (weighted average):
 *   count    (50%) — sentence count via piecewise curve.
 *   length   (30%) — avg sentence words; ideal 10–25 words.
 *   longRatio(20%) — long-sentence ratio; lower is better.
 *
 * Returns 0 when sentenceCount is 0.
 */
export function scoreSentenceStructure(
  sentenceCount: number,
  avgSentenceWords: number,
  longSentenceRatio: number,
): number {
  const count = safeNumber(sentenceCount);
  if (count <= 0) return 0;

  const countScore     = piecewiseLinear(count, SENT_COUNT_CURVE);
  const lengthScore    = piecewiseLinear(safeNumber(avgSentenceWords), SENT_LEN_CURVE);
  const longRatioScore = piecewiseLinear(safeNumber(longSentenceRatio), LONG_SENT_RATIO_CURVE);

  return weightedAverage([
    { value: countScore,      weight: 50 },
    { value: lengthScore,     weight: 30 },
    { value: longRatioScore,  weight: 20 },
  ]);
}

/**
 * Score content richness from structural element counts (lists + tables).
 * Has a baseline of 20 — text-only content is still valid.
 * Returns 0 when there is no content (wordCount guard handled by caller).
 */
export function scoreContentRichness(listCount: number, tableCount: number): number {
  const elements = safeNumber(listCount) + safeNumber(tableCount);
  return piecewiseLinear(elements, RICHNESS_CURVE);
}

/**
 * Score intro completeness from the intro word count.
 * Returns 0 for zero-word intros.
 */
export function scoreIntroCompleteness(wordCountIntro: number): number {
  return piecewiseLinear(safeNumber(wordCountIntro), INTRO_CURVE);
}

/**
 * Score structural health from content density (visible chars / raw chars ratio).
 * Returns 0 when there is no content.
 */
export function scoreStructuralHealth(contentDensity: number, wordCount: number): number {
  if (safeNumber(wordCount) <= 0) return 0;
  return piecewiseLinear(safeNumber(contentDensity), DENSITY_CURVE);
}

// ─── Recommendation helpers ───────────────────────────────────────────────────────

interface RecommendationDef {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field: string | null;
}

function buildRecommendations(
  wordCount: number,
  wordCountIntro: number,
  paragraphCount: number,
  avgParagraphWords: number,
  headingCount: number,
  h2Count: number,
  h3Count: number,
  listCount: number,
  tableCount: number,
): RecommendationDef[] {
  const recs: RecommendationDef[] = [];

  // Content depth
  if (wordCount === 0) {
    recs.push({
      code: "CQ_CRITICALLY_EMPTY",
      severity: "error",
      message: "Content is completely empty. Add substantive content targeting " +
        `at least ${PROD_MIN_WORD_COUNT} words.`,
      field: "introContent",
    });
  } else if (wordCount < CRITICALLY_THIN_THRESHOLD) {
    recs.push({
      code: "CQ_CRITICALLY_THIN",
      severity: "error",
      message: `Content is critically thin (${wordCount} words). ` +
        `Minimum target: ${PROD_MIN_WORD_COUNT} words.`,
      field: "introContent",
    });
  } else if (wordCount < PROD_MIN_WORD_COUNT) {
    recs.push({
      code: "CQ_EXPAND_CONTENT",
      severity: "error",
      message: `Word count (${wordCount}) is below the ${PROD_MIN_WORD_COUNT}-word minimum. ` +
        "Add more substantive content sections.",
      field: "introContent",
    });
  }

  // Structure: headings
  if (headingCount < 2 && wordCount >= 200) {
    recs.push({
      code: "CQ_ADD_HEADINGS",
      severity: "warning",
      message: "Add H2/H3 section headings to improve structural organization " +
        `(currently ${headingCount} heading${headingCount === 1 ? "" : "s"}).`,
      field: "introContent",
    });
  }
  if (h2Count >= 2 && h3Count === 0 && wordCount >= 300) {
    recs.push({
      code: "CQ_ADD_SUBHEADINGS",
      severity: "info",
      message: "Consider adding H3 subheadings under existing H2 sections " +
        "for a deeper content hierarchy.",
      field: "introContent",
    });
  }

  // Paragraphs
  if (paragraphCount < 3 && wordCount >= 200) {
    recs.push({
      code: "CQ_IMPROVE_PARAGRAPH_STRUCTURE",
      severity: "warning",
      message: `Break content into more paragraphs (currently ${paragraphCount}). ` +
        "Aim for 5–15 focused paragraphs.",
      field: "introContent",
    });
  }
  if (avgParagraphWords > 200 && paragraphCount > 0) {
    recs.push({
      code: "CQ_BREAK_LONG_PARAGRAPHS",
      severity: "warning",
      message: `Average paragraph is too long (${Math.round(avgParagraphWords)} words). ` +
        "Aim for 50–150 words per paragraph.",
      field: "introContent",
    });
  }

  // Intro
  if (wordCountIntro < 150 && wordCount >= 200 && wordCountIntro < wordCount * 0.5) {
    recs.push({
      code: "CQ_EXPAND_INTRO",
      severity: "warning",
      message: `Strengthen the introduction (currently ${wordCountIntro} words). ` +
        "Target at least 150–200 words in the intro section.",
      field: "introContent",
    });
  }

  // Richness
  if (listCount === 0 && tableCount === 0 && wordCount >= 400) {
    recs.push({
      code: "CQ_ADD_STRUCTURAL_ELEMENTS",
      severity: "info",
      message: "Consider adding lists or comparison tables to improve content " +
        "structure and reader engagement.",
      field: "introContent",
    });
  }

  return recs;
}

// ─── Scorer module ────────────────────────────────────────────────────────────────

export class ContentQualityScorer implements ScorerModule {
  readonly id          = CONTENT_QUALITY_MODULE_ID;
  readonly name        = "Content Quality Scorer";
  readonly description =
    "Evaluates structural and completeness signals: content depth, heading " +
    "organization, paragraph quality, sentence structure, content richness, " +
    "intro completeness, and structural health.";
  readonly version     = "1.0.0";
  readonly priority    = 100;
  readonly requiredMetrics = [
    "wordCount",
    "wordCountIntro",
    "paragraphCount",
    "avgParagraphWords",
    "sentenceCount",
    "avgSentenceWords",
    "longSentenceRatio",
    "headingCount",
    "h2Count",
    "h3Count",
    "headingDensity",
    "listCount",
    "tableCount",
    "contentDensity",
  ] as const satisfies (keyof import("@/lib/seo-quality-types").QualityMetrics)[];
  readonly dependsOnModules: string[] = [];

  score(context: ModuleContext): ModuleResult {
    const start = Date.now();
    const { metrics } = context;

    // ── Extract and sanitise inputs ──────────────────────────────────────────
    const wordCount         = safeNumber(metrics.wordCount);
    const wordCountIntro    = safeNumber(metrics.wordCountIntro);
    const paragraphCount    = safeNumber(metrics.paragraphCount);
    const avgParagraphWords = safeNumber(metrics.avgParagraphWords);
    const sentenceCount     = safeNumber(metrics.sentenceCount);
    const avgSentenceWords  = safeNumber(metrics.avgSentenceWords);
    const longSentenceRatio = safeNumber(metrics.longSentenceRatio);
    const headingCount      = safeNumber(metrics.headingCount);
    const h2Count           = safeNumber(metrics.h2Count);
    const h3Count           = safeNumber(metrics.h3Count);
    const headingDensity    = safeNumber(metrics.headingDensity);
    const listCount         = safeNumber(metrics.listCount);
    const tableCount        = safeNumber(metrics.tableCount);
    const contentDensity    = safeNumber(metrics.contentDensity);

    // ── Compute per-component scores ─────────────────────────────────────────
    const depthScore     = scoreContentDepth(wordCount);
    const structureScore = scoreStructure(headingCount, h2Count, h3Count, headingDensity);
    const paraScore      = scoreParagraphQuality(paragraphCount, avgParagraphWords);
    const sentScore      = scoreSentenceStructure(sentenceCount, avgSentenceWords, longSentenceRatio);
    // Richness baseline only applies when there IS content
    const richnessScore  = wordCount > 0 ? scoreContentRichness(listCount, tableCount) : 0;
    const introScore     = scoreIntroCompleteness(wordCountIntro);
    const healthScore    = scoreStructuralHealth(contentDensity, wordCount);

    // ── Build result ─────────────────────────────────────────────────────────
    const builder = new ModuleScoreBuilder(this.id, this.name)
      .addContribution("depth",      depthScore,     W_DEPTH)
      .addContribution("structure",  structureScore, W_STRUCTURE)
      .addContribution("paragraphs", paraScore,      W_PARAGRAPHS)
      .addContribution("sentences",  sentScore,      W_SENTENCES)
      .addContribution("richness",   richnessScore,  W_RICHNESS)
      .addContribution("intro",      introScore,     W_INTRO)
      .addContribution("health",     healthScore,    W_HEALTH)
      .setExecutionMs(Date.now() - start);

    // ── Apply hard caps for structural failures ───────────────────────────────
    if (wordCount === 0) {
      builder.setCap(EMPTY_CONTENT_CAP);
    } else if (wordCount < CRITICALLY_THIN_THRESHOLD) {
      builder.setCap(CRITICALLY_THIN_CAP);
    }

    // ── Add deterministic recommendations ────────────────────────────────────
    const recs = buildRecommendations(
      wordCount, wordCountIntro, paragraphCount, avgParagraphWords,
      headingCount, h2Count, h3Count, listCount, tableCount,
    );
    for (const r of recs) {
      builder.addRecommendation(r);
    }

    return builder.build();
  }
}

/** Singleton instance for use in QualityEngineConfig.modules. */
export const contentQualityScorer = new ContentQualityScorer();

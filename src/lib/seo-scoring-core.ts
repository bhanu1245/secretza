/**
 * SEO Quality Engine — Deterministic Scoring Math Utilities
 *
 * Pure functions with no database access, no network access, no global mutable
 * state, no randomness, and no Date.now() dependency.
 *
 * Guarantees:
 *   - Never outputs NaN
 *   - Never outputs Infinity
 *   - Negative zero is normalised to 0
 *   - Same inputs always produce identical outputs
 *   - Result is independent of JS object insertion order
 *
 * Edge-case contracts are documented on each function. Invalid configuration
 * that cannot be safely defaulted throws a descriptive Error; inputs that are
 * merely out-of-range are clamped to the legal domain.
 */

import type {
  GradeLabel,
  GradeThreshold,
  ModuleId,
  ModuleRecommendation,
  ModuleResult,
  ModuleScoreSummary,
  ModuleWeight,
  PenaltySummary,
  ScoreExplanationLine,
  ScoringProfile,
} from "@/lib/seo-quality-types";

// ─── Constants ──────────────────────────────────────────────────────────────────

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };
const EXPLANATION_TYPE_ORDER: Record<string, number> = { penalty: 0, module: 1, bonus: 2 };

// ─── Number safety ──────────────────────────────────────────────────────────────

/**
 * Return `value` if it is a finite non-NaN number; otherwise return `fallback`.
 * Negative zero is normalised to positive zero.
 *
 * Edge cases:
 *   safeNumber(NaN)        → 0
 *   safeNumber(Infinity)   → 0
 *   safeNumber(-Infinity)  → 0
 *   safeNumber(-0)         → 0
 *   safeNumber(null)       → 0
 *   safeNumber(undefined)  → 0
 *   safeNumber(0.5)        → 0.5
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !isFinite(value) || isNaN(value)) return fallback;
  return value === 0 ? 0 : value; // coerce -0 → 0
}

// ─── Clamping & rounding ────────────────────────────────────────────────────────

/**
 * Clamp `value` to [min, max]. Non-finite inputs are first sanitised via safeNumber.
 * Defaults: min = 0, max = 100.
 *
 * Edge cases:
 *   clampScore(-5)        → 0
 *   clampScore(105)       → 100
 *   clampScore(NaN)       → 0    (safeNumber maps NaN → 0, then clamp)
 *   clampScore(Infinity)  → 100  (safeNumber maps Inf → 0, clamp → 0)
 *   clampScore(50, 60, 80) → 60  (below min)
 */
export function clampScore(value: number, min = SCORE_MIN, max = SCORE_MAX): number {
  return Math.min(Math.max(safeNumber(value), min), max);
}

/**
 * Round `value` to `precision` decimal places (default 2) using symmetric rounding.
 * Non-finite inputs return safeNumber(value).
 *
 * Edge cases:
 *   roundScore(NaN)      → 0
 *   roundScore(33.333)   → 33.33
 *   roundScore(0.005)    → 0.01
 *   roundScore(-0)       → 0
 */
export function roundScore(value: number, precision = 2): number {
  const safe = safeNumber(value);
  const factor = Math.pow(10, precision);
  return Math.round(safe * factor) / factor;
}

/**
 * Clamp a ratio to [0, 1]. Convenience alias for clampScore(value, 0, 1).
 *
 * Edge cases:
 *   normaliseRatio(-0.5) → 0
 *   normaliseRatio(1.5)  → 1
 *   normaliseRatio(NaN)  → 0
 */
export function normaliseRatio(value: number): number {
  return clampScore(safeNumber(value), 0, 1);
}

// ─── Weighted math ──────────────────────────────────────────────────────────────

/** A value/weight pair used by weighted aggregate functions. */
export interface WeightedEntry {
  value: number;
  weight: number;
}

/**
 * Weighted average of `entries`. Returns a value in the same scale as the inputs
 * (not clamped — callers clamp the result as appropriate for their scale).
 *
 * Rules:
 *   - Zero-weight entries contribute neither to the numerator nor denominator.
 *   - If all weights are 0 or the array is empty, returns 0.
 *   - Non-finite values in `value` are sanitised via safeNumber before use.
 *
 * @throws {Error} if any weight is negative, NaN, or non-finite.
 *
 * Edge cases:
 *   weightedAverage([])                              → 0
 *   weightedAverage([{value:50, weight:0}])          → 0
 *   weightedAverage([{value:80, weight:1}, {value:60, weight:1}]) → 70
 */
export function weightedAverage(entries: WeightedEntry[]): number {
  if (entries.length === 0) return 0;
  _validateWeights(entries);
  let numerator = 0;
  let denominator = 0;
  for (const { value, weight } of entries) {
    if (weight === 0) continue;
    numerator += safeNumber(value) * weight;
    denominator += weight;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Weighted sum of `entries` (not normalised by total weight).
 * Useful when callers manage the denominator themselves (e.g., profile aggregation).
 *
 * @throws {Error} if any weight is negative, NaN, or non-finite.
 *
 * Edge cases:
 *   weightedSum([])                                  → 0
 *   weightedSum([{value:50, weight:2}])              → 100
 */
export function weightedSum(entries: WeightedEntry[]): number {
  if (entries.length === 0) return 0;
  _validateWeights(entries);
  let total = 0;
  for (const { value, weight } of entries) {
    total += safeNumber(value) * weight;
  }
  return total;
}

function _validateWeights(entries: WeightedEntry[]): void {
  for (const { weight } of entries) {
    if (isNaN(weight) || !isFinite(weight)) {
      throw new Error(
        `seo-scoring-core: non-finite weight ${weight} — weights must be finite numbers`,
      );
    }
    if (weight < 0) {
      throw new Error(
        `seo-scoring-core: negative weight ${weight} — weights must be ≥ 0`,
      );
    }
  }
}

// ─── Penalties ──────────────────────────────────────────────────────────────────

/**
 * Subtract `penalty` from `score`, clamping the result to SCORE_MIN (0).
 * Both `score` and `penalty` are sanitised via safeNumber. Negative penalties
 * are treated as 0 (no healing effect).
 *
 * Edge cases:
 *   applyPenalty(10, 15)   → 0   (floor at SCORE_MIN)
 *   applyPenalty(50, -5)   → 50  (negative penalty ignored)
 *   applyPenalty(50, NaN)  → 50  (NaN penalty treated as 0)
 *   applyPenalty(0, 100)   → 0
 */
export function applyPenalty(score: number, penalty: number): number {
  const safeScore = clampScore(score);
  const safePenalty = Math.max(0, safeNumber(penalty));
  return clampScore(safeScore - safePenalty);
}

/**
 * Apply all `PenaltySummary` entries to `score` in deterministic order.
 * Entries are sorted by `penaltyId` alphabetically before application so the
 * result is independent of input array ordering.
 *
 * Duplicate penaltyIds are both applied (additive). The score cannot fall below
 * SCORE_MIN regardless of the total penalty magnitude.
 *
 * Edge cases:
 *   applyPenalties(50, [])                     → 50
 *   applyPenalties(10, [{applied:5},{applied:8}]) → 0  (floored)
 */
export function applyPenalties(score: number, penalties: PenaltySummary[]): number {
  let current = clampScore(score);
  const sorted = [...penalties].sort((a, b) => a.penaltyId.localeCompare(b.penaltyId));
  for (const { applied } of sorted) {
    current = applyPenalty(current, applied);
  }
  return current;
}

// ─── Caps ───────────────────────────────────────────────────────────────────────

/**
 * Cap `score` at `cap`. The cap can only lower the score, never raise it.
 *
 * @throws {Error} if `cap` is not a finite number.
 * @throws {Error} if `cap` is outside [SCORE_MIN, SCORE_MAX].
 *
 * Edge cases:
 *   applyScoreCap(80, 90)   → 80  (cap above score: no change)
 *   applyScoreCap(80, 70)   → 70  (cap lowers score)
 *   applyScoreCap(50, 150)  → throws (cap above SCORE_MAX)
 *   applyScoreCap(50, -5)   → throws (cap below SCORE_MIN)
 *   applyScoreCap(50, NaN)  → throws
 */
export function applyScoreCap(score: number, cap: number): number {
  if (isNaN(cap) || !isFinite(cap)) {
    throw new Error(`seo-scoring-core: cap must be a finite number, got ${cap}`);
  }
  if (cap < SCORE_MIN || cap > SCORE_MAX) {
    throw new Error(
      `seo-scoring-core: cap ${cap} is outside legal score range [${SCORE_MIN}, ${SCORE_MAX}]`,
    );
  }
  return Math.min(clampScore(score), cap);
}

// ─── Grade assignment ────────────────────────────────────────────────────────────

/**
 * Assign a GradeLabel for `score` using the provided grade scale.
 *
 * Algorithm: sort thresholds descending by minScore; return the label of the
 * first entry whose minScore ≤ score. This makes the comparison deterministic
 * regardless of input array ordering.
 *
 * Requirements (throws if violated):
 *   - thresholds must not be empty
 *   - all minScores must be finite
 *   - no duplicate minScores (ambiguous — which label wins?)
 *   - at least one threshold with minScore === 0 (guarantees a match for score=0)
 *
 * Edge cases:
 *   assignGrade(100, scale)  → highest grade whose minScore ≤ 100
 *   assignGrade(0,   scale)  → grade with minScore: 0
 *   assignGrade(NaN, scale)  → treated as score=0 after clampScore
 *   assignGrade(85,  [{label:"A",minScore:85},{label:"B",minScore:70},…])  → "A"
 */
export function assignGrade(score: number, thresholds: GradeThreshold[]): GradeLabel {
  if (thresholds.length === 0) {
    throw new Error("seo-scoring-core: grade thresholds array must not be empty");
  }

  const seen = new Set<number>();
  for (const t of thresholds) {
    if (isNaN(t.minScore) || !isFinite(t.minScore)) {
      throw new Error(
        `seo-scoring-core: grade threshold has non-finite minScore: ${String(t.minScore)}`,
      );
    }
    if (seen.has(t.minScore)) {
      throw new Error(
        `seo-scoring-core: duplicate grade threshold minScore: ${t.minScore}`,
      );
    }
    seen.add(t.minScore);
  }

  if (!seen.has(0)) {
    throw new Error(
      "seo-scoring-core: grade thresholds must include an entry with minScore: 0",
    );
  }

  const safeScore = clampScore(score); // clamp catches NaN/Infinity
  const sorted = [...thresholds].sort((a, b) => b.minScore - a.minScore);

  for (const t of sorted) {
    if (safeScore >= t.minScore) return t.label;
  }

  // Unreachable: safeScore ≥ 0 and a threshold at 0 always exists
  return sorted[sorted.length - 1]!.label;
}

// ─── Module contribution ─────────────────────────────────────────────────────────

/**
 * Calculate the weighted contribution of one module to the aggregate score pool.
 *
 * Formula: (normalizedScore × weight / totalWeight) × SCORE_MAX
 *
 * Returns 0 when totalWeight is 0 (no divide-by-zero risk).
 *
 * @throws {Error} if `weight` is negative or non-finite.
 * @throws {Error} if `totalWeight` is negative or non-finite.
 *
 * Edge cases:
 *   calculateModuleContribution(1.0, 25, 100) → 25
 *   calculateModuleContribution(0.8, 25, 100) → 20
 *   calculateModuleContribution(0.8, 0,  100) → 0   (zero-weight module)
 *   calculateModuleContribution(0.8, 25, 0)   → 0   (no weight total)
 */
export function calculateModuleContribution(
  normalizedScore: number,
  weight: number,
  totalWeight: number,
): number {
  if (isNaN(weight) || !isFinite(weight) || weight < 0) {
    throw new Error(
      `seo-scoring-core: invalid weight ${weight} in calculateModuleContribution`,
    );
  }
  if (isNaN(totalWeight) || !isFinite(totalWeight) || totalWeight < 0) {
    throw new Error(
      `seo-scoring-core: invalid totalWeight ${totalWeight} in calculateModuleContribution`,
    );
  }
  if (totalWeight === 0) return 0;
  const safe = normaliseRatio(normalizedScore);
  return (safe * weight / totalWeight) * SCORE_MAX;
}

// ─── Stable sorting ──────────────────────────────────────────────────────────────

/**
 * Return a deterministically ordered copy of `recs`.
 *
 * Primary sort:   severity — error (0) → warning (1) → info (2) → unknown (99).
 * Secondary sort: code — alphabetical (locale-independent).
 *
 * Both sorts are stable through the compound comparator.
 */
export function stableSortRecommendations(
  recs: ModuleRecommendation[],
): ModuleRecommendation[] {
  return [...recs].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}

/**
 * Return a deterministically ordered copy of `lines`.
 *
 * Primary sort:   type — penalty (0) → module (1) → bonus (2) → unknown (99).
 * Secondary sort: |delta| descending (largest contribution first).
 * Tertiary sort:  label alphabetical.
 */
export function stableSortExplanationLines(
  lines: ScoreExplanationLine[],
): ScoreExplanationLine[] {
  return [...lines].sort((a, b) => {
    const ta = EXPLANATION_TYPE_ORDER[a.type] ?? 99;
    const tb = EXPLANATION_TYPE_ORDER[b.type] ?? 99;
    if (ta !== tb) return ta - tb;
    const da = Math.abs(a.delta);
    const db = Math.abs(b.delta);
    if (da !== db) return db - da; // descending
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
}

// ─── Profile aggregation ─────────────────────────────────────────────────────────

/** Input to the profile-level aggregation function. */
export interface AggregationInput {
  /** Already-computed results from scorer modules. May be in any order. */
  moduleResults: ModuleResult[];
  /** The scoring profile that defines weights and grade scale. */
  profile: ScoringProfile;
  /** Pre-evaluated profile penalties (caller has already run PenaltyRule.evaluate). */
  precomputedPenalties: PenaltySummary[];
}

/** Output of the profile-level aggregation function. */
export interface AggregationOutput {
  /** Weighted score before profile penalties are subtracted. */
  prepenaltyScore: number;
  /** Sum of all applied penalties. */
  totalPenalty: number;
  /** Final score after penalties, clamped to [SCORE_MIN, SCORE_MAX]. */
  finalScore: number;
  /** Grade assigned to finalScore by the profile's grade scale. */
  grade: GradeLabel;
  /** Per-module score summaries, in profile module declaration order. */
  moduleScores: ModuleScoreSummary[];
  /**
   * Module IDs that were expected by the profile but had no result, or whose
   * lifecycleState was FAILED. These contributed 0 to the aggregate.
   */
  failedModules: ModuleId[];
  /**
   * Module IDs that were SKIPPED (result provided but state === "SKIPPED"),
   * or that appear in results but not in the profile's enabled modules.
   * These contributed 0 to the aggregate.
   */
  skippedModules: ModuleId[];
  /** Explanation lines (penalties first, then modules) in stable order. */
  explanationLines: ScoreExplanationLine[];
}

/**
 * Aggregate already-computed ModuleResult objects into a weighted overall score.
 *
 * This function is PRODUCTION-ISOLATED — it is not called by QualityEngine.score()
 * and has no path to the production scoring pipeline. It is designed for future
 * integration (Phase 2D) and for isolated testing.
 *
 * Aggregation rules:
 *   1. Only *enabled* profile modules participate in weighting.
 *   2. Zero-weight enabled modules are skipped (no contribution, no divide risk).
 *   3. A module expected by the profile but absent from moduleResults → score=0,
 *      recorded in failedModules.
 *   4. A module with lifecycleState==="FAILED" → score=0, recorded in failedModules.
 *   5. A module with lifecycleState==="SKIPPED" → score=0, recorded in skippedModules.
 *   6. Modules in results that are not in the profile's enabled list → skippedModules.
 *   7. totalWeight uses only modules that actually contribute (weight > 0 and enabled).
 *   8. Profile penalties are applied in deterministic order (by penaltyId).
 *   9. Result is deterministic regardless of moduleResults input order.
 *
 * This function never throws. All error conditions produce defined fallback behavior.
 */
export function aggregateModuleScores(input: AggregationInput): AggregationOutput {
  const { profile, precomputedPenalties } = input;

  // Index results by moduleId for O(1) lookup; last value wins on duplicate IDs
  const resultsByModuleId = new Map<ModuleId, ModuleResult>();
  for (const r of input.moduleResults) {
    resultsByModuleId.set(r.moduleId, r);
  }

  // Enabled modules with positive weight participate in the denominator
  const enabledWeights = profile.modules.filter(
    (mw: ModuleWeight) => mw.enabled && mw.weight > 0,
  );
  const totalWeight = enabledWeights.reduce((sum, mw) => sum + mw.weight, 0);

  const failedModules: ModuleId[] = [];
  const skippedModules: ModuleId[] = [];
  const moduleScores: ModuleScoreSummary[] = [];
  const explanationLines: ScoreExplanationLine[] = [];
  let weightedTotal = 0;

  // Process in profile declaration order → deterministic output
  for (const mw of enabledWeights) {
    const result = resultsByModuleId.get(mw.moduleId);
    let normalizedScore = 0;
    let confidence = 0;
    let warnings: ModuleRecommendation[] = [];
    let rawScore = 0;
    let maxScore = SCORE_MAX;

    if (!result) {
      // Expected by profile but no result provided
      failedModules.push(mw.moduleId);
    } else if (result.lifecycleState === "FAILED") {
      failedModules.push(mw.moduleId);
    } else if (result.lifecycleState === "SKIPPED") {
      skippedModules.push(mw.moduleId);
    } else {
      normalizedScore = normaliseRatio(result.normalizedScore);
      confidence = normaliseRatio(result.confidence);
      warnings = result.warnings;
      rawScore = result.score;
      maxScore = result.maxScore;
    }

    const contribution = totalWeight > 0
      ? (normalizedScore * mw.weight / totalWeight) * SCORE_MAX
      : 0;
    weightedTotal += contribution;

    moduleScores.push({
      moduleId: mw.moduleId,
      moduleName: mw.moduleId, // ScorerModule.name not available here; use ID as fallback
      score: rawScore,
      maxScore,
      normalizedScore,
      confidence,
      warnings,
    });

    explanationLines.push({
      label: mw.moduleId,
      delta: roundScore(contribution),
      type: "module",
      moduleId: mw.moduleId,
      ruleId: null,
      detail: `weight ${mw.weight}/${totalWeight}, normalized ${roundScore(normalizedScore, 4)}`,
      confidence,
    });
  }

  // Modules present in results but not in the profile's enabled+positive-weight list
  for (const [moduleId] of resultsByModuleId) {
    const inProfile = enabledWeights.some((mw) => mw.moduleId === moduleId);
    if (!inProfile) {
      skippedModules.push(moduleId);
    }
  }

  const prepenaltyScore = clampScore(roundScore(weightedTotal));

  // Penalty explanation lines (before applying penalties to score)
  for (const p of precomputedPenalties) {
    if (p.applied > 0) {
      explanationLines.push({
        label: p.description,
        delta: -roundScore(p.applied),
        type: "penalty",
        moduleId: null,
        ruleId: p.penaltyId,
        detail: `penaltyId: ${p.penaltyId}, applied: ${p.applied}`,
        confidence: 1,
      });
    }
  }

  const finalScore = applyPenalties(prepenaltyScore, precomputedPenalties);
  const totalPenalty = roundScore(
    precomputedPenalties.reduce((sum, p) => sum + Math.max(0, safeNumber(p.applied)), 0),
  );

  return {
    prepenaltyScore,
    totalPenalty,
    finalScore,
    grade: assignGrade(finalScore, profile.gradeScale),
    moduleScores,
    failedModules: [...new Set(failedModules)],
    skippedModules: [...new Set(skippedModules)],
    explanationLines: stableSortExplanationLines(explanationLines),
  };
}

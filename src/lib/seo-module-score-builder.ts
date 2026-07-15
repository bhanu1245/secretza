/**
 * SEO Quality Engine — Module Score Builder
 *
 * Provides a fluent builder for constructing ModuleResult objects inside
 * ScorerModule.score() implementations. Scorer modules declare contributions,
 * penalties, recommendations, and explanation lines; the builder applies the
 * scoring math consistently so each scorer cannot diverge in arithmetic.
 *
 * Guarantees:
 *   - Same inputs always produce identical outputs (deterministic).
 *   - Recommendations are deduplicated by `code` before output.
 *   - Warnings are deduplicated by `code` before output.
 *   - Explanation lines are deduplicated by `label+type` before stable sort.
 *   - Score never leaves [SCORE_MIN, SCORE_MAX].
 *   - No NaN, no Infinity, no negative-zero in any numeric output field.
 *   - breakdown exposes every contribution value plus internal accounting fields.
 *
 * Scoring formula (applied in build()):
 *   rawScore        = weightedAverage(contributions, weights)  [0–100]
 *   postPenalty     = rawScore − Σ(penalties), clamped ≥ 0
 *   finalScore      = min(postPenalty, cap)  if cap is set, else postPenalty
 *   normalizedScore = finalScore / SCORE_MAX
 *
 * Usage notes:
 *   This builder is infrastructure only — it contains no SEO scoring logic.
 *   Domain-specific thresholds, weights, and rules live in each ScorerModule.
 */

import type {
  ModuleBreakdown,
  ModuleId,
  ModuleLifecycleState,
  ModuleRecommendation,
  ModuleResult,
  PenaltySummary,
  ScoreExplanationLine,
} from "@/lib/seo-quality-types";
import {
  SCORE_MAX,
  applyPenalties,
  applyScoreCap,
  clampScore,
  normaliseRatio,
  roundScore,
  safeNumber,
  stableSortExplanationLines,
  stableSortRecommendations,
  weightedAverage,
} from "@/lib/seo-scoring-core";

// ─── Internal entry types ────────────────────────────────────────────────────────

interface ContributionEntry {
  readonly key: string;
  readonly value: number;  // 0–100
  readonly weight: number; // relative weight (≥ 0)
}

interface InternalPenalty {
  readonly id: string;
  readonly description: string;
  readonly amount: number; // ≥ 0
}

// ─── Builder ─────────────────────────────────────────────────────────────────────

/**
 * Fluent builder that collects scoring inputs and produces a deterministic
 * ModuleResult via build().
 *
 * All mutating methods return `this` for chaining.
 * Calling build() does not reset the builder — it can be called multiple times
 * with identical results (assuming no mutations occur between calls).
 */
export class ModuleScoreBuilder {
  private readonly moduleId: ModuleId;
  private readonly moduleName: string;

  private readonly contributions: ContributionEntry[] = [];
  private readonly penalties: InternalPenalty[] = [];
  private readonly recommendations: ModuleRecommendation[] = [];
  private readonly warnings: ModuleRecommendation[] = [];
  private readonly explanationLines: ScoreExplanationLine[] = [];

  private cap: number | null = null;
  private lifecycleState: ModuleLifecycleState = "EXECUTING";
  private confidence = 1.0;
  private executionMs = 0;

  constructor(moduleId: ModuleId, moduleName?: string) {
    if (!moduleId || typeof moduleId !== "string" || moduleId.trim() === "") {
      throw new Error("ModuleScoreBuilder: moduleId must be a non-empty string");
    }
    this.moduleId = moduleId;
    this.moduleName = moduleName ?? moduleId;
  }

  // ─── Contribution ───────────────────────────────────────────────────────────

  /**
   * Add a scored sub-component contribution.
   *
   * @param key    Unique key for this contribution; appears in breakdown.
   * @param value  Sub-score on a 0–100 scale (clamped if out of range).
   * @param weight Relative weight ≥ 0; zero-weight contributions appear in
   *               breakdown but do not affect the weighted average.
   *
   * @throws {Error} if key is empty or weight is negative/non-finite.
   */
  addContribution(key: string, value: number, weight: number): this {
    if (!key || typeof key !== "string" || key.trim() === "") {
      throw new Error("ModuleScoreBuilder.addContribution: key must be a non-empty string");
    }
    if (isNaN(weight) || !isFinite(weight) || weight < 0) {
      throw new Error(
        `ModuleScoreBuilder.addContribution: weight must be a finite number ≥ 0, got ${weight}`,
      );
    }
    this.contributions.push({ key, value: safeNumber(value), weight });
    return this;
  }

  // ─── Penalty ────────────────────────────────────────────────────────────────

  /**
   * Add a score penalty.
   *
   * @param id          Stable identifier for this penalty type.
   * @param description Human-readable description (appears in PenaltySummary).
   * @param amount      Points to subtract (≥ 0). Negative values are ignored.
   *
   * @throws {Error} if id is empty or amount is non-finite.
   */
  addPenalty(id: string, description: string, amount: number): this {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new Error("ModuleScoreBuilder.addPenalty: id must be a non-empty string");
    }
    if (isNaN(amount) || !isFinite(amount)) {
      throw new Error(
        `ModuleScoreBuilder.addPenalty: amount must be a finite number, got ${amount}`,
      );
    }
    this.penalties.push({ id, description, amount: Math.max(0, safeNumber(amount)) });
    return this;
  }

  // ─── Recommendation ─────────────────────────────────────────────────────────

  /**
   * Add an actionable recommendation (issue the scorer detected).
   * Duplicate codes are deduplicated in build() — first occurrence wins.
   */
  addRecommendation(rec: ModuleRecommendation): this {
    this.recommendations.push(rec);
    return this;
  }

  // ─── Warning ────────────────────────────────────────────────────────────────

  /**
   * Add a non-blocking warning.
   * Duplicate codes are deduplicated in build() — first occurrence wins.
   */
  addWarning(rec: ModuleRecommendation): this {
    this.warnings.push(rec);
    return this;
  }

  // ─── Explanation ────────────────────────────────────────────────────────────

  /**
   * Add an explanation line for the audit trail.
   * Lines with identical `label+type` pairs are deduplicated in build() —
   * first occurrence wins.
   */
  addExplanationLine(line: ScoreExplanationLine): this {
    this.explanationLines.push(line);
    return this;
  }

  // ─── Cap ────────────────────────────────────────────────────────────────────

  /**
   * Set an optional hard score cap.
   * The cap lowers the final score if the computed score exceeds it.
   * It cannot raise the score.
   *
   * @throws {Error} if cap is outside [SCORE_MIN, SCORE_MAX] or non-finite.
   */
  setCap(cap: number): this {
    // Validate immediately so the error points to the setter, not build()
    applyScoreCap(0, cap); // throws on invalid cap; result discarded
    this.cap = cap;
    return this;
  }

  // ─── Metadata ───────────────────────────────────────────────────────────────

  /**
   * Override the lifecycle state. Default is "EXECUTING" → resolves to
   * "COMPLETED" in build(). Set to "FAILED" or "SKIPPED" before build()
   * to short-circuit scoring (the builder still produces a zero-score result).
   */
  setLifecycleState(state: ModuleLifecycleState): this {
    this.lifecycleState = state;
    return this;
  }

  /**
   * Set the confidence level for this module's score (0–1 inclusive).
   * Values outside this range are clamped in build().
   */
  setConfidence(confidence: number): this {
    this.confidence = safeNumber(confidence, 1.0);
    return this;
  }

  /** Record execution duration for telemetry (non-negative ms). */
  setExecutionMs(ms: number): this {
    this.executionMs = Math.max(0, safeNumber(ms));
    return this;
  }

  // ─── Build ───────────────────────────────────────────────────────────────────

  /**
   * Produce the final immutable ModuleResult.
   *
   * Scoring pipeline (see module docstring for formula):
   *   1. rawScore      = weightedAverage(contributions)        [0–100]
   *   2. postPenalty   = rawScore − sorted penalties           [≥ 0]
   *   3. finalScore    = min(postPenalty, cap)  if cap is set  [0–100]
   *   4. normalizedScore = finalScore / SCORE_MAX              [0–1]
   *
   * If lifecycleState is FAILED or SKIPPED, all scores are 0 but the breakdown
   * still records contributions so the reason for failure is auditable.
   *
   * Recommendations: deduplicated by `code`; first occurrence wins; stable sort.
   * Warnings:        deduplicated by `code`; first occurrence wins; stable sort.
   * Explanation lines: deduplicated by `label+type`; first occurrence wins; stable sort.
   * Breakdown: key→value for every contribution plus `_rawScore`, `_penaltyTotal`,
   *            `_cappedScore`, `_finalScore`.
   */
  build(): ModuleResult {
    const isFailed = this.lifecycleState === "FAILED";
    const isSkipped = this.lifecycleState === "SKIPPED";

    // ── Contributions ──────────────────────────────────────────────────────────
    const clampedContributions = this.contributions.map((c) => ({
      value: clampScore(c.value),
      weight: c.weight,
    }));

    const rawScore = (isFailed || isSkipped)
      ? 0
      : clampScore(weightedAverage(clampedContributions));

    // ── Penalties ──────────────────────────────────────────────────────────────
    const penaltySummaries: PenaltySummary[] = this.penalties.map((p) => ({
      penaltyId: p.id,
      description: p.description,
      applied: p.amount,
    }));

    const penaltyTotal = roundScore(
      penaltySummaries.reduce((sum, p) => sum + p.applied, 0),
    );

    const postPenaltyScore = (isFailed || isSkipped)
      ? 0
      : applyPenalties(rawScore, penaltySummaries);

    // ── Cap ───────────────────────────────────────────────────────────────────
    const cappedScore = (this.cap !== null && !isFailed && !isSkipped)
      ? applyScoreCap(postPenaltyScore, this.cap)
      : postPenaltyScore;

    const finalScore = roundScore(clampScore(cappedScore));

    // ── Derived ───────────────────────────────────────────────────────────────
    const normalizedScore = roundScore(normaliseRatio(finalScore / SCORE_MAX), 6);
    const confidence = roundScore(normaliseRatio(this.confidence), 4);

    // ── Breakdown ─────────────────────────────────────────────────────────────
    const breakdown: ModuleBreakdown = {};
    for (const c of this.contributions) {
      breakdown[c.key] = roundScore(clampScore(c.value));
    }
    breakdown["_rawScore"] = roundScore(rawScore);
    breakdown["_penaltyTotal"] = penaltyTotal;
    breakdown["_cappedScore"] = roundScore(cappedScore);
    breakdown["_finalScore"] = finalScore;

    // ── Dedup recommendations ─────────────────────────────────────────────────
    const seenRecCodes = new Set<string>();
    const dedupedRecs = stableSortRecommendations(
      this.recommendations.filter((r) => {
        if (seenRecCodes.has(r.code)) return false;
        seenRecCodes.add(r.code);
        return true;
      }),
    );

    // ── Dedup warnings ────────────────────────────────────────────────────────
    const seenWarnCodes = new Set<string>();
    const dedupedWarnings = stableSortRecommendations(
      this.warnings.filter((w) => {
        if (seenWarnCodes.has(w.code)) return false;
        seenWarnCodes.add(w.code);
        return true;
      }),
    );

    // ── Dedup explanation lines ───────────────────────────────────────────────
    const seenLineKeys = new Set<string>();
    const dedupedLines = stableSortExplanationLines(
      this.explanationLines.filter((l) => {
        const key = `${l.type}:${l.label}`;
        if (seenLineKeys.has(key)) return false;
        seenLineKeys.add(key);
        return true;
      }),
    );

    return {
      moduleId: this.moduleId,
      score: finalScore,
      maxScore: SCORE_MAX,
      normalizedScore,
      confidence,
      breakdown,
      recommendations: dedupedRecs,
      warnings: dedupedWarnings,
      executionMs: this.executionMs,
      lifecycleState: (isFailed || isSkipped) ? this.lifecycleState : "COMPLETED",
    };
  }
}

// ─── Factory helpers ─────────────────────────────────────────────────────────────

/**
 * Produce a zero-score FAILED ModuleResult without requiring a full builder chain.
 * Used when a scorer encounters an unrecoverable error.
 */
export function buildFailedModuleResult(
  moduleId: ModuleId,
  reason: string,
): ModuleResult {
  return new ModuleScoreBuilder(moduleId)
    .setLifecycleState("FAILED")
    .addWarning({
      severity: "error",
      code: "MODULE_FAILED",
      message: reason,
      field: null,
    })
    .build();
}

/**
 * Produce a zero-score SKIPPED ModuleResult without requiring a full builder chain.
 * Used when a scorer determines it is not applicable to the given input.
 */
export function buildSkippedModuleResult(
  moduleId: ModuleId,
  reason: string,
): ModuleResult {
  return new ModuleScoreBuilder(moduleId)
    .setLifecycleState("SKIPPED")
    .addWarning({
      severity: "info",
      code: "MODULE_SKIPPED",
      message: reason,
      field: null,
    })
    .build();
}

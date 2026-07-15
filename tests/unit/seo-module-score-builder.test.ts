/**
 * Unit tests for seo-module-score-builder.ts
 *
 * Covers: empty builder, contributions, penalties, cap, dedup,
 *         lifecycle states, NaN protection, determinism.
 *
 * Run: npx vitest run tests/unit/seo-module-score-builder.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  ModuleScoreBuilder,
  buildFailedModuleResult,
  buildSkippedModuleResult,
} from "@/lib/seo-module-score-builder";
import type { ModuleRecommendation, ScoreExplanationLine } from "@/lib/seo-quality-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────────

const rec = (code: string, severity: "error" | "warning" | "info" = "warning"): ModuleRecommendation => ({
  severity,
  code,
  message: `msg-${code}`,
  field: null,
});

const expLine = (label: string, type: "module" | "penalty" | "bonus" = "module"): ScoreExplanationLine => ({
  type,
  label,
  delta: 10,
  moduleId: null,
  ruleId: null,
  detail: "",
  confidence: 1,
});

// ─── Constructor ─────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — constructor", () => {
  it("accepts valid moduleId", () => {
    expect(() => new ModuleScoreBuilder("content")).not.toThrow();
  });
  it("throws on empty moduleId", () => {
    expect(() => new ModuleScoreBuilder("")).toThrow(/moduleId/);
  });
  it("throws on whitespace-only moduleId", () => {
    expect(() => new ModuleScoreBuilder("   ")).toThrow(/moduleId/);
  });
  it("uses moduleId as fallback name", () => {
    const result = new ModuleScoreBuilder("content").build();
    expect(result.moduleId).toBe("content");
  });
});

// ─── Empty builder ────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — empty build", () => {
  it("score is 0", () => {
    expect(new ModuleScoreBuilder("m").build().score).toBe(0);
  });
  it("normalizedScore is 0", () => {
    expect(new ModuleScoreBuilder("m").build().normalizedScore).toBe(0);
  });
  it("lifecycleState is COMPLETED", () => {
    expect(new ModuleScoreBuilder("m").build().lifecycleState).toBe("COMPLETED");
  });
  it("recommendations is empty array", () => {
    expect(new ModuleScoreBuilder("m").build().recommendations).toEqual([]);
  });
  it("warnings is empty array", () => {
    expect(new ModuleScoreBuilder("m").build().warnings).toEqual([]);
  });
  it("breakdown has _rawScore = 0", () => {
    expect(new ModuleScoreBuilder("m").build().breakdown["_rawScore"]).toBe(0);
  });
  it("maxScore is 100", () => {
    expect(new ModuleScoreBuilder("m").build().maxScore).toBe(100);
  });
  it("confidence is 1", () => {
    expect(new ModuleScoreBuilder("m").build().confidence).toBe(1);
  });
});

// ─── Contributions ────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — contributions", () => {
  it("single 100-score contribution → finalScore 100", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("coverage", 100, 1)
      .build();
    expect(result.score).toBe(100);
  });

  it("two equal-weight 80/60 → finalScore 70", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .addContribution("b", 60, 1)
      .build();
    expect(result.score).toBe(70);
  });

  it("zero-weight contribution excluded from average but in breakdown", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("counted", 80, 1)
      .addContribution("zero", 0, 0)
      .build();
    expect(result.score).toBe(80);
    expect(result.breakdown["zero"]).toBe(0);
  });

  it("NaN value sanitised to 0", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("bad", NaN, 1)
      .build();
    expect(result.score).toBe(0);
    expect(result.breakdown["bad"]).toBe(0);
  });

  it("contribution value above 100 clamped to 100", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("over", 150, 1)
      .build();
    expect(result.score).toBe(100);
    expect(result.breakdown["over"]).toBe(100);
  });

  it("contribution value below 0 clamped to 0", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("neg", -10, 1)
      .build();
    expect(result.score).toBe(0);
  });

  it("throws on empty key", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addContribution("", 80, 1),
    ).toThrow(/key/);
  });

  it("throws on negative weight", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addContribution("a", 80, -1),
    ).toThrow(/weight/);
  });

  it("throws on NaN weight", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addContribution("a", 80, NaN),
    ).toThrow(/weight/);
  });

  it("throws on Infinity weight", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addContribution("a", 80, Infinity),
    ).toThrow(/weight/);
  });

  it("breakdown key appears for each contribution", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("x", 70, 1)
      .addContribution("y", 90, 1)
      .build();
    expect("x" in result.breakdown).toBe(true);
    expect("y" in result.breakdown).toBe(true);
  });

  it("breakdown includes _rawScore, _penaltyTotal, _cappedScore, _finalScore", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .build();
    expect("_rawScore" in result.breakdown).toBe(true);
    expect("_penaltyTotal" in result.breakdown).toBe(true);
    expect("_cappedScore" in result.breakdown).toBe(true);
    expect("_finalScore" in result.breakdown).toBe(true);
  });
});

// ─── Penalties ────────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — penalties", () => {
  it("single penalty reduces score", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .addPenalty("dup", "Duplicate", 10)
      .build();
    expect(result.score).toBe(70);
    expect(result.breakdown["_penaltyTotal"]).toBe(10);
  });

  it("two penalties stack", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .addPenalty("p1", "P1", 10)
      .addPenalty("p2", "P2", 15)
      .build();
    expect(result.score).toBe(55);
  });

  it("score cannot fall below 0", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 20, 1)
      .addPenalty("big", "Big Penalty", 50)
      .build();
    expect(result.score).toBe(0);
  });

  it("negative penalty amount ignored (treated as 0)", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .addPenalty("neg", "Neg", -10)
      .build();
    expect(result.score).toBe(80); // no reduction
  });

  it("throws on empty penalty id", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addPenalty("", "desc", 10),
    ).toThrow(/id/);
  });

  it("throws on NaN penalty amount", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addPenalty("p", "desc", NaN),
    ).toThrow(/amount/);
  });

  it("throws on Infinity penalty amount", () => {
    expect(() =>
      new ModuleScoreBuilder("m").addPenalty("p", "desc", Infinity),
    ).toThrow(/amount/);
  });

  it("penalty order is deterministic regardless of addition order", () => {
    const r1 = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .addPenalty("aaa", "AAA", 5)
      .addPenalty("bbb", "BBB", 3)
      .build();
    const r2 = new ModuleScoreBuilder("m")
      .addContribution("a", 80, 1)
      .addPenalty("bbb", "BBB", 3)
      .addPenalty("aaa", "AAA", 5)
      .build();
    expect(r1.score).toBe(r2.score);
  });
});

// ─── Cap ─────────────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — cap", () => {
  it("cap lowers score above cap", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 90, 1)
      .setCap(80)
      .build();
    expect(result.score).toBe(80);
  });

  it("cap does not raise score below cap", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 60, 1)
      .setCap(80)
      .build();
    expect(result.score).toBe(60);
  });

  it("cap applies after penalties", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 100, 1)
      .addPenalty("p", "P", 5)
      .setCap(90)
      .build();
    expect(result.score).toBe(90); // 100-5=95, then capped at 90
  });

  it("cap at 0 forces score to 0", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 100, 1)
      .setCap(0)
      .build();
    expect(result.score).toBe(0);
  });

  it("throws on cap below 0", () => {
    expect(() => new ModuleScoreBuilder("m").setCap(-1)).toThrow(/outside legal score range/);
  });

  it("throws on cap above 100", () => {
    expect(() => new ModuleScoreBuilder("m").setCap(101)).toThrow(/outside legal score range/);
  });

  it("throws on NaN cap", () => {
    expect(() => new ModuleScoreBuilder("m").setCap(NaN)).toThrow(/finite/);
  });

  it("cap not applied to FAILED module", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 90, 1)
      .setCap(50)
      .setLifecycleState("FAILED")
      .build();
    expect(result.score).toBe(0);
  });
});

// ─── Recommendations dedup ───────────────────────────────────────────────────────

describe("ModuleScoreBuilder — recommendations dedup", () => {
  it("duplicate codes kept as first occurrence", () => {
    const result = new ModuleScoreBuilder("m")
      .addRecommendation(rec("DUP_TITLE"))
      .addRecommendation(rec("DUP_TITLE")) // duplicate
      .addRecommendation(rec("MISSING_META"))
      .build();
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toEqual(["DUP_TITLE", "MISSING_META"].sort());
    expect(codes.filter((c) => c === "DUP_TITLE")).toHaveLength(1);
  });

  it("different codes all kept", () => {
    const result = new ModuleScoreBuilder("m")
      .addRecommendation(rec("A"))
      .addRecommendation(rec("B"))
      .addRecommendation(rec("C"))
      .build();
    expect(result.recommendations).toHaveLength(3);
  });

  it("sorted: errors before warnings before info", () => {
    const result = new ModuleScoreBuilder("m")
      .addRecommendation(rec("I", "info"))
      .addRecommendation(rec("E", "error"))
      .addRecommendation(rec("W", "warning"))
      .build();
    expect(result.recommendations[0]!.severity).toBe("error");
    expect(result.recommendations[1]!.severity).toBe("warning");
    expect(result.recommendations[2]!.severity).toBe("info");
  });
});

// ─── Warnings dedup ──────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — warnings dedup", () => {
  it("duplicate warning codes kept as first", () => {
    const result = new ModuleScoreBuilder("m")
      .addWarning(rec("W1"))
      .addWarning(rec("W1"))
      .addWarning(rec("W2"))
      .build();
    expect(result.warnings).toHaveLength(2);
  });

  it("recommendations and warnings are separate lists", () => {
    const result = new ModuleScoreBuilder("m")
      .addRecommendation(rec("SAME_CODE", "error"))
      .addWarning(rec("SAME_CODE", "warning"))
      .build();
    expect(result.recommendations).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });
});

// ─── Explanation lines ────────────────────────────────────────────────────────────
// addExplanationLine is accepted by the builder and fed into aggregateModuleScores.
// ModuleResult has no explanationLines field — they live in AggregationOutput.
// We verify addExplanationLine does not throw and build() still succeeds.

describe("ModuleScoreBuilder — addExplanationLine", () => {
  it("adding explanation lines does not throw and build() succeeds", () => {
    expect(() =>
      new ModuleScoreBuilder("m")
        .addExplanationLine(expLine("Content Score"))
        .addExplanationLine(expLine("Content Score")) // dup — silently deduped internally
        .addExplanationLine(expLine("Meta Score"))
        .build(),
    ).not.toThrow();
  });

  it("same label different type both accepted", () => {
    expect(() =>
      new ModuleScoreBuilder("m")
        .addExplanationLine(expLine("Dup", "module"))
        .addExplanationLine(expLine("Dup", "penalty"))
        .build(),
    ).not.toThrow();
  });
});

// ─── Lifecycle states ─────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — lifecycle states", () => {
  it("FAILED → score 0, lifecycleState FAILED", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 90, 1)
      .setLifecycleState("FAILED")
      .build();
    expect(result.score).toBe(0);
    expect(result.lifecycleState).toBe("FAILED");
    expect(result.normalizedScore).toBe(0);
  });

  it("SKIPPED → score 0, lifecycleState SKIPPED", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 90, 1)
      .setLifecycleState("SKIPPED")
      .build();
    expect(result.score).toBe(0);
    expect(result.lifecycleState).toBe("SKIPPED");
  });

  it("EXECUTING (default) resolves to COMPLETED in build()", () => {
    const result = new ModuleScoreBuilder("m").build();
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("FAILED module still has contributions in breakdown", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("coverage", 80, 1)
      .setLifecycleState("FAILED")
      .build();
    expect("coverage" in result.breakdown).toBe(true);
  });
});

// ─── Confidence ──────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — confidence", () => {
  it("setConfidence sets value", () => {
    const result = new ModuleScoreBuilder("m").setConfidence(0.75).build();
    expect(result.confidence).toBeCloseTo(0.75, 4);
  });

  it("confidence above 1 clamped to 1", () => {
    const result = new ModuleScoreBuilder("m").setConfidence(1.5).build();
    expect(result.confidence).toBe(1);
  });

  it("confidence below 0 clamped to 0", () => {
    const result = new ModuleScoreBuilder("m").setConfidence(-0.5).build();
    expect(result.confidence).toBe(0);
  });

  it("NaN confidence falls back to 1.0", () => {
    const result = new ModuleScoreBuilder("m").setConfidence(NaN).build();
    expect(result.confidence).toBe(1);
  });
});

// ─── ExecutionMs ─────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — executionMs", () => {
  it("setExecutionMs records value", () => {
    const result = new ModuleScoreBuilder("m").setExecutionMs(250).build();
    expect(result.executionMs).toBe(250);
  });

  it("negative ms clamped to 0", () => {
    const result = new ModuleScoreBuilder("m").setExecutionMs(-50).build();
    expect(result.executionMs).toBe(0);
  });

  it("NaN ms treated as 0", () => {
    const result = new ModuleScoreBuilder("m").setExecutionMs(NaN).build();
    expect(result.executionMs).toBe(0);
  });
});

// ─── normalizedScore ──────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — normalizedScore", () => {
  it("score 100 → normalizedScore 1", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 100, 1)
      .build();
    expect(result.normalizedScore).toBe(1);
  });

  it("score 50 → normalizedScore 0.5", () => {
    const result = new ModuleScoreBuilder("m")
      .addContribution("a", 50, 1)
      .build();
    expect(result.normalizedScore).toBe(0.5);
  });

  it("normalizedScore has no NaN, no Infinity", () => {
    const result = new ModuleScoreBuilder("m").build();
    expect(isFinite(result.normalizedScore)).toBe(true);
  });

  it("normalizedScore has no negative zero", () => {
    const result = new ModuleScoreBuilder("m").build();
    expect(Object.is(result.normalizedScore, -0)).toBe(false);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────────

describe("ModuleScoreBuilder — determinism", () => {
  it("identical build() calls produce deep-equal output", () => {
    const builder = new ModuleScoreBuilder("m", "Test Module")
      .addContribution("a", 80, 2)
      .addContribution("b", 60, 1)
      .addPenalty("dup", "Duplicate title", 5)
      .addRecommendation(rec("TITLE_TOO_SHORT", "error"))
      .addRecommendation(rec("META_MISSING", "warning"))
      .addExplanationLine(expLine("Content Score"))
      .setCap(90)
      .setConfidence(0.85)
      .setExecutionMs(120);

    const r1 = builder.build();
    const r2 = builder.build();
    expect(r1).toEqual(r2);
  });

  it("results are deep-equal across two distinct builders with same config", () => {
    const make = () =>
      new ModuleScoreBuilder("m")
        .addContribution("a", 75, 3)
        .addContribution("b", 50, 1)
        .addPenalty("p", "P", 3)
        .setCap(85)
        .build();
    expect(make()).toEqual(make());
  });
});

// ─── buildFailedModuleResult ──────────────────────────────────────────────────────

describe("buildFailedModuleResult", () => {
  it("produces FAILED lifecycle", () => {
    expect(buildFailedModuleResult("content", "DB read failed").lifecycleState).toBe("FAILED");
  });

  it("score is 0", () => {
    expect(buildFailedModuleResult("content", "err").score).toBe(0);
  });

  it("normalizedScore is 0", () => {
    expect(buildFailedModuleResult("content", "err").normalizedScore).toBe(0);
  });

  it("includes MODULE_FAILED warning with the reason", () => {
    const result = buildFailedModuleResult("content", "DB read failed");
    const warn = result.warnings.find((w) => w.code === "MODULE_FAILED");
    expect(warn).toBeDefined();
    expect(warn!.message).toContain("DB read failed");
  });

  it("moduleId is preserved", () => {
    expect(buildFailedModuleResult("meta", "err").moduleId).toBe("meta");
  });
});

// ─── buildSkippedModuleResult ────────────────────────────────────────────────────

describe("buildSkippedModuleResult", () => {
  it("produces SKIPPED lifecycle", () => {
    expect(buildSkippedModuleResult("content", "not applicable").lifecycleState).toBe("SKIPPED");
  });

  it("score is 0", () => {
    expect(buildSkippedModuleResult("content", "n/a").score).toBe(0);
  });

  it("includes MODULE_SKIPPED warning with the reason", () => {
    const result = buildSkippedModuleResult("content", "not applicable");
    const warn = result.warnings.find((w) => w.code === "MODULE_SKIPPED");
    expect(warn).toBeDefined();
    expect(warn!.message).toContain("not applicable");
  });

  it("moduleId is preserved", () => {
    expect(buildSkippedModuleResult("keywords", "n/a").moduleId).toBe("keywords");
  });
});

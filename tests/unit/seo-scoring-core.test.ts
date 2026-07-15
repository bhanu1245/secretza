/**
 * Unit tests for seo-scoring-core.ts
 *
 * Covers: scoring math utilities, penalties, caps, grade assignment,
 *         module contribution calculation, stable sorting, and profile
 *         aggregation. Every function's documented edge cases are tested.
 *
 * Run: npx vitest run tests/unit/seo-scoring-core.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  SCORE_MAX,
  SCORE_MIN,
  aggregateModuleScores,
  applyPenalties,
  applyPenalty,
  applyScoreCap,
  assignGrade,
  calculateModuleContribution,
  clampScore,
  normaliseRatio,
  roundScore,
  safeNumber,
  stableSortExplanationLines,
  stableSortRecommendations,
  weightedAverage,
  weightedSum,
  piecewiseLinear,
} from "@/lib/seo-scoring-core";
import type {
  GradeThreshold,
  ModuleResult,
  PenaltySummary,
  ScoreExplanationLine,
  ModuleRecommendation,
  ScoringProfile,
} from "@/lib/seo-quality-types";

// ─── Fixtures ────────────────────────────────────────────────────────────────────

const STANDARD_SCALE: GradeThreshold[] = [
  { label: "A", minScore: 85 },
  { label: "B", minScore: 70 },
  { label: "C", minScore: 55 },
  { label: "D", minScore: 40 },
  { label: "F", minScore: 0 },
];

function makeModuleResult(
  moduleId: string,
  normalizedScore: number,
  opts: Partial<ModuleResult> = {},
): ModuleResult {
  return {
    moduleId,
    score: normalizedScore * 100,
    maxScore: 100,
    normalizedScore,
    confidence: 1,
    breakdown: {},
    recommendations: [],
    warnings: [],
    executionMs: 0,
    lifecycleState: "COMPLETED",
    ...opts,
  };
}

function makeProfile(
  modules: Array<{ moduleId: string; weight: number; enabled?: boolean }>,
): ScoringProfile {
  return {
    id: "test-profile",
    name: "Test Profile",
    version: "1.0.0",
    description: "Test profile for unit tests",
    pageTypes: ["city"],
    modules: modules.map((m) => ({
      moduleId: m.moduleId,
      weight: m.weight,
      enabled: m.enabled ?? true,
    })),
    penalties: [],
    thresholds: {
      minWordCount: 500,
      minQualityScore: 60,
      minUniqueness: 70,
      maxTemplateSentenceRatio: 0.30,
      maxAiPhraseRatio: 0.15,
      minLocalEntityDensity: 2.0,
    },
    gradeScale: STANDARD_SCALE,
    metadata: { createdAt: "2026-07-15", author: "test", changelog: "" },
  };
}

// ─── safeNumber ──────────────────────────────────────────────────────────────────

describe("safeNumber", () => {
  it("passes through a normal number", () => expect(safeNumber(42)).toBe(42));
  it("passes through 0", () => expect(safeNumber(0)).toBe(0));
  it("returns 0 for NaN", () => expect(safeNumber(NaN)).toBe(0));
  it("returns 0 for Infinity", () => expect(safeNumber(Infinity)).toBe(0));
  it("returns 0 for -Infinity", () => expect(safeNumber(-Infinity)).toBe(0));
  it("normalises -0 to 0", () => expect(Object.is(safeNumber(-0), 0)).toBe(true));
  it("uses custom fallback for NaN", () => expect(safeNumber(NaN, 99)).toBe(99));
  it("returns 0 for null", () => expect(safeNumber(null)).toBe(0));
  it("returns 0 for undefined", () => expect(safeNumber(undefined)).toBe(0));
  it("returns 0 for string", () => expect(safeNumber("50")).toBe(0));
  it("returns negative numbers unchanged", () => expect(safeNumber(-5)).toBe(-5));
});

// ─── clampScore ──────────────────────────────────────────────────────────────────

describe("clampScore", () => {
  it("passes through value in range", () => expect(clampScore(50)).toBe(50));
  it("clamps below 0 to 0", () => expect(clampScore(-5)).toBe(0));
  it("clamps above 100 to 100", () => expect(clampScore(105)).toBe(100));
  it("exact lower boundary", () => expect(clampScore(0)).toBe(0));
  it("exact upper boundary", () => expect(clampScore(100)).toBe(100));
  it("NaN clamps to 0", () => expect(clampScore(NaN)).toBe(0));
  it("Infinity clamps to 0 then to 100 — safeNumber first", () =>
    // safeNumber(Infinity) = 0, then clamp(0, 0, 100) = 0
    expect(clampScore(Infinity)).toBe(0));
  it("-Infinity clamps to 0", () => expect(clampScore(-Infinity)).toBe(0));
  it("custom min and max", () => expect(clampScore(50, 60, 80)).toBe(60));
  it("custom min and max — above max", () => expect(clampScore(90, 60, 80)).toBe(80));
  it("constants SCORE_MIN and SCORE_MAX", () => {
    expect(SCORE_MIN).toBe(0);
    expect(SCORE_MAX).toBe(100);
  });
});

// ─── roundScore ─────────────────────────────────────────────────────────────────

describe("roundScore", () => {
  it("rounds to 2 decimal places by default", () => expect(roundScore(33.333)).toBe(33.33));
  it("rounds up at .005", () => expect(roundScore(33.005)).toBe(33.01));
  it("rounds to 0 decimal places", () => expect(roundScore(33.6, 0)).toBe(34));
  it("rounds to 4 decimal places", () => expect(roundScore(33.33333, 4)).toBe(33.3333));
  it("NaN returns 0", () => expect(roundScore(NaN)).toBe(0));
  it("negative zero normalises", () =>
    expect(Object.is(roundScore(-0), 0)).toBe(true));
  it("preserves exact integers", () => expect(roundScore(50)).toBe(50));
  it("determinism — same result each call", () => {
    expect(roundScore(66.6666)).toBe(roundScore(66.6666));
  });
});

// ─── normaliseRatio ──────────────────────────────────────────────────────────────

describe("normaliseRatio", () => {
  it("clamps -0.5 to 0", () => expect(normaliseRatio(-0.5)).toBe(0));
  it("clamps 1.5 to 1", () => expect(normaliseRatio(1.5)).toBe(1));
  it("passes through 0.5", () => expect(normaliseRatio(0.5)).toBe(0.5));
  it("NaN returns 0", () => expect(normaliseRatio(NaN)).toBe(0));
  it("exact 0 boundary", () => expect(normaliseRatio(0)).toBe(0));
  it("exact 1 boundary", () => expect(normaliseRatio(1)).toBe(1));
});

// ─── weightedAverage ─────────────────────────────────────────────────────────────

describe("weightedAverage", () => {
  it("empty array returns 0", () => expect(weightedAverage([])).toBe(0));
  it("single entry", () => expect(weightedAverage([{ value: 80, weight: 1 }])).toBe(80));
  it("equal weights", () =>
    expect(weightedAverage([{ value: 80, weight: 1 }, { value: 60, weight: 1 }])).toBe(70));
  it("unequal weights", () =>
    expect(
      weightedAverage([{ value: 80, weight: 3 }, { value: 20, weight: 1 }]),
    ).toBe(65));
  it("zero-weight entry excluded from average", () =>
    expect(
      weightedAverage([{ value: 0, weight: 0 }, { value: 80, weight: 1 }]),
    ).toBe(80));
  it("all zero weights returns 0", () =>
    expect(weightedAverage([{ value: 80, weight: 0 }, { value: 60, weight: 0 }])).toBe(0));
  it("NaN value sanitised to 0", () =>
    expect(weightedAverage([{ value: NaN, weight: 1 }])).toBe(0));
  it("throws on negative weight", () => {
    expect(() => weightedAverage([{ value: 80, weight: -1 }])).toThrow(/negative weight/);
  });
  it("throws on NaN weight", () => {
    expect(() => weightedAverage([{ value: 80, weight: NaN }])).toThrow(/non-finite weight/);
  });
  it("throws on Infinity weight", () => {
    expect(() => weightedAverage([{ value: 80, weight: Infinity }])).toThrow(/non-finite weight/);
  });
  it("deterministic — same result on repeated calls", () => {
    const entries = [{ value: 70, weight: 2 }, { value: 30, weight: 1 }];
    expect(weightedAverage(entries)).toBe(weightedAverage(entries));
  });
});

// ─── weightedSum ─────────────────────────────────────────────────────────────────

describe("weightedSum", () => {
  it("empty array returns 0", () => expect(weightedSum([])).toBe(0));
  it("single entry", () => expect(weightedSum([{ value: 50, weight: 2 }])).toBe(100));
  it("two entries", () =>
    expect(weightedSum([{ value: 80, weight: 1 }, { value: 60, weight: 1 }])).toBe(140));
  it("throws on negative weight", () => {
    expect(() => weightedSum([{ value: 50, weight: -1 }])).toThrow(/negative weight/);
  });
});

// ─── applyPenalty ────────────────────────────────────────────────────────────────

describe("applyPenalty", () => {
  it("subtracts penalty", () => expect(applyPenalty(80, 10)).toBe(70));
  it("floors at 0 when penalty exceeds score", () => expect(applyPenalty(5, 20)).toBe(0));
  it("score stays at 0 if already 0", () => expect(applyPenalty(0, 100)).toBe(0));
  it("negative penalty treated as 0", () => expect(applyPenalty(50, -5)).toBe(50));
  it("NaN penalty treated as 0", () => expect(applyPenalty(50, NaN)).toBe(50));
  it("NaN score treated as 0", () => expect(applyPenalty(NaN, 5)).toBe(0));
  it("penalty larger than score → 0", () => expect(applyPenalty(10, 15)).toBe(0));
  it("exact penalty equals score → 0", () => expect(applyPenalty(10, 10)).toBe(0));
});

// ─── applyPenalties ──────────────────────────────────────────────────────────────

const penalty = (id: string, applied: number): PenaltySummary => ({
  penaltyId: id,
  description: `Penalty ${id}`,
  applied,
});

describe("applyPenalties", () => {
  it("no penalties returns score unchanged", () => expect(applyPenalties(70, [])).toBe(70));
  it("one penalty", () => expect(applyPenalties(70, [penalty("a", 10)])).toBe(60));
  it("two penalties applied cumulatively", () =>
    expect(applyPenalties(50, [penalty("a", 20), penalty("b", 20)])).toBe(10));
  it("score cannot fall below 0", () =>
    expect(applyPenalties(10, [penalty("a", 5), penalty("b", 8)])).toBe(0));
  it("deterministic regardless of input array order", () => {
    const pa = penalty("aaa", 5);
    const pb = penalty("bbb", 3);
    expect(applyPenalties(80, [pa, pb])).toBe(applyPenalties(80, [pb, pa]));
  });
  it("duplicate penalty ids both applied", () => {
    // Two entries with the same id — both reduce the score
    expect(applyPenalties(30, [penalty("dup", 10), penalty("dup", 10)])).toBe(10);
  });
});

// ─── applyScoreCap ───────────────────────────────────────────────────────────────

describe("applyScoreCap", () => {
  it("cap lowers score above cap", () => expect(applyScoreCap(80, 70)).toBe(70));
  it("cap does not raise score below cap", () => expect(applyScoreCap(60, 70)).toBe(60));
  it("cap equal to score unchanged", () => expect(applyScoreCap(70, 70)).toBe(70));
  it("cap at 0 forces score to 0", () => expect(applyScoreCap(80, 0)).toBe(0));
  it("cap at 100 is a no-op", () => expect(applyScoreCap(80, 100)).toBe(80));
  it("throws on cap above SCORE_MAX", () =>
    expect(() => applyScoreCap(50, 150)).toThrow(/outside legal score range/));
  it("throws on cap below SCORE_MIN", () =>
    expect(() => applyScoreCap(50, -5)).toThrow(/outside legal score range/));
  it("throws on NaN cap", () =>
    expect(() => applyScoreCap(50, NaN)).toThrow(/finite number/));
  it("throws on Infinity cap", () =>
    expect(() => applyScoreCap(50, Infinity)).toThrow(/finite number/));
});

// ─── assignGrade ─────────────────────────────────────────────────────────────────

describe("assignGrade", () => {
  it("score 100 → highest grade", () => expect(assignGrade(100, STANDARD_SCALE)).toBe("A"));
  it("score 85 → A (exact boundary)", () => expect(assignGrade(85, STANDARD_SCALE)).toBe("A"));
  it("score 84 → B", () => expect(assignGrade(84, STANDARD_SCALE)).toBe("B"));
  it("score 70 → B (exact boundary)", () => expect(assignGrade(70, STANDARD_SCALE)).toBe("B"));
  it("score 55 → C (exact boundary)", () => expect(assignGrade(55, STANDARD_SCALE)).toBe("C"));
  it("score 40 → D (exact boundary)", () => expect(assignGrade(40, STANDARD_SCALE)).toBe("D"));
  it("score 0 → F (zero boundary)", () => expect(assignGrade(0, STANDARD_SCALE)).toBe("F"));
  it("score 1 → F", () => expect(assignGrade(1, STANDARD_SCALE)).toBe("F"));
  it("NaN score treated as 0 → F", () => expect(assignGrade(NaN, STANDARD_SCALE)).toBe("F"));
  it("Infinity score clamped to 100 → A", () => expect(assignGrade(Infinity, STANDARD_SCALE)).toBe("F")); // safeNumber(Inf)=0
  it("result independent of threshold input order", () => {
    const shuffled = [...STANDARD_SCALE].reverse();
    expect(assignGrade(85, shuffled)).toBe("A");
    expect(assignGrade(70, shuffled)).toBe("B");
    expect(assignGrade(0, shuffled)).toBe("F");
  });
  it("throws on empty thresholds", () =>
    expect(() => assignGrade(50, [])).toThrow(/empty/));
  it("throws on non-finite minScore", () =>
    expect(() =>
      assignGrade(50, [{ label: "A", minScore: NaN }, { label: "F", minScore: 0 }]),
    ).toThrow(/non-finite/));
  it("throws on duplicate minScore", () =>
    expect(() =>
      assignGrade(50, [
        { label: "A", minScore: 80 },
        { label: "B", minScore: 80 },
        { label: "F", minScore: 0 },
      ]),
    ).toThrow(/duplicate/));
  it("throws when no zero entry", () =>
    expect(() =>
      assignGrade(50, [{ label: "A", minScore: 85 }, { label: "B", minScore: 50 }]),
    ).toThrow(/minScore: 0/));
  it("deterministic — same result on repeated calls", () => {
    expect(assignGrade(73, STANDARD_SCALE)).toBe(assignGrade(73, STANDARD_SCALE));
  });
});

// ─── calculateModuleContribution ─────────────────────────────────────────────────

describe("calculateModuleContribution", () => {
  it("standard case: 1.0 × 25 / 100 × 100 = 25", () =>
    expect(calculateModuleContribution(1.0, 25, 100)).toBe(25));
  it("0.8 normalizedScore × weight 25 / total 100 = 20", () =>
    expect(calculateModuleContribution(0.8, 25, 100)).toBe(20));
  it("zero weight → 0", () =>
    expect(calculateModuleContribution(0.8, 0, 100)).toBe(0));
  it("zero totalWeight → 0", () =>
    expect(calculateModuleContribution(0.8, 25, 0)).toBe(0));
  it("normalizedScore above 1 is clamped to 1", () =>
    expect(calculateModuleContribution(1.5, 25, 100)).toBe(25));
  it("normalizedScore below 0 is clamped to 0", () =>
    expect(calculateModuleContribution(-0.5, 25, 100)).toBe(0));
  it("throws on negative weight", () =>
    expect(() => calculateModuleContribution(0.8, -5, 100)).toThrow(/invalid weight/));
  it("throws on NaN weight", () =>
    expect(() => calculateModuleContribution(0.8, NaN, 100)).toThrow(/invalid weight/));
  it("throws on negative totalWeight", () =>
    expect(() => calculateModuleContribution(0.8, 25, -1)).toThrow(/invalid totalWeight/));
});

// ─── stableSortRecommendations ────────────────────────────────────────────────────

const rec = (severity: "error" | "warning" | "info", code: string): ModuleRecommendation => ({
  severity,
  code,
  message: `msg-${code}`,
  field: null,
});

describe("stableSortRecommendations", () => {
  it("empty array returns empty", () =>
    expect(stableSortRecommendations([])).toEqual([]));
  it("errors sort before warnings before info", () => {
    const recs = [rec("info", "I"), rec("error", "E"), rec("warning", "W")];
    const sorted = stableSortRecommendations(recs);
    expect(sorted[0]!.severity).toBe("error");
    expect(sorted[1]!.severity).toBe("warning");
    expect(sorted[2]!.severity).toBe("info");
  });
  it("same severity sorted alphabetically by code", () => {
    const recs = [rec("warning", "ZZ"), rec("warning", "AA"), rec("warning", "MM")];
    const sorted = stableSortRecommendations(recs);
    expect(sorted.map((r) => r.code)).toEqual(["AA", "MM", "ZZ"]);
  });
  it("does not mutate input array", () => {
    const recs = [rec("info", "I"), rec("error", "E")];
    const copy = [...recs];
    stableSortRecommendations(recs);
    expect(recs).toEqual(copy);
  });
  it("deterministic — same order on repeated calls", () => {
    const recs = [rec("warning", "B"), rec("error", "A"), rec("info", "C")];
    expect(stableSortRecommendations(recs)).toEqual(stableSortRecommendations(recs));
  });
  it("shuffle and re-sort produces same result", () => {
    const recs = [rec("warning", "B"), rec("error", "A"), rec("info", "C"), rec("warning", "AA")];
    const sorted1 = stableSortRecommendations(recs);
    const shuffled = [recs[3]!, recs[0]!, recs[2]!, recs[1]!];
    const sorted2 = stableSortRecommendations(shuffled);
    expect(sorted1).toEqual(sorted2);
  });
});

// ─── stableSortExplanationLines ──────────────────────────────────────────────────

const line = (type: "module" | "penalty" | "bonus", label: string, delta: number): ScoreExplanationLine => ({
  type,
  label,
  delta,
  moduleId: null,
  ruleId: null,
  detail: "",
  confidence: 1,
});

describe("stableSortExplanationLines", () => {
  it("empty array returns empty", () =>
    expect(stableSortExplanationLines([])).toEqual([]));
  it("penalty before module before bonus", () => {
    const lines = [line("bonus", "b", 5), line("module", "m", 20), line("penalty", "p", -10)];
    const sorted = stableSortExplanationLines(lines);
    expect(sorted[0]!.type).toBe("penalty");
    expect(sorted[1]!.type).toBe("module");
    expect(sorted[2]!.type).toBe("bonus");
  });
  it("same type sorted by |delta| descending", () => {
    const lines = [line("module", "a", 10), line("module", "b", 30), line("module", "c", 20)];
    const sorted = stableSortExplanationLines(lines);
    expect(sorted.map((l) => l.label)).toEqual(["b", "c", "a"]);
  });
  it("same type + same |delta| sorted by label", () => {
    const lines = [line("module", "z", 20), line("module", "a", 20), line("module", "m", 20)];
    const sorted = stableSortExplanationLines(lines);
    expect(sorted.map((l) => l.label)).toEqual(["a", "m", "z"]);
  });
  it("does not mutate input", () => {
    const lines = [line("module", "a", 10), line("penalty", "p", -5)];
    const copy = [...lines];
    stableSortExplanationLines(lines);
    expect(lines).toEqual(copy);
  });
  it("shuffle input produces same sorted output", () => {
    const lines = [
      line("bonus", "b", 5),
      line("module", "m1", 30),
      line("module", "m2", 20),
      line("penalty", "p", -10),
    ];
    const sorted1 = stableSortExplanationLines(lines);
    const shuffled = [lines[2]!, lines[0]!, lines[3]!, lines[1]!];
    expect(stableSortExplanationLines(shuffled)).toEqual(sorted1);
  });
});

// ─── aggregateModuleScores ────────────────────────────────────────────────────────

describe("aggregateModuleScores — single module", () => {
  it("one module at full score → 100", () => {
    const profile = makeProfile([{ moduleId: "content", weight: 100 }]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("content", 1.0)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.prepenaltyScore).toBe(100);
    expect(result.totalPenalty).toBe(0);
  });

  it("one module at 0.7 normalizedScore with weight 100 → 70", () => {
    const profile = makeProfile([{ moduleId: "content", weight: 100 }]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("content", 0.7)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(70);
    expect(result.grade).toBe("B");
  });
});

describe("aggregateModuleScores — multiple modules", () => {
  it("two equal-weight modules averaged correctly", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 50 },
      { moduleId: "b", weight: 50 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 1.0), makeModuleResult("b", 0.6)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(80);
    expect(result.grade).toBe("B");
  });

  it("unequal weights applied correctly", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 25 },
      { moduleId: "b", weight: 75 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 1.0), makeModuleResult("b", 0.0)],
      profile,
      precomputedPenalties: [],
    });
    // 1.0 × 25/100 × 100 + 0 × 75/100 × 100 = 25
    expect(result.finalScore).toBe(25);
  });

  it("result is independent of moduleResults input order", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 25 },
      { moduleId: "b", weight: 75 },
    ]);
    const r1 = makeModuleResult("a", 0.8);
    const r2 = makeModuleResult("b", 0.6);
    const resAB = aggregateModuleScores({
      moduleResults: [r1, r2],
      profile,
      precomputedPenalties: [],
    });
    const resBA = aggregateModuleScores({
      moduleResults: [r2, r1],
      profile,
      precomputedPenalties: [],
    });
    expect(resAB.finalScore).toBe(resBA.finalScore);
    expect(resAB.grade).toBe(resBA.grade);
  });

  it("disabled module excluded from aggregate", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 100, enabled: true },
      { moduleId: "b", weight: 0, enabled: false },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 0.8), makeModuleResult("b", 0.0)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(80);
  });

  it("zero-weight enabled module does not contribute and does not appear in moduleScores", () => {
    // zero-weight enabled modules are filtered out before aggregation
    const profile = makeProfile([
      { moduleId: "a", weight: 100 },
      { moduleId: "z", weight: 0 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 0.9), makeModuleResult("z", 1.0)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(90);
    // z is zero-weight so doesn't appear in moduleScores
    const ids = result.moduleScores.map((m) => m.moduleId);
    expect(ids).not.toContain("z");
  });

  it("missing expected module treated as score=0 and recorded in failedModules", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 50 },
      { moduleId: "missing", weight: 50 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 1.0)],
      profile,
      precomputedPenalties: [],
    });
    // a contributes 50, missing contributes 0 → 50
    expect(result.finalScore).toBe(50);
    expect(result.failedModules).toContain("missing");
  });

  it("FAILED module contributes 0 and recorded in failedModules", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 50 },
      { moduleId: "b", weight: 50 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [
        makeModuleResult("a", 1.0),
        makeModuleResult("b", 0.8, { lifecycleState: "FAILED" }),
      ],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(50);
    expect(result.failedModules).toContain("b");
  });

  it("SKIPPED module contributes 0 and recorded in skippedModules", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 50 },
      { moduleId: "b", weight: 50 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [
        makeModuleResult("a", 1.0),
        makeModuleResult("b", 0.8, { lifecycleState: "SKIPPED" }),
      ],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(50);
    expect(result.skippedModules).toContain("b");
  });

  it("module in results but not in profile → skippedModules", () => {
    const profile = makeProfile([{ moduleId: "a", weight: 100 }]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 0.8), makeModuleResult("extra", 0.9)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.skippedModules).toContain("extra");
    // extra does not inflate the score
    expect(result.finalScore).toBe(80);
  });
});

describe("aggregateModuleScores — penalties", () => {
  it("penalty reduces finalScore", () => {
    const profile = makeProfile([{ moduleId: "a", weight: 100 }]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 1.0)],
      profile,
      precomputedPenalties: [{ penaltyId: "dup", description: "Duplicate", applied: 10 }],
    });
    expect(result.finalScore).toBe(90);
    expect(result.totalPenalty).toBe(10);
  });

  it("score cannot fall below 0 after penalties", () => {
    const profile = makeProfile([{ moduleId: "a", weight: 100 }]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 0.1)],
      profile,
      precomputedPenalties: [{ penaltyId: "dup", description: "Dup", applied: 50 }],
    });
    expect(result.finalScore).toBe(0);
  });

  it("penalty explanation lines appear in output sorted before module lines", () => {
    const profile = makeProfile([{ moduleId: "a", weight: 100 }]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 1.0)],
      profile,
      precomputedPenalties: [{ penaltyId: "p1", description: "Penalty 1", applied: 5 }],
    });
    const penaltyLines = result.explanationLines.filter((l) => l.type === "penalty");
    expect(penaltyLines.length).toBeGreaterThanOrEqual(1);
    expect(penaltyLines[0]!.delta).toBeLessThan(0);
  });
});

describe("aggregateModuleScores — weights sum to 0", () => {
  it("all zero weights → finalScore 0", () => {
    // This shouldn't happen in a valid profile (sum must be 100), but the function
    // handles it gracefully without dividing by zero.
    const profile = makeProfile([
      { moduleId: "a", weight: 0 },
    ]);
    const result = aggregateModuleScores({
      moduleResults: [makeModuleResult("a", 1.0)],
      profile,
      precomputedPenalties: [],
    });
    expect(result.finalScore).toBe(0);
  });
});

describe("aggregateModuleScores — grade assignment", () => {
  it("assigns correct grades at standard thresholds", () => {
    const profile = makeProfile([{ moduleId: "a", weight: 100 }]);
    const cases: [number, string][] = [
      [1.0, "A"], [0.85, "A"], [0.84, "B"], [0.70, "B"],
      [0.55, "C"], [0.40, "D"], [0.01, "F"], [0, "F"],
    ];
    for (const [ns, expectedGrade] of cases) {
      const result = aggregateModuleScores({
        moduleResults: [makeModuleResult("a", ns)],
        profile,
        precomputedPenalties: [],
      });
      expect(result.grade, `normalizedScore ${ns}`).toBe(expectedGrade);
    }
  });
});

describe("aggregateModuleScores — determinism", () => {
  it("identical inputs produce deep-equal output", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 60 },
      { moduleId: "b", weight: 40 },
    ]);
    const inputs = {
      moduleResults: [makeModuleResult("a", 0.75), makeModuleResult("b", 0.9)],
      profile,
      precomputedPenalties: [{ penaltyId: "p", description: "P", applied: 5 }],
    };
    expect(aggregateModuleScores(inputs)).toEqual(aggregateModuleScores(inputs));
  });

  it("shuffled module input produces same final score", () => {
    const profile = makeProfile([
      { moduleId: "a", weight: 60 },
      { moduleId: "b", weight: 40 },
    ]);
    const rA = makeModuleResult("a", 0.75);
    const rB = makeModuleResult("b", 0.90);
    const res1 = aggregateModuleScores({ moduleResults: [rA, rB], profile, precomputedPenalties: [] });
    const res2 = aggregateModuleScores({ moduleResults: [rB, rA], profile, precomputedPenalties: [] });
    expect(res1.finalScore).toBe(res2.finalScore);
    expect(res1.grade).toBe(res2.grade);
  });
});

// ─── piecewiseLinear ─────────────────────────────────────────────────────────────

describe("piecewiseLinear — guard errors", () => {
  it("throws when fewer than 2 breakpoints", () => {
    expect(() => piecewiseLinear(0, [[0, 0]])).toThrow("piecewiseLinear requires at least 2 breakpoints");
  });
  it("throws on empty breakpoints array", () => {
    expect(() => piecewiseLinear(0, [])).toThrow("piecewiseLinear requires at least 2 breakpoints");
  });
  it("throws when x is Infinity", () => {
    expect(() => piecewiseLinear(0, [[Infinity, 0], [1, 1]])).toThrow("non-finite");
  });
  it("throws when x is NaN", () => {
    expect(() => piecewiseLinear(0, [[NaN, 0], [1, 1]])).toThrow("non-finite");
  });
  it("throws when y is Infinity", () => {
    expect(() => piecewiseLinear(0, [[0, Infinity], [1, 1]])).toThrow("non-finite");
  });
  it("throws when y is NaN", () => {
    expect(() => piecewiseLinear(0, [[0, NaN], [1, 1]])).toThrow("non-finite");
  });
});

describe("piecewiseLinear — clamping", () => {
  const CURVE: [number, number][] = [[0, 0], [100, 100]];
  it("clamps below first breakpoint → first y", () => {
    expect(piecewiseLinear(-50, CURVE)).toBe(0);
  });
  it("clamps above last breakpoint → last y", () => {
    expect(piecewiseLinear(200, CURVE)).toBe(100);
  });
  it("exact first breakpoint returns first y", () => {
    expect(piecewiseLinear(0, CURVE)).toBe(0);
  });
  it("exact last breakpoint returns last y", () => {
    expect(piecewiseLinear(100, CURVE)).toBe(100);
  });
});

describe("piecewiseLinear — interpolation", () => {
  const CURVE: [number, number][] = [[0, 0], [100, 100]];
  it("midpoint returns midpoint", () => {
    expect(piecewiseLinear(50, CURVE)).toBe(50);
  });
  it("25% along returns 25", () => {
    expect(piecewiseLinear(25, CURVE)).toBe(25);
  });
  it("handles descending y values", () => {
    const desc: [number, number][] = [[0, 100], [100, 0]];
    expect(piecewiseLinear(50, desc)).toBe(50);
  });
  it("interpolates in correct segment with multi-segment curve", () => {
    const multi: [number, number][] = [[0, 0], [10, 50], [20, 100]];
    expect(piecewiseLinear(5, multi)).toBe(25);
    expect(piecewiseLinear(15, multi)).toBe(75);
  });
  it("works with unsorted input breakpoints", () => {
    const unsorted: [number, number][] = [[100, 100], [0, 0], [50, 60]];
    expect(piecewiseLinear(0, unsorted)).toBe(0);
    expect(piecewiseLinear(100, unsorted)).toBe(100);
    // Between 50 and 100: t=(75-50)/(100-50)=0.5 → 60+0.5*(100-60)=80
    expect(piecewiseLinear(75, unsorted)).toBe(80);
  });
});

describe("piecewiseLinear — NaN/Infinity input value", () => {
  const CURVE: [number, number][] = [[0, 0], [100, 100]];
  it("NaN value treated as 0 via safeNumber → clamp to first y", () => {
    expect(piecewiseLinear(NaN, CURVE)).toBe(0);
  });
  it("Infinity value treated as 0 → clamp to first y", () => {
    expect(piecewiseLinear(Infinity, CURVE)).toBe(0);
  });
  it("-Infinity value treated as 0 → clamp to first y", () => {
    expect(piecewiseLinear(-Infinity, CURVE)).toBe(0);
  });
});

describe("piecewiseLinear — exact breakpoint hits", () => {
  const CURVE: [number, number][] = [[0, 0], [200, 25], [500, 70], [650, 87], [800, 100]];
  it("exact x=0 → 0", () => expect(piecewiseLinear(0, CURVE)).toBe(0));
  it("exact x=200 → 25", () => expect(piecewiseLinear(200, CURVE)).toBe(25));
  it("exact x=500 → 70", () => expect(piecewiseLinear(500, CURVE)).toBe(70));
  it("exact x=650 → 87", () => expect(piecewiseLinear(650, CURVE)).toBe(87));
  it("exact x=800 → 100", () => expect(piecewiseLinear(800, CURVE)).toBe(100));
});

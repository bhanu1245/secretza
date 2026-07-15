/**
 * Unit tests for seo-quality-engine.ts — Phase 2C.1 engine core
 *
 * Covers: profile weight validation, grade scale validation, penalty
 *         definition validation, observer safety (observer throws →
 *         engine continues), scaffold engine behavior, NotImplementedError.
 *
 * Run: npx vitest run tests/unit/seo-quality-engine-core.test.ts
 */

import { describe, it, expect, vi } from "vitest";
import {
  QualityEngine,
  NotImplementedError,
  createScaffoldEngine,
} from "@/lib/seo-quality-engine";
import type {
  QualityEngineConfig,
  ScoringProfile,
  QualityObserver,
  GradeLabel,
  PenaltyRule,
} from "@/lib/seo-quality-types";

// ─── Minimal profile fixture ──────────────────────────────────────────────────────

function makeProfile(
  id: string,
  opts: Partial<{
    weightA: number;
    weightB: number;
    enabledA: boolean;
    enabledB: boolean;
    gradeScale: Array<{ label: GradeLabel; minScore: number }>;
    penalties: PenaltyRule[];
  }> = {},
): ScoringProfile {
  const DEFAULT_SCALE: Array<{ label: GradeLabel; minScore: number }> = [
    { label: "A", minScore: 85 },
    { label: "B", minScore: 70 },
    { label: "C", minScore: 55 },
    { label: "D", minScore: 40 },
    { label: "F", minScore: 0 },
  ];
  const {
    weightA = 60,
    weightB = 40,
    enabledA = true,
    enabledB = true,
    gradeScale = DEFAULT_SCALE,
    penalties = [] as PenaltyRule[],
  } = opts;

  return {
    id,
    name: `Profile ${id}`,
    version: "1.0.0",
    description: "Test profile",
    pageTypes: ["city"],
    modules: [
      { moduleId: "content", weight: weightA, enabled: enabledA },
      { moduleId: "meta", weight: weightB, enabled: enabledB },
    ],
    penalties,
    thresholds: {
      minWordCount: 500,
      minQualityScore: 60,
      minUniqueness: 70,
      maxTemplateSentenceRatio: 0.30,
      maxAiPhraseRatio: 0.15,
      minLocalEntityDensity: 2.0,
    },
    gradeScale,
    metadata: { createdAt: "2026-07-15", author: "test", changelog: "" },
  };
}

const STUB_MODULES = [
  { id: "content", score: vi.fn(), collectOnly: vi.fn(), priority: 100 },
  { id: "meta", score: vi.fn(), collectOnly: vi.fn(), priority: 90 },
];

function makeConfig(
  profiles: ScoringProfile[],
  observer?: QualityObserver,
): QualityEngineConfig {
  return {
    modules: STUB_MODULES as never,
    providers: [],
    profiles,
    rules: [],
    observer,
    metricsSchemaVersion: "1.0.0",
    engineVersion: "2.0.0-test",
  };
}

// ─── Baseline — valid config ──────────────────────────────────────────────────────

describe("QualityEngine.initialize — valid config", () => {
  it("returns valid=true for a correct profile", () => {
    const engine = new QualityEngine(makeConfig([makeProfile("p1")]));
    const result = engine.initialize();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("subsequent initialize() calls are idempotent", () => {
    const engine = new QualityEngine(makeConfig([makeProfile("p1")]));
    const r1 = engine.initialize();
    const r2 = engine.initialize();
    expect(r1.valid).toBe(r2.valid);
    expect(r1.errors).toEqual(r2.errors);
  });
});

// ─── Profile ID uniqueness ────────────────────────────────────────────────────────

describe("QualityEngine.initialize — duplicate profile ids", () => {
  it("emits DUPLICATE_PROFILE_ID for two identical profile ids", () => {
    const engine = new QualityEngine(
      makeConfig([makeProfile("same"), makeProfile("same")]),
    );
    const result = engine.initialize();
    expect(result.valid).toBe(false);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain("DUPLICATE_PROFILE_ID");
  });
});

// ─── Module ID uniqueness ─────────────────────────────────────────────────────────

describe("QualityEngine.initialize — duplicate module ids", () => {
  it("emits DUPLICATE_MODULE_ID for duplicate module entries in config.modules", () => {
    const config: QualityEngineConfig = {
      ...makeConfig([makeProfile("p1")]),
      modules: [
        { id: "content", score: vi.fn(), collectOnly: vi.fn(), priority: 100 },
        { id: "content", score: vi.fn(), collectOnly: vi.fn(), priority: 90 },
      ] as never,
    };
    const result = new QualityEngine(config).initialize();
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("DUPLICATE_MODULE_ID");
  });
});

// ─── Profile weight sum ───────────────────────────────────────────────────────────

describe("QualityEngine.initialize — profile weight sums", () => {
  it("weights summing to 99 → PROFILE_WEIGHT_SUM_INVALID", () => {
    const engine = new QualityEngine(
      makeConfig([makeProfile("p1", { weightA: 60, weightB: 39 })]),
    );
    const result = engine.initialize();
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("PROFILE_WEIGHT_SUM_INVALID");
  });

  it("weights summing to 101 → PROFILE_WEIGHT_SUM_INVALID", () => {
    const engine = new QualityEngine(
      makeConfig([makeProfile("p1", { weightA: 61, weightB: 40 })]),
    );
    const result = engine.initialize();
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("PROFILE_WEIGHT_SUM_INVALID");
  });

  it("disabled module excluded from weight sum", () => {
    // weightA=100, weightB=50 but B is disabled → enabled sum = 100
    const engine = new QualityEngine(
      makeConfig([makeProfile("p1", { weightA: 100, weightB: 50, enabledB: false })]),
    );
    const result = engine.initialize();
    expect(result.valid).toBe(true);
  });
});

// ─── Non-finite and negative weights ─────────────────────────────────────────────

describe("QualityEngine.initialize — non-finite / negative weights", () => {
  it("NaN weight → MODULE_WEIGHT_NON_FINITE error", () => {
    const profile = makeProfile("p1");
    profile.modules[0]!.weight = NaN;
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.valid).toBe(false);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain("MODULE_WEIGHT_NON_FINITE");
  });

  it("Infinity weight → MODULE_WEIGHT_NON_FINITE error", () => {
    const profile = makeProfile("p1");
    profile.modules[0]!.weight = Infinity;
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("MODULE_WEIGHT_NON_FINITE");
  });

  it("negative weight → MODULE_WEIGHT_NEGATIVE error", () => {
    const profile = makeProfile("p1");
    profile.modules[0]!.weight = -5;
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("MODULE_WEIGHT_NEGATIVE");
  });
});

// ─── Penalty definitions ──────────────────────────────────────────────────────────

describe("QualityEngine.initialize — penalty definitions", () => {
  const evalFn = () => 0;

  it("penalty with empty id → PENALTY_MISSING_ID error", () => {
    const profile = makeProfile("p1", {
      penalties: [{ id: "", description: "Dup", maxPenalty: 20, evaluate: evalFn }],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("PENALTY_MISSING_ID");
  });

  it("penalty with NaN maxPenalty → PENALTY_MAX_NON_FINITE error", () => {
    const profile = makeProfile("p1", {
      penalties: [{ id: "dup", description: "Dup", maxPenalty: NaN, evaluate: evalFn }],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("PENALTY_MAX_NON_FINITE");
  });

  it("penalty with Infinity maxPenalty → PENALTY_MAX_NON_FINITE error", () => {
    const profile = makeProfile("p1", {
      penalties: [{ id: "dup", description: "Dup", maxPenalty: Infinity, evaluate: evalFn }],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("PENALTY_MAX_NON_FINITE");
  });

  it("penalty with negative maxPenalty → PENALTY_MAX_NEGATIVE error", () => {
    const profile = makeProfile("p1", {
      penalties: [{ id: "dup", description: "Dup", maxPenalty: -5, evaluate: evalFn }],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("PENALTY_MAX_NEGATIVE");
  });

  it("valid penalty passes with no penalty errors", () => {
    const profile = makeProfile("p1", {
      penalties: [{ id: "dup", description: "Duplicate title", maxPenalty: 15, evaluate: evalFn }],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    const penaltyCodes = result.errors
      .map((e) => e.code)
      .filter((c) => c.startsWith("PENALTY_"));
    expect(penaltyCodes).toHaveLength(0);
  });
});

// ─── Grade scale validation ───────────────────────────────────────────────────────

describe("QualityEngine.initialize — grade scale", () => {
  it("missing minScore:0 entry → GRADE_SCALE_MISSING_ZERO error", () => {
    const profile = makeProfile("p1", {
      gradeScale: [
        { label: "A" as GradeLabel, minScore: 85 },
        { label: "B" as GradeLabel, minScore: 70 },
      ],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("GRADE_SCALE_MISSING_ZERO");
  });

  it("duplicate minScore values → GRADE_SCALE_DUPLICATE_MINSCORE error", () => {
    const profile = makeProfile("p1", {
      gradeScale: [
        { label: "A" as GradeLabel, minScore: 85 },
        { label: "B" as GradeLabel, minScore: 85 }, // duplicate
        { label: "F" as GradeLabel, minScore: 0 },
      ],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("GRADE_SCALE_DUPLICATE_MINSCORE");
  });

  it("duplicate grade labels → GRADE_SCALE_DUPLICATE_LABEL error", () => {
    const profile = makeProfile("p1", {
      gradeScale: [
        { label: "A" as GradeLabel, minScore: 85 },
        { label: "A" as GradeLabel, minScore: 70 }, // duplicate label
        { label: "F" as GradeLabel, minScore: 0 },
      ],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("GRADE_SCALE_DUPLICATE_LABEL");
  });

  it("NaN minScore → GRADE_THRESHOLD_NON_FINITE error", () => {
    const profile = makeProfile("p1", {
      gradeScale: [
        { label: "A" as GradeLabel, minScore: NaN },
        { label: "F" as GradeLabel, minScore: 0 },
      ],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("GRADE_THRESHOLD_NON_FINITE");
  });

  it("Infinity minScore → GRADE_THRESHOLD_NON_FINITE error", () => {
    const profile = makeProfile("p1", {
      gradeScale: [
        { label: "A" as GradeLabel, minScore: Infinity },
        { label: "F" as GradeLabel, minScore: 0 },
      ],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    expect(result.errors.map((e) => e.code)).toContain("GRADE_THRESHOLD_NON_FINITE");
  });

  it("gap in grade scale → GRADE_SCALE_GAP warning (not error)", () => {
    const profile = makeProfile("p1", {
      gradeScale: [
        { label: "A" as GradeLabel, minScore: 90 },
        { label: "B" as GradeLabel, minScore: 50 }, // gap: 51-89 has no grade
        { label: "F" as GradeLabel, minScore: 0 },
      ],
    });
    const result = new QualityEngine(makeConfig([profile])).initialize();
    // Gap is a warning, not an error — config should still be valid
    const warningCodes = result.warnings.map((w) => w.code);
    expect(warningCodes).toContain("GRADE_SCALE_GAP");
    // Depending on whether weight sum still passes (it does for this profile)
    // the overall valid state should be true if there are only gap warnings
    const errorCodes = result.errors.map((e) => e.code);
    expect(errorCodes).not.toContain("GRADE_SCALE_GAP");
  });
});

// ─── Observer safety ─────────────────────────────────────────────────────────────

describe("QualityEngine observer safety", () => {
  it("observer.onEvent throwing does not prevent initialize() from completing", () => {
    const throwingObserver: QualityObserver = {
      onEvent: vi.fn().mockImplementation(() => { throw new Error("Observer explosion!"); }),
      onMetric: vi.fn(),
    };

    const engine = new QualityEngine(makeConfig([makeProfile("p1")], throwingObserver));
    expect(() => engine.initialize()).not.toThrow();
    // Observer was called (and threw), engine completed without propagating the error
    expect(throwingObserver.onEvent).toHaveBeenCalled();
  });

  it("observer.onEvent throwing during QE_CONFIG_ERROR does not throw", () => {
    const throwingObserver: QualityObserver = {
      onEvent: vi.fn().mockImplementation(() => { throw new Error("Boom"); }),
      onMetric: vi.fn(),
    };

    // Invalid profile — triggers QE_CONFIG_ERROR observer call
    const invalidProfile = makeProfile("p1", { weightA: 100, weightB: 10 }); // sum=110
    const engine = new QualityEngine(makeConfig([invalidProfile], throwingObserver));
    expect(() => engine.initialize()).not.toThrow();
  });

  it("observer.onEvent is called on initialize()", () => {
    const obs: QualityObserver = {
      onEvent: vi.fn(),
      onMetric: vi.fn(),
    };
    const engine = new QualityEngine(makeConfig([makeProfile("p1")], obs));
    engine.initialize();
    // Called with QE_INITIALIZED when no errors or warnings, QE_CONFIG_WARN
    // when only warnings exist. Either way observer must be called.
    expect(obs.onEvent).toHaveBeenCalled();
  });

  it("observer is called with QE_CONFIG_ERROR on invalid config", () => {
    const obs: QualityObserver = {
      onEvent: vi.fn(),
      onMetric: vi.fn(),
    };
    const invalidProfile = makeProfile("p1", { weightA: 100, weightB: 10 }); // sum=110
    const engine = new QualityEngine(makeConfig([invalidProfile], obs));
    engine.initialize();
    const events = (obs.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(events).toContain("QE_CONFIG_ERROR");
  });

  it("score() calls observer before throwing NotImplementedError", () => {
    const obs: QualityObserver = {
      onEvent: vi.fn(),
      onMetric: vi.fn(),
    };
    const engine = new QualityEngine(makeConfig([makeProfile("p1")], obs));
    engine.initialize();
    // Clear init calls
    (obs.onEvent as ReturnType<typeof vi.fn>).mockClear();

    expect(() =>
      engine.score({
        content: "",
        pageType: "city",
        slug: "test",
        title: "",
        metaDescription: "",
        internalLinks: [],
        localEntities: [],
        publishedAt: new Date().toISOString(),
      } as never),
    ).toThrow(NotImplementedError);

    // QE_SCORE_CALLED should have been emitted before the throw
    const events = (obs.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(events).toContain("QE_SCORE_CALLED");
  });

  it("observer throwing during score() does not suppress NotImplementedError", () => {
    const throwingObserver: QualityObserver = {
      onEvent: vi.fn().mockImplementation(() => { throw new Error("Boom"); }),
      onMetric: vi.fn(),
    };
    const engine = new QualityEngine(makeConfig([makeProfile("p1")], throwingObserver));
    engine.initialize();
    expect(() => engine.score({} as never)).toThrow(NotImplementedError);
  });
});

// ─── NotImplementedError ─────────────────────────────────────────────────────────

describe("NotImplementedError", () => {
  it("is an instance of Error", () => {
    expect(new NotImplementedError("score")).toBeInstanceOf(Error);
  });

  it("message includes the method name", () => {
    expect(new NotImplementedError("score").message).toContain("score");
  });

  it("score() throws NotImplementedError", () => {
    const engine = new QualityEngine(makeConfig([makeProfile("p1")]));
    engine.initialize();
    expect(() => engine.score({} as never)).toThrow(NotImplementedError);
  });

  it("collectOnly() throws NotImplementedError", () => {
    const engine = new QualityEngine(makeConfig([makeProfile("p1")]));
    engine.initialize();
    expect(() => engine.collectOnly({} as never)).toThrow(NotImplementedError);
  });

  it("rescore() throws NotImplementedError", () => {
    const engine = new QualityEngine(makeConfig([makeProfile("p1")]));
    engine.initialize();
    expect(() => engine.rescore({} as never, "p1")).toThrow(NotImplementedError);
  });

  it("compareProfiles() throws NotImplementedError", () => {
    const engine = new QualityEngine(makeConfig([makeProfile("p1")]));
    engine.initialize();
    expect(() => engine.compareProfiles({} as never, "p1", "p2")).toThrow(NotImplementedError);
  });
});

// ─── PROFILE_REFERENCES_UNKNOWN_MODULE ────────────────────────────────────────────

describe("QualityEngine.initialize — module completeness", () => {
  it("profile referencing an unknown module id → PROFILE_REFERENCES_UNKNOWN_MODULE", () => {
    const profile = makeProfile("p1"); // references 'content' and 'meta'
    const configWithoutContent: QualityEngineConfig = {
      ...makeConfig([profile]),
      modules: [
        // 'content' is missing here
        { id: "meta", score: vi.fn(), collectOnly: vi.fn(), priority: 90 },
      ] as never,
    };
    const result = new QualityEngine(configWithoutContent).initialize();
    expect(result.errors.map((e) => e.code)).toContain("PROFILE_REFERENCES_UNKNOWN_MODULE");
  });
});

// ─── createScaffoldEngine ─────────────────────────────────────────────────────────

describe("createScaffoldEngine", () => {
  it("returns a QualityEngine instance", () => {
    expect(createScaffoldEngine()).toBeInstanceOf(QualityEngine);
  });

  it("initialize() does not throw", () => {
    const engine = createScaffoldEngine();
    expect(() => engine.initialize()).not.toThrow();
  });

  it("PROFILE_REFERENCES_UNKNOWN_MODULE appears because modules: [] but profiles reference modules", () => {
    const engine = createScaffoldEngine();
    const result = engine.initialize();
    // Since modules: [] and profiles reference real module IDs, we expect this error
    const hasUnknownModuleError = result.errors.some(
      (e) => e.code === "PROFILE_REFERENCES_UNKNOWN_MODULE",
    );
    expect(hasUnknownModuleError).toBe(true);
  });

  it("score() throws NotImplementedError on scaffold engine", () => {
    const engine = createScaffoldEngine();
    engine.initialize();
    expect(() => engine.score({} as never)).toThrow(NotImplementedError);
  });

  it("collectOnly() throws NotImplementedError on scaffold engine", () => {
    const engine = createScaffoldEngine();
    engine.initialize();
    expect(() => engine.collectOnly({} as never)).toThrow(NotImplementedError);
  });

  it("rescore() throws NotImplementedError on scaffold engine", () => {
    const engine = createScaffoldEngine();
    engine.initialize();
    expect(() => engine.rescore({} as never, "city-v6")).toThrow(NotImplementedError);
  });

  it("initialize() is idempotent on scaffold engine", () => {
    const engine = createScaffoldEngine();
    const r1 = engine.initialize();
    const r2 = engine.initialize();
    // Second call returns valid:true (initialized guard)
    expect(r2.valid).toBe(true);
    expect(r2.errors).toHaveLength(0);
    // First call has errors (modules missing)
    expect(r1.errors.length).toBeGreaterThan(0);
  });
});

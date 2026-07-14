/**
 * SEO Quality Engine — Orchestrator
 *
 * Purpose:
 *   Top-level orchestrator for the SEO Quality scoring pipeline.
 *   Coordinates the metrics → rules → modules → scoring flow.
 *
 * Responsibilities:
 *   - Resolve the active ScoringProfile for a given page type
 *   - Invoke MetricsCollector to produce QualityMetrics
 *   - Invoke RuleRegistry to produce RuleEvaluationResult[]
 *   - Execute enabled ScorerModules in priority order
 *   - Aggregate module scores, apply penalties, resolve grade
 *   - Assemble and return an immutable ScoringResult
 *   - Emit structured observability events at every step
 *
 * Extension points:
 *   - Add providers to QualityEngineConfig.providers (no engine changes)
 *   - Add scorer modules to QualityEngineConfig.modules (no engine changes)
 *   - Add profiles to QualityEngineConfig.profiles (no engine changes)
 *   - Inject a real QualityObserver for production telemetry
 *
 * Thread safety:
 *   QualityEngine is stateless after initialize(). Safe to call score()
 *   concurrently from multiple async contexts. The peer cache used by
 *   DuplicateDetectionProvider has its own lifecycle management.
 *
 * Usage notes:
 *   This engine is NOT yet connected to the production scoring flow.
 *   score() throws NotImplementedError until Phase 2B–2D are complete.
 *   Current production scoring continues through computeSeoQualityScore()
 *   in seo-quality.ts — this engine does not touch that path.
 *
 *   Initialization sequence:
 *     const engine = new QualityEngine(config);
 *     const validation = engine.initialize();  // validates config, logs warnings
 *     // if validation.valid === false, inspect validation.errors before use
 *     const result = await engine.score(input); // throws until Phase 2B
 */

import type {
  QualityEngineConfig,
  MetricsCollectorInput,
  ScoringResult,
  QualityMetrics,
  ProfileId,
  ProfileComparisonResult,
  ValidationResult,
  ValidationError,
  ScorerModule,
  ScoringProfile,
  QualityRule,
} from "@/lib/seo-quality-types";
import { SeoMetricsCollector, NotImplementedError } from "@/lib/seo-quality-metrics-collector";
import { SeoRuleRegistry } from "@/lib/seo-rule-registry";
import {
  SeoProfileRegistry,
  CITY_SEO_V6_PROFILE,
  DEFAULT_PROFILE,
} from "@/lib/seo-profile-registry";
import { NO_OP_OBSERVER } from "@/lib/seo-quality-observer";
import { QUALITY_RULES } from "@/lib/seo-quality-rules";

export { NotImplementedError };

export class QualityEngine {
  private readonly config: QualityEngineConfig;
  private readonly collector: SeoMetricsCollector;
  private readonly ruleRegistry: SeoRuleRegistry;
  private readonly profileRegistry: SeoProfileRegistry;
  private initialized = false;

  constructor(config: QualityEngineConfig) {
    this.config = config;
    const observer = config.observer ?? NO_OP_OBSERVER;

    this.collector = new SeoMetricsCollector(config.providers, observer);
    this.ruleRegistry = new SeoRuleRegistry();
    this.profileRegistry = new SeoProfileRegistry();
  }

  /**
   * Initialize the engine: validate configuration, register profiles and rules.
   * Safe to call multiple times — subsequent calls are idempotent.
   *
   * Returns a ValidationResult describing any errors or warnings found.
   * Does NOT throw on validation errors — callers inspect the result.
   */
  initialize(): ValidationResult {
    if (this.initialized) {
      return { valid: true, errors: [], warnings: [] };
    }

    const result = this.validateConfig();

    if (result.errors.length === 0) {
      for (const profile of this.config.profiles) {
        try {
          this.profileRegistry.register(profile);
        } catch {
          // already caught by validation; skip
        }
      }
      for (const rule of this.config.rules) {
        try {
          this.ruleRegistry.register(rule);
        } catch {
          // already caught by validation; skip
        }
      }
    }

    const observer = this.config.observer ?? NO_OP_OBSERVER;
    if (result.errors.length > 0) {
      observer.onEvent("QE_CONFIG_ERROR", {
        errors: result.errors,
        engineVersion: this.config.engineVersion,
      });
    } else if (result.warnings.length > 0) {
      observer.onEvent("QE_CONFIG_WARN", {
        warnings: result.warnings,
        engineVersion: this.config.engineVersion,
      });
    } else {
      observer.onEvent("QE_INITIALIZED", {
        profileCount: this.config.profiles.length,
        moduleCount: this.config.modules.length,
        ruleCount: this.config.rules.length,
        engineVersion: this.config.engineVersion,
      });
    }

    this.initialized = true;
    return result;
  }

  /**
   * Score a page using the profile that matches its pageType.
   *
   * NOT YET IMPLEMENTED — throws NotImplementedError.
   * Will be implemented in Phase 2B–2D.
   *
   * @throws {NotImplementedError}
   */
  score(
    _input: MetricsCollectorInput,
    _profileIdOverride?: ProfileId,
  ): ScoringResult {
    const observer = this.config.observer ?? NO_OP_OBSERVER;
    observer.onEvent("QE_SCORE_CALLED", { status: "not_implemented" });
    throw new NotImplementedError("score");
  }

  /**
   * Run only the metrics collection step, without scoring.
   * Useful for diagnostics and dry-run inspection.
   *
   * NOT YET IMPLEMENTED — throws NotImplementedError.
   *
   * @throws {NotImplementedError}
   */
  collectOnly(_input: MetricsCollectorInput): QualityMetrics {
    throw new NotImplementedError("collectOnly");
  }

  /**
   * Re-score from an already-computed QualityMetrics snapshot.
   * Used for profile comparison without re-reading content.
   *
   * NOT YET IMPLEMENTED — throws NotImplementedError.
   *
   * @throws {NotImplementedError}
   */
  rescore(
    _metrics: QualityMetrics,
    _profileId: ProfileId,
  ): ScoringResult {
    throw new NotImplementedError("rescore");
  }

  /**
   * Compare two profiles against the same QualityMetrics snapshot.
   * Does not re-run provider collection.
   *
   * NOT YET IMPLEMENTED — throws NotImplementedError.
   *
   * @throws {NotImplementedError}
   */
  compareProfiles(
    _metrics: QualityMetrics,
    _profileAId: ProfileId,
    _profileBId: ProfileId,
  ): ProfileComparisonResult {
    throw new NotImplementedError("compareProfiles");
  }

  /** Return the active profile for a given pageType. */
  resolveProfile(pageType: string, override?: ProfileId): ScoringProfile {
    return this.profileRegistry.resolve(pageType, override);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private validateConfig(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.checkDuplicateProfileIds(errors);
    this.checkDuplicateModuleIds(errors);
    this.checkDuplicateRuleIds(errors);
    this.checkProfileWeights(errors, warnings);
    this.checkModuleCompleteness(errors);
    this.checkGradeScales(errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private checkDuplicateProfileIds(errors: ValidationError[]): void {
    const seen = new Set<string>();
    for (const profile of this.config.profiles) {
      if (seen.has(profile.id)) {
        errors.push({
          code: "DUPLICATE_PROFILE_ID",
          severity: "error",
          message: `Duplicate profile id "${profile.id}"`,
          context: { profileId: profile.id },
        });
      }
      seen.add(profile.id);
    }
  }

  private checkDuplicateModuleIds(errors: ValidationError[]): void {
    const seen = new Set<string>();
    for (const scorer of this.config.modules) {
      if (seen.has(scorer.id)) {
        errors.push({
          code: "DUPLICATE_MODULE_ID",
          severity: "error",
          message: `Duplicate module id "${scorer.id}"`,
          context: { moduleId: scorer.id },
        });
      }
      seen.add(scorer.id);
    }
  }

  private checkDuplicateRuleIds(errors: ValidationError[]): void {
    const seen = new Set<string>();
    for (const rule of this.config.rules) {
      if (seen.has(rule.id)) {
        errors.push({
          code: "DUPLICATE_RULE_ID",
          severity: "error",
          message: `Duplicate rule id "${rule.id}"`,
          context: { ruleId: rule.id },
        });
      }
      seen.add(rule.id);
    }
  }

  private checkProfileWeights(
    errors: ValidationError[],
    _warnings: ValidationError[],
  ): void {
    for (const profile of this.config.profiles) {
      const enabledModules = profile.modules.filter((m) => m.enabled);
      const total = enabledModules.reduce((sum, m) => sum + m.weight, 0);
      if (total !== 100) {
        errors.push({
          code: "PROFILE_WEIGHT_SUM_INVALID",
          severity: "error",
          message: `Profile "${profile.id}" enabled module weights sum to ${total}, expected 100`,
          context: { profileId: profile.id, weightSum: total },
        });
      }
    }
  }

  private checkModuleCompleteness(errors: ValidationError[]): void {
    const registeredIds = new Set(this.config.modules.map((m: ScorerModule) => m.id));
    for (const profile of this.config.profiles) {
      for (const mw of profile.modules) {
        if (!registeredIds.has(mw.moduleId)) {
          errors.push({
            code: "PROFILE_REFERENCES_UNKNOWN_MODULE",
            severity: "error",
            message: `Profile "${profile.id}" references unknown module "${mw.moduleId}"`,
            context: { profileId: profile.id, moduleId: mw.moduleId },
          });
        }
      }
    }
  }

  private checkGradeScales(
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    for (const profile of this.config.profiles) {
      const scale = profile.gradeScale;
      const hasZero = scale.some((g) => g.minScore === 0);
      if (!hasZero) {
        errors.push({
          code: "GRADE_SCALE_MISSING_ZERO",
          severity: "error",
          message: `Profile "${profile.id}" gradeScale has no entry with minScore: 0`,
          context: { profileId: profile.id },
        });
      }

      const scores = scale.map((g) => g.minScore);
      const uniqueScores = new Set(scores);
      if (uniqueScores.size !== scores.length) {
        errors.push({
          code: "GRADE_SCALE_DUPLICATE_MINSCORE",
          severity: "error",
          message: `Profile "${profile.id}" gradeScale contains duplicate minScore values`,
          context: { profileId: profile.id, scores },
        });
      }

      const sorted = [...scale].sort((a, b) => b.minScore - a.minScore);
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = (sorted[i]!.minScore - 1) - sorted[i + 1]!.minScore;
        if (gap > 0) {
          warnings.push({
            code: "GRADE_SCALE_GAP",
            severity: "warning",
            message:
              `Profile "${profile.id}" gradeScale has a gap between ` +
              `${sorted[i + 1]!.minScore} and ${sorted[i]!.minScore}`,
            context: {
              profileId: profile.id,
              lower: sorted[i + 1]!.minScore,
              upper: sorted[i]!.minScore,
            },
          });
        }
      }
    }
  }
}

// ─── Scaffold factory (unused until Phase 2B) ──────────────────────────────────

/**
 * Build a minimal engine config for scaffold validation.
 * Scorer modules are empty — no scoring is possible yet.
 * Rules and profiles are fully populated from the approved architecture.
 */
export function createScaffoldEngine(): QualityEngine {
  const engineConfig: QualityEngineConfig = {
    modules: [] as ScorerModule[],
    providers: [],
    profiles: [CITY_SEO_V6_PROFILE, DEFAULT_PROFILE] as ScoringProfile[],
    rules: QUALITY_RULES as QualityRule[],
    observer: NO_OP_OBSERVER,
    metricsSchemaVersion: "1.0.0",
    engineVersion: "2.0.0-scaffold",
  };

  return new QualityEngine(engineConfig);
}

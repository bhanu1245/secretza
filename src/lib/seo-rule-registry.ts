/**
 * SEO Quality Engine — Rule Registry
 *
 * Purpose:
 *   Central registry for all QualityRule definitions.
 *   Separates problem detection (rules) from problem scoring (modules).
 *
 * Responsibilities:
 *   - Store and index QualityRule instances by id
 *   - Validate registrations for duplicate ids
 *   - Evaluate registered rules against a QualityMetrics snapshot
 *   - Filter rules by applicable profile
 *
 * Extension points:
 *   - Register new rules via register() — no engine changes required
 *   - Rules are evaluated before any scorer module runs; results are
 *     available in ModuleContext.ruleResults
 *
 * Thread safety:
 *   SeoRuleRegistry is not thread-safe by design — Node.js is single-threaded
 *   and the registry is mutated only during startup initialization.
 *   Once initialize() completes the registry is effectively read-only.
 *
 * Usage notes:
 *   Construct one instance per QualityEngine. Register rules during
 *   engine initialization before the first score() call. Do not register
 *   rules at request time.
 */

import type {
  QualityRule,
  QualityMetrics,
  ProfileId,
  RuleId,
  RuleEvaluationResult,
  ModuleRecommendation,
  RuleRegistry,
} from "@/lib/seo-quality-types";

export class SeoRuleRegistry implements RuleRegistry {
  private readonly rules = new Map<RuleId, QualityRule>();

  /**
   * Register a rule.
   * @throws {Error} if a rule with the same id is already registered.
   */
  register(rule: QualityRule): void {
    if (!rule.id || typeof rule.id !== "string" || rule.id.trim() === "") {
      throw new Error(`SeoRuleRegistry: rule id must be a non-empty string`);
    }
    if (this.rules.has(rule.id)) {
      throw new Error(`SeoRuleRegistry: duplicate rule id "${rule.id}"`);
    }
    this.rules.set(rule.id, rule);
  }

  /**
   * Evaluate all enabled rules applicable to the given profile against
   * the provided metrics snapshot. Rules are evaluated in registration order.
   * A rule that throws is recorded as not triggered with a warning in evidence.
   */
  evaluate(metrics: QualityMetrics, profileId: ProfileId): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const isApplicable =
        rule.applicableProfiles.length === 0 ||
        rule.applicableProfiles.includes(profileId);

      if (!isApplicable) continue;

      let outcome: ReturnType<QualityRule["evaluator"]>;
      try {
        outcome = rule.evaluator(metrics);
      } catch (err) {
        results.push({
          ruleId: rule.id,
          triggered: false,
          severity: rule.severity,
          penaltyApplied: 0,
          recommendation: null,
          evidence: { error: String(err), evaluationFailed: true },
        });
        continue;
      }

      const clamped = Math.min(outcome.penaltyApplied, rule.maxPenalty);

      const recommendation: ModuleRecommendation | null = outcome.triggered
        ? {
            severity: rule.severity,
            code: rule.id.toUpperCase().replace(/-/g, "_"),
            message: rule.name,
            field: null,
          }
        : null;

      results.push({
        ruleId: rule.id,
        triggered: outcome.triggered,
        severity: rule.severity,
        penaltyApplied: outcome.triggered ? clamped : 0,
        recommendation,
        evidence: outcome.evidence,
      });
    }

    return results;
  }

  getRule(id: RuleId): QualityRule | undefined {
    return this.rules.get(id);
  }

  getRulesForProfile(profileId: ProfileId): QualityRule[] {
    return [...this.rules.values()].filter(
      (r) =>
        r.applicableProfiles.length === 0 ||
        r.applicableProfiles.includes(profileId),
    );
  }

  list(): QualityRule[] {
    return [...this.rules.values()];
  }

  exists(id: RuleId): boolean {
    return this.rules.has(id);
  }
}

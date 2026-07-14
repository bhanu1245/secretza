/**
 * SEO Quality Engine — Quality Rule Definitions
 *
 * Purpose:
 *   Declares every QualityRule as a plain data + evaluator object.
 *   Rules detect problems in QualityMetrics; they do not assign scores.
 *
 * Responsibilities:
 *   - Define the initial set of production-ready quality rules
 *   - Export a flat array for bulk registration into SeoRuleRegistry
 *
 * Extension points:
 *   - Add new rules to QUALITY_RULES and they are automatically registered
 *   - Rules with applicableProfiles: [] apply to every profile
 *   - defaultPenalty: 0 means advisory only (warning, no score deduction)
 *
 * Thread safety:
 *   All exports are module-level constants; safe to read from any context.
 *
 * Usage notes:
 *   Import QUALITY_RULES and pass to SeoRuleRegistry during engine init.
 *   Rule evaluators must be synchronous and must not throw intentionally —
 *   the registry handles accidental throws gracefully.
 */

import type { QualityRule } from "@/lib/seo-quality-types";

export const QUALITY_RULES: QualityRule[] = [
  {
    id: "thin-content",
    name: "Thin Content",
    description: "Page word count is below the configured minimum.",
    severity: "error",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content"],
    evaluator: (m) => ({
      triggered: m.wordCount < 500,
      penaltyApplied: 0,
      evidence: { wordCount: m.wordCount, threshold: 500 },
    }),
  },
  {
    id: "duplicate-title",
    name: "Duplicate Title",
    description: "Page title matches another page exactly.",
    severity: "error",
    enabled: true,
    defaultPenalty: 5,
    maxPenalty: 5,
    applicableProfiles: [],
    tags: ["duplicate", "metadata"],
    evaluator: (m) => ({
      triggered: m.duplicateTitle,
      penaltyApplied: m.duplicateTitle ? 5 : 0,
      evidence: { duplicateTitle: m.duplicateTitle },
    }),
  },
  {
    id: "duplicate-meta",
    name: "Duplicate Meta Description",
    description: "Meta description matches another page exactly.",
    severity: "error",
    enabled: true,
    defaultPenalty: 5,
    maxPenalty: 5,
    applicableProfiles: [],
    tags: ["duplicate", "metadata"],
    evaluator: (m) => ({
      triggered: m.duplicateMeta,
      penaltyApplied: m.duplicateMeta ? 5 : 0,
      evidence: { duplicateMeta: m.duplicateMeta },
    }),
  },
  {
    id: "duplicate-h1",
    name: "Duplicate H1",
    description: "H1 heading matches another page exactly.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 3,
    maxPenalty: 3,
    applicableProfiles: [],
    tags: ["duplicate", "metadata"],
    evaluator: (m) => ({
      triggered: m.duplicateH1,
      penaltyApplied: m.duplicateH1 ? 3 : 0,
      evidence: { duplicateH1: m.duplicateH1 },
    }),
  },
  {
    id: "duplicate-intro",
    name: "Duplicate Intro Content",
    description: "Intro content matches another page exactly.",
    severity: "error",
    enabled: true,
    defaultPenalty: 5,
    maxPenalty: 5,
    applicableProfiles: [],
    tags: ["duplicate", "content"],
    evaluator: (m) => ({
      triggered: m.duplicateIntro,
      penaltyApplied: m.duplicateIntro ? 5 : 0,
      evidence: { duplicateIntro: m.duplicateIntro },
    }),
  },
  {
    id: "duplicate-faq-content",
    name: "Duplicate FAQ Content",
    description: "FAQ content matches another page exactly.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 3,
    maxPenalty: 3,
    applicableProfiles: [],
    tags: ["duplicate", "content"],
    evaluator: (m) => ({
      triggered: m.duplicateFaq,
      penaltyApplied: m.duplicateFaq ? 3 : 0,
      evidence: { duplicateFaq: m.duplicateFaq },
    }),
  },
  {
    id: "content-hash-collision",
    name: "Content Hash Collision",
    description: "Content hash matches another page — exact intro duplicate.",
    severity: "error",
    enabled: true,
    defaultPenalty: 10,
    maxPenalty: 10,
    applicableProfiles: [],
    tags: ["duplicate", "content"],
    evaluator: (m) => ({
      triggered: m.contentHashCollision,
      penaltyApplied: m.contentHashCollision ? 10 : 0,
      evidence: { contentHashCollision: m.contentHashCollision },
    }),
  },
  {
    id: "weak-faq",
    name: "Weak FAQ",
    description: "FAQ section has thin answers or insufficient coverage.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content", "faq"],
    evaluator: (m) => {
      const triggered = m.faqThinAnswers > 1 || m.faqCount < 3;
      return {
        triggered,
        penaltyApplied: 0,
        evidence: { faqCount: m.faqCount, faqThinAnswers: m.faqThinAnswers },
      };
    },
  },
  {
    id: "low-entity-density",
    name: "Low Local Entity Density",
    description: "Page contains too few city-specific entities per 100 words.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content", "local"],
    evaluator: (m) => {
      const threshold = 2.0;
      const triggered = m.localEntityDensityPer100 < threshold;
      return {
        triggered,
        penaltyApplied: 0,
        evidence: {
          localEntityDensityPer100: m.localEntityDensityPer100,
          threshold,
        },
      };
    },
  },
  {
    id: "poor-internal-linking",
    name: "Poor Internal Linking",
    description: "Page has fewer internal links than the recommended minimum.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content", "links"],
    evaluator: (m) => {
      const threshold = 3;
      const triggered = m.internalLinksCount < threshold;
      return {
        triggered,
        penaltyApplied: 0,
        evidence: { internalLinksCount: m.internalLinksCount, threshold },
      };
    },
  },
  {
    id: "keyword-stuffing",
    name: "Keyword Stuffing",
    description: "Primary keyword density exceeds 4%.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 5,
    maxPenalty: 5,
    applicableProfiles: [],
    tags: ["content", "keyword"],
    evaluator: (m) => ({
      triggered: m.keywordStuffingRisk,
      penaltyApplied: m.keywordStuffingRisk ? 5 : 0,
      evidence: { keywordDensity: m.keywordDensity, threshold: 0.04 },
    }),
  },
  {
    id: "ai-phrase-detected",
    name: "AI Pattern Phrases Detected",
    description: "Content contains known AI-generated phrasing patterns.",
    severity: "info",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content", "quality"],
    evaluator: (m) => {
      const threshold = 0.10;
      const triggered = m.aiPhraseRatio > threshold;
      return {
        triggered,
        penaltyApplied: 0,
        evidence: { aiPhraseRatio: m.aiPhraseRatio, threshold },
      };
    },
  },
  {
    id: "missing-local-context",
    name: "Missing Local Context",
    description: "Too many generic template phrases; insufficient local specificity.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content", "local"],
    evaluator: (m) => {
      const threshold = 0.20;
      const triggered = m.genericPhraseRatio > threshold;
      return {
        triggered,
        penaltyApplied: 0,
        evidence: { genericPhraseRatio: m.genericPhraseRatio, threshold },
      };
    },
  },
  {
    id: "template-sentence-overuse",
    name: "Template Sentence Overuse",
    description: "Too many sentences follow a predictable opener + city-name pattern.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["content", "quality"],
    evaluator: (m) => {
      const threshold = 0.30;
      const triggered = m.templateSentenceRatio > threshold;
      return {
        triggered,
        penaltyApplied: 0,
        evidence: { templateSentenceRatio: m.templateSentenceRatio, threshold },
      };
    },
  },
  {
    id: "missing-structured-data",
    name: "Missing Structured Data",
    description: "Page has no JSON-LD structured data block.",
    severity: "info",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["metadata"],
    evaluator: (m) => ({
      triggered: !m.structuredDataPresent,
      penaltyApplied: 0,
      evidence: { structuredDataPresent: m.structuredDataPresent },
    }),
  },
  {
    id: "h1-equals-title",
    name: "H1 Equals Title",
    description: "H1 heading is identical to the page title.",
    severity: "info",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["metadata"],
    evaluator: (m) => ({
      triggered: m.h1EqualsTitle,
      penaltyApplied: 0,
      evidence: { h1EqualsTitle: m.h1EqualsTitle },
    }),
  },
  {
    id: "short-meta-description",
    name: "Short Meta Description",
    description: "Meta description is outside the optimal 100–165 character range.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["metadata"],
    evaluator: (m) => ({
      triggered: m.metaPresent && !m.metaInOptimalRange,
      penaltyApplied: 0,
      evidence: { metaLength: m.metaLength, optimalRange: "100–165" },
    }),
  },
  {
    id: "short-title",
    name: "Short or Long Title",
    description: "Title is outside the optimal 30–65 character range.",
    severity: "warning",
    enabled: true,
    defaultPenalty: 0,
    maxPenalty: 0,
    applicableProfiles: [],
    tags: ["metadata"],
    evaluator: (m) => ({
      triggered: m.titlePresent && !m.titleInOptimalRange,
      penaltyApplied: 0,
      evidence: { titleLength: m.titleLength, optimalRange: "30–65" },
    }),
  },
];

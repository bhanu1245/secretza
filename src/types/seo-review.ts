/**
 * Browser-safe SEO Review Studio types and utilities.
 * Client components must import from this file only — never from server lib modules.
 */

export type ReviewPageStatus =
  | "excellent"
  | "ready"
  | "needs_improvement"
  | "regenerated"
  | "improved"
  | "skipped"
  | "failed";

export type CityPackQualitySettings = {
  minSeo: number;
  minUniqueness: number;
  minReadability: number;
  productionMinSeo: number;
  productionMinUniqueness: number;
  productionMinReadability: number;
  retryUntilSeo: number | null;
  retryUntilUniqueness: number | null;
  maxRetries: number;
};

/** Alias used by Review Studio UI */
export type QualitySettings = CityPackQualitySettings;

export const DEFAULT_QUALITY_SETTINGS: CityPackQualitySettings = {
  minSeo: 75,
  minUniqueness: 60,
  minReadability: 70,
  productionMinSeo: 90,
  productionMinUniqueness: 85,
  productionMinReadability: 80,
  retryUntilSeo: null,
  retryUntilUniqueness: null,
  maxRetries: 3,
};

export type ReviewPageDiff = {
  intro: { old: string; new: string; changed: boolean };
  seoDelta: number | null;
  uniquenessDelta: number | null;
};

/** API-serialized page row for Review Studio table */
export type ReviewPageRow = {
  pageType: string;
  pageSlug: string;
  canonicalUrl: string;
  title: string;
  metaDescription?: string;
  h1?: string;
  introPreview?: string;
  uniqueness: number;
  seo: number;
  readability: number;
  wouldSave: boolean;
  saveReason: string;
  wordCount: number;
  duplicateRisk: string;
  status: string;
  productionReady: boolean;
  generatedAt: string;
  generationTimeMs: number;
  internalLinksCount?: number;
  faqCount?: number;
  localIntelligence?: boolean;
  aiNotes?: string;
  validationIssues?: string[];
  diff?: ReviewPageDiff;
};

export type ReviewDashboard = {
  pageCount: number;
  wouldSaveCount: number;
  excellentCount: number;
  needsImprovementCount: number;
  productionReadyCount: number;
  weakSeoCount: number;
  duplicateCount: number;
  avgSeo: number | null;
  avgUniqueness: number | null;
  avgReadability: number | null;
  estimatedQuality: "Excellent" | "Good" | "Fair" | "Poor" | string;
};

export type CityPackReviewPage = ReviewPageRow & {
  contentJson: string;
  metaDescription: string;
  h1: string;
  introPreview: string;
  internalLinksCount: number;
  faqCount: number;
  localIntelligence: boolean;
  aiNotes: string;
  validationIssues: string[];
  priorSnapshot?: {
    seo: number;
    uniqueness: number;
    readability: number;
    intro: string;
  };
};

export type ScoreColor = "green" | "blue" | "orange" | "red";

export function scoreColor(
  value: number,
  tiers: { green: number; blue: number; orange: number },
): ScoreColor {
  if (value >= tiers.green) return "green";
  if (value >= tiers.blue) return "blue";
  if (value >= tiers.orange) return "orange";
  return "red";
}

export function seoScoreColor(seo: number): ScoreColor {
  return scoreColor(seo, { green: 90, blue: 75, orange: 60 });
}

export function uniquenessScoreColor(u: number): ScoreColor {
  return scoreColor(u, { green: 85, blue: 70, orange: 50 });
}

export function readabilityScoreColor(score: number): ScoreColor {
  if (score >= 80) return "green";
  if (score >= 70) return "blue";
  if (score >= 60) return "orange";
  return "red";
}

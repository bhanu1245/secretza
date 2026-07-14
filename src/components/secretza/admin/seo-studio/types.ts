export type RegenerationMode =
  | "all"
  | "selected_cities"
  | "duplicate_risk"
  | "low_score"
  | "below_words";

export interface RunProgress {
  id: string;
  status: string;
  mode: string;
  dryRun: boolean;
  confirmed: boolean;
  batchSize: number;
  totalPages: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  remaining: number;
  avgUniqueness: number | null;
  avgSeoScore: number | null;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  estimatedRemainingMs: number | null;
  createdByEmail: string | null;
  errorMessage: string | null;
}

export type BatchCompletionReport = {
  pagesProcessed: number;
  pagesUpdated: number;
  pagesImproved: number;
  pagesUnchanged: number;
  pagesSkipped: number;
  failures: number;
  averagePriorUniqueness: number | null;
  averageUniqueness: number | null;
  averagePriorSeoScore: number | null;
  averageSeoScore: number | null;
};

export type DryRunBatchDashboard = {
  totalPages: number;
  meetingThreshold: number;
  failingUniqueness: number;
  failingSeo: number;
  avgUniqueness: number | null;
  avgSeo: number | null;
  avgGenerationTimeMs: number | null;
  wouldSaveCount: number;
};

export interface StudioItem {
  id: string;
  previewId?: string;
  seoPageId: string | null;
  pageSlug: string;
  pageType: string;
  status: string;
  error: string | null;
  predictedWords: number | null;
  predictedUnique: number | null;
  predictedScore: number | null;
  predictedRisk: string | null;
  versionId: string | null;
  priorUnique: number | null;
  priorSeoScore: number | null;
  saved?: boolean;
  discarded?: boolean;
  processedAt: string | null;
  updatedAt: string;
  page: {
    title: string | null;
    wordCount: number | null;
    faqCount: number | null;
    internalLinksCount: number | null;
    uniquenessScore: number | null;
    seoQualityScore: number | null;
    duplicateRisk: string | null;
    hasMeta: boolean;
    hasImage: boolean;
    updatedAt: string;
  } | null;
}

export type StudioFilter =
  | "all"
  | "high"
  | "medium"
  | "low"
  | "duplicate"
  | "low_score"
  | "low_uniqueness"
  | "missing_faq"
  | "missing_meta";

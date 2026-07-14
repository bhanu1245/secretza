/**
 * V6.1 — Generation metadata persistence and aggregation.
 */
import { db } from "@/lib/db";
import { getRegenerationSchemaHealth } from "@/lib/seo-schema-health";
import {
  safeRegenerationItemFindMany,
  safeRegenerationItemUpdate,
} from "@/lib/seo-regeneration-queries";

export type SeoGenerationMeta = {
  engineVersion: string;
  mode?: "partial" | "full";
  attemptsUsed: number;
  candidatesEvaluated: number;
  candidateSelected: number;
  paragraphsRewritten: number;
  duplicateConflictsFixed: number;
  uniquenessBefore: number | null;
  uniquenessAfter: number | null;
  seoBefore: number | null;
  seoAfter: number | null;
  generationTimeMs: number;
  intelligenceSources: string[];
  saveQuality?: "preferred" | "standard" | "good";
  /** @deprecated use engineVersion */
  engine?: string;
  requiresManualReview?: boolean;
  writingStyle?: string;
  architecture?: string;
  localReferenceCount?: number;
  listingContextFetchedAt?: string;
  failureReason?: string;
};

export function serializeGenerationMeta(meta: SeoGenerationMeta): string {
  return JSON.stringify(meta);
}

export function parseGenerationMeta(json: string | null | undefined): SeoGenerationMeta | null {
  if (!json?.trim()) return null;
  try {
    return JSON.parse(json) as SeoGenerationMeta;
  } catch {
    return null;
  }
}

export async function persistItemGenerationMeta(itemId: string, meta: SeoGenerationMeta) {
  const health = await getRegenerationSchemaHealth();
  if (!health.generationMetaJson) return;
  await safeRegenerationItemUpdate({
    where: { id: itemId },
    data: { generationMetaJson: serializeGenerationMeta(meta) },
  });
}

export type RunDashboardStats = {
  avgGenerationTimeMs: number | null;
  avgUniquenessImprovement: number | null;
  totalRetries: number;
  totalCandidatesEvaluated: number;
  totalParagraphsRewritten: number;
  totalConflictsFixed: number;
  pagesAutoSaved: number;
  pagesManualReview: number;
  pagesPartialRegen: number;
  estimatedTokenCost: number;
};

const EMPTY_DASHBOARD: RunDashboardStats = {
  avgGenerationTimeMs: null,
  avgUniquenessImprovement: null,
  totalRetries: 0,
  totalCandidatesEvaluated: 0,
  totalParagraphsRewritten: 0,
  totalConflictsFixed: 0,
  pagesAutoSaved: 0,
  pagesManualReview: 0,
  pagesPartialRegen: 0,
  estimatedTokenCost: 0,
};

export async function aggregateRunDashboardStats(runId: string): Promise<RunDashboardStats> {
  const health = await getRegenerationSchemaHealth();
  if (!health.generationMetaJson) return EMPTY_DASHBOARD;

  const items = await safeRegenerationItemFindMany({
    where: { runId },
    select: {
      status: true,
      generationMetaJson: true,
      predictedUnique: true,
    },
  });

  let timeSum = 0;
  let timeCount = 0;
  let improveSum = 0;
  let improveCount = 0;
  let retries = 0;
  let candidates = 0;
  let paragraphs = 0;
  let conflicts = 0;
  let autoSaved = 0;
  let manualReview = 0;
  let partial = 0;

  for (const item of items) {
    const meta = parseGenerationMeta(item.generationMetaJson);
    if (!meta) continue;

    if (meta.generationTimeMs > 0) {
      timeSum += meta.generationTimeMs;
      timeCount++;
    }
    if (
      meta.uniquenessBefore != null &&
      meta.uniquenessAfter != null &&
      meta.uniquenessAfter > meta.uniquenessBefore
    ) {
      improveSum += meta.uniquenessAfter - meta.uniquenessBefore;
      improveCount++;
    }
    retries += meta.attemptsUsed;
    candidates += meta.candidatesEvaluated;
    paragraphs += meta.paragraphsRewritten;
    conflicts += meta.duplicateConflictsFixed;
    if (meta.mode === "partial") partial++;
    if (meta.requiresManualReview) manualReview++;
    if (item.status === "completed" && !meta.requiresManualReview) autoSaved++;
  }

  const estimatedTokenCost = Math.round(candidates * 850 + paragraphs * 120);

  return {
    avgGenerationTimeMs: timeCount > 0 ? Math.round(timeSum / timeCount) : null,
    avgUniquenessImprovement: improveCount > 0 ? Math.round(improveSum / improveCount) : null,
    totalRetries: retries,
    totalCandidatesEvaluated: candidates,
    totalParagraphsRewritten: paragraphs,
    totalConflictsFixed: conflicts,
    pagesAutoSaved: autoSaved,
    pagesManualReview: manualReview,
    pagesPartialRegen: partial,
    estimatedTokenCost,
  };
}

/** Aggregate V6.1 stats across recent regeneration items (monitor dashboard). */
export async function aggregateRecentV61Stats(days = 30): Promise<RunDashboardStats> {
  const health = await getRegenerationSchemaHealth();
  if (!health.generationMetaJson) return EMPTY_DASHBOARD;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const items = await safeRegenerationItemFindMany({
    where: {
      processedAt: { gte: since },
      generationMetaJson: { not: null },
    },
    select: { status: true, generationMetaJson: true },
  });

  let timeSum = 0;
  let timeCount = 0;
  let improveSum = 0;
  let improveCount = 0;
  let retries = 0;
  let candidates = 0;
  let paragraphs = 0;
  let conflicts = 0;
  let autoSaved = 0;
  let manualReview = 0;
  let partial = 0;

  for (const item of items) {
    const meta = parseGenerationMeta(item.generationMetaJson);
    if (!meta) continue;

    if (meta.generationTimeMs > 0) {
      timeSum += meta.generationTimeMs;
      timeCount++;
    }
    if (
      meta.uniquenessBefore != null &&
      meta.uniquenessAfter != null &&
      meta.uniquenessAfter > meta.uniquenessBefore
    ) {
      improveSum += meta.uniquenessAfter - meta.uniquenessBefore;
      improveCount++;
    }
    retries += meta.attemptsUsed;
    candidates += meta.candidatesEvaluated;
    paragraphs += meta.paragraphsRewritten;
    conflicts += meta.duplicateConflictsFixed;
    if (meta.mode === "partial") partial++;
    if (meta.requiresManualReview) manualReview++;
    if (item.status === "completed" && !meta.requiresManualReview) autoSaved++;
  }

  return {
    avgGenerationTimeMs: timeCount > 0 ? Math.round(timeSum / timeCount) : null,
    avgUniquenessImprovement: improveCount > 0 ? Math.round(improveSum / improveCount) : null,
    totalRetries: retries,
    totalCandidatesEvaluated: candidates,
    totalParagraphsRewritten: paragraphs,
    totalConflictsFixed: conflicts,
    pagesAutoSaved: autoSaved,
    pagesManualReview: manualReview,
    pagesPartialRegen: partial,
    estimatedTokenCost: Math.round(candidates * 850 + paragraphs * 120),
  };
}

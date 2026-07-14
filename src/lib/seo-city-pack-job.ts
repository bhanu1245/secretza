/**
 * In-memory city pack generation jobs with progress tracking and stall detection.
 */
import "server-only";

import { randomUUID } from "crypto";
import type { GranularGenerateResult } from "@/lib/seo-granular-generation";
import { buildReviewDashboard, serializeReviewPageForApi } from "@/lib/seo-city-pack-review";
import {
  DEFAULT_QUALITY_SETTINGS,
  type CityPackQualitySettings,
  type CityPackReviewPage,
  type ReviewDashboard,
} from "@/types/seo-review";

export type CityPackJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stalled"
  | "cancelled";

export type CityPackStageTimings = {
  localIntelligence?: number;
  listingContext?: number;
  introGeneration?: number;
  faqGeneration?: number;
  ctaGeneration?: number;
  uniquenessCheck?: number;
  duplicateFixing?: number;
  save?: number;
  total?: number;
};

export type CityPackDryRunPage = CityPackReviewPage;

export type CityPackDryRunPreview = {
  ready: boolean;
  pages: CityPackReviewPage[];
  wouldSaveCount: number;
  avgUniqueness: number | null;
  avgSeo: number | null;
  avgReadability: number | null;
  failedPages: number;
  dashboard: ReviewDashboard;
};

export type CityPackJob = {
  jobId: string;
  status: CityPackJobStatus;
  cityId: string;
  cityName: string;
  dryRun: boolean;
  total: number;
  completed: number;
  created: number;
  skipped: number;
  failed: number;
  percentComplete: number;
  currentStage: string;
  currentPage: string | null;
  startedAt: string;
  updatedAt: string;
  lastProgressAt: string;
  elapsedMs: number;
  stageTimings: CityPackStageTimings;
  errors: string[];
  logs: string[];
  result: GranularGenerateResult | null;
  previewReady: boolean;
  dryRunPreview: CityPackDryRunPreview | null;
  qualitySettings: CityPackQualitySettings;
  discardedAt: string | null;
  committedAt: string | null;
};

const STALL_THRESHOLD_MS = 60_000;
/** Keep completed jobs + preview data for 30 minutes. */
export const CITY_PACK_JOB_TTL_MS = 30 * 60 * 1000;

const jobs = new Map<string, CityPackJob>();

function nowIso() {
  return new Date().toISOString();
}

function logJob(job: CityPackJob, message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  job.logs.push(line);
  if (job.logs.length > 200) job.logs.shift();
  console.log(`CITY_PACK_JOB ${job.jobId} ${message}`);
}

function touchJob(job: CityPackJob, patch: Partial<CityPackJob> = {}) {
  const ts = nowIso();
  Object.assign(job, patch, { updatedAt: ts, lastProgressAt: ts });
  job.elapsedMs = Date.now() - new Date(job.startedAt).getTime();
  job.percentComplete =
    job.total > 0 ? Math.min(100, Math.round((job.completed / job.total) * 100)) : 0;
}

export function createCityPackJob(input: {
  cityId: string;
  cityName: string;
  total: number;
  dryRun?: boolean;
}): CityPackJob {
  purgeExpiredCityPackJobs();
  const job: CityPackJob = {
    jobId: randomUUID(),
    status: "queued",
    cityId: input.cityId,
    cityName: input.cityName,
    dryRun: input.dryRun === true,
    total: input.total,
    completed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    percentComplete: 0,
    currentStage: "queued",
    currentPage: null,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    lastProgressAt: nowIso(),
    elapsedMs: 0,
    stageTimings: {},
    errors: [],
    logs: [],
    result: null,
    previewReady: false,
    dryRunPreview: null,
    qualitySettings: { ...DEFAULT_QUALITY_SETTINGS },
    discardedAt: null,
    committedAt: null,
  };
  logJob(job, `Job created — ${input.total} page(s), dryRun=${job.dryRun}`);
  jobs.set(job.jobId, job);
  return job;
}

export function getCityPackJob(jobId: string): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const idleMs = Date.now() - new Date(job.lastProgressAt).getTime();
  if (
    (job.status === "running" || job.status === "queued") &&
    idleMs >= STALL_THRESHOLD_MS
  ) {
    job.status = "stalled";
    job.currentStage = "stalled";
    logJob(job, `Watchdog: no progress for ${Math.round(idleMs / 1000)}s — marked stalled`);
    touchJob(job);
  }

  job.elapsedMs = Date.now() - new Date(job.startedAt).getTime();
  return job;
}

export function updateCityPackJob(
  jobId: string,
  patch: Partial<CityPackJob> & { log?: string },
): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (patch.log) logJob(job, patch.log);
  const { log: _log, ...rest } = patch;
  touchJob(job, rest);
  return job;
}

export function recomputePreviewAggregates(
  pages: CityPackReviewPage[],
  settings: CityPackQualitySettings,
  failedPages: number,
): CityPackDryRunPreview {
  const dashboard = buildReviewDashboard(pages, settings);
  const active = pages.filter((p) => p.status !== "skipped");
  return {
    ready: true,
    pages,
    wouldSaveCount: dashboard.wouldSaveCount,
    avgUniqueness: dashboard.avgUniqueness,
    avgSeo: dashboard.avgSeo,
    avgReadability: dashboard.avgReadability,
    failedPages,
    dashboard,
  };
}

export function attachCityPackDryRunPreview(
  jobId: string,
  pages: CityPackReviewPage[],
): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const preview = recomputePreviewAggregates(pages, job.qualitySettings, job.failed);

  touchJob(job, { previewReady: true, dryRunPreview: preview });
  console.log("PREVIEW_READY", {
    jobId,
    pageCount: pages.length,
    wouldSaveCount: preview.wouldSaveCount,
    avgUniqueness: preview.avgUniqueness,
    avgSeo: preview.avgSeo,
  });
  logJob(job, `PREVIEW_READY — ${pages.length} page(s), ${preview.wouldSaveCount} would save`);
  return job;
}

export function updateCityPackPreviewPages(
  jobId: string,
  updater: (pages: CityPackReviewPage[]) => CityPackReviewPage[],
): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job?.dryRunPreview) return null;
  const pages = updater([...job.dryRunPreview.pages]);
  const preview = recomputePreviewAggregates(pages, job.qualitySettings, job.failed);
  touchJob(job, { previewReady: true, dryRunPreview: preview });
  return job;
}

export function getCityPackPreviewPage(
  jobId: string,
  pageSlug: string,
): CityPackReviewPage | null {
  const job = jobs.get(jobId);
  return job?.dryRunPreview?.pages.find((p) => p.pageSlug === pageSlug) ?? null;
}

export function setCityPackQualitySettings(
  jobId: string,
  settings: Partial<CityPackQualitySettings>,
): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  job.qualitySettings = { ...job.qualitySettings, ...settings };
  if (job.dryRunPreview) {
    job.dryRunPreview = recomputePreviewAggregates(
      job.dryRunPreview.pages,
      job.qualitySettings,
      job.failed,
    );
  }
  touchJob(job, { qualitySettings: job.qualitySettings });
  return job;
}

export function completeCityPackJob(
  jobId: string,
  result: GranularGenerateResult,
  stageTimings: CityPackStageTimings,
): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (job.dryRun && !job.previewReady) {
    logJob(job, "Cannot complete dry run — preview not ready");
    return failCityPackJob(jobId, "Preview data missing at completion");
  }

  touchJob(job, {
    status: "completed",
    currentStage: "completed",
    currentPage: null,
    result,
    created: result.created,
    skipped: result.skipped,
    completed: job.total,
    percentComplete: 100,
    stageTimings: {
      ...job.stageTimings,
      ...stageTimings,
      total: Date.now() - new Date(job.startedAt).getTime(),
    },
  });
  console.log("JOB_COMPLETED", {
    jobId,
    dryRun: job.dryRun,
    previewReady: job.previewReady,
    created: result.created,
    skipped: result.skipped,
    durationMs: job.stageTimings.total ?? job.elapsedMs,
  });
  logJob(
    job,
    `JOB_COMPLETED — created=${result.created} skipped=${result.skipped} dryRun=${job.dryRun} previewReady=${job.previewReady}`,
  );
  return job;
}

export function failCityPackJob(jobId: string, error: string): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  job.errors.push(error);
  touchJob(job, { status: "failed", currentStage: "failed", currentPage: null });
  logJob(job, `Failed — ${error}`);
  return job;
}

export function discardCityPackJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  console.log("USER_DISCARD", { jobId, dryRun: job.dryRun });
  logJob(job, "USER_DISCARD — preview discarded by user");
  touchJob(job, { discardedAt: nowIso(), status: "cancelled", currentStage: "discarded" });
  return true;
}

export function deleteCityPackJob(jobId: string, reason: string): boolean {
  const existed = jobs.delete(jobId);
  if (existed) console.log("JOB_CLEANUP", { jobId, reason });
  return existed;
}

export function markCityPackJobCommitted(jobId: string): CityPackJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  console.log("USER_COMMIT", { jobId, pageCount: job.dryRunPreview?.pages.length ?? 0 });
  logJob(job, "USER_COMMIT — changes committed to database");
  touchJob(job, { committedAt: nowIso(), currentStage: "committed" });
  return job;
}

export function purgeExpiredCityPackJobs(): void {
  const cutoff = Date.now() - CITY_PACK_JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (new Date(job.updatedAt).getTime() < cutoff) {
      jobs.delete(id);
      console.log("JOB_CLEANUP", { jobId: id, reason: "ttl_expired" });
    }
  }
}

export function serializeCityPackJob(job: CityPackJob, includePreview = false) {
  const base = {
    jobId: job.jobId,
    status: job.status,
    cityId: job.cityId,
    cityName: job.cityName,
    dryRun: job.dryRun,
    total: job.total,
    completed: job.completed,
    created: job.created,
    skipped: job.skipped,
    failed: job.failed,
    percentComplete: job.percentComplete,
    currentStage: job.currentStage,
    currentPage: job.currentPage,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    lastProgressAt: job.lastProgressAt,
    elapsedMs: job.elapsedMs,
    stageTimings: job.stageTimings,
    errors: job.errors,
    previewReady: job.previewReady,
    committedAt: job.committedAt,
    discardedAt: job.discardedAt,
    result: job.result
      ? {
          created: job.result.created,
          skipped: job.result.skipped,
          total: job.result.total,
          cityName: job.result.cityName,
          stateName: job.result.stateName,
          countryName: job.result.countryName,
        }
      : null,
    qualitySettings: job.qualitySettings,
    dryRunPreview: job.dryRunPreview
      ? {
          ready: job.dryRunPreview.ready,
          wouldSaveCount: job.dryRunPreview.wouldSaveCount,
          avgUniqueness: job.dryRunPreview.avgUniqueness,
          avgSeo: job.dryRunPreview.avgSeo,
          avgReadability: job.dryRunPreview.avgReadability,
          failedPages: job.dryRunPreview.failedPages,
          pageCount: job.dryRunPreview.pages.length,
          dashboard: job.dryRunPreview.dashboard,
          pages: includePreview
            ? job.dryRunPreview.pages.map((p) => serializeReviewPageForApi(p))
            : undefined,
        }
      : null,
  };
  return base;
}

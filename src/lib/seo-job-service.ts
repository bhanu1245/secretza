/**
 * SEO Dashboard V2 Phase 4 — background job queue service.
 */
import { db } from "@/lib/db";
import { clearRegenerationCaches } from "@/lib/seo-regeneration-service";
import { beginSeoJobRun, clearSeoPeerCache, endSeoJobRun } from "@/lib/seo-peer-cache";
import { scheduleSeoBackgroundWork } from "@/lib/seo-background-scheduler";
import { processSeoJobItem, type ItemProcessResult } from "@/lib/seo-job-processors";
import {
  ALLOWED_BATCH_SIZES,
  CONCURRENT_JOB_TYPES,
  DEFAULT_JOB_BATCH_SIZE,
  estimateJobDurationMinutes,
  isSeoJobType,
  type SeoJobPayload,
  type SeoJobStatus,
  type SeoJobType,
} from "@/lib/seo-job-types";
import { getExecutionProfile } from "@/lib/seo-job-execution-profiles";

const runningJobs = new Set<string>();

// P0-2: in-memory cancel signals.  cancelSeoJob() adds a jobId here so the
// per-item loop can detect cancellation without a DB read on every item.
// Entries are cleaned up when the job is finalized or confirmed cancelled.
const cancelledJobs = new Set<string>();

export type CreateSeoJobInput = {
  jobType: SeoJobType;
  pageIds: string[];
  payload?: SeoJobPayload;
  batchSize?: number;
  createdBy?: { id: string; email: string };
  issueTypes?: string[];
};

export type JobPreview = {
  jobType: SeoJobType;
  pageCount: number;
  estimatedMinutes: number;
  issueTypes: string[];
  batchSize: number;
};

export async function previewSeoJob(input: {
  jobType: string;
  pageIds: string[];
  issueTypes?: string[];
  batchSize?: number;
}): Promise<JobPreview> {
  if (!isSeoJobType(input.jobType)) {
    throw new Error(`Invalid job type: ${input.jobType}`);
  }
  const batchSize = normalizeBatchSize(input.batchSize);
  return {
    jobType: input.jobType,
    pageCount: input.pageIds.length,
    estimatedMinutes: estimateJobDurationMinutes(input.pageIds.length, input.jobType),
    issueTypes: input.issueTypes ?? [],
    batchSize,
  };
}

export async function getActiveJobForType(jobType: SeoJobType) {
  return db.seoJob.findFirst({
    where: { jobType, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSeoJob(input: CreateSeoJobInput) {
  if (!isSeoJobType(input.jobType)) {
    throw new Error(`Invalid job type: ${input.jobType}`);
  }
  if (input.pageIds.length === 0) {
    throw new Error("No pages selected");
  }

  if (CONCURRENT_JOB_TYPES.has(input.jobType)) {
    const active = await getActiveJobForType(input.jobType);
    if (active) {
      return {
        conflict: true as const,
        activeJob: serializeJobProgress(active),
        message: `Another ${input.jobType} job is already running.`,
      };
    }
  }

  if (input.jobType === "delete_pages" && !input.payload?.confirmDestructive) {
    throw new Error("Delete jobs require confirmDestructive: true");
  }

  const profile = getExecutionProfile(input.jobType);
  const batchSize = normalizeBatchSize(input.batchSize ?? profile.batchSize);
  const uniquePageIds = [...new Set(input.pageIds)];

  const pages = await db.seoPage.findMany({
    where: { id: { in: uniquePageIds } },
    select: { id: true, pageType: true, pageSlug: true },
  });

  if (pages.length === 0) {
    throw new Error("No valid pages found");
  }

  const payload: SeoJobPayload = {
    ...input.payload,
    pageIds: pages.map((p) => p.id),
    issueTypes: input.issueTypes,
  };

  console.log("SEO_JOB_CREATE", {
    jobType: input.jobType,
    pageCount: pages.length,
    batchSize,
  });

  const job = await db.seoJob.create({
    data: {
      jobType: input.jobType,
      status: "queued",
      total: pages.length,
      batchSize,
      payloadJson: JSON.stringify(payload),
      issueTypesJson: JSON.stringify(input.issueTypes ?? []),
      createdById: input.createdBy?.id,
      createdByEmail: input.createdBy?.email,
    },
  });

  await createJobItemsInBatches(job.id, pages);
  console.log("SEO_JOB_COMMIT", { jobId: job.id, itemCount: pages.length });

  if (input.createdBy) {
    await db.auditLog.create({
      data: {
        userId: input.createdBy.id,
        action: "seo_job_created",
        entityType: "SeoJob",
        entityId: job.id,
        details: JSON.stringify({
          jobType: input.jobType,
          total: pages.length,
          issueTypes: input.issueTypes ?? [],
        }),
      },
    });
  }

  beginSeoJobRun(job.id);
  let firstBatch: Awaited<ReturnType<typeof processSeoJobBatch>>;
  try {
    firstBatch = await processSeoJobBatch(job.id);
  } finally {
    endSeoJobRun(job.id);
  }
  console.log("SEO_JOB_FIRST_BATCH", {
    jobId: job.id,
    processed: firstBatch.processed,
    done: firstBatch.done,
  });

  if (!firstBatch.done) {
    kickOffSeoJobProcessing(job.id);
  }

  const refreshed = await db.seoJob.findUnique({ where: { id: job.id } });
  return {
    conflict: false as const,
    job: serializeJobProgress(refreshed ?? job),
  };
}

async function createJobItemsInBatches(
  jobId: string,
  pages: Array<{ id: string; pageType: string; pageSlug: string }>,
) {
  const CHUNK = 500;
  for (let i = 0; i < pages.length; i += CHUNK) {
    const slice = pages.slice(i, i + CHUNK);
    await db.seoJobItem.createMany({
      data: slice.map((p) => ({
        jobId,
        seoPageId: p.id,
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        status: "queued",
      })),
    });
  }
}

export async function resetOrphanedSeoJobItems(jobId: string) {
  const reset = await db.seoJobItem.updateMany({
    where: { jobId, status: "processing" },
    data: { status: "queued", error: null, processedAt: null },
  });
  if (reset.count > 0) {
    console.log("SEO_JOB_RESET_ORPHANS", { jobId, count: reset.count });
  }
  return reset.count;
}

export async function processSeoJobBatch(jobId: string, batchSize?: number) {
  const job = await db.seoJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  if (job.status === "cancelled" || job.status === "completed" || job.status === "failed") {
    cancelledJobs.delete(jobId); // P0-2: clean up stale signal if any
    return { processed: 0, done: true, job: serializeJobProgress(job) };
  }

  await resetOrphanedSeoJobItems(jobId);

  const { concurrency, checkpointInterval } = getExecutionProfile(job.jobType as SeoJobType);
  const limit = batchSize ?? job.batchSize ?? DEFAULT_JOB_BATCH_SIZE;
  console.log("SEO_JOB_BATCH_START", { jobId, limit, status: job.status, concurrency });
  const payload = parsePayload(job.payloadJson);

  const items = await db.seoJobItem.findMany({
    where: { jobId, status: "queued" },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) {
    const finalized = await finalizeSeoJob(jobId);
    return { processed: 0, done: true, job: serializeJobProgress(finalized) };
  }

  await db.seoJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: job.startedAt ?? new Date(),
      lastCheckpointAt: new Date(),
    },
  });

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ pageId: string; error: string }> = [];
  let processedSinceCheckpoint = 0;
  let lastCheckpointItemId: string | undefined;

  const ctx = {
    jobType: job.jobType as SeoJobType,
    payload,
    createdBy:
      job.createdById && job.createdByEmail
        ? { id: job.createdById, email: job.createdByEmail }
        : undefined,
  };

  // Process items in concurrent chunks sized by the job type's execution profile.
  // Within each chunk: mark all items in-flight (sequential, fast), then process
  // concurrently, then collect outcomes sequentially.  The sequential bookends
  // keep SQLite write-lock contention minimal while the concurrent middle
  // overlaps I/O waits (AI calls, DB reads).
  for (let i = 0; i < items.length; i += concurrency) {
    if (cancelledJobs.has(jobId)) {
      console.log("[seo-job-service] cancel detected in-memory, breaking batch", { jobId });
      break;
    }

    const chunk = items.slice(i, i + concurrency);

    // Mark the chunk in-flight (sequential to avoid SQLite write-lock pile-up)
    for (const item of chunk) {
      await db.seoJobItem.update({ where: { id: item.id }, data: { status: "processing" } });
    }

    // Process the chunk concurrently — each item is isolated; failures don't abort siblings
    const settled = await Promise.allSettled(chunk.map((item) => processSeoJobItem(item, ctx)));

    // Collect outcomes and write item results (sequential)
    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j];
      const s = settled[j];
      const result: ItemProcessResult =
        s.status === "fulfilled"
          ? s.value
          : {
              status: "failed",
              error: s.reason instanceof Error ? s.reason.message : "Unexpected error",
            };

      const itemStatus =
        result.status === "completed"
          ? "completed"
          : result.status === "skipped"
            ? "skipped"
            : "failed";

      await db.seoJobItem.update({
        where: { id: item.id },
        data: {
          status: itemStatus,
          error:
            result.status === "failed"
              ? result.error
              : result.status === "skipped"
                ? result.reason
                : null,
          processedAt: new Date(),
        },
      });

      if (result.status === "completed") success++;
      else if (result.status === "skipped") skipped++;
      else {
        failed++;
        errors.push({
          pageId: item.seoPageId ?? item.id,
          error: result.status === "failed" ? result.error : "failed",
        });
      }
      lastCheckpointItemId = item.id;
    }

    // Interval checkpoint — write live progress without a per-item DB round-trip
    processedSinceCheckpoint += chunk.length;
    if (processedSinceCheckpoint >= checkpointInterval) {
      await db.seoJob.update({
        where: { id: jobId },
        data: { lastProcessedId: lastCheckpointItemId, lastCheckpointAt: new Date() },
      });
      processedSinceCheckpoint = 0;
    }
  }

  // Single batch-level aggregate write (replaces per-item SeoJob checkpoint updates)
  const updated = await db.seoJob.update({
    where: { id: jobId },
    data: {
      processed: { increment: items.length },
      successCount: { increment: success },
      failedCount: { increment: failed },
      skippedCount: { increment: skipped },
      errorLog: appendErrorLog(job.errorLog, errors),
      progress: computeProgress(job.total, job.processed + items.length),
      estimatedTimeRemaining: estimateRemainingSeconds(
        job.total,
        job.processed + items.length,
        job.startedAt,
      ),
      lastCheckpointAt: new Date(),
      ...(lastCheckpointItemId ? { lastProcessedId: lastCheckpointItemId } : {}),
    },
  });

  const remaining = await db.seoJobItem.count({
    where: { jobId, status: "queued" },
  });

  if (remaining === 0) {
    const finalized = await finalizeSeoJob(jobId);
    clearRegenerationCaches();
    clearSeoPeerCache();
    console.log("SEO_JOB_COMPLETE", { jobId, status: finalized.status });
    return {
      processed: items.length,
      done: true,
      job: serializeJobProgress(finalized),
    };
  }

  console.log("SEO_JOB_BATCH_DONE", {
    jobId,
    processed: items.length,
    remaining,
    progress: updated.progress,
  });

  return {
    processed: items.length,
    done: false,
    job: serializeJobProgress(updated),
  };
}

export async function processSeoJobUntilDone(jobId: string, maxBatches = 10_000) {
  if (runningJobs.has(jobId)) {
    return { alreadyRunning: true };
  }
  runningJobs.add(jobId);
  beginSeoJobRun(jobId); // P0-3: suppress peer cache clears for the duration of this run
  try {
    let batches = 0;
    let totalProcessed = 0;
    while (batches < maxBatches) {
      const result = await processSeoJobBatch(jobId);
      totalProcessed += result.processed;
      if (result.done) break;
      batches++;
    }
    const job = await db.seoJob.findUnique({ where: { id: jobId } });
    return { totalProcessed, batches, job: job ? serializeJobProgress(job) : null };
  } finally {
    runningJobs.delete(jobId);
    endSeoJobRun(jobId); // P0-3: flush peer cache now that the job is done
  }
}

export function kickOffSeoJobProcessing(jobId: string) {
  if (runningJobs.has(jobId)) {
    console.log("SEO_JOB_KICKOFF_SKIP", { jobId, reason: "already_running" });
    return;
  }
  console.log("SEO_JOB_KICKOFF", { jobId });
  scheduleSeoBackgroundWork(`seo-job:${jobId}`, async () => {
    const result = await processSeoJobUntilDone(jobId);
    if (result.job?.status === "failed") {
      throw new Error("Job processing ended in failed state");
    }
  });
}

export async function cancelSeoJob(jobId: string) {
  const job = await db.seoJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.status === "completed" || job.status === "cancelled") {
    return serializeJobProgress(job);
  }

  const updated = await db.seoJob.update({
    where: { id: jobId },
    data: { status: "cancelled", completedAt: new Date() },
  });

  cancelledJobs.add(jobId); // P0-2: signal running batch to stop without a DB read

  await db.seoJobItem.updateMany({
    where: { jobId, status: "queued" },
    data: { status: "skipped", error: "Job cancelled", processedAt: new Date() },
  });

  return serializeJobProgress(updated);
}

export async function retryFailedSeoJobItems(jobId: string, createdBy?: { id: string; email: string }) {
  cancelledJobs.delete(jobId); // P0-2: clear any stale cancel signal before retry resumes
  const job = await db.seoJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  const failedCount = await db.seoJobItem.count({
    where: { jobId, status: "failed" },
  });
  if (failedCount === 0) {
    return { job: serializeJobProgress(job), requeued: 0 };
  }

  await db.seoJobItem.updateMany({
    where: { jobId, status: "failed" },
    data: { status: "queued", error: null, processedAt: null },
  });

  const processedBaseline = job.successCount + job.skippedCount;
  const updated = await db.seoJob.update({
    where: { id: jobId },
    data: {
      status: "queued",
      completedAt: null,
      failedCount: 0,
      processed: processedBaseline,
      progress: computeProgress(job.total, processedBaseline),
      payloadJson: JSON.stringify({
        ...parsePayload(job.payloadJson),
        retryFailedOnly: true,
      }),
    },
  });

  if (createdBy) {
    await db.auditLog.create({
      data: {
        userId: createdBy.id,
        action: "seo_job_retry_failed",
        entityType: "SeoJob",
        entityId: jobId,
        details: JSON.stringify({ requeued: failedCount }),
      },
    });
  }

  kickOffSeoJobProcessing(jobId);

  return { job: serializeJobProgress(updated), requeued: failedCount };
}

async function finalizeSeoJob(jobId: string) {
  const job = await db.seoJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  const finalStatus: SeoJobStatus =
    job.failedCount > 0 && job.successCount === 0 ? "failed" : "completed";

  cancelledJobs.delete(jobId); // P0-2: clean up cancel signal on natural completion

  const updated = await db.seoJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      progress: 100,
      estimatedTimeRemaining: 0,
    },
  });

  await db.auditLog.create({
    data: {
      userId: job.createdById,
      action: "seo_job_completed",
      entityType: "SeoJob",
      entityId: jobId,
      details: JSON.stringify({
        jobType: job.jobType,
        total: job.total,
        successCount: job.successCount,
        failedCount: job.failedCount,
        skippedCount: job.skippedCount,
        durationMs: job.startedAt
          ? Date.now() - job.startedAt.getTime()
          : null,
      }),
    },
  });

  return updated;
}

async function isJobCancelled(jobId: string) {
  const job = await db.seoJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === "cancelled";
}

function parsePayload(json: string | null): SeoJobPayload {
  if (!json) return {};
  try {
    return JSON.parse(json) as SeoJobPayload;
  } catch {
    return {};
  }
}

function appendErrorLog(
  existing: string | null,
  errors: Array<{ pageId: string; error: string }>,
): string {
  const prev: unknown[] = existing ? (JSON.parse(existing) as unknown[]) : [];
  return JSON.stringify([...prev, ...errors].slice(-500));
}

function computeProgress(total: number, processed: number): number {
  if (total <= 0) return 100;
  return Math.round((processed / total) * 1000) / 10;
}

function estimateRemainingSeconds(
  total: number,
  processed: number,
  startedAt: Date | null,
): number | null {
  if (!startedAt || processed <= 0 || processed >= total) return null;
  const elapsed = (Date.now() - startedAt.getTime()) / 1000;
  const perItem = elapsed / processed;
  return Math.round(perItem * (total - processed));
}

function normalizeBatchSize(size?: number): number {
  if (size && (ALLOWED_BATCH_SIZES as readonly number[]).includes(size)) {
    return size;
  }
  return DEFAULT_JOB_BATCH_SIZE;
}

export function serializeJobProgress(job: {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  total: number;
  processed: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  batchSize: number;
  estimatedTimeRemaining: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdById: string | null;
  createdByEmail: string | null;
  payloadJson: string | null;
  issueTypesJson: string | null;
  errorLog: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const remaining = Math.max(0, job.total - job.processed);
  return {
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    progress: job.progress,
    percentComplete: job.progress,
    total: job.total,
    processed: job.processed,
    remaining,
    successCount: job.successCount,
    failedCount: job.failedCount,
    skippedCount: job.skippedCount,
    batchSize: job.batchSize,
    estimatedTimeRemaining: job.estimatedTimeRemaining,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdById: job.createdById,
    createdByEmail: job.createdByEmail,
    payload: parsePayload(job.payloadJson),
    issueTypes: job.issueTypesJson ? (JSON.parse(job.issueTypesJson) as string[]) : [],
    errorLog: job.errorLog ? (JSON.parse(job.errorLog) as unknown[]) : [],
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export async function listSeoJobs(options?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = options?.status ? { status: options.status } : {};

  const [jobs, total] = await Promise.all([
    db.seoJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.seoJob.count({ where }),
  ]);

  return {
    jobs: jobs.map(serializeJobProgress),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSeoJob(jobId: string) {
  const job = await db.seoJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  return serializeJobProgress(job);
}

/** Resume interrupted jobs after server restart (does not reset job state). */
export async function resumeStaleSeoJobs() {
  const stale = await db.seoJob.findMany({
    where: { status: { in: ["queued", "running"] } },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  if (stale.length > 0) {
    console.log("SEO_JOB_RESUME_STALE", { count: stale.length, ids: stale.map((j) => j.id) });
  }
  for (const job of stale) {
    if (!runningJobs.has(job.id)) {
      await resetOrphanedSeoJobItems(job.id);
      kickOffSeoJobProcessing(job.id);
    }
  }
  return stale.length;
}

export async function listSeoJobAuditLogs(options?: {
  action?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = {
    entityType: "SeoJob",
    ...(options?.action ? { action: options.action } : { action: { startsWith: "seo_job" } }),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        action: true,
        entityId: true,
        details: true,
        createdAt: true,
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      ...l,
      details: l.details ? (JSON.parse(l.details) as unknown) : null,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

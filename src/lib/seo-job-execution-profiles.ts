/**
 * Execution profiles for SEO background job types.
 *
 * Each profile defines three independent tuning knobs:
 *   concurrency        — items processed in parallel within a chunk
 *   batchSize          — items fetched per processSeoJobBatch() call (job-creation default)
 *   checkpointInterval — write a SeoJob progress checkpoint after this many items
 *
 * All values can be overridden per-environment via env vars without code changes.
 * AI jobs are gated by the external AI provider's rate limit; fast (DB-only) jobs
 * are gated by SQLite's write lock.  Profiles reflect those different ceilings.
 *
 * BullMQ migration note: concurrency maps directly to the Worker `concurrency`
 * option; batchSize maps to the queue producer batch size; checkpointInterval
 * maps to a BullMQ job-progress update frequency.
 */

import type { SeoJobType } from "@/lib/seo-job-types";
import { DEFAULT_JOB_BATCH_SIZE } from "@/lib/seo-job-types";

export type JobExecutionProfile = {
  /** Items processed concurrently per chunk. 1 = sequential (safe everywhere). */
  concurrency: number;
  /** Items fetched per batch; used as the per-type default at job-creation time. */
  batchSize: number;
  /** Write a SeoJob checkpoint after this many items (not every item). */
  checkpointInterval: number;
};

function envInt(key: string, fallback: number): number {
  const v = parseInt(process.env[key] ?? "", 10);
  return Number.isNaN(v) || v < 1 ? fallback : v;
}

// ── Tuning knobs (env-overridable) ──────────────────────────────────────────

/** Concurrency for jobs that call the AI provider (rate-limit governed). */
const AI_CONCURRENCY = envInt("SEO_JOB_AI_CONCURRENCY", 3);

/** Concurrency for pure DB-compute jobs (SQLite write-lock governed). */
const FAST_CONCURRENCY = envInt("SEO_JOB_FAST_CONCURRENCY", 5);

/** Batch size for AI jobs — smaller keeps each batch responsive to cancel. */
const AI_BATCH = envInt("SEO_JOB_AI_BATCH_SIZE", 100);

/** Batch size for fast DB jobs — larger amortises the batch-fetch overhead. */
const FAST_BATCH = envInt("SEO_JOB_FAST_BATCH_SIZE", 200);

/** Checkpoint interval for AI jobs: write progress every N items. */
const AI_CHECKPOINT = envInt("SEO_JOB_AI_CHECKPOINT_INTERVAL", 10);

/** Checkpoint interval for fast jobs: slightly larger since they finish quickly. */
const FAST_CHECKPOINT = envInt("SEO_JOB_FAST_CHECKPOINT_INTERVAL", 20);

// ── Named base profiles ──────────────────────────────────────────────────────

const AI_PROFILE: JobExecutionProfile = {
  concurrency: AI_CONCURRENCY,
  batchSize: AI_BATCH,
  checkpointInterval: AI_CHECKPOINT,
};

const FAST_PROFILE: JobExecutionProfile = {
  concurrency: FAST_CONCURRENCY,
  batchSize: FAST_BATCH,
  checkpointInterval: FAST_CHECKPOINT,
};

// ── Per-type profile table ───────────────────────────────────────────────────

export const EXECUTION_PROFILES: Record<SeoJobType, JobExecutionProfile> = {
  // AI-heavy — external HTTP call per item; rate-limit is the ceiling
  regenerate:               AI_PROFILE,
  autofix:                  AI_PROFILE,
  bulk_autofix:             AI_PROFILE,
  generate_ai_improvements: AI_PROFILE,
  generate_missing_meta:    AI_PROFILE,
  generate_missing_schema:  AI_PROFILE,
  generate_missing_images:  AI_PROFILE,
  repair_canonicals:        AI_PROFILE,
  repair_urls:              AI_PROFILE,
  recalculate_seo_score:    AI_PROFILE,

  // Fast / DB-compute — no external I/O; SQLite write-lock is the ceiling
  recalculate_word_count:      FAST_PROFILE,
  recalculate_internal_links:  FAST_PROFILE,
  recalculate_content_hash:    FAST_PROFILE,
  recalculate_readability:     FAST_PROFILE,
  archive_pages:               FAST_PROFILE,
  unarchive_pages:             FAST_PROFILE,
  delete_pages:                FAST_PROFILE,
};

const FALLBACK_PROFILE: JobExecutionProfile = {
  concurrency: 1,
  batchSize: DEFAULT_JOB_BATCH_SIZE,
  checkpointInterval: 10,
};

export function getExecutionProfile(jobType: SeoJobType): JobExecutionProfile {
  return EXECUTION_PROFILES[jobType] ?? FALLBACK_PROFILE;
}

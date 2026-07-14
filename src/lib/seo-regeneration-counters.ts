/**
 * Regeneration run counter invariants — derived from item statuses, never blind increments.
 */

export const REGEN_ITEM_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "skipped",
] as const;

export type RegenItemStatus = (typeof REGEN_ITEM_STATUSES)[number];

export type RegenStatusCounts = Record<RegenItemStatus, number>;

export function emptyRegenStatusCounts(): RegenStatusCounts {
  return { queued: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
}

export function countItemsByStatus(items: Array<{ status: string }>): RegenStatusCounts {
  const counts = emptyRegenStatusCounts();
  for (const item of items) {
    const key = item.status as RegenItemStatus;
    if (key in counts) counts[key]++;
  }
  return counts;
}

export function sumRegenStatusCounts(counts: RegenStatusCounts): number {
  return (
    counts.queued +
    counts.processing +
    counts.completed +
    counts.failed +
    counts.skipped
  );
}

/** Check completed + queued + processing + failed + skipped === total. */
export function checkRegenInvariant(totalPages: number, counts: RegenStatusCounts): {
  ok: boolean;
  sum: number;
  message?: string;
} {
  const sum = sumRegenStatusCounts(counts);
  if (sum !== totalPages) {
    return {
      ok: false,
      sum,
      message: `Invariant violated: sum=${sum} total=${totalPages}`,
    };
  }
  return { ok: true, sum };
}

/** Derive safe run counters — never negative, completed never exceeds total. */
export function deriveRunCounters(totalPages: number, counts: RegenStatusCounts) {
  const completedCount = Math.min(counts.completed, totalPages);
  const queuedCount = Math.max(0, counts.queued);
  const processingCount = Math.max(0, counts.processing);
  const failedCount = Math.max(0, counts.failed);
  const skippedCount = Math.max(0, counts.skipped);
  const remaining = Math.max(0, queuedCount + processingCount);

  return {
    totalPages,
    completedCount,
    queuedCount,
    processingCount,
    failedCount,
    skippedCount,
    remaining,
  };
}

/** Clamp stored run fields for API responses (defensive). */
export function clampRunProgressFields(totalPages: number, fields: {
  completedCount: number;
  queuedCount: number;
  processingCount: number;
  failedCount: number;
  skippedCount: number;
}) {
  return deriveRunCounters(totalPages, {
    queued: fields.queuedCount,
    processing: fields.processingCount,
    completed: fields.completedCount,
    failed: fields.failedCount,
    skipped: fields.skippedCount,
  });
}

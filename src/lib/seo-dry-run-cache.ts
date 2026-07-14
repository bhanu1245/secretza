/**
 * V6.2 — In-memory dry run preview cache (30 minute TTL).
 */
import { createHash } from "crypto";
const TTL_MS = 30 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  inputKey: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const previewCache = new Map<string, CacheEntry<any>>();
const sessionCache = new Map<string, CacheEntry<{ previewIds: string[]; dashboard: DryRunBatchDashboard }>>();

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

export function hashDryRunInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 24);
}

export function putDryRunPreview<T extends { previewId: string }>(preview: T, inputKey: string): void {
  previewCache.set(preview.previewId, {
    value: preview,
    expiresAt: Date.now() + TTL_MS,
    inputKey,
  });
}

export function getDryRunPreview<T = unknown>(previewId: string): T | null {
  const entry = previewCache.get(previewId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    previewCache.delete(previewId);
    return null;
  }
  return entry.value;
}

export function findCachedPreviewByInput<T = unknown>(inputKey: string): T | null {
  const now = Date.now();
  for (const [id, entry] of previewCache) {
    if (entry.inputKey === inputKey && entry.expiresAt > now) {
      return entry.value as T;
    }
    if (entry.expiresAt <= now) previewCache.delete(id);
  }
  return null;
}

export function putDryRunSession(
  sessionId: string,
  previewIds: string[],
  dashboard: DryRunBatchDashboard,
): void {
  sessionCache.set(sessionId, {
    value: { previewIds, dashboard },
    expiresAt: Date.now() + TTL_MS,
    inputKey: sessionId,
  });
}

export function getDryRunSession(sessionId: string): {
  previewIds: string[];
  dashboard: DryRunBatchDashboard;
} | null {
  const entry = sessionCache.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(sessionId);
    return null;
  }
  return entry.value;
}

export function purgeExpiredDryRunCache(): void {
  const now = Date.now();
  for (const [id, entry] of previewCache) {
    if (entry.expiresAt <= now) previewCache.delete(id);
  }
  for (const [id, entry] of sessionCache) {
    if (entry.expiresAt <= now) sessionCache.delete(id);
  }
}

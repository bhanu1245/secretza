/**
 * V6.2 — Dry run state cache backed by the local filesystem.
 *
 * In-memory Maps (even globalThis ones) are NOT shared between Next.js
 * webpack module instances (after() callbacks vs GET handlers get different
 * module copies in dev HMR mode). Writing to <os.tmpdir()> gives us a
 * storage layer that all module instances in the same process can read.
 */
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CACHE_DIR = path.join(os.tmpdir(), "secretza-dry-run-cache");
try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {
  // dir already exists
}

const TTL_MS = 30 * 60 * 1000;

// ── helpers ─────────────────────────────────────────────────────────────────

function filePath(name: string): string {
  return path.join(CACHE_DIR, name + ".json");
}

function writeEntry(name: string, value: unknown): void {
  try {
    fs.writeFileSync(filePath(name), JSON.stringify(value));
  } catch {
    // ignore write errors (tmpdir full etc.)
  }
}

function readEntry<T>(name: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), "utf8")) as T;
  } catch {
    return null;
  }
}

function deleteEntry(name: string): void {
  try {
    fs.unlinkSync(filePath(name));
  } catch {
    // already gone
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

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

type PreviewFile<T> = {
  value: T;
  expiresAt: number;
  inputKey: string;
};

type SessionFile = {
  previewIds: string[];
  dashboard: DryRunBatchDashboard;
  expiresAt: number;
};

type PendingFile =
  | { state: "processing"; expiresAt: number }
  | { state: "error"; error: string; expiresAt: number };

// ── Preview cache ────────────────────────────────────────────────────────────

export function hashDryRunInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 24);
}

export function putDryRunPreview<T extends { previewId: string }>(preview: T, inputKey: string): void {
  writeEntry("preview-" + preview.previewId, {
    value: preview,
    expiresAt: Date.now() + TTL_MS,
    inputKey,
  } satisfies PreviewFile<T>);
}

export function getDryRunPreview<T = unknown>(previewId: string): T | null {
  const entry = readEntry<PreviewFile<T>>("preview-" + previewId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    deleteEntry("preview-" + previewId);
    return null;
  }
  return entry.value;
}

export function findCachedPreviewByInput<T = unknown>(inputKey: string): T | null {
  // Scan cache dir for a preview matching this inputKey
  try {
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.startsWith("preview-"));
    const now = Date.now();
    for (const file of files) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8")) as PreviewFile<T>;
        if (entry.inputKey === inputKey && entry.expiresAt > now) return entry.value;
        if (entry.expiresAt <= now) fs.unlinkSync(path.join(CACHE_DIR, file));
      } catch {
        // corrupt file
      }
    }
  } catch {
    // tmpdir inaccessible
  }
  return null;
}

// ── Session cache ────────────────────────────────────────────────────────────

export function putDryRunSession(
  sessionId: string,
  previewIds: string[],
  dashboard: DryRunBatchDashboard,
): void {
  writeEntry("session-" + sessionId, {
    previewIds,
    dashboard,
    expiresAt: Date.now() + TTL_MS,
  } satisfies SessionFile);
}

export function getDryRunSession(sessionId: string): {
  previewIds: string[];
  dashboard: DryRunBatchDashboard;
} | null {
  const entry = readEntry<SessionFile>("session-" + sessionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    deleteEntry("session-" + sessionId);
    return null;
  }
  return { previewIds: entry.previewIds, dashboard: entry.dashboard };
}

// ── Pending (async dry-run) state ────────────────────────────────────────────

export function registerDryRunPending(sessionId: string): void {
  writeEntry("pending-" + sessionId, {
    state: "processing",
    expiresAt: Date.now() + TTL_MS,
  } satisfies PendingFile);
}

export function completeDryRunPending(sessionId: string): void {
  deleteEntry("pending-" + sessionId);
}

export function failDryRunPending(sessionId: string, error: string): void {
  writeEntry("pending-" + sessionId, {
    state: "error",
    error,
    expiresAt: Date.now() + 5 * 60 * 1000,
  } satisfies PendingFile);
}

export function getDryRunAsyncState(
  sessionId: string,
): "processing" | "completed" | "error" | "not_found" {
  const pending = readEntry<PendingFile>("pending-" + sessionId);
  if (pending) {
    if (Date.now() > pending.expiresAt) {
      deleteEntry("pending-" + sessionId);
      return "not_found";
    }
    return pending.state;
  }
  const session = getDryRunSession(sessionId);
  return session ? "completed" : "not_found";
}

export function getDryRunAsyncError(sessionId: string): string | null {
  const entry = readEntry<PendingFile>("pending-" + sessionId);
  return entry?.state === "error" ? entry.error : null;
}

export function purgeExpiredDryRunCache(): void {
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(CACHE_DIR)) {
      try {
        const entry = JSON.parse(
          fs.readFileSync(path.join(CACHE_DIR, file), "utf8"),
        ) as { expiresAt?: number };
        if (entry.expiresAt && entry.expiresAt <= now) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        }
      } catch {
        // corrupt / already deleted
      }
    }
  } catch {
    // tmpdir inaccessible
  }
}

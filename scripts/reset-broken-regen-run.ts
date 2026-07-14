/**
 * Cancel and repair a drifted regeneration run, then verify counters match items.
 * Usage: bun scripts/reset-broken-regen-run.ts [runId]
 */
import { db } from "@/lib/db";
import {
  cancelRegenerationRun,
  loadRegenerationStatusCounts,
  recomputeRunCounters,
} from "@/lib/seo-regeneration-service";
import { checkRegenInvariant } from "@/lib/seo-regeneration-counters";

const runId = process.argv[2] ?? "cmq9k6lzb00000sysbrepyqdk";

const before = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
if (!before) {
  console.error("Run not found:", runId);
  process.exit(1);
}

console.log("BEFORE", {
  status: before.status,
  totalPages: before.totalPages,
  completedCount: before.completedCount,
  queuedCount: before.queuedCount,
  failedCount: before.failedCount,
  skippedCount: before.skippedCount,
});

await cancelRegenerationRun(runId);
await recomputeRunCounters(runId);

const counts = await loadRegenerationStatusCounts(runId);
const invariant = checkRegenInvariant(before.totalPages, counts);
const after = await db.seoRegenerationRun.findUnique({ where: { id: runId } });

console.log("AFTER", {
  status: after?.status,
  totalPages: after?.totalPages,
  completedCount: after?.completedCount,
  queuedCount: after?.queuedCount,
  skippedCount: after?.skippedCount,
  itemCounts: counts,
  invariantOk: invariant.ok,
});

if (!invariant.ok) {
  console.error("Invariant still broken:", invariant.message);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, runId, message: "Run cancelled and counters repaired" }));
await db.$disconnect();

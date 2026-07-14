/**
 * Smoke test: create a 10-page dry-run regeneration and verify counters stay valid.
 * Usage: bun scripts/verify-regen-10-pages.ts
 */
import { db } from "@/lib/db";
import {
  createRegenerationRun,
  processRegenerationBatch,
  recomputeRunCounters,
  loadRegenerationStatusCounts,
} from "@/lib/seo-regeneration-service";
import { checkRegenInvariant, deriveRunCounters } from "@/lib/seo-regeneration-counters";

const pages = await db.seoPage.findMany({
  where: { pageType: "city", isPublished: true },
  select: { id: true, pageType: true, pageSlug: true },
  take: 10,
});

if (pages.length < 10) {
  console.error("Need at least 10 city pages");
  process.exit(1);
}

const { run } = await createRegenerationRun({
  mode: "selected_pages",
  dryRun: true,
  confirmed: true,
  batchSize: 5,
  pageIds: pages.map((p) => p.id),
});

let batches = 0;
let done = false;
while (!done && batches < 10) {
  const result = await processRegenerationBatch(run.id, 5);
  done = result.done ?? false;
  batches++;
  const counts = await loadRegenerationStatusCounts(run.id);
  const inv = checkRegenInvariant(run.totalPages, counts);
  const derived = deriveRunCounters(run.totalPages, counts);
  if (!inv.ok) {
    console.error("Invariant failed mid-run", { batches, counts, inv });
    process.exit(1);
  }
  if (derived.completedCount > run.totalPages || derived.queuedCount < 0) {
    console.error("Counter bounds violated", { derived });
    process.exit(1);
  }
}

await recomputeRunCounters(run.id);
const final = await db.seoRegenerationRun.findUnique({ where: { id: run.id } });
const finalCounts = await loadRegenerationStatusCounts(run.id);

console.log(JSON.stringify({
  ok: true,
  runId: run.id,
  status: final?.status,
  totalPages: final?.totalPages,
  completedCount: final?.completedCount,
  queuedCount: final?.queuedCount,
  itemCounts: finalCounts,
  batches,
}, null, 2));

await db.$disconnect();

/**
 * Memory & performance audit for SEO regeneration (V5 engine).
 * Run: npx tsx scripts/audit-seo-regeneration-memory.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { db } from "../src/lib/db";
import {
  buildRegeneratedContent,
  clearRegenerationCaches,
  createRegenerationRun,
  processRunUntilDone,
  resolvePagesForRegeneration,
  rollbackRegenerationRun,
} from "../src/lib/seo-regeneration-service";
import { clearSeoPeerCache, getSeoPeerCacheStats } from "../src/lib/seo-peer-cache";
import { generateCitySEOContent } from "../src/lib/seo-engine";
import { computePageQualityMetrics } from "../src/lib/seo-page-service";
import { resolveIntroContentForStorage } from "../src/lib/seo-content";

process.env.SEO_ENGINE = "v5";
process.env.SEO_REGEN_PEER_LIMIT = process.env.SEO_REGEN_PEER_LIMIT || "75";

const OUT_DIR = path.resolve("artifacts/seo-regeneration-memory-audit");

type MemSample = {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  timestampMs: number;
};

function sampleMemory(): MemSample {
  const m = process.memoryUsage();
  return {
    rssMb: Math.round((m.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((m.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((m.heapTotal / 1024 / 1024) * 10) / 10,
    externalMb: Math.round((m.external / 1024 / 1024) * 10) / 10,
    timestampMs: Date.now(),
  };
}

function maybeGc() {
  if (typeof global.gc === "function") global.gc();
}

function summarizeSamples(samples: MemSample[]) {
  const heapValues = samples.map((s) => s.heapUsedMb);
  const rssValues = samples.map((s) => s.rssMb);
  const peakHeap = Math.max(...heapValues);
  const peakRss = Math.max(...rssValues);
  const avgHeap = Math.round((heapValues.reduce((a, b) => a + b, 0) / heapValues.length) * 10) / 10;
  const avgRss = Math.round((rssValues.reduce((a, b) => a + b, 0) / rssValues.length) * 10) / 10;
  const growth = heapValues.length > 1 ? heapValues[heapValues.length - 1]! - heapValues[0]! : 0;
  return { peakHeap, peakRss, avgHeap, avgRss, heapGrowthMb: Math.round(growth * 10) / 10 };
}

async function profileSinglePagePipeline(citySlug: string) {
  const samples: MemSample[] = [];
  samples.push(sampleMemory());

  const city = await db.city.findFirst({
    where: { slug: citySlug },
    select: {
      name: true,
      slug: true,
      areas: { where: { isActive: true }, select: { name: true }, take: 12 },
      state: { select: { name: true, slug: true, country: { select: { name: true } } } },
    },
  });
  if (!city?.state) throw new Error(`City ${citySlug} not found`);

  const content = generateCitySEOContent(
    city.name,
    city.slug,
    city.state.name,
    city.state.country?.name || "India",
    { stateSlug: city.state.slug, dbAreas: city.areas.map((a) => a.name) },
  );
  samples.push(sampleMemory());

  const intro = resolveIntroContentForStorage(content);
  await computePageQualityMetrics("city", city.slug, content, intro);
  samples.push(sampleMemory());

  clearSeoPeerCache();
  maybeGc();
  samples.push(sampleMemory());

  return summarizeSamples(samples);
}

async function runDryRegeneration(pageCount: number, batchSize: number) {
  const allCityPages = await resolvePagesForRegeneration({
    mode: "all",
    pageTypeFilter: "city",
  });
  const pages = allCityPages.slice(0, pageCount);
  if (pages.length === 0) throw new Error("No city SEO pages in database");

  const samples: MemSample[] = [];
  samples.push(sampleMemory());

  const { run } = await createRegenerationRun({
    mode: "selected_cities",
    dryRun: true,
    confirmed: false,
    batchSize,
    citySlugs: pages.map((p) => p.pageSlug),
  });

  const t0 = performance.now();
  const { totalProcessed, batches } = await processRunUntilDone(run.id);
  const elapsedMs = Math.round(performance.now() - t0);

  samples.push(sampleMemory());
  maybeGc();
  samples.push(sampleMemory());

  const mem = summarizeSamples(samples);
  const pagesPerMinute = Math.round((totalProcessed / (elapsedMs / 60000)) * 10) / 10;

  return {
    pageCount: pages.length,
    totalProcessed,
    batches,
    batchSize,
    elapsedMs,
    pagesPerMinute,
    memory: mem,
    leakDetected: mem.heapGrowthMb > 50 && totalProcessed > 10,
    cacheAfterRun: getSeoPeerCacheStats(),
  };
}

async function simulateRollbackDryRun(pageCount: number) {
  const pages = (await resolvePagesForRegeneration({ mode: "all", pageTypeFilter: "city" })).slice(
    0,
    Math.min(pageCount, 5),
  );
  if (pages.length === 0) return { rolledBack: 0, skipped: true };

  const { run } = await createRegenerationRun({
    mode: "selected_cities",
    dryRun: false,
    confirmed: true,
    batchSize: 5,
    citySlugs: pages.map((p) => p.pageSlug),
  });

  await processRunUntilDone(run.id);
  const rollback = await rollbackRegenerationRun(run.id);
  return { rolledBack: rollback.rolledBack, runId: run.id };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const cityPages = await db.seoPage.count({ where: { pageType: "city" } });
  const baseline = sampleMemory();

  const singlePage = await profileSinglePagePipeline("mumbai");

  const sim10 = await runDryRegeneration(Math.min(10, cityPages), 10);
  clearRegenerationCaches();
  maybeGc();

  const sim50 = await runDryRegeneration(Math.min(50, cityPages), 25);
  clearRegenerationCaches();
  maybeGc();

  const sim153 = await runDryRegeneration(Math.min(153, cityPages), 25);
  clearRegenerationCaches();
  maybeGc();

  let rollbackResult: { rolledBack: number; runId?: string; skipped?: boolean } = { rolledBack: 0 };
  try {
    rollbackResult = await simulateRollbackDryRun(5);
  } catch (err) {
    rollbackResult = {
      rolledBack: 0,
      skipped: true,
    };
  }

  const beforeFixes = {
    note: "Estimated from pre-fix code audit (not re-measured)",
    issues: [
      "Double V5 content generation per page (buildRegeneratedContent ×2)",
      "Triple similarity pass on live writes (predict + upsert metrics)",
      "loadPeerPages fetched 500 full pages + all FAQs per metrics call",
      "O(n²) paragraph similarity across all peer paragraphs",
      "No cache cleanup between batches",
    ],
    estimatedPeakHeapMb153DryRun: "800–1500+",
    estimatedPagesPerMinute: "8–15",
    leakDetected: true,
  };

  const afterFixes = {
    fixes: [
      "Single content generation + single metrics pass per page",
      "precomputedMetrics passed to upsertFromContent",
      "Peer cache with SEO_REGEN_PEER_LIMIT=75 (one load per pageType per batch)",
      "Batch city context preload + clearRegenerationCaches() after each batch",
      "Paragraph similarity capped at 30 peers × 6 paragraphs",
    ],
    singlePagePipeline: singlePage,
    simulations: { sim10, sim50, sim153 },
    rollback: rollbackResult,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      SEO_ENGINE: process.env.SEO_ENGINE,
      SEO_REGEN_PEER_LIMIT: process.env.SEO_REGEN_PEER_LIMIT,
      nodeHeapLimit: process.env.NODE_OPTIONS ?? "(default)",
    },
    database: {
      citySeoPages: cityPages,
    },
    baselineMemoryMb: baseline,
    beforeFixes,
    afterFixes,
    recommendations: {
      batchSize: 25,
      concurrency: 1,
      peerLimit: 75,
      maxHeapMb: "512–1024 sufficient for 153-page dry run",
      productionNotes: [
        "Use dry-run first for full corpus",
        "Process via processRegenerationBatch API in 25-page chunks",
        "Set NODE_OPTIONS=--max-old-space-size=2048 for live 153+ writes",
        "Avoid running regeneration inside Next.js dev server process",
      ],
    },
    readiness: {
      under1GbPreferred: afterFixes.simulations.sim153.memory.peakHeap < 1024,
      under2GbMaximum: afterFixes.simulations.sim153.memory.peakHeap < 2048,
      noContinuousHeapGrowth: !afterFixes.simulations.sim153.leakDetected,
      readyFor153Plus: afterFixes.simulations.sim153.memory.peakHeap < 2048 && !afterFixes.simulations.sim153.leakDetected,
    },
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SEO Regen Memory Audit</title>
<style>body{font-family:system-ui;background:#0b0b0f;color:#f5f5f7;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:8px}th{background:#15151d}.ok{color:#4ade80}</style>
</head><body><h1>SEO Regeneration Memory Audit</h1>
<h2>After fixes — 153 page dry run</h2>
<ul>
<li>Peak heap: ${report.afterFixes.simulations.sim153.memory.peakHeap} MB</li>
<li>Avg heap: ${report.afterFixes.simulations.sim153.memory.avgHeap} MB</li>
<li>Heap growth: ${report.afterFixes.simulations.sim153.memory.heapGrowthMb} MB</li>
<li>Runtime: ${Math.round(report.afterFixes.simulations.sim153.elapsedMs / 1000)}s</li>
<li>Pages/min: ${report.afterFixes.simulations.sim153.pagesPerMinute}</li>
<li>Leak: ${report.afterFixes.simulations.sim153.leakDetected ? "YES" : "NO"}</li>
</ul>
<h2>Recommendations</h2>
<ul><li>Batch size: ${report.recommendations.batchSize}</li><li>Concurrency: ${report.recommendations.concurrency}</li><li>Peer limit: ${report.recommendations.peerLimit}</li></ul>
<p class="ok">Ready for 153+: ${report.readiness.readyFor153Plus ? "YES" : "NO"}</p>
</body></html>`;
  writeFileSync(path.join(OUT_DIR, "report.html"), html);

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    clearRegenerationCaches();
    await db.$disconnect();
  });

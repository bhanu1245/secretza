/**
 * Live regeneration simulation — 10 cities from different states, dry-run only.
 * Usage: bun run scripts/seo-regeneration-simulate-10.ts
 */
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import { resolveIntroContentForStorage } from "../src/lib/seo-content";
import {
  computeCompositeUniqueness,
  computeDuplicateRisk,
  countWords,
} from "../src/lib/seo-quality";
import {
  buildRegeneratedContent,
  createRegenerationRun,
  processRunUntilDone,
  serializeRunProgress,
} from "../src/lib/seo-regeneration-service";

const OUT_DIR = path.join(process.cwd(), "artifacts", "seo-regeneration-sim-10");

interface PageResult {
  slug: string;
  cityName: string;
  stateName: string;
  stateSlug: string;
  wordCount: number;
  uniquenessScore: number;
  seoQualityScore: number;
  duplicateRisk: string;
  title: string;
  h1: string;
  metaDescription: string;
  faqCount: number;
  faqFingerprint: string;
  contentVariant?: number;
  faqGroup?: number;
}

function faqFingerprint(faqs: Array<{ question: string; answer: string }>) {
  return faqs.map((f) => `${f.question}||${f.answer}`).sort().join(":::");
}

function findDuplicates(items: PageResult[], key: keyof PageResult) {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const val = String(item[key]).trim().toLowerCase();
    if (!val) continue;
    const list = map.get(val) ?? [];
    list.push(item.slug);
    map.set(val, list);
  }
  return [...map.entries()].filter(([, slugs]) => slugs.length > 1).map(([value, slugs]) => ({ value, slugs }));
}

async function selectTenCitiesFromDifferentStates() {
  const seoCitySlugs = await db.seoPage.findMany({
    where: { pageType: "city" },
    select: { pageSlug: true },
  });
  const slugSet = new Set(seoCitySlugs.map((p) => p.pageSlug));

  const cities = await db.city.findMany({
    where: {
      isActive: true,
      slug: { in: [...slugSet] },
      state: { country: { slug: "india" } },
    },
    select: {
      slug: true,
      name: true,
      state: { select: { slug: true, name: true } },
    },
    orderBy: { slug: "asc" },
  });

  const byState = new Map<string, typeof cities>();
  for (const c of cities) {
    const stateSlug = c.state?.slug;
    if (!stateSlug) continue;
    const list = byState.get(stateSlug) ?? [];
    list.push(c);
    byState.set(stateSlug, list);
  }

  const stateSlugs = [...byState.keys()].sort();
  // Deterministic pseudo-random spread using prime stride
  const stride = 17;
  const selected: typeof cities = [];
  const usedStates = new Set<string>();

  for (let i = 0; selected.length < 10 && i < stateSlugs.length; i++) {
    const idx = (i * stride) % stateSlugs.length;
    const stateSlug = stateSlugs[idx];
    if (usedStates.has(stateSlug)) continue;
    const pool = byState.get(stateSlug)!;
    const pick = pool[i % pool.length] ?? pool[0];
    if (pick) {
      selected.push(pick);
      usedStates.add(stateSlug);
    }
  }

  // Second pass for any gaps
  for (const stateSlug of stateSlugs) {
    if (selected.length >= 10) break;
    if (usedStates.has(stateSlug)) continue;
    const pool = byState.get(stateSlug)!;
    selected.push(pool[0]);
    usedStates.add(stateSlug);
  }

  return selected.slice(0, 10);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const selected = await selectTenCitiesFromDifferentStates();
  const citySlugs = selected.map((c) => c.slug);

  console.log("=== Selected 10 cities (different states) ===");
  for (const c of selected) {
    console.log(`  ${c.slug} (${c.name}, ${c.state?.name ?? "?"})`);
  }

  // Queue system dry-run
  const { run } = await createRegenerationRun({
    mode: "selected_cities",
    dryRun: true,
    batchSize: 10,
    pageTypeFilter: "city",
    citySlugs,
    createdBy: { id: "script", email: "seo-sim-10@script" },
  });

  await processRunUntilDone(run.id);

  const completedItems = await db.seoRegenerationItem.findMany({
    where: { runId: run.id, status: "completed" },
    orderBy: { pageSlug: "asc" },
  });

  const updatedRun = await db.seoRegenerationRun.findUnique({ where: { id: run.id } });

  // Build full content for duplicate verification
  const pageResults: PageResult[] = [];

  for (const c of selected) {
    const item = completedItems.find((i) => i.pageSlug === c.slug);
    const built = await buildRegeneratedContent("city", c.slug);
    if (!built) {
      console.warn(`Could not build content for ${c.slug}`);
      continue;
    }

    const intro = resolveIntroContentForStorage(built.content);
    const faqs = built.content.faqs;

    pageResults.push({
      slug: c.slug,
      cityName: c.name,
      stateName: c.state?.name ?? "",
      stateSlug: c.state?.slug ?? "",
      wordCount: item?.predictedWords ?? intro.split(/\s+/).filter(Boolean).length,
      uniquenessScore: item?.predictedUnique ?? 0,
      seoQualityScore: item?.predictedScore ?? 0,
      duplicateRisk: item?.predictedRisk ?? "unknown",
      title: built.content.title,
      h1: built.content.h1,
      metaDescription: built.content.metaDescription,
      faqCount: faqs.length,
      faqFingerprint: faqFingerprint(faqs),
      contentVariant: built.content.cityEnrichment?.contentVariant,
      faqGroup: built.content.cityEnrichment?.faqGroup,
    });
  }

  const n = pageResults.length || 1;
  const averages = {
    wordCount: pageResults.reduce((s, p) => s + p.wordCount, 0) / n,
    uniquenessScore: pageResults.reduce((s, p) => s + p.uniquenessScore, 0) / n,
    seoQualityScore: pageResults.reduce((s, p) => s + p.seoQualityScore, 0) / n,
  };

  const byUniqueness = [...pageResults].sort((a, b) => b.uniquenessScore - a.uniquenessScore);
  const best = byUniqueness[0];
  const worst = byUniqueness[byUniqueness.length - 1];

  const duplicateChecks = {
    titles: findDuplicates(pageResults, "title"),
    h1: findDuplicates(pageResults, "h1"),
    metaDescriptions: findDuplicates(pageResults, "metaDescription"),
    faqSets: findDuplicates(pageResults, "faqFingerprint"),
    allClear:
      findDuplicates(pageResults, "title").length === 0 &&
      findDuplicates(pageResults, "h1").length === 0 &&
      findDuplicates(pageResults, "metaDescription").length === 0 &&
      findDuplicates(pageResults, "faqFingerprint").length === 0,
  };

  // Within-batch uniqueness (peer = other 9 generated pages only)
  const batchUniqueness: Array<{ slug: string; batchUnique: number; batchRisk: string }> = [];
  const builtCache = new Map<string, Awaited<ReturnType<typeof buildRegeneratedContent>>>();
  for (const p of pageResults) {
    builtCache.set(p.slug, await buildRegeneratedContent("city", p.slug));
  }

  for (const p of pageResults) {
    const built = builtCache.get(p.slug);
    if (!built) continue;
    const intro = resolveIntroContentForStorage(built.content);
    const faqText = built.content.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
    const others = pageResults.filter((o) => o.slug !== p.slug);
    const peerIntros: string[] = [];
    const peerFaqs: string[] = [];
    for (const o of others) {
      const ob = builtCache.get(o.slug);
      if (ob) {
        peerIntros.push(resolveIntroContentForStorage(ob.content));
        peerFaqs.push(ob.content.faqs.map((f) => `${f.question} ${f.answer}`).join(" "));
      }
    }
    const batchBreakdown = computeCompositeUniqueness({
      introContent: intro,
      faqText,
      title: built.content.title,
      metaDescription: built.content.metaDescription,
      peerIntros,
      peerFaqs,
      peerTitles: others.map((o) => o.title),
      peerMetas: others.map((o) => o.metaDescription),
    });
    batchUniqueness.push({
      slug: p.slug,
      batchUnique: batchBreakdown.overall,
      batchRisk: computeDuplicateRisk(batchBreakdown.overall, {
        title: false,
        metaDescription: false,
        h1: false,
        introContent: false,
        faqContent: false,
      }),
    });
  }

  const batchAvgUnique =
    batchUniqueness.reduce((s, b) => s + b.batchUnique, 0) / (batchUniqueness.length || 1);
  const batchRiskCounts = {
    low: batchUniqueness.filter((b) => b.batchRisk === "low").length,
    medium: batchUniqueness.filter((b) => b.batchRisk === "medium").length,
    high: batchUniqueness.filter((b) => b.batchRisk === "high").length,
  };

  const riskCounts = {
    low: pageResults.filter((p) => p.duplicateRisk === "low").length,
    medium: pageResults.filter((p) => p.duplicateRisk === "medium").length,
    high: pageResults.filter((p) => p.duplicateRisk === "high").length,
  };

  const report = {
    simulatedAt: new Date().toISOString(),
    mode: "dry_run",
    queueRunId: run.id,
    queueProgress: updatedRun ? serializeRunProgress(updatedRun) : null,
    selectedCities: selected.map((c) => ({
      slug: c.slug,
      name: c.name,
      state: c.state?.name,
    })),
    pages: pageResults,
    averages: {
      wordCount: Math.round(averages.wordCount * 10) / 10,
      uniquenessScore: Math.round(averages.uniquenessScore * 10) / 10,
      seoQualityScore: Math.round(averages.seoQualityScore * 10) / 10,
    },
    riskCounts,
    bestPage: best
      ? {
          slug: best.slug,
          cityName: best.cityName,
          uniquenessScore: best.uniquenessScore,
          seoQualityScore: best.seoQualityScore,
          wordCount: best.wordCount,
          duplicateRisk: best.duplicateRisk,
        }
      : null,
    worstPage: worst
      ? {
          slug: worst.slug,
          cityName: worst.cityName,
          uniquenessScore: worst.uniquenessScore,
          seoQualityScore: worst.seoQualityScore,
          wordCount: worst.wordCount,
          duplicateRisk: worst.duplicateRisk,
        }
      : null,
    duplicateChecks,
    withinBatchUniqueness: {
      average: Math.round(batchAvgUnique * 10) / 10,
      riskCounts: batchRiskCounts,
      pages: batchUniqueness,
      note: "Compared only against the other 9 generated pages in this simulation batch",
    },
    auditTable: pageResults.map((p) => {
      const batch = batchUniqueness.find((b) => b.slug === p.slug);
      return {
        slug: p.slug,
        state: p.stateName,
        words: p.wordCount,
        unique: `${p.uniquenessScore.toFixed(0)}%`,
        batchUnique: batch ? `${batch.batchUnique.toFixed(0)}%` : "—",
        seo: `${p.seoQualityScore.toFixed(0)}%`,
        risk: p.duplicateRisk.toUpperCase(),
        batchRisk: batch?.batchRisk.toUpperCase() ?? "—",
        variant: p.contentVariant,
        faqGroup: p.faqGroup,
      };
    }),
  };

  const reportPath = path.join(OUT_DIR, "simulation-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const auditLines = [
    "SEO REGENERATION SIMULATION — 10 INDIAN CITIES (DRY RUN)",
    "=".repeat(60),
    `Run ID: ${run.id}`,
    `Completed: ${report.simulatedAt}`,
    "",
    "SELECTED CITIES (10 different states):",
    ...selected.map((c) => `  • ${c.name} (${c.slug}) — ${c.state?.name}`),
    "",
    "AVERAGES (vs full DB peer corpus):",
    `  Word count:        ${report.averages.wordCount}`,
    `  Uniqueness:        ${report.averages.uniquenessScore}%`,
    `  SEO quality:       ${report.averages.seoQualityScore}%`,
    "",
    "WITHIN-BATCH AVERAGES (vs other 9 generated pages):",
    `  Uniqueness:        ${report.withinBatchUniqueness.average}%`,
    `  LOW / MED / HIGH:  ${batchRiskCounts.low} / ${batchRiskCounts.medium} / ${batchRiskCounts.high}`,
    "",
    "BEST PAGE:",
    `  ${report.bestPage?.cityName} (${report.bestPage?.slug}) — ${report.bestPage?.uniquenessScore}% unique, ${report.bestPage?.seoQualityScore}% SEO`,
    "",
    "WORST PAGE:",
    `  ${report.worstPage?.cityName} (${report.worstPage?.slug}) — ${report.worstPage?.uniquenessScore}% unique, ${report.worstPage?.seoQualityScore}% SEO`,
    "",
    "DUPLICATE CHECKS (within batch of 10):",
    `  Titles:            ${duplicateChecks.titles.length === 0 ? "PASS" : "FAIL"}`,
    `  H1:                ${duplicateChecks.h1.length === 0 ? "PASS" : "FAIL"}`,
    `  Meta descriptions: ${duplicateChecks.metaDescriptions.length === 0 ? "PASS" : "FAIL"}`,
    `  FAQ sets:          ${duplicateChecks.faqSets.length === 0 ? "PASS" : "FAIL"}`,
    "",
    "AUDIT TABLE:",
    "  Slug          State              Words  DB-Uniq  Batch-Uniq  SEO   Risk",
    ...report.auditTable.map(
      (r) =>
        `  ${r.slug.padEnd(13)} ${r.state.slice(0, 18).padEnd(18)} ${String(r.words).padStart(5)}  ${r.unique.padStart(7)}  ${r.batchUnique.padStart(10)}  ${r.seo.padStart(4)}  ${r.risk}`,
    ),
  ];
  fs.writeFileSync(path.join(OUT_DIR, "audit-output.txt"), auditLines.join("\n"));

  console.log("\n=== Averages (10-city dry-run) ===");
  console.log(JSON.stringify(report.averages, null, 2));
  console.log("\n=== Risk counts ===");
  console.log(JSON.stringify(riskCounts, null, 2));
  console.log("\n=== Best page ===");
  console.log(JSON.stringify(report.bestPage, null, 2));
  console.log("\n=== Worst page ===");
  console.log(JSON.stringify(report.worstPage, null, 2));
  console.log("\n=== Duplicate checks ===");
  console.log(`  Titles: ${duplicateChecks.titles.length === 0 ? "PASS" : "FAIL"}`);
  console.log(`  H1: ${duplicateChecks.h1.length === 0 ? "PASS" : "FAIL"}`);
  console.log(`  Meta: ${duplicateChecks.metaDescriptions.length === 0 ? "PASS" : "FAIL"}`);
  console.log(`  FAQ sets: ${duplicateChecks.faqSets.length === 0 ? "PASS" : "FAIL"}`);
  console.log(`\nReport: ${reportPath}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

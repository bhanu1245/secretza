/**
 * Verify bulk SEO regeneration:
 * 1. Dry-run predict for Agra, Ahmedabad, Mumbai
 * 2. Full city-pages dry run (no writes)
 */
import { db } from "../src/lib/db";
import {
  createRegenerationRun,
  processRunUntilDone,
  predictRegeneration,
  serializeRunProgress,
} from "../src/lib/seo-regeneration-service";

const SAMPLE_CITIES = ["agra", "ahmedabad", "mumbai"] as const;

async function verifySampleCities() {
  const results: Record<string, unknown>[] = [];

  for (const slug of SAMPLE_CITIES) {
    const prediction = await predictRegeneration("city", slug);
    const existing = await db.seoPage.findUnique({
      where: { pageType_pageSlug: { pageType: "city", pageSlug: slug } },
      select: {
        wordCount: true,
        uniquenessScore: true,
        seoQualityScore: true,
        duplicateRisk: true,
        title: true,
      },
    });

    results.push({
      slug,
      existing: existing
        ? {
            wordCount: existing.wordCount,
            uniquenessScore: existing.uniquenessScore,
            seoQualityScore: existing.seoQualityScore,
            duplicateRisk: existing.duplicateRisk,
            title: existing.title,
          }
        : null,
      predicted: prediction,
    });
  }

  return results;
}

async function dryRunAllCities() {
  const pages = await db.seoPage.findMany({
    where: { pageType: "city" },
    select: { id: true, pageSlug: true },
    orderBy: { pageSlug: "asc" },
  });

  const { run } = await createRegenerationRun({
    mode: "all",
    dryRun: true,
    batchSize: 50,
    pageTypeFilter: "city",
    createdBy: { id: "script", email: "seo-regeneration-verify@script" },
  });

  await processRunUntilDone(run.id);

  const updated = await db.seoRegenerationRun.findUnique({ where: { id: run.id } });
  const report = updated?.reportJson ? JSON.parse(updated.reportJson) : null;

  return {
    totalPages: pages.length,
    run: updated ? serializeRunProgress(updated) : null,
    report,
    expectedAverageUniqueness: updated?.avgUniqueness ?? report?.averageUniqueness ?? null,
    expectedAverageSeoScore: updated?.avgSeoScore ?? report?.averageSeoScore ?? null,
    riskCounts: {
      LOW: updated?.lowRiskCount ?? report?.lowRiskCount ?? 0,
      MEDIUM: updated?.mediumRiskCount ?? report?.mediumRiskCount ?? 0,
      HIGH: updated?.highRiskCount ?? report?.highRiskCount ?? 0,
    },
  };
}

async function main() {
  console.log("=== Sample city verification (predict only, no writes) ===\n");
  const samples = await verifySampleCities();
  console.log(JSON.stringify({ sampleCities: samples }, null, 2));

  console.log("\n=== Full city dry run (no writes) ===\n");
  const dryRun = await dryRunAllCities();
  console.log(JSON.stringify(dryRun, null, 2));

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

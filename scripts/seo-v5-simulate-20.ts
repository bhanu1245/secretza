/**
 * v5 engine — 20-city simulation (no DB writes).
 * Usage: bun run scripts/seo-v5-simulate-20.ts
 */
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import { generateV5CitySEO } from "../src/lib/seo-city-content-v5";
import {
  computeCompositeUniqueness,
  computeDuplicateRisk,
  computeSeoQualityScore,
  countWords,
  textSimilarity,
  type DuplicateFieldFlags,
} from "../src/lib/seo-quality";

const OUT = path.join(process.cwd(), "artifacts", "seo-v5-simulation");

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function scoreAgainstPeers(
  content: {
    title: string;
    metaDescription: string;
    h1: string;
    introContent: string;
    faqs: Array<{ question: string; answer: string }>;
    internalLinks: Array<{ text: string }>;
    slug: string;
  },
  peerIntros: string[],
  peerFaqs: string[],
  peerTitles: string[],
  peerMetas: string[],
  canonicalUrl: string,
) {
  const faqText = content.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
  const breakdown = computeCompositeUniqueness({
    introContent: content.introContent,
    faqText,
    title: content.title,
    metaDescription: content.metaDescription,
    peerIntros,
    peerFaqs,
    peerTitles,
    peerMetas,
  });
  const duplicateFields: DuplicateFieldFlags = {
    title: false, metaDescription: false, h1: false, introContent: false, faqContent: false,
  };
  const wordCount = countWords(content.introContent);
  const seoQualityScore = computeSeoQualityScore({
    title: content.title,
    metaDescription: content.metaDescription,
    h1: content.h1,
    introContent: content.introContent,
    canonicalUrl,
    faqCount: content.faqs.length,
    internalLinksCount: content.internalLinks.length,
    wordCount,
    uniquenessScore: breakdown.overall,
    duplicateFields,
  });
  const duplicateRisk = computeDuplicateRisk(breakdown.overall, duplicateFields, breakdown.maxIntroSimilarity);
  return { breakdown, wordCount, seoQualityScore, duplicateRisk };
}

async function selectRandomCities(n: number) {
  const pages = await db.seoPage.findMany({
    where: { pageType: "city" },
    select: { pageSlug: true },
    orderBy: { pageSlug: "asc" },
  });
  const slugs: string[] = [];
  for (const p of pages) {
    const city = await db.city.findFirst({
      where: { slug: p.pageSlug, state: { country: { slug: "india" } } },
      select: { slug: true },
    });
    if (city) slugs.push(city.slug);
  }
  const exclude = new Set(["agra", "ahmedabad", "mumbai"]);
  const pool = slugs.filter((s) => !exclude.has(s));
  const picked: string[] = [];
  const stride = 19;
  for (let i = 0; picked.length < n && i < pool.length * 2; i++) {
    const s = pool[(i * stride) % pool.length]!;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.slice(0, n);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const slugs = await selectRandomCities(20);
  const generated: ReturnType<typeof generateV5CitySEO>[] = [];

  for (const slug of slugs) {
    const city = await db.city.findFirst({
      where: { slug, state: { country: { slug: "india" } } },
      select: {
        name: true,
        slug: true,
        areas: { where: { isActive: true }, select: { name: true }, take: 10 },
        state: { select: { name: true, slug: true } },
      },
    });
    if (!city?.state) continue;
    generated.push(
      generateV5CitySEO(
        city.name,
        slug,
        city.state.name,
        city.state.slug,
        city.areas.map((a) => a.name),
      ),
    );
  }

  // v3 substantive peers in DB
  const v3Peers = await db.seoPage.findMany({
    where: { pageType: "city", wordCount: { gte: 350 } },
    select: {
      pageSlug: true,
      title: true,
      metaDescription: true,
      introContent: true,
      faqs: { select: { question: true, answer: true } },
    },
  });

  const batchResults: Array<{
    slug: string;
    architecture: string;
    introVariant: number;
    faqFamily: number;
    words: number;
    uniquenessBatch: number;
    uniquenessV3: number;
    seoBatch: number;
    seoV3: number;
    riskBatch: string;
    riskV3: string;
  }> = [];

  for (const g of generated) {
    const others = generated.filter((x) => x.cityEnrichment.slug !== g.cityEnrichment.slug);
    const canonical = `/india/${g.cityEnrichment.stateSlug}/${g.cityEnrichment.slug}`;

    const batchScore = scoreAgainstPeers(
      { ...g, slug: g.cityEnrichment.slug },
      others.map((o) => o.introContent),
      others.map((o) => o.faqs.map((f) => `${f.question} ${f.answer}`).join(" ")),
      others.map((o) => o.title),
      others.map((o) => o.metaDescription),
      canonical,
    );

    const v3Score = scoreAgainstPeers(
      { ...g, slug: g.cityEnrichment.slug },
      v3Peers.filter((p) => p.pageSlug !== g.cityEnrichment.slug).map((p) => p.introContent ?? ""),
      v3Peers.filter((p) => p.pageSlug !== g.cityEnrichment.slug).map((p) => p.faqs.map((f) => `${f.question} ${f.answer}`).join(" ")),
      v3Peers.filter((p) => p.pageSlug !== g.cityEnrichment.slug).map((p) => p.title ?? ""),
      v3Peers.filter((p) => p.pageSlug !== g.cityEnrichment.slug).map((p) => p.metaDescription ?? ""),
      canonical,
    );

    batchResults.push({
      slug: g.cityEnrichment.slug,
      architecture: g.architecture,
      introVariant: g.introVariant,
      faqFamily: g.faqFamily,
      words: batchScore.wordCount,
      uniquenessBatch: batchScore.breakdown.overall,
      uniquenessV3: v3Score.breakdown.overall,
      seoBatch: batchScore.seoQualityScore,
      seoV3: v3Score.seoQualityScore,
      riskBatch: batchScore.duplicateRisk,
      riskV3: v3Score.duplicateRisk,
    });
  }

  const intros = generated.map((g) => g.introContent);
  let maxPairSim = 0;
  for (let i = 0; i < intros.length; i++) {
    for (let j = i + 1; j < intros.length; j++) {
      maxPairSim = Math.max(maxPairSim, textSimilarity(intros[i]!, intros[j]!));
    }
  }

  const report = {
    simulatedAt: new Date().toISOString(),
    engine: "v5",
    cityCount: generated.length,
    cities: slugs,
    architectureDistribution: Object.fromEntries(
      [...new Set(batchResults.map((r) => r.architecture))].map((a) => [
        a,
        batchResults.filter((r) => r.architecture === a).length,
      ]),
    ),
    introVariantsUsed: [...new Set(batchResults.map((r) => r.introVariant))].length,
    faqFamiliesUsed: [...new Set(batchResults.map((r) => r.faqFamily))].length,
    batchMaxPairwiseIntroSimilarity: Math.round(maxPairSim * 100),
    /** Primary metric: scored vs other 19 v5 pages (post-regen peer corpus) */
    vsBatchPeers: {
      averageUniqueness: Math.round(avg(batchResults.map((r) => r.uniquenessBatch)) * 10) / 10,
      averageSeoScore: Math.round(avg(batchResults.map((r) => r.seoBatch)) * 10) / 10,
      lowRisk: batchResults.filter((r) => r.riskBatch === "low").length,
      mediumRisk: batchResults.filter((r) => r.riskBatch === "medium").length,
      highRisk: batchResults.filter((r) => r.riskBatch === "high").length,
      uniquenessAbove70: batchResults.filter((r) => r.uniquenessBatch >= 70).length,
      seoAbove90: batchResults.filter((r) => r.seoBatch >= 90).length,
    },
    /** Secondary: vs current v3 substantive DB pages (Agra/Ahmedabad/Mumbai) */
    vsV3SubstantivePeers: {
      averageUniqueness: Math.round(avg(batchResults.map((r) => r.uniquenessV3)) * 10) / 10,
      averageSeoScore: Math.round(avg(batchResults.map((r) => r.seoV3)) * 10) / 10,
      lowRisk: batchResults.filter((r) => r.riskV3 === "low").length,
      mediumRisk: batchResults.filter((r) => r.riskV3 === "medium").length,
      highRisk: batchResults.filter((r) => r.riskV3 === "high").length,
    },
    pages: batchResults,
    goalMet: {
      vsBatchPeers: {
        uniquenessAbove70: batchResults.filter((r) => r.uniquenessBatch >= 70).length === batchResults.length,
        seoAbove90: batchResults.filter((r) => r.seoBatch >= 90).length === batchResults.length,
        allLowRisk: batchResults.every((r) => r.riskBatch === "low"),
      },
    },
  };

  fs.writeFileSync(path.join(OUT, "v5-simulation-20.json"), JSON.stringify(report, null, 2));

  const txt = [
    "SEO v5 — 20-CITY SIMULATION (NO DB WRITES)",
    "=".repeat(50),
    "",
    `Cities: ${generated.length}`,
    `Intro variants used: ${report.introVariantsUsed}/20`,
    `FAQ families used: ${report.faqFamiliesUsed}/12`,
    `Architectures: ${JSON.stringify(report.architectureDistribution)}`,
    `Max pairwise intro similarity: ${report.batchMaxPairwiseIntroSimilarity}%`,
    "",
    "VS BATCH PEERS (19 other v5 pages — post-regen scenario):",
    `  Avg uniqueness: ${report.vsBatchPeers.averageUniqueness}%`,
    `  Avg SEO score:  ${report.vsBatchPeers.averageSeoScore}%`,
    `  LOW / MED / HIGH: ${report.vsBatchPeers.lowRisk} / ${report.vsBatchPeers.mediumRisk} / ${report.vsBatchPeers.highRisk}`,
    `  Uniqueness >=70%: ${report.vsBatchPeers.uniquenessAbove70}/${generated.length}`,
    `  SEO >=90%:        ${report.vsBatchPeers.seoAbove90}/${generated.length}`,
    "",
    "VS V3 SUBSTANTIVE DB PEERS (Agra/Ahmedabad/Mumbai):",
    `  Avg uniqueness: ${report.vsV3SubstantivePeers.averageUniqueness}%`,
    `  Avg SEO score:  ${report.vsV3SubstantivePeers.averageSeoScore}%`,
    `  LOW / MED / HIGH: ${report.vsV3SubstantivePeers.lowRisk} / ${report.vsV3SubstantivePeers.mediumRisk} / ${report.vsV3SubstantivePeers.highRisk}`,
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "audit-output.txt"), txt);
  console.log(txt);
  console.log(`\nReport: ${path.join(OUT, "v5-simulation-20.json")}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

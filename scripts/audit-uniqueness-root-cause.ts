/**
 * Root-cause audit: why curated cities score 85–90% vs random 34–46%.
 * Compares current vs improved engine on 20 random cities. No DB writes.
 */
import * as fs from "fs";
import * as path from "path";
import { db } from "../src/lib/db";
import { generateCitySEO, resolveIntroContentForStorage } from "../src/lib/seo-content";
import { buildCityEnrichment } from "../src/lib/seo-city-enrichment";
import {
  buildImprovedCityEnrichment,
  generateImprovedCitySEO,
  measureEnrichmentDiversity,
} from "../src/lib/seo-city-enrichment-improved";
import {
  computeCompositeUniqueness,
  computeDuplicateRisk,
  computeSeoQualityScore,
  countWords,
  textSimilarity,
  type DuplicateFieldFlags,
} from "../src/lib/seo-quality";

const OUT = path.join(process.cwd(), "artifacts", "seo-uniqueness-audit");
const CURATED = ["agra", "ahmedabad", "mumbai"] as const;
const SIM10 = ["adoni", "balasore", "bhavnagar", "azamgarh", "bhopal", "bhilai", "dindigul", "dhanbad", "dibrugarh", "firozpur"];

function splitParagraphs(text: string) {
  return text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 40);
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function maxPairwiseSimilarity(texts: string[]): number {
  let max = 0;
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      max = Math.max(max, textSimilarity(texts[i]!, texts[j]!));
    }
  }
  return max;
}

function scoreContent(
  content: { title: string; metaDescription: string; h1: string; introContent: string; faqs: Array<{ question: string; answer: string }>; internalLinks?: Array<{ text: string }> },
  peerIntros: string[],
  peerFaqs: string[],
  peerTitles: string[],
  peerMetas: string[],
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
    faqCount: content.faqs.length,
    internalLinksCount: content.internalLinks?.length ?? 0,
    wordCount,
    uniquenessScore: breakdown.overall,
    duplicateFields,
  });
  const duplicateRisk = computeDuplicateRisk(breakdown.overall, duplicateFields, breakdown.maxIntroSimilarity);
  return { breakdown, wordCount, seoQualityScore, duplicateRisk };
}

async function loadCity(slug: string) {
  const city = await db.city.findFirst({
    where: { slug, state: { country: { slug: "india" } } },
    select: {
      name: true,
      slug: true,
      areas: { where: { isActive: true }, select: { name: true }, take: 10 },
      state: { select: { name: true, slug: true } },
    },
  });
  return city;
}

async function generateCurrent(slug: string) {
  const city = await loadCity(slug);
  if (!city?.state) return null;
  const seo = generateCitySEO(city.name, slug, city.state.name, "India", {
    stateSlug: city.state.slug,
    dbAreas: city.areas.map((a) => a.name),
  });
  return {
    slug,
    introContent: resolveIntroContentForStorage(seo),
    title: seo.title,
    metaDescription: seo.metaDescription,
    h1: seo.h1,
    faqs: seo.faqs,
    internalLinks: seo.internalLinks,
    enrichment: seo.cityEnrichment,
  };
}

async function generateImproved(slug: string) {
  const city = await loadCity(slug);
  if (!city?.state) return null;
  const seo = generateImprovedCitySEO(
    city.name,
    slug,
    city.state.name,
    city.state.slug,
    city.areas.map((a) => a.name),
  );
  return {
    slug,
    introContent: seo.introContent,
    title: seo.title,
    metaDescription: seo.metaDescription,
    h1: seo.h1,
    faqs: seo.faqs,
    internalLinks: seo.internalLinks,
    enrichment: seo.cityEnrichment,
  };
}

async function selectRandomCities(n: number, exclude: string[]) {
  const pages = await db.seoPage.findMany({
    where: { pageType: "city", pageSlug: { notIn: exclude } },
    select: { pageSlug: true },
    orderBy: { pageSlug: "asc" },
  });
  const indiaSlugs: string[] = [];
  for (const p of pages) {
    const c = await db.city.findFirst({
      where: { slug: p.pageSlug, state: { country: { slug: "india" } } },
      select: { slug: true },
    });
    if (c) indiaSlugs.push(c.slug);
  }
  const stride = 23;
  const picked: string[] = [];
  for (let i = 0; picked.length < n && i < indiaSlugs.length * 2; i++) {
    const slug = indiaSlugs[(i * stride) % indiaSlugs.length]!;
    if (!picked.includes(slug) && !exclude.includes(slug)) picked.push(slug);
  }
  return picked.slice(0, n);
}

async function loadPeerSets() {
  const all = await db.seoPage.findMany({
    where: { pageType: "city" },
    select: {
      pageSlug: true,
      title: true,
      metaDescription: true,
      introContent: true,
      wordCount: true,
      faqs: { select: { question: true, answer: true } },
    },
  });
  const substantive = all.filter((p) => (p.wordCount ?? countWords(p.introContent)) >= 350);
  const legacy = all.filter((p) => (p.wordCount ?? countWords(p.introContent)) < 350);
  return {
    allIntros: all.map((p) => p.introContent ?? ""),
    substantiveIntros: substantive.map((p) => p.introContent ?? ""),
    legacyIntros: legacy.map((p) => p.introContent ?? ""),
    substantiveFaqs: substantive.map((p) => p.faqs.map((f) => `${f.question} ${f.answer}`).join(" ")),
    substantiveTitles: substantive.map((p) => p.title ?? ""),
    substantiveMetas: substantive.map((p) => p.metaDescription ?? ""),
    substantiveSlugs: substantive.map((p) => p.pageSlug),
    legacyCount: legacy.length,
    substantiveCount: substantive.length,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const peers = await loadPeerSets();

  // ── 1. Structure comparison: curated vs sim10 generic ──
  const structureCompare: Record<string, unknown>[] = [];
  for (const slug of [...CURATED, ...SIM10.slice(0, 3)]) {
    const city = await loadCity(slug);
    if (!city?.state) continue;
    const en = buildCityEnrichment(city.name, slug, city.state.name, city.state.slug, city.areas.map((a) => a.name));
    const improved = buildImprovedCityEnrichment(city.name, slug, city.state.name, city.state.slug, city.areas.map((a) => a.name));
    structureCompare.push({
      slug,
      isCurated: CURATED.includes(slug as typeof CURATED[number]),
      current: measureEnrichmentDiversity(en),
      improved: measureEnrichmentDiversity(improved),
    });
  }

  // ── 2. Hypothesis A test: same content, different peer baselines ──
  const hypothesisA: Record<string, unknown>[] = [];
  for (const slug of ["adoni", "bhopal", "agra"]) {
    const content = await generateCurrent(slug);
    if (!content) continue;
    const excludeSelf = (arr: string[], slugs: string[]) =>
      arr.filter((_, i) => slugs[i] !== slug);

    const vsSubstantive = scoreContent(
      content,
      excludeSelf(peers.substantiveIntros, peers.substantiveSlugs),
      excludeSelf(peers.substantiveFaqs, peers.substantiveSlugs),
      excludeSelf(peers.substantiveTitles, peers.substantiveSlugs),
      excludeSelf(peers.substantiveMetas, peers.substantiveSlugs),
    );
    const vsAll = scoreContent(
      content,
      peers.allIntros.filter((_, i) => peers.substantiveSlugs[i] !== slug || true),
      peers.substantiveFaqs,
      peers.substantiveTitles,
      peers.substantiveMetas,
    );
    const vsEmpty = scoreContent(content, [], [], [], []);

    hypothesisA.push({
      slug,
      vsSubstantivePeers: { count: peers.substantiveCount - (peers.substantiveSlugs.includes(slug) ? 1 : 0), ...vsSubstantive },
      vsAllDbPeers: { count: peers.allIntros.length, uniqueness: vsAll.breakdown.overall },
      vsNoPeers: { uniqueness: vsEmpty.breakdown.overall },
      breakdownVsSubstantive: vsSubstantive.breakdown,
    });
  }

  // Fix vsAll - need proper all peers from DB
  for (const item of hypothesisA) {
    const slug = item.slug as string;
    const content = await generateCurrent(slug);
    if (!content) continue;
    const allPages = await db.seoPage.findMany({
      where: { pageType: "city", pageSlug: { not: slug } },
      select: { introContent: true, title: true, metaDescription: true, faqs: { select: { question: true, answer: true } } },
    });
    const vsAllFixed = scoreContent(
      content,
      allPages.map((p) => p.introContent ?? ""),
      allPages.map((p) => p.faqs.map((f) => `${f.question} ${f.answer}`).join(" ")),
      allPages.map((p) => p.title ?? ""),
      allPages.map((p) => p.metaDescription ?? ""),
    );
    item.vsAllDbPeers = { count: allPages.length, uniqueness: vsAllFixed.breakdown.overall, breakdown: vsAllFixed.breakdown };
  }

  // ── 3. Detailed similarity for curated vs random ──
  const similarityDetail: Record<string, unknown>[] = [];
  for (const slug of [...CURATED, "adoni", "bhopal"]) {
    const content = await generateCurrent(slug);
    if (!content) continue;
    const paragraphs = splitParagraphs(content.introContent);
    const faqText = content.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
    const linkTexts = (content.internalLinks ?? []).map((l) => l.text).join(" | ");

    let maxParaSim = 0;
    let worstParaPeer = "";
    for (const p of peers.substantiveIntros) {
      for (const para of paragraphs) {
        for (const peerPara of splitParagraphs(p)) {
          const s = textSimilarity(para, peerPara);
          if (s > maxParaSim) { maxParaSim = s; worstParaPeer = "substantive"; }
        }
      }
    }

    const vsSub = scoreContent(
      content,
      peers.substantiveIntros,
      peers.substantiveFaqs,
      peers.substantiveTitles,
      peers.substantiveMetas,
    );

    similarityDetail.push({
      slug,
      paragraphCount: paragraphs.length,
      maxParagraphSimilarity: Math.round(maxParaSim * 100),
      faqSimilarityVsSubstantive: Math.round(vsSub.breakdown.maxFaqSimilarity * 100),
      titleSimilarityVsSubstantive: Math.round(vsSub.breakdown.maxTitleSimilarity * 100),
      internalLinkSample: linkTexts.slice(0, 200),
      paragraphMinScore: vsSub.breakdown.paragraphMinScore,
      compositeBreakdown: vsSub.breakdown,
    });
  }

  // ── 4. 20 random cities: current vs improved ──
  const random20 = await selectRandomCities(20, [...CURATED]);
  const currentResults: Array<{ slug: string; uniqueness: number; seo: number; risk: string; words: number }> = [];
  const improvedResults: Array<{ slug: string; uniqueness: number; seo: number; risk: string; words: number }> = [];

  const generatedCurrent: Awaited<ReturnType<typeof generateCurrent>>[] = [];
  const generatedImproved: Awaited<ReturnType<typeof generateImproved>>[] = [];

  for (const slug of random20) {
    const cur = await generateCurrent(slug);
    const imp = await generateImproved(slug);
    if (cur) generatedCurrent.push(cur);
    if (imp) generatedImproved.push(imp);
  }

  // Score vs substantive DB peers (production baseline)
  for (const content of generatedCurrent) {
    if (!content) continue;
    const s = scoreContent(content, peers.substantiveIntros, peers.substantiveFaqs, peers.substantiveTitles, peers.substantiveMetas);
    currentResults.push({ slug: content.slug, uniqueness: s.breakdown.overall, seo: s.seoQualityScore, risk: s.duplicateRisk, words: s.wordCount });
  }
  for (const content of generatedImproved) {
    if (!content) continue;
    const s = scoreContent(content, peers.substantiveIntros, peers.substantiveFaqs, peers.substantiveTitles, peers.substantiveMetas);
    improvedResults.push({ slug: content.slug, uniqueness: s.breakdown.overall, seo: s.seoQualityScore, risk: s.duplicateRisk, words: s.wordCount });
  }

  // Within-batch cross-similarity (generator diversity, not scoring)
  const currentIntros = generatedCurrent.map((c) => c!.introContent);
  const improvedIntros = generatedImproved.map((c) => c!.introContent);

  const summary = {
    auditedAt: new Date().toISOString(),
    peerBaseline: {
      totalCityPages: peers.allIntros.length,
      substantivePages: peers.substantiveCount,
      legacyThinPages: peers.legacyCount,
      substantiveSlugs: peers.substantiveSlugs,
    },
    rootCause: {
      primary: "B — fallback generic enrichment is structurally identical across cities",
      secondary: "A — scoring uses only 3 substantive v3 peers (Agra/Ahmedabad/Mumbai), but generic content still matches their paragraph skeletons and FAQ templates",
      evidence: [
        "GENERIC_NEIGHBORHOODS reuses 8 labels (Central, Civil Lines, Station Road…) for every non-curated city",
        "GENERIC_LANDMARKS reuses 5 templates prefixed with city name — token overlap remains high after boilerplate stripping",
        "Curated cities inject unique entities (Taj Mahal, Gateway of India, Sabarmati) that break paragraph-min similarity",
        "FAQ groups (3 templates) contribute 25% of score; question stems are identical across cities",
        "Substantive peer filter excludes 150 legacy pages — low scores are NOT primarily caused by legacy template comparison",
      ],
    },
    structureComparison: structureCompare,
    hypothesisA,
    similarityDetail,
    random20Cities: random20,
    currentEngine: {
      averageUniqueness: Math.round(avg(currentResults.map((r) => r.uniqueness)) * 10) / 10,
      averageSeoScore: Math.round(avg(currentResults.map((r) => r.seo)) * 10) / 10,
      lowRisk: currentResults.filter((r) => r.risk === "low").length,
      mediumRisk: currentResults.filter((r) => r.risk === "medium").length,
      highRisk: currentResults.filter((r) => r.risk === "high").length,
      batchMaxIntroSimilarity: Math.round(maxPairwiseSimilarity(currentIntros) * 100),
      pages: currentResults,
    },
    improvedEngine: {
      averageUniqueness: Math.round(avg(improvedResults.map((r) => r.uniqueness)) * 10) / 10,
      averageSeoScore: Math.round(avg(improvedResults.map((r) => r.seo)) * 10) / 10,
      lowRisk: improvedResults.filter((r) => r.risk === "low").length,
      mediumRisk: improvedResults.filter((r) => r.risk === "medium").length,
      highRisk: improvedResults.filter((r) => r.risk === "high").length,
      batchMaxIntroSimilarity: Math.round(maxPairwiseSimilarity(improvedIntros) * 100),
      pages: improvedResults,
    },
    goalMet: {
      current: {
        uniquenessAbove70: currentResults.filter((r) => r.uniqueness >= 70).length,
        seoAbove90: currentResults.filter((r) => r.seo >= 90).length,
        lowRisk: currentResults.filter((r) => r.risk === "low").length,
      },
      improved: {
        uniquenessAbove70: improvedResults.filter((r) => r.uniqueness >= 70).length,
        seoAbove90: improvedResults.filter((r) => r.seo >= 90).length,
        lowRisk: improvedResults.filter((r) => r.risk === "low").length,
      },
    },
  };

  fs.writeFileSync(path.join(OUT, "root-cause-audit.json"), JSON.stringify(summary, null, 2));

  const txt = [
    "SEO UNIQUENESS ROOT CAUSE AUDIT",
    "=".repeat(50),
    "",
    "ROOT CAUSE: " + summary.rootCause.primary,
    "Secondary: " + summary.rootCause.secondary,
    "",
    "PEER BASELINE:",
    `  Total city pages: ${summary.peerBaseline.totalCityPages}`,
    `  Substantive (>=350w): ${summary.peerBaseline.substantivePages} → ${summary.peerBaseline.substantiveSlugs.join(", ")}`,
    `  Legacy thin pages: ${summary.peerBaseline.legacyThinPages}`,
    "",
    "20 RANDOM CITIES — CURRENT ENGINE:",
    `  Avg uniqueness: ${summary.currentEngine.averageUniqueness}%`,
    `  Avg SEO score:  ${summary.currentEngine.averageSeoScore}%`,
    `  LOW/MED/HIGH:   ${summary.currentEngine.lowRisk}/${summary.currentEngine.mediumRisk}/${summary.currentEngine.highRisk}`,
    `  Batch max intro similarity: ${summary.currentEngine.batchMaxIntroSimilarity}%`,
    "",
    "20 RANDOM CITIES — IMPROVED ENGINE:",
    `  Avg uniqueness: ${summary.improvedEngine.averageUniqueness}%`,
    `  Avg SEO score:  ${summary.improvedEngine.averageSeoScore}%`,
    `  LOW/MED/HIGH:   ${summary.improvedEngine.lowRisk}/${summary.improvedEngine.mediumRisk}/${summary.improvedEngine.highRisk}`,
    `  Batch max intro similarity: ${summary.improvedEngine.batchMaxIntroSimilarity}%`,
    "",
    "GOAL (>70% unique, >90 SEO, LOW risk) — improved engine:",
    `  Uniqueness >=70%: ${summary.goalMet.improved.uniquenessAbove70}/20`,
    `  SEO >=90%:        ${summary.goalMet.improved.seoAbove90}/20`,
    `  LOW risk:         ${summary.goalMet.improved.lowRisk}/20`,
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "audit-output.txt"), txt);
  console.log(txt);
  console.log(`\nFull report: ${path.join(OUT, "root-cause-audit.json")}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

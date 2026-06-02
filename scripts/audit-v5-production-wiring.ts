/**
 * Verify V5 SEO engine production wiring for all generation paths.
 * Run: npx tsx scripts/audit-v5-production-wiring.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { chromium } from "playwright";
import {
  generateCitySEOContent,
  generateCategorySEOContent,
  generateCategoryCitySEOContent,
  generateStateSEOContent,
  generateCountrySEOContent,
  generateLongTailSEOContent,
  getActiveSeoEngine,
  getSeoEngineInfo,
} from "../src/lib/seo-engine";
import { resolveIntroContentForStorage } from "../src/lib/seo-content";
import { buildRegeneratedContent } from "../src/lib/seo-regeneration-service";

const OUT_DIR = path.resolve("artifacts/v5-production-wiring-audit");

process.env.SEO_ENGINE = process.env.SEO_ENGINE || "v5";

type PathResult = {
  path: string;
  engine: string;
  wordCount: number;
  faqCount: number;
  title: string;
  h1: string;
  passed: boolean;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const engineInfo = getSeoEngineInfo();
  const activeEngine = getActiveSeoEngine();

  const samples: PathResult[] = [];

  const city = generateCitySEOContent("Mumbai", "mumbai", "Maharashtra", "India", {
    stateSlug: "maharashtra",
  });
  samples.push({
    path: "Generate Cities / autoGenerateCitySeoPage",
    engine: activeEngine,
    wordCount: countWords(resolveIntroContentForStorage(city)),
    faqCount: city.faqs.length,
    title: city.title,
    h1: city.h1,
    passed: countWords(resolveIntroContentForStorage(city)) >= 350 && city.faqs.length >= 4,
  });

  const category = generateCategorySEOContent("Escorts", "escorts");
  samples.push({
    path: "Generate Categories",
    engine: activeEngine,
    wordCount: countWords(category.introParagraph),
    faqCount: category.faqs.length,
    title: category.title,
    h1: category.h1,
    passed: category.faqs.length >= 3,
  });

  const categoryCity = generateCategoryCitySEOContent(
    "Escorts",
    "escorts",
    "Mumbai",
    "mumbai",
    "Maharashtra",
    "maharashtra",
  );
  samples.push({
    path: "Generate Category+City",
    engine: activeEngine,
    wordCount: countWords(resolveIntroContentForStorage(categoryCity)),
    faqCount: categoryCity.faqs.length,
    title: categoryCity.title,
    h1: categoryCity.h1,
    passed: countWords(resolveIntroContentForStorage(categoryCity)) >= 350,
  });

  const state = generateStateSEOContent("Maharashtra", "maharashtra", "India");
  samples.push({
    path: "Generate States",
    engine: activeEngine,
    wordCount: countWords(state.introParagraph),
    faqCount: state.faqs.length,
    title: state.title,
    h1: state.h1,
    passed: state.faqs.length >= 3,
  });

  const country = generateCountrySEOContent("India", "india");
  samples.push({
    path: "Generate Countries",
    engine: activeEngine,
    wordCount: countWords(country.introParagraph),
    faqCount: country.faqs.length,
    title: country.title,
    h1: country.h1,
    passed: country.faqs.length >= 3,
  });

  const longtail = generateLongTailSEOContent(
    "Independent Escorts",
    "independent-escorts",
    "Mumbai",
    "mumbai",
    "Maharashtra",
    "maharashtra",
  );
  samples.push({
    path: "Generate Longtail",
    engine: activeEngine,
    wordCount: countWords(resolveIntroContentForStorage(longtail)),
    faqCount: longtail.faqs.length,
    title: longtail.title,
    h1: longtail.h1,
    passed: countWords(resolveIntroContentForStorage(longtail)) >= 350,
  });

  let bulkRegen: PathResult | null = null;
  try {
    const regen = await buildRegeneratedContent("city", "mumbai");
    if (regen) {
      bulkRegen = {
        path: "Bulk Regeneration (buildRegeneratedContent city)",
        engine: activeEngine,
        wordCount: countWords(resolveIntroContentForStorage(regen.content)),
        faqCount: regen.content.faqs.length,
        title: regen.content.title,
        h1: regen.content.h1,
        passed: countWords(resolveIntroContentForStorage(regen.content)) >= 350,
      };
      samples.push(bulkRegen);
    }
  } catch {
    bulkRegen = {
      path: "Bulk Regeneration (buildRegeneratedContent city)",
      engine: activeEngine,
      wordCount: 0,
      faqCount: 0,
      title: "(skipped — DB unavailable)",
      h1: "",
      passed: false,
    };
    samples.push(bulkRegen);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    activeEngine,
    engineInfo,
    codePath: "seo-engine.ts → seo-city-content-v5.ts (city) | seo-content.ts shells merged with V5 body (category_city, longtail)",
    featureFlag: "SEO_ENGINE=v5",
    samples,
    allPassed: samples.every((s) => s.passed),
  };

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>V5 SEO Engine Audit</title>
<style>body{font-family:system-ui;background:#0b0b0f;color:#f5f5f7;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:8px;text-align:left}th{background:#15151d}.ok{color:#4ade80}.bad{color:#f87171}</style>
</head><body>
<h1>V5 SEO Production Wiring</h1>
<p><strong>Active engine:</strong> ${activeEngine} (${engineInfo.envVar})</p>
<p><strong>City engine:</strong> ${engineInfo.cityEngine}</p>
<table><tr><th>Path</th><th>Words</th><th>FAQs</th><th>Title</th><th>Status</th></tr>
${samples.map((s) => `<tr><td>${s.path}</td><td>${s.wordCount}</td><td>${s.faqCount}</td><td>${s.title.slice(0, 60)}...</td><td class="${s.passed ? "ok" : "bad"}">${s.passed ? "PASS" : "FAIL"}</td></tr>`).join("")}
</table></body></html>`;

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT_DIR, "report.html"), html);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: path.join(OUT_DIR, "v5-wiring-audit.png"), fullPage: true });
  await browser.close();

  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

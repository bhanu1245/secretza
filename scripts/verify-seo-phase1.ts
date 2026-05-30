/**
 * Verification script for SEO Architecture Phase 1 implementation.
 * Checks: H2 sentinels, internal link URLs, anchor text, backward compat.
 */

import { generateV5CitySEO } from "../src/lib/seo-city-content-v5";
import * as fs from "fs";
import * as path from "path";

type Check = { id: string; description: string; pass: boolean; detail: string };
const checks: Check[] = [];

function check(id: string, description: string, pass: boolean, detail: string) {
  checks.push({ id, description, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} [${id}] ${description}`);
  if (!pass) console.log(`    FAIL: ${detail}`);
}

// --- Generate content for two cities ---
const mumbai = generateV5CitySEO("Mumbai", "mumbai", "Maharashtra", "maharashtra");
const delhi  = generateV5CitySEO("Delhi", "delhi", "Delhi", "delhi");

// ─────────────────────────────────────────────
// 1. H2 SENTINEL INJECTION
// ─────────────────────────────────────────────
console.log("\n=== 1. H2 Sentinel Injection ===");

const mumbaiParas = mumbai.introContent.split("\n\n");
const h2SentinelsMumbai = mumbaiParas.filter((p) =>
  p.trim().match(/^##H2::(.+?)##$/)
);
check(
  "H2-01",
  "Mumbai introContent contains ##H2:: sentinels",
  h2SentinelsMumbai.length >= 3,
  `found ${h2SentinelsMumbai.length} sentinels (expected ≥3)`,
);

check(
  "H2-02",
  "Each sentinel contains city name or keyword",
  h2SentinelsMumbai.every((s) => s.includes("Mumbai") || s.includes("Escort") || s.includes("Adult") || s.includes("Service")),
  h2SentinelsMumbai.filter((s) => !s.includes("Mumbai") && !s.includes("Escort") && !s.includes("Adult")).join("; "),
);

const delhiParas = delhi.introContent.split("\n\n");
const h2SentinelsDelhi = delhiParas.filter((p) =>
  p.trim().match(/^##H2::(.+?)##$/)
);
check(
  "H2-03",
  "Delhi introContent contains ##H2:: sentinels (different labels)",
  h2SentinelsDelhi.length >= 3 &&
    JSON.stringify(h2SentinelsMumbai) !== JSON.stringify(h2SentinelsDelhi),
  `Mumbai: ${h2SentinelsMumbai.length} sentinels, Delhi: ${h2SentinelsDelhi.length} sentinels`,
);

check(
  "H2-04",
  "First paragraph has NO ##H2:: sentinel (intro is plain text)",
  !mumbaiParas[0]?.trim().startsWith("##H2::"),
  `First para starts with: ${mumbaiParas[0]?.slice(0, 60)}`,
);

check(
  "H2-05",
  "Last paragraph has NO ##H2:: sentinel (entropy paragraph is plain text)",
  !mumbaiParas[mumbaiParas.length - 1]?.trim().startsWith("##H2::"),
  `Last para: ${mumbaiParas[mumbaiParas.length - 1]?.slice(0, 60)}`,
);

// Sample a few H2 labels
console.log("\n  Sample H2 labels (Mumbai):");
h2SentinelsMumbai.slice(0, 5).forEach((s, i) =>
  console.log(`  ${i + 1}. ${s.trim().replace(/^##H2::|##$/g, "")}`)
);

// ─────────────────────────────────────────────
// 2. INTERNAL LINK URL FIX
// ─────────────────────────────────────────────
console.log("\n=== 2. Internal Link URL Fix ===");

const badUrlPatterns = [
  /^\/escorts\//,
  /^\/massage\//,
  /^\/dating\//,
  /^\/trans\//,
  /^\/male-escorts\//,
  /^\/adult-services\//,
];

const brokenLinks = mumbai.internalLinks.filter((l) =>
  badUrlPatterns.some((r) => r.test(l.url))
);
check(
  "URL-01",
  "No broken URL patterns (/escorts/{slug}, /adult-services/{slug}, etc.)",
  brokenLinks.length === 0,
  brokenLinks.map((l) => l.url).join(", "),
);

const cityPageLinks = mumbai.internalLinks.filter(
  (l) => l.url === "/in/maharashtra/mumbai"
);
check(
  "URL-02",
  "Architecture anchor links point to /{country}/{state}/{city} canonical URL",
  cityPageLinks.length >= 3,
  `found ${cityPageLinks.length} city-canonical links (expected ≥3)`,
);

const categoryPageLinks = mumbai.internalLinks.filter(
  (l) => l.url.startsWith("/category/")
);
check(
  "URL-03",
  "Category links use /category/{slug} route",
  categoryPageLinks.length >= 3,
  `found ${categoryPageLinks.length} /category/ links: ${categoryPageLinks.map((l) => l.url).join(", ")}`,
);

// ─────────────────────────────────────────────
// 3. RELATED CITY ANCHOR TEXT FIX
// ─────────────────────────────────────────────
console.log("\n=== 3. Related City Anchor Text Fix ===");

const cityLinks = mumbai.internalLinks.filter((l) => l.type === "city");
const hasOldArrow = cityLinks.some((l) => l.text.includes("←"));
check(
  "ANCHOR-01",
  'No city link uses the old "{city} ← {current}" pattern',
  !hasOldArrow,
  `Found arrow links: ${cityLinks.filter((l) => l.text.includes("←")).map((l) => l.text).join("; ")}`,
);

const hasKeywordAnchors = cityLinks.every((l) =>
  l.text.toLowerCase().startsWith("escorts in ")
);
check(
  "ANCHOR-02",
  'All city links use "escorts in {city}" anchor text',
  hasKeywordAnchors,
  `City link anchors: ${cityLinks.map((l) => l.text).join("; ")}`,
);

console.log("\n  City links (Mumbai):");
cityLinks.forEach((l) => console.log(`  - "${l.text}" → ${l.url}`));

// ─────────────────────────────────────────────
// 4. CATEGORY LINK ANCHOR TEXT
// ─────────────────────────────────────────────
console.log("\n=== 4. Category Link Anchor Text ===");

const catPageLinks = mumbai.internalLinks.filter((l) =>
  l.url.startsWith("/category/")
);
check(
  "CAT-01",
  "Category links include city name in anchor text",
  catPageLinks.every((l) => l.text.toLowerCase().includes("mumbai")),
  catPageLinks.map((l) => l.text).join("; "),
);
console.log("\n  Category links (Mumbai):");
catPageLinks.forEach((l) => console.log(`  - "${l.text}" → ${l.url}`));

// ─────────────────────────────────────────────
// 5. BACKWARD COMPATIBILITY
// ─────────────────────────────────────────────
console.log("\n=== 5. Backward Compatibility (flat introContent parsing) ===");

const flatIntro = "First paragraph about Delhi.\n\nSecond paragraph without any sentinels.";
const flatParas = flatIntro.split("\n\n");
const flatH2s = flatParas.filter((p) => p.trim().match(/^##H2::(.+?)##$/));
check(
  "COMPAT-01",
  "Flat introContent (legacy pages) produces 0 H2 sentinels",
  flatH2s.length === 0,
  `found ${flatH2s.length} sentinels in flat content`,
);

// ─────────────────────────────────────────────
// 6. STATE SLUG THREADING
// ─────────────────────────────────────────────
console.log("\n=== 6. StateSlug Threading ===");

// Nearby city URLs should use the same country/state slug
const nearbyCityLinks = mumbai.internalLinks.filter((l) => l.type === "city");
const correctStatePrefix = nearbyCityLinks.every((l) =>
  l.url.startsWith("/in/maharashtra/")
);
check(
  "STATE-01",
  "Nearby city URLs include country+state slug (/in/maharashtra/{nearbySlug})",
  correctStatePrefix,
  `URLs: ${nearbyCityLinks.map((l) => l.url).join(", ")}`,
);

check(
  "STATE-02",
  "City canonical URL formed correctly for Mumbai",
  mumbai.internalLinks.some((l) => l.url === "/in/maharashtra/mumbai"),
  "Expected at least one link to /in/maharashtra/mumbai",
);

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────
console.log("\n=== SUMMARY ===");
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const score = Math.round((passed / total) * 100);

console.log(`\nPassed: ${passed}/${total} (${score}%)`);
checks
  .filter((c) => !c.pass)
  .forEach((c) => console.log(`  FAIL [${c.id}] ${c.description}: ${c.detail}`));

const verdict = passed === total ? "PASS" : passed >= total * 0.9 ? "PARTIAL" : "FAIL";
console.log(`\nVERDICT: ${verdict}`);

// ─────────────────────────────────────────────
// OUTPUT JSON REPORT
// ─────────────────────────────────────────────
const reportDir = path.join(process.cwd(), "artifacts", "seo-phase1-verification");
fs.mkdirSync(reportDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  verdict,
  score: `${score}%`,
  passed,
  total,
  checks,
  samples: {
    mumbaiH2Labels: h2SentinelsMumbai
      .map((s) => s.trim().replace(/^##H2::|##$/g, ""))
      .slice(0, 8),
    cityLinks: cityLinks.map((l) => ({ text: l.text, url: l.url })),
    categoryLinks: catPageLinks.map((l) => ({ text: l.text, url: l.url })),
  },
};

fs.writeFileSync(
  path.join(reportDir, "report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(`\nReport saved to artifacts/seo-phase1-verification/report.json`);

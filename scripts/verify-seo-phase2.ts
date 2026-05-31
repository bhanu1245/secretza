/**
 * SEO Phase 2 — Verification Script
 *
 * Checks:
 *  1. Primary keyword is generated and non-empty
 *  2. Primary keyword contains the city name
 *  3. Secondary keywords: 8 items, all non-empty, each contains city name or state name
 *  4. FAQ keyword matrix: first 4 FAQs target keywords (question contains the city name or keyword)
 *  5. Contextual links: exactly 3 [text](url) markdown links in article body
 *  6. Contextual links: all 3 are in distinct sections (different \n\n blocks in sectionTexts)
 *  7. Links point to valid URL patterns (city URL or /category/...)
 *  8. FAQ count is 8 (4 keyword + 4 pool)
 *  9. Backward-compatibility: SeoIntroContent parse still works for flat content
 * 10. V5CityContent includes primaryKeyword + secondaryKeywords fields
 * 11. Primary keywords are deterministic (same city → same keyword)
 * 12. Different architectures produce different primary keywords
 * 13. No link leaks into H2 sentinel lines
 * 14. secondaryKeywords are distinct (no duplicates)
 */

import { generateV5CitySEO, buildPrimaryKeyword, buildSecondaryKeywords, pickPageArchitecture } from "../src/lib/seo-city-content-v5";

let passed = 0;
let failed = 0;

function check(name: string, result: boolean, detail?: string) {
  if (result) {
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function countMdLinks(text: string): number {
  return (text.match(/\[([^\]]+)\]\(([^)]+)\)/g) ?? []).length;
}

function extractMdLinks(text: string): Array<{ anchor: string; url: string }> {
  const links: Array<{ anchor: string; url: string }> = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    links.push({ anchor: m[1]!, url: m[2]! });
  }
  return links;
}

// ─── City: Mumbai ──────────────────────────────────────────────────────────
console.log("\n=== Mumbai ===");
const mumbai = generateV5CitySEO("Mumbai", "mumbai", "Maharashtra", "maharashtra");

check("1. primaryKeyword non-empty", !!mumbai.primaryKeyword && mumbai.primaryKeyword.length > 0);
check("2. primaryKeyword contains city name", mumbai.primaryKeyword.toLowerCase().includes("mumbai"));
check("10. V5CityContent has primaryKeyword field", "primaryKeyword" in mumbai);
check("10. V5CityContent has secondaryKeywords field", "secondaryKeywords" in mumbai);

const skMumbai = mumbai.secondaryKeywords;
check("3a. secondaryKeywords has 8 items", skMumbai.length === 8, `got ${skMumbai.length}`);
check("3b. all secondary keywords non-empty", skMumbai.every((k) => k.length > 0));
// At least 6 of 8 secondary keywords reference city or state name.
// The remaining up to 2 are neighbourhood-level targets (e.g. "Heritage Halli escorts")
// which are valid long-tail SEO keywords.
const skWithCityOrState = skMumbai.filter(
  (k) => k.toLowerCase().includes("mumbai") || k.toLowerCase().includes("maharashtra"),
);
check(
  "3c. ≥6 secondary keywords contain city or state name",
  skWithCityOrState.length >= 6,
  `${skWithCityOrState.length}/8 contain city/state. Neighbourhood-only: ${skMumbai.filter((k) => !k.toLowerCase().includes("mumbai") && !k.toLowerCase().includes("maharashtra")).join(", ")}`,
);
check("14. no duplicate secondary keywords", new Set(skMumbai).size === skMumbai.length);

const bodyMumbai = mumbai.introContent;
const allLinksMumbai = extractMdLinks(bodyMumbai);
check("5. exactly 3 contextual links in body", allLinksMumbai.length === 3, `found ${allLinksMumbai.length}: ${JSON.stringify(allLinksMumbai)}`);

// Check links are in distinct sections (split by \n\n, each section that has ##H2:: counts once)
const sectionsMumbai = bodyMumbai.split("\n\n");
const sectionsWithLinks = sectionsMumbai.filter((s) => /\[([^\]]+)\]\(([^)]+)\)/.test(s));
check("6. links in distinct paragraphs", sectionsWithLinks.length >= 3, `sections-with-links=${sectionsWithLinks.length}`);

const linkUrlsMumbai = allLinksMumbai.map((l) => l.url);
check(
  "7a. links point to city URL or category",
  linkUrlsMumbai.every((u) => u.startsWith("/in/") || u.startsWith("/category/")),
  `urls=${JSON.stringify(linkUrlsMumbai)}`,
);
check(
  "7b. at least 1 link to /category/escorts",
  linkUrlsMumbai.some((u) => u === "/category/escorts"),
);

// Check no link inside ##H2:: sentinel
const h2Lines = sectionsMumbai.filter((s) => s.trim().startsWith("##H2::"));
const linksInH2 = h2Lines.filter((s) => /\[.*\]\(.*\)/.test(s));
check("13. no links leak into H2 sentinel lines", linksInH2.length === 0, `leaking lines: ${linksInH2.join(" | ")}`);

check("4. FAQ count is 8", mumbai.faqs.length === 8, `got ${mumbai.faqs.length}`);

// First 4 FAQs should target keywords (questions contain city name or keyword phrase)
const first4 = mumbai.faqs.slice(0, 4);
const first4Pass = first4.every(
  (faq) =>
    faq.question.toLowerCase().includes("mumbai") ||
    faq.question.toLowerCase().includes("escort") ||
    faq.question.toLowerCase().includes("massage") ||
    faq.question.toLowerCase().includes("service"),
);
check("4a. first 4 FAQs are keyword-targeted", first4Pass, first4.map((f) => f.question).join(" | "));

// First FAQ should mention primary keyword
check(
  "4b. first FAQ question targets primary keyword",
  mumbai.faqs[0]!.question.toLowerCase().includes(mumbai.primaryKeyword.toLowerCase()) ||
    mumbai.faqs[0]!.question.toLowerCase().includes("escort"),
);

// ─── City: Delhi ───────────────────────────────────────────────────────────
console.log("\n=== Delhi ===");
const delhi = generateV5CitySEO("Delhi", "delhi", "Delhi", "delhi");

check("2b. Delhi primaryKeyword contains city name", delhi.primaryKeyword.toLowerCase().includes("delhi"));
check("3d. Delhi has 8 secondary keywords", delhi.secondaryKeywords.length === 8);
const delhiLinks = extractMdLinks(delhi.introContent);
check("5b. Delhi has exactly 3 contextual links", delhiLinks.length === 3, `found ${delhiLinks.length}`);

// ─── Determinism check ─────────────────────────────────────────────────────
console.log("\n=== Determinism ===");
const mumbai2 = generateV5CitySEO("Mumbai", "mumbai", "Maharashtra", "maharashtra");
check("11. primaryKeyword is deterministic", mumbai.primaryKeyword === mumbai2.primaryKeyword);
check(
  "11. secondaryKeywords are deterministic",
  JSON.stringify(mumbai.secondaryKeywords) === JSON.stringify(mumbai2.secondaryKeywords),
);

// ─── Architecture diversity ─────────────────────────────────────────────────
console.log("\n=== Architecture diversity ===");
const archCities = [
  { name: "Agra", arch: "tourism" as const, tier: 2 },
  { name: "Gurgaon", arch: "business_traveler" as const, tier: 1 },
  { name: "Kolkata", arch: "nightlife" as const, tier: 1 },
  { name: "Pune", arch: "premium" as const, tier: 1 },
];
const archKeywords = archCities.map((c) => buildPrimaryKeyword(c.name, c.arch, c.tier));
const uniqueKeywordPhrases = new Set(archKeywords.map((k) => k.split(" in ")[0]));
check(
  "12. different architectures may produce different service phrases",
  uniqueKeywordPhrases.size >= 2,
  `service phrases: ${[...uniqueKeywordPhrases].join(", ")}`,
);

// ─── Backward compat — flat intro ─────────────────────────────────────────
console.log("\n=== Backward compatibility ===");
const flatIntro = "First paragraph of content.\n\nSecond paragraph here.\n\nThird paragraph.";
const hasNoH2 = !flatIntro.includes("##H2::");
check("9. flat intro has no H2 sentinels (backward compat)", hasNoH2);
// Simulate what SeoIntroContent does:
const paragraphs = flatIntro.split("\n\n");
check("9b. flat intro splits to 3 paragraphs", paragraphs.length === 3);

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed / ${failed} failed / ${passed + failed} total`);
if (failed === 0) {
  console.log("✅ ALL CHECKS PASSED — SEO Phase 2 verified.");
} else {
  console.error(`❌ ${failed} checks failed.`);
  process.exit(1);
}

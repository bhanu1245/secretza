/**
 * SEO City Generation Audit Script
 * 
 * Queries the actual SQLite database used by the application and prints
 * all runtime values needed to diagnose why batch 1 returns 0 new pages.
 *
 * Run from project root:
 *   bun scripts/seo-city-audit.mjs
 */

import { Database } from "bun:sqlite";
import path from "path";

// ── Locate the database ───────────────────────────────────────────────────────
// server.js does process.chdir(__dirname) → CWD becomes .next/standalone/
// DATABASE_URL "file:./db/custom.db" therefore resolves to:
//   .next/standalone/db/custom.db   (runtime path used by the server)
// The development/source database lives at:
//   prisma/db/custom.db

const candidatePaths = [
  path.resolve(".next/standalone/db/custom.db"),   // runtime (post-chdir)
  path.resolve("prisma/db/custom.db"),             // source / dev DB
  path.resolve("db/custom.db"),                    // project-root db/ dir
];

function openFirst(paths) {
  for (const p of paths) {
    try {
      const db = new Database(p, { readonly: true });
      db.query("SELECT 1").get(); // verify it has tables
      return { db, path: p };
    } catch {
      // try next
    }
  }
  return null;
}

const found = openFirst(candidatePaths);

console.log("\n══════════════════════════════════════════════════════════");
console.log("   SEO CITY GENERATION AUDIT");
console.log("══════════════════════════════════════════════════════════\n");

if (!found) {
  console.error("❌  No readable SQLite database found at any of:");
  candidatePaths.forEach(p => console.error("   ", p));
  process.exit(1);
}

const { db, path: dbPath } = found;
console.log(`✅  Database opened: ${dbPath}\n`);

// ── 1. Total cities in City table ─────────────────────────────────────────────
const totalCities = db.query("SELECT COUNT(*) as n FROM City").get().n;
console.log(`[1] totalCities (ALL rows in City table): ${totalCities}`);

// ── 2. Total city SeoPages ────────────────────────────────────────────────────
const totalCitySeoPages = db
  .query("SELECT COUNT(*) as n FROM SeoPage WHERE pageType = 'city'")
  .get().n;
console.log(`[2] totalCitySeoPages (SeoPage WHERE pageType='city'): ${totalCitySeoPages}`);

// ── 3. existingSlugs — exact query from getExistingPageSlugs("city") ──────────
const existingRows = db
  .query("SELECT pageSlug FROM SeoPage WHERE pageType = 'city'")
  .all();
const existingSlugs = new Set(existingRows.map(r => r.pageSlug));
console.log(`[3] existingSlugs.size (city SeoPage pageSlug values): ${existingSlugs.size}`);

// ── 4. First 20 existingSlugs ─────────────────────────────────────────────────
const first20existing = [...existingSlugs].sort().slice(0, 20);
console.log(`[4] First 20 existingSlugs (sorted):`);
first20existing.forEach((s, i) => console.log(`     ${String(i + 1).padStart(2)}. "${s}"`));

// ── 5. Active India cities — equivalent of generateCitySeoPages baseWhere ─────
const activeCities = db.query(`
  SELECT c.slug, c.name, c.isActive, s.slug AS stateSlug, co.slug AS countrySlug, co.isActive AS countryActive
  FROM City c
  JOIN State s  ON c.stateId = s.id
  JOIN Country co ON s.countryId = co.id
  WHERE c.isActive = 1
    AND co.slug    = 'india'
    AND co.isActive = 1
  ORDER BY c.name ASC
`).all();

console.log(`\n[5] Active cities matching baseWhere:`);
console.log(`     isActive=1 AND country.slug='india' AND country.isActive=1`);
console.log(`     → Count: ${activeCities.length}`);
console.log(`     First 20 slugs (sorted by name):`);
activeCities.slice(0, 20).forEach((c, i) =>
  console.log(`     ${String(i + 1).padStart(2)}. "${c.slug}" (${c.name}, ${c.stateSlug}, ${c.countrySlug})`)
);

// ── 6. Missing cities — the notIn filter result ───────────────────────────────
const missingCities = activeCities.filter(c => !existingSlugs.has(c.slug));
console.log(`\n[6] missingCities (active cities NOT in existingSlugs): ${missingCities.length}`);
if (missingCities.length > 0) {
  console.log(`     First 20 missing slugs:`);
  missingCities.slice(0, 20).forEach((c, i) =>
    console.log(`     ${String(i + 1).padStart(2)}. "${c.slug}" (${c.name})`)
  );
} else {
  console.log(`     ⚠️  All active India cities already have SeoPages.`);
}

// ── 7. Simulate batch-1 with limit=100, skipExisting=true ─────────────────────
// Exact Prisma query equivalent:
const notInList = existingSlugs.size > 0
  ? `AND c.slug NOT IN (${[...existingSlugs].map(() => "?").join(",")})`
  : "";
const batch1Sql = `
  SELECT c.slug, c.name
  FROM City c
  JOIN State s  ON c.stateId = s.id
  JOIN Country co ON s.countryId = co.id
  WHERE c.isActive = 1
    AND co.slug    = 'india'
    AND co.isActive = 1
    ${notInList}
  ORDER BY c.name ASC
  LIMIT 100
`.trim();

let batch1Rows = [];
if (existingSlugs.size > 0) {
  batch1Rows = db.query(batch1Sql).all(...[...existingSlugs]);
} else {
  batch1Rows = db.query(batch1Sql).all();
}

console.log(`\n[7] Batch-1 result (limit=100, skipExisting=true):`);
console.log(`     Rows returned: ${batch1Rows.length}`);
if (batch1Rows.length > 0) {
  console.log(`     First 5: ${batch1Rows.slice(0, 5).map(r => r.slug).join(", ")}`);
}

// ── 8. The exact Prisma-equivalent SQL ────────────────────────────────────────
const sampleSlugs = [...existingSlugs].slice(0, 3);
const samplePlaceholders = sampleSlugs.map(s => `'${s}'`).join(", … ");
console.log(`\n[8] Prisma-equivalent SQL (simplified):`);
console.log(`
  SELECT slug, name, state.name, state.slug, country.name, country.slug
  FROM City
  INNER JOIN State  ON City.stateId  = State.id
  INNER JOIN Country ON State.countryId = Country.id
  WHERE City.isActive    = true
    AND Country.slug     = 'india'
    AND Country.isActive = true
    AND City.slug NOT IN (${samplePlaceholders}${existingSlugs.size > 3 ? ` … +${existingSlugs.size - 3} more` : ""})
  ORDER BY City.name ASC
  LIMIT 100;
`);

// ── 9. Root cause determination ───────────────────────────────────────────────
console.log("══════════════════════════════════════════════════════════");
console.log("   ROOT CAUSE DIAGNOSIS");
console.log("══════════════════════════════════════════════════════════\n");

const totalActive = activeCities.length;
const skipped = existingSlugs.size;
const missing = missingCities.length;

console.log(`  Total rows in City table:          ${totalCities}`);
console.log(`  Active cities in India:            ${totalActive}`);
console.log(`  Existing city SeoPages (skipped):  ${skipped}`);
console.log(`  Missing (totalActive - skipped):   ${missing}`);
console.log(`  Batch-1 cities returned:           ${batch1Rows.length}`);
console.log();

if (missing === 0 && totalActive === skipped) {
  console.log(`  VERDICT: All ${totalActive} active India cities already have SeoPages.`);
  console.log(`           The generator correctly returns created=0.`);
  console.log();
  if (totalCities > totalActive) {
    console.log(`  WHY 847 vs ${totalActive}:`);
    console.log(`  City table has ${totalCities} total rows but only ${totalActive} pass the filter:`);
    console.log(`    isActive=1 AND country.slug='india' AND country.isActive=1`);
    // Breakdown
    const allInactive = db.query("SELECT COUNT(*) as n FROM City WHERE isActive = 0").get().n;
    const notIndia = db.query(`
      SELECT COUNT(*) as n FROM City c
      JOIN State s ON c.stateId = s.id
      JOIN Country co ON s.countryId = co.id
      WHERE c.isActive = 1 AND co.slug != 'india'
    `).get().n;
    const inactiveCountry = db.query(`
      SELECT COUNT(*) as n FROM City c
      JOIN State s ON c.stateId = s.id
      JOIN Country co ON s.countryId = co.id
      WHERE c.isActive = 1 AND co.slug = 'india' AND co.isActive = 0
    `).get().n;
    console.log(`    ├── isActive=0 (inactive cities):      ${allInactive}`);
    console.log(`    ├── active but not in India:           ${notIndia}`);
    console.log(`    └── India country isActive=0:          ${inactiveCountry}`);
  }
} else if (batch1Rows.length === 0 && missing > 0) {
  console.log(`  VERDICT: ${missing} cities ARE missing SeoPages but the SQL returns 0 rows.`);
  console.log(`           The notIn filter may be incorrect or slug mismatches exist.`);
} else {
  console.log(`  VERDICT: ${missing} cities are missing SeoPages. Batch-1 returned ${batch1Rows.length} rows.`);
  console.log(`           Generation should proceed normally.`);
}

console.log("\n══════════════════════════════════════════════════════════\n");

db.close();

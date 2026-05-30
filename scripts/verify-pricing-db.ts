/**
 * DB-level integration tests for pricing-plan hardening.
 * Tests the actual SQL patterns used by the API routes, bypassing HTTP auth.
 *
 * Run: npx tsx scripts/verify-pricing-db.ts
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import { slugify } from "../src/lib/slugify";
import { randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT    = process.cwd();
const OUT_DIR = path.join(ROOT, "artifacts", "pricing-hardening-verification");
mkdirSync(OUT_DIR, { recursive: true });

type Check = { test: string; ok: boolean; detail: string; severity: "blocker" | "high" | "medium" };

async function run() {
  const checks: Check[] = [];
  const now = new Date();
  const slug1 = "verify-hardening-" + Date.now();
  const id1 = randomUUID();

  // Helper
  async function cleanup(slug: string) {
    await db.$executeRaw`DELETE FROM PricingPlan WHERE slug = ${slug}`;
  }

  // ── Inline validator mirrors (copy of actual route helpers) ───────────────

  function validatePrice(value: unknown): string | null {
    const n = Number(value);
    if (value === "" || value === null || value === undefined) return "Price is required";
    if (!isFinite(n) || isNaN(n)) return "Price must be a number";
    if (n < 0) return "Price must be ≥ 0";
    if (n > 999_999) return "Price must be ≤ 999,999";
    return null;
  }

  function validateDays(value: unknown, field: string, min = 0): string | null {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
    if (n < min) return `${field} must be ≥ ${min}`;
    if (n > 3_650) return `${field} must be ≤ 3,650`;
    return null;
  }

  function validateSlug(slug: string): string | null {
    if (slug.length < 2) return "Slug too short";
    if (slug.length > 100) return "Slug too long";
    return null;
  }

  function validateLimit(value: unknown, field: string, min: number, max: number): string | null {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
    if (n < min || n > max) return `${field} must be ${min}–${max}`;
    return null;
  }

  // ── T1: Create a valid plan ──────────────────────────────────────────────
  await cleanup(slug1);
  await db.$executeRaw`
    INSERT INTO PricingPlan (id,name,slug,price,currency,durationDays,featuredDays,boostDays,listingLimit,imageLimit,premiumBadge,priorityScore,features,isActive,isPopular,sortOrder,createdAt,updatedAt)
    VALUES (${id1},${"Hardening Test Plan"},${slug1},${99},${"INR"},${30},${0},${0},${1},${5},${0},${0},${"[]"},${1},${0},${0},${now},${now})
  `;
  checks.push({ test: "T1 · Valid plan inserted", ok: true, detail: `id=${id1} slug=${slug1}`, severity: "blocker" });

  // ── T2: Duplicate slug COUNT > 0 ────────────────────────────────────────
  const dupRows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM PricingPlan WHERE slug = ${slug1}
  `;
  const dupCount = Number(dupRows[0]?.count ?? 0);
  checks.push({ test: "T2 · Duplicate slug COUNT returns > 0 (pre-insert check)", ok: dupCount > 0, detail: `count=${dupCount} (expected >0)`, severity: "blocker" });

  // ── T3: Self-exclusion in PUT check ─────────────────────────────────────
  const selfRows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM PricingPlan WHERE slug = ${slug1} AND id != ${id1}
  `;
  const selfCount = Number(selfRows[0]?.count ?? 0);
  checks.push({ test: "T3 · Self-exclusion check returns 0 for own slug (no false 409)", ok: selfCount === 0, detail: `count=${selfCount} (expected 0)`, severity: "blocker" });

  // ── T4: Existence check for fake id → 0 rows ─────────────────────────────
  const fakeId = "nonexistent-plan-00000";
  const fakeRows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM PricingPlan WHERE id = ${fakeId}`;
  checks.push({ test: "T4 · Existence check for fake id returns 0 rows → 404", ok: fakeRows.length === 0, detail: `rows=${fakeRows.length} (expected 0)`, severity: "blocker" });

  // ── T5: Existence check for real id → 1 row ──────────────────────────────
  const realRows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM PricingPlan WHERE id = ${id1}`;
  checks.push({ test: "T5 · Existence check for real id returns 1 row → no 404", ok: realRows.length === 1, detail: `rows=${realRows.length} (expected 1)`, severity: "blocker" });

  // ── T6: DB UNIQUE constraint fires on duplicate INSERT ───────────────────
  let uniqueViolated = false;
  try {
    const id2 = randomUUID();
    await db.$executeRaw`
      INSERT INTO PricingPlan (id,name,slug,price,currency,durationDays,featuredDays,boostDays,listingLimit,imageLimit,premiumBadge,priorityScore,features,isActive,isPopular,sortOrder,createdAt,updatedAt)
      VALUES (${id2},${"Duplicate Plan"},${slug1},${99},${"INR"},${30},${0},${0},${1},${5},${0},${0},${"[]"},${1},${0},${0},${now},${now})
    `;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    uniqueViolated = msg.toLowerCase().includes("unique");
  }
  checks.push({ test: "T6 · DB UNIQUE constraint throws on duplicate INSERT (try/catch safety net)", ok: uniqueViolated, detail: `uniqueViolated=${uniqueViolated}`, severity: "high" });

  // ── T7: validatePrice — all boundary cases ───────────────────────────────
  type PriceCases = Array<[unknown, boolean, string]>;
  const priceCases: PriceCases = [
    [-1,        true,  "negative"],
    [-0.01,     true,  "negative decimal"],
    ["abc",     true,  "non-numeric string"],
    ["",        true,  "empty string"],
    [null,      true,  "null"],
    [undefined, true,  "undefined"],
    [NaN,       true,  "NaN"],
    [Infinity,  true,  "Infinity"],
    [0,         false, "zero (allowed)"],
    [99,        false, "99 (normal)"],
    [999999,    false, "999999 (max)"],
    [1000000,   true,  "1000000 (over max)"],
  ];
  const priceFailures: string[] = [];
  for (const [val, shouldFail, label] of priceCases) {
    const err = validatePrice(val);
    const failed = err !== null;
    if (failed !== shouldFail) priceFailures.push(`price=${label}: expected fail=${shouldFail} got fail=${failed} (err="${err}")`);
  }
  checks.push({ test: `T7 · validatePrice: ${priceCases.length} boundary cases`, ok: priceFailures.length === 0, detail: priceFailures.length === 0 ? `All ${priceCases.length} cases correct` : priceFailures.join(" | "), severity: "blocker" });

  // ── T8: validateDays — all boundary cases ────────────────────────────────
  type DayCases = Array<[unknown, number, boolean, string]>;
  const dayCases: DayCases = [
    [0,    1, true,  "durationDays=0 (min=1)"],
    [-7,   1, true,  "durationDays=-7"],
    [1,    1, false, "durationDays=1 (min)"],
    [30,   1, false, "durationDays=30"],
    [3650, 1, false, "durationDays=3650 (max)"],
    [3651, 1, true,  "durationDays=3651 (over max)"],
    [1.5,  0, true,  "1.5 (non-integer)"],
    ["abc",0, true,  "string 'abc'"],
    [0,    0, false, "featuredDays=0 (min=0 allowed)"],
    [-1,   0, true,  "featuredDays=-1"],
  ];
  const dayFailures: string[] = [];
  for (const [val, min, shouldFail, label] of dayCases) {
    const err = validateDays(val, "days", min);
    const failed = err !== null;
    if (failed !== shouldFail) dayFailures.push(`${label}: expected fail=${shouldFail} got fail=${failed}`);
  }
  checks.push({ test: `T8 · validateDays: ${dayCases.length} boundary cases`, ok: dayFailures.length === 0, detail: dayFailures.length === 0 ? `All ${dayCases.length} cases correct` : dayFailures.join(" | "), severity: "blocker" });

  // ── T9: validateSlug — all boundary cases ────────────────────────────────
  type SlugCases = Array<[string, boolean, string]>;
  const blankAfterSlugify = slugify("---");   // → ""
  const borderlineSlugify = slugify("ab");    // → "ab" (valid)
  const longSlug = "a".repeat(101);
  const maxSlug  = "a".repeat(100);
  const slugCases: SlugCases = [
    [blankAfterSlugify, true,  `slugify("---")="${blankAfterSlugify}" (blank)`],
    ["a",               true,  "single char"],
    [borderlineSlugify, false, `slugify("ab")="${borderlineSlugify}"`],
    [maxSlug,           false, "100 chars (max)"],
    [longSlug,          true,  "101 chars (over max)"],
  ];
  const slugFailures: string[] = [];
  for (const [val, shouldFail, label] of slugCases) {
    const err = validateSlug(val);
    const failed = err !== null;
    if (failed !== shouldFail) slugFailures.push(`${label}: expected fail=${shouldFail} got fail=${failed}`);
  }
  checks.push({ test: `T9 · validateSlug: ${slugCases.length} boundary cases`, ok: slugFailures.length === 0, detail: slugFailures.length === 0 ? `All ${slugCases.length} cases correct` : slugFailures.join(" | "), severity: "high" });

  // ── T10: validateLimit — listingLimit and imageLimit ────────────────────
  type LimitCases = Array<[unknown, number, number, boolean, string]>;
  const limitCases: LimitCases = [
    [0,    1, 1000, true,  "listingLimit=0"],
    [1,    1, 1000, false, "listingLimit=1 (min)"],
    [1000, 1, 1000, false, "listingLimit=1000 (max)"],
    [1001, 1, 1000, true,  "listingLimit=1001"],
    [0,    1, 50,   true,  "imageLimit=0"],
    [1,    1, 50,   false, "imageLimit=1 (min)"],
    [50,   1, 50,   false, "imageLimit=50 (max)"],
    [51,   1, 50,   true,  "imageLimit=51"],
    [1.5,  1, 50,   true,  "imageLimit=1.5 (non-integer)"],
    ["abc",1, 50,   true,  "imageLimit='abc'"],
  ];
  const limitFailures: string[] = [];
  for (const [val, min, max, shouldFail, label] of limitCases) {
    const err = validateLimit(val, "field", min, max);
    const failed = err !== null;
    if (failed !== shouldFail) limitFailures.push(`${label}: expected fail=${shouldFail} got fail=${failed}`);
  }
  checks.push({ test: `T10 · validateLimit: ${limitCases.length} boundary cases`, ok: limitFailures.length === 0, detail: limitFailures.length === 0 ? `All ${limitCases.length} cases correct` : limitFailures.join(" | "), severity: "high" });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await cleanup(slug1);
  await db.$disconnect();

  // ── Output ────────────────────────────────────────────────────────────────
  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok);

  console.log("\n=== DB INTEGRATION TESTS ===");
  for (const c of checks) {
    console.log((c.ok ? "  ✓" : "  ✗") + " " + c.test);
    console.log("    " + c.detail);
  }
  console.log(`\nPassed: ${passed}/${checks.length}`);

  // Merge into existing report JSON
  const reportPath = path.join(OUT_DIR, "report.json");
  let report: Record<string, unknown> = {};
  try { report = JSON.parse(readFileSync(reportPath, "utf8")); } catch { /* new */ }

  const dbGroup = { "DB — Integration tests (bypass HTTP auth)": checks };
  const existingGroups = (report.groups as Record<string, unknown>) ?? {};
  report.groups = { ...existingGroups, ...dbGroup };
  report.dbTests = { total: checks.length, passed, failed: failed.length };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nMerged into: ${reportPath}`);

  if (failed.length > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

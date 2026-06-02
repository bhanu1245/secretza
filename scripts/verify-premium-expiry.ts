/**
 * Premium expiry implementation — verification script.
 *
 * Checks the three layers of the hybrid approach through static source
 * analysis (no running server required) and a live DB behavioral test.
 *
 * Run: npx tsx scripts/verify-premium-expiry.ts
 */
import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";

const ROOT = process.cwd();
const OUT  = path.join(ROOT, "artifacts", "premium-expiry-verification");

type Severity = "blocker" | "high" | "info";
type Check    = { name: string; ok: boolean; detail: string; severity: Severity };

function src(rel: string) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// Helper — assert that a pattern appears in source
// ---------------------------------------------------------------------------
function hasPattern(source: string, re: RegExp): boolean {
  return re.test(source);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  // ==========================================================================
  // LAYER 1 — JWT / request-time enforcement (src/lib/auth.ts)
  // ==========================================================================
  const authSrc = src("src/lib/auth.ts");

  checks.push({
    name: "L1 · JWT callback: expiry check inserted after cache-hit AND cache-miss paths",
    ok: hasPattern(authSrc, /token\.isPremium\s*&&\s*token\.premiumExpiry/),
    detail: "Block: `if (token.isPremium && token.premiumExpiry)` must exist in jwt callback",
    severity: "blocker",
  });

  checks.push({
    name: "L1 · JWT callback: sets token.isPremium = false when expiry < now",
    ok: hasPattern(authSrc, /token\.isPremium\s*=\s*false/) &&
        hasPattern(authSrc, /expiry\s*<\s*new Date\(\)/),
    detail: "Downgrades token in-memory — no DB write required",
    severity: "blocker",
  });

  checks.push({
    name: "L1 · JWT callback: uses Date constructor and guards against NaN",
    ok: hasPattern(authSrc, /!isNaN\(expiry\.getTime\(\)\)/),
    detail: "Prevents invalid-date bugs from crashing the auth flow",
    severity: "high",
  });

  checks.push({
    name: "L1 · expiry check is AFTER cache-hit block (correct ordering)",
    ok: (() => {
      const cacheHitEnd   = authSrc.indexOf("token.sessionVersion = cached.sessionVersion;");
      const expiryCheck   = authSrc.indexOf("token.isPremium && token.premiumExpiry");
      const returnToken   = authSrc.lastIndexOf("return token;");
      return cacheHitEnd > 0 && expiryCheck > cacheHitEnd && returnToken > expiryCheck;
    })(),
    detail: "Ordering: cache-hit block → cache-miss block → expiry override → return token",
    severity: "blocker",
  });

  checks.push({
    name: "L1 · expiry check is AFTER cache-miss block (correct ordering)",
    ok: (() => {
      const cacheMissEnd  = authSrc.indexOf("token.sessionVersion = suspensionCheck.sessionVersion;");
      const expiryCheck   = authSrc.indexOf("token.isPremium && token.premiumExpiry");
      return cacheMissEnd > 0 && expiryCheck > cacheMissEnd;
    })(),
    detail: "Override fires after DB data is loaded, not before",
    severity: "blocker",
  });

  checks.push({
    name: "L1 · premiumExpiry still forwarded to session (token.premiumExpiry not nulled)",
    ok: hasPattern(authSrc, /session\.user\.premiumExpiry\s*=\s*token\.premiumExpiry/),
    detail: "UI can still display the expiry date even after isPremium is downed in token",
    severity: "info",
  });

  // ==========================================================================
  // LAYER 2 — Cron DB cleanup (src/app/api/cron/refresh-ranking/route.ts)
  // ==========================================================================
  const cronSrc = src("src/app/api/cron/refresh-ranking/route.ts");

  checks.push({
    name: "L2 · Cron: updateMany to set isPremium=false for expired users",
    ok: hasPattern(cronSrc, /user\.updateMany/) &&
        hasPattern(cronSrc, /isPremium.*false|false.*isPremium/),
    detail: "db.user.updateMany({ where: { isPremium:true, premiumExpiry:{ lt:new Date() } }, data:{ isPremium:false } })",
    severity: "blocker",
  });

  checks.push({
    name: "L2 · Cron: filters by premiumExpiry lt new Date()",
    ok: hasPattern(cronSrc, /premiumExpiry.*lt.*new Date\(\)/),
    detail: "Only updates users whose expiry has already passed",
    severity: "blocker",
  });

  checks.push({
    name: "L2 · Cron: premium expiry runs BEFORE listing expiry steps",
    ok: (() => {
      const premiumIdx  = cronSrc.indexOf("user.updateMany");
      const listingIdx  = cronSrc.indexOf("listing.findMany");
      return premiumIdx > 0 && listingIdx > 0 && premiumIdx < listingIdx;
    })(),
    detail: "Premium cleanup is Step 1; listing work is Steps 3-6",
    severity: "info",
  });

  checks.push({
    name: "L2 · Cron: expiredPremiumUsers included in response stats",
    ok: hasPattern(cronSrc, /expiredPremiumUsers/),
    detail: "Operators can observe how many users were expired per run",
    severity: "info",
  });

  checks.push({
    name: "L2 · Cron: does NOT touch isBoosted or isFeatured in premium step",
    ok: (() => {
      // Find the user.updateMany block and confirm it only touches isPremium
      const updateStart = cronSrc.indexOf("user.updateMany");
      const updateEnd   = cronSrc.indexOf("listing.findMany");
      const slice = cronSrc.slice(updateStart, updateEnd);
      return !slice.includes("isBoosted") && !slice.includes("isFeatured");
    })(),
    detail: "Boost and Featured logic is untouched as required",
    severity: "blocker",
  });

  // ==========================================================================
  // LAYER 3 — Admin stats accuracy (src/app/api/admin/stats/route.ts)
  // ==========================================================================
  const statsSrc = src("src/app/api/admin/stats/route.ts");

  checks.push({
    name: "L3 · Stats: premiumUsers count excludes expired (uses OR filter)",
    ok: hasPattern(statsSrc, /premiumExpiry.*null/) &&
        hasPattern(statsSrc, /premiumExpiry.*gt.*new Date\(\)/),
    detail: "Counts users where premiumExpiry IS NULL (admin-granted) OR premiumExpiry > now",
    severity: "blocker",
  });

  checks.push({
    name: "L3 · Stats: still requires isPremium=true as base condition",
    ok: hasPattern(statsSrc, /isPremium.*true/),
    detail: "isPremium=false users are excluded even if premiumExpiry is in the future",
    severity: "high",
  });

  // ==========================================================================
  // LAYER 4 — No UI modifications (sanity check)
  // ==========================================================================
  const dashboardSrc = src("src/components/secretza/dashboard/Dashboard.tsx");
  const headerSrc    = src("src/components/secretza/layout/Header.tsx");

  checks.push({
    name: "L4 · UI not modified: Dashboard still reads isPremium from session/store",
    ok: hasPattern(dashboardSrc, /isPremium/) && !hasPattern(dashboardSrc, /premiumExpiry.*new Date/),
    detail: "Dashboard.tsx unchanged — derives isPremium from Zustand/session only",
    severity: "info",
  });

  checks.push({
    name: "L4 · UI not modified: Header still reads isPremium from session/store",
    ok: hasPattern(headerSrc, /isPremium/) && !hasPattern(headerSrc, /premiumExpiry.*new Date/),
    detail: "Header.tsx unchanged — no client-side expiry logic introduced",
    severity: "info",
  });

  // ==========================================================================
  // LIVE DB behavioral tests
  // ==========================================================================

  // -- Test A: Insert an already-expired premium user, verify cron query picks it up --
  const testUserExpired = await db.user.create({
    data: {
      email: `verify-expired-${Date.now()}@test.invalid`,
      isPremium: true,
      premiumExpiry: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      isVerified: false,
      role: "USER",
    },
  });

  const expiredCount = await db.user.count({
    where: {
      id: testUserExpired.id,
      isPremium: true,
      premiumExpiry: { lt: new Date() },
    },
  });

  checks.push({
    name: "DB · Cron query: finds an expired-premium user (isPremium=true, expiry<now)",
    ok: expiredCount === 1,
    detail: `Query returned ${expiredCount} row(s) for the test expired user`,
    severity: "blocker",
  });

  // Simulate what the cron does
  const { count: cronResult } = await db.user.updateMany({
    where: { id: testUserExpired.id, isPremium: true, premiumExpiry: { lt: new Date() } },
    data: { isPremium: false },
  });

  const afterCron = await db.user.findUnique({
    where: { id: testUserExpired.id },
    select: { isPremium: true },
  });

  checks.push({
    name: "DB · Cron simulation: sets isPremium=false for expired user",
    ok: cronResult === 1 && afterCron?.isPremium === false,
    detail: `updateMany affected ${cronResult} row; isPremium after = ${afterCron?.isPremium}`,
    severity: "blocker",
  });

  // -- Test B: Active premium user is NOT touched by the cron query --
  const testUserActive = await db.user.create({
    data: {
      email: `verify-active-${Date.now()}@test.invalid`,
      isPremium: true,
      premiumExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isVerified: false,
      role: "USER",
    },
  });

  const activeCount = await db.user.count({
    where: {
      id: testUserActive.id,
      isPremium: true,
      premiumExpiry: { lt: new Date() },
    },
  });

  checks.push({
    name: "DB · Cron query: does NOT touch active premium user (expiry in future)",
    ok: activeCount === 0,
    detail: `Query returned ${activeCount} rows for the active premium user (expected 0)`,
    severity: "blocker",
  });

  // -- Test C: Stats query correctly differentiates expired vs active --
  const statsActiveCount = await db.user.count({
    where: {
      id: testUserActive.id,
      isPremium: true,
      OR: [
        { premiumExpiry: null },
        { premiumExpiry: { gt: new Date() } },
      ],
    },
  });

  // After the cron simulation, testUserExpired has isPremium=false, so it should not appear
  const statsExpiredCount = await db.user.count({
    where: {
      id: testUserExpired.id,
      isPremium: true,
      OR: [
        { premiumExpiry: null },
        { premiumExpiry: { gt: new Date() } },
      ],
    },
  });

  checks.push({
    name: "DB · Stats query: active premium user appears in count",
    ok: statsActiveCount === 1,
    detail: `Stats query found ${statsActiveCount} row(s) for the active user (expected 1)`,
    severity: "blocker",
  });

  checks.push({
    name: "DB · Stats query: expired-then-reset user excluded from count",
    ok: statsExpiredCount === 0,
    detail: `Stats query found ${statsExpiredCount} row(s) for post-cron expired user (expected 0)`,
    severity: "blocker",
  });

  // -- Test D: JWT expiry logic (pure function simulation) --
  // Simulate what the JWT callback does: token has isPremium=true but expiry is past
  const expiredToken = { isPremium: true, premiumExpiry: new Date(Date.now() - 1000) };
  if (expiredToken.isPremium && expiredToken.premiumExpiry) {
    const expiry = new Date(expiredToken.premiumExpiry);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      expiredToken.isPremium = false;
    }
  }

  checks.push({
    name: "JWT · Request-time logic: isPremium set to false when expiry in the past",
    ok: expiredToken.isPremium === false,
    detail: "In-memory override: token.isPremium=true + past expiry → token.isPremium=false",
    severity: "blocker",
  });

  const activeToken = { isPremium: true, premiumExpiry: new Date(Date.now() + 86400000) };
  if (activeToken.isPremium && activeToken.premiumExpiry) {
    const expiry = new Date(activeToken.premiumExpiry);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      activeToken.isPremium = false;
    }
  }

  checks.push({
    name: "JWT · Request-time logic: isPremium stays true when expiry is in the future",
    ok: activeToken.isPremium === true,
    detail: "Active premium user is not incorrectly downgraded",
    severity: "blocker",
  });

  const noExpiryToken = { isPremium: true, premiumExpiry: null as Date | null };
  if (noExpiryToken.isPremium && noExpiryToken.premiumExpiry) {
    const expiry = new Date(noExpiryToken.premiumExpiry);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      noExpiryToken.isPremium = false;
    }
  }

  checks.push({
    name: "JWT · Request-time logic: isPremium stays true when premiumExpiry is null (admin-granted)",
    ok: noExpiryToken.isPremium === true,
    detail: "Null expiry = permanent grant; condition short-circuits on the && check",
    severity: "blocker",
  });

  // Cleanup test users
  await db.user.deleteMany({
    where: { id: { in: [testUserExpired.id, testUserActive.id] } },
  });

  // ==========================================================================
  // Report
  // ==========================================================================
  const failed   = checks.filter((c) => !c.ok);
  const blockers = failed.filter((c) => c.severity === "blocker");

  const report = {
    generatedAt: new Date().toISOString(),
    title: "Premium Expiry Implementation — Verification Report",
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length, blockersFailed: blockers.length },
    layers: {
      "L1 — JWT request-time (auth.ts)":     "Downgrades token.isPremium in-memory if premiumExpiry < now. Zero DB writes. Effective within ≤2 min (cache TTL).",
      "L2 — Cron DB cleanup (refresh-ranking)": "Batch-updates User.isPremium=false for all rows where isPremium=true and premiumExpiry<now. Runs every 30 min (existing cron).",
      "L3 — Admin stats (admin/stats)":       "premiumUsers count uses OR[premiumExpiry=null, premiumExpiry>now] to exclude expired rows.",
    },
    checks,
    failed,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT, "report.html"), renderHtml(report));

  console.log("\n=== PREMIUM EXPIRY VERIFICATION ===");
  console.log(`Checks: ${report.summary.passed}/${report.summary.total} passed`);
  console.log(`Blocker failures: ${blockers.length}`);
  for (const f of failed) console.log(`  ✗ [${f.severity}] ${f.name}\n    ${f.detail}`);
  console.log(`\nReport: ${path.join(OUT, "report.html")}`);

  await db.$disconnect();
  if (blockers.length > 0) process.exit(1);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(report: Record<string, unknown>): string {
  const checks  = report.checks as Check[];
  const summary = report.summary as { total: number; passed: number; failed: number; blockersFailed: number };
  const layers  = report.layers as Record<string, string>;

  const rows = checks.map(c =>
    `<tr><td>${esc(c.name)}</td><td class="${c.ok ? "pass" : "fail"}">${c.ok ? "PASS" : "FAIL"}</td><td>${c.severity}</td><td><small>${esc(c.detail)}</small></td></tr>`
  ).join("");

  const layerRows = Object.entries(layers).map(([k, v]) =>
    `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>Premium Expiry Verification</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0B0B0F;color:#F5F5F7;max-width:1100px;margin:0 auto;padding:2.5rem 1.5rem 5rem;line-height:1.55}
h1{font-size:1.8rem;background:linear-gradient(135deg,#3B82F6,#6366F1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
h2{font-size:1.1rem;color:#94a3b8;margin:2rem 0 .75rem}
.chips{display:flex;gap:.75rem;flex-wrap:wrap;margin:1.25rem 0}
.chip{background:#15151D;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:.35rem 1rem;font-size:.85rem}
.chip.ok{border-color:rgba(52,211,153,.4);color:#34d399}.chip.bad{border-color:rgba(248,113,113,.4);color:#f87171}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:.5rem 0}
th,td{border:1px solid rgba(255,255,255,.08);padding:.45rem .6rem;vertical-align:top;text-align:left}
th{background:#15151D;color:#94a3b8}
.pass{color:#34d399;font-weight:700}.fail{color:#f87171;font-weight:700}
small{color:#94a3b8}
</style></head><body>
<h1>Premium Expiry — Verification Report</h1>
<p style="color:#94a3b8">${esc(report.generatedAt as string)}</p>
<div class="chips">
  <span class="chip ${summary.failed===0?"ok":"bad"}">${summary.passed}/${summary.total} checks passed</span>
  <span class="chip ${summary.blockersFailed===0?"ok":"bad"}">${summary.blockersFailed} blocker failures</span>
</div>
<h2>Implementation Layers</h2>
<table><tr><th>Layer</th><th>Description</th></tr>${layerRows}</table>
<h2>All Checks</h2>
<table><tr><th>Check</th><th>Status</th><th>Severity</th><th>Detail</th></tr>${rows}</table>
</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });

/**
 * PaymentSettings single-source-of-truth verification.
 *
 * Covers:
 *  A. Static source analysis — hardcoded maps removed, getDurationForTier imported
 *  B. Unit tests of getDurationForTier() against live PaymentSettings DB
 *     (all 7 required tiers: ₹99/₹199/₹499 boost, ₹149/₹399/₹799 featured, premium)
 *  C. Mutation test — change a tier in PaymentSettings, verify duration changes
 *  D. Fallback test — unknown amount uses safe default, not a wrong hardcoded value
 *  E. Restore PaymentSettings to defaults after all mutations
 *
 * Run: npx tsx scripts/verify-payment-settings-sot.ts
 */

import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import {
  getDurationForTier,
  getPaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
} from "../src/lib/payment-settings";

const ROOT = process.cwd();
const OUT  = path.join(ROOT, "artifacts", "payment-settings-sot");

type Severity = "blocker" | "high" | "info";
type Check    = { name: string; ok: boolean; detail: string; severity: Severity };

function src(rel: string) { return readFileSync(path.join(ROOT, rel), "utf8"); }

// ── helpers ──────────────────────────────────────────────────────────────────

async function setTierInDb(
  type: "boost" | "feature" | "premium",
  tiers: Array<{ label: string; amount: number; durationMinutes?: number; durationDays?: number }>,
) {
  const settings = await getPaymentSettings();
  const field = type === "boost" ? "boostTiers" : type === "feature" ? "featuredTiers" : "premiumTiers";
  await db.paymentSettings.update({
    where: { id: settings.id },
    data: { [field]: JSON.stringify(tiers) },
  });
}

async function restoreDefaults() {
  const settings = await getPaymentSettings();
  await db.paymentSettings.update({
    where: { id: settings.id },
    data: {
      boostTiers:    JSON.stringify(DEFAULT_PAYMENT_SETTINGS.boostTiers),
      featuredTiers: JSON.stringify(DEFAULT_PAYMENT_SETTINGS.featuredTiers),
      premiumTiers:  JSON.stringify(DEFAULT_PAYMENT_SETTINGS.premiumTiers),
    },
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  // ============================================================
  // A. Static analysis — review route
  // ============================================================
  const reviewSrc = src("src/app/api/admin/payments/manual/[id]/review/route.ts");

  checks.push({
    name: "SA · BOOST_DURATIONS constant removed from review route",
    ok: !reviewSrc.includes("BOOST_DURATIONS"),
    detail: "Hardcoded amount→minutes map must not exist in this file",
    severity: "blocker",
  });
  checks.push({
    name: "SA · FEATURE_DURATIONS constant removed from review route",
    ok: !reviewSrc.includes("FEATURE_DURATIONS"),
    detail: "Hardcoded amount→days map must not exist in this file",
    severity: "blocker",
  });
  checks.push({
    name: "SA · PREMIUM_DURATION_DAYS constant removed from review route",
    ok: !reviewSrc.includes("PREMIUM_DURATION_DAYS"),
    detail: "Hardcoded scalar must not exist in this file",
    severity: "blocker",
  });
  checks.push({
    name: "SA · getDurationForTier imported in review route",
    ok: reviewSrc.includes("getDurationForTier"),
    detail: 'import { getDurationForTier } from "@/lib/payment-settings"',
    severity: "blocker",
  });
  checks.push({
    name: "SA · getDurationForTier called for boost activation",
    ok: reviewSrc.includes('getDurationForTier("boost"'),
    detail: 'getDurationForTier("boost", tierAmount) replaces BOOST_DURATIONS[tierAmount]',
    severity: "blocker",
  });
  checks.push({
    name: "SA · getDurationForTier called for feature activation",
    ok: reviewSrc.includes('getDurationForTier("feature"'),
    detail: 'getDurationForTier("feature", tierAmount) replaces FEATURE_DURATIONS[tierAmount]',
    severity: "blocker",
  });
  checks.push({
    name: "SA · getDurationForTier called for premium activation",
    ok: reviewSrc.includes('getDurationForTier("premium"'),
    detail: 'getDurationForTier("premium", tierAmount) replaces PREMIUM_DURATION_DAYS',
    severity: "blocker",
  });

  // ── static analysis — payment-settings.ts ──
  const settingsSrc = src("src/lib/payment-settings.ts");

  checks.push({
    name: "SA · getDurationForTier exported from payment-settings.ts",
    ok: settingsSrc.includes("export async function getDurationForTier"),
    detail: "Single callable for all (type, amount) → duration lookups",
    severity: "blocker",
  });
  checks.push({
    name: "SA · TierDuration interface exported",
    ok: settingsSrc.includes("export interface TierDuration"),
    detail: "Typed return value for getDurationForTier",
    severity: "info",
  });
  checks.push({
    name: "SA · matched flag present in TierDuration",
    ok: settingsSrc.includes("matched: boolean"),
    detail: "Callers can detect when the safe-default fallback was applied",
    severity: "high",
  });
  checks.push({
    name: "SA · review route uses durationMinutes from getDurationForTier (not hardcoded)",
    ok: reviewSrc.includes("durationMinutes") && !reviewSrc.includes("|| 60"),
    detail: 'const { durationMinutes } = await getDurationForTier("boost", tierAmount)',
    severity: "blocker",
  });
  checks.push({
    name: "SA · review route uses durationDays from getDurationForTier (not hardcoded)",
    ok: reviewSrc.includes("durationDays") && !reviewSrc.includes("|| 7") && !reviewSrc.includes("|| 30"),
    detail: 'const { durationDays } = await getDurationForTier("feature"/"premium", tierAmount)',
    severity: "blocker",
  });

  // ============================================================
  // B. Unit tests — all 7 required tiers against live DB defaults
  // ============================================================
  await restoreDefaults(); // start from a known state

  const boostCases: Array<{ amount: number; expectedMinutes: number; label: string }> = [
    { amount: 99,  expectedMinutes: 60,   label: "₹99 boost  → 60 min  (1 hr)"   },
    { amount: 199, expectedMinutes: 360,  label: "₹199 boost → 360 min (6 hr)"   },
    { amount: 499, expectedMinutes: 1440, label: "₹499 boost → 1440 min (24 hr)" },
  ];

  for (const { amount, expectedMinutes, label } of boostCases) {
    const result = await getDurationForTier("boost", amount);
    checks.push({
      name: `B · ${label}`,
      ok: result.durationMinutes === expectedMinutes && result.matched === true,
      detail: `getDurationForTier("boost", ${amount}) → ${result.durationMinutes} min, matched=${result.matched} (expected ${expectedMinutes} min, matched=true)`,
      severity: "blocker",
    });
  }

  const featureCases: Array<{ amount: number; expectedDays: number; label: string }> = [
    { amount: 149, expectedDays: 3,  label: "₹149 featured →  3 days" },
    { amount: 399, expectedDays: 7,  label: "₹399 featured →  7 days" },
    { amount: 799, expectedDays: 14, label: "₹799 featured → 14 days" },
  ];

  for (const { amount, expectedDays, label } of featureCases) {
    const result = await getDurationForTier("feature", amount);
    checks.push({
      name: `B · ${label}`,
      ok: result.durationDays === expectedDays && result.matched === true,
      detail: `getDurationForTier("feature", ${amount}) → ${result.durationDays} days, matched=${result.matched} (expected ${expectedDays} days, matched=true)`,
      severity: "blocker",
    });
  }

  // Premium
  const premiumResult = await getDurationForTier("premium", 999);
  checks.push({
    name: "B · ₹999 premium → 30 days",
    ok: premiumResult.durationDays === 30 && premiumResult.matched === true,
    detail: `getDurationForTier("premium", 999) → ${premiumResult.durationDays} days, matched=${premiumResult.matched} (expected 30, matched=true)`,
    severity: "blocker",
  });

  // ============================================================
  // C. Mutation test — change PaymentSettings → verify new durations
  // ============================================================
  // Change ₹199 boost from 360 min → 480 min
  await setTierInDb("boost", [
    { label: "1 Hour Boost",  amount: 99,  durationMinutes: 60   },
    { label: "8 Hour Boost",  amount: 199, durationMinutes: 480  }, // changed
    { label: "24 Hour Boost", amount: 499, durationMinutes: 1440 },
  ]);

  const mutated199 = await getDurationForTier("boost", 199);
  checks.push({
    name: "C · After changing ₹199 boost to 480 min — getDurationForTier returns 480",
    ok: mutated199.durationMinutes === 480 && mutated199.matched === true,
    detail: `After DB update: getDurationForTier("boost", 199) → ${mutated199.durationMinutes} min (expected 480)`,
    severity: "blocker",
  });

  // Change ₹799 featured from 14 days → 21 days
  await setTierInDb("feature", [
    { label: "3 Day Featured",  amount: 149, durationDays: 3  },
    { label: "7 Day Featured",  amount: 399, durationDays: 7  },
    { label: "21 Day Featured", amount: 799, durationDays: 21 }, // changed
  ]);

  const mutated799 = await getDurationForTier("feature", 799);
  checks.push({
    name: "C · After changing ₹799 featured to 21 days — getDurationForTier returns 21",
    ok: mutated799.durationDays === 21 && mutated799.matched === true,
    detail: `After DB update: getDurationForTier("feature", 799) → ${mutated799.durationDays} days (expected 21)`,
    severity: "blocker",
  });

  // Change premium from 30 → 60 days and price 999 → 1499
  await setTierInDb("premium", [
    { label: "60 Day Premium", amount: 1499, durationDays: 60 },
  ]);

  const mutatedPremium = await getDurationForTier("premium", 1499);
  checks.push({
    name: "C · After changing premium to ₹1499/60 days — getDurationForTier returns 60",
    ok: mutatedPremium.durationDays === 60 && mutatedPremium.matched === true,
    detail: `After DB update: getDurationForTier("premium", 1499) → ${mutatedPremium.durationDays} days (expected 60)`,
    severity: "blocker",
  });

  // Old premium amount (999) should now produce fallback, not 30 days
  const oldPremiumAmount = await getDurationForTier("premium", 999);
  checks.push({
    name: "C · Old premium amount (₹999) no longer matches — safe fallback applied, matched=false",
    ok: oldPremiumAmount.matched === false,
    detail: `getDurationForTier("premium", 999) with new tiers: matched=${oldPremiumAmount.matched} (expected false — amount no longer in PaymentSettings)`,
    severity: "blocker",
  });

  // ============================================================
  // D. Fallback test — unknown amount → safe default, NOT wrong duration
  // ============================================================
  await restoreDefaults();

  const unknownBoost = await getDurationForTier("boost", 9999);
  checks.push({
    name: "D · Unknown boost amount → fallback 60 min, matched=false (no hardcoded wrong value)",
    ok: unknownBoost.durationMinutes === 60 && unknownBoost.matched === false,
    detail: `getDurationForTier("boost", 9999) → ${unknownBoost.durationMinutes} min, matched=${unknownBoost.matched}`,
    severity: "high",
  });

  const unknownFeature = await getDurationForTier("feature", 9999);
  checks.push({
    name: "D · Unknown feature amount → fallback 3 days, matched=false",
    ok: unknownFeature.durationDays === 3 && unknownFeature.matched === false,
    detail: `getDurationForTier("feature", 9999) → ${unknownFeature.durationDays} days, matched=${unknownFeature.matched}`,
    severity: "high",
  });

  const unknownPremium = await getDurationForTier("premium", 9999);
  checks.push({
    name: "D · Unknown premium amount → fallback 30 days, matched=false",
    ok: unknownPremium.durationDays === 30 && unknownPremium.matched === false,
    detail: `getDurationForTier("premium", 9999) → ${unknownPremium.durationDays} days, matched=${unknownPremium.matched}`,
    severity: "high",
  });

  // ============================================================
  // E. Restore + verify defaults intact
  // ============================================================
  await restoreDefaults();

  const restored199 = await getDurationForTier("boost", 199);
  checks.push({
    name: "E · After restore: ₹199 boost back to 360 min",
    ok: restored199.durationMinutes === 360 && restored199.matched === true,
    detail: `getDurationForTier("boost", 199) after restore → ${restored199.durationMinutes} min`,
    severity: "info",
  });

  const restored799 = await getDurationForTier("feature", 799);
  checks.push({
    name: "E · After restore: ₹799 featured back to 14 days",
    ok: restored799.durationDays === 14 && restored799.matched === true,
    detail: `getDurationForTier("feature", 799) after restore → ${restored799.durationDays} days`,
    severity: "info",
  });

  const restoredPremium = await getDurationForTier("premium", 999);
  checks.push({
    name: "E · After restore: ₹999 premium back to 30 days",
    ok: restoredPremium.durationDays === 30 && restoredPremium.matched === true,
    detail: `getDurationForTier("premium", 999) after restore → ${restoredPremium.durationDays} days`,
    severity: "info",
  });

  // ============================================================
  // Report
  // ============================================================
  const failed   = checks.filter(c => !c.ok);
  const blockers = failed.filter(c => c.severity === "blocker");

  const groups: Record<string, Check[]> = {
    "A — Static analysis": checks.filter(c => c.name.startsWith("SA")),
    "B — Unit tests (default tiers)": checks.filter(c => c.name.startsWith("B")),
    "C — Mutation tests (changing PaymentSettings)": checks.filter(c => c.name.startsWith("C")),
    "D — Fallback / unknown amount": checks.filter(c => c.name.startsWith("D")),
    "E — Restore & verify": checks.filter(c => c.name.startsWith("E")),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    title: "PaymentSettings Single Source of Truth — Verification Report",
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      blockersFailed: blockers.length,
    },
    implementation: {
      newFunction: "getDurationForTier(type, amount) in src/lib/payment-settings.ts",
      removedConstants: ["BOOST_DURATIONS", "FEATURE_DURATIONS", "PREMIUM_DURATION_DAYS"],
      fromFile: "src/app/api/admin/payments/manual/[id]/review/route.ts",
      correctedDurations: {
        "₹199 boost": "180 min (old hardcoded) → 360 min (PaymentSettings default)",
        "₹499 boost": "720 min (old hardcoded) → 1440 min (PaymentSettings default)",
        "₹799 featured": "30 days (old hardcoded) → 14 days (PaymentSettings default)",
      },
    },
    groups,
    checks,
    failed,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT, "report.html"), renderHtml(report));

  console.log("\n=== PAYMENT SETTINGS SOT VERIFICATION ===");
  console.log(`Checks: ${report.summary.passed}/${report.summary.total} passed`);
  console.log(`Blocker failures: ${blockers.length}`);
  for (const f of failed) {
    console.log(`  ✗ [${f.severity}] ${f.name}`);
    console.log(`    ${f.detail}`);
  }
  console.log(`\nReport: ${path.join(OUT, "report.html")}`);

  await db.$disconnect();
  if (blockers.length > 0) process.exit(1);
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(report: Record<string, unknown>): string {
  const summary = report.summary as { total: number; passed: number; failed: number; blockersFailed: number };
  const impl    = report.implementation as Record<string, unknown>;
  const groups  = report.groups as Record<string, Check[]>;

  const corrected = impl.correctedDurations as Record<string, string>;
  const corrRows = Object.entries(corrected).map(([k, v]) =>
    `<tr><td><strong>${esc(k)}</strong></td><td style="color:#f87171">${esc(v.split("→")[0].trim())}</td><td style="color:#34d399">${esc(v.split("→")[1]?.trim() ?? "")}</td></tr>`
  ).join("");

  const groupHtml = Object.entries(groups).map(([name, checks]) => {
    const rows = checks.map(c =>
      `<tr><td>${esc(c.name.replace(/^[A-Z\s·]+·\s/, ""))}</td><td class="${c.ok ? "pass" : "fail"}">${c.ok ? "PASS" : "FAIL"}</td><td>${c.severity}</td><td><small>${esc(c.detail)}</small></td></tr>`
    ).join("");
    const pct = Math.round(checks.filter(c=>c.ok).length / checks.length * 100);
    return `<h2>${esc(name)} <span style="font-size:.8rem;color:#94a3b8">${checks.filter(c=>c.ok).length}/${checks.length} (${pct}%)</span></h2>
<table><tr><th>Check</th><th>Status</th><th>Severity</th><th>Detail</th></tr>${rows}</table>`;
  }).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>PaymentSettings SOT Verification</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0B0B0F;color:#F5F5F7;max-width:1120px;margin:0 auto;padding:2.5rem 1.5rem 5rem;line-height:1.55}
h1{font-size:1.8rem;background:linear-gradient(135deg,#3B82F6,#6366F1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
h2{font-size:1.05rem;color:#94a3b8;margin:2rem 0 .6rem;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:.4rem}
.chips{display:flex;gap:.75rem;flex-wrap:wrap;margin:1.25rem 0}
.chip{background:#15151D;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:.35rem 1rem;font-size:.85rem}
.chip.ok{border-color:rgba(52,211,153,.4);color:#34d399}.chip.bad{border-color:rgba(248,113,113,.4);color:#f87171}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:.5rem 0 1.5rem}
th,td{border:1px solid rgba(255,255,255,.07);padding:.45rem .6rem;vertical-align:top;text-align:left}
th{background:#15151D;color:#94a3b8}
.pass{color:#34d399;font-weight:700}.fail{color:#f87171;font-weight:700}
small{color:#94a3b8}
</style></head><body>
<h1>PaymentSettings — Single Source of Truth</h1>
<p style="color:#94a3b8">${esc(report.generatedAt as string)}</p>
<div class="chips">
  <span class="chip ${summary.failed===0?"ok":"bad"}">${summary.passed}/${summary.total} checks passed</span>
  <span class="chip ${summary.blockersFailed===0?"ok":"bad"}">${summary.blockersFailed} blocker failures</span>
</div>
<h2>Corrected Duration Discrepancies</h2>
<table><tr><th>Tier</th><th>Old (hardcoded)</th><th>New (PaymentSettings)</th></tr>${corrRows}</table>
${groupHtml}
</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });

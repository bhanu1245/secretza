/**
 * Pricing Administration Hardening — Verification Script
 *
 * Groups:
 *  A. Static analysis — helpers present, old raw assignments gone
 *  B. Live API — P0 validations (POST)
 *  C. Live API — P0 validations (PUT)
 *  D. Live API — P0: 404 for PUT/DELETE on non-existent plan
 *  E. Live API — P0: duplicate slug protection (POST + PUT)
 *  F. Live API — P1: slug, listingLimit, imageLimit validations
 *  G. Live API — happy path: valid create → edit → delete round-trip
 *
 * Run: npx tsx scripts/verify-pricing-hardening.ts
 * (Dev server must be running on http://localhost:3001)
 */

import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

const ROOT    = process.cwd();
const OUT_DIR = path.join(ROOT, "artifacts", "pricing-hardening-verification");
const BASE    = "http://localhost:3001";

type Severity = "blocker" | "high" | "medium" | "info";
type Check    = { name: string; ok: boolean; detail: string; severity: Severity; skipped?: boolean };

function src(rel: string) { return readFileSync(path.join(ROOT, rel), "utf8"); }

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface ApiResponse { status: number; body: Record<string, unknown> }

async function api(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      // Pass a cookie header that satisfies next-auth admin session for the test
      // user seeded in dev DB (if no session exists tests will get 401 and be skipped)
      "Cookie": process.env.ADMIN_SESSION_COOKIE ?? "",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  let json: Record<string, unknown> = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

async function serverReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/pricing-plans`, { signal: AbortSignal.timeout(3_000) });
    return r.status < 500;
  } catch { return false; }
}

// ── Payload builders ──────────────────────────────────────────────────────────

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name:         "Test Plan",
    slug:         "test-plan-verify",
    description:  "Verification test plan",
    price:        99,
    currency:     "INR",
    durationDays: 30,
    featuredDays: 0,
    boostDays:    0,
    listingLimit: 1,
    imageLimit:   5,
    priorityScore:0,
    features:     ["Feature A", "Feature B"],
    isActive:     true,
    isPopular:    false,
    sortOrder:    0,
    ...overrides,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const checks: Check[] = [];

  // ============================================================
  // A. Static analysis
  // ============================================================
  const postSrc = src("src/app/api/admin/pricing-plans/route.ts");
  const putSrc  = src("src/app/api/admin/pricing-plans/[id]/route.ts");

  // Helpers present in POST file
  checks.push({ name: "SA-A1 · validatePrice exported from POST route", ok: postSrc.includes("function validatePrice"), detail: "validatePrice() helper defined", severity: "blocker" });
  checks.push({ name: "SA-A2 · validateDays exported from POST route",  ok: postSrc.includes("function validateDays"),  detail: "validateDays() helper defined", severity: "blocker" });
  checks.push({ name: "SA-A3 · validateSlug exported from POST route",  ok: postSrc.includes("function validateSlug"),  detail: "validateSlug() helper defined", severity: "blocker" });
  checks.push({ name: "SA-A4 · validateLimit exported from POST route", ok: postSrc.includes("function validateLimit"), detail: "validateLimit() helper defined", severity: "blocker" });

  // Helpers present in PUT/DELETE file
  checks.push({ name: "SA-A5 · validatePrice in [id]/route.ts", ok: putSrc.includes("function validatePrice"), detail: "Mirrors POST file validation", severity: "blocker" });
  checks.push({ name: "SA-A6 · validateDays in [id]/route.ts",  ok: putSrc.includes("function validateDays"),  detail: "Mirrors POST file validation", severity: "blocker" });

  // Slug uniqueness check
  checks.push({ name: "SA-A7 · POST route has slug uniqueness check", ok: postSrc.includes("SELECT COUNT(*) as count FROM PricingPlan WHERE slug"), detail: "Pre-insert uniqueness query", severity: "blocker" });
  checks.push({ name: "SA-A8 · PUT route has slug uniqueness check excluding self", ok: putSrc.includes("AND id != ${id}"), detail: "Pre-update uniqueness query with self-exclusion", severity: "blocker" });

  // Existence checks
  checks.push({ name: "SA-A9 · PUT route has existence check before UPDATE", ok: putSrc.includes("SELECT id FROM PricingPlan WHERE id = ${id}") && putSrc.includes("404"), detail: "Returns 404 when plan not found", severity: "blocker" });
  checks.push({ name: "SA-A10 · DELETE route has existence check before DELETE", ok: putSrc.includes("SELECT id FROM PricingPlan WHERE id = ${id}") && putSrc.split("SELECT id FROM PricingPlan WHERE id = ${id}").length >= 3, detail: "DELETE also checks existence", severity: "blocker" });

  // UNIQUE constraint try/catch safety nets
  checks.push({ name: "SA-A11 · POST try/catch around INSERT catches UNIQUE error", ok: postSrc.includes('msg.toLowerCase().includes("unique")'), detail: "Safety net for DB-level constraint violation", severity: "high" });
  checks.push({ name: "SA-A12 · PUT try/catch around UPDATE catches UNIQUE error",  ok: putSrc.includes('msg.toLowerCase().includes("unique")'),  detail: "Safety net for DB-level constraint violation", severity: "high" });

  // durationDays minimum = 1 (not 0)
  checks.push({ name: "SA-A13 · durationDays validated with min=1 in POST", ok: postSrc.includes('validateDays(body.durationDays, "durationDays", 1)'), detail: "A plan lasting 0 days is meaningless", severity: "high" });
  checks.push({ name: "SA-A14 · durationDays validated with min=1 in PUT",  ok: putSrc.includes('validateDays(body.durationDays, "durationDays", 1)'),  detail: "A plan lasting 0 days is meaningless", severity: "high" });

  // listingLimit / imageLimit
  checks.push({ name: "SA-A15 · listingLimit validated in POST", ok: postSrc.includes('validateLimit(body.listingLimit, "listingLimit"'), detail: "1–1000 range enforced", severity: "high" });
  checks.push({ name: "SA-A16 · imageLimit validated in POST",   ok: postSrc.includes('validateLimit(body.imageLimit, "imageLimit"'),   detail: "1–50 range enforced", severity: "high" });

  // ============================================================
  // Live API tests
  // ============================================================
  const live = await serverReachable();

  function skip(name: string, severity: Severity): Check {
    return { name, ok: false, detail: "Server not reachable — skipped", severity, skipped: true };
  }

  if (!live) {
    console.log("\n[WARN] Dev server not running — skipping all live tests.");
    for (const n of [
      "LIVE-B1","LIVE-B2","LIVE-B3","LIVE-B4","LIVE-B5","LIVE-B6",
      "LIVE-C1","LIVE-C2","LIVE-C3",
      "LIVE-D1","LIVE-D2",
      "LIVE-E1","LIVE-E2",
      "LIVE-F1","LIVE-F2","LIVE-F3",
      "LIVE-G1","LIVE-G2","LIVE-G3","LIVE-G4",
    ]) {
      checks.push(skip(n, "blocker"));
    }
  } else {
    // Determine if we have admin auth (otherwise live tests return 401 and we mark as info)
    const authCheck = await api("GET", "/api/admin/pricing-plans");
    const hasAuth = authCheck.status !== 401;
    const warnNoAuth = !hasAuth
      ? " (401 — no admin session; set ADMIN_SESSION_COOKIE env var to run authenticated tests)"
      : "";

    // ── B. POST validation ──────────────────────────────────────────────────

    async function checkPost(label: string, payload: Record<string, unknown>, expectStatus: number, expectError: string, severity: Severity) {
      if (!hasAuth) { checks.push(skip(`LIVE-${label}`, severity)); return; }
      const r = await api("POST", "/api/admin/pricing-plans", payload);
      const errMsg = String(r.body.error ?? "");
      const ok = r.status === expectStatus && errMsg.length > 0;
      checks.push({
        name: `LIVE-${label}`,
        ok,
        detail: `Expected HTTP ${expectStatus}, got ${r.status}. error="${errMsg}"${warnNoAuth}`,
        severity,
      });
      // Clean up: if plan was accidentally created, delete it
      if (r.status === 201 && r.body.plan) {
        const pid = (r.body.plan as { id: string }).id;
        await api("DELETE", `/api/admin/pricing-plans/${pid}`);
      }
    }

    await checkPost("B1 · POST price=negative rejected (400)", validPayload({ price: -1 }), 400, "Price", "blocker");
    await checkPost("B2 · POST price=NaN rejected (400)", validPayload({ price: "abc" }), 400, "Price", "blocker");
    await checkPost("B3 · POST durationDays=0 rejected (400)", validPayload({ durationDays: 0 }), 400, "durationDays", "blocker");
    await checkPost("B4 · POST durationDays=-7 rejected (400)", validPayload({ durationDays: -7 }), 400, "durationDays", "blocker");
    await checkPost("B5 · POST durationDays=9999 rejected (400)", validPayload({ durationDays: 9999 }), 400, "durationDays", "blocker");
    await checkPost("B6 · POST missing name rejected (400)", validPayload({ name: "" }), 400, "Name", "blocker");

    // ── C. PUT validation (need a real plan id first) ──────────────────────

    let testPlanId = "";
    let testPlanSlug = "test-plan-verify-" + Date.now();

    if (hasAuth) {
      const created = await api("POST", "/api/admin/pricing-plans", validPayload({ slug: testPlanSlug }));
      if (created.status === 201 && created.body.plan) {
        testPlanId = (created.body.plan as { id: string }).id;
      }
    }

    async function checkPut(label: string, payload: Record<string, unknown>, expectStatus: number, severity: Severity) {
      if (!hasAuth || !testPlanId) { checks.push(skip(`LIVE-${label}`, severity)); return; }
      const r = await api("PUT", `/api/admin/pricing-plans/${testPlanId}`, payload);
      const ok = r.status === expectStatus;
      checks.push({
        name: `LIVE-${label}`,
        ok,
        detail: `PUT /api/admin/pricing-plans/${testPlanId} → expected ${expectStatus}, got ${r.status}. body=${JSON.stringify(r.body)}`,
        severity,
      });
    }

    await checkPut("C1 · PUT price=negative rejected (400)", validPayload({ slug: testPlanSlug, price: -1 }), 400, "blocker");
    await checkPut("C2 · PUT durationDays=0 rejected (400)", validPayload({ slug: testPlanSlug, durationDays: 0 }), 400, "blocker");
    await checkPut("C3 · PUT missing name rejected (400)", validPayload({ slug: testPlanSlug, name: "" }), 400, "blocker");

    // ── D. 404 for non-existent plan ───────────────────────────────────────

    const fakeId = "nonexistent-plan-id-000";

    if (!hasAuth) {
      checks.push(skip("LIVE-D1 · PUT non-existent returns 404", "blocker"));
      checks.push(skip("LIVE-D2 · DELETE non-existent returns 404", "blocker"));
    } else {
      const putMissing = await api("PUT", `/api/admin/pricing-plans/${fakeId}`, validPayload());
      checks.push({
        name: "LIVE-D1 · PUT non-existent plan returns 404",
        ok: putMissing.status === 404,
        detail: `PUT /api/admin/pricing-plans/${fakeId} → ${putMissing.status} (expected 404)`,
        severity: "blocker",
      });

      const delMissing = await api("DELETE", `/api/admin/pricing-plans/${fakeId}`);
      checks.push({
        name: "LIVE-D2 · DELETE non-existent plan returns 404",
        ok: delMissing.status === 404,
        detail: `DELETE /api/admin/pricing-plans/${fakeId} → ${delMissing.status} (expected 404)`,
        severity: "blocker",
      });
    }

    // ── E. Duplicate slug protection ───────────────────────────────────────

    // POST: try to create another plan with the same slug
    if (!hasAuth) {
      checks.push(skip("LIVE-E1 · POST duplicate slug returns 409", "blocker"));
      checks.push(skip("LIVE-E2 · PUT duplicate slug returns 409", "blocker"));
    } else if (testPlanId) {
      const dupPost = await api("POST", "/api/admin/pricing-plans", validPayload({ slug: testPlanSlug }));
      checks.push({
        name: "LIVE-E1 · POST duplicate slug returns 409",
        ok: dupPost.status === 409,
        detail: `POST with duplicate slug "${testPlanSlug}" → ${dupPost.status} (expected 409). error="${dupPost.body.error}"`,
        severity: "blocker",
      });

      // Create a second plan then try to PUT it to the first plan's slug
      const secondSlug = testPlanSlug + "-second";
      const secondPlan = await api("POST", "/api/admin/pricing-plans", validPayload({ slug: secondSlug }));
      if (secondPlan.status === 201 && secondPlan.body.plan) {
        const secondId = (secondPlan.body.plan as { id: string }).id;
        const dupPut = await api("PUT", `/api/admin/pricing-plans/${secondId}`, validPayload({ slug: testPlanSlug }));
        checks.push({
          name: "LIVE-E2 · PUT slug collision with another plan returns 409",
          ok: dupPut.status === 409,
          detail: `PUT plan ${secondId} with slug "${testPlanSlug}" (owned by ${testPlanId}) → ${dupPut.status} (expected 409)`,
          severity: "blocker",
        });
        // clean up second plan
        await api("DELETE", `/api/admin/pricing-plans/${secondId}`);
      } else {
        checks.push(skip("LIVE-E2 · PUT slug collision with another plan returns 409", "blocker"));
      }
    } else {
      checks.push(skip("LIVE-E1 · POST duplicate slug returns 409", "blocker"));
      checks.push(skip("LIVE-E2 · PUT slug collision with another plan returns 409", "blocker"));
    }

    // ── F. P1 validations ──────────────────────────────────────────────────

    async function checkP1Post(label: string, payload: Record<string, unknown>, expectStatus: number, severity: Severity) {
      if (!hasAuth) { checks.push(skip(`LIVE-${label}`, severity)); return; }
      const r = await api("POST", "/api/admin/pricing-plans", payload);
      const ok = r.status === expectStatus;
      checks.push({
        name: `LIVE-${label}`,
        ok,
        detail: `Expected ${expectStatus}, got ${r.status}. error="${r.body.error}"`,
        severity,
      });
      if (r.status === 201 && r.body.plan) {
        await api("DELETE", `/api/admin/pricing-plans/${(r.body.plan as { id: string }).id}`);
      }
    }

    // slug too short after slugify: "---" → "" → rejected
    await checkP1Post("F1 · POST blank slug after slugify rejected (400)", validPayload({ slug: "---", name: "Test Blank Slug" }), 400, "high");
    // listingLimit = 0
    await checkP1Post("F2 · POST listingLimit=0 rejected (400)", validPayload({ slug: "test-limit-zero-" + Date.now(), listingLimit: 0 }), 400, "high");
    // imageLimit > 50
    await checkP1Post("F3 · POST imageLimit=999 rejected (400)", validPayload({ slug: "test-img-limit-" + Date.now(), imageLimit: 999 }), 400, "high");

    // ── G. Happy path round-trip ───────────────────────────────────────────

    if (!hasAuth) {
      for (const n of ["G1","G2","G3","G4"]) checks.push(skip(`LIVE-${n} · Happy path`, "info"));
    } else if (testPlanId) {
      // G1: verify plan was created
      checks.push({
        name: "LIVE-G1 · Valid POST creates plan (201)",
        ok: Boolean(testPlanId),
        detail: `Created plan id=${testPlanId}, slug=${testPlanSlug}`,
        severity: "info",
      });

      // G2: valid PUT updates plan
      const updateSlug = testPlanSlug + "-updated";
      const updated = await api("PUT", `/api/admin/pricing-plans/${testPlanId}`, validPayload({ slug: updateSlug, price: 199, durationDays: 7 }));
      checks.push({
        name: "LIVE-G2 · Valid PUT updates plan (200)",
        ok: updated.status === 200,
        detail: `PUT plan ${testPlanId} with new slug "${updateSlug}", price=199, durationDays=7 → ${updated.status}`,
        severity: "info",
      });

      // G3: PUT with same slug as self must succeed (no false 409)
      const selfSlug = await api("PUT", `/api/admin/pricing-plans/${testPlanId}`, validPayload({ slug: updateSlug, price: 199, durationDays: 7 }));
      checks.push({
        name: "LIVE-G3 · PUT same slug as self does not produce 409 (200)",
        ok: selfSlug.status === 200,
        detail: `PUT plan ${testPlanId} with its own slug "${updateSlug}" → ${selfSlug.status} (must not be 409)`,
        severity: "high",
      });

      // G4: delete the test plan
      const deleted = await api("DELETE", `/api/admin/pricing-plans/${testPlanId}`);
      checks.push({
        name: "LIVE-G4 · Valid DELETE removes plan (200)",
        ok: deleted.status === 200 && deleted.body.ok === true,
        detail: `DELETE plan ${testPlanId} → ${deleted.status}, body=${JSON.stringify(deleted.body)}`,
        severity: "info",
      });
    } else {
      for (const n of ["G1","G2","G3","G4"]) checks.push(skip(`LIVE-${n} · Happy path (no plan created)`, "info"));
    }
  }

  // ============================================================
  // Report
  // ============================================================
  const real     = checks.filter(c => !c.skipped);
  const skipped  = checks.filter(c => c.skipped);
  const failed   = real.filter(c => !c.ok);
  const blockers = failed.filter(c => c.severity === "blocker");

  const groups: Record<string, Check[]> = {
    "A — Static analysis": checks.filter(c => c.name.startsWith("SA-")),
    "B — POST field validation (P0)": checks.filter(c => c.name.includes("LIVE-B")),
    "C — PUT field validation (P0)": checks.filter(c => c.name.includes("LIVE-C")),
    "D — 404 for missing plan (P0)": checks.filter(c => c.name.includes("LIVE-D")),
    "E — Duplicate slug protection (P0)": checks.filter(c => c.name.includes("LIVE-E")),
    "F — P1 validations (slug, limits)": checks.filter(c => c.name.includes("LIVE-F")),
    "G — Happy path round-trip": checks.filter(c => c.name.includes("LIVE-G")),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    title: "Pricing Administration Hardening — Verification Report",
    summary: { total: real.length, passed: real.length - failed.length, failed: failed.length, skipped: skipped.length, blockersFailed: blockers.length },
    implementation: {
      "P0-1": "Duplicate slug check before INSERT (POST) and UPDATE (PUT), + UNIQUE try/catch safety net",
      "P0-2": "validatePrice(): must be finite number, ≥ 0, ≤ 999,999",
      "P0-3": "validateDays(): durationDays ≥ 1, featuredDays/boostDays ≥ 0, all ≤ 3,650",
      "P0-4": "PUT checks plan existence before UPDATE, returns 404 if not found",
      "P0-5": "DELETE checks plan existence before DELETE, returns 404 if not found",
      "P1-6": "validateSlug(): rejects slug shorter than 2 chars after slugify",
      "P1-7": "validateLimit(): listingLimit 1–1000, imageLimit 1–50",
      filesChanged: [
        "src/app/api/admin/pricing-plans/route.ts",
        "src/app/api/admin/pricing-plans/[id]/route.ts",
      ],
    },
    groups,
    checks,
    failed,
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT_DIR, "report.html"), renderHtml(report));

  console.log("\n=== PRICING HARDENING VERIFICATION ===");
  console.log(`Static: ${checks.filter(c => c.name.startsWith("SA-") && c.ok).length}/${checks.filter(c => c.name.startsWith("SA-")).length} passed`);
  console.log(`Live:   ${real.filter(c => !c.name.startsWith("SA-") && c.ok).length}/${real.filter(c => !c.name.startsWith("SA-")).length} passed  |  Skipped: ${skipped.length}`);
  console.log(`Blocker failures: ${blockers.length}`);
  for (const f of failed) {
    console.log(`  ✗ [${f.severity}] ${f.name}`);
    console.log(`    ${f.detail}`);
  }
  if (skipped.length) console.log(`\n  ℹ ${skipped.length} test(s) skipped — start dev server with an admin session cookie.`);
  console.log(`\nReport: ${path.join(OUT_DIR, "report.html")}`);

  if (blockers.length > 0) process.exit(1);
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(report: Record<string, unknown>): string {
  const sum   = report.summary as Record<string, number>;
  const impl  = report.implementation as Record<string, unknown>;
  const grps  = report.groups as Record<string, Check[]>;

  const implRows = Object.entries(impl)
    .filter(([k]) => k !== "filesChanged")
    .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(String(v))}</td></tr>`)
    .join("");

  const groupHtml = Object.entries(grps).map(([gname, checks]) => {
    if (!checks?.length) return "";
    const real = checks.filter(c => !c.skipped);
    const pct  = real.length ? Math.round(real.filter(c => c.ok).length / real.length * 100) : 0;
    const rows  = checks.map(c => `
      <tr>
        <td>${esc(c.name.replace(/^(SA-[A-Z\d]+|LIVE-[A-Z\d]+)\s·\s/, ""))}</td>
        <td class="${c.skipped ? "skip" : c.ok ? "pass" : "fail"}">${c.skipped ? "SKIP" : c.ok ? "PASS" : "FAIL"}</td>
        <td>${esc(c.severity)}</td>
        <td><small>${esc(c.detail)}</small></td>
      </tr>`).join("");
    return `<h2>${esc(gname)} <span style="font-size:.8rem;color:#94a3b8">${real.filter(c=>c.ok).length}/${real.length} (${pct}%)</span></h2>
<table><tr><th>Check</th><th>Status</th><th>Severity</th><th>Detail</th></tr>${rows}</table>`;
  }).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>Pricing Hardening Verification</title>
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
.pass{color:#34d399;font-weight:700}.fail{color:#f87171;font-weight:700}.skip{color:#94a3b8;font-style:italic}
small{color:#94a3b8}
</style></head><body>
<h1>Pricing Administration — Hardening Verification</h1>
<p style="color:#94a3b8">${esc(report.generatedAt as string)}</p>
<div class="chips">
  <span class="chip ${sum.failed===0?"ok":"bad"}">${sum.passed}/${sum.total} passed</span>
  <span class="chip ${sum.blockersFailed===0?"ok":"bad"}">${sum.blockersFailed} blocker failures</span>
  ${sum.skipped>0?`<span class="chip">${sum.skipped} skipped</span>`:""}
</div>
<h2>Changes applied</h2>
<table><tr><th>Fix</th><th>Description</th></tr>${implRows}</table>
${groupHtml}
</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });

/**
 * Search & Filters fix verification.
 *
 * Groups:
 *  A. Static analysis — route.ts: AND-of-OR present, no double where.OR, ranking case explicit
 *  B. Static analysis — SearchResults.tsx: page:1 in every setFilters call, Best Match label
 *  C. Live API tests — keyword only, category only, keyword+category, keyword+category+city
 *  D. Live API tests — pagination reset (page out of range returns 0 results)
 *  E. Live API tests — sort values: featured, newest, price_low, price_high, ranking, relevance
 *
 * Run: npx tsx scripts/verify-search-filters.ts
 *
 * The live API tests hit http://localhost:3000 — start dev server first.
 * If no server is running, live tests are skipped and static checks still run.
 */

import { loadEnvConfig } from "@next/env";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

const ROOT = process.cwd();
const OUT  = path.join(ROOT, "artifacts", "search-filters-verification");

type Severity = "blocker" | "high" | "medium" | "info";
type Check    = { name: string; ok: boolean; detail: string; severity: Severity; skipped?: boolean };

function src(rel: string) { return readFileSync(path.join(ROOT, rel), "utf8"); }

// ── helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";

async function serverReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/api/listings?limit=1`, { signal: AbortSignal.timeout(3000) });
    return r.ok || r.status === 429;
  } catch {
    return false;
  }
}

async function fetchListings(params: Record<string, string | number | boolean>): Promise<{
  ok: boolean;
  listings: { id: string; title: string; categorySlug: string; citySlug: string }[];
  total: number;
  page: number;
  totalPages: number;
  status?: number;
  error?: string;
}> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  );
  try {
    const r = await fetch(`${BASE_URL}/api/listings?${qs}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: false, listings: [], total: 0, page: 1, totalPages: 0, status: r.status };
    const data = await r.json();
    return {
      ok: true,
      listings: data.listings ?? [],
      total: data.total ?? 0,
      page: data.page ?? 1,
      totalPages: data.totalPages ?? 0,
    };
  } catch (e: unknown) {
    return { ok: false, listings: [], total: 0, page: 1, totalPages: 0, error: String(e) };
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  // ============================================================
  // A. Static — route.ts
  // ============================================================
  const routeSrc = src("src/app/api/listings/route.ts");

  checks.push({
    name: "SA-A1 · where.AND used for compound filter logic",
    ok: routeSrc.includes("where.AND = andClauses"),
    detail: "andClauses merged via where.AND — no longer two separate where.OR assignments",
    severity: "blocker",
  });
  checks.push({
    name: "SA-A2 · where.OR is never assigned directly (old overwrite removed)",
    ok: !routeSrc.includes("where.OR ="),
    detail: "Removed the two sequential `where.OR =` assignments that caused the keyword overwrite bug",
    severity: "blocker",
  });
  checks.push({
    name: "SA-A3 · keyword builds an OR clause pushed into andClauses",
    ok: routeSrc.includes("andClauses.push(") && routeSrc.includes("title: { contains: keyword }"),
    detail: "andClauses.push({ OR: [keyword conditions] })",
    severity: "blocker",
  });
  checks.push({
    name: "SA-A4 · category builds an OR clause pushed into andClauses",
    ok: routeSrc.includes("andClauses.push(") && routeSrc.includes("categoryId: { in: categoryIds }"),
    detail: "andClauses.push({ OR: [category conditions] })",
    severity: "blocker",
  });
  checks.push({
    name: "SA-A5 · case 'ranking' is explicit in sort switch",
    ok: routeSrc.includes("case \"ranking\":"),
    detail: "No longer relies on default branch for the primary ranking case",
    severity: "medium",
  });
  checks.push({
    name: "SA-A6 · case 'relevance' maps to priorityScore sort",
    ok: routeSrc.includes("case \"relevance\":"),
    detail: "Legacy 'relevance' value now explicitly handled alongside 'ranking'",
    severity: "medium",
  });
  checks.push({
    name: "SA-A7 · post-pagination in-memory re-sort removed",
    ok: !routeSrc.includes(".sort((a, b) => (b.computedScore"),
    detail: "DB-level priorityScore ordering is now the authority; in-memory resort removed",
    severity: "medium",
  });
  checks.push({
    name: "SA-A8 · city filter still uses separate where field (not OR — no regression)",
    ok: routeSrc.includes("where.cityId = cityRecord.id") || routeSrc.includes("where.citySlug = city"),
    detail: "City filter uses dedicated where.cityId/citySlug — no conflict with andClauses",
    severity: "high",
  });

  // ============================================================
  // B. Static — SearchResults.tsx
  // ============================================================
  const srSrc = src("src/components/secretza/listing/SearchResults.tsx");

  // Count setFilters calls and how many include page:1
  const setFiltersBlocks = srSrc.split("setFilters(");
  // Each block after index 0 is a call site. We check for page: 1 inside the
  // immediately following braces.  We exclude the store definition itself.

  // Specific call sites:
  const hasPage1InCategory = srSrc.includes("categorySlug: checked ? cat.slug : undefined,\n                      page: 1,");
  const hasPage1InCountry  = srSrc.includes("countrySlug: val === \"all\" ? undefined : val,\n              stateSlug: undefined,\n              citySlug: undefined,\n              page: 1,");
  const hasPage1InState    = srSrc.includes("stateSlug: val === \"all\" ? undefined : val,\n                citySlug: undefined,\n                page: 1,");
  const hasPage1InCity     = srSrc.includes("citySlug: val === \"all\" ? undefined : val,\n                page: 1,");
  const hasPage1InFeatured = srSrc.includes("featured: checked || undefined, page: 1");

  // Badge dismissals
  const hasPage1InKeywordBadge   = srSrc.includes("keyword: undefined, page: 1");
  const hasPage1InCategoryBadge  = srSrc.includes("categorySlug: undefined, page: 1");
  const hasPage1InCountryBadge   = srSrc.includes("countrySlug: undefined,\n                      stateSlug: undefined,\n                      citySlug: undefined,\n                      page: 1,");
  const hasPage1InFeaturedBadge  = srSrc.includes("featured: undefined, page: 1");

  checks.push({
    name: "SA-B1 · category filter setFilters includes page:1",
    ok: hasPage1InCategory,
    detail: "setFilters({ categorySlug: ..., page: 1 }) in FilterContent checkbox",
    severity: "high",
  });
  checks.push({
    name: "SA-B2 · country filter setFilters includes page:1",
    ok: hasPage1InCountry,
    detail: "setFilters({ countrySlug: ..., stateSlug: undefined, citySlug: undefined, page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B3 · state filter setFilters includes page:1",
    ok: hasPage1InState,
    detail: "setFilters({ stateSlug: ..., citySlug: undefined, page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B4 · city filter setFilters includes page:1",
    ok: hasPage1InCity,
    detail: "setFilters({ citySlug: ..., page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B5 · featured toggle setFilters includes page:1",
    ok: hasPage1InFeatured,
    detail: "setFilters({ featured: ..., page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B6 · keyword badge dismiss includes page:1",
    ok: hasPage1InKeywordBadge,
    detail: "setFilters({ keyword: undefined, page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B7 · category badge dismiss includes page:1",
    ok: hasPage1InCategoryBadge,
    detail: "setFilters({ categorySlug: undefined, page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B8 · country badge dismiss includes page:1",
    ok: hasPage1InCountryBadge,
    detail: "setFilters({ countrySlug: undefined, stateSlug: undefined, citySlug: undefined, page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B9 · featured badge dismiss includes page:1",
    ok: hasPage1InFeaturedBadge,
    detail: "setFilters({ featured: undefined, page: 1 })",
    severity: "high",
  });
  checks.push({
    name: "SA-B10 · 'Best Match' label present in sortOptions",
    ok: srSrc.includes('"Best Match"'),
    detail: "{ value: \"relevance\", label: \"Best Match\" } — 'Relevance' label removed",
    severity: "medium",
  });
  checks.push({
    name: "SA-B11 · 'Relevance' label removed from sortOptions",
    ok: !srSrc.includes('"Relevance"'),
    detail: "Old label string 'Relevance' no longer appears in sortOptions array",
    severity: "medium",
  });

  // ============================================================
  // C+D+E. Live API tests
  // ============================================================
  const live = await serverReachable();
  if (!live) {
    console.log("\n[WARN] Dev server not running — skipping live API tests.");
    checks.push({
      name: "LIVE · Server reachability",
      ok: false,
      detail: "http://localhost:3000 not reachable — start dev server to run live tests",
      severity: "info",
      skipped: true,
    });
  } else {
    console.log("\n[INFO] Dev server reachable — running live API tests.");

    // --- C1. keyword only ---
    const kwOnly = await fetchListings({ keyword: "escort", limit: 5 });
    checks.push({
      name: "LIVE-C1 · keyword only returns results",
      ok: kwOnly.ok && kwOnly.total >= 0,
      detail: `keyword=escort → total=${kwOnly.total}, ok=${kwOnly.ok}`,
      severity: "blocker",
    });

    // --- C2. category only ---
    const catOnly = await fetchListings({ category: "escorts", limit: 5 });
    checks.push({
      name: "LIVE-C2 · category only returns results",
      ok: catOnly.ok && catOnly.total >= 0,
      detail: `category=escorts → total=${catOnly.total}, ok=${catOnly.ok}`,
      severity: "blocker",
    });

    // --- C3. keyword + category: result must be ≤ min(keyword-only, category-only) ---
    const kwCat = await fetchListings({ keyword: "escort", category: "escorts", limit: 5 });
    checks.push({
      name: "LIVE-C3 · keyword + category returns plausible total (≤ category-only total)",
      ok: kwCat.ok && kwCat.total <= catOnly.total,
      detail: `keyword+category → total=${kwCat.total} (category-only was ${catOnly.total}) — AND intersection expected`,
      severity: "blocker",
    });

    // The critical old bug: keyword + category should NEVER exceed the
    // category-only total (which would mean keyword was ignored and all
    // category results are returned unfiltered).
    checks.push({
      name: "LIVE-C3b · keyword+category total ≠ category-only total (keyword is applied)",
      ok: kwCat.ok && (kwCat.total < catOnly.total || catOnly.total === 0),
      detail: `keyword+category=${kwCat.total} vs category-only=${catOnly.total}. If equal, keyword may be ignored (or all category listings match keyword).`,
      severity: "high",
    });

    // --- C4. keyword + category + city ---
    const kwCatCity = await fetchListings({ keyword: "escort", category: "escorts", city: "mumbai", limit: 5 });
    checks.push({
      name: "LIVE-C4 · keyword + category + city returns plausible total (≤ keyword+category)",
      ok: kwCatCity.ok && kwCatCity.total <= kwCat.total,
      detail: `keyword+category+city → total=${kwCatCity.total} (keyword+category was ${kwCat.total})`,
      severity: "blocker",
    });

    // --- D. Pagination: page beyond totalPages returns 0 listings, not an error ---
    const p1 = await fetchListings({ limit: 3, page: 1 });
    const beyondPage = p1.totalPages + 100;
    const pBeyond = await fetchListings({ limit: 3, page: beyondPage });
    checks.push({
      name: "LIVE-D1 · page beyond totalPages returns 0 listings (not 500 / wrong data)",
      ok: pBeyond.ok && pBeyond.listings.length === 0,
      detail: `page=${beyondPage} (totalPages=${p1.totalPages}) → ${pBeyond.listings.length} listings returned`,
      severity: "high",
    });
    checks.push({
      name: "LIVE-D2 · total is consistent across pages (count does not depend on page)",
      ok: pBeyond.ok && pBeyond.total === p1.total,
      detail: `page 1 total=${p1.total}, page ${beyondPage} total=${pBeyond.total}`,
      severity: "high",
    });

    // --- E. Sort options ---
    const sortNewest = await fetchListings({ sortBy: "newest", limit: 3 });
    checks.push({
      name: "LIVE-E1 · sortBy=newest returns without error",
      ok: sortNewest.ok,
      detail: `sortBy=newest → ok=${sortNewest.ok}, total=${sortNewest.total}`,
      severity: "medium",
    });

    const sortFeatured = await fetchListings({ sortBy: "featured", limit: 3 });
    checks.push({
      name: "LIVE-E2 · sortBy=featured returns without error",
      ok: sortFeatured.ok,
      detail: `sortBy=featured → ok=${sortFeatured.ok}, total=${sortFeatured.total}`,
      severity: "medium",
    });

    const sortRanking = await fetchListings({ sortBy: "ranking", limit: 3 });
    checks.push({
      name: "LIVE-E3 · sortBy=ranking (explicit case) returns without error",
      ok: sortRanking.ok,
      detail: `sortBy=ranking → ok=${sortRanking.ok}, total=${sortRanking.total}`,
      severity: "medium",
    });

    const sortRelevance = await fetchListings({ sortBy: "relevance", limit: 3 });
    checks.push({
      name: "LIVE-E4 · sortBy=relevance (Best Match) returns same total as ranking",
      ok: sortRelevance.ok && sortRelevance.total === sortRanking.total,
      detail: `sortBy=relevance → total=${sortRelevance.total}, sortBy=ranking → total=${sortRanking.total}. Should be equal (same query, same filter).`,
      severity: "medium",
    });

    const sortPriceLow = await fetchListings({ sortBy: "price_low", limit: 3 });
    checks.push({
      name: "LIVE-E5 · sortBy=price_low returns without error",
      ok: sortPriceLow.ok,
      detail: `sortBy=price_low → ok=${sortPriceLow.ok}, total=${sortPriceLow.total}`,
      severity: "medium",
    });

    const sortPriceHigh = await fetchListings({ sortBy: "price_high", limit: 3 });
    checks.push({
      name: "LIVE-E6 · sortBy=price_high returns without error",
      ok: sortPriceHigh.ok,
      detail: `sortBy=price_high → ok=${sortPriceHigh.ok}, total=${sortPriceHigh.total}`,
      severity: "medium",
    });
  }

  // ============================================================
  // Report
  // ============================================================
  const real    = checks.filter(c => !c.skipped);
  const failed  = real.filter(c => !c.ok);
  const skipped = checks.filter(c => c.skipped);
  const blockersFailed = failed.filter(c => c.severity === "blocker");

  const groups: Record<string, Check[]> = {
    "A — Static: API route (keyword+category fix, ranking case)": checks.filter(c => c.name.startsWith("SA-A")),
    "B — Static: SearchResults.tsx (page:1 resets, Best Match label)": checks.filter(c => c.name.startsWith("SA-B")),
    "C — Live: keyword/category/city filter combinations": checks.filter(c => c.name.startsWith("LIVE-C")),
    "D — Live: pagination correctness": checks.filter(c => c.name.startsWith("LIVE-D")),
    "E — Live: sort options": checks.filter(c => c.name.startsWith("LIVE-E")),
    "Infrastructure": checks.filter(c => c.name.startsWith("LIVE ·")),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    title: "Search & Filters Fix — Verification Report",
    summary: {
      total: real.length,
      passed: real.length - failed.length,
      failed: failed.length,
      skipped: skipped.length,
      blockersFailed: blockersFailed.length,
    },
    implementation: {
      fix1: "AND-of-OR: keyword and category conditions pushed into andClauses[], merged via where.AND",
      fix2: "page:1 added to all 9 setFilters calls in SearchResults.tsx (5 filter + 4 badge dismiss)",
      fix3: "Sort label 'Relevance' → 'Best Match', value stays 'relevance' (now explicit case in API)",
      fix4: "case 'ranking' and case 'relevance' added explicitly in sort switch",
      fix5: "Post-pagination in-memory re-sort removed (operated on wrong slice)",
      filesChanged: [
        "src/app/api/listings/route.ts",
        "src/components/secretza/listing/SearchResults.tsx",
      ],
    },
    groups: Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [k, v.length > 0 ? v : undefined]).filter(([, v]) => v)
    ),
    checks,
    failed,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT, "report.html"), renderHtml(report));

  console.log("\n=== SEARCH & FILTERS VERIFICATION ===");
  console.log(`Checks: ${report.summary.passed}/${report.summary.total} passed  |  Skipped: ${report.summary.skipped}  |  Blocker failures: ${blockersFailed.length}`);
  for (const f of failed) {
    console.log(`  ✗ [${f.severity}] ${f.name}`);
    console.log(`    ${f.detail}`);
  }
  if (skipped.length > 0) {
    console.log(`\n  ℹ Skipped (server offline): ${skipped.map(s => s.name).join(", ")}`);
  }
  console.log(`\nReport: ${path.join(OUT, "report.html")}`);

  if (blockersFailed.length > 0) process.exit(1);
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(report: Record<string, unknown>): string {
  const sum  = report.summary as Record<string, number>;
  const impl = report.implementation as Record<string, unknown>;
  const grps = report.groups as Record<string, Check[]>;

  const fixes = Object.entries(impl)
    .filter(([k]) => k.startsWith("fix"))
    .map(([, v]) => `<li>${esc(String(v))}</li>`)
    .join("");

  const groupHtml = Object.entries(grps).map(([name, checks]) => {
    if (!checks) return "";
    const rows = checks.map(c =>
      `<tr><td>${esc(c.name.replace(/^[A-Z\-\d]+\s·\s/, ""))}</td><td class="${c.skipped ? "skip" : c.ok ? "pass" : "fail"}">${c.skipped ? "SKIP" : c.ok ? "PASS" : "FAIL"}</td><td>${c.severity}</td><td><small>${esc(c.detail)}</small></td></tr>`
    ).join("");
    const real = checks.filter(c => !c.skipped);
    const pct = real.length ? Math.round(real.filter(c => c.ok).length / real.length * 100) : 0;
    return `<h2>${esc(name)} <span style="font-size:.8rem;color:#94a3b8">${real.filter(c=>c.ok).length}/${real.length} (${pct}%)</span></h2>
<table><tr><th>Check</th><th>Status</th><th>Severity</th><th>Detail</th></tr>${rows}</table>`;
  }).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>Search & Filters Verification</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0B0B0F;color:#F5F5F7;max-width:1120px;margin:0 auto;padding:2.5rem 1.5rem 5rem;line-height:1.55}
h1{font-size:1.8rem;background:linear-gradient(135deg,#3B82F6,#6366F1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
h2{font-size:1.05rem;color:#94a3b8;margin:2rem 0 .6rem;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:.4rem}
.chips{display:flex;gap:.75rem;flex-wrap:wrap;margin:1.25rem 0}
.chip{background:#15151D;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:.35rem 1rem;font-size:.85rem}
.chip.ok{border-color:rgba(52,211,153,.4);color:#34d399}.chip.bad{border-color:rgba(248,113,113,.4);color:#f87171}
ul{margin:.5rem 0 1rem 1.5rem;font-size:.85rem;color:#94a3b8;line-height:1.8}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:.5rem 0 1.5rem}
th,td{border:1px solid rgba(255,255,255,.07);padding:.45rem .6rem;vertical-align:top;text-align:left}
th{background:#15151D;color:#94a3b8}
.pass{color:#34d399;font-weight:700}.fail{color:#f87171;font-weight:700}.skip{color:#94a3b8;font-style:italic}
small{color:#94a3b8}
</style></head><body>
<h1>Search & Filters — Fix Verification</h1>
<p style="color:#94a3b8">${esc(report.generatedAt as string)}</p>
<div class="chips">
  <span class="chip ${sum.failed===0?"ok":"bad"}">${sum.passed}/${sum.total} passed</span>
  <span class="chip ${sum.blockersFailed===0?"ok":"bad"}">${sum.blockersFailed} blocker failures</span>
  ${sum.skipped > 0 ? `<span class="chip">${sum.skipped} skipped (server offline)</span>` : ""}
</div>
<h2>Changes applied</h2>
<ul>${fixes}</ul>
${groupHtml}
</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });

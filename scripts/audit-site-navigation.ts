/**
 * Site-wide navigation audit — inventory + HTTP route verification.
 * Run: npx tsx scripts/audit-site-navigation.ts
 */
import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { ADMIN_NAV_ITEMS } from "../src/lib/admin-routes";
import {
  FOOTER_BROWSE_LINKS,
  FOOTER_COMPANY_LINKS,
  FOOTER_LOCATION_LINKS,
} from "../src/lib/footer-routes";

loadEnvConfig(process.cwd());

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "artifacts", "navigation-audit");
const SRC = path.join(process.cwd(), "src");

type CheckResult = {
  href: string;
  source: string;
  status: number | "skip" | "error";
  ok: boolean;
  note?: string;
};

type Report = {
  generatedAt: string;
  baseUrl: string;
  summary: {
    totalLinksChecked: number;
    passed: number;
    failed: number;
    placeholders: number;
    sourceInventory: {
      linkComponents: number;
      routerPush: number;
      anchorTags: number;
      navigateCalls: number;
    };
  };
  broken: CheckResult[];
  placeholders: { file: string; line: string; match: string }[];
  adminRoutes: CheckResult[];
  userFlow: CheckResult[];
  fixesApplied: string[];
};

function walkDir(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walkDir(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function scanSourceInventory() {
  const files = walkDir(SRC);
  let linkComponents = 0;
  let routerPush = 0;
  let anchorTags = 0;
  let navigateCalls = 0;
  const placeholders: { file: string; line: string; match: string }[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const rel = path.relative(process.cwd(), file);
    const lines = content.split("\n");

    linkComponents += (content.match(/<Link\b/g) || []).length;
    linkComponents += (content.match(/from\s+["']next\/link["']/g) || []).length > 0
      ? 0
      : 0;
    routerPush += (content.match(/router\.(push|replace)\(/g) || []).length;
    anchorTags += (content.match(/<a\b/g) || []).length;
    navigateCalls += (content.match(/navigate\s*\(/g) || []).length;

    lines.forEach((line, i) => {
      if (/href\s*=\s*["']#["']/.test(line) || /href\s*=\s*["']\s*["']/.test(line)) {
        placeholders.push({ file: rel, line: String(i + 1), match: line.trim().slice(0, 120) });
      }
    });
  }

  // Count Link from next/link imports more accurately
  linkComponents = 0;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    linkComponents += (content.match(/<Link[\s>]/g) || []).length;
  }

  return { linkComponents, routerPush, anchorTags, navigateCalls, placeholders, fileCount: files.length };
}

async function httpCheck(href: string, source: string): Promise<CheckResult> {
  if (href.startsWith("http") && !href.startsWith(BASE)) {
    return { href, source, status: "skip", ok: true, note: "external" };
  }
  const url = href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? href : `/${href}`}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ok = res.status >= 200 && res.status < 400;
    return { href, source, status: res.status, ok, note: ok ? undefined : res.statusText };
  } catch (e) {
    return { href, source, status: "error", ok: false, note: String(e) };
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const inventory = scanSourceInventory();

  const staticRoutes = [
    "/",
    "/create-listing",
    ...FOOTER_COMPANY_LINKS.map((l) => l.href),
    ...FOOTER_BROWSE_LINKS.map((l) => l.href),
    ...FOOTER_LOCATION_LINKS.map((l) => l.href),
    ...ADMIN_NAV_ITEMS.map((l) => l.href),
  ];

  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true },
    take: 5,
  });
  for (const c of categories) staticRoutes.push(`/category/${c.slug}`);

  const listings = await db.listing.findMany({
    where: { status: "approved" },
    select: { slug: true },
    take: 3,
  });
  for (const l of listings) staticRoutes.push(`/listing/${l.slug}`);

  const cities = await db.city.findMany({
    where: { isActive: true, isFeatured: true },
    include: { state: { include: { country: true } } },
    take: 3,
  });
  for (const city of cities) {
    if (city.state?.country) {
      staticRoutes.push(
        `/${city.state.country.slug}/${city.state.slug}/${city.slug}`
      );
    }
  }

  const cmsPages = await db.$queryRaw<Array<{ slug: string }>>`
    SELECT slug FROM CmsPage WHERE isPublished = 1 LIMIT 10
  `;
  for (const p of cmsPages) staticRoutes.push(`/cms/${p.slug}`);

  const uniqueRoutes = [...new Set(staticRoutes)];

  const checks: CheckResult[] = [];
  for (const href of uniqueRoutes) {
    const source =
      FOOTER_COMPANY_LINKS.find((l) => l.href === href)?.label ||
      FOOTER_BROWSE_LINKS.find((l) => l.href === href)?.name ||
      FOOTER_LOCATION_LINKS.find((l) => l.href === href)?.name ||
      ADMIN_NAV_ITEMS.find((l) => l.href === href)?.label ||
      "route";
    checks.push(await httpCheck(href, source));
    await new Promise((r) => setTimeout(r, 50));
  }

  const userFlowPaths = [
    { href: "/", source: "Homepage" },
    { href: FOOTER_BROWSE_LINKS[0]?.href || "/escorts", source: "Category" },
    { href: FOOTER_LOCATION_LINKS[0]?.href || "/mumbai", source: "City" },
    { href: listings[0] ? `/listing/${listings[0].slug}` : "/", source: "Listing" },
    { href: "/contact", source: "Contact" },
    { href: "/?view=pricing", source: "Pricing" },
    { href: "/create-listing", source: "Post Ad" },
    { href: "/?view=dashboard", source: "Dashboard" },
  ];

  const userFlow: CheckResult[] = [];
  for (const item of userFlowPaths) {
    userFlow.push(await httpCheck(item.href, item.source));
  }

  const adminRoutes = checks.filter((c) =>
    ADMIN_NAV_ITEMS.some((a) => a.href === c.href)
  );

  const broken = [...checks, ...userFlow].filter((c) => !c.ok && c.status !== "skip");
  const passed = checks.filter((c) => c.ok).length + userFlow.filter((c) => c.ok).length;

  const fixesApplied = [
    "src/lib/public-navigation.ts — unified SPA/SSR path mapping",
    "src/hooks/usePublicNavigation.ts — cross-route navigation hook",
    "src/components/secretza/layout/Header.tsx — real routes from CMS/SEO pages",
    "src/components/secretza/layout/MobileBottomNav.tsx — My Ads tab, cross-route nav",
    "src/components/secretza/listing/ListingCard.tsx — Link to /listing/[slug] on SSR pages",
    "src/app/listing/[slug]/page.tsx — breadcrumb fix + PublicSiteLayout",
    "src/app/create-listing/page.tsx — PublicSiteLayout shell",
    "src/app/page.tsx — SPA deep-link query param support",
    "src/components/secretza/geo/IndiaGeoExplorer.tsx — search result navigation",
    "src/app/api/geo/india/search/route.ts — return geo slugs for navigation",
  ];

  const report: Report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    summary: {
      totalLinksChecked: uniqueRoutes.length + userFlow.length,
      passed,
      failed: broken.length,
      placeholders: inventory.placeholders.length,
      sourceInventory: {
        linkComponents: inventory.linkComponents,
        routerPush: inventory.routerPush,
        anchorTags: inventory.anchorTags,
        navigateCalls: inventory.navigateCalls,
      },
    },
    broken,
    placeholders: inventory.placeholders,
    adminRoutes,
    userFlow,
    fixesApplied,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Navigation Audit</title>
<style>
body{font-family:system-ui;max-width:960px;margin:2rem auto;padding:0 1rem;background:#0a0a0f;color:#f5f5f7}
.pass{color:#34d399}.fail{color:#f87171}table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{border:1px solid #333;padding:.5rem;text-align:left;font-size:14px}
h1{color:#a78bfa}
</style></head><body>
<h1>Site-Wide Navigation Audit</h1>
<p>Generated: ${report.generatedAt}</p>
<p>Base: ${BASE} | Files scanned: ${inventory.fileCount}</p>
<h2>Summary</h2>
<ul>
<li>Total routes checked: ${report.summary.totalLinksChecked}</li>
<li>Passed: <span class="pass">${passed}</span></li>
<li>Failed: <span class="fail">${broken.length}</span></li>
<li>Placeholder hrefs in source: ${report.summary.placeholders}</li>
<li>Link components: ${inventory.linkComponents}</li>
<li>router.push/replace: ${inventory.routerPush}</li>
<li>navigate() calls: ${inventory.navigateCalls}</li>
</ul>
<h2>User Flow</h2>
<table><tr><th>Step</th><th>URL</th><th>Status</th></tr>
${userFlow.map((u) => `<tr><td>${u.source}</td><td>${u.href}</td><td class="${u.ok ? "pass" : "fail"}">${u.status}</td></tr>`).join("")}
</table>
<h2>Broken Routes</h2>
${broken.length === 0 ? "<p class='pass'>None</p>" : `<table><tr><th>URL</th><th>Source</th><th>Status</th><th>Note</th></tr>${broken.map((b) => `<tr><td>${b.href}</td><td>${b.source}</td><td>${b.status}</td><td>${b.note || ""}</td></tr>`).join("")}</table>`}
<h2>Fixes Applied</h2><ul>${fixesApplied.map((f) => `<li>${f}</li>`).join("")}</ul>
</body></html>`;

  writeFileSync(path.join(OUT, "report.html"), html);

  console.log("\n=== SITE NAVIGATION AUDIT ===");
  console.log(`Routes checked: ${report.summary.totalLinksChecked}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${broken.length}`);
  console.log(`Placeholder hrefs: ${report.summary.placeholders}`);
  console.log(`Report: ${path.join(OUT, "report.json")}`);

  if (broken.length > 0) {
    console.log("\nBroken:");
    for (const b of broken) console.log(`  ${b.status} ${b.href} (${b.source})`);
    process.exit(1);
  }
  console.log("\nPASS — all checked routes respond OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

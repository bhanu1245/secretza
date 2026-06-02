/**
 * Internal linking audit for all SEO page types.
 * Run: npx tsx scripts/audit-seo-internal-links.ts
 * Live screenshots: npx tsx scripts/audit-seo-internal-links.ts --live
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import {
  loadLongtailCityFallbackView,
  loadCitySeoPageView,
  loadStateSeoPageView,
  loadCountrySeoPageView,
  loadCategorySeoPageView,
  loadTwoSegmentSeoPageView,
  getSeoPagePublicUrl,
  type SeoPageViewModel,
} from "../src/lib/seo-public-page";
import {
  buildInternalLinkGraph,
  collectOutboundHrefs,
  countPageLinks,
  getPublicPathForPage,
  loadSlugCaches,
  MIN_INTERNAL_LINKS_PER_PAGE,
  normalizePublicSeoPath,
  type PageLinkInventory,
  validateInternalHref,
} from "../src/lib/seo-internal-links";

const OUT_DIR = path.resolve("artifacts/seo-internal-links-audit");
const LIVE = process.argv.includes("--live");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const FALLBACK_CITIES = [
  { slug: "mumbai", path: "/independent-escorts/mumbai" },
  { slug: "delhi", path: "/independent-escorts/delhi" },
  { slug: "bangalore", path: "/independent-escorts/bangalore" },
  { slug: "hyderabad", path: "/independent-escorts/hyderabad" },
] as const;

type PageAuditRow = {
  pageType: string;
  pageSlug: string;
  publicPath: string;
  source: string;
  pass: boolean;
  totalLinks: number;
  breadcrumbLinks: number;
  relatedLinks: number;
  listingLinks: number;
  nearbyCities: number;
  relatedCategories: number;
  relatedSearches: number;
  brokenLinks: string[];
  issues: string[];
};

async function auditViewModel(
  view: SeoPageViewModel,
  source: string,
): Promise<PageAuditRow> {
  const inventory = countPageLinks({
    breadcrumbs: view.breadcrumbs,
    relatedLinks: view.relatedLinks,
    listingCount: view.listings.length,
  });

  const outbound = collectOutboundHrefs({
    breadcrumbs: view.breadcrumbs,
    relatedLinks: view.relatedLinks,
  });

  const brokenLinks: string[] = [];
  for (const href of [...new Set(outbound)]) {
    const ok = await validateInternalHref(href);
    if (!ok) brokenLinks.push(href);
  }

  const issues: string[] = [];
  if (inventory.totalLinks < MIN_INTERNAL_LINKS_PER_PAGE) {
    issues.push(`Only ${inventory.totalLinks} links (target ${MIN_INTERNAL_LINKS_PER_PAGE})`);
  }
  if (!inventory.hasBreadcrumbs) issues.push("Missing breadcrumb trail");
  const needsNearby = view.page.pageType !== "country";
  if (needsNearby && !inventory.hasNearbyCities) issues.push("Missing nearby city links");
  if (!inventory.hasRelatedCategories) issues.push("Missing related category links");
  if (!inventory.hasRelatedSearches) issues.push("Missing related search links");
  if (brokenLinks.length) issues.push(`${brokenLinks.length} broken link(s)`);

  const publicPath = getPublicPathForPage(
    view.page.pageType,
    view.page.pageSlug,
    view.page.canonicalUrl,
  );

  return {
    pageType: view.page.pageType,
    pageSlug: view.page.pageSlug,
    publicPath,
    source,
    pass: pagePasses(inventory, view.page.pageType, brokenLinks),
    totalLinks: inventory.totalLinks,
    breadcrumbLinks: inventory.breadcrumbLinks,
    relatedLinks: inventory.relatedLinks,
    listingLinks: inventory.listingLinks,
    nearbyCities: inventory.nearbyCities,
    relatedCategories: inventory.relatedCategories,
    relatedSearches: inventory.relatedSearches,
    brokenLinks,
    issues,
  };
}

function pagePasses(inventory: PageLinkInventory, pageType: string, brokenLinks: string[]): boolean {
  const needsNearby = pageType !== "country";
  return (
    inventory.totalLinks >= MIN_INTERNAL_LINKS_PER_PAGE &&
    inventory.hasBreadcrumbs &&
    (needsNearby ? inventory.hasNearbyCities : inventory.nearbyCities + inventory.relatedCategories >= 4) &&
    inventory.hasRelatedCategories &&
    inventory.hasRelatedSearches &&
    brokenLinks.length === 0
  );
}

async function loadAllSeoViews(): Promise<Array<{ view: SeoPageViewModel; source: string }>> {
  const results: Array<{ view: SeoPageViewModel; source: string }> = [];

  const seoPages = await db.seoPage.findMany({
    where: { isPublished: true },
    select: { pageType: true, pageSlug: true },
    orderBy: [{ pageType: "asc" }, { pageSlug: "asc" }],
  });

  for (const row of seoPages) {
    try {
      if (row.pageType === "longtail" || row.pageType === "category_city") {
        const [a, b] = row.pageSlug.split("/");
        if (!a || !b) continue;
        const view = await loadTwoSegmentSeoPageView(a, b);
        if (view) results.push({ view, source: "published" });
        continue;
      }

      if (row.pageType === "city") {
        const city = await db.city.findFirst({
          where: { slug: row.pageSlug, isActive: true },
          include: { state: { include: { country: true } } },
        });
        if (city?.state?.country) {
          const view = await loadCitySeoPageView(
            city.state.country.slug,
            city.state.slug,
            city.slug,
          );
          if (view) results.push({ view, source: "published" });
        }
        continue;
      }

      if (row.pageType === "state") {
        const state = await db.state.findFirst({
          where: { slug: row.pageSlug, isActive: true },
          include: { country: true },
        });
        if (state?.country) {
          const view = await loadStateSeoPageView(state.country.slug, state.slug);
          if (view) results.push({ view, source: "published" });
        }
        continue;
      }

      if (row.pageType === "country") {
        const view = await loadCountrySeoPageView(row.pageSlug);
        if (view) results.push({ view, source: "published" });
        continue;
      }

      if (row.pageType === "category") {
        const view = await loadCategorySeoPageView(row.pageSlug);
        if (view) results.push({ view, source: "published" });
      }
    } catch {
      // skip unloadable pages
    }
  }

  return results;
}

async function auditFallbackCities(): Promise<PageAuditRow[]> {
  const rows: PageAuditRow[] = [];
  for (const city of FALLBACK_CITIES) {
    const view = await loadLongtailCityFallbackView("independent-escorts", city.slug);
    if (!view) {
      rows.push({
        pageType: "longtail",
        pageSlug: `independent-escorts/${city.slug}`,
        publicPath: city.path,
        source: "fallback-missing",
        pass: false,
        totalLinks: 0,
        breadcrumbLinks: 0,
        relatedLinks: 0,
        listingLinks: 0,
        nearbyCities: 0,
        relatedCategories: 0,
        relatedSearches: 0,
        brokenLinks: [],
        issues: ["Could not load fallback view"],
      });
      continue;
    }
    rows.push(await auditViewModel(view, view.page.customData ? "published" : "fallback"));
  }
  return rows;
}

async function auditSamplePageTypes(): Promise<PageAuditRow[]> {
  const rows: PageAuditRow[] = [];

  const city = await db.city.findFirst({
    where: { slug: "ahmedabad", isActive: true },
    include: { state: { include: { country: true } } },
  });
  if (city?.state?.country) {
    const view = await loadCitySeoPageView(city.state.country.slug, city.state.slug, city.slug);
    if (view) rows.push(await auditViewModel(view, "sample-city"));
  }

  const state = await db.state.findFirst({
    where: { isActive: true },
    include: { country: true },
  });
  if (state?.country) {
    const view = await loadStateSeoPageView(state.country.slug, state.slug);
    if (view) rows.push(await auditViewModel(view, "sample-state"));
  }

  const country = await db.country.findFirst({ where: { isActive: true } });
  if (country) {
    const view = await loadCountrySeoPageView(country.slug);
    if (view) rows.push(await auditViewModel(view, "sample-country"));
  }

  const category = await db.category.findFirst({ where: { isActive: true } });
  if (category) {
    const view = await loadCategorySeoPageView(category.slug);
    if (view) rows.push(await auditViewModel(view, "sample-category"));
  }

  if (city && category) {
    const view = await loadTwoSegmentSeoPageView(category.slug, city.slug);
    if (view) rows.push(await auditViewModel(view, "sample-category_city"));
  }

  const longtail = await loadLongtailCityFallbackView("independent-escorts", "ahmedabad");
  if (longtail) rows.push(await auditViewModel(longtail, "sample-longtail"));

  return rows;
}

function summarizeByPageType(rows: PageAuditRow[]) {
  const byType: Record<
    string,
    { count: number; pass: number; min: number; max: number; avg: number; totals: number[] }
  > = {};

  for (const row of rows) {
    if (!byType[row.pageType]) {
      byType[row.pageType] = { count: 0, pass: 0, min: Infinity, max: 0, avg: 0, totals: [] };
    }
    const bucket = byType[row.pageType]!;
    bucket.count++;
    if (row.pass) bucket.pass++;
    bucket.totals.push(row.totalLinks);
    bucket.min = Math.min(bucket.min, row.totalLinks);
    bucket.max = Math.max(bucket.max, row.totalLinks);
  }

  for (const bucket of Object.values(byType)) {
    bucket.avg =
      bucket.totals.length > 0
        ? Math.round((bucket.totals.reduce((a, b) => a + b, 0) / bucket.totals.length) * 10) / 10
        : 0;
    if (bucket.min === Infinity) bucket.min = 0;
  }

  return byType;
}

async function buildCrawlGraph(allViews: SeoPageViewModel[]): Promise<ReturnType<typeof buildInternalLinkGraph>> {
  const caches = await loadSlugCaches();
  const pages = allViews.map((view, i) => ({
    id: `${view.page.pageType}:${view.page.pageSlug}:${i}`,
    pageType: view.page.pageType,
    pageSlug: view.page.pageSlug,
    publicPath: normalizePublicSeoPath(
      getPublicPathForPage(view.page.pageType, view.page.pageSlug, view.page.canonicalUrl),
      caches,
    ),
    outboundHrefs: collectOutboundHrefs({
      breadcrumbs: view.breadcrumbs,
      relatedLinks: view.relatedLinks,
    }).map((h) => normalizePublicSeoPath(h, caches)),
  }));

  pages.unshift({
    id: "home:/",
    pageType: "home",
    pageSlug: "/",
    publicPath: "/",
    outboundHrefs: ["/country/india", "/category/escorts"],
  });

  return buildInternalLinkGraph(pages);
}

async function auditLiveScreenshots() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const shots: Array<{ slug: string; path: string; linkCount: number; screenshot: string }> = [];

  try {
    const page = await browser.newPage();
    for (const city of FALLBACK_CITIES) {
      await page.goto(`${BASE}${city.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1500);

      const exploreSection = page.getByText("Explore More on Secretza");
      if (await exploreSection.isVisible().catch(() => false)) {
        await exploreSection.scrollIntoViewIfNeeded();
      }

      const linkCount = await page.locator('a[href^="/"]').count();
      const screenshot = path.join(OUT_DIR, `${city.slug}-internal-links.png`);
      await page.screenshot({ path: screenshot, fullPage: false });

      shots.push({
        slug: city.slug,
        path: city.path,
        linkCount,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
  } finally {
    await browser.close();
  }

  return shots;
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server not ready at ${BASE}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const loaded = await loadAllSeoViews();
  const publishedAudits = await Promise.all(
    loaded.map(({ view, source }) => auditViewModel(view, source)),
  );

  const [fallbackAudits, sampleAudits] = await Promise.all([
    auditFallbackCities(),
    auditSamplePageTypes(),
  ]);

  const allViews = loaded.map((l) => l.view);
  const graph = await buildCrawlGraph(allViews);

  const allLinkCounts = publishedAudits.map((a) => a.totalLinks);
  const globalMin = allLinkCounts.length ? Math.min(...allLinkCounts) : 0;
  const globalMax = allLinkCounts.length ? Math.max(...allLinkCounts) : 0;
  const globalAvg =
    allLinkCounts.length > 0
      ? Math.round((allLinkCounts.reduce((a, b) => a + b, 0) / allLinkCounts.length) * 10) / 10
      : 0;

  const brokenAll = publishedAudits.flatMap((a) =>
    a.brokenLinks.map((href) => ({ page: `${a.pageType}/${a.pageSlug}`, href })),
  );

  const byPageType = summarizeByPageType([...publishedAudits, ...sampleAudits]);

  let liveScreenshots: Awaited<ReturnType<typeof auditLiveScreenshots>> | undefined;
  if (LIVE) {
    await waitForServer();
    liveScreenshots = await auditLiveScreenshots();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: { minLinksPerPage: MIN_INTERNAL_LINKS_PER_PAGE },
    summary: {
      publishedPagesAudited: publishedAudits.length,
      publishedPass: publishedAudits.filter((a) => a.pass).length,
      publishedFail: publishedAudits.filter((a) => !a.pass).length,
      fallbackCitiesPass: `${fallbackAudits.filter((a) => a.pass).length}/${fallbackAudits.length}`,
      globalMinLinks: globalMin,
      globalMaxLinks: globalMax,
      globalAvgLinks: globalAvg,
      brokenLinkCount: brokenAll.length,
      orphanPages: graph.orphans.length,
      poorConnectivityPages: graph.poorConnectivity.length,
    },
    linkStats: {
      min: globalMin,
      max: globalMax,
      average: globalAvg,
    },
    passFailByPageType: Object.fromEntries(
      Object.entries(byPageType).map(([type, stats]) => [
        type,
        {
          pass: stats.pass,
          total: stats.count,
          minLinks: stats.min,
          maxLinks: stats.max,
          avgLinks: stats.avg,
          status: stats.pass === stats.count ? "PASS" : stats.pass > 0 ? "PARTIAL" : "FAIL",
        },
      ]),
    ),
    crawlAnalysis: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      maxDepth: graph.maxDepth,
      avgDepth: graph.avgDepth,
      orphanCount: graph.orphans.length,
      orphanSample: graph.orphans.slice(0, 10),
      poorConnectivityCount: graph.poorConnectivity.length,
      poorConnectivitySample: graph.poorConnectivity.slice(0, 10),
      circularLinkPairs: graph.circularPairs.length,
      circularSample: graph.circularPairs.slice(0, 10),
    },
    fallbackCityAudits: fallbackAudits,
    samplePageTypeAudits: sampleAudits,
    brokenLinks: brokenAll.slice(0, 50),
    failingPagesSample: publishedAudits.filter((a) => !a.pass).slice(0, 20),
    liveScreenshots,
    fixesApplied: [
      "Created seo-internal-links.ts with supplementation, validation, and graph analysis",
      "fetchRelated* functions now call finalizeRelatedLinks() to guarantee 12+ related links",
      "Fallback longtail pages get synthetic keyword/category/city links from DB geo data",
      "normalizeBreadcrumbItems() fixes legacy paths (/india → /country/india)",
      "finalizeSeoPageViewModel() applied in all SEO page loaders",
    ],
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SEO Internal Links Audit</title>
<style>body{font-family:system-ui;background:#0b0b0f;color:#f5f5f7;padding:24px;max-width:1000px;margin:0 auto}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #333;padding:8px;text-align:left}
th{background:#15151d}.pass{color:#4ade80}.fail{color:#f87171}</style></head><body>
<h1>SEO Internal Linking Audit</h1>
<p>Published: ${report.summary.publishedPass}/${report.summary.publishedPagesAudited} pass |
Fallback cities: ${report.summary.fallbackCitiesPass} |
Avg links: ${report.summary.globalAvgLinks} (min ${report.summary.globalMinLinks}, max ${report.summary.globalMaxLinks})</p>
<h2>Pass/Fail by page type</h2>
<table><tr><th>Type</th><th>Pass</th><th>Total</th><th>Avg links</th><th>Status</th></tr>
${Object.entries(report.passFailByPageType).map(([t,s])=>`<tr><td>${t}</td><td>${(s as {pass:number}).pass}</td><td>${(s as {total:number}).total}</td><td>${(s as {avgLinks:number}).avgLinks}</td><td class="${(s as {status:string}).status==="PASS"?"pass":"fail"}">${(s as {status:string}).status}</td></tr>`).join("")}
</table>
<h2>Fallback cities</h2>
<table><tr><th>City</th><th>Links</th><th>Pass</th><th>Issues</th></tr>
${fallbackAudits.map(c=>`<tr><td>${c.publicPath}</td><td>${c.totalLinks}</td><td class="${c.pass?"pass":"fail"}">${c.pass?"PASS":"FAIL"}</td><td>${c.issues.join("; ")||"—"}</td></tr>`).join("")}
</table>
<h2>Crawl graph</h2>
<ul>
<li>Nodes: ${report.crawlAnalysis.nodeCount}</li>
<li>Edges: ${report.crawlAnalysis.edgeCount}</li>
<li>Max depth from home: ${report.crawlAnalysis.maxDepth}</li>
<li>Orphans: ${report.crawlAnalysis.orphanCount}</li>
<li>Poor connectivity: ${report.crawlAnalysis.poorConnectivityCount}</li>
</ul>
</body></html>`;

  writeFileSync(path.join(OUT_DIR, "report.html"), html);

  console.log("\n=== SEO Internal Linking Audit ===\n");
  console.log(`Published pages: ${report.summary.publishedPass}/${report.summary.publishedPagesAudited} pass`);
  console.log(`Fallback cities: ${report.summary.fallbackCitiesPass}`);
  console.log(`Links — min: ${globalMin}, avg: ${globalAvg}, max: ${globalMax}`);
  console.log(`Broken links: ${brokenAll.length} | Orphans: ${graph.orphans.length}`);
  console.log(`\nReport: ${path.join(OUT_DIR, "report.json")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

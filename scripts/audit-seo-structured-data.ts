/**
 * Audit JSON-LD structured data across all SEO page types.
 * Run: npx tsx scripts/audit-seo-structured-data.ts
 * Live HTML + screenshots: npx tsx scripts/audit-seo-structured-data.ts --live
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import {
  loadLongtailCityFallbackView,
  loadTwoSegmentSeoPageView,
  loadCitySeoPageView,
  loadStateSeoPageView,
  loadCountrySeoPageView,
  loadCategorySeoPageView,
} from "../src/lib/seo-public-page";
import {
  REQUIRED_SEO_SCHEMA_TYPES,
  resolveSeoPageSchemasForView,
  validateSeoPageSchemas,
  type RequiredSeoSchemaType,
} from "../src/lib/seo-schema";

const OUT_DIR = path.resolve("artifacts/seo-structured-data-audit");
const LIVE = process.argv.includes("--live");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const CITY_CHECKS = [
  { slug: "ahmedabad", path: "/independent-escorts/ahmedabad" },
  { slug: "mumbai", path: "/independent-escorts/mumbai" },
  { slug: "delhi", path: "/independent-escorts/delhi" },
  { slug: "bangalore", path: "/independent-escorts/bangalore" },
  { slug: "hyderabad", path: "/independent-escorts/hyderabad" },
] as const;

type PageAudit = {
  pageType: string;
  pageSlug: string;
  url: string;
  source: "db" | "fallback" | "published";
  pass: boolean;
  checks: Record<RequiredSeoSchemaType | "ImageObject", boolean>;
  schemaTypes: string[];
  issues: string[];
  schemaCount: number;
  exampleSchemas?: Record<string, object>;
};

function extractJsonLdFromHtml(html: string): object[] {
  const blocks: object[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]!.trim()) as object);
    } catch {
      // skip invalid
    }
  }
  return blocks;
}

function schemaTypesFromBlocks(blocks: object[]): string[] {
  return blocks
    .map((b) => (b as { "@type"?: string })["@type"])
    .filter(Boolean) as string[];
}

async function auditDbPages(): Promise<PageAudit[]> {
  const pages = await db.seoPage.findMany({
    include: {
      faqs: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { question: true, answer: true },
      },
    },
    orderBy: [{ pageType: "asc" }, { pageSlug: "asc" }],
  });

  const results: PageAudit[] = [];

  for (const page of pages) {
    const breadcrumbs = [{ label: "Home", href: "/" }, { label: page.h1 || page.pageSlug }];
    const schemas = resolveSeoPageSchemasForView({
      page: { ...page, faqs: page.faqs },
      breadcrumbs,
    });
    const validation = validateSeoPageSchemas({
      schemas,
      title: page.title,
      metaDescription: page.metaDescription,
      canonicalUrl: page.canonicalUrl,
      pageType: page.pageType,
      pageSlug: page.pageSlug,
      faqs: page.faqs,
    });

    const examples: Record<string, object> = {};
    for (const schema of schemas) {
      const type = (schema as { "@type"?: string })["@type"];
      if (type && !examples[type]) examples[type] = schema;
    }

    results.push({
      pageType: page.pageType,
      pageSlug: page.pageSlug,
      url: page.canonicalUrl || page.pageSlug,
      source: "db",
      pass: validation.pass,
      checks: validation.checks,
      schemaTypes: validation.schemaTypes,
      issues: validation.issues.map((i) => `[${i.code}] ${i.message}`),
      schemaCount: schemas.length,
      exampleSchemas: Object.keys(examples).length ? examples : undefined,
    });
  }

  return results;
}

async function auditCityPages(): Promise<PageAudit[]> {
  const results: PageAudit[] = [];

  for (const city of CITY_CHECKS) {
    const view = await loadLongtailCityFallbackView("independent-escorts", city.slug);
    if (!view) {
      results.push({
        pageType: "longtail",
        pageSlug: `independent-escorts/${city.slug}`,
        url: city.path,
        source: "fallback",
        pass: false,
        checks: {
          Organization: false,
          WebSite: false,
          WebPage: false,
          BreadcrumbList: false,
          FAQPage: true,
          ImageObject: false,
        },
        schemaTypes: [],
        issues: ["Could not load page view"],
        schemaCount: 0,
      });
      continue;
    }

    const schemas = resolveSeoPageSchemasForView(view);
    const validation = validateSeoPageSchemas({
      schemas,
      title: view.page.title,
      metaDescription: view.page.metaDescription,
      canonicalUrl: view.page.canonicalUrl,
      pageType: view.page.pageType,
      pageSlug: view.page.pageSlug,
      faqs: view.page.faqs,
    });

    const source = view.page.customData ? "published" : "fallback";
    const examples: Record<string, object> = {};
    for (const schema of schemas) {
      const type = (schema as { "@type"?: string })["@type"];
      if (type) examples[type] = schema;
    }

    results.push({
      pageType: view.page.pageType,
      pageSlug: view.page.pageSlug,
      url: city.path,
      source,
      pass: validation.pass,
      checks: validation.checks,
      schemaTypes: validation.schemaTypes,
      issues: validation.issues.map((i) => `[${i.code}] ${i.message}`),
      schemaCount: schemas.length,
      exampleSchemas: examples,
    });
  }

  return results;
}

async function auditSamplePageTypes(): Promise<PageAudit[]> {
  const samples: PageAudit[] = [];

  const loaders: Array<{
    pageType: string;
    load: () => Promise<Awaited<ReturnType<typeof loadCitySeoPageView>> | null>;
  }> = [];

  const cityRow = await db.city.findFirst({
    where: { slug: "ahmedabad", isActive: true },
    include: { state: { include: { country: true } } },
  });
  if (cityRow?.state?.country) {
    loaders.push({
      pageType: "city",
      load: () =>
        loadCitySeoPageView(cityRow.state.country.slug, cityRow.state.slug, cityRow.slug),
    });
  }

  const stateRow = await db.state.findFirst({
    where: { isActive: true },
    include: { country: true },
  });
  if (stateRow?.country) {
    loaders.push({
      pageType: "state",
      load: () => loadStateSeoPageView(stateRow.country.slug, stateRow.slug),
    });
  }

  const countryRow = await db.country.findFirst({ where: { isActive: true } });
  if (countryRow) {
    loaders.push({
      pageType: "country",
      load: () => loadCountrySeoPageView(countryRow.slug),
    });
  }

  const categoryRow = await db.category.findFirst({ where: { isActive: true } });
  if (categoryRow) {
    loaders.push({
      pageType: "category",
      load: () => loadCategorySeoPageView(categoryRow.slug),
    });
  }

  if (cityRow && categoryRow) {
    loaders.push({
      pageType: "category_city",
      load: () => loadTwoSegmentSeoPageView(categoryRow.slug, cityRow.slug),
    });
  }

  for (const { pageType, load } of loaders) {
    const view = await load();
    if (!view) continue;

    const schemas = resolveSeoPageSchemasForView(view);
    const validation = validateSeoPageSchemas({
      schemas,
      title: view.page.title,
      metaDescription: view.page.metaDescription,
      canonicalUrl: view.page.canonicalUrl,
      pageType: view.page.pageType,
      pageSlug: view.page.pageSlug,
      faqs: view.page.faqs,
    });

    samples.push({
      pageType,
      pageSlug: view.page.pageSlug,
      url: view.page.canonicalUrl || view.page.pageSlug,
      source: view.page.customData ? "published" : "fallback",
      pass: validation.pass,
      checks: validation.checks,
      schemaTypes: validation.schemaTypes,
      issues: validation.issues.map((i) => `[${i.code}] ${i.message}`),
      schemaCount: schemas.length,
    });
  }

  return samples;
}

async function auditLiveHtml(): Promise<
  Array<{ slug: string; path: string; pass: boolean; schemaTypes: string[]; issues: string[]; screenshot?: string }>
> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const results: Array<{
    slug: string;
    path: string;
    pass: boolean;
    schemaTypes: string[];
    issues: string[];
    screenshot?: string;
  }> = [];

  try {
    const page = await browser.newPage();
    for (const city of CITY_CHECKS) {
      const fullUrl = `${BASE}${city.path}`;
      await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1500);

      const html = await page.content();
      const blocks = extractJsonLdFromHtml(html);
      const types = schemaTypesFromBlocks(blocks);
      const typeSet = new Set(types);
      const issues: string[] = [];

      if (types.length !== new Set(types).size) {
        issues.push("Duplicate schema @type in HTML");
      }
      for (const required of REQUIRED_SEO_SCHEMA_TYPES) {
        if (required === "FAQPage") continue;
        if (!typeSet.has(required)) issues.push(`Missing ${required} in live HTML`);
      }

      const title = await page.title();
      const webPage = blocks.find((b) => (b as { "@type"?: string })["@type"] === "WebPage") as
        | { name?: string; url?: string }
        | undefined;
      if (webPage?.name && title && !title.toLowerCase().includes(webPage.name.toLowerCase().slice(0, 20))) {
        issues.push(`Title/schema mismatch: "${title}" vs WebPage.name "${webPage.name}"`);
      }

      const screenshot = path.join(OUT_DIR, `${city.slug}-structured-data.png`);
      await page.screenshot({ path: screenshot, fullPage: false });

      results.push({
        slug: city.slug,
        path: city.path,
        pass: issues.length === 0,
        schemaTypes: types,
        issues,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
  } finally {
    await browser.close();
  }

  return results;
}

function summarizeBySchemaType(audits: PageAudit[]) {
  const types = [...REQUIRED_SEO_SCHEMA_TYPES, "ImageObject"] as const;
  const summary: Record<string, { pass: number; fail: number }> = {};
  for (const type of types) {
    summary[type] = { pass: 0, fail: 0 };
    for (const audit of audits) {
      if (audit.checks[type]) summary[type]!.pass++;
      else summary[type]!.fail++;
    }
  }
  return summary;
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

  const [dbAudits, cityAudits, sampleAudits] = await Promise.all([
    auditDbPages(),
    auditCityPages(),
    auditSamplePageTypes(),
  ]);

  const schemaSummary = summarizeBySchemaType(dbAudits);
  const cityPass = cityAudits.filter((a) => a.pass).length;

  let liveResults: Awaited<ReturnType<typeof auditLiveHtml>> | undefined;
  if (LIVE) {
    await waitForServer();
    liveResults = await auditLiveHtml();
  }

  const exampleCity = cityAudits.find((c) => c.pageSlug.includes("ahmedabad"));
  const jsonLdExamples = exampleCity?.exampleSchemas || cityAudits[0]?.exampleSchemas || {};

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalDbPages: dbAudits.length,
      dbPagesPass: dbAudits.filter((a) => a.pass).length,
      dbPagesFail: dbAudits.filter((a) => a.pass === false).length,
      cityChecksPass: `${cityPass}/${cityAudits.length}`,
      samplePageTypesPass: sampleAudits.filter((a) => a.pass).length,
      samplePageTypesTotal: sampleAudits.length,
    },
    schemaTypePassFail: schemaSummary,
    cityAudits,
    samplePageTypeAudits: sampleAudits,
    dbAuditSample: dbAudits.slice(0, 3),
    jsonLdExamples,
    liveHtml: liveResults,
    fixesApplied: [
      "Added generateWebPageSchema to seo-content.ts",
      "Created seo-schema.ts with full schema bundle (Organization, WebSite, WebPage, BreadcrumbList, FAQPage)",
      "SeoPageView resolves runtime schemas for fallback pages missing customData",
      "buildSchemaJson now persists full schema bundle on regeneration",
    ],
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SEO Structured Data Audit</title>
<style>body{font-family:system-ui;background:#0b0b0f;color:#f5f5f7;padding:24px;max-width:960px;margin:0 auto}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #333;padding:8px;text-align:left}
th{background:#15151d}.pass{color:#4ade80}.fail{color:#f87171}pre{background:#15151d;padding:12px;overflow:auto;font-size:12px}
</style></head><body>
<h1>SEO Structured Data Audit</h1>
<p>DB pages: ${report.summary.dbPagesPass}/${report.summary.totalDbPages} pass | Cities: ${report.summary.cityChecksPass} pass</p>
<h2>Schema type pass/fail (DB corpus)</h2>
<table><tr><th>Schema</th><th>Pass</th><th>Fail</th></tr>
${Object.entries(schemaSummary).map(([k,v])=>`<tr><td>${k}</td><td class="pass">${v.pass}</td><td class="fail">${v.fail}</td></tr>`).join("")}
</table>
<h2>City checks (independent-escorts)</h2>
<table><tr><th>City</th><th>Source</th><th>Schemas</th><th>Pass</th><th>Issues</th></tr>
${cityAudits.map(c=>`<tr><td>${c.url}</td><td>${c.source}</td><td>${c.schemaTypes.join(", ")}</td><td class="${c.pass?"pass":"fail"}">${c.pass?"PASS":"FAIL"}</td><td>${c.issues.join("; ")||"—"}</td></tr>`).join("")}
</table>
${liveResults ? `<h2>Live HTML</h2><table><tr><th>City</th><th>Schemas</th><th>Pass</th></tr>
${liveResults.map(l=>`<tr><td>${l.path}</td><td>${l.schemaTypes.join(", ")}</td><td class="${l.pass?"pass":"fail"}">${l.pass?"PASS":"FAIL"}</td></tr>`).join("")}
</table>` : ""}
<h2>JSON-LD example (WebPage)</h2>
<pre>${JSON.stringify(jsonLdExamples.WebPage || {}, null, 2)}</pre>
</body></html>`;

  writeFileSync(path.join(OUT_DIR, "report.html"), html);

  console.log("\n=== SEO Structured Data Audit ===\n");
  console.log(`DB pages: ${report.summary.dbPagesPass}/${report.summary.totalDbPages} pass`);
  console.log(`City checks: ${report.summary.cityChecksPass} pass`);
  console.log("\nSchema type summary (DB):");
  for (const [type, stats] of Object.entries(schemaSummary)) {
    console.log(`  ${type.padEnd(16)} pass=${stats.pass} fail=${stats.fail}`);
  }
  console.log(`\nReport: ${path.join(OUT_DIR, "report.json")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

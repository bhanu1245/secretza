/**
 * Verify SEO dashboard metrics match live database aggregates.
 * Run: npx tsx scripts/verify-seo-dashboard.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { loadSeoDashboardMetrics } from "../src/lib/seo-dashboard-metrics";
import { SEO_MIN_WORD_COUNT } from "../src/lib/seo-quality";

const OUT_DIR = path.resolve("artifacts/seo-dashboard-audit");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const MAX_LOAD_MS = 2000;

type Check = { name: string; expected: unknown; actual: unknown; pass: boolean };

async function waitForServer() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not ready at ${BASE}`);
}

async function directDbCounts() {
  const [
    total,
    published,
    drafts,
    avgSeo,
    avgUniq,
    riskGroups,
    below500,
    regenCompleted,
    rollbacks,
  ] = await Promise.all([
    db.seoPage.count(),
    db.seoPage.count({ where: { isPublished: true } }),
    db.seoPage.count({ where: { isPublished: false } }),
    db.seoPage.aggregate({ _avg: { seoQualityScore: true } }),
    db.seoPage.aggregate({ _avg: { uniquenessScore: true } }),
    db.seoPage.groupBy({ by: ["duplicateRisk"], _count: { _all: true } }),
    db.seoPage.count({ where: { wordCount: { lt: 500 } } }),
    db.seoRegenerationItem.count({ where: { status: "completed", run: { dryRun: false } } }),
    db.seoContentVersion.count({ where: { rolledBackAt: { not: null } } }),
  ]);

  const risk = (level: string) =>
    riskGroups.find((r) => r.duplicateRisk === level)?._count._all ?? 0;

  return {
    total,
    published,
    drafts,
    avgSeo: Math.round((avgSeo._avg.seoQualityScore ?? 0) * 10) / 10,
    avgUniq: Math.round((avgUniq._avg.uniquenessScore ?? 0) * 10) / 10,
    lowRisk: risk("low"),
    mediumRisk: risk("medium"),
    highRisk: risk("high"),
    below500,
    regenCompleted,
    rollbacks,
    belowMinWords: await db.seoPage.count({
      where: { OR: [{ wordCount: { lt: SEO_MIN_WORD_COUNT } }, { wordCount: null }] },
    }),
  };
}

function compare(name: string, expected: unknown, actual: unknown): Check {
  const pass = expected === actual;
  return { name, expected, actual, pass };
}

type CookieJar = Map<string, string>;

function parseSetCookie(header: string | null, jar: CookieJar) {
  if (!header) return;
  const part = header.split(";")[0]?.trim();
  if (!part) return;
  const eq = part.indexOf("=");
  if (eq <= 0) return;
  jar.set(part.slice(0, eq), part.slice(eq + 1));
}

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(path: string, jar: CookieJar, init: RequestInit & { csrfToken?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.csrfToken) headers.set("x-csrf-token", init.csrfToken);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  parseSetCookie(res.headers.get("set-cookie"), jar);
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    for (const c of getSetCookie.call(res.headers)) parseSetCookie(c, jar);
  }
  return res;
}

async function getAdminCookies(): Promise<Array<{ name: string; value: string; url: string }>> {
  const jar: CookieJar = new Map();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  const csrfRes = await request("/api/csrf", jar);
  const { token: csrfToken } = (await csrfRes.json()) as { token: string };
  const authCsrfRes = await request("/api/auth/csrf", jar);
  const { csrfToken: authCsrf } = (await authCsrfRes.json()) as { csrfToken: string };

  await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    csrfToken,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: authCsrf,
      email,
      password,
      json: "true",
    }).toString(),
    redirect: "manual",
  });

  return [...jar.entries()].map(([name, value]) => ({ name, value, url: BASE }));
}

async function captureScreenshot() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies(await getAdminCookies());
    const page = await context.newPage();
    await page.goto(`${BASE}/admin/seo/dashboard`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector("text=Live database metrics", { timeout: 30000 });
    await page.waitForTimeout(500);
    const file = path.join(OUT_DIR, "seo-dashboard.png");
    await page.screenshot({ path: file, fullPage: true });
    return path.relative(process.cwd(), file);
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const started = Date.now();
  const metrics = await loadSeoDashboardMetrics(30);
  const loadTimeMs = Date.now() - started;

  const dbCounts = await directDbCounts();

  const checks: Check[] = [
    compare("Total SEO pages", dbCounts.total, metrics.seoPages.total),
    compare("Published pages", dbCounts.published, metrics.seoPages.published),
    compare("Draft pages", dbCounts.drafts, metrics.seoPages.drafts),
    compare("Avg SEO score", dbCounts.avgSeo, metrics.quality.avgSeoScore),
    compare("Avg uniqueness", dbCounts.avgUniq, metrics.quality.avgUniqueness),
    compare("Low risk count", dbCounts.lowRisk, metrics.risk.low),
    compare("Medium risk count", dbCounts.mediumRisk, metrics.risk.medium),
    compare("High risk count", dbCounts.highRisk, metrics.risk.high),
    compare("Below 500 words", dbCounts.below500, metrics.charts.wordCountDistribution[0]?.count),
    compare("Below min words", dbCounts.belowMinWords, metrics.contentIssues.belowMinWords),
    compare("Total regenerated", dbCounts.regenCompleted, metrics.regeneration.totalRegeneratedPages),
    compare("Rollback count", dbCounts.rollbacks, metrics.regeneration.rollbackCount),
    compare(
      "Quality chart sum",
      dbCounts.total,
      metrics.charts.qualityDistribution.reduce((s, b) => s + b.count, 0),
    ),
    compare(
      "Risk chart sum",
      dbCounts.total,
      metrics.charts.duplicateRiskDistribution.reduce((s, b) => s + b.count, 0),
    ),
  ];

  const loadPass = loadTimeMs < MAX_LOAD_MS;
  let screenshot: string | null = null;

  try {
    await waitForServer();
    screenshot = await captureScreenshot();
  } catch (err) {
    console.warn("Screenshot skipped:", err instanceof Error ? err.message : err);
  }

  const widgetAudit = [
    { widget: "Total SEO Pages", old: "API mixed/hardcoded", source: "SeoPage.count()", fixed: true },
    { widget: "Published Pages", old: "API count", source: "SeoPage isPublished=true", fixed: true },
    { widget: "Draft Pages", old: "API count", source: "SeoPage isPublished=false", fixed: true },
    { widget: "Average SEO Score", old: "Derived health formula", source: "SeoPage.aggregate seoQualityScore", fixed: true },
    { widget: "Average Uniqueness", old: "Partial/mock", source: "SeoPage.aggregate uniquenessScore", fixed: true },
    { widget: "Low/Medium/High Risk", old: "City slug collision estimate", source: "SeoPage.groupBy duplicateRisk", fixed: true },
    { widget: "Pages Below 500 Words", old: "Real but buried", source: "SeoPage.count wordCount<500", fixed: true },
    { widget: "Missing Meta/H1/Canonical/Image", old: "Partial", source: "SeoPage null/empty field counts", fixed: true },
    { widget: "Missing FAQ", old: "Partial", source: "SeoPage faqCount + SeoFaq relation", fixed: true },
    { widget: "Missing Structured Data", old: "ImageObject proxy (wrong)", source: "SeoPage customData contains @type", fixed: true },
    { widget: "Missing Internal Links", old: "Partial", source: "SeoPage internalLinksCount aggregate", fixed: true },
    { widget: "Duplicate Titles/Meta/H1", old: "City slug logic", source: "SQL duplicate field groups", fixed: true },
    { widget: "Duplicate Content", old: "Not shown / similarity on load", source: "SeoPage contentHash SQL groups", fixed: true },
    { widget: "Recently Updated Pages", old: "lastGenerated: new Date()", source: "SeoPage orderBy updatedAt", fixed: true },
    { widget: "Regeneration Statistics", old: "Partial", source: "SeoRegenerationRun/Item aggregates", fixed: true },
    { widget: "Audit Statistics", old: "Mixed", source: "SeoPage audit aggregates", fixed: true },
    { widget: "SEO Quality Chart", old: "Placeholder", source: "SeoPage score bucket counts", fixed: true },
    { widget: "Duplicate Risk Chart", old: "Placeholder", source: "SeoPage duplicateRisk groupBy", fixed: true },
    { widget: "Word Count Chart", old: "Placeholder", source: "SeoPage wordCount bucket counts", fixed: true },
    { widget: "Regeneration History Chart", old: "Placeholder", source: "SeoRegenerationRun completedCount", fixed: true },
    { widget: "Quick stat trends (+12%)", old: "Hardcoded strings", source: "Removed", fixed: true },
    { widget: "Verification status", old: "Hardcoded configured flags", source: "getAllVerificationConfigs()", fixed: true },
    { widget: "Indexation panel", old: "scoreAllPages() N+1 queries", source: "SeoPage published/noindex counts", fixed: true },
    { widget: "Crawl panel", old: "Heavy getCrawlStats()", source: "CrawlEvent count aggregates", fixed: true },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    loadTimeMs,
    loadTimePass: loadPass,
    maxLoadMs: MAX_LOAD_MS,
    checks,
    allChecksPass: checks.every((c) => c.pass),
    widgetAudit,
    screenshot,
    filesChanged: [
      "src/lib/seo-dashboard-metrics.ts",
      "src/app/api/seo/dashboard/route.ts",
      "src/components/secretza/admin/SeoDashboard.tsx",
      "scripts/verify-seo-dashboard.ts",
    ],
    queriesUsed: [
      "SeoPage.count / aggregate / groupBy",
      "SeoPage SQL duplicate title/meta/h1/contentHash groups",
      "SeoRegenerationRun.findMany (history)",
      "SeoRegenerationItem.groupBy status",
      "SeoContentVersion.count rolledBackAt",
      "CrawlEvent.count (summary)",
      "generateSitemapStats() chunk counts",
    ],
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== SEO Dashboard Verification ===\n");
  console.log(`Load time: ${loadTimeMs}ms (${loadPass ? "PASS" : "FAIL"} < ${MAX_LOAD_MS}ms)`);
  console.log(`Checks: ${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  for (const c of checks) {
    console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}: expected=${c.expected} actual=${c.actual}`);
  }
  if (screenshot) console.log(`Screenshot: ${screenshot}`);
  console.log(`Report: artifacts/seo-dashboard-audit/report.json`);

  if (!loadPass || !report.allChecksPass) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

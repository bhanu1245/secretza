/**
 * Live SEO layout verification with screenshots.
 * Run: npx playwright install chromium && npx tsx scripts/verify-seo-layout-live.ts
 */
import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve("artifacts/seo-layout-verification");

const PAGES = [
  { path: "/independent-escorts/ahmedabad", slug: "ahmedabad" },
  { path: "/independent-escorts/mumbai", slug: "mumbai" },
  { path: "/independent-escorts/delhi", slug: "delhi" },
  { path: "/independent-escorts/bangalore", slug: "bangalore" },
  { path: "/independent-escorts/hyderabad", slug: "hyderabad" },
];

type CheckResult = {
  url: string;
  viewport: string;
  checks: Record<string, boolean>;
  screenshot: string;
};

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

async function verifyPage(
  page: import("playwright").Page,
  urlPath: string,
  viewportLabel: string,
  slug: string,
): Promise<CheckResult> {
  const fullUrl = `${BASE}${urlPath}`;
  await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);

  const checks = {
    header: (await page.locator("header").count()) > 0,
    secretzaLogo:
      (await page.locator('header img[alt*="Secretza"], header img[alt*="logo"]').first().isVisible().catch(() => false)) ||
      (await page.getByText("Secretza", { exact: false }).first().isVisible().catch(() => false)),
    searchBar:
      (await page.locator('input[placeholder*="Search"], input[type="search"]').first().isVisible().catch(() => false)) ||
      (await page.locator('header button:has(svg), nav.fixed.bottom-0').getByText("Search").isVisible().catch(() => false)),
    postAd:
      (await page.getByRole("link", { name: /post ad/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole("button", { name: /post ad/i }).first().isVisible().catch(() => false)),
    navigation: (await page.locator("nav").count()) > 0,
    breadcrumbs: await page.locator('nav[aria-label="Breadcrumb"]').isVisible().catch(() => false),
    h1: await page.locator("h1").first().isVisible().catch(() => false),
    featuredImage: await page.locator("figure, img").first().isVisible().catch(() => false),
    listingsSection:
      (await page.locator('[class*="grid"]').filter({ has: page.locator("a[href*='/listing/']") }).count()) > 0 ||
      (await page.getByText(/listing(s)? available/i).isVisible().catch(() => false)),
    relatedLinks: await page.getByText("Explore More on Secretza").isVisible().catch(() => false),
    footer:
      viewportLabel === "desktop"
        ? await page.locator("footer").isVisible().catch(() => false)
        : !(await page.locator("footer").isVisible().catch(() => false)),
    mobileBottomNav:
      viewportLabel === "mobile"
        ? await page.locator("nav.fixed.bottom-0").isVisible().catch(() => false)
        : !(await page.locator("nav.fixed.bottom-0").isVisible().catch(() => false)),
  };

  const screenshotName = `${slug}-${viewportLabel}.png`;
  const screenshotPath = path.join(OUT_DIR, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const html = await page.content();
  writeFileSync(path.join(OUT_DIR, `${slug}-${viewportLabel}.html`), html, "utf8");

  return { url: fullUrl, viewport: viewportLabel, checks, screenshot: screenshotPath };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const results: CheckResult[] = [];

  for (const { path: urlPath, slug } of PAGES) {
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktopContext.newPage();
    results.push(await verifyPage(desktopPage, urlPath, "desktop", slug));
    await desktopContext.close();

    const mobileContext = await browser.newContext({ ...devices["iPhone 13"] });
    const mobilePage = await mobileContext.newPage();
    results.push(await verifyPage(mobilePage, urlPath, "mobile", slug));
    await mobileContext.close();
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    layoutChain: "PublicSiteLayout > SeoPageView",
    pages: PAGES.map((p) => p.path),
    results,
    allPassed: results.every((r) => Object.values(r.checks).every(Boolean)),
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (!report.allPassed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

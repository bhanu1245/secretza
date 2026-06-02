/**
 * Audit fallback longtail city SEO metadata + capture screenshots.
 * Run: npx tsx scripts/audit-fallback-seo-metadata.ts
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve("artifacts/fallback-seo-metadata-audit");

const PAGES = [
  { path: "/independent-escorts/mumbai", slug: "mumbai" },
  { path: "/independent-escorts/delhi", slug: "delhi" },
  { path: "/independent-escorts/bangalore", slug: "bangalore" },
  { path: "/independent-escorts/hyderabad", slug: "hyderabad" },
];

type MetaAudit = {
  url: string;
  slug: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  twitterImage: string | null;
  h1: string | null;
  checks: Record<string, boolean>;
  screenshot: string;
  sourceFile: string;
};

function extractMeta(html: string, attr: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    "i",
  );
  const match = html.match(re);
  return match?.[1] || match?.[2] || null;
}

function extractLink(html: string, rel: string): string | null {
  const re = new RegExp(
    `<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`,
    "i",
  );
  const match = html.match(re);
  return match?.[1] || match?.[2] || null;
}

function extractTitle(html: string): string | null {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
}

function extractH1(html: string): string | null {
  return html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ?? null;
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

async function auditPage(
  page: import("playwright").Page,
  urlPath: string,
  slug: string,
): Promise<MetaAudit> {
  const fullUrl = `${BASE}${urlPath}`;
  await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1500);

  const html = await page.content();
  const sourceFile = path.join(OUT_DIR, `${slug}-source.html`);
  writeFileSync(sourceFile, html, "utf8");

  const screenshot = path.join(OUT_DIR, `${slug}-desktop.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  const title = extractTitle(html);
  const metaDescription = extractMeta(html, "name", "description");
  const canonical = extractLink(html, "canonical");
  const ogImage = extractMeta(html, "property", "og:image");
  const twitterImage = extractMeta(html, "name", "twitter:image");
  const h1 = extractH1(html);

  const cityLabel = slug.charAt(0).toUpperCase() + slug.slice(1);
  const expectedTitle = `Independent Escorts in ${cityLabel} | Secretza`;
  const expectedH1 = `Independent Escorts in ${cityLabel}`;
  const canonicalPath = new URL(fullUrl).pathname;

  const checks = {
    titleNotFound: title !== "Page Not Found | Secretza",
    titleFormat: title === expectedTitle,
    metaDescriptionPresent: !!metaDescription && metaDescription.length > 20,
    canonicalPresent: !!canonical,
    canonicalMatchesRoute:
      !!canonical &&
      (canonical === fullUrl ||
        canonical.endsWith(canonicalPath) ||
        canonical === `${BASE}${urlPath}`),
    ogImagePresent: !!ogImage,
    twitterImagePresent: !!twitterImage,
    h1Format: h1 === expectedH1,
    headerPresent: html.includes("<header"),
    exploreMorePresent: html.includes("Explore More on Secretza"),
  };

  return {
    url: fullUrl,
    slug,
    title,
    metaDescription,
    canonical,
    ogImage,
    twitterImage,
    h1,
    checks,
    screenshot,
    sourceFile,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const results: MetaAudit[] = [];
  for (const { path: urlPath, slug } of PAGES) {
    results.push(await auditPage(page, urlPath, slug));
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    metadataChain: [
      "generateMetadata ([country]/[state]/page.tsx)",
      "resolveLongtailCityFallbackMetadata (seo-fallback-metadata.ts)",
      "buildLongtailCityFallbackFields (seo-fallback.ts)",
      "buildSeoPageMetadata (seo-metadata.ts → og:image, twitter:image)",
    ],
    routesFixed: PAGES.map((p) => p.path),
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

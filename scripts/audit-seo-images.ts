/**
 * Image SEO audit for all SEO page types.
 * Run: npx tsx scripts/audit-seo-images.ts
 * Live HTML + screenshots: npx tsx scripts/audit-seo-images.ts --live
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { buildSeoPageMetadata } from "../src/lib/seo-metadata";
import {
  resolveSeoImageUrl,
  serializeSeoPageImages,
  SEO_IMAGE_HEIGHT,
  SEO_IMAGE_PLACEHOLDER,
  SEO_IMAGE_WIDTH,
} from "../src/lib/seo-images";
import {
  getSeoPagePublicUrl,
  loadLongtailCityFallbackView,
  loadCitySeoPageView,
  loadStateSeoPageView,
  loadCountrySeoPageView,
  loadCategorySeoPageView,
  loadTwoSegmentSeoPageView,
} from "../src/lib/seo-public-page";
import { resolveSeoPageSchemasForView } from "../src/lib/seo-schema";
import { resolveLongtailCityFallbackMetadata } from "../src/lib/seo-fallback-metadata";

const OUT_DIR = path.resolve("artifacts/seo-image-audit");
const LIVE = process.argv.includes("--live");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com";
const CHECK_ORIGIN = LIVE ? BASE : SITE_ORIGIN;

function absoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${CHECK_ORIGIN.replace(/\/+$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}
const FALLBACK_CITIES = [
  { slug: "mumbai", path: "/independent-escorts/mumbai" },
  { slug: "delhi", path: "/independent-escorts/delhi" },
  { slug: "bangalore", path: "/independent-escorts/bangalore" },
  { slug: "hyderabad", path: "/independent-escorts/hyderabad" },
] as const;

type ImageAuditRow = {
  pageType: string;
  pageSlug: string;
  publicPath: string;
  source: string;
  pass: boolean;
  featuredImage: string | null;
  displayImageUrl: string;
  isPlaceholder: boolean;
  imageAlt: string;
  ogImage: string | null;
  twitterImage: string | null;
  ogWidth: number | null;
  ogHeight: number | null;
  imgWidth: number;
  imgHeight: number;
  imgLoading: string;
  imageObjectValid: boolean;
  imageReachable: boolean | null;
  issues: string[];
};

async function checkImageReachable(url: string): Promise<boolean> {
  try {
    const target = absoluteUrl(url);
    const res = await fetch(target, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    if (res.ok) return true;
    const getRes = await fetch(target, { method: "GET", signal: AbortSignal.timeout(8000) });
    return getRes.ok;
  } catch {
    return false;
  }
}

function validateImageObject(schema: object | undefined): {
  valid: boolean;
  issues: string[];
} {
  if (!schema) return { valid: false, issues: ["Missing ImageObject schema"] };
  const s = schema as {
    url?: string;
    width?: number;
    height?: number;
    name?: string;
    description?: string;
  };
  const issues: string[] = [];
  if (!s.url?.trim()) issues.push("ImageObject missing url");
  if (!s.width) issues.push("ImageObject missing width");
  if (!s.height) issues.push("ImageObject missing height");
  if (!s.name?.trim() && !s.description?.trim()) issues.push("ImageObject missing alt (name/description)");
  return { valid: issues.length === 0, issues };
}

function extractOgFromMetadata(meta: Awaited<ReturnType<typeof buildSeoPageMetadata>>) {
  const og = meta.openGraph;
  const ogImage = og?.images?.[0];
  const url = typeof ogImage === "string" ? ogImage : ogImage?.url;
  const width = typeof ogImage === "object" && ogImage && "width" in ogImage ? Number(ogImage.width) : null;
  const height = typeof ogImage === "object" && ogImage && "height" in ogImage ? Number(ogImage.height) : null;
  const alt =
    typeof ogImage === "object" && ogImage && "alt" in ogImage ? String(ogImage.alt || "") : "";
  const twitterImages = meta.twitter?.images;
  const twitterImage = Array.isArray(twitterImages)
    ? typeof twitterImages[0] === "string"
      ? twitterImages[0]
      : null
    : null;
  return { ogUrl: url ? String(url) : null, ogWidth: width, ogHeight: height, ogAlt: alt, twitterImage: twitterImage ? String(twitterImage) : null };
}

async function auditDbPage(page: {
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  featuredImage: string | null;
  imageAlt: string | null;
  imageTitle: string | null;
  customData: string | null;
  faqs: Array<{ question: string; answer: string }>;
}): Promise<ImageAuditRow> {
  const images = serializeSeoPageImages({
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt,
    imageTitle: page.imageTitle,
    title: page.title,
    h1: page.h1,
    pageType: page.pageType,
  });

  const displayUrl = resolveSeoImageUrl(page.featuredImage, CHECK_ORIGIN) || images.featuredImage;

  const meta = buildSeoPageMetadata(
    {
      title: page.title,
      metaDescription: page.metaDescription,
      canonicalUrl: page.canonicalUrl || getSeoPagePublicUrl(page),
      featuredImage: page.featuredImage,
      imageAlt: page.imageAlt || page.title,
    },
    SITE_ORIGIN,
  );

  const og = extractOgFromMetadata(meta);
  const breadcrumbs = [{ label: "Home", href: "/" }, { label: page.h1 || page.pageSlug }];
  const schemas = resolveSeoPageSchemasForView({
    page: { ...page, faqs: page.faqs },
    breadcrumbs,
  });
  const imageSchema = schemas.find((s) => (s as { "@type"?: string })["@type"] === "ImageObject");
  const imageObj = validateImageObject(imageSchema);

  const issues: string[] = [...imageObj.issues];
  if (!images.imageAlt.trim()) issues.push("Missing alt text");
  if (!og.ogUrl) issues.push("Missing og:image");
  if (!og.twitterImage) issues.push("Missing twitter:image");
  if (og.ogWidth !== SEO_IMAGE_WIDTH || og.ogHeight !== SEO_IMAGE_HEIGHT) {
    issues.push(`OG dimensions ${og.ogWidth}x${og.ogHeight} (expected ${SEO_IMAGE_WIDTH}x${SEO_IMAGE_HEIGHT})`);
  }
  if (!page.featuredImage?.trim()) {
    issues.push("No stored featuredImage (using site placeholder)");
  }

  const reachable = LIVE ? await checkImageReachable(displayUrl) : null;
  if (reachable === false) issues.push("Image URL not reachable");

  const isPlaceholder =
    !page.featuredImage?.trim() ||
    displayUrl === SEO_IMAGE_PLACEHOLDER ||
    displayUrl.endsWith("/logo.svg");

  const criticalIssues = issues.filter((i) => !i.startsWith("No stored featuredImage"));

  return {
    pageType: page.pageType,
    pageSlug: page.pageSlug,
    publicPath: getSeoPagePublicUrl(page),
    source: "db",
    pass: criticalIssues.length === 0,
    featuredImage: page.featuredImage,
    displayImageUrl: absoluteUrl(displayUrl),
    isPlaceholder,
    imageAlt: images.imageAlt,
    ogImage: og.ogUrl,
    twitterImage: og.twitterImage,
    ogWidth: og.ogWidth,
    ogHeight: og.ogHeight,
    imgWidth: SEO_IMAGE_WIDTH,
    imgHeight: SEO_IMAGE_HEIGHT,
    imgLoading: "lazy/eager via SeoFeaturedImage",
    imageObjectValid: imageObj.valid,
    imageReachable: reachable,
    issues,
  };
}

async function auditFallbackCity(slug: string, urlPath: string): Promise<ImageAuditRow> {
  const view = await loadLongtailCityFallbackView("independent-escorts", slug);
  const meta = await resolveLongtailCityFallbackMetadata("independent-escorts", slug);

  if (!view || !meta) {
    return {
      pageType: "longtail",
      pageSlug: `independent-escorts/${slug}`,
      publicPath: urlPath,
      source: "fallback-missing",
      pass: false,
      featuredImage: null,
      displayImageUrl: "",
      isPlaceholder: true,
      imageAlt: "",
      ogImage: null,
      twitterImage: null,
      ogWidth: null,
      ogHeight: null,
      imgWidth: SEO_IMAGE_WIDTH,
      imgHeight: SEO_IMAGE_HEIGHT,
      imgLoading: "n/a",
      imageObjectValid: false,
      imageReachable: null,
      issues: ["Could not load fallback page"],
    };
  }

  const images = serializeSeoPageImages({
    featuredImage: view.page.featuredImage,
    imageAlt: view.page.imageAlt,
    imageTitle: view.page.imageTitle,
    title: view.page.title,
    h1: view.page.h1,
    pageType: view.page.pageType,
  });

  const displayUrl =
    resolveSeoImageUrl(view.page.featuredImage, CHECK_ORIGIN) || images.featuredImage;

  const og = extractOgFromMetadata(meta);
  const schemas = resolveSeoPageSchemasForView(view);
  const imageSchema = schemas.find((s) => (s as { "@type"?: string })["@type"] === "ImageObject");
  const imageObj = validateImageObject(imageSchema);

  const issues: string[] = [...imageObj.issues];
  if (!images.imageAlt.trim()) issues.push("Missing alt text");
  if (!og.ogUrl) issues.push("Missing og:image");
  if (!og.twitterImage) issues.push("Missing twitter:image");

  const reachable = LIVE ? await checkImageReachable(displayUrl) : null;
  if (reachable === false) issues.push("Image URL not reachable");

  const isPlaceholder = !view.page.featuredImage?.trim() || displayUrl === SEO_IMAGE_PLACEHOLDER;

  return {
    pageType: "longtail",
    pageSlug: view.page.pageSlug,
    publicPath: urlPath,
    source: view.page.featuredImage ? "published" : "fallback",
    pass: issues.length === 0,
    featuredImage: view.page.featuredImage,
    displayImageUrl: absoluteUrl(displayUrl),
    isPlaceholder,
    imageAlt: images.imageAlt,
    ogImage: og.ogUrl,
    twitterImage: og.twitterImage,
    ogWidth: og.ogWidth,
    ogHeight: og.ogHeight,
    imgWidth: SEO_IMAGE_WIDTH,
    imgHeight: SEO_IMAGE_HEIGHT,
    imgLoading: "eager (priority hero)",
    imageObjectValid: imageObj.valid,
    imageReachable: reachable,
    issues,
  };
}

async function auditSitemap(): Promise<{
  entryCount: number;
  validEntries: number;
  invalidEntries: Array<{ pageSlug: string; issue: string }>;
  duplicateUrls: string[];
}> {
  const pages = await db.seoPage.findMany({
    where: { isPublished: true, noindex: false, featuredImage: { not: null } },
    select: {
      pageType: true,
      pageSlug: true,
      canonicalUrl: true,
      featuredImage: true,
      imageAlt: true,
      imageTitle: true,
      imageCaption: true,
      title: true,
    },
  });

  const invalidEntries: Array<{ pageSlug: string; issue: string }> = [];
  const imageUrls: string[] = [];
  let validEntries = 0;

  for (const page of pages) {
    if (!page.featuredImage?.trim()) {
      invalidEntries.push({ pageSlug: page.pageSlug, issue: "Empty featuredImage" });
      continue;
    }
    const imageUrl = resolveSeoImageUrl(page.featuredImage, SITE_ORIGIN);
    const abs = imageUrl.startsWith("http") ? imageUrl : absoluteUrl(imageUrl);
    if (!abs.startsWith("http")) {
      invalidEntries.push({ pageSlug: page.pageSlug, issue: "Invalid image URL" });
      continue;
    }
    if (!page.imageAlt?.trim() && !page.title?.trim()) {
      invalidEntries.push({ pageSlug: page.pageSlug, issue: "Missing image title/alt metadata" });
    }
    imageUrls.push(abs);
    validEntries++;
  }

  const counts = new Map<string, number>();
  for (const url of imageUrls) {
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }
  const duplicateUrls = [...counts.entries()].filter(([, n]) => n > 1).map(([url]) => url);

  return {
    entryCount: pages.filter((p) => p.featuredImage?.trim()).length,
    validEntries,
    invalidEntries: invalidEntries.slice(0, 30),
    duplicateUrls: duplicateUrls.slice(0, 20),
  };
}

function summarizeByType(rows: ImageAuditRow[]) {
  const byType: Record<string, { total: number; pass: number; withImage: number; placeholder: number }> = {};
  for (const row of rows) {
    if (!byType[row.pageType]) {
      byType[row.pageType] = { total: 0, pass: 0, withImage: 0, placeholder: 0 };
    }
    const b = byType[row.pageType]!;
    b.total++;
    if (row.pass) b.pass++;
    if (row.featuredImage?.trim()) b.withImage++;
    if (row.isPlaceholder) b.placeholder++;
  }
  return byType;
}

async function auditLiveMeta() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const results: Array<{
    slug: string;
    path: string;
    ogImage: string | null;
    twitterImage: string | null;
    imgAlt: string | null;
    imgWidth: string | null;
    screenshot: string;
  }> = [];

  try {
    const page = await browser.newPage();
    for (const city of FALLBACK_CITIES) {
      await page.goto(`${BASE}${city.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1500);

      const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => null);
      const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute("content").catch(() => null);
      const imgAlt = await page.locator("figure img").first().getAttribute("alt").catch(() => null);
      const imgWidth = await page.locator("figure img").first().getAttribute("width").catch(() => null);

      const screenshot = path.join(OUT_DIR, `${city.slug}-image-seo.png`);
      await page.screenshot({ path: screenshot, fullPage: false, timeout: 15000 }).catch(async () => {
        await page.screenshot({ path: screenshot, fullPage: false });
      });

      results.push({
        slug: city.slug,
        path: city.path,
        ogImage,
        twitterImage,
        imgAlt,
        imgWidth,
        screenshot: path.relative(process.cwd(), screenshot),
      });
    }
  } finally {
    await browser.close();
  }

  return results;
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

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

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

  const auditPage = (p: (typeof pages)[number]) => auditDbPage(p);
  const dbAudits = LIVE
    ? await runInBatches(pages, 12, auditPage)
    : await Promise.all(pages.map(auditPage));
  const fallbackAudits = await Promise.all(
    FALLBACK_CITIES.map((c) => auditFallbackCity(c.slug, c.path)),
  );
  const sitemap = await auditSitemap();

  const duplicateFeatured = new Map<string, string[]>();
  for (const p of pages) {
    if (!p.featuredImage?.trim()) continue;
    const url = resolveSeoImageUrl(p.featuredImage, SITE_ORIGIN);
    const list = duplicateFeatured.get(url) ?? [];
    list.push(`${p.pageType}/${p.pageSlug}`);
    duplicateFeatured.set(url, list);
  }
  const duplicateImageUrls = [...duplicateFeatured.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([url, slugs]) => ({ url, pages: slugs.slice(0, 5), count: slugs.length }));

  const brokenImages = dbAudits.filter((a) => a.imageReachable === false);
  const byType = summarizeByType(dbAudits);

  let liveMeta: Awaited<ReturnType<typeof auditLiveMeta>> | undefined;
  if (LIVE) {
    await waitForServer();
    liveMeta = await auditLiveMeta();
  }

  const imageObjectExample = dbAudits.find((a) => a.imageObjectValid);
  const schemas = resolveSeoPageSchemasForView({
    page: {
      title: "Example",
      metaDescription: "Example",
      h1: "Example",
      pageType: "longtail",
      pageSlug: "independent-escorts/mumbai",
      canonicalUrl: "/independent-escorts/mumbai",
      customData: null,
      featuredImage: null,
      imageAlt: "Example alt",
      faqs: [],
    },
    breadcrumbs: [{ label: "Home", href: "/" }],
  });
  const exampleImageObject = schemas.find((s) => (s as { "@type"?: string })["@type"] === "ImageObject");

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPages: pages.length,
      dbPass: dbAudits.filter((a) => a.pass).length,
      dbFail: dbAudits.filter((a) => !a.pass).length,
      withFeaturedImage: pages.filter((p) => p.featuredImage?.trim()).length,
      usingPlaceholder: dbAudits.filter((a) => a.isPlaceholder).length,
      fallbackCitiesPass: `${fallbackAudits.filter((a) => a.pass).length}/${fallbackAudits.length}`,
      brokenImageCount: brokenImages.length,
      duplicateImageUrlGroups: duplicateImageUrls.length,
    },
    passFailByPageType: Object.fromEntries(
      Object.entries(byType).map(([type, stats]) => [
        type,
        {
          ...stats,
          status: stats.pass === stats.total ? "PASS" : stats.pass > 0 ? "PARTIAL" : "FAIL",
        },
      ]),
    ),
    imageCounts: {
      totalPages: pages.length,
      withStoredImage: pages.filter((p) => p.featuredImage?.trim()).length,
      withoutStoredImage: pages.filter((p) => !p.featuredImage?.trim()).length,
      sitemapEntries: sitemap.entryCount,
    },
    sitemapReport: sitemap,
    duplicateImageUrls: duplicateImageUrls.slice(0, 15),
    brokenImageReport: brokenImages.slice(0, 20),
    fallbackCityAudits: fallbackAudits,
    imageObjectExample: exampleImageObject,
    liveMeta,
    fixesApplied: [
      "Added SEO_IMAGE_WIDTH/HEIGHT and buildImageObjectSchema() with width/height/alt",
      "ImageObject always resolved at render (incl. placeholder for fallback pages)",
      "Fixed sitemap-seo-images.xml page URLs via getSeoPagePublicUrl()",
      "OG metadata uses standard 1200×630 dimensions",
    ],
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SEO Image Audit</title>
<style>body{font-family:system-ui;background:#0b0b0f;color:#f5f5f7;padding:24px;max-width:960px;margin:0 auto}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #333;padding:8px}th{background:#15151d}.pass{color:#4ade80}.fail{color:#f87171}
pre{background:#15151d;padding:12px;overflow:auto;font-size:12px}</style></head><body>
<h1>SEO Image Audit</h1>
<p>DB pass: ${report.summary.dbPass}/${report.summary.totalPages} | Fallback: ${report.summary.fallbackCitiesPass} | Sitemap entries: ${sitemap.entryCount}</p>
<h2>Pass/Fail by page type</h2>
<table><tr><th>Type</th><th>Pass</th><th>Total</th><th>With image</th><th>Status</th></tr>
${Object.entries(report.passFailByPageType).map(([t,s])=>`<tr><td>${t}</td><td>${(s as {pass:number}).pass}</td><td>${(s as {total:number}).total}</td><td>${(s as {withImage:number}).withImage}</td><td class="${(s as {status:string}).status==="PASS"?"pass":"fail"}">${(s as {status:string}).status}</td></tr>`).join("")}
</table>
<h2>Fallback cities</h2>
<table><tr><th>City</th><th>OG image</th><th>Alt</th><th>Pass</th></tr>
${fallbackAudits.map(c=>`<tr><td>${c.publicPath}</td><td>${c.ogImage ? "✓" : "✗"}</td><td>${c.imageAlt.slice(0,40)}…</td><td class="${c.pass?"pass":"fail"}">${c.pass?"PASS":"FAIL"}</td></tr>`).join("")}
</table>
<h2>Live fallback screenshots</h2>
${(liveMeta ?? []).map((m) => `<figure><figcaption>${m.path}</figcaption><img src="${m.screenshot.replace(/\\/g, "/")}" alt="${m.slug} SEO screenshot" width="640"/></figure>`).join("")}
<h2>Live social meta (fallback cities)</h2>
<table><tr><th>City</th><th>og:image</th><th>twitter:image</th><th>img alt</th><th>width</th></tr>
${(liveMeta ?? []).map((m) => `<tr><td>${m.slug}</td><td>${m.ogImage ? "✓" : "✗"}</td><td>${m.twitterImage ? "✓" : "✗"}</td><td>${(m.imgAlt || "").slice(0, 50)}</td><td>${m.imgWidth ?? "—"}</td></tr>`).join("")}
</table>
<h2>Broken images (${brokenImages.length})</h2>
${brokenImages.length === 0 ? "<p class=\"pass\">None</p>" : `<ul>${brokenImages.slice(0, 10).map((b) => `<li>${b.publicPath}: ${b.issues.join(", ")}</li>`).join("")}</ul>`}
<h2>ImageObject example</h2>
<pre>${JSON.stringify(exampleImageObject || {}, null, 2)}</pre>
</body></html>`;

  writeFileSync(path.join(OUT_DIR, "report.html"), html);

  console.log("\n=== SEO Image Audit ===\n");
  console.log(`DB pages pass: ${report.summary.dbPass}/${report.summary.totalPages}`);
  console.log(`With stored featuredImage: ${report.summary.withFeaturedImage}`);
  console.log(`Fallback cities: ${report.summary.fallbackCitiesPass}`);
  console.log(`Sitemap entries: ${sitemap.entryCount} (${sitemap.validEntries} valid)`);
  console.log(`Duplicate image URL groups: ${duplicateImageUrls.length}`);
  console.log(`Report: ${path.join(OUT_DIR, "report.json")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

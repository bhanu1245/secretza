/**
 * Verify SEO pages have all required fields for search/social indexing.
 * Run: bun run scripts/verify-seo-pages.ts
 */
import { db } from "../src/lib/db";
import { resolveSeoImageUrl } from "../src/lib/seo-images";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com";

type CheckResult = {
  pageType: string;
  pageSlug: string;
  missing: string[];
};

function hasSchemaWithImage(customData: string | null): boolean {
  if (!customData?.trim()) return false;
  try {
    const parsed = JSON.parse(customData) as { schemas?: Array<{ "@type"?: string }> };
    return Array.isArray(parsed.schemas) &&
      parsed.schemas.some((s) => s["@type"] === "ImageObject");
  } catch {
    return false;
  }
}

async function main() {
  const pages = await db.seoPage.findMany({
    orderBy: [{ pageType: "asc" }, { pageSlug: "asc" }],
  });

  const byType: Record<string, { total: number; complete: number; withImage: number }> = {};
  const incomplete: CheckResult[] = [];

  for (const page of pages) {
    const missing: string[] = [];
    if (!page.title?.trim()) missing.push("title");
    if (!page.metaDescription?.trim()) missing.push("metaDescription");
    if (!page.h1?.trim()) missing.push("h1");
    if (!page.introContent?.trim()) missing.push("introContent");
    if (!page.featuredImage?.trim()) missing.push("featuredImage");
    if (!page.imageAlt?.trim()) missing.push("imageAlt");
    if (!page.canonicalUrl?.trim()) missing.push("canonicalUrl");
    if (!hasSchemaWithImage(page.customData)) missing.push("schemaImageObject");
    if (!resolveSeoImageUrl(page.featuredImage, SITE_ORIGIN)) missing.push("ogImage");

    if (!byType[page.pageType]) {
      byType[page.pageType] = { total: 0, complete: 0, withImage: 0 };
    }
    byType[page.pageType].total++;
    if (page.featuredImage?.trim()) byType[page.pageType].withImage++;
    if (missing.length === 0) byType[page.pageType].complete++;

    if (missing.length > 0) {
      incomplete.push({ pageType: page.pageType, pageSlug: page.pageSlug, missing });
    }
  }

  console.log("\n=== SEO Page Verification Report ===\n");
  console.log(`Total pages: ${pages.length}`);
  console.log(`Fully complete: ${pages.length - incomplete.length}`);
  console.log(`Incomplete: ${incomplete.length}\n`);

  console.log("By page type:");
  for (const [type, stats] of Object.entries(byType).sort()) {
    console.log(
      `  ${type.padEnd(15)} total=${stats.total} complete=${stats.complete} withImage=${stats.withImage}`,
    );
  }

  if (incomplete.length > 0) {
    console.log("\nSample incomplete pages (first 15):");
    for (const row of incomplete.slice(0, 15)) {
      console.log(`  [${row.pageType}] ${row.pageSlug} — missing: ${row.missing.join(", ")}`);
    }
  }

  const sampleComplete = pages.find(
    (p) =>
      p.title &&
      p.metaDescription &&
      p.h1 &&
      p.introContent &&
      p.featuredImage &&
      p.imageAlt &&
      p.canonicalUrl &&
      hasSchemaWithImage(p.customData),
  );

  if (sampleComplete) {
    const ogImage = resolveSeoImageUrl(sampleComplete.featuredImage, SITE_ORIGIN);
    console.log("\nSample complete page:");
    console.log(`  Type: ${sampleComplete.pageType}`);
    console.log(`  Slug: ${sampleComplete.pageSlug}`);
    console.log(`  Title: ${sampleComplete.title}`);
    console.log(`  Canonical: ${sampleComplete.canonicalUrl}`);
    console.log(`  OG Image: ${ogImage.startsWith("http") ? ogImage : SITE_ORIGIN + ogImage}`);
    console.log(`  Alt: ${sampleComplete.imageAlt}`);
  }

  await db.$disconnect();
  process.exit(incomplete.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});

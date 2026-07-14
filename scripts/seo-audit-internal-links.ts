/**
 * Build-time internal link audit — verifies stored metrics match intro markdown counts.
 * Usage: bun run seo:audit-internal-links
 */
import { db } from "@/lib/db";
import {
  calculateInternalLinksCount,
  MIN_INTERNAL_LINKS_PER_PAGE,
} from "@/lib/seo-internal-links";

async function main() {
  const pages = await db.seoPage.findMany({
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      internalLinksCount: true,
      introContent: true,
    },
  });

  const belowThreshold: Array<{
    pageType: string;
    pageSlug: string;
    actual: number;
    stored: number | null;
  }> = [];
  const staleMetrics: Array<{
    pageType: string;
    pageSlug: string;
    actual: number;
    stored: number | null;
  }> = [];
  let incorrectlyFlagged = 0;

  for (const p of pages) {
    const actual = calculateInternalLinksCount(p.introContent);
    const stored = p.internalLinksCount;

    if (actual < MIN_INTERNAL_LINKS_PER_PAGE) {
      belowThreshold.push({
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        actual,
        stored,
      });
    }

    if (stored !== null && stored !== actual) {
      staleMetrics.push({
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        actual,
        stored,
      });
    }

    const flaggedLow = (stored ?? 0) < MIN_INTERNAL_LINKS_PER_PAGE;
    const actuallyLow = actual < MIN_INTERNAL_LINKS_PER_PAGE;
    if (flaggedLow !== actuallyLow) incorrectlyFlagged++;
  }

  const report = {
    total: pages.length,
    threshold: MIN_INTERNAL_LINKS_PER_PAGE,
    belowThreshold: belowThreshold.length,
    staleMetrics: staleMetrics.length,
    incorrectlyFlagged,
    belowSamples: belowThreshold.slice(0, 15),
    staleSamples: staleMetrics.slice(0, 10),
  };

  if (belowThreshold.length > 0 || staleMetrics.length > 0 || incorrectlyFlagged > 0) {
    console.error(JSON.stringify({ error: "SEO_INTERNAL_LINKS_AUDIT_FAILED", ...report }, null, 2));
    await db.$disconnect();
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

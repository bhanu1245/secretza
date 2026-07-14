/**
 * Build-time word count audit — verifies stored metrics match visible text counts.
 * Usage: bun run seo:audit-wordcount
 */
import { db } from "@/lib/db";
import {
  calculateVisibleWordCount,
  SEO_MIN_WORD_COUNT,
} from "@/lib/seo-quality";

async function main() {
  const pages = await db.seoPage.findMany({
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      wordCount: true,
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
    const actual = calculateVisibleWordCount(p.introContent);
    const stored = p.wordCount;

    if (actual < SEO_MIN_WORD_COUNT) {
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

    const flaggedThin = (stored ?? 0) < SEO_MIN_WORD_COUNT;
    const actuallyThin = actual < SEO_MIN_WORD_COUNT;
    if (flaggedThin !== actuallyThin) incorrectlyFlagged++;
  }

  const report = {
    total: pages.length,
    threshold: SEO_MIN_WORD_COUNT,
    belowThreshold: belowThreshold.length,
    staleMetrics: staleMetrics.length,
    incorrectlyFlagged,
    belowSamples: belowThreshold.slice(0, 15),
    staleSamples: staleMetrics.slice(0, 10),
  };

  if (belowThreshold.length > 0 || staleMetrics.length > 0 || incorrectlyFlagged > 0) {
    console.error(JSON.stringify({ error: "SEO_WORDCOUNT_AUDIT_FAILED", ...report }, null, 2));
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

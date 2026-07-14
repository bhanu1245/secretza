/**
 * Recalculate and persist wordCount from introContent for every SeoPage.
 * Regenerates thin shell pages (country/state/category/city) that are below threshold.
 */
import { db } from "@/lib/db";
import {
  calculateVisibleWordCount,
  SEO_MIN_WORD_COUNT,
} from "@/lib/seo-quality";
import { regenerateSeoPageById } from "@/lib/seo-regeneration-service";

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

  let synced = 0;
  let regenerated = 0;
  let regenFailed = 0;
  let stillBelow = 0;

  for (const page of pages) {
    const actual = calculateVisibleWordCount(page.introContent);

    if (actual < SEO_MIN_WORD_COUNT) {
      const result = await regenerateSeoPageById(page.id);
      if (result.ok && !result.skipped) {
        regenerated++;
        const updated = await db.seoPage.findUnique({
          where: { id: page.id },
          select: { introContent: true, wordCount: true },
        });
        const after = calculateVisibleWordCount(updated?.introContent);
        if (after < SEO_MIN_WORD_COUNT) stillBelow++;
      } else {
        regenFailed++;
      }
      continue;
    }

    if (page.wordCount !== actual) {
      await db.seoPage.update({
        where: { id: page.id },
        data: { wordCount: actual },
      });
      synced++;
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: pages.length,
        metricsSynced: synced,
        regenerated,
        regenFailed,
        stillBelowThreshold: stillBelow,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

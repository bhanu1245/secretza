/**
 * Recalculate and persist internalLinksCount from visible intro markdown for every SeoPage.
 * Regenerates pages still below the internal link threshold.
 */
import { db } from "@/lib/db";
import {
  calculateInternalLinksCount,
  MIN_INTERNAL_LINKS_PER_PAGE,
} from "@/lib/seo-internal-links";
import { regenerateSeoPageById } from "@/lib/seo-regeneration-service";

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

  let synced = 0;
  let regenerated = 0;
  let regenFailed = 0;
  let stillBelow = 0;
  const beforeSamples: Array<{
    pageType: string;
    pageSlug: string;
    stored: number | null;
    actual: number;
  }> = [];
  const afterSamples: Array<{
    pageType: string;
    pageSlug: string;
    stored: number | null;
    actual: number;
  }> = [];

  for (const page of pages) {
    const actual = calculateInternalLinksCount(page.introContent);
    const stored = page.internalLinksCount;
    const needsRegen = actual < MIN_INTERNAL_LINKS_PER_PAGE;
    const staleOnly = !needsRegen && stored !== actual;

    if (needsRegen) {
      if (beforeSamples.length < 5) {
        beforeSamples.push({
          pageType: page.pageType,
          pageSlug: page.pageSlug,
          stored,
          actual,
        });
      }

      const result = await regenerateSeoPageById(page.id);
      if (result.ok && !result.skipped) {
        regenerated++;
        const updated = await db.seoPage.findUnique({
          where: { id: page.id },
          select: { introContent: true, internalLinksCount: true },
        });
        const after = calculateInternalLinksCount(updated?.introContent);
        if (afterSamples.length < 5) {
          afterSamples.push({
            pageType: page.pageType,
            pageSlug: page.pageSlug,
            stored: updated?.internalLinksCount ?? null,
            actual: after,
          });
        }
        if (after < MIN_INTERNAL_LINKS_PER_PAGE) stillBelow++;
      } else {
        regenFailed++;
      }
      continue;
    }

    if (staleOnly) {
      await db.seoPage.update({
        where: { id: page.id },
        data: { internalLinksCount: actual },
      });
      synced++;
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: pages.length,
        threshold: MIN_INTERNAL_LINKS_PER_PAGE,
        metricsSynced: synced,
        regenerated,
        regenFailed,
        stillBelowThreshold: stillBelow,
        beforeSamples,
        afterSamples,
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

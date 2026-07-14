/**
 * Recalculate and persist contentHash from final introContent for every SeoPage.
 */
import { db } from "@/lib/db";
import { computeContentHash } from "@/lib/seo-quality";

async function main() {
  const pages = await db.seoPage.findMany({
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      contentHash: true,
      introContent: true,
    },
  });

  let synced = 0;
  let unchanged = 0;
  const beforeSamples: Array<{
    pageType: string;
    pageSlug: string;
    stored: string | null;
    actual: string;
  }> = [];

  for (const page of pages) {
    const actual = computeContentHash(page.introContent);
    if (page.contentHash !== actual) {
      if (beforeSamples.length < 5) {
        beforeSamples.push({
          pageType: page.pageType,
          pageSlug: page.pageSlug,
          stored: page.contentHash,
          actual,
        });
      }
      await db.seoPage.update({
        where: { id: page.id },
        data: { contentHash: actual },
      });
      synced++;
    } else {
      unchanged++;
    }
  }

  const groupRows = await db.$queryRaw<Array<{ groups: bigint }>>`
    SELECT COUNT(*) as groups FROM (
      SELECT contentHash FROM SeoPage
      WHERE contentHash IS NOT NULL AND TRIM(contentHash) != ''
      GROUP BY contentHash HAVING COUNT(*) > 1
    )`;
  const dupPageRows = await db.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM SeoPage
    WHERE contentHash IS NOT NULL AND TRIM(contentHash) != ''
    AND contentHash IN (
      SELECT contentHash FROM SeoPage
      WHERE contentHash IS NOT NULL AND TRIM(contentHash) != ''
      GROUP BY contentHash HAVING COUNT(*) > 1
    )`;

  console.log(
    JSON.stringify(
      {
        scanned: pages.length,
        hashesSynced: synced,
        hashesUnchanged: unchanged,
        duplicateGroupsAfter: Number(groupRows[0]?.groups ?? 0),
        pagesWithDuplicateContentAfter: Number(dupPageRows[0]?.cnt ?? 0),
        beforeSamples,
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

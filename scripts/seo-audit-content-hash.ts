/**
 * Build-time audit — verifies stored contentHash matches introContent.
 * Usage: bun run seo:audit-content-hash
 */
import { db } from "@/lib/db";
import { computeContentHash } from "@/lib/seo-quality";

async function main() {
  const pages = await db.seoPage.findMany({
    select: {
      pageType: true,
      pageSlug: true,
      contentHash: true,
      introContent: true,
    },
  });

  const staleMetrics: Array<{
    pageType: string;
    pageSlug: string;
    stored: string | null;
    actual: string;
  }> = [];

  for (const p of pages) {
    const actual = computeContentHash(p.introContent);
    if (p.contentHash !== actual) {
      staleMetrics.push({
        pageType: p.pageType,
        pageSlug: p.pageSlug,
        stored: p.contentHash,
        actual,
      });
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

  const report = {
    total: pages.length,
    staleMetrics: staleMetrics.length,
    duplicateGroups: Number(groupRows[0]?.groups ?? 0),
    pagesWithDuplicateContent: Number(dupPageRows[0]?.cnt ?? 0),
    staleSamples: staleMetrics.slice(0, 10),
  };

  if (staleMetrics.length > 0) {
    console.error(JSON.stringify({ error: "SEO_CONTENT_HASH_AUDIT_FAILED", ...report }, null, 2));
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

/**
 * Backfill featured images for SEO pages missing them.
 * Run: bun run scripts/backfill-seo-images.ts
 */
import { generateMissingSeoImages } from "../src/lib/seo-page-service";
import { db } from "../src/lib/db";

async function main() {
  let totalUpdated = 0;
  let batch = 0;

  while (batch < 20) {
    const result = await generateMissingSeoImages({ limit: 100 });
    if (result.updated === 0) break;
    totalUpdated += result.updated;
    batch++;
    console.log(`Batch ${batch}: generated ${result.updated} image(s)`);
  }

  const remaining = await db.seoPage.count({
    where: { OR: [{ featuredImage: null }, { featuredImage: "" }] },
  });

  console.log(`\nDone. Total updated: ${totalUpdated}. Remaining without image: ${remaining}`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});

/**
 * One-shot migration: fix country canonicals + archive orphan SeoPages.
 */
import { db } from "@/lib/db";
import {
  repairSeoPageCanonicalUrls,
  archiveUnroutableSeoPages,
  assertAllSeoPagesRoutable,
} from "@/lib/seo-route-validation";

async function main() {
  const beforeWrong = await db.seoPage.count({
    where: {
      pageType: "country",
      NOT: { canonicalUrl: { startsWith: "/country/" } },
    },
  });

  const canonical = await repairSeoPageCanonicalUrls();
  const archived = await archiveUnroutableSeoPages();
  const audit = await assertAllSeoPagesRoutable();

  const afterWrong = await db.seoPage.count({
    where: {
      pageType: "country",
      NOT: { canonicalUrl: { startsWith: "/country/" } },
    },
  });

  console.log(
    JSON.stringify(
      {
        countryWrongCanonicalBefore: beforeWrong,
        countryWrongCanonicalAfter: afterWrong,
        canonicalRepaired: canonical.repaired,
        pagesArchived: archived.archived,
        invalidRemaining: audit.invalid.length,
        sitemap404sEliminated: beforeWrong,
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

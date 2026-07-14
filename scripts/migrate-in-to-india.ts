/**
 * Global migration: replace legacy /in/ paths with /india/ in stored SEO content.
 * Usage: bun run scripts/migrate-in-to-india.ts
 */
import { db } from "@/lib/db";
import {
  rewriteLegacyInPaths,
  sanitizeStoredIntroContent,
  sanitizeStoredCustomData,
} from "@/lib/seo-internal-links";

async function main() {
  const pages = await db.seoPage.findMany({
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      introContent: true,
      customData: true,
    },
  });

  let pagesScanned = pages.length;
  let pagesUpdated = 0;
  let linksReplaced = 0;

  for (const page of pages) {
    let changed = false;
    const data: { introContent?: string; customData?: string | null } = {};

    if (page.introContent?.includes("/in/")) {
      const beforeCount = (page.introContent.match(/\/in\//g) ?? []).length;
      const sanitized = await sanitizeStoredIntroContent(
        page.introContent,
        page.pageType,
        page.pageSlug,
      );
      const afterCount = (sanitized.match(/\/in\//g) ?? []).length;
      linksReplaced += beforeCount - afterCount;
      if (sanitized !== page.introContent) {
        data.introContent = sanitized;
        changed = true;
      }
    }

    if (page.customData?.includes("/in/")) {
      const beforeCount = (page.customData.match(/\/in\//g) ?? []).length;
      const sanitized = sanitizeStoredCustomData(page.customData);
      const afterCount = sanitized ? (sanitized.match(/\/in\//g) ?? []).length : 0;
      linksReplaced += beforeCount - afterCount;
      if (sanitized !== page.customData) {
        data.customData = sanitized;
        changed = true;
      }
    }

    if (changed) {
      await db.seoPage.update({ where: { id: page.id }, data });
      pagesUpdated++;
    }
  }

  // Verify
  const remaining = await db.seoPage.count({
    where: {
      OR: [
        { introContent: { contains: "/in/" } },
        { customData: { contains: "/in/" } },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        pagesScanned,
        pagesUpdated,
        linksReplaced,
        remainingWithInPaths: remaining,
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

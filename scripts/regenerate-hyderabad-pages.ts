/**
 * Force-regenerate key Hyderabad SEO pages and verify no /in/ paths remain.
 */
import { db } from "@/lib/db";
import { regenerateSeoPageById } from "@/lib/seo-regeneration-service";

const SLUGS = [
  "vip-escorts/hyderabad",
  "female-escorts/hyderabad",
  "independent-escorts/hyderabad",
  "russian-escorts/hyderabad",
];

async function main() {
  for (const pageSlug of SLUGS) {
    const page = await db.seoPage.findFirst({
      where: { pageType: "longtail", pageSlug },
      select: { id: true, introContent: true },
    });
    if (!page) {
      console.log(`MISSING: longtail/${pageSlug}`);
      continue;
    }

    const before = (page.introContent?.match(/\/in\//g) ?? []).length;
    const result = await regenerateSeoPageById(page.id);
    const updated = await db.seoPage.findUnique({
      where: { id: page.id },
      select: { introContent: true },
    });
    const after = (updated?.introContent?.match(/\/in\//g) ?? []).length;

    console.log(
      JSON.stringify({
        pageSlug,
        regenOk: result.ok,
        inPathsBefore: before,
        inPathsAfter: after,
        hasIndia: updated?.introContent?.includes("/india/") ?? false,
      }),
    );
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

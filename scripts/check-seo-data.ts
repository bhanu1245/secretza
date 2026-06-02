import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const grouped = await db.seoPage.groupBy({
    by: ["pageType"],
    _count: true,
  });
  const indiaStates = await db.state.count({
    where: { isActive: true, country: { slug: "india" } },
  });
  const samples = await Promise.all(
    ["city", "category", "category_city", "state", "country", "longtail"].map(async (pageType) => {
      const page = await db.seoPage.findFirst({
        where: { pageType },
        select: { pageType: true, pageSlug: true, canonicalUrl: true, title: true },
      });
      return page;
    }),
  );
  console.log(JSON.stringify({ grouped, indiaStates, samples: samples.filter(Boolean) }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

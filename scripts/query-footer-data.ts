import { db } from "../src/lib/db";

async function main() {
  const cats = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { order: "asc" },
  });
  const cms = await db.$queryRaw<Array<{ slug: string; title: string; isPublished: number }>>`
    SELECT slug, title, isPublished FROM CmsPage
  `;
  const cities = await db.city.findMany({
    where: {
      slug: { in: ["mumbai", "delhi", "new-delhi", "bangalore", "hyderabad", "chennai", "kolkata"] },
      isActive: true,
    },
    include: { state: { include: { country: true } } },
  });
  const settings = await db.siteSettings.findMany({
    where: { key: { contains: "social" } },
  });
  console.log(JSON.stringify({ cats, cms, cities: cities.map((c) => ({
    slug: c.slug,
    path: `/${c.state.country.slug}/${c.state.slug}/${c.slug}`,
  })), settings }, null, 2));
}

main().finally(() => db.$disconnect());

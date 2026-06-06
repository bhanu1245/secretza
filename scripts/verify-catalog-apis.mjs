/**
 * Verify rolled-back category/location APIs return expected shapes.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

async function categoriesHandler() {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { order: "asc" },
    include: {
      children: { where: { isActive: true }, orderBy: { order: "asc" } },
    },
  });
  const categoryIds = categories.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)]);
  const counts = categoryIds.length
    ? await db.listing.groupBy({
        by: ["categoryId"],
        where: { status: "approved", categoryId: { in: categoryIds } },
        _count: { _all: true },
      })
    : [];
  const subcategoryCounts = categoryIds.length
    ? await db.listing.groupBy({
        by: ["subcategoryId"],
        where: { status: "approved", subcategoryId: { in: categoryIds } },
        _count: { _all: true },
      })
    : [];
  const countByCategory = new Map();
  for (const count of counts) {
    countByCategory.set(count.categoryId, (countByCategory.get(count.categoryId) || 0) + count._count._all);
  }
  for (const count of subcategoryCounts) {
    if (!count.subcategoryId) continue;
    countByCategory.set(count.subcategoryId, (countByCategory.get(count.subcategoryId) || 0) + count._count._all);
  }
  const withCounts = categories.map((category) => {
    const children = category.children.map((child) => ({
      ...child,
      listingCount: countByCategory.get(child.id) || 0,
    }));
    return {
      ...category,
      children,
      listingCount:
        (countByCategory.get(category.id) || 0) +
        children.reduce((sum, child) => sum + child.listingCount, 0),
    };
  });
  return { categories: withCounts, total: withCounts.length };
}

async function publicLocationsHandler() {
  const [countries, states, cities, areas] = await Promise.all([
    db.listing.groupBy({ by: ["countryId"], where: { status: "approved" }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["stateId"], where: { status: "approved", stateId: { not: null } }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["cityId"], where: { status: "approved" }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["areaId"], where: { status: "approved", areaId: { not: null } }, _count: { _all: true } }),
  ]);
  const cMap = new Map(countries.map((r) => [r.countryId, r._count._all]));
  const sMap = new Map(states.flatMap((r) => (r.stateId ? [[r.stateId, r._count._all]] : [])));
  const ciMap = new Map(cities.map((r) => [r.cityId, r._count._all]));
  const aMap = new Map(areas.flatMap((r) => (r.areaId ? [[r.areaId, r._count._all]] : [])));
  const rows = await db.country.findMany({
    where: { isActive: true },
    orderBy: [{ listingCount: "desc" }, { name: "asc" }],
    include: {
      states: {
        where: { isActive: true },
        orderBy: [{ listingCount: "desc" }, { name: "asc" }],
        include: {
          cities: {
            where: { isActive: true },
            orderBy: [{ listingCount: "desc" }, { name: "asc" }],
            include: {
              areas: { where: { isActive: true }, orderBy: [{ listingCount: "desc" }, { name: "asc" }] },
            },
          },
        },
      },
    },
  });
  return {
    countries: rows.map((co) => ({
      ...co,
      listingCount: cMap.get(co.id) || 0,
      states: co.states.map((st) => ({
        ...st,
        listingCount: sMap.get(st.id) || 0,
        cities: st.cities.map((ci) => ({
          ...ci,
          listingCount: ciMap.get(ci.id) || 0,
          areas: ci.areas.map((a) => ({ ...a, listingCount: aMap.get(a.id) || 0 })),
        })),
      })),
    })),
    total: rows.length,
  };
}

const cat = await categoriesHandler();
const loc = await publicLocationsHandler();

const sampleCountry = loc.countries[0];
const sampleState = sampleCountry?.states?.[0];
const sampleCity = sampleState?.cities?.[0];
const sampleArea = sampleCity?.areas?.[0];

console.log("=== CATEGORIES ===");
console.log(`total: ${cat.total}`);
console.log(
  "sample:",
  JSON.stringify(
    cat.categories.slice(0, 2).map((c) => ({
      name: c.name,
      slug: c.slug,
      listingCount: c.listingCount,
      children: c.children.map((ch) => ({ name: ch.name, slug: ch.slug })),
    })),
    null,
    2,
  ),
);

console.log("\n=== PUBLIC LOCATIONS ===");
console.log(`total countries: ${loc.total}`);
console.log(
  "sample chain:",
  JSON.stringify(
    {
      country: sampleCountry ? { name: sampleCountry.name, slug: sampleCountry.slug, states: sampleCountry.states?.length } : null,
      state: sampleState ? { name: sampleState.name, slug: sampleState.slug, cities: sampleState.cities?.length } : null,
      city: sampleCity ? { name: sampleCity.name, slug: sampleCity.slug, areas: sampleCity.areas?.length } : null,
      area: sampleArea ? { name: sampleArea.name, slug: sampleArea.slug } : null,
    },
    null,
    2,
  ),
);

const checks = [
  ["categories.total > 0", cat.total > 0],
  ["categories[0].children array", Array.isArray(cat.categories[0]?.children)],
  ["countries.total > 0", loc.total > 0],
  ["country has states[]", Array.isArray(sampleCountry?.states) && sampleCountry.states.length > 0],
  ["state has cities[]", Array.isArray(sampleState?.cities) && sampleState.cities.length > 0],
  ["city has areas[]", Array.isArray(sampleCity?.areas)],
];

console.log("\n=== CHECKS ===");
let allOk = true;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) allOk = false;
}
console.log(allOk ? "\nAll catalog checks passed." : "\nSome checks failed.");
process.exit(allOk ? 0 : 1);

await db.$disconnect();

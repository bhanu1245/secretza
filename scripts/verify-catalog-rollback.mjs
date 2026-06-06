/**
 * Verify category/location APIs after rollback (direct DB route logic).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

async function getCategories() {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { order: "asc" },
    include: { children: { where: { isActive: true }, orderBy: { order: "asc" } } },
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
  return categories.map((category) => {
    const children = category.children.map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      listingCount: countByCategory.get(child.id) || 0,
    }));
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      listingCount:
        (countByCategory.get(category.id) || 0) +
        children.reduce((sum, child) => sum + child.listingCount, 0),
      children,
    };
  });
}

async function getPublicLocations() {
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
  return rows.map((co) => ({
    id: co.id,
    name: co.name,
    slug: co.slug,
    listingCount: cMap.get(co.id) || 0,
    stateCount: co.states.length,
    firstState: co.states[0]
      ? {
          name: co.states[0].name,
          slug: co.states[0].slug,
          cityCount: co.states[0].cities.length,
          firstCity: co.states[0].cities[0]
            ? { name: co.states[0].cities[0].name, areaCount: co.states[0].cities[0].areas.length }
            : null,
        }
      : null,
  }));
}

const categories = await getCategories();
const locations = await getPublicLocations();

console.log("CATEGORIES_OK:", categories.length > 0);
console.log("CATEGORIES_SAMPLE:", JSON.stringify(categories.slice(0, 2), null, 2));
console.log("LOCATIONS_OK:", locations.length > 0);
console.log("LOCATIONS_SAMPLE:", JSON.stringify(locations.slice(0, 2), null, 2));

const india = locations.find((c) => c.slug === "india") || locations[0];
const hasHierarchy =
  india &&
  india.stateCount > 0 &&
  india.firstState &&
  india.firstState.cityCount > 0;
console.log("HIERARCHY_OK:", Boolean(hasHierarchy));

await db.$disconnect();

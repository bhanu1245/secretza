/**
 * Direct catalog function benchmark (no HTTP) — measures DB query count + latency.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["query"] });

let queryCount = 0;
db.$on("query", () => {
  queryCount++;
});

async function withQueryCount(label, fn) {
  queryCount = 0;
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  const size = JSON.stringify(result).length;
  console.log(`${label.padEnd(42)} queries=${String(queryCount).padStart(2)}  ${ms}ms  payload=${(size / 1024).toFixed(1)}KB`);
  return { queries: queryCount, ms, size };
}

async function categoriesOptimized() {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { order: "asc" },
    include: { children: { where: { isActive: true }, orderBy: { order: "asc" } } },
  });
  return categories.map((c) => ({
    ...c,
    children: c.children.map((ch) => ({ ...ch, listingCount: ch.listingCount })),
    listingCount: c.listingCount + c.children.reduce((s, ch) => s + ch.listingCount, 0),
  }));
}

async function categoriesLegacy() {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { order: "asc" },
    include: { children: { where: { isActive: true }, orderBy: { order: "asc" } } },
  });
  const ids = categories.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)]);
  const [catCounts, subCounts] = await Promise.all([
    db.listing.groupBy({ by: ["categoryId"], where: { status: "approved", categoryId: { in: ids } }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["subcategoryId"], where: { status: "approved", subcategoryId: { in: ids } }, _count: { _all: true } }),
  ]);
  const map = new Map();
  for (const r of catCounts) map.set(r.categoryId, (map.get(r.categoryId) || 0) + r._count._all);
  for (const r of subCounts) if (r.subcategoryId) map.set(r.subcategoryId, (map.get(r.subcategoryId) || 0) + r._count._all);
  return categories.map((c) => ({
    ...c,
    children: c.children.map((ch) => ({ ...ch, listingCount: map.get(ch.id) || 0 })),
    listingCount: (map.get(c.id) || 0) + c.children.reduce((s, ch) => s + (map.get(ch.id) || 0), 0),
  }));
}

async function locationsLegacy() {
  const [countries, states, cities, areas] = await Promise.all([
    db.listing.groupBy({ by: ["countryId"], where: { status: "approved" }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["stateId"], where: { status: "approved", stateId: { not: null } }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["cityId"], where: { status: "approved" }, _count: { _all: true } }),
    db.listing.groupBy({ by: ["areaId"], where: { status: "approved", areaId: { not: null } }, _count: { _all: true } }),
  ]);
  const cMap = new Map(countries.map((r) => [r.countryId, r._count._all]));
  const rows = await db.country.findMany({
    where: { isActive: true },
    include: { _count: { select: { states: true } } },
    orderBy: { listingCount: "desc" },
  });
  return rows.map((c) => ({ ...c, listingCount: cMap.get(c.id) || 0 }));
}

async function locationsOptimized() {
  return db.country.findMany({
    where: { isActive: true },
    include: { _count: { select: { states: true } } },
    orderBy: { listingCount: "desc" },
  });
}

async function publicLocationsLegacy() {
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
  }));
}

async function publicLocationsOptimized() {
  return db.country.findMany({
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
}

console.log("=== BEFORE (legacy GROUP BY paths) ===\n");
await withQueryCount("/api/categories (legacy)", categoriesLegacy);
await withQueryCount("/api/locations root (legacy)", locationsLegacy);
await withQueryCount("/api/public/locations (legacy)", publicLocationsLegacy);

console.log("\n=== AFTER (stored listingCount, no GROUP BY) ===\n");
await withQueryCount("/api/categories (optimized)", categoriesOptimized);
await withQueryCount("/api/locations root (optimized)", locationsOptimized);
await withQueryCount("/api/public/locations (optimized)", publicLocationsOptimized);

await db.$disconnect();

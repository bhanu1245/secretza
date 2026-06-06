/**
 * One-time catalog count reconciliation.
 * Usage: node scripts/sync-catalog-counts.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

async function countApproved(where) {
  return db.listing.count({ where: { status: "approved", ...where } });
}

async function main() {
  const [catCounts, subCounts, countryCounts, stateCounts, cityCounts, areaCounts] =
    await Promise.all([
      db.listing.groupBy({ by: ["categoryId"], where: { status: "approved" }, _count: { _all: true } }),
      db.listing.groupBy({
        by: ["subcategoryId"],
        where: { status: "approved", subcategoryId: { not: null } },
        _count: { _all: true },
      }),
      db.listing.groupBy({ by: ["countryId"], where: { status: "approved" }, _count: { _all: true } }),
      db.listing.groupBy({
        by: ["stateId"],
        where: { status: "approved", stateId: { not: null } },
        _count: { _all: true },
      }),
      db.listing.groupBy({ by: ["cityId"], where: { status: "approved" }, _count: { _all: true } }),
      db.listing.groupBy({
        by: ["areaId"],
        where: { status: "approved", areaId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const catDirect = new Map(catCounts.map((r) => [r.categoryId, r._count._all]));
  const catSub = new Map(subCounts.flatMap((r) => (r.subcategoryId ? [[r.subcategoryId, r._count._all]] : [])));

  const categories = await db.category.findMany({ select: { id: true, parentId: true } });
  for (const c of categories) {
    const count = c.parentId ? (catSub.get(c.id) ?? 0) : (catDirect.get(c.id) ?? 0);
    await db.category.update({ where: { id: c.id }, data: { listingCount: count } });
  }

  for (const r of countryCounts) {
    await db.country.update({ where: { id: r.countryId }, data: { listingCount: r._count._all } });
  }
  for (const r of stateCounts) {
    if (r.stateId) await db.state.update({ where: { id: r.stateId }, data: { listingCount: r._count._all } });
  }
  for (const r of cityCounts) {
    await db.city.update({ where: { id: r.cityId }, data: { listingCount: r._count._all } });
  }
  for (const r of areaCounts) {
    if (r.areaId) await db.area.update({ where: { id: r.areaId }, data: { listingCount: r._count._all } });
  }

  console.log("Catalog counts synced.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

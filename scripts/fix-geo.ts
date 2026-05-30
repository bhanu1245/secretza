/**
 * Geo Management — fix missing/inconsistent geo data
 * Run: npx tsx scripts/fix-geo.ts
 */
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { indiaAllStates, indiaDistricts } from "../src/lib/india-geo-seed-data";
import { indiaCities } from "../src/lib/india-geo-data";
import { seedGeoData } from "../src/lib/seed-geo";
import { worldCountries } from "../src/lib/world-geo-data";

loadEnvConfig(process.cwd());
const db = new PrismaClient();

async function getCounts() {
  const [countries, states, cities, areas, districts, localities] = await Promise.all([
    db.country.count(),
    db.state.count(),
    db.city.count(),
    db.area.count(),
    db.district.count(),
    db.locality.count(),
  ]);
  return { countries, states, cities, areas, districts, localities };
}

async function syncCountrySlugsFromWorldData() {
  let updated = 0;
  for (const c of worldCountries) {
    const row = await db.country.findUnique({ where: { code: c.code } });
    if (!row) continue;
    if (row.slug !== c.slug || row.name !== c.name) {
      await db.country.update({
        where: { id: row.id },
        data: { slug: c.slug, name: c.name, isActive: true },
      });
      await db.listing.updateMany({
        where: { countryId: row.id, countrySlug: row.slug },
        data: { countrySlug: c.slug },
      });
      await db.seoPage.updateMany({
        where: { pageType: "country", pageSlug: row.slug },
        data: { pageSlug: c.slug },
      });
      updated++;
    }
  }
  return updated;
}

async function seedIndiaStatesAndCities() {
  const india = await db.country.findUnique({ where: { code: "IN" } });
  if (!india) throw new Error("India country missing — run seedGeoData first");

  let statesCreated = 0;
  for (const s of indiaAllStates) {
    const existing = await db.state.findUnique({
      where: { slug_countryId: { slug: s.slug, countryId: india.id } },
    });
    if (existing) {
      await db.state.update({
        where: { id: existing.id },
        data: { name: s.name, isActive: true },
      });
    } else {
      await db.state.create({
        data: { name: s.name, slug: s.slug, countryId: india.id, isActive: true },
      });
      statesCreated++;
    }
  }

  const stateRows = await db.state.findMany({ where: { countryId: india.id } });
  const stateMap = new Map(stateRows.map((s) => [s.slug, s.id]));

  let citiesCreated = 0;
  for (const c of indiaCities) {
    const stateId = stateMap.get(c.stateSlug);
    if (!stateId) continue;

    const existing = await db.city.findUnique({
      where: { slug_stateId: { slug: c.slug, stateId } },
    });
    if (existing) {
      await db.city.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          isActive: true,
          isFeatured: c.tier === 1 || c.isMetro,
        },
      });
    } else {
      await db.city.create({
        data: {
          name: c.name,
          slug: c.slug,
          stateId,
          isActive: true,
          isFeatured: c.tier === 1 || c.isMetro,
        },
      });
      citiesCreated++;
    }
  }

  return { statesCreated, citiesCreated };
}

async function seedAreasFromDistricts() {
  const cityRows = await db.city.findMany({
    where: { state: { country: { code: "IN" } } },
    include: { state: true },
  });
  const cityMap = new Map(cityRows.map((c) => [`${c.state.slug}:${c.slug}`, c.id]));

  let created = 0;
  let skipped = 0;

  for (const d of indiaDistricts) {
    const cityId = cityMap.get(`${d.stateSlug}:${d.citySlug}`);
    if (!cityId) {
      skipped++;
      continue;
    }

    const existing = await db.area.findUnique({
      where: { slug_cityId: { slug: d.slug, cityId } },
    });
    if (existing) {
      await db.area.update({
        where: { id: existing.id },
        data: { name: d.name, isActive: true },
      });
      skipped++;
      continue;
    }

    await db.area.create({
      data: { name: d.name, slug: d.slug, cityId, isActive: true },
    });
    created++;
  }

  return { created, skipped };
}

async function seedDistrictsAndLocalities() {
  const { execSync } = await import("child_process");
  execSync("npx tsx prisma/seed-geo.ts", { stdio: "inherit", cwd: process.cwd() });
}

async function fixListingForeignKeys() {
  const [countries, states, cities, areas] = await Promise.all([
    db.country.findMany({ select: { id: true, slug: true } }),
    db.state.findMany({ select: { id: true, slug: true, countryId: true } }),
    db.city.findMany({ select: { id: true, slug: true, stateId: true } }),
    db.area.findMany({ select: { id: true, slug: true, cityId: true } }),
  ]);

  const countryBySlug = new Map(countries.map((c) => [c.slug, c.id]));
  const stateBySlug = new Map(states.map((s) => [s.slug, s]));
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]));
  const areaBySlug = new Map(areas.map((a) => [a.slug, a]));

  const listings = await db.listing.findMany({
    select: {
      id: true,
      countryId: true,
      stateId: true,
      cityId: true,
      areaId: true,
      countrySlug: true,
      stateSlug: true,
      citySlug: true,
    },
  });

  let fixed = 0;
  for (const l of listings) {
    const updates: Record<string, string | null> = {};

    if (l.countrySlug && countryBySlug.has(l.countrySlug)) {
      const cid = countryBySlug.get(l.countrySlug)!;
      if (l.countryId !== cid) updates.countryId = cid;
    }

    if (l.stateSlug && stateBySlug.has(l.stateSlug)) {
      const st = stateBySlug.get(l.stateSlug)!;
      if (l.stateId !== st.id) updates.stateId = st.id;
    }

    if (l.citySlug && cityBySlug.has(l.citySlug)) {
      const ct = cityBySlug.get(l.citySlug)!;
      if (l.cityId !== ct.id) updates.cityId = ct.id;
    }

    if (l.areaId) {
      const areaExists = areas.some((a) => a.id === l.areaId);
      if (!areaExists) updates.areaId = null;
    }

    if (Object.keys(updates).length > 0) {
      await db.listing.update({ where: { id: l.id }, data: updates });
      fixed++;
    }
  }

  return fixed;
}

async function activateReferencedInactive() {
  const listings = await db.listing.findMany({
    select: { countryId: true, stateId: true, cityId: true, areaId: true },
  });

  const countryIds = [...new Set(listings.map((l) => l.countryId).filter(Boolean))] as string[];
  const stateIds = [...new Set(listings.map((l) => l.stateId).filter(Boolean))] as string[];
  const cityIds = [...new Set(listings.map((l) => l.cityId).filter(Boolean))] as string[];
  const areaIds = [...new Set(listings.map((l) => l.areaId).filter(Boolean))] as string[];

  if (countryIds.length) {
    await db.country.updateMany({ where: { id: { in: countryIds } }, data: { isActive: true } });
  }
  if (stateIds.length) {
    await db.state.updateMany({ where: { id: { in: stateIds } }, data: { isActive: true } });
  }
  if (cityIds.length) {
    await db.city.updateMany({ where: { id: { in: cityIds } }, data: { isActive: true } });
  }
  if (areaIds.length) {
    await db.area.updateMany({ where: { id: { in: areaIds } }, data: { isActive: true } });
  }
}

async function main() {
  console.log("=== Geo Fix — Before ===");
  const before = await getCounts();
  console.log(before);

  console.log("\n[1/6] Running enterprise geo seed (countries, states, cities)...");
  await seedGeoData();

  console.log("\n[2/6] Syncing country slugs with world-geo-data...");
  const slugSync = await syncCountrySlugsFromWorldData();
  console.log(`   Updated ${slugSync} country slug(s)`);

  console.log("\n[3/6] Ensuring India states + cities...");
  const indiaResult = await seedIndiaStatesAndCities();
  console.log("   India:", indiaResult);

  console.log("\n[4/6] Seeding districts + localities (prisma/seed-geo.ts)...");
  await seedDistrictsAndLocalities();

  console.log("\n[5/6] Seeding Area records from district data...");
  const areaResult = await seedAreasFromDistricts();
  console.log("   Areas:", areaResult);

  console.log("\n[6/6] Fixing listing FKs + activating referenced geo...");
  const listingsFixed = await fixListingForeignKeys();
  await activateReferencedInactive();
  console.log(`   Listings fixed: ${listingsFixed}`);

  console.log("\n=== Geo Fix — After ===");
  const after = await getCounts();
  console.log(after);

  const summary = {
    before,
    after,
    delta: {
      countries: after.countries - before.countries,
      states: after.states - before.states,
      cities: after.cities - before.cities,
      areas: after.areas - before.areas,
      districts: after.districts - before.districts,
      localities: after.localities - before.localities,
    },
  };

  const { mkdirSync, writeFileSync } = await import("fs");
  const path = await import("path");
  const outDir = path.resolve("artifacts/geo-audit");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "fix-summary.json"), JSON.stringify(summary, null, 2));

  console.log("\nFix summary written to artifacts/geo-audit/fix-summary.json");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

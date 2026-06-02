// ==========================================
// Enterprise Geo Seed Logic
// ==========================================
// Seeds Country, State, City data from world-geo-data.ts and india-geo-data.ts
// Uses createMany for batch inserts (much faster than individual creates)
// Idempotent: safe to run multiple times (skips existing records)
// ==========================================

import { PrismaClient } from "@prisma/client";
import {
  worldCountries,
  worldStates,
  worldCities,
} from "./world-geo-data";
import { indiaCities } from "./india-geo-data";

const db = new PrismaClient();

// Batch size for createMany (SQLite has limits on bulk inserts)
const BATCH_SIZE = 500;

/**
 * Seed countries using upsert (idempotent by ISO code)
 */
async function seedCountries() {
  console.log(`\n🌍 Seeding ${worldCountries.length} countries...`);

  let created = 0;
  let updated = 0;
  const countryMap = new Map<string, string>(); // code -> id

  for (const country of worldCountries) {
    const result = await db.country.upsert({
      where: { code: country.code },
      update: {
        name: country.name,
        slug: country.slug,
        isActive: true,
      },
      create: {
        name: country.name,
        code: country.code,
        slug: country.slug,
        isActive: true,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
    countryMap.set(country.code, result.id);
  }

  console.log(`   ✅ Countries: ${created} created, ${updated} updated`);
  return countryMap;
}

/**
 * Seed states using batch upsert approach.
 * For each country, batch insert states that don't exist yet.
 */
async function seedStates(countryMap: Map<string, string>) {
  console.log(`\n📍 Seeding ${worldStates.length} states/provinces...`);

  const stateIdMap = new Map<string, string>(); // "countryCode:stateSlug" -> id
  let created = 0;
  let skipped = 0;

  // Deduplicate states by (countryCode, slug)
  const seenStates = new Set<string>();
  const dedupedStates = worldStates.filter((s) => {
    const key = `${s.countryCode}:${s.slug}`;
    if (seenStates.has(key)) return false;
    seenStates.add(key);
    return true;
  });

  // Group states by country for batch processing
  const statesByCountry = new Map<string, typeof dedupedStates>();
  for (const state of dedupedStates) {
    const existing = statesByCountry.get(state.countryCode) || [];
    existing.push(state);
    statesByCountry.set(state.countryCode, existing);
  }

  for (const [countryCode, states] of statesByCountry) {
    const countryId = countryMap.get(countryCode);
    if (!countryId) {
      console.warn(`   ⚠️  Skipping ${states.length} states - country ${countryCode} not found`);
      continue;
    }

    // Get existing state slugs for this country
    const existingStates = await db.state.findMany({
      where: { countryId },
      select: { slug: true, id: true },
    });
    const existingSlugs = new Set(existingStates.map((s) => s.slug));

    // Filter to only new states
    const newStates = states.filter((s) => !existingSlugs.has(s.slug));

    if (newStates.length > 0) {
      // Batch insert new states with error handling
      for (let i = 0; i < newStates.length; i += BATCH_SIZE) {
        const batch = newStates.slice(i, i + BATCH_SIZE);
        try {
          await db.state.createMany({
            data: batch.map((state) => ({
              name: state.name,
              slug: state.slug,
              countryId,
              isActive: true,
            })),
          });
          created += batch.length;
        } catch (err: any) {
          // If unique constraint fails, insert one by one
          for (const state of batch) {
            try {
              await db.state.create({
                data: {
                  name: state.name,
                  slug: state.slug,
                  countryId,
                  isActive: true,
                },
              });
              created++;
            } catch {
              skipped++;
            }
          }
        }
      }
      skipped += (states.length - newStates.length);
    } else {
      skipped += states.length;
    }

    // Build state ID map
    const allStatesForCountry = await db.state.findMany({
      where: { countryId },
      select: { slug: true, id: true },
    });
    for (const s of allStatesForCountry) {
      stateIdMap.set(`${countryCode}:${s.slug}`, s.id);
    }
  }

  console.log(`   ✅ States: ${created} created, ${skipped} already exist`);
  return stateIdMap;
}

/**
 * Seed international cities using batch insert
 */
async function seedWorldCities(stateIdMap: Map<string, string>) {
  console.log(`\n🏙️  Seeding ${worldCities.length} international cities...`);

  let created = 0;
  let skipped = 0;

  // Group cities by state for batch processing
  const citiesByState = new Map<string, typeof worldCities>();
  for (const city of worldCities) {
    const key = `${city.countryCode}:${city.stateSlug}`;
    const existing = citiesByState.get(key) || [];
    existing.push(city);
    citiesByState.set(key, existing);
  }

  for (const [stateKey, cities] of citiesByState) {
    const stateId = stateIdMap.get(stateKey);
    if (!stateId) {
      // Some cities reference states we don't have - skip gracefully
      skipped += cities.length;
      continue;
    }

    // Get existing city slugs for this state
    const existingCities = await db.city.findMany({
      where: { stateId },
      select: { slug: true },
    });
    const existingSlugs = new Set(existingCities.map((c) => c.slug));

    // Filter to only new cities
    const newCities = cities.filter((c) => !existingSlugs.has(c.slug));

    if (newCities.length > 0) {
      for (let i = 0; i < newCities.length; i += BATCH_SIZE) {
        const batch = newCities.slice(i, i + BATCH_SIZE);
        try {
          await db.city.createMany({
            data: batch.map((city) => ({
              name: city.name,
              slug: city.slug,
              stateId,
              isFeatured: city.isFeatured || false,
              isActive: true,
            })),
          });
          created += batch.length;
        } catch {
          for (const city of batch) {
            try {
              await db.city.create({
                data: {
                  name: city.name,
                  slug: city.slug,
                  stateId,
                  isFeatured: city.isFeatured || false,
                  isActive: true,
                },
              });
              created++;
            } catch {
              skipped++;
            }
          }
        }
      }
      skipped += (cities.length - newCities.length);
    } else {
      skipped += cities.length;
    }
  }

  console.log(`   ✅ World cities: ${created} created, ${skipped} already exist`);
  return { created, skipped };
}

/**
 * Seed Indian cities from the comprehensive india-geo-data.ts
 * Marks tier-1 cities as isFeatured
 */
async function seedIndiaCities(stateIdMap: Map<string, string>) {
  console.log(`\n🇮🇳 Seeding ${indiaCities.length} Indian cities...`);

  const indiaCountryCode = "IN";
  let created = 0;
  let skipped = 0;
  let featured = 0;

  // Group India cities by state
  const citiesByState = new Map<string, typeof indiaCities>();
  for (const city of indiaCities) {
    const existing = citiesByState.get(city.stateSlug) || [];
    existing.push(city);
    citiesByState.set(city.stateSlug, existing);
  }

  for (const [stateSlug, cities] of citiesByState) {
    const stateId = stateIdMap.get(`${indiaCountryCode}:${stateSlug}`);
    if (!stateId) {
      skipped += cities.length;
      continue;
    }

    // Get existing city slugs for this state
    const existingCities = await db.city.findMany({
      where: { stateId },
      select: { slug: true },
    });
    const existingSlugs = new Set(existingCities.map((c) => c.slug));

    // Filter to only new cities
    const newCities = cities.filter((c) => !existingSlugs.has(c.slug));

    if (newCities.length > 0) {
      for (let i = 0; i < newCities.length; i += BATCH_SIZE) {
        const batch = newCities.slice(i, i + BATCH_SIZE);
        try {
          await db.city.createMany({
            data: batch.map((city) => ({
              name: city.name,
              slug: city.slug,
              stateId,
              isFeatured: city.tier === 1, // Mark tier-1 cities as featured
              isActive: true,
            })),
          });
          created += batch.length;
        } catch {
          for (const city of batch) {
            try {
              await db.city.create({
                data: {
                  name: city.name,
                  slug: city.slug,
                  stateId,
                  isFeatured: city.tier === 1,
                  isActive: true,
                },
              });
              created++;
            } catch {
              skipped++;
            }
          }
        }
      }
      featured += newCities.filter((c) => c.tier === 1).length;
      skipped += (cities.length - newCities.length);
    } else {
      skipped += cities.length;
    }
  }

  console.log(`   ✅ India cities: ${created} created (${featured} tier-1 featured), ${skipped} already exist`);
  return { created, skipped, featured };
}

/**
 * Main seeding function
 */
export async function seedGeoData() {
  console.log("═══════════════════════════════════════");
  console.log("  ENTERPRISE GEO SEED");
  console.log("═══════════════════════════════════════");

  const startTime = Date.now();

  try {
    // 1. Seed countries
    const countryMap = await seedCountries();

    // 2. Seed states
    const stateIdMap = await seedStates(countryMap);

    // 3. Seed international cities
    const worldResult = await seedWorldCities(stateIdMap);

    // 4. Seed Indian cities (comprehensive 500+)
    const indiaResult = await seedIndiaCities(stateIdMap);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n═══════════════════════════════════════");
    console.log("  SEED COMPLETE");
    console.log("═══════════════════════════════════════");
    console.log(`  🌍 Countries:     ${countryMap.size}`);
    console.log(`  📍 States:        ${stateIdMap.size}`);
    console.log(`  🏙️  Cities total:  ${worldResult.created + indiaResult.created} created`);
    console.log(`     World:          ${worldResult.created} created, ${worldResult.skipped} existing`);
    console.log(`     India:          ${indiaResult.created} created (${indiaResult.featured} featured), ${indiaResult.skipped} existing`);
    console.log(`  ⏱️  Time:          ${elapsed}s`);
    console.log("═══════════════════════════════════════");

    return {
      countries: countryMap.size,
      states: stateIdMap.size,
      cities: worldResult.created + indiaResult.created,
      indiaCities: indiaResult.created,
      worldCities: worldResult.created,
    };
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  }
}

// Export for use as module
export { db };

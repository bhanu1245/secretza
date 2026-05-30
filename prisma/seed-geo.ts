// ==========================================
// Enterprise Geo Seed Script
// ==========================================
// Seeds Country, State, City, District, and Locality data.
// Run with: bunx tsx prisma/seed-geo.ts
//
// Idempotent: safe to run multiple times (skips existing records).
// ==========================================

import { PrismaClient } from "@prisma/client";
import {
  indiaAllStates,
  indiaDistricts,
  indiaLocalities,
} from "../src/lib/india-geo-seed-data";
import { indiaCities } from "../src/lib/india-geo-data";

const db = new PrismaClient();

// ==========================================
// Countries
// ==========================================
const COUNTRIES = [
  { name: "India", code: "IN", slug: "india" },
  { name: "United States", code: "US", slug: "united-states" },
  { name: "United Kingdom", code: "GB", slug: "united-kingdom" },
  { name: "Canada", code: "CA", slug: "canada" },
  { name: "Australia", code: "AU", slug: "australia" },
  { name: "Germany", code: "DE", slug: "germany" },
  { name: "France", code: "FR", slug: "france" },
  { name: "Japan", code: "JP", slug: "japan" },
  { name: "South Korea", code: "KR", slug: "south-korea" },
  { name: "China", code: "CN", slug: "china" },
  { name: "Brazil", code: "BR", slug: "brazil" },
  { name: "Mexico", code: "MX", slug: "mexico" },
  { name: "Argentina", code: "AR", slug: "argentina" },
  { name: "Colombia", code: "CO", slug: "colombia" },
  { name: "Russia", code: "RU", slug: "russia" },
  { name: "Italy", code: "IT", slug: "italy" },
  { name: "Spain", code: "ES", slug: "spain" },
  { name: "Netherlands", code: "NL", slug: "netherlands" },
  { name: "Belgium", code: "BE", slug: "belgium" },
  { name: "Switzerland", code: "CH", slug: "switzerland" },
  { name: "Austria", code: "AT", slug: "austria" },
  { name: "Sweden", code: "SE", slug: "sweden" },
  { name: "Norway", code: "NO", slug: "norway" },
  { name: "Denmark", code: "DK", slug: "denmark" },
  { name: "Finland", code: "FI", slug: "finland" },
  { name: "Ireland", code: "IE", slug: "ireland" },
  { name: "Portugal", code: "PT", slug: "portugal" },
  { name: "Poland", code: "PL", slug: "poland" },
  { name: "Czech Republic", code: "CZ", slug: "czech-republic" },
  { name: "Turkey", code: "TR", slug: "turkey" },
  { name: "United Arab Emirates", code: "AE", slug: "united-arab-emirates" },
  { name: "Saudi Arabia", code: "SA", slug: "saudi-arabia" },
  { name: "South Africa", code: "ZA", slug: "south-africa" },
  { name: "Nigeria", code: "NG", slug: "nigeria" },
  { name: "Kenya", code: "KE", slug: "kenya" },
  { name: "Egypt", code: "EG", slug: "egypt" },
  { name: "Thailand", code: "TH", slug: "thailand" },
  { name: "Vietnam", code: "VN", slug: "vietnam" },
  { name: "Philippines", code: "PH", slug: "philippines" },
  { name: "Indonesia", code: "ID", slug: "indonesia" },
  { name: "Malaysia", code: "MY", slug: "malaysia" },
  { name: "Singapore", code: "SG", slug: "singapore" },
  { name: "New Zealand", code: "NZ", slug: "new-zealand" },
  { name: "Israel", code: "IL", slug: "israel" },
  { name: "Greece", code: "GR", slug: "greece" },
  { name: "Romania", code: "RO", slug: "romania" },
  { name: "Ukraine", code: "UA", slug: "ukraine" },
  { name: "Hungary", code: "HU", slug: "hungary" },
  { name: "Pakistan", code: "PK", slug: "pakistan" },
  { name: "Bangladesh", code: "BD", slug: "bangladesh" },
  { name: "Sri Lanka", code: "LK", slug: "sri-lanka" },
  { name: "Nepal", code: "NP", slug: "nepal" },
];

// ==========================================
// Non-Indian States/Provinces
// ==========================================
const NON_INDIA_STATES: Array<{ countryCode: string; name: string; slug: string }> = [
  // US
  { countryCode: "US", name: "California", slug: "california" },
  { countryCode: "US", name: "New York", slug: "new-york" },
  { countryCode: "US", name: "Texas", slug: "texas" },
  { countryCode: "US", name: "Florida", slug: "florida" },
  { countryCode: "US", name: "Illinois", slug: "illinois" },
  { countryCode: "US", name: "Pennsylvania", slug: "pennsylvania" },
  { countryCode: "US", name: "Ohio", slug: "ohio" },
  { countryCode: "US", name: "Georgia", slug: "georgia" },
  { countryCode: "US", name: "Washington", slug: "washington" },
  { countryCode: "US", name: "Massachusetts", slug: "massachusetts" },
  { countryCode: "US", name: "Arizona", slug: "arizona" },
  { countryCode: "US", name: "Nevada", slug: "nevada" },
  { countryCode: "US", name: "Colorado", slug: "colorado" },
  // UK
  { countryCode: "GB", name: "England", slug: "england" },
  { countryCode: "GB", name: "Scotland", slug: "scotland" },
  { countryCode: "GB", name: "Wales", slug: "wales" },
  { countryCode: "GB", name: "Northern Ireland", slug: "northern-ireland" },
  // Canada
  { countryCode: "CA", name: "Ontario", slug: "ontario" },
  { countryCode: "CA", name: "Quebec", slug: "quebec" },
  { countryCode: "CA", name: "British Columbia", slug: "british-columbia" },
  { countryCode: "CA", name: "Alberta", slug: "alberta" },
  // Australia
  { countryCode: "AU", name: "New South Wales", slug: "new-south-wales" },
  { countryCode: "AU", name: "Victoria", slug: "victoria" },
  { countryCode: "AU", name: "Queensland", slug: "queensland" },
  { countryCode: "AU", name: "Western Australia", slug: "western-australia" },
  // Germany
  { countryCode: "DE", name: "Bavaria", slug: "bavaria" },
  { countryCode: "DE", name: "Berlin", slug: "berlin" },
  { countryCode: "DE", name: "Hamburg", slug: "hamburg" },
  { countryCode: "DE", name: "Hesse", slug: "hesse" },
  { countryCode: "DE", name: "North Rhine-Westphalia", slug: "north-rhine-westphalia" },
  // France
  { countryCode: "FR", name: "Ile-de-France", slug: "ile-de-france" },
  { countryCode: "FR", name: "Provence-Alpes-Cote d'Azur", slug: "provence-alpes-cote-dazur" },
  { countryCode: "FR", name: "Auvergne-Rhone-Alpes", slug: "auvergne-rhone-alpes" },
  { countryCode: "FR", name: "Occitanie", slug: "occitanie" },
  // Japan
  { countryCode: "JP", name: "Tokyo", slug: "tokyo" },
  { countryCode: "JP", name: "Osaka", slug: "osaka" },
  { countryCode: "JP", name: "Kyoto", slug: "kyoto" },
  { countryCode: "JP", name: "Hokkaido", slug: "hokkaido" },
  // South Korea
  { countryCode: "KR", name: "Seoul", slug: "seoul" },
  { countryCode: "KR", name: "Gyeonggi", slug: "gyeonggi" },
  { countryCode: "KR", name: "Busan", slug: "busan" },
  // Brazil
  { countryCode: "BR", name: "Sao Paulo", slug: "sao-paulo" },
  { countryCode: "BR", name: "Rio de Janeiro", slug: "rio-de-janeiro" },
  { countryCode: "BR", name: "Minas Gerais", slug: "minas-gerais" },
  // UAE
  { countryCode: "AE", name: "Dubai", slug: "dubai" },
  { countryCode: "AE", name: "Abu Dhabi", slug: "abu-dhabi" },
  { countryCode: "AE", name: "Sharjah", slug: "sharjah" },
  // Turkey
  { countryCode: "TR", name: "Istanbul", slug: "istanbul" },
  { countryCode: "TR", name: "Ankara", slug: "ankara" },
  { countryCode: "TR", name: "Izmir", slug: "izmir" },
  // South Africa
  { countryCode: "ZA", name: "Gauteng", slug: "gauteng" },
  { countryCode: "ZA", name: "Western Cape", slug: "western-cape" },
  { countryCode: "ZA", name: "KwaZulu-Natal", slug: "kwazulu-natal" },
  // Singapore
  { countryCode: "SG", name: "Central Region", slug: "central-region" },
];

// ==========================================
// Non-Indian Cities
// ==========================================
const NON_INDIA_CITIES: Array<{ countryCode: string; stateSlug: string; name: string; slug: string; isFeatured?: boolean }> = [
  // US
  { countryCode: "US", stateSlug: "california", name: "Los Angeles", slug: "los-angeles", isFeatured: true },
  { countryCode: "US", stateSlug: "california", name: "San Francisco", slug: "san-francisco", isFeatured: true },
  { countryCode: "US", stateSlug: "california", name: "San Diego", slug: "san-diego" },
  { countryCode: "US", stateSlug: "new-york", name: "New York City", slug: "new-york-city", isFeatured: true },
  { countryCode: "US", stateSlug: "texas", name: "Houston", slug: "houston" },
  { countryCode: "US", stateSlug: "texas", name: "Dallas", slug: "dallas" },
  { countryCode: "US", stateSlug: "texas", name: "Austin", slug: "austin" },
  { countryCode: "US", stateSlug: "florida", name: "Miami", slug: "miami", isFeatured: true },
  { countryCode: "US", stateSlug: "florida", name: "Orlando", slug: "orlando" },
  { countryCode: "US", stateSlug: "illinois", name: "Chicago", slug: "chicago", isFeatured: true },
  { countryCode: "US", stateSlug: "pennsylvania", name: "Philadelphia", slug: "philadelphia" },
  { countryCode: "US", stateSlug: "washington", name: "Seattle", slug: "seattle", isFeatured: true },
  { countryCode: "US", stateSlug: "massachusetts", name: "Boston", slug: "boston" },
  { countryCode: "US", stateSlug: "arizona", name: "Phoenix", slug: "phoenix" },
  { countryCode: "US", stateSlug: "nevada", name: "Las Vegas", slug: "las-vegas" },
  { countryCode: "US", stateSlug: "colorado", name: "Denver", slug: "denver" },
  // UK
  { countryCode: "GB", stateSlug: "england", name: "London", slug: "london", isFeatured: true },
  { countryCode: "GB", stateSlug: "england", name: "Manchester", slug: "manchester" },
  { countryCode: "GB", stateSlug: "england", name: "Birmingham", slug: "birmingham" },
  { countryCode: "GB", stateSlug: "england", name: "Liverpool", slug: "liverpool" },
  { countryCode: "GB", stateSlug: "england", name: "Leeds", slug: "leeds" },
  { countryCode: "GB", stateSlug: "scotland", name: "Edinburgh", slug: "edinburgh" },
  { countryCode: "GB", stateSlug: "scotland", name: "Glasgow", slug: "glasgow" },
  { countryCode: "GB", stateSlug: "wales", name: "Cardiff", slug: "cardiff" },
  // Canada
  { countryCode: "CA", stateSlug: "ontario", name: "Toronto", slug: "toronto", isFeatured: true },
  { countryCode: "CA", stateSlug: "ontario", name: "Ottawa", slug: "ottawa" },
  { countryCode: "CA", stateSlug: "quebec", name: "Montreal", slug: "montreal", isFeatured: true },
  { countryCode: "CA", stateSlug: "quebec", name: "Quebec City", slug: "quebec-city" },
  { countryCode: "CA", stateSlug: "british-columbia", name: "Vancouver", slug: "vancouver", isFeatured: true },
  { countryCode: "CA", stateSlug: "alberta", name: "Calgary", slug: "calgary" },
  { countryCode: "CA", stateSlug: "alberta", name: "Edmonton", slug: "edmonton" },
  // Australia
  { countryCode: "AU", stateSlug: "new-south-wales", name: "Sydney", slug: "sydney", isFeatured: true },
  { countryCode: "AU", stateSlug: "victoria", name: "Melbourne", slug: "melbourne", isFeatured: true },
  { countryCode: "AU", stateSlug: "queensland", name: "Brisbane", slug: "brisbane" },
  { countryCode: "AU", stateSlug: "western-australia", name: "Perth", slug: "perth" },
  { countryCode: "AU", stateSlug: "new-south-wales", name: "Canberra", slug: "canberra" },
  // Germany
  { countryCode: "DE", stateSlug: "berlin", name: "Berlin", slug: "berlin", isFeatured: true },
  { countryCode: "DE", stateSlug: "bavaria", name: "Munich", slug: "munich", isFeatured: true },
  { countryCode: "DE", stateSlug: "hamburg", name: "Hamburg", slug: "hamburg" },
  { countryCode: "DE", stateSlug: "hesse", name: "Frankfurt", slug: "frankfurt" },
  { countryCode: "DE", stateSlug: "north-rhine-westphalia", name: "Cologne", slug: "cologne" },
  { countryCode: "DE", stateSlug: "north-rhine-westphalia", name: "Dusseldorf", slug: "dusseldorf" },
  // France
  { countryCode: "FR", stateSlug: "ile-de-france", name: "Paris", slug: "paris", isFeatured: true },
  { countryCode: "FR", stateSlug: "provence-alpes-cote-dazur", name: "Nice", slug: "nice" },
  { countryCode: "FR", stateSlug: "provence-alpes-cote-dazur", name: "Marseille", slug: "marseille" },
  { countryCode: "FR", stateSlug: "auvergne-rhone-alpes", name: "Lyon", slug: "lyon" },
  // Japan
  { countryCode: "JP", stateSlug: "tokyo", name: "Tokyo", slug: "tokyo", isFeatured: true },
  { countryCode: "JP", stateSlug: "osaka", name: "Osaka", slug: "osaka" },
  { countryCode: "JP", stateSlug: "kyoto", name: "Kyoto", slug: "kyoto" },
  // South Korea
  { countryCode: "KR", stateSlug: "seoul", name: "Seoul", slug: "seoul", isFeatured: true },
  { countryCode: "KR", stateSlug: "busan", name: "Busan", slug: "busan" },
  // Brazil
  { countryCode: "BR", stateSlug: "sao-paulo", name: "Sao Paulo", slug: "sao-paulo", isFeatured: true },
  { countryCode: "BR", stateSlug: "rio-de-janeiro", name: "Rio de Janeiro", slug: "rio-de-janeiro", isFeatured: true },
  // UAE
  { countryCode: "AE", stateSlug: "dubai", name: "Dubai", slug: "dubai", isFeatured: true },
  { countryCode: "AE", stateSlug: "abu-dhabi", name: "Abu Dhabi", slug: "abu-dhabi" },
  { countryCode: "AE", stateSlug: "sharjah", name: "Sharjah", slug: "sharjah" },
  // Turkey
  { countryCode: "TR", stateSlug: "istanbul", name: "Istanbul", slug: "istanbul", isFeatured: true },
  { countryCode: "TR", stateSlug: "ankara", name: "Ankara", slug: "ankara" },
  { countryCode: "TR", stateSlug: "izmir", name: "Izmir", slug: "izmir" },
  // South Africa
  { countryCode: "ZA", stateSlug: "gauteng", name: "Johannesburg", slug: "johannesburg", isFeatured: true },
  { countryCode: "ZA", stateSlug: "gauteng", name: "Pretoria", slug: "pretoria" },
  { countryCode: "ZA", stateSlug: "western-cape", name: "Cape Town", slug: "cape-town", isFeatured: true },
  { countryCode: "ZA", stateSlug: "kwazulu-natal", name: "Durban", slug: "durban" },
  // Singapore
  { countryCode: "SG", stateSlug: "central-region", name: "Singapore", slug: "singapore", isFeatured: true },
  // No state
  { countryCode: "TH", name: "Bangkok", slug: "bangkok", stateSlug: "", isFeatured: true },
  { countryCode: "IT", name: "Rome", slug: "rome", stateSlug: "", isFeatured: true },
  { countryCode: "IT", name: "Milan", slug: "milan", stateSlug: "" },
  { countryCode: "ES", name: "Madrid", slug: "madrid", stateSlug: "", isFeatured: true },
  { countryCode: "ES", name: "Barcelona", slug: "barcelona", stateSlug: "" },
  { countryCode: "NL", name: "Amsterdam", slug: "amsterdam", stateSlug: "", isFeatured: true },
  { countryCode: "IL", name: "Tel Aviv", slug: "tel-aviv", stateSlug: "", isFeatured: true },
  { countryCode: "GR", name: "Athens", slug: "athens", stateSlug: "" },
  { countryCode: "MX", name: "Mexico City", slug: "mexico-city", stateSlug: "", isFeatured: true },
  { countryCode: "AR", name: "Buenos Aires", slug: "buenos-aires", stateSlug: "", isFeatured: true },
  { countryCode: "NZ", name: "Auckland", slug: "auckland", stateSlug: "" },
];

// ==========================================
// Seed functions
// ==========================================

async function seedCountries() {
  console.log(`\n🌍 Seeding ${COUNTRIES.length} countries...`);
  let created = 0;
  let updated = 0;
  const countryMap = new Map<string, string>();

  for (const c of COUNTRIES) {
    const result = await db.country.upsert({
      where: { code: c.code },
      update: { name: c.name, slug: c.slug, isActive: true },
      create: { name: c.name, code: c.code, slug: c.slug, isActive: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
    countryMap.set(c.code, result.id);
  }

  console.log(`   ✅ Countries: ${created} created, ${updated} updated`);
  return countryMap;
}

async function seedIndiaStates(countryMap: Map<string, string>) {
  const indiaCountryId = countryMap.get("IN");
  if (!indiaCountryId) {
    console.warn("   ⚠️  India country not found, skipping Indian states");
    return new Map<string, string>();
  }

  console.log(`\n🇮🇳 Seeding ${indiaAllStates.length} Indian states & UTs...`);
  let created = 0;
  let skipped = 0;
  const stateIdMap = new Map<string, string>();

  for (const s of indiaAllStates) {
    const existing = await db.state.findUnique({
      where: { slug_countryId: { slug: s.slug, countryId: indiaCountryId } },
    });
    if (existing) {
      stateIdMap.set(`IN:${s.slug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.state.create({
      data: { name: s.name, slug: s.slug, countryId: indiaCountryId, isActive: true },
    });
    stateIdMap.set(`IN:${s.slug}`, result.id);
    created++;
  }

  console.log(`   ✅ Indian states: ${created} created, ${skipped} already exist`);
  return stateIdMap;
}

async function seedNonIndiaStates(countryMap: Map<string, string>) {
  console.log(`\n🌐 Seeding ${NON_INDIA_STATES.length} international states/provinces...`);
  let created = 0;
  let skipped = 0;
  const stateIdMap = new Map<string, string>();

  for (const s of NON_INDIA_STATES) {
    const countryId = countryMap.get(s.countryCode);
    if (!countryId) { skipped++; continue; }

    const existing = await db.state.findUnique({
      where: { slug_countryId: { slug: s.slug, countryId } },
    });
    if (existing) {
      stateIdMap.set(`${s.countryCode}:${s.slug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.state.create({
      data: { name: s.name, slug: s.slug, countryId, isActive: true },
    });
    stateIdMap.set(`${s.countryCode}:${s.slug}`, result.id);
    created++;
  }

  console.log(`   ✅ International states: ${created} created, ${skipped} already exist`);
  return stateIdMap;
}

async function seedIndiaCities(stateIdMap: Map<string, string>) {
  console.log(`\n🏙️  Seeding ${indiaCities.length} Indian cities...`);
  let created = 0;
  let skipped = 0;
  const cityIdMap = new Map<string, string>();

  for (const c of indiaCities) {
    const stateId = stateIdMap.get(`IN:${c.stateSlug}`);
    if (!stateId) { skipped++; continue; }

    const existing = await db.city.findUnique({
      where: { slug_stateId: { slug: c.slug, stateId } },
    });
    if (existing) {
      cityIdMap.set(`IN:${c.slug}:${c.stateSlug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.city.create({
      data: {
        name: c.name,
        slug: c.slug,
        stateId,
        isActive: true,
        isFeatured: c.tier === 1 || c.isMetro,
      },
    });
    cityIdMap.set(`IN:${c.slug}:${c.stateSlug}`, result.id);
    created++;
  }

  console.log(`   ✅ Indian cities: ${created} created, ${skipped} already exist`);
  return cityIdMap;
}

async function seedNonIndiaCities(stateIdMap: Map<string, string>, countryMap: Map<string, string>) {
  console.log(`\n🏙️  Seeding ${NON_INDIA_CITIES.length} international cities...`);
  let created = 0;
  let skipped = 0;
  const cityIdMap = new Map<string, string>();

  for (const c of NON_INDIA_CITIES) {
    let stateId: string | undefined;
    if (c.stateSlug) {
      stateId = stateIdMap.get(`${c.countryCode}:${c.stateSlug}`);
    }
    if (!stateId) {
      const country = await db.country.findUnique({ where: { code: c.countryCode } });
      if (country) {
        const anyState = await db.state.findFirst({ where: { countryId: country.id } });
        if (anyState) stateId = anyState.id;
      }
    }
    if (!stateId) { skipped++; continue; }

    const existing = await db.city.findUnique({
      where: { slug_stateId: { slug: c.slug, stateId } },
    });
    if (existing) {
      cityIdMap.set(`${c.countryCode}:${c.slug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.city.create({
      data: {
        name: c.name,
        slug: c.slug,
        stateId,
        isActive: true,
        isFeatured: c.isFeatured || false,
      },
    });
    cityIdMap.set(`${c.countryCode}:${c.slug}`, result.id);
    created++;
  }

  console.log(`   ✅ International cities: ${created} created, ${skipped} already exist`);
  return cityIdMap;
}

async function seedDistricts(cityIdMap: Map<string, string>) {
  console.log(`\n📊 Seeding ${indiaDistricts.length} districts...`);
  let created = 0;
  let skipped = 0;
  const districtIdMap = new Map<string, string>();

  for (const d of indiaDistricts) {
    const cityId = cityIdMap.get(`IN:${d.citySlug}:${d.stateSlug}`);
    if (!cityId) { skipped++; continue; }

    const existing = await db.district.findUnique({
      where: { slug_cityId: { slug: d.slug, cityId } },
    });
    if (existing) {
      districtIdMap.set(`IN:${d.stateSlug}:${d.citySlug}:${d.slug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.district.create({
      data: { name: d.name, slug: d.slug, cityId, isActive: true },
    });
    districtIdMap.set(`IN:${d.stateSlug}:${d.citySlug}:${d.slug}`, result.id);
    created++;
  }

  console.log(`   ✅ Districts: ${created} created, ${skipped} already exist`);
  return districtIdMap;
}

async function seedLocalities(districtIdMap: Map<string, string>, cityIdMap: Map<string, string>) {
  console.log(`\n📍 Seeding ${indiaLocalities.length} localities...`);
  let created = 0;
  let skipped = 0;

  for (const l of indiaLocalities) {
    const districtId = districtIdMap.get(`IN:${l.stateSlug}:${l.citySlug}:${l.districtSlug}`);
    if (!districtId) { skipped++; continue; }

    const existing = await db.locality.findUnique({
      where: { slug_districtId: { slug: l.slug, districtId } },
    });
    if (existing) { skipped++; continue; }

    await db.locality.create({
      data: { name: l.name, slug: l.slug, districtId, isActive: true },
    });
    created++;
  }

  console.log(`   ✅ Localities: ${created} created, ${skipped} already exist`);
  return { created, skipped };
}

async function seedAreas(cityIdMap: Map<string, string>) {
  console.log(`\n📍 Seeding Area records from ${indiaDistricts.length} district definitions...`);
  let created = 0;
  let skipped = 0;

  for (const d of indiaDistricts) {
    const cityId = cityIdMap.get(`IN:${d.citySlug}:${d.stateSlug}`);
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

  console.log(`   ✅ Areas: ${created} created, ${skipped} already exist`);
  return { created, skipped };
}

// ==========================================
// Main
// ==========================================
async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  INDIA GEO SEED — COMPREHENSIVE");
  console.log("═══════════════════════════════════════");

  const startTime = Date.now();

  try {
    // 1. Seed countries
    const countryMap = await seedCountries();

    // 2. Seed Indian states (all 36)
    const indiaStateIdMap = await seedIndiaStates(countryMap);

    // 3. Seed non-Indian states
    const nonIndiaStateIdMap = await seedNonIndiaStates(countryMap);

    // Merge state maps
    const allStateIdMap = new Map([...indiaStateIdMap, ...nonIndiaStateIdMap]);

    // 4. Seed Indian cities (500+)
    const indiaCityIdMap = await seedIndiaCities(indiaStateIdMap);

    // 5. Seed non-Indian cities
    const nonIndiaCityIdMap = await seedNonIndiaCities(nonIndiaStateIdMap, countryMap);

    // Merge city maps
    const allCityIdMap = new Map([...indiaCityIdMap, ...nonIndiaCityIdMap]);

    // 6. Seed districts (200+)
    const districtIdMap = await seedDistricts(indiaCityIdMap);

    // 7. Seed localities (300+)
    const { created: localitiesCreated, skipped: localitiesSkipped } = await seedLocalities(districtIdMap, indiaCityIdMap);

    // 8. Seed Area records (listing form / public locations API)
    const { created: areasCreated, skipped: areasSkipped } = await seedAreas(indiaCityIdMap);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n═══════════════════════════════════════");
    console.log("  SEED COMPLETE");
    console.log("═══════════════════════════════════════");
    console.log(`  🌍 Countries:     ${countryMap.size}`);
    console.log(`  📍 States:        ${indiaAllStates.length} India + ${NON_INDIA_STATES.length} International`);
    console.log(`  🏙️  Cities:        ${indiaCities.length} India + ${NON_INDIA_CITIES.length} International`);
    console.log(`  📊 Districts:     ${indiaDistricts.length}`);
    console.log(`  📍 Localities:    ${localitiesCreated} created, ${localitiesSkipped} existing`);
    console.log(`  🏘️  Areas:         ${areasCreated} created, ${areasSkipped} existing`);
    console.log(`  ⏱️  Time:          ${elapsed}s`);
    console.log("═══════════════════════════════════════");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  }
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => db.$disconnect());

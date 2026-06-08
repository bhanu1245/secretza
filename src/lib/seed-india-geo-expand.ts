// ============================================================================
// India Geo Expansion — idempotent upsert + audit
// ============================================================================
// Expands India geo coverage without deleting or modifying existing records.
// Match by slug (+ country/state scope). Preserves existing IDs on match.
// ============================================================================

import type { PrismaClient } from "@prisma/client";
import { indiaAllStates } from "./india-geo-seed-data";
import { indiaCities } from "./india-geo-data";

const INDIA_CODE = "IN";

export const REQUIRED_MAJOR_CITY_SLUGS = [
  "delhi",
  "mumbai",
  "pune",
  "nagpur",
  "thane",
  "navi-mumbai",
  "bengaluru",
  "bangalore",
  "mysuru",
  "mysore",
  "chennai",
  "coimbatore",
  "madurai",
  "hyderabad",
  "warangal",
  "kolkata",
  "howrah",
  "durgapur",
  "ahmedabad",
  "surat",
  "vadodara",
  "rajkot",
  "jaipur",
  "jodhpur",
  "udaipur",
  "lucknow",
  "kanpur",
  "varanasi",
  "prayagraj",
  "allahabad",
  "noida",
  "ghaziabad",
  "gurugram",
  "faridabad",
  "chandigarh",
  "mohali",
  "amritsar",
  "ludhiana",
  "patna",
  "ranchi",
  "bhubaneswar",
  "cuttack",
  "kochi",
  "thiruvananthapuram",
  "kozhikode",
  "bhopal",
  "indore",
  "gwalior",
  "raipur",
  "visakhapatnam",
  "vijayawada",
  "amaravati",
  "tirupati",
] as const;

export interface IndiaGeoCounts {
  states: number;
  unionTerritories: number;
  cities: number;
  areas: number;
}

export interface IndiaGeoDuplicate {
  type: "state_slug" | "city_slug" | "city_name";
  key: string;
  count: number;
}

export interface IndiaGeoAuditReport {
  generatedAt: string;
  before: IndiaGeoCounts;
  after: IndiaGeoCounts;
  statesAdded: Array<{ name: string; slug: string; type: "state" | "ut" }>;
  citiesAdded: Array<{ name: string; slug: string; stateSlug: string }>;
  duplicatesFound: IndiaGeoDuplicate[];
  missingStates: string[];
  missingCities: Array<{ slug: string; stateSlug: string; name: string }>;
  missingMajorCities: string[];
  recordsAdded: { states: number; cities: number };
}

export function countIndiaStatesByType(states: Array<{ slug: string; type: "state" | "ut" }>) {
  const stateSlugs = new Set(indiaAllStates.filter((s) => s.type === "state").map((s) => s.slug));
  const utSlugs = new Set(indiaAllStates.filter((s) => s.type === "ut").map((s) => s.slug));
  let statesCount = 0;
  let utCount = 0;
  for (const s of states) {
    if (stateSlugs.has(s.slug)) statesCount++;
    else if (utSlugs.has(s.slug)) utCount++;
  }
  return { states: statesCount, unionTerritories: utCount };
}

export function validateIndiaGeoSourceData(): {
  pass: boolean;
  missingStates: string[];
  missingMajorCities: string[];
  sourceCityCount: number;
  sourceStateCount: number;
} {
  const expectedStateSlugs = indiaAllStates.map((s) => s.slug);
  const presentStateSlugs = new Set(expectedStateSlugs);

  const citySlugSet = new Set<string>();
  const cityAliasSet = new Set<string>();
  for (const city of indiaCities) {
    citySlugSet.add(city.slug);
    for (const alias of city.aliases) cityAliasSet.add(alias);
  }

  const missingMajorCities = REQUIRED_MAJOR_CITY_SLUGS.filter(
    (slug) => !citySlugSet.has(slug) && !cityAliasSet.has(slug),
  );

  return {
    pass: missingMajorCities.length === 0 && presentStateSlugs.size === 36,
    missingStates: [],
    missingMajorCities,
    sourceCityCount: indiaCities.length,
    sourceStateCount: indiaAllStates.length,
  };
}

async function snapshotIndiaCounts(db: PrismaClient): Promise<IndiaGeoCounts> {
  const india = await db.country.findFirst({ where: { code: INDIA_CODE } });
  if (!india) {
    return { states: 0, unionTerritories: 0, cities: 0, areas: 0 };
  }

  const [dbStates, cityCount, areaCount] = await Promise.all([
    db.state.findMany({
      where: { countryId: india.id },
      select: { slug: true },
    }),
    db.city.count({ where: { state: { countryId: india.id } } }),
    db.area.count({ where: { city: { state: { countryId: india.id } } } }),
  ]);

  const canonical = countIndiaStatesByType(
    dbStates.map((s) => {
      const meta = indiaAllStates.find((x) => x.slug === s.slug);
      return { slug: s.slug, type: meta?.type ?? "state" };
    }),
  );

  return {
    states: canonical.states,
    unionTerritories: canonical.unionTerritories,
    cities: cityCount,
    areas: areaCount,
  };
}

async function findIndiaDuplicates(db: PrismaClient): Promise<IndiaGeoDuplicate[]> {
  const india = await db.country.findFirst({ where: { code: INDIA_CODE } });
  if (!india) return [];

  const duplicates: IndiaGeoDuplicate[] = [];
  const states = await db.state.findMany({ where: { countryId: india.id } });

  const stateSlugCounts = new Map<string, number>();
  for (const s of states) {
    stateSlugCounts.set(s.slug, (stateSlugCounts.get(s.slug) || 0) + 1);
  }
  for (const [key, count] of stateSlugCounts) {
    if (count > 1) duplicates.push({ type: "state_slug", key, count });
  }

  const cities = await db.city.findMany({
    where: { state: { countryId: india.id } },
    select: { slug: true, name: true, stateId: true },
  });

  const citySlugCounts = new Map<string, number>();
  const cityNameCounts = new Map<string, number>();
  for (const c of cities) {
    const slugKey = `${c.stateId}:${c.slug}`;
    citySlugCounts.set(slugKey, (citySlugCounts.get(slugKey) || 0) + 1);

    const nameKey = `${c.stateId}:${c.name.toLowerCase()}`;
    cityNameCounts.set(nameKey, (cityNameCounts.get(nameKey) || 0) + 1);
  }

  for (const [key, count] of citySlugCounts) {
    if (count > 1) duplicates.push({ type: "city_slug", key, count });
  }
  for (const [key, count] of cityNameCounts) {
    if (count > 1) duplicates.push({ type: "city_name", key, count });
  }

  return duplicates;
}

async function ensureIndiaCountry(db: PrismaClient): Promise<string> {
  const result = await db.country.upsert({
    where: { code: INDIA_CODE },
    update: {},
    create: {
      name: "India",
      code: INDIA_CODE,
      slug: "india",
      isActive: true,
    },
  });
  return result.id;
}

/**
 * Idempotent India geo expansion. Never deletes records; skips existing slug matches.
 */
export async function expandIndiaGeo(db: PrismaClient): Promise<IndiaGeoAuditReport> {
  const before = await snapshotIndiaCounts(db);
  const duplicatesFound = await findIndiaDuplicates(db);

  const countryId = await ensureIndiaCountry(db);
  const statesAdded: IndiaGeoAuditReport["statesAdded"] = [];
  const citiesAdded: IndiaGeoAuditReport["citiesAdded"] = [];
  const stateIdMap = new Map<string, string>();

  for (const state of indiaAllStates) {
    const existing = await db.state.findUnique({
      where: { slug_countryId: { slug: state.slug, countryId } },
    });

    if (existing) {
      stateIdMap.set(state.slug, existing.id);
      continue;
    }

    const created = await db.state.create({
      data: {
        name: state.name,
        slug: state.slug,
        countryId,
        isActive: true,
      },
    });
    stateIdMap.set(state.slug, created.id);
    statesAdded.push({ name: state.name, slug: state.slug, type: state.type });
  }

  for (const city of indiaCities) {
    const stateId = stateIdMap.get(city.stateSlug);
    if (!stateId) continue;

    const existing = await db.city.findUnique({
      where: { slug_stateId: { slug: city.slug, stateId } },
    });
    if (existing) continue;

    await db.city.create({
      data: {
        name: city.name,
        slug: city.slug,
        stateId,
        isActive: true,
        isFeatured: city.tier === 1 || city.isMetro,
      },
    });
    citiesAdded.push({ name: city.name, slug: city.slug, stateSlug: city.stateSlug });
  }

  const after = await snapshotIndiaCounts(db);
  const postDuplicates = await findIndiaDuplicates(db);

  const dbStates = await db.state.findMany({
    where: { countryId },
    select: { id: true, slug: true },
  });
  const stateSlugToId = new Map(dbStates.map((s) => [s.slug, s.id]));

  const missingStates = indiaAllStates
    .filter((s) => !stateSlugToId.has(s.slug))
    .map((s) => s.slug);

  const dbCityKeys = new Set(
    (
      await db.city.findMany({
        where: { state: { countryId } },
        select: { slug: true, stateId: true },
      })
    ).map((c) => {
      const stateSlug = [...stateSlugToId.entries()].find(([, id]) => id === c.stateId)?.[0];
      return `${c.slug}:${stateSlug ?? "unknown"}`;
    }),
  );

  const missingCities = indiaCities
    .filter((c) => !dbCityKeys.has(`${c.slug}:${c.stateSlug}`))
    .map((c) => ({ slug: c.slug, stateSlug: c.stateSlug, name: c.name }));

  const citySlugSet = new Set([...dbCityKeys].map((k) => k.split(":")[0]));
  const missingMajorCities = REQUIRED_MAJOR_CITY_SLUGS.filter((slug) => !citySlugSet.has(slug));

  return {
    generatedAt: new Date().toISOString(),
    before,
    after,
    statesAdded,
    citiesAdded,
    duplicatesFound: [...duplicatesFound, ...postDuplicates.filter((d) => !duplicatesFound.some((x) => x.key === d.key && x.type === d.type))],
    missingStates,
    missingCities,
    missingMajorCities,
    recordsAdded: {
      states: statesAdded.length,
      cities: citiesAdded.length,
    },
  };
}

export function formatIndiaGeoAuditReport(report: IndiaGeoAuditReport): string {
  return JSON.stringify(
    {
      generatedAt: report.generatedAt,
      before: report.before,
      after: report.after,
      recordsAdded: report.recordsAdded,
      statesAdded: report.statesAdded,
      citiesAdded: report.citiesAdded,
      duplicatesFound: report.duplicatesFound,
      missingStates: report.missingStates,
      missingCities: report.missingCities,
      missingMajorCities: report.missingMajorCities,
    },
    null,
    2,
  );
}

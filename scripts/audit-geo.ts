/**
 * Geo Management — comprehensive audit
 * Run: npx tsx scripts/audit-geo.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { indiaAllStates } from "../src/lib/india-geo-seed-data";
import { indiaCities } from "../src/lib/india-geo-data";
import { worldCountries } from "../src/lib/world-geo-data";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const OUT_DIR = path.resolve("artifacts/geo-audit");

/** ISO 3166-1 alpha-2 codes (UN members + common territories) */
const ISO3166_ALPHA2 = [
  "AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ",
  "BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR",
  "IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL","CN","CX","CC",
  "CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO",
  "EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF",
  "GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY",
  "HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM",
  "JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY",
  "LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX",
  "FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI",
  "NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH",
  "PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC",
  "WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS",
  "SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK",
  "TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU",
  "VE","VN","VG","VI","WF","EH","YE","ZM","ZW",
];

type Check = { name: string; pass: boolean; detail: string | Record<string, unknown> };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderHtml(report: Record<string, unknown>) {
  const checks = (report.checks as Check[])
    .map((c) => {
      const detail =
        typeof c.detail === "string" ? c.detail : JSON.stringify(c.detail, null, 2);
      return `<tr><td>${c.pass ? "✓" : "✗"}</td><td>${c.name}</td><td><pre style="margin:0;white-space:pre-wrap">${detail}</pre></td></tr>`;
    })
    .join("");

  const counts = report.counts as Record<string, number>;
  const beforeAfter = report.beforeAfter as Record<string, { before: number; after: number }> | undefined;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Geo Audit Report</title>
<style>
body{font-family:system-ui;background:#0f0f14;color:#eee;padding:24px;max-width:1200px;margin:0 auto}
table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #333;padding:8px;text-align:left;vertical-align:top}
th{background:#1a1a24}.pass{color:#10b981}.fail{color:#ef4444}pre{background:#1a1a24;padding:12px;border-radius:8px;overflow:auto}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.card{background:#1a1a24;padding:16px;border-radius:8px;border:1px solid #333}
.card h3{margin:0 0 8px;font-size:14px;color:#aaa}.card p{margin:0;font-size:24px;font-weight:700}
</style></head><body>
<h1>Geo Management Audit</h1>
<p>Generated: ${report.generatedAt}</p>
<p>Overall: <strong class="${report.allPass ? "pass" : "fail"}">${report.allPass ? "PASS" : "FAIL"}</strong></p>
${beforeAfter ? `<h2>Before / After</h2><pre>${JSON.stringify(beforeAfter, null, 2)}</pre>` : ""}
<h2>Counts</h2>
<div class="grid">
  <div class="card"><h3>Countries</h3><p>${counts.countries}</p></div>
  <div class="card"><h3>States</h3><p>${counts.states}</p></div>
  <div class="card"><h3>Cities</h3><p>${counts.cities}</p></div>
  <div class="card"><h3>Areas</h3><p>${counts.areas}</p></div>
</div>
<h2>Checks</h2>
<table><thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead><tbody>${checks}</tbody></table>
<h2>Summary</h2><pre>${JSON.stringify(report.summary, null, 2)}</pre>
</body></html>`;
}

export async function runGeoAudit(options: { writeArtifacts?: boolean } = {}) {
  const { writeArtifacts = true } = options;
  const checks: Check[] = [];

  const [
    countries,
    states,
    cities,
    areas,
    districts,
    localities,
    seoPages,
    listings,
  ] = await Promise.all([
    db.country.findMany({ include: { _count: { select: { states: true, listings: true } } } }),
    db.state.findMany({ include: { country: true, _count: { select: { cities: true, listings: true } } } }),
    db.city.findMany({ include: { state: { include: { country: true } }, _count: { select: { areas: true, listings: true } } } }),
    db.area.findMany({ include: { city: { include: { state: { include: { country: true } } } }, _count: { select: { listings: true } } } }),
    db.district.findMany({ include: { city: true } }),
    db.locality.findMany({ include: { district: true } }),
    db.seoPage.findMany({ select: { id: true, pageType: true, pageSlug: true, isPublished: true } }),
    db.listing.findMany({
      select: {
        id: true,
        countryId: true,
        stateId: true,
        cityId: true,
        areaId: true,
        countrySlug: true,
        stateSlug: true,
        citySlug: true,
        status: true,
      },
    }),
  ]);

  const counts = {
    countries: countries.length,
    states: states.length,
    cities: cities.length,
    areas: areas.length,
    districts: districts.length,
    localities: localities.length,
    seoPages: seoPages.length,
    listings: listings.length,
  };

  // ── 1. Countries ──
  const dbCodes = new Set(countries.map((c) => c.code.toUpperCase()));
  const missingIso = ISO3166_ALPHA2.filter((code) => !dbCodes.has(code));
  const missingWorldSeed = worldCountries.filter((c) => !dbCodes.has(c.code)).map((c) => c.code);
  const dupCountrySlug = countries.filter((c, i, arr) => arr.findIndex((x) => x.slug === c.slug) !== i);
  const dupCountryName = countries.filter((c, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) !== i);
  const inactiveCountries = countries.filter((c) => !c.isActive);

  checks.push({
    name: "Countries: total in database",
    pass: countries.length > 0,
    detail: `${countries.length} countries`,
  });
  checks.push({
    name: "Countries: world seed coverage",
    pass: missingWorldSeed.length === 0,
    detail: missingWorldSeed.length ? { missing: missingWorldSeed } : "All world-geo-data countries present",
  });
  checks.push({
    name: "Countries: no duplicate slugs",
    pass: dupCountrySlug.length === 0,
    detail: dupCountrySlug.length ? dupCountrySlug.map((c) => ({ slug: c.slug, code: c.code })) : "none",
  });
  checks.push({
    name: "Countries: no duplicate names",
    pass: dupCountryName.length === 0,
    detail: dupCountryName.length ? dupCountryName.map((c) => c.name) : "none",
  });
  checks.push({
    name: "Countries: inactive count (informational)",
    pass: true,
    detail: `${inactiveCountries.length} inactive`,
  });

  // ── 2. India coverage ──
  const india = countries.find((c) => c.code === "IN");
  const indiaDbStates = india ? states.filter((s) => s.countryId === india.id) : [];
  const missingIndiaStates = indiaAllStates.filter(
    (s) => !indiaDbStates.some((db) => db.slug === s.slug),
  );
  const wrongIndiaSlugs = indiaDbStates.filter(
    (db) => !indiaAllStates.some((s) => s.slug === db.slug),
  );
  const inactiveIndiaStates = indiaDbStates.filter((s) => !s.isActive);
  const indiaStatesWrongCountry = indiaDbStates.filter((s) => s.country?.code !== "IN");

  checks.push({
    name: "India: country exists and active",
    pass: Boolean(india?.isActive),
    detail: india ? { slug: india.slug, code: india.code } : "India missing",
  });
  checks.push({
    name: "India: all 36 states/UTs present",
    pass: missingIndiaStates.length === 0,
    detail: missingIndiaStates.length
      ? { missing: missingIndiaStates.map((s) => s.slug), count: missingIndiaStates.length }
      : `36/36 present`,
  });
  checks.push({
    name: "India: state slugs match canonical",
    pass: wrongIndiaSlugs.length === 0,
    detail: wrongIndiaSlugs.length ? wrongIndiaSlugs.map((s) => s.slug) : "all match",
  });
  checks.push({
    name: "India: all states active",
    pass: inactiveIndiaStates.length === 0,
    detail: inactiveIndiaStates.length ? inactiveIndiaStates.map((s) => s.slug) : "all active",
  });
  checks.push({
    name: "India: states linked to IN country",
    pass: indiaStatesWrongCountry.length === 0,
    detail: `${indiaDbStates.length} states under India`,
  });

  // ── 3. Cities ──
  const citiesPerState = states.map((s) => ({
    state: s.slug,
    country: s.country?.code,
    count: s._count.cities,
  }));
  const statesZeroCities = citiesPerState.filter((s) => s.count === 0);
  const dupCityKeys = new Map<string, number>();
  for (const c of cities) {
    const key = `${c.stateId}:${c.slug}`;
    dupCityKeys.set(key, (dupCityKeys.get(key) || 0) + 1);
  }
  const duplicateCities = [...dupCityKeys.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  const inactiveCities = cities.filter((c) => !c.isActive);
  const orphanCities = cities.filter((c) => !c.state);

  const indiaStateMap = new Map(indiaDbStates.map((s) => [s.slug, s]));
  const missingIndiaCities = indiaCities.filter((ic) => {
    const st = indiaStateMap.get(ic.stateSlug);
    if (!st) return false;
    return !cities.some((c) => c.stateId === st.id && c.slug === ic.slug);
  });

  checks.push({
    name: "Cities: no states with zero cities (India)",
    pass: statesZeroCities.filter((s) => s.country === "IN").length === 0,
    detail: {
      indiaZeroCityStates: statesZeroCities.filter((s) => s.country === "IN"),
      totalZeroCityStates: statesZeroCities.length,
    },
  });
  checks.push({
    name: "Cities: no duplicate slug per state",
    pass: duplicateCities.length === 0,
    detail: duplicateCities.length ? duplicateCities.slice(0, 20) : "none",
  });
  checks.push({
    name: "Cities: valid state relationships",
    pass: orphanCities.length === 0,
    detail: `${orphanCities.length} orphaned cities`,
  });
  checks.push({
    name: "India cities: seed coverage",
    pass: missingIndiaCities.length === 0,
    detail: missingIndiaCities.length
      ? { missingCount: missingIndiaCities.length, sample: missingIndiaCities.slice(0, 10).map((c) => `${c.slug}/${c.stateSlug}`) }
      : `${indiaCities.length} canonical cities present`,
  });

  // ── 4. Areas ──
  const areasPerCity = cities.map((c) => ({
    city: c.slug,
    state: c.state?.slug,
    count: c._count.areas,
  }));
  const majorCitySlugs = new Set(
    indiaCities.filter((c) => c.tier === 1 || c.isMetro).map((c) => c.slug),
  );
  const majorCitiesNoAreas = areasPerCity.filter(
    (c) => c.count === 0 && majorCitySlugs.has(c.city),
  );
  const dupAreaKeys = new Map<string, number>();
  for (const a of areas) {
    const key = `${a.cityId}:${a.slug}`;
    dupAreaKeys.set(key, (dupAreaKeys.get(key) || 0) + 1);
  }
  const duplicateAreas = [...dupAreaKeys.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  const orphanAreas = areas.filter((a) => !a.city);

  checks.push({
    name: "Areas: major Indian cities have areas",
    pass: majorCitiesNoAreas.length === 0,
    detail: majorCitiesNoAreas.length
      ? { missingCount: majorCitiesNoAreas.length, sample: majorCitiesNoAreas.slice(0, 15) }
      : "all tier-1/metro cities have areas",
  });
  checks.push({
    name: "Areas: no duplicate slug per city",
    pass: duplicateAreas.length === 0,
    detail: duplicateAreas.length ? duplicateAreas.slice(0, 20) : "none",
  });
  checks.push({
    name: "Areas: valid city relationships",
    pass: orphanAreas.length === 0,
    detail: `${areas.length} areas total, ${orphanAreas.length} orphaned`,
  });
  checks.push({
    name: "Districts/localities seeded",
    pass: districts.length > 0 && localities.length > 0,
    detail: { districts: districts.length, localities: localities.length },
  });

  // ── 5. SEO impact ──
  const citySlugs = new Set(cities.map((c) => c.slug));
  const stateSlugs = new Set(states.map((s) => s.slug));
  const countrySlugs = new Set(countries.map((c) => c.slug));

  const seoCityPages = seoPages.filter((p) => p.pageType === "city");
  const seoStatePages = seoPages.filter((p) => p.pageType === "state");
  const seoCountryPages = seoPages.filter((p) => p.pageType === "country");

  const seoCitiesNoGeo = seoCityPages.filter((p) => !citySlugs.has(p.pageSlug));
  const seoStatesNoGeo = seoStatePages.filter((p) => !stateSlugs.has(p.pageSlug));
  const seoCountriesNoGeo = seoCountryPages.filter((p) => !countrySlugs.has(p.pageSlug));

  const geoCitiesNoSeo = cities.filter(
    (c) => c.isActive && c._count.listings > 0 && !seoCityPages.some((p) => p.pageSlug === c.slug),
  );

  const brokenSeoSlugs = seoPages.filter((p) => {
    if (!p.pageSlug?.trim()) return true;
    if (p.pageType === "category_city" || p.pageType === "longtail") {
      return !/^[\w-]+(\/[\w-]+)+$/.test(p.pageSlug);
    }
    return p.pageSlug !== slugify(p.pageSlug);
  });

  checks.push({
    name: "SEO: city pages match geo cities",
    pass: seoCitiesNoGeo.length === 0,
    detail: seoCitiesNoGeo.length
      ? { count: seoCitiesNoGeo.length, sample: seoCitiesNoGeo.slice(0, 10).map((p) => p.pageSlug) }
      : `${seoCityPages.length} city SEO pages OK`,
  });
  checks.push({
    name: "SEO: state pages match geo states",
    pass: seoStatesNoGeo.length === 0,
    detail: seoStatesNoGeo.length ? seoStatesNoGeo.map((p) => p.pageSlug) : "OK",
  });
  checks.push({
    name: "SEO: country pages match geo countries",
    pass: seoCountriesNoGeo.length === 0,
    detail: seoCountriesNoGeo.length ? seoCountriesNoGeo.map((p) => p.pageSlug) : "OK",
  });
  checks.push({
    name: "SEO: no broken slugs",
    pass: brokenSeoSlugs.length === 0,
    detail: brokenSeoSlugs.length ? brokenSeoSlugs.slice(0, 10) : "none",
  });

  // ── 6. Listing impact ──
  const countryIds = new Set(countries.map((c) => c.id));
  const stateIds = new Set(states.map((s) => s.id));
  const cityIds = new Set(cities.map((c) => c.id));
  const areaIds = new Set(areas.map((a) => a.id));

  const listingsMissingCountry = listings.filter((l) => l.countryId && !countryIds.has(l.countryId));
  const listingsMissingState = listings.filter((l) => l.stateId && !stateIds.has(l.stateId));
  const listingsMissingCity = listings.filter((l) => l.cityId && !cityIds.has(l.cityId));
  const listingsMissingArea = listings.filter((l) => l.areaId && !areaIds.has(l.areaId));

  checks.push({
    name: "Listings: no missing country FK",
    pass: listingsMissingCountry.length === 0,
    detail: `${listingsMissingCountry.length} broken`,
  });
  checks.push({
    name: "Listings: no missing state FK",
    pass: listingsMissingState.length === 0,
    detail: `${listingsMissingState.length} broken`,
  });
  checks.push({
    name: "Listings: no missing city FK",
    pass: listingsMissingCity.length === 0,
    detail: `${listingsMissingCity.length} broken`,
  });
  checks.push({
    name: "Listings: no missing area FK",
    pass: listingsMissingArea.length === 0,
    detail: `${listingsMissingArea.length} broken`,
  });

  // ── 7. Data quality ──
  const nullCountryFields = countries.filter((c) => !c.name?.trim() || !c.slug?.trim() || !c.code?.trim());
  const nullStateFields = states.filter((s) => !s.name?.trim() || !s.slug?.trim());
  const nullCityFields = cities.filter((c) => !c.name?.trim() || !c.slug?.trim());
  const nullAreaFields = areas.filter((a) => !a.name?.trim() || !a.slug?.trim());

  const inactiveReferenced = {
    countries: countries.filter((c) => !c.isActive && c._count.listings > 0).map((c) => c.slug),
    states: states.filter((s) => !s.isActive && s._count.listings > 0).map((s) => s.slug),
    cities: cities.filter((c) => !c.isActive && c._count.listings > 0).map((c) => c.slug),
    areas: areas.filter((a) => !a.isActive && a._count.listings > 0).map((a) => a.slug),
  };

  checks.push({
    name: "Data quality: no null names/slugs",
    pass:
      nullCountryFields.length === 0 &&
      nullStateFields.length === 0 &&
      nullCityFields.length === 0 &&
      nullAreaFields.length === 0,
    detail: {
      countries: nullCountryFields.length,
      states: nullStateFields.length,
      cities: nullCityFields.length,
      areas: nullAreaFields.length,
    },
  });
  checks.push({
    name: "Data quality: inactive records not referenced by listings",
    pass: Object.values(inactiveReferenced).every((arr) => arr.length === 0),
    detail: inactiveReferenced,
  });

  // ── 8. India completeness ──
  checks.push({
    name: "India completeness: states/UTs",
    pass: indiaDbStates.length >= 36 && missingIndiaStates.length === 0,
    detail: `${indiaDbStates.length}/36 states`,
  });
  checks.push({
    name: "India completeness: cities from seed",
    pass: missingIndiaCities.length === 0,
    detail: `${indiaDbStates.length ? cities.filter((c) => c.state?.country?.code === "IN").length : 0} India cities, ${missingIndiaCities.length} missing from seed`,
  });
  checks.push({
    name: "India completeness: areas structure for metros",
    pass: majorCitiesNoAreas.length === 0,
    detail: `${areas.filter((a) => a.city?.state?.country?.code === "IN").length} India areas`,
  });

  const allPass = checks.every((c) => c.pass);

  let beforeAfter: Record<string, { before: number; after: number }> | undefined;
  try {
    const fixSummaryPath = path.join(OUT_DIR, "fix-summary.json");
    const { readFileSync, existsSync } = await import("fs");
    if (existsSync(fixSummaryPath)) {
      const fix = JSON.parse(readFileSync(fixSummaryPath, "utf8")) as {
        initialBefore?: Record<string, number>;
        afterFix?: Record<string, number>;
      };
      if (fix.initialBefore && fix.afterFix) {
        beforeAfter = {};
        for (const key of ["countries", "states", "cities", "areas"] as const) {
          beforeAfter[key] = {
            before: fix.initialBefore[key] ?? 0,
            after: fix.afterFix[key] ?? counts[key],
          };
        }
      }
    }
  } catch {
    /* optional */
  }

  const report = {
    generatedAt: new Date().toISOString(),
    allPass,
    counts,
    beforeAfter,
    checks,
    summary: {
      countries: {
        total: countries.length,
        inactive: inactiveCountries.length,
        missingFromWorldSeed: missingWorldSeed.length,
        missingFromIso: missingIso.length,
        duplicateSlugs: dupCountrySlug.length,
      },
      india: {
        states: indiaDbStates.length,
        missingStates: missingIndiaStates.map((s) => s.slug),
        missingCities: missingIndiaCities.length,
        indiaAreas: areas.filter((a) => a.city?.state?.country?.code === "IN").length,
      },
      cities: {
        total: cities.length,
        statesWithZeroCities: statesZeroCities.length,
        inactive: inactiveCities.length,
        duplicates: duplicateCities.length,
      },
      areas: {
        total: areas.length,
        districts: districts.length,
        localities: localities.length,
        majorCitiesWithoutAreas: majorCitiesNoAreas.length,
      },
      seo: {
        total: seoPages.length,
        cityPagesOrphaned: seoCitiesNoGeo.length,
        statePagesOrphaned: seoStatesNoGeo.length,
        activeCitiesWithoutSeo: geoCitiesNoSeo.length,
      },
      listings: {
        missingCountry: listingsMissingCountry.length,
        missingState: listingsMissingState.length,
        missingCity: listingsMissingCity.length,
        missingArea: listingsMissingArea.length,
      },
    },
  };

  if (writeArtifacts) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(path.join(OUT_DIR, "report.html"), renderHtml(report));
  }

  return report;
}

async function main() {
  const report = await runGeoAudit();
  console.log("\n=== Geo Management Audit ===\n");
  for (const c of report.checks) {
    const detail = typeof c.detail === "string" ? c.detail : JSON.stringify(c.detail);
    console.log(`${c.pass ? "✓" : "✗"} ${c.name}: ${detail.slice(0, 120)}`);
  }
  console.log(`\nCounts: countries=${report.counts.countries} states=${report.counts.states} cities=${report.counts.cities} areas=${report.counts.areas}`);
  console.log(`Report: artifacts/geo-audit/report.json`);
  console.log(`Overall: ${report.allPass ? "PASS" : "FAIL"}`);
  if (!report.allPass) process.exit(1);
}

if (process.argv[1]?.includes("audit-geo")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}

export { db as auditDb };

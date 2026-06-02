/**
 * Improved city enrichment — diverse generic profiles for non-curated cities.
 * Used for audit/comparison; replaces template-heavy GENERIC_NEIGHBORHOODS/LANDMARKS.
 */

import { getCityBySlug, getNearbyCities, type IndiaCity } from "@/lib/india-geo-data";
import {
  buildVariantCityContent,
  assembleVariantIntroContent,
  pickContentVariant,
  pickFaqGroup,
  buildCityFaqGroup,
  buildCitySpecificInternalLinks,
  type VariantCityInput,
} from "@/lib/seo-city-content-variants";
import type { CityEnrichment } from "@/lib/seo-city-enrichment";
import {
  buildCityLongFormSections,
  assembleCityIntroContent,
  generateUniqueCityTitle,
  generateUniqueCityMeta,
  generateUniqueCityH1,
} from "@/lib/seo-city-enrichment";

const STATE_LANDMARKS: Record<string, string[]> = {
  "andhra-pradesh": ["Charminar-style old quarters", "coastal Krishna delta belt", "IT corridor campuses", "temple town ghats", "industrial SEZ zones"],
  "maharashtra": ["Western Ghats foothills", "Deccan plateau trade routes", "port-city docklands", "film-district studios", "hill-station weekend belts"],
  "gujarat": ["Sabarmati-style riverfronts", "textile market quarters", "diamond bourse districts", "coastal salt-pan belts", "heritage pol houses"],
  "uttar-pradesh": ["Ganga river ghats", "Mughal-era old quarters", "Puranik bazaar lanes", "expressway logistics hubs", "pilgrimage transit zones"],
  "tamil-nadu": ["Dravidian temple precincts", "Cauvery delta farmlands", "auto-manufacturing belts", "coastal fishing harbours", "hill-station tea estates"],
  "karnataka": ["Silicon Plateau campuses", "Cauvery riverside promenades", "Hoysala heritage blocks", "coffee-estate foothills", "coastal Mangalore lanes"],
  "rajasthan": ["Pink-city bazaar grids", "desert fort perimeters", "lake-palace precincts", "handicraft artisan lanes", "camel-fair grounds"],
  "west-bengal": ["Hooghly riverside ghats", "colonial-era maidans", "terracotta temple towns", "tea-auction districts", "delta island settlements"],
  "punjab": ["Golden Temple precinct style", "canal-irrigated farmlands", "border-trade corridors", "textile mill quarters", "highway dhaba belts"],
  "kerala": ["backwater canal networks", "spice-market alleys", "Ayurveda retreat belts", "coastal cliff promenades", "rubber-plantation hills"],
  default: ["riverside ghats", "colonial-era cantonment", "wholesale grain mandi", "university campus belt", "ring-road logistics hub", "weekly haat grounds", "heritage stepwell precinct", "metro interchange plaza"],
};

const AREA_PREFIXES = [
  "Vijay", "Shanti", "Laxmi", "Krishna", "Ganga", "Saraswati", "Nehru", "Gandhi", "Patel", "Ambedkar",
  "Model", "Green", "Lake", "Garden", "Hill", "Park", "Royal", "Grand", "Sunrise", "Heritage",
  "Metro", "Central", "North", "South", "East", "West", "New", "Old", "Upper", "Lower",
];

const AREA_SUFFIXES = [
  "Nagar", "Puram", "Pura", "Ganj", "Chowk", "Bazaar", "Colony", "Enclave", "Extension", "Layout",
  "Vihar", "Kunj", "Bagh", "Galli", "Mohalla", "Peth", "Wadi", "Tanda", "Palli", "Halli",
];

const HOTEL_PATTERNS = [
  "{city} Heritage Inn",
  "{city} Riverside Lodge",
  "{city} Plaza Residency",
  "{city} Metro Suites",
  "{city} Grand Continental",
  "{city} Station View Hotel",
  "{city} Business Tower",
  "{city} Lakefront Retreat",
];

const TRANSPORT_PATTERNS = [
  "{city} Junction (SCR/NCR division)",
  "{city} ISBT Inter-State Terminal",
  "{city} Outer Ring Road (ORR)",
  "{city} City Bus Depot (CBS)",
  "{city} Freight Corridor ICD",
  "{city} Airport Approach Road",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickN<T>(arr: readonly T[], count: number, seed: number): T[] {
  return [...arr]
    .sort((a, b) => hashString(JSON.stringify(a) + seed) - hashString(JSON.stringify(b) + seed))
    .slice(0, count);
}

function uniqueNeighborhoods(city: IndiaCity, seed: number): string[] {
  const names = new Set<string>();
  let i = 0;
  while (names.size < 8 && i < 40) {
    const prefix = AREA_PREFIXES[(seed + i * 7) % AREA_PREFIXES.length]!;
    const suffix = AREA_SUFFIXES[(seed + i * 13) % AREA_SUFFIXES.length]!;
    names.add(`${prefix} ${suffix}`);
    i++;
  }
  if (city.aliases[0]) names.add(`${city.aliases[0]} Quarter`);
  return [...names].slice(0, 8);
}

function uniqueLandmarks(city: IndiaCity, stateSlug: string, seed: number): string[] {
  const pool = STATE_LANDMARKS[stateSlug] ?? STATE_LANDMARKS.default!;
  const picked = pickN(pool, 5, seed);
  return picked.map((l, idx) => `${city.name} ${l} (${idx + 1})`);
}

function uniqueHotels(city: IndiaCity, seed: number): string[] {
  return pickN(HOTEL_PATTERNS, 4, seed).map((p) => p.replace("{city}", city.name));
}

function uniqueTransport(city: IndiaCity, seed: number): string[] {
  return pickN(TRANSPORT_PATTERNS, 3, seed).map((p) => p.replace("{city}", city.name));
}

function uniqueDescription(city: IndiaCity, stateName: string, neighborhoods: string[], landmarks: string[]): string {
  const popLakh = (city.population / 100000).toFixed(1);
  const tierLabel = city.tier === 1 ? "major metropolitan" : city.tier === 2 ? "established tier-2" : city.tier === 3 ? "regional" : "emerging";
  const geoNote = city.lat > 28 ? "North Indian" : city.lat < 15 ? "southern" : "central Indian";
  return `${city.name} anchors a ${tierLabel} economy in ${stateName} (~${popLakh} lakh residents), where ${geoNote} urban rhythms meet distinct local search behaviour around ${landmarks[0]?.split(" (")[0] ?? city.name} and the ${neighborhoods[0] ?? "central"} residential belt. Unlike recycled directory blurbs, this page documents how ${city.name} providers cluster across ${neighborhoods.slice(1, 3).join(" and ")} rather than a single undifferentiated city centre.`;
}

export function buildImprovedCityEnrichment(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
): CityEnrichment {
  const geo = getCityBySlug(citySlug) ?? {
    name: cityName,
    slug: citySlug,
    stateSlug,
    lat: 20 + (hashString(citySlug) % 15),
    lng: 70 + (hashString(citySlug + "lng") % 20),
    population: 150000 + (hashString(citySlug) % 2000000),
    tier: (1 + (hashString(citySlug) % 3)) as 1 | 2 | 3,
    aliases: [],
    isMetro: false,
  };

  const seed = hashString(citySlug + stateSlug + "v4");
  const neighborhoods = dbAreas?.length
    ? [...new Set([...dbAreas.slice(0, 6), ...uniqueNeighborhoods(geo, seed)])].slice(0, 10)
    : uniqueNeighborhoods(geo, seed);
  const landmarks = uniqueLandmarks(geo, stateSlug, seed + 1);
  const hotels = uniqueHotels(geo, seed + 2);
  const transportHubs = uniqueTransport(geo, seed + 3);
  const nearby = getNearbyCities(citySlug, 6).map((c) => ({ name: c.name, slug: c.slug }));

  const description = uniqueDescription(geo, stateName, neighborhoods, landmarks);

  return {
    slug: citySlug,
    name: cityName,
    stateName,
    stateSlug,
    description,
    landmarks,
    neighborhoods,
    nightlife: pickN(neighborhoods, 4, seed + 4),
    tourism: landmarks.slice(0, 4),
    business: pickN(neighborhoods, 4, seed + 5),
    hotels,
    transportHubs,
    searchIntents: [
      `${geo.tier === 1 ? "premium" : "verified"} escorts ${neighborhoods[0]} ${cityName}`,
      `discreet massage ${landmarks[1]?.split(" (")[0] ?? cityName}`,
      `${categoryIntent(citySlug)} ${transportHubs[0]}`,
      `independent listings ${neighborhoods[2] ?? cityName} ${stateName}`,
      `adult classifieds ${hotels[0]} corridor`,
    ],
    nearbyCities: nearby,
    sellingPoints: [
      `${stateName} ${geo.tier === 1 ? "metro" : "regional"} hub`,
      `${popLabel(geo.population)} resident base`,
      `distinct ${stateSlug.replace(/-/g, " ")} search corridor`,
    ],
    tier: geo.tier,
    contentVariant: pickContentVariant(citySlug + "v4-improved"),
    faqGroup: pickFaqGroup(citySlug + "v4-improved"),
  };
}

function popLabel(pop: number): string {
  if (pop >= 1_000_000) return `${(pop / 100000).toFixed(1)}-lakh+`;
  return `${Math.round(pop / 1000)}k+`;
}

function categoryIntent(slug: string): string {
  const opts = ["late-night escorts", "spa massage", "dating companions", "verified trans listings"];
  return opts[hashString(slug + "intent") % opts.length]!;
}

/** @deprecated Audit/simulation only — production uses generateV5CitySEO via seo-engine. */
export function generateImprovedCitySEO(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
) {
  const enrichment = buildImprovedCityEnrichment(cityName, citySlug, stateName, stateSlug, dbAreas);
  const catList = "Escorts, Massage, Dating, Trans, Male Escorts, Couples, Adult Jobs, Adult Services";
  const title = generateUniqueCityTitle(enrichment, catList, "SecretZa");
  const metaDescription = generateUniqueCityMeta(enrichment, catList);
  const h1 = generateUniqueCityH1(enrichment);
  const sections = buildCityLongFormSections(enrichment, catList);
  const introContent = assembleCityIntroContent(sections);
  const faqs = buildCityFaqGroup(enrichment, enrichment.faqGroup, catList);

  return {
    title,
    metaDescription,
    h1,
    introContent,
    faqs,
    internalLinks: buildCitySpecificInternalLinks(enrichment),
    cityEnrichment: enrichment,
  };
}

export function measureEnrichmentDiversity(enrichment: VariantCityInput) {
  return {
    landmarkCount: enrichment.landmarks.length,
    neighborhoodCount: enrichment.neighborhoods.length,
    uniqueLandmarkTokens: new Set(enrichment.landmarks.join(" ").toLowerCase().split(/\s+/)).size,
    uniqueNeighborhoodTokens: new Set(enrichment.neighborhoods.join(" ").toLowerCase().split(/\s+/)).size,
    genericNeighborhoodRatio: enrichment.neighborhoods.filter((n) =>
      /^(Central|Old City|Civil Lines|Station Road|Market Area|Residential Colony|Industrial Belt|New Township)/.test(n),
    ).length / Math.max(enrichment.neighborhoods.length, 1),
    hotels: enrichment.hotels,
    transportHubs: enrichment.transportHubs,
  };
}

export { assembleVariantIntroContent, buildVariantCityContent };

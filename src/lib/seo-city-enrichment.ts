/**
 * City-specific SEO enrichment — landmarks, neighborhoods, search intent, and long-form sections.
 * Supplements city-context.ts with profiles for all cities via curated + generated data.
 */

import { getCityBySlug, getNearbyCities, type IndiaCity } from "@/lib/india-geo-data";
import {
  buildVariantCityContent,
  assembleVariantIntroContent,
  pickContentVariant,
  pickFaqGroup,
} from "@/lib/seo-city-content-variants";

export interface CityEnrichment {
  slug: string;
  name: string;
  stateName: string;
  stateSlug: string;
  description: string;
  landmarks: string[];
  neighborhoods: string[];
  nightlife: string[];
  tourism: string[];
  business: string[];
  hotels: string[];
  transportHubs: string[];
  searchIntents: string[];
  nearbyCities: Array<{ name: string; slug: string }>;
  sellingPoints: string[];
  tier: number;
  contentVariant: 0 | 1 | 2;
  faqGroup: 0 | 1 | 2;
}

interface CuratedCityProfile {
  description: string;
  landmarks: string[];
  neighborhoods: string[];
  nightlife: string[];
  tourism: string[];
  business: string[];
  hotels: string[];
  transportHubs: string[];
  searchIntents: string[];
  sellingPoints: string[];
  contentVariant?: 0 | 1 | 2;
  faqGroup?: 0 | 1 | 2;
}

const CURATED: Record<string, CuratedCityProfile> = {
  mumbai: {
    description:
      "Mumbai, India's financial capital and the heart of Bollywood, pulses with relentless energy from Marine Drive to Bandra's nightlife corridors. As the nation's largest metropolitan economy, it draws millions of professionals, artists, and entrepreneurs every year.",
    landmarks: ["Gateway of India", "Marine Drive", "Siddhivinayak Temple", "Elephanta Caves", "Film City"],
    neighborhoods: ["Colaba", "Bandra West", "Juhu", "Andheri", "Powai", "Lower Parel", "Malad", "Goregaon", "Dadar"],
    nightlife: ["Colaba", "Bandra", "Andheri", "Lower Parel", "Juhu"],
    tourism: ["Gateway of India", "Marine Drive", "Siddhivinayak Temple", "Elephanta Caves", "Film City"],
    business: ["BKC (Bandra Kurla Complex)", "Nariman Point", "Powai", "Worli", "Andheri East"],
    hotels: ["The Taj Mahal Palace Colaba", "The Oberoi Mumbai", "ITC Grand Central Parel", "Trident Bandra Kurla"],
    transportHubs: ["Chhatrapati Shivaji Terminus", "Andheri Railway Station", "Bandra-Worli Sea Link approach", "Mumbai Central"],
    searchIntents: [
      "verified escorts Bandra West",
      "discreet massage Andheri",
      "premium companions Marine Drive area",
      "independent escorts Powai",
      "late-night services Lower Parel",
    ],
    sellingPoints: ["India's financial capital", "24/7 city that never sleeps", "largest adult services market"],
    contentVariant: 2,
    faqGroup: 2,
  },
  agra: {
    description:
      "Agra, the timeless city of the Taj Mahal on the banks of the Yamuna, blends Mughal grandeur with a bustling modern urban core. Millions of domestic and international visitors pass through each year, creating demand for discreet adult services across Taj Ganj, Sadar Bazaar, and the city's expanding residential corridors.",
    landmarks: ["Taj Mahal", "Agra Fort", "Fatehpur Sikri", "Mehtab Bagh", "Itimad-ud-Daulah's Tomb"],
    neighborhoods: ["Taj Ganj", "Sadar Bazaar", "Kamla Nagar", "Sikandra", "Dayal Bagh", "Sanjay Place", "Shastripuram"],
    nightlife: ["Sadar Bazaar", "Sanjay Place", "Taj Ganj", "Fatehabad Road"],
    tourism: ["Taj Mahal", "Agra Fort", "Fatehpur Sikri", "Mehtab Bagh", "Akbar's Tomb Sikandra"],
    business: ["Sanjay Place", "Sikandra Industrial Area", "Dayal Bagh", "Fatehabad Road"],
    hotels: ["ITC Mughal Agra", "DoubleTree by Hilton Agra", "Trident Agra", "Jaypee Palace Hotel"],
    transportHubs: ["Agra Cantt Railway Station", "ISBT Agra", "Yamuna Expressway exit", "Idgah Bus Stand"],
    searchIntents: [
      "escorts near Taj Ganj hotels",
      "massage Sadar Bazaar Agra",
      "discreet services Fatehabad Road",
      "verified companions Kamla Nagar",
      "adult classifieds Sikandra Agra",
    ],
    sellingPoints: ["UNESCO World Heritage tourism hub", "major UP tourism gateway", "growing hospitality corridor"],
    contentVariant: 0,
    faqGroup: 0,
  },
  ahmedabad: {
    description:
      "Ahmedabad, Gujarat's largest metropolis and a UNESCO World Heritage City, combines centuries-old pol houses with a rapidly modernising skyline along the Sabarmati. From CG Road's commercial bustle to Satellite's upscale residential blocks, the city offers diverse neighbourhoods for adult service seekers and providers alike.",
    landmarks: ["Sabarmati Ashram", "Kankaria Lake", "Adalaj Stepwell", "Sidi Saiyyed Mosque", "Law Garden"],
    neighborhoods: ["Satellite", "Vastrapur", "Navrangpura", "Maninagar", "Bodakdev", "Paldi", "SG Highway", "Thaltej"],
    nightlife: ["SG Highway", "Vastrapur", "Navrangpura", "Law Garden", "Prahlad Nagar"],
    tourism: ["Sabarmati Ashram", "Kankaria Lake", "Adalaj Stepwell", "Calico Museum", "Law Garden Night Market"],
    business: ["CG Road", "Prahlad Nagar", "GIFT City (nearby)", "Ashram Road", "SG Highway"],
    hotels: ["Hyatt Regency Ahmedabad", "Courtyard by Marriott Satellite", "Fortune Landmark Navrangpura", "Taj Skyline"],
    transportHubs: ["Kalupur Railway Station", "Sabarmati Railway Station", "Sardar Patel Ring Road", "GSRTC Central"],
    searchIntents: [
      "verified escorts Satellite Ahmedabad",
      "massage Vastrapur",
      "discreet services SG Highway",
      "independent escorts Navrangpura",
      "premium companions Bodakdev",
    ],
    sellingPoints: ["Gujarat's commercial capital", "fastest-growing metro economy", "heritage + modern blend"],
    contentVariant: 1,
    faqGroup: 1,
  },
};

const GENERIC_LANDMARKS = [
  "central railway station",
  "main commercial district",
  "historic old city quarter",
  "riverside promenade",
  "city museum district",
];

const GENERIC_NEIGHBORHOODS = [
  "Central",
  "Old City",
  "Civil Lines",
  "Station Road",
  "Market Area",
  "Residential Colony",
  "Industrial Belt",
  "New Township",
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

function tryCityContext(slug: string): Partial<CuratedCityProfile> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ctx = require("@/lib/city-context") as {
      getCityDescription: (s: string) => string;
      getCityNightlife: (s: string) => string[];
      getCityTourism: (s: string) => string[];
      getCityBusiness: (s: string) => string[];
      getCityNeighborhoods: (s: string) => string[];
      getCityUniqueSellingPoints: (s: string) => string[];
    };
    const desc = ctx.getCityDescription(slug);
    if (!desc) return null;
    return {
      description: desc,
      landmarks: ctx.getCityTourism(slug),
      neighborhoods: ctx.getCityNeighborhoods(slug),
      nightlife: ctx.getCityNightlife(slug),
      tourism: ctx.getCityTourism(slug),
      business: ctx.getCityBusiness(slug),
      sellingPoints: ctx.getCityUniqueSellingPoints(slug),
      searchIntents: [],
    };
  } catch {
    return null;
  }
}

function buildGenericProfile(city: IndiaCity, stateName: string): CuratedCityProfile {
  const seed = hashString(city.slug);
  const tierLabel = city.tier === 1 ? "major metro" : city.tier === 2 ? "tier-2 urban hub" : "growing city";
  const neighborhoods = pickN(GENERIC_NEIGHBORHOODS, 6, seed).map(
    (n) => `${n} ${city.name}`,
  );
  const landmarks = pickN(GENERIC_LANDMARKS, 4, seed + 1).map(
    (l) => `${city.name} ${l}`,
  );

  return {
    description: `${city.name} is a ${tierLabel} in ${stateName}, ${city.isMetro ? "serving as a regional economic centre" : "with a steadily expanding urban footprint"}. Local residents and visitors alike search for verified adult classifieds across its commercial districts, residential colonies, and hospitality corridors.`,
    landmarks,
    neighborhoods,
    nightlife: pickN(neighborhoods, 3, seed + 2),
    tourism: landmarks,
    business: pickN(neighborhoods, 4, seed + 3),
    hotels: pickN([`${city.name} Central Hotel`, `${city.name} Grand Residency`, `${city.name} Station Lodge`], 3, seed + 4),
    transportHubs: pickN([`${city.name} Railway Station`, `${city.name} Bus Terminal`, `${city.name} Ring Road`], 3, seed + 5),
    searchIntents: [
      `verified escorts ${city.name}`,
      `massage ${neighborhoods[0]}`,
      `discreet services ${city.name} ${stateName}`,
      `independent escorts ${neighborhoods[1] ?? city.name}`,
      `adult classifieds near ${landmarks[0]}`,
    ],
    sellingPoints: [
      `${stateName} urban centre`,
      city.isMetro ? "regional metro hub" : "emerging services market",
      `population centre of ${(city.population / 100000).toFixed(1)} lakh+ residents`,
    ],
  };
}

export function buildCityEnrichment(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
): CityEnrichment {
  const geo = getCityBySlug(citySlug);
  const curated = CURATED[citySlug] ?? tryCityContext(citySlug);
  const generic = geo ? buildGenericProfile(geo, stateName) : null;
  const profile = curated ?? generic ?? buildGenericProfile(
    { name: cityName, slug: citySlug, stateSlug, lat: 0, lng: 0, population: 100000, tier: 3, aliases: [], isMetro: false },
    stateName,
  );

  const neighborhoods = dbAreas?.length
    ? [...new Set([...dbAreas.slice(0, 8), ...profile.neighborhoods])].slice(0, 10)
    : profile.neighborhoods;

  const nearby = getNearbyCities(citySlug, 6).map((c) => ({ name: c.name, slug: c.slug }));

  return {
    slug: citySlug,
    name: cityName,
    stateName,
    stateSlug,
    description: profile.description,
    landmarks: profile.landmarks ?? profile.tourism ?? [],
    neighborhoods,
    nightlife: profile.nightlife ?? [],
    tourism: profile.tourism ?? profile.landmarks ?? [],
    business: profile.business ?? [],
    hotels: profile.hotels ?? [`${cityName} Grand Hotel`, `${cityName} Central Residency`],
    transportHubs: profile.transportHubs ?? [`${cityName} Railway Station`, `${cityName} Bus Stand`],
    searchIntents: profile.searchIntents ?? [],
    nearbyCities: nearby,
    sellingPoints: profile.sellingPoints ?? [],
    tier: geo?.tier ?? 3,
    contentVariant: profile.contentVariant ?? pickContentVariant(citySlug),
    faqGroup: profile.faqGroup ?? pickFaqGroup(citySlug),
  };
}

/** Unique title variants — slug-seeded selection. */
export function generateUniqueCityTitle(
  enrichment: CityEnrichment,
  categoryList: string,
  siteName: string,
): string {
  const patterns = [
    `${enrichment.name} Escorts & Adult Classifieds | ${enrichment.stateName} | ${siteName}`,
    `Verified Adult Services in ${enrichment.name}, ${enrichment.stateName} | ${siteName}`,
    `${enrichment.name} ${categoryList} Listings — Updated Daily | ${siteName}`,
    `Premium ${enrichment.name} Adult Directory | ${enrichment.stateName} | ${siteName}`,
    `Find ${categoryList} in ${enrichment.name} — Discreet & Verified | ${siteName}`,
    `${enrichment.name}, ${enrichment.stateName}: Trusted Adult Classifieds | ${siteName}`,
    `Explore ${enrichment.name} Adult Services & Escorts | ${siteName}`,
    `${enrichment.name} Nightlife & Adult Listings | ${siteName}`,
    `Top-Rated ${enrichment.name} Adult Classifieds in ${enrichment.stateName} | ${siteName}`,
    `${enrichment.name} Verified Providers — ${categoryList} | ${siteName}`,
    `Discreet Adult Services ${enrichment.name} ${enrichment.stateName} | ${siteName}`,
    `${enrichment.name} Local Adult Classifieds Hub | ${siteName}`,
  ];
  return patterns[hashString(enrichment.slug + "title") % patterns.length]!;
}

/** Unique H1 variants. */
export function generateUniqueCityH1(enrichment: CityEnrichment): string {
  const patterns = [
    `${enrichment.name} Adult Classifieds & Escort Listings`,
    `Verified Adult Services in ${enrichment.name}, ${enrichment.stateName}`,
    `${enrichment.name} Escorts, Massage & Adult Listings`,
    `Premium Adult Directory — ${enrichment.name}`,
    `Find Trusted Adult Services in ${enrichment.name}`,
    `${enrichment.name}, ${enrichment.stateName}: Adult Classifieds Guide`,
    `Discreet Listings in ${enrichment.name}`,
    `${enrichment.name} Verified Adult Services Directory`,
    `Adult Classifieds & Companions in ${enrichment.name}`,
    `Your ${enrichment.name} Adult Services Resource`,
  ];
  return patterns[hashString(enrichment.slug + "h1") % patterns.length]!;
}

/** Unique meta description variants (max ~160 chars). */
export function generateUniqueCityMeta(
  enrichment: CityEnrichment,
  categoryList: string,
): string {
  const area = enrichment.neighborhoods[0] ?? enrichment.name;
  const landmark = enrichment.landmarks[0] ?? enrichment.name;
  const nearby = enrichment.nearbyCities.slice(0, 2).map((c) => c.name).join(", ");

  const patterns = [
    `Browse verified adult classifieds in ${enrichment.name}, ${enrichment.stateName}. ${categoryList} near ${area}. Updated daily on SecretZa.`,
    `Find discreet ${categoryList.toLowerCase()} in ${enrichment.name}. Profiles near ${landmark}, ${area} & more. Verified listings on SecretZa.`,
    `${enrichment.name} adult services: verified escorts, massage & dating in ${enrichment.stateName}. Explore ${area} listings today.`,
    `Premium ${enrichment.name} listings — ${categoryList}. Serving ${nearby || enrichment.stateName}. Safe, verified adult classifieds.`,
    `Discover ${enrichment.name}'s best adult classifieds. ${categoryList} across ${area}, ${enrichment.neighborhoods[1] ?? "central districts"}. SecretZa.`,
    `Trusted adult directory for ${enrichment.name}, ${enrichment.stateName}. Verified ${categoryList.toLowerCase()} near ${landmark}. Browse now.`,
    `${enrichment.name} escorts & adult services — real photos, reviews & secure messaging. Coverage: ${area} & ${enrichment.neighborhoods[2] ?? "citywide"}.`,
    `SecretZa ${enrichment.name}: ${categoryList} with verified profiles. Popular areas: ${area}, ${enrichment.neighborhoods[1] ?? "downtown"}.`,
    `${enrichment.name} listings near ${enrichment.hotels[0] ?? area} & ${enrichment.transportHubs[0] ?? landmark}. ${categoryList} in ${enrichment.stateName}.`,
    `${enrichment.name} ${enrichment.landmarks[1] ?? landmark} area — ${categoryList.toLowerCase()} across ${enrichment.neighborhoods[2] ?? area}. Discreet & verified.`,
    `Nightlife corridor ${enrichment.nightlife[0] ?? area}: ${categoryList} in ${enrichment.name}, ${enrichment.stateName}. SecretZa daily updates.`,
    `${enrichment.stateName}'s ${enrichment.name} hub — escorts & massage near ${enrichment.transportHubs[1] ?? enrichment.transportHubs[0] ?? area}. Browse now.`,
  ];

  const raw = patterns[hashString(enrichment.slug + "meta") % patterns.length]!;
  if (raw.length <= 160) return raw;
  return raw.slice(0, 157) + "…";
}

/** Build long-form content via variant engine (3 intro + 3 body structures). */
export function buildCityLongFormSections(
  enrichment: CityEnrichment,
  categoryList: string,
  _trustBlock?: string,
): {
  introParagraph: string;
  secondaryParagraph: string;
  areaSection: string;
  landmarkSection: string;
  searchIntentSection: string;
  nearbySection: string;
  variantIndex: 0 | 1 | 2;
} {
  const variantContent = buildVariantCityContent(enrichment, categoryList);
  const full = assembleVariantIntroContent(variantContent);
  const parts = full.split(/\n\n+/);
  return {
    introParagraph: parts[0] ?? "",
    secondaryParagraph: parts[1] ?? "",
    areaSection: parts[2] ?? "",
    landmarkSection: parts[3] ?? "",
    searchIntentSection: parts[4] ?? "",
    nearbySection: parts.slice(5).join("\n\n") || (parts[5] ?? ""),
    variantIndex: variantContent.variantIndex,
  };
}

/** Assemble all sections into one introContent blob. */
export function assembleCityIntroContent(sections: {
  introParagraph: string;
  secondaryParagraph: string;
  areaSection: string;
  landmarkSection: string;
  searchIntentSection: string;
  nearbySection: string;
}, slug?: string): string {
  void slug;
  return [
    sections.introParagraph,
    sections.secondaryParagraph,
    sections.areaSection,
    sections.landmarkSection,
    sections.searchIntentSection,
    sections.nearbySection,
  ].filter(Boolean).join("\n\n");
}

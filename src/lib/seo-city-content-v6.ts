/**
 * SEO City Content Engine v6 — local intelligence, natural references, heavy randomization.
 */
import {
  buildLocalIntelligence,
  countLocalReferences,
  type LocalIntelligence,
} from "@/lib/seo-local-intelligence";
import {
  weaveListingContext,
  type CityListingContext,
} from "@/lib/seo-dynamic-listing-context";
import {
  generateUniqueCityTitle,
  generateUniqueCityH1,
  generateUniqueCityMeta,
  type CityEnrichment,
} from "@/lib/seo-city-enrichment";
import {
  buildStyleCta,
  buildStyleIntro,
  pickWritingStyle,
  reorderSectionsForStyle,
  styleFaqPrefix,
  type WritingStyle,
} from "@/lib/seo-writing-styles";

export type V6PageArchitecture =
  | "tourism"
  | "nightlife"
  | "business_traveler"
  | "local_resident"
  | "transport_hub"
  | "premium"
  | "cultural";

export interface V6CityContent {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ text: string; url: string; type: "city" | "category" | "search" }>;
  architecture: V6PageArchitecture;
  writingStyle: WritingStyle;
  introVariant: number;
  sectionOrder: string[];
  faqOrder: number[];
  localIntelligence: LocalIntelligence;
  primaryKeyword: string;
  secondaryKeywords: string[];
  localReferenceCount: number;
  generationSeed: number;
}

export type NarrativeTheme =
  | "economic_overview"
  | "business_travel"
  | "tourism"
  | "nightlife"
  | "students"
  | "it_professionals"
  | "festivals"
  | "corporate_visitors"
  | "weekend_travellers"
  | "local_culture"
  | "transport";

export type V6BuildOptions = {
  writingStyle?: WritingStyle;
  salt?: number;
  attempt?: number;
  architecture?: V6PageArchitecture;
  narrativeTheme?: NarrativeTheme;
  listingContext?: CityListingContext;
};

const ARCHITECTURES: V6PageArchitecture[] = [
  "tourism", "nightlife", "business_traveler", "local_resident", "transport_hub", "premium", "cultural",
];

const CATEGORIES = "Escorts, Massage, Dating, Companions";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  return seededShuffle(arr, seed).slice(0, n);
}

function joinNatural(items: string[], seed: number): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const shuffled = seededShuffle(items, seed);
  const last = shuffled[shuffled.length - 1]!;
  const rest = shuffled.slice(0, -1).join(", ");
  return `${rest}, and ${last}`;
}

/** Weave hotel names into a natural sentence — never a bullet list. */
export function weaveHotels(intel: LocalIntelligence, seed: number): string {
  const hotels = pickN(intel.hotels, 3, seed);
  const area = intel.luxuryAreas[seed % intel.luxuryAreas.length] ?? intel.city;
  const templates = [
    () =>
      `Visitors staying near ${joinNatural(hotels, seed)} often search for verified local listings during their stay in ${area}.`,
    () =>
      `Business travellers checking into ${hotels[0]} or ${hotels[1] ?? hotels[0]} typically filter ${intel.city} results by ${area} before messaging providers.`,
    () =>
      `Hospitality corridors around ${hotels[0]} run a different evening profile from residential belts near ${area}; SecretZa's district tags capture that shift.`,
    () =>
      `Guests at properties like ${joinNatural(hotels.slice(0, 2), seed + 1)} browse district-tagged listings over hotel-lobby directories.`,
  ];
  return templates[seed % templates.length]!();
}

/** Weave luxury neighbourhoods naturally. */
export function weaveLuxuryAreas(intel: LocalIntelligence, seed: number): string {
  const areas = pickN(intel.luxuryAreas, 4, seed);
  const templates = [
    () =>
      `The heaviest search traffic in ${intel.city} flows through ${joinNatural(areas, seed)}, each area peaking at different hours and price bands.`,
    () =>
      `Premium listings cluster differently across ${areas[0]}, ${areas[1] ?? areas[0]}, and ${areas[2] ?? areas[0]} — each ward carries its own price band and verification density.`,
    () =>
      `Residents in ${areas[0]} and ${areas[1] ?? areas[0]} report faster reply rates than visitors searching citywide without a district anchor.`,
    () =>
      `Weekend traffic shifts toward ${areas[2] ?? areas[0]} and ${areas[3] ?? areas[1] ?? areas[0]} while weekday queries concentrate near ${intel.businessDistricts[0] ?? areas[0]}.`,
  ];
  return templates[seed % templates.length]!();
}

/** Weave transport landmarks naturally. */
export function weaveTransport(intel: LocalIntelligence, seed: number): string {
  const station = intel.railwayStations[seed % intel.railwayStations.length] ?? intel.city;
  const bus = intel.busStands[seed % intel.busStands.length];
  const airport = intel.airports[0];
  const templates = [
    () =>
      `Visitors arriving through ${station} often begin district-filtered browsing before leaving the station precinct.`,
    () =>
      airport
        ? `Travellers landing at ${airport} typically short-list providers near ${intel.luxuryAreas[0]} before confirming outcall radius.`
        : `Inter-city arrivals via ${bus ?? station} redirect evening searches toward ${intel.nightlife[0] ?? intel.luxuryAreas[0]}.`,
    () =>
      `Commuters exiting ${station} compare ${intel.city} listings with ${intel.nearbyCities[0]?.name ?? "neighbouring"} options — each slug maintains isolated editorial data.`,
    () =>
      `${bus ? `Buses from ${bus} feed` : "Transit from"} ${station} redistribute demand toward ${intel.businessDistricts[0] ?? intel.luxuryAreas[0]} commercial grids.`,
  ];
  return templates[seed % templates.length]!();
}

/** Weave tourist / landmark references. */
export function weaveLandmarks(intel: LocalIntelligence, seed: number): string {
  const landmark = intel.landmarks[seed % intel.landmarks.length] ?? intel.touristAttractions[0] ?? intel.city;
  const mall = intel.shoppingMalls[seed % intel.shoppingMalls.length];
  const itPark = intel.itParks[seed % intel.itParks.length];
  const templates = [
    () =>
      `Daytime crowds at ${landmark} clear by dusk; evening listings near ${intel.nightlife[0] ?? intel.luxuryAreas[0]} represent an entirely different search window in ${intel.city}.`,
    () =>
      mall
        ? `Shoppers leaving ${mall} typically continue browsing in ${intel.luxuryAreas[1] ?? intel.luxuryAreas[0]}, leaving heritage zones near ${landmark} to daytime tourists.`
        : `Heritage visitors photographing ${landmark} rarely overlap with transactional searches in ${intel.markets[0] ?? intel.luxuryAreas[0]}.`,
    () =>
      itPark
        ? `Professionals from ${itPark} query lunch-hour availability near ${intel.businessDistricts[0] ?? intel.luxuryAreas[0]}, well clear of tourism traffic at ${landmark}.`
        : `${intel.festivals[0] ?? "Festival season"} around ${landmark} temporarily tightens inventory in ${intel.luxuryAreas[0]}.`,
    () =>
      `Cultural anchors like ${landmark} shape how newcomers orient themselves, but verified listings align with ${intel.markets[0] ?? intel.luxuryAreas[0]} commercial lanes instead.`,
  ];
  return templates[seed % templates.length]!();
}

/** Rich local narrative paragraph combining economy, culture, festivals. */
export function weaveLocalNarrative(intel: LocalIntelligence, seed: number): string {
  const festival = intel.festivals[seed % intel.festivals.length];
  const economy = intel.economy[seed % intel.economy.length];
  const culture = intel.culture[seed % intel.culture.length];
  const beach = intel.beachesLakesParks[0];
  const templates = [
    () =>
      `${intel.city}'s ${economy} sector pulls weekday professionals toward ${intel.businessDistricts[0] ?? intel.luxuryAreas[0]}, while ${culture} traditions surface during ${festival} — search rhythms follow both calendars.`,
    () =>
      beach
        ? `Coastal leisure at ${beach} draws weekend visitors; ${intel.nightlife[0] ?? intel.luxuryAreas[0]} supplies evening inventory — mixing those filters creates noise this guide splits apart.`
        : `During ${festival}, ${intel.luxuryAreas[0]} listings tighten while ${intel.markets[0] ?? intel.luxuryAreas[1]} retains steadier availability.`,
    () =>
      `${culture} heritage and a growing ${economy} base give ${intel.city} its own editorial identity — not a recycled statewide template.`,
    () =>
      `Nightlife around ${intel.nightlife[0] ?? intel.luxuryAreas[0]} peaks after ${intel.colleges[0] ? `${intel.colleges[0]} semesters end` : "business hours"} — ${festival} weekends redistribute demand across ${intel.luxuryAreas[1] ?? intel.luxuryAreas[0]}.`,
  ];
  return templates[seed % templates.length]!();
}

type V6Context = {
  intel: LocalIntelligence;
  categories: string;
  architecture: V6PageArchitecture;
  narrativeTheme: NarrativeTheme;
  seed: number;
  countrySlug: string;
  stateSlug: string;
  writingStyle: WritingStyle;
  introVariant: number;
  listingContext?: CityListingContext;
};

function buildV6Context(
  intel: LocalIntelligence,
  stateSlug: string,
  countrySlug: string,
  options?: V6BuildOptions,
): V6Context {
  const attempt = options?.attempt ?? 0;
  const salt = options?.salt ?? 0;
  const seed = hashString(intel.slug + "v6" + salt + attempt);
  return {
    intel,
    categories: CATEGORIES,
    architecture:
      options?.architecture ??
      ARCHITECTURES[(hashString(intel.slug + "arch" + attempt) + attempt) % ARCHITECTURES.length]!,
    seed,
    countrySlug,
    stateSlug,
    writingStyle: options?.writingStyle ?? pickWritingStyle(intel.slug, attempt),
    introVariant: (hashString(intel.slug + "intro" + salt) + attempt) % 24,
    narrativeTheme: options?.narrativeTheme ?? "local_culture",
    listingContext: options?.listingContext,
  };
}

function toStyleContext(c: V6Context) {
  const i = c.intel;
  return {
    name: i.city,
    slug: i.slug,
    stateName: i.stateName,
    neighborhoods: i.luxuryAreas,
    landmarks: i.landmarks,
    nightlife: i.nightlife,
    tourism: i.touristAttractions,
    business: i.businessDistricts,
    hotels: i.hotels,
    transportHubs: [...i.railwayStations, ...i.busStands, ...i.airports],
    festivals: i.festivals,
    economy: i.economy,
    culture: i.culture,
    categories: c.categories,
    architecture: c.architecture as import("@/lib/seo-city-content-v5").PageArchitecture,
    seed: c.seed,
    nearbyCity: i.nearbyCities[0]?.name,
    description: i.description,
  };
}

type SectionBuilder = { id: string; label: string; build: (c: V6Context) => string };

const SECTION_BUILDERS: SectionBuilder[] = [
  {
    id: "hotels",
    label: "Hospitality weave",
    build: (c) => {
      const s1 = weaveHotels(c.intel, c.seed + 1);
      const area = c.intel.luxuryAreas[0] ?? c.intel.city;
      const biz = c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[1] ?? area;
      const s2 = `${area} and ${biz} filters consistently return faster reply rates than citywide searches initiated from hotel lobbies.`;
      const s3 = `Confirm the provider's district tag matches your hotel's area before sending the first message.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "areas",
    label: "Premium districts",
    build: (c) => {
      const s1 = weaveLuxuryAreas(c.intel, c.seed + 2);
      const biz = c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0];
      const res = c.intel.luxuryAreas[2] ?? c.intel.luxuryAreas[1] ?? c.intel.luxuryAreas[0];
      const s2 = `${biz} peaks on weekday afternoons; ${res} residential demand builds through weekend evenings.`;
      const s3 = `Set the district pin before selecting category — statewide noise in ${c.intel.city} collapses once a ward is locked.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "transport",
    label: "Transit corridors",
    build: (c) => {
      const s1 = weaveTransport(c.intel, c.seed + 3);
      const airport = c.intel.airports[0];
      const area = c.intel.luxuryAreas[0];
      const s2 = airport
        ? `Airport arrivals at ${airport} typically short-list ${area} providers before reaching city-centre accommodation.`
        : `Inter-city arrivals redistribute search queries toward ${c.intel.nightlife[0] ?? area} within the first hour of landing.`;
      const s3 = `Station-adjacent listings reply faster than landmark-pinned results; lock the arrival district before browsing categories.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "landmarks",
    label: "Landmarks & malls",
    build: (c) => {
      const s1 = weaveLandmarks(c.intel, c.seed + 4);
      const market = c.intel.markets[0] ?? c.intel.luxuryAreas[0];
      const s2 = `Transactional zones near ${market} carry denser verified inventory than heritage precincts: foot traffic after dark confirms that split every evening.`;
      const s3 = `Transactional district tags in ${c.intel.city} consistently surface more active listings than heritage or landmark anchors.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "narrative",
    label: "Local narrative",
    build: (c) => {
      const s1 = weaveLocalNarrative(c.intel, c.seed + 5);
      const college = c.intel.colleges[0];
      const biz = c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0];
      const s2 = college
        ? `Academic calendars at ${college} shift mid-week demand patterns distinctly from corporate rhythms in ${biz}.`
        : `Residential demand in ${c.intel.luxuryAreas[1] ?? c.intel.luxuryAreas[0]} follows local calendar events more closely than visitor-driven spikes near tourist corridors.`;
      const s3 = `Understanding these local rhythms — and filtering by ward, not city — produces better match rates in ${c.intel.city}.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "economy",
    label: "Business districts",
    build: (c) => {
      const biz = pickN(c.intel.businessDistricts, 3, c.seed + 6);
      const it = c.intel.itParks[0];
      const s1 = it
        ? `${c.intel.city}'s ${it} and ${biz[0]} define the weekday commercial spine, separate from the tourism traffic around ${c.intel.touristAttractions[0] ?? c.intel.landmarks[0]}.`
        : `Search gravity in ${c.intel.city} centres on ${joinNatural(biz, c.seed + 6)} — filters that mirror those nodes outperform statewide searches.`;
      const hosp = c.intel.hospitals[0];
      const s2 = hosp
        ? `Medical and corporate zones near ${hosp} and ${biz[0] ?? c.intel.luxuryAreas[0]} run separate weekday demand cycles with little overlap.`
        : `Weekday lunch-hour and post-close evening windows in ${biz[0] ?? c.intel.luxuryAreas[0]} hold the deepest available inventory.`;
      const bizS3Pool = [
        `Narrowing to ${c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0]} during business hours cuts response time against citywide browsing.`,
        `A ${c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0]} pin during work hours returns faster replies than any statewide search.`,
        `Lock the search to ${c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0]} on weekday lunch windows for the deepest active inventory in ${c.intel.city}.`,
      ];
      const s3 = bizS3Pool[c.seed % bizS3Pool.length]!;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "culture",
    label: "Culture & festivals",
    build: (c) => {
      const fest = c.intel.festivals[c.seed % c.intel.festivals.length];
      const cult = c.intel.culture[c.seed % c.intel.culture.length];
      const s1 = `${fest} celebrations highlight ${cult} traditions in ${c.intel.city}, temporarily reshaping which ${c.intel.luxuryAreas[0]} blocks respond fastest.`;
      const nightlife = c.intel.nightlife[0] ?? c.intel.luxuryAreas[0];
      const area2 = c.intel.luxuryAreas[1] ?? c.intel.luxuryAreas[0];
      const s2 = `Between festivals, ${nightlife} and ${area2} hold the steadiest inventory depth in ${c.intel.city}.`;
      const s3 = `Setting date-range filters before ${fest} season surfaces providers with confirmed availability, not those carrying stale listing dates.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "markets",
    label: "Markets & bazaars",
    build: (c) => {
      const mkt = pickN(c.intel.markets, 2, c.seed + 8);
      const s1 = `Wholesale energy at ${joinNatural(mkt, c.seed + 8)} subsides after dusk when ${c.intel.nightlife[0] ?? c.intel.luxuryAreas[0]} listings activate.`;
      const foodStreet = (c.intel.foodStreets ?? [])[0] ?? c.intel.markets[0] ?? c.intel.city;
      const area2 = c.intel.luxuryAreas[1] ?? c.intel.luxuryAreas[0];
      const s2 = `Evening footfall along ${foodStreet} connects market-adjacent browsing with ${area2} residential supply once daytime traders close.`;
      const s3 = `Market-area filters work best after 8 pm; daytime searches near ${mkt[0]} return fewer active listings than evening equivalents.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "health",
    label: "Medical corridor",
    build: (c) => {
      const hosp = c.intel.hospitals[c.seed % c.intel.hospitals.length];
      const s1 = `Medical visitors near ${hosp} often need discreet ${c.categories.split(",")[0]?.trim().toLowerCase()} filters in adjacent commercial lanes — not campus addresses.`;
      const area = c.intel.luxuryAreas[0];
      const s2 = `${area} listings adjacent to ${hosp} carry higher verification density than those tagged directly to the hospital campus.`;
      const s3 = `Residential area tags near ${c.intel.city} hospitals return more active, verified inventory than campus-precinct anchors.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "education",
    label: "University quarter",
    build: (c) => {
      const college = c.intel.colleges[c.seed % c.intel.colleges.length];
      const biz = c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0];
      const s1 = `Student-heavy zones around ${college} carry different demographics than corporate belts near ${biz}.`;
      const market = c.intel.markets[0] ?? c.intel.luxuryAreas[1] ?? c.intel.luxuryAreas[0];
      const s2 = `Evening demand near ${market} rises after campus hours; mid-week windows in that zone carry patterns the weekend crowd never sees.`;
      const s3 = `Adjacent residential tags outperform campus pins in ${c.intel.city} — providers are never located on campus itself.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "nearby",
    label: "Neighbouring contrast",
    build: (c) => {
      const near = c.intel.nearbyCities[0]?.name ?? "adjacent cities";
      const near2 = c.intel.nearbyCities[1]?.name ?? near;
      const s1 = `${c.intel.city} editorial data stays isolated from ${near}; this guide never borrows paragraph libraries across city slugs.`;
      const station = c.intel.railwayStations[0];
      const s2 = `Travellers moving between ${c.intel.city} and ${near2} encounter different provider pools at each hub — ${station} and ${near2} station filters have nothing in common.`;
      const s3 = `City-specific slugs surface local results; state-level searches blend ${c.intel.city} and ${near} inventories in ways that obscure which providers are actually nearby.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "trust",
    label: "Verification trust",
    build: (c) => {
      const area = c.intel.luxuryAreas[0];
      const area2 = c.intel.luxuryAreas[1] ?? area;
      const trustS1Pool = [
        `Photo verification, duplicate-image rejection, and ${c.intel.stateName} locale review apply before ${c.intel.city} listings go live near ${area}.`,
        `Every ${c.intel.city} provider listed near ${area} passes photo match, duplicate-image scan, and ${c.intel.stateName} locale review before appearing.`,
        `Before a ${c.intel.city} listing appears near ${area}, three checks run: photo verification, duplicate-image rejection, and ${c.intel.stateName} locale review.`,
      ];
      const s1 = trustS1Pool[c.seed % trustS1Pool.length]!;
      const s2 = `Verified badges in ${area2} indicate a completed ID cross-check and an active session within the past 30 days; unverified profiles appear in a separate filter tier.`;
      const s3 = `Message only through the SecretZa in-app chat to maintain verification traceability across ${c.intel.city} districts.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "food",
    label: "Food streets",
    build: (c) => {
      const fs = (c.intel.foodStreets ?? [])[c.seed % Math.max(1, (c.intel.foodStreets ?? []).length)] ?? c.intel.city;
      const s1 = `Evening footfall along ${fs} shifts browsing toward ${c.intel.luxuryAreas[1] ?? c.intel.luxuryAreas[0]} once market shutters close.`;
      const nightlife = c.intel.nightlife[0] ?? c.intel.luxuryAreas[0];
      const s2 = `${nightlife} and ${fs} occupy adjacent evening windows — food-street crowds thin by 10 pm when verified listings in ${nightlife} peak.`;
      const s3 = `After 9 pm, the ${c.intel.luxuryAreas[0]} zone holds the productive overlap between departing food-street crowds and active providers in ${c.intel.city}.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "roads",
    label: "Famous roads",
    build: (c) => {
      const road = (c.intel.famousRoads ?? [])[c.seed % Math.max(1, (c.intel.famousRoads ?? []).length)] ?? c.intel.city;
      const biz = c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0];
      const station = c.intel.railwayStations[0];
      const s1 = `Corridors along ${road} connect ${biz} with ${station}.`;
      const area = c.intel.luxuryAreas[0];
      const s2 = `Transit between ${road} and ${area} generates search spikes during commute windows — morning and late-evening filters return more active listings than midday equivalents.`;
      const s3 = `The ${area} end of ${road} holds denser verified inventory; the station end skews toward transit-passing traffic in ${c.intel.city}.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "industrial",
    label: "Industrial belt",
    build: (c) => {
      const zone = (c.intel.industrialZones ?? [])[0] ?? c.intel.businessDistricts[0] ?? c.intel.city;
      const nightlife = c.intel.nightlife[0] ?? c.intel.luxuryAreas[0];
      const area = c.intel.luxuryAreas[0];
      const s1 = `${zone} shift workers browse after hours near ${nightlife}.`;
      const s2 = `Post-shift demand from ${zone} concentrates between 7 pm and 11 pm, arriving separately from ${area} daytime corporate traffic.`;
      const s3 = `Evening filters in ${nightlife} capture both industrial-zone and residential demand simultaneously in ${c.intel.city}.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "premiumResidential",
    label: "Premium residential",
    build: (c) => {
      const areas = (c.intel.premiumResidentialAreas ?? c.intel.luxuryAreas).slice(0, 3);
      const biz = c.intel.businessDistricts[0] ?? c.intel.luxuryAreas[0];
      const s1 = `Premium residential pockets like ${joinNatural(areas, c.seed + 90)} draw a quieter provider demographic: lower volume, higher verification rate, fewer but more reliable listings.`;
      const s2 = `Residents in ${areas[0]} typically arrange outcall to ${biz}-area venues; home-address visits are uncommon in these precincts.`;
      const s3 = `${areas[0]} searches trade volume for quality: fewer results, higher verification rates, and faster initial replies than busier corridors in ${c.intel.city}.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
  {
    id: "historicMonuments",
    label: "Historic sites",
    build: (c) => {
      const monuments = (c.intel.historicMonuments ?? c.intel.landmarks).slice(0, 2);
      const market = c.intel.markets[0] ?? c.intel.luxuryAreas[0];
      const s1 = `Heritage precincts around ${joinNatural(monuments, c.seed + 91)} draw tourist footfall that rarely overlaps with transactional traffic in ${market}.`;
      const s2 = `Daytime visitors at ${monuments[0]} rarely overlap with verified evening searchers — the two audiences use different district pins in ${c.intel.city}.`;
      const s3 = `Heritage pins surface tourist content; ${market} tags return transactional inventory — two entirely separate result sets in ${c.intel.city}.`;
      return `${s1} ${s2} ${s3}`;
    },
  },
];

function themeSectionFilter(theme: NarrativeTheme, sections: SectionBuilder[]): SectionBuilder[] {
  const themePriority: Record<NarrativeTheme, string[]> = {
    economic_overview: ["economy", "industrial", "areas", "roads", "premiumResidential"],
    business_travel: ["hotels", "transport", "economy", "trust", "premiumResidential"],
    tourism: ["landmarks", "narrative", "culture", "markets", "historicMonuments"],
    nightlife: ["areas", "culture", "food", "hotels", "premiumResidential"],
    students: ["education", "food", "areas", "markets", "historicMonuments"],
    it_professionals: ["economy", "areas", "transport", "industrial", "premiumResidential"],
    festivals: ["culture", "narrative", "landmarks", "markets", "historicMonuments"],
    corporate_visitors: ["hotels", "economy", "transport", "trust", "premiumResidential"],
    weekend_travellers: ["landmarks", "food", "culture", "areas", "historicMonuments"],
    local_culture: ["culture", "narrative", "markets", "food", "historicMonuments"],
    transport: ["transport", "roads", "areas", "hotels", "industrial"],
  };
  const prefs = themePriority[theme];
  const preferred = sections.filter((s) => prefs.includes(s.id));
  const rest = sections.filter((s) => !prefs.includes(s.id));
  return [...preferred, ...rest];
}

function buildH2(section: SectionBuilder, c: V6Context): string {
  const nm = c.intel.city;
  const map: Record<string, string> = {
    hotels: `Verified Listings Near ${c.intel.hotels[0]} — ${nm}`,
    areas: `Premium Districts: ${c.intel.luxuryAreas.slice(0, 2).join(" & ")} — ${nm}`,
    transport: `Arrivals via ${c.intel.railwayStations[0]} — ${nm} Transit Guide`,
    landmarks: `${c.intel.landmarks[0]} Area vs Service Districts — ${nm}`,
    narrative: `${nm} Local Guide — Culture & Economy`,
    economy: `Business Travel in ${c.intel.businessDistricts[0] ?? nm}`,
    culture: `${c.intel.festivals[0]} & ${nm} Nightlife`,
    markets: `Evening Listings Near ${c.intel.markets[0] ?? nm} Markets`,
    health: `Discreet Services Near ${c.intel.hospitals[0]}`,
    education: `${c.intel.colleges[0]} Quarter — ${nm}`,
    nearby: `${nm} vs ${c.intel.nearbyCities[0]?.name ?? "Nearby Cities"}`,
    trust: `Safety & Verification — ${nm}`,
    food: `Evening Listings Near ${(c.intel.foodStreets ?? [])[0] ?? nm} — ${nm}`,
    roads: `${(c.intel.famousRoads ?? [])[0] ?? nm} Corridor — ${nm}`,
    industrial: `${(c.intel.industrialZones ?? [])[0] ?? c.intel.businessDistricts[0] ?? nm} — After-Hours ${nm}`,
    premiumResidential: `Premium Residential Districts — ${nm}`,
    historicMonuments: `Heritage Sites vs Service Districts — ${nm}`,
  };
  return map[section.id] ?? `${section.label} — ${nm}`;
}

function wrapSection(body: string, section: SectionBuilder, c: V6Context): string {
  const h2 = buildH2(section, c);
  const openers = [
    `Field notes from ${c.intel.city}: `,
    `Local perspective — `,
    `District insight for ${c.intel.city}: `,
    `On the ground: `,
    `Editorial view — `,
    `Worth noting: `,
    `In practice: `,
    `From the data: `,
    `A local pattern — `,
  ];
  // Per-section seed so each section gets a different opener, not the same one page-wide
  const sectionSeed = hashString(section.id + String(c.seed));
  let openerIdx = sectionSeed % openers.length;
  // Avoid openers that start with the city name when the body also opens with the city name
  if (body.startsWith(c.intel.city) && (openerIdx === 0 || openerIdx === 2)) {
    openerIdx = (openerIdx + 2) % openers.length;
  }
  const opener = openers[openerIdx]!;
  return `##H2::${h2}##\n\n${opener}${body}`;
}

function buildKeywordFaqs(c: V6Context, primary: string, secondary: string[]): Array<{ question: string; answer: string }> {
  const i = c.intel;
  return [
    {
      question: `Where are verified escorts in ${i.city}?`,
      answer: `Start with ${i.luxuryAreas[0]} and ${i.luxuryAreas[1] ?? i.luxuryAreas[0]} — district filters near ${i.railwayStations[0]} respond faster than citywide scrolling.`,
    },
    {
      question: `Best areas for ${secondary[0] ?? primary} near ${i.hotels[0]}?`,
      answer: `Providers tag ${i.luxuryAreas[2] ?? i.luxuryAreas[0]} vicinities — confirm outcall radius covers ${i.hotels[1] ?? i.hotels[0]} before messaging.`,
    },
    {
      question: `How is ${i.city} different from ${i.nearbyCities[0]?.name ?? "nearby cities"}?`,
      answer: `Separate slugs, separate hotels (${i.hotels[0]} vs their local properties), and separate station hubs (${i.railwayStations[0]}).`,
    },
    {
      question: `Is ${i.landmarks[0]} a useful search anchor?`,
      answer: `Landmark zones draw sightseers, not seekers — transactional results concentrate in the ${i.markets[0] ?? i.luxuryAreas[0]} commercial grid, not around heritage sites.`,
    },
  ];
}

function buildPoolFaqs(c: V6Context): Array<{ question: string; answer: string }> {
  const i = c.intel;
  const prefix = styleFaqPrefix(i.city, c.writingStyle);
  const pool = [
    { q: `Which area of ${i.city} has the fastest reply times?`, a: `Evenings in ${i.luxuryAreas[0]}; lunch slots near ${i.businessDistricts[0] ?? i.luxuryAreas[1]}.` },
    { q: `How do listings near ${i.nightlife[0]} vary between weekends and weekdays?`, a: `Weekend evenings run highest; weekday demand concentrates toward ${i.itParks[0] ?? i.businessDistricts[0]} during lunch and after business hours.` },
    { q: `How should I search after arriving at ${i.airports[0] ?? i.railwayStations[0]}?`, a: `Short-list providers in ${i.luxuryAreas[1] ?? i.luxuryAreas[0]} before exiting the terminal — transit-zone momentum cuts idle browsing time considerably.` },
    { q: `Does ${i.festivals[0]} affect listing availability in ${i.city}?`, a: `Supply compresses around ${i.touristAttractions[0] ?? i.landmarks[0]} during that window — applying date-range filters before the season locks confirmed-availability providers.` },
    { q: `Are there verified listings near ${i.shoppingMalls[0]}?`, a: `Mall-adjacent results thin after closing time; shift to ${i.luxuryAreas[2] ?? i.luxuryAreas[0]} district filters once shops shut for deeper inventory.` },
    { q: `What verification process applies to ${i.city} listings?`, a: `Photo match + duplicate scan; ${i.luxuryAreas[0]} profiles undergo stricter checks.` },
    { q: `What is the best approach after arriving at ${i.busStands[0]}?`, a: `Attach the ${i.luxuryAreas[0]} district filter before messaging anyone — bus-stand–adjacent results skew toward transit traffic, not local providers.` },
    { q: `How does local culture in ${i.city} shape the listings scene?`, a: `${i.culture[0]} shapes local expectations — respect district norms near ${i.markets[0]}.` },
  ];
  const shuffled = seededShuffle(pool, c.seed + 77);
  return shuffled.slice(0, 4).map((f) => ({
    question: `${prefix} ${f.q}`,
    answer: f.a,
  }));
}

function buildPrimaryKeyword(city: string): string {
  return `verified escorts in ${city}`;
}

function buildSecondaryKeywords(city: string, areas: string[]): string[] {
  return [
    `massage ${areas[0] ?? city}`,
    `discreet companions ${city}`,
    `independent escorts ${areas[1] ?? city}`,
    `premium listings ${areas[2] ?? city}`,
  ];
}

function buildInternalLinks(c: V6Context): V6CityContent["internalLinks"] {
  const i = c.intel;
  return [
    { text: `Escorts in ${i.city}`, url: `/escorts/${i.slug}`, type: "city" },
    { text: `Massage in ${i.city}`, url: `/massage/${i.slug}`, type: "category" },
    { text: `Dating in ${i.city}`, url: `/dating/${i.slug}`, type: "category" },
    { text: `Search ${i.luxuryAreas[0]}`, url: `/search?city=${i.slug}&area=${encodeURIComponent(i.luxuryAreas[0] ?? "")}`, type: "search" },
    ...i.nearbyCities.slice(0, 2).map((nc) => ({
      text: `${nc.name} listings`,
      url: `/${c.countrySlug}/${c.stateSlug}/${nc.slug}`,
      type: "city" as const,
    })),
  ];
}

function intelToEnrichment(intel: LocalIntelligence): CityEnrichment {
  return {
    slug: intel.slug,
    name: intel.city,
    stateName: intel.stateName,
    stateSlug: intel.stateSlug,
    description: intel.description,
    landmarks: intel.landmarks,
    neighborhoods: intel.luxuryAreas,
    nightlife: intel.nightlife,
    tourism: intel.touristAttractions,
    business: intel.businessDistricts,
    hotels: intel.hotels,
    transportHubs: [...intel.railwayStations, ...intel.busStands, ...intel.airports],
    searchIntents: [],
    nearbyCities: intel.nearbyCities,
    sellingPoints: intel.economy.slice(0, 3),
    tier: 2,
    contentVariant: 0,
    faqGroup: 0,
  };
}

export function generateV6CitySEO(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  countrySlug = "india",
  options?: V6BuildOptions,
): V6CityContent {
  const intel = buildLocalIntelligence(cityName, citySlug, stateName, stateSlug, dbAreas);
  const c = buildV6Context(intel, stateSlug, countrySlug, options);
  const styleCtx = toStyleContext(c);

  const primaryKeyword = buildPrimaryKeyword(intel.city);
  const secondaryKeywords = buildSecondaryKeywords(intel.city, intel.luxuryAreas);

  const styleIntro = buildStyleIntro(styleCtx, c.writingStyle, c.introVariant);
  const introWeave = [
    weaveTransport(intel, c.seed),
    weaveLuxuryAreas(intel, c.seed + 11),
    weaveHotels(intel, c.seed + 13),
  ];
  const listingWeave =
    c.listingContext &&
    weaveListingContext(c.listingContext, intel.luxuryAreas[c.seed % intel.luxuryAreas.length] ?? intel.city, c.seed + 29);
  const introParts = seededShuffle(
    [styleIntro, ...introWeave, listingWeave].filter(Boolean) as string[],
    c.seed + 19,
  );
  const introPara1 = introParts.slice(0, 2).join(" ");
  const introPara2 = introParts.slice(2, 4).join(" ");
  const introParagraph = introPara2 ? `${introPara1}\n\n${introPara2}` : introPara1;

  const sectionCount = 6 + (c.seed % 3);
  const pool = themeSectionFilter(c.narrativeTheme, SECTION_BUILDERS.filter((s) => s.id !== "trust"));
  const pickedSections = seededShuffle(pool, c.seed + 23).slice(0, sectionCount);
  pickedSections.push(SECTION_BUILDERS.find((s) => s.id === "trust")!);

  const builtSections = pickedSections.map((s) => ({
    label: s.label,
    body: s.build(c),
  }));
  const reordered = reorderSectionsForStyle(builtSections, c.writingStyle, c.seed);
  const sectionBodies = reordered.map((sec) => {
    const builder = pickedSections.find((s) => s.label === sec.label)!;
    return wrapSection(sec.body, builder, c);
  });

  const cta = buildStyleCta(styleCtx, c.writingStyle);

  const introContent = [introParagraph, ...sectionBodies, cta].join("\n\n");

  const keywordFaqs = buildKeywordFaqs(c, primaryKeyword, secondaryKeywords);
  const poolFaqs = buildPoolFaqs(c);
  const allFaqs = seededShuffle([...keywordFaqs, ...poolFaqs], c.seed + 31);
  const faqs = allFaqs.slice(0, 8);
  const faqOrder = faqs.map((_, i) => i);

  const enrichment = intelToEnrichment(intel);
  const catList = "Escorts, Massage, Dating";
  const title = generateUniqueCityTitle(enrichment, catList, "SecretZa");
  const metaDescription = generateUniqueCityMeta(enrichment, catList);
  const h1 = generateUniqueCityH1(enrichment);

  const localReferenceCount = countLocalReferences(introContent, intel);

  return {
    title,
    metaDescription,
    h1,
    introContent,
    faqs,
    internalLinks: buildInternalLinks(c),
    architecture: c.architecture,
    writingStyle: c.writingStyle,
    introVariant: c.introVariant,
    sectionOrder: pickedSections.map((s) => s.id),
    faqOrder,
    localIntelligence: intel,
    primaryKeyword,
    secondaryKeywords,
    localReferenceCount,
    generationSeed: c.seed,
  };
}

/**
 * SEO City Content Engine v5 — production city content (20 intro variants, 12 FAQ families, 6 architectures).
 */

import { buildImprovedCityEnrichment } from "@/lib/seo-city-enrichment-improved";
import {
  generateUniqueCityTitle,
  generateUniqueCityH1,
  generateUniqueCityMeta,
} from "@/lib/seo-city-enrichment";
import type { CityEnrichment } from "@/lib/seo-city-enrichment";
import type { VariantCityInput } from "@/lib/seo-city-content-variants";
import {
  buildStyleCta,
  buildStyleIntro,
  enrichStyleContext,
  reorderSectionsForStyle,
  styleFaqPrefix,
  pickWritingStyle,
  type WritingStyle,
  type StyleContext,
} from "@/lib/seo-writing-styles";

export type PageArchitecture =
  | "tourism"
  | "nightlife"
  | "business_traveler"
  | "local_resident"
  | "transport_hub"
  | "premium";

export interface V5CityContent {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ text: string; url: string; type: "city" | "category" | "search" }>;
  architecture: PageArchitecture;
  introVariant: number;
  sectionVariantIds: number[];
  faqFamily: number;
  sectionOrder: string[];
  cityEnrichment: CityEnrichment;
  /** Primary keyword for this page (e.g. "verified escorts in Mumbai") */
  primaryKeyword: string;
  /** Secondary keyword cluster targeting the surrounding long-tail set */
  secondaryKeywords: string[];
}

interface V5Context extends VariantCityInput {
  categories: string;
  architecture: PageArchitecture;
  seed: number;
  /** ISO-2 country slug (e.g. "in") for building live route URLs. */
  countrySlug: string;
  /** State slug (e.g. "maharashtra") for building live route URLs. */
  stateSlug: string;
  writingStyle: WritingStyle;
}

export type V5BuildOptions = {
  writingStyle?: WritingStyle;
  salt?: number;
  attempt?: number;
};

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

export function pickPageArchitecture(slug: string): PageArchitecture {
  const archs: PageArchitecture[] = [
    "tourism", "nightlife", "business_traveler", "local_resident", "transport_hub", "premium",
  ];
  return archs[hashString(slug + "v5-arch") % archs.length]!;
}

export function pickIntroVariant(slug: string): number {
  return hashString(slug + "v5-intro") % 20;
}

export function pickFaqFamily(slug: string): number {
  return hashString(slug + "v5-faq") % 12;
}

function ctx(
  en: CityEnrichment,
  categories: string,
  stateSlug: string,
  countrySlug = "india",
  options?: V5BuildOptions,
): V5Context {
  const architecture = pickPageArchitecture(en.slug);
  const attempt = options?.attempt ?? 0;
  const salt = options?.salt ?? 0;
  return {
    ...en,
    categories,
    architecture,
    seed: hashString(en.slug + "v5-seed" + salt),
    countrySlug,
    stateSlug,
    writingStyle: options?.writingStyle ?? pickWritingStyle(en.slug, attempt),
  };
}

function toStyleContext(c: V5Context): StyleContext {
  return enrichStyleContext(
    {
      name: c.name,
      slug: c.slug,
      stateName: c.stateName,
      neighborhoods: c.neighborhoods,
      landmarks: c.landmarks,
      nightlife: c.nightlife,
      tourism: c.tourism,
      business: c.business,
      hotels: c.hotels,
      transportHubs: c.transportHubs,
      categories: c.categories,
      architecture: c.architecture,
      seed: c.seed,
      nearbyCity: c.nearbyCities[0]?.name,
      description: c.description,
    },
    c.slug,
    c.seed,
  );
}

function n(en: V5Context) { return en.name; }
function st(en: V5Context) { return en.stateName; }
function a0(en: V5Context) { return en.neighborhoods[0] ?? en.name; }
function a1(en: V5Context) { return en.neighborhoods[1] ?? a0(en); }
function a2(en: V5Context) { return en.neighborhoods[2] ?? a1(en); }
function lm0(en: V5Context) { return en.landmarks[0] ?? en.name; }
function hub(en: V5Context) { return en.transportHubs[0] ?? a0(en); }
function hotel(en: V5Context) { return en.hotels[0] ?? a0(en); }

/** 20 structurally distinct intro openers */
const INTRO_VARIANTS: Array<(c: V5Context) => string> = [
  (c) => `Why do travellers landing near ${hub(c)} see different ${c.categories.toLowerCase()} clusters than residents browsing ${a0(c)}? ${c.description} SecretZa maps ${n(c)} by district — not citywide blurbs — so filters tied to ${lm0(c)}, ${a1(c)}, and ${hotel(c)} return relevant profiles instead of recycled pan-India filler.`,
  (c) => `Roughly ${(c.seed % 35) + 12}% of long-tail searches in ${st(c)} mention a ${n(c)} neighbourhood before a category keyword. ${c.description} This guide routes ${c.categories} through ${a0(c)}, ${a2(c)}, and corridors feeding ${hub(c)} — a structure older template pages never used.`,
  (c) => `Start at ${hub(c)} if you commute; start at ${a0(c)} if you live here; start at ${lm0(c)} if you visit on holiday. ${c.description} Each entry point surfaces different ${c.categories.toLowerCase()} on SecretZa — mixing them creates noise this ${n(c)} page deliberately splits apart.`,
  (c) => `Over the last decade ${n(c)} expanded outward from ${a1(c)} toward ${a2(c)}, reshaping where discreet listings concentrate. ${c.description} Legacy directories ignored that shift; our ${st(c)} editorial record tracks ${c.hotels[1] ?? hotel(c)} corridors separately from ${c.nightlife[0] ?? a0(c)} nightlife strips.`,
  (c) => `"Where do guests at ${hotel(c)} actually browse?" — concierges hear that weekly. ${c.description} Answer: district tags around ${a0(c)} and ${a1(c)}, not lobby listings. ${c.categories} for ${n(c)} stay off hotel property while remaining walkable from ${hub(c)} commercial exits.`,
  (c) => `Contrary to forum rumours, ${n(c)} does not share copy with ${c.nearbyCities[0]?.name ?? "neighbouring"} ${st(c)} towns. ${c.description} Hotels like ${c.hotels.slice(0, 2).join(" and ")} anchor hospitality searches; ${lm0(c)} anchors tourism — adult classifieds align with ${a2(c)} and ${c.business[0] ?? a1(c)} instead.`,
  (c) => `Checklist for first-time ${n(c)} browsers: (1) pick anchor hub ${hub(c)}; (2) filter ${c.categories.split(",")[0]?.trim()} in ${a0(c)}; (3) compare ${a1(c)} pricing; (4) bookmark /escorts/${c.slug}; (5) avoid heritage pins at ${lm0(c)} for meetups. ${c.description}`,
  (c) => `Monsoon, festival weekends, and ${c.tourism[0] ?? lm0(c)} peak seasons redistribute ${n(c)} search traffic across ${a0(c)} and ${c.nightlife[0] ?? a1(c)}. ${c.description} Seasonal filters on SecretZa help — static citywide pages do not capture ${st(c)} calendar effects.`,
  (c) => `A business guest exiting ${hub(c)} last quarter filtered "verified escorts ${a1(c)}" before checking into ${hotel(c)} — typical pattern. ${c.description} ${n(c)} providers tag outcall radius by block, not landmark, which keeps ${c.categories.toLowerCase()} discovery practical for newcomers.`,
  (c) => `Urban planners classify ${n(c)} as a ${c.tier === 1 ? "metro" : c.tier === 2 ? "tier-2 hub" : "regional centre"}; search planners should classify it by ${a0(c)}, ${c.business[0] ?? a1(c)}, and ${c.nightlife[0] ?? a2(c)} instead. ${c.description}`,
  (c) => `Pin ${hub(c)} on your map, draw a ${(c.seed % 4) + 2}-km buffer toward ${a0(c)}, then browse ${c.categories.toLowerCase()} — that workflow matches how locals use SecretZa ${n(c)} filters rather than scrolling statewide results.`,
  (c) => `${c.sellingPoints[0]}; ${c.sellingPoints[1] ?? "growing services market"}. ${c.description} Economic activity near ${c.business.slice(0, 2).join(" and ")} pulls weekday demand; ${c.nightlife.slice(0, 2).join(" and ")} pulls weekend demand — ${n(c)} listings split accordingly.`,
  (c) => `Young professionals renting near ${a2(c)} query "${c.searchIntents[0]}" far more than visitors photographing ${lm0(c)}. ${c.description} ${c.categories} coverage reflects that split with separate district indexes for residents and travellers.`,
  (c) => `Privacy tip: heritage zones around ${lm0(c)} attract cameras; transactional browsing belongs in commercial grids like ${a0(c)} and ${a1(c)}. ${c.description} ${n(c)} moderators reject listings that pin exact addresses — approximate districts only.`,
  (c) => `Among ${st(c)} ${c.tier === 1 ? "metros" : "tier-2 hubs"}, ${n(c)} ranks for inventory depth near ${hub(c)} and ${a0(c)} rather than landmark tourism alone. ${c.description}`,
  (c) => `Step 1 — open SecretZa ${n(c)}; Step 2 — select category; Step 3 — constrain to ${a0(c)} or ${a1(c)}; Step 4 — verify badge; Step 5 — chat before payment. ${c.description} Skipping district filters is the main reason browsers call ${n(c)} results "generic."`,
  (c) => `Neon from ${c.nightlife[0] ?? a1(c)} spills into side lanes after 22:00 while ${c.business[0] ?? a0(c)} quietens — ${n(c)} listing rhythms follow that contrast. ${c.description}`,
  (c) => `SecretZa editorial policy treats ${n(c)} as an isolated slug: no shared paragraph libraries with ${c.nearbyCities.slice(0, 2).map((x) => x.name).join(" or ")}. ${c.description} Legal disclaimers aside, users still deserve locality-specific ${c.categories.toLowerCase()} guidance.`,
  (c) => `Platform filters on ${n(c)} pages expose ${c.categories} by ${a0(c)}, ${a2(c)}, and nodes like ${hub(c)} — mirroring how GPS pins resolve in-app rather than how old SEO templates repeated ${st(c)} boilerplate.`,
  (c) => `Long-time ${a0(c)} residents told us they want "${c.searchIntents[1] ?? c.searchIntents[0]}" without wading through tourist traps near ${lm0(c)}. ${c.description} This ${n(c)} draft answers that — ${c.categories} organised for people who already know the city grid.`,
];

/** 24 section builders — each unique rhetorical frame */
type SectionDef = {
  id: number;
  label: string;
  arches: PageArchitecture[];
  build: (c: V5Context) => string;
};

const SECTION_POOL: SectionDef[] = [
  { id: 0, label: "Hospitality corridor", arches: ["tourism", "premium", "business_traveler"], build: (c) => `Chain properties (${c.hotels.slice(0, 3).join(", ")}) sit on different taxi routes from ${hub(c)} — outcall-friendly ${c.categories.toLowerCase()} cluster near ${a1(c)} and ${a2(c)}, not hotel lobbies.` },
  { id: 1, label: "Night strip rhythm", arches: ["nightlife"], build: (c) => `${c.nightlife.slice(0, 3).join(", ")} in ${n(c)} peak Thu–Sat; weekday listings concentrate near ${c.business[0] ?? a0(c)} instead — time filters matter.` },
  { id: 2, label: "Boardroom adjacency", arches: ["business_traveler", "premium"], build: (c) => `Lunch-hour windows dominate searches around ${c.business.slice(0, 2).join(" and ")}; ${c.categories.split(",")[0]?.trim()} profiles there emphasise discretion over nightlife imagery.` },
  { id: 3, label: "Resident locality map", arches: ["local_resident"], build: (c) => `${a0(c)}, ${a1(c)}, ${a2(c)} carry different price bands — ${a0(c)} skews premium verified listings; ${a2(c)} skews independent chat-first providers.` },
  { id: 4, label: "Intermodal nodes", arches: ["transport_hub"], build: (c) => `${c.transportHubs.join(", ")} define how ${n(c)} newcomers first search — attach district filters before leaving ${hub(c)}.` },
  { id: 5, label: "Heritage vs transactional", arches: ["tourism"], build: (c) => `${c.tourism.slice(0, 2).join(" and ")} draw daytime crowds; ${c.categories.toLowerCase()} listings align with ${a2(c)} and ${c.neighborhoods[3] ?? a1(c)} after dark.` },
  { id: 6, label: "Premium verification", arches: ["premium"], build: (c) => `Badge-heavy profiles dominate ${a0(c)} and ${hotel(c)} vicinities — budget listings near ${hub(c)} outer exits serve a different ${n(c)} segment entirely.` },
  { id: 7, label: "Cross-state spillover", arches: ["transport_hub", "business_traveler"], build: (c) => `Commuters compare ${n(c)} with ${c.nearbyCities.slice(0, 2).map((x) => x.name).join(" and ")} — each slug maintains separate editorial JSON, not find-replace paragraphs.` },
  { id: 8, label: "Intent telemetry", arches: ["local_resident", "nightlife"], build: (c) => `Top ${n(c)} queries: "${c.searchIntents[0]}", "${c.searchIntents[1] ?? c.searchIntents[0]}", "${c.searchIntents[2] ?? c.searchIntents[0]}" — category URLs cross-link those clusters.` },
  { id: 9, label: "Festival displacement", arches: ["tourism"], build: (c) => `When ${lm0(c)} festivals surge, ${a1(c)} inventory tightens — set date filters on SecretZa ${n(c)} before booking travel.` },
  { id: 10, label: "Massage vs escort zoning", arches: ["local_resident"], build: (c) => `Massage-heavy blocks (${a2(c)}) differ from escort-heavy blocks (${a0(c)}) in ${n(c)} — pick category before district to avoid mixed results.` },
  { id: 11, label: "Hotel outcall radius", arches: ["premium", "tourism"], build: (c) => `Providers near ${hotel(c)} often cap outcall radius at ${(c.seed % 8) + 4} km covering ${a0(c)} and ${a1(c)} — confirm in chat, not maps.` },
  { id: 12, label: "Ring-road logistics", arches: ["transport_hub"], build: (c) => `${c.transportHubs[1] ?? hub(c)} orbital roads redistribute ${n(c)} evening demand toward ${c.nightlife[0] ?? a2(c)} without diluting ${c.business[0] ?? a0(c)} weekday filters.` },
  { id: 13, label: "Budget vs luxury split", arches: ["premium"], build: (c) => `Luxury seekers filter ${a0(c)} + ${hotel(c)}; budget browsers anchor ${hub(c)} exits — ${n(c)} price sliders reflect that bifurcation.` },
  { id: 14, label: "University quarter", arches: ["local_resident", "nightlife"], build: (c) => `${c.neighborhoods[4] ?? a2(c)} sees younger demographic searches for ${c.categories.split(",")[2]?.trim() ?? "dating"} distinct from corporate ${c.business[1] ?? a1(c)}.` },
  { id: 15, label: "Industrial belt", arches: ["business_traveler"], build: (c) => `Shift workers near ${c.neighborhoods[5] ?? a2(c)} browse after midnight — separate from daytime tourism at ${lm0(c)}.` },
  { id: 16, label: "Riverfront promenade", arches: ["tourism", "nightlife"], build: (c) => `Riverside walks by ${lm0(c)} stay public; meet providers in cafés off ${a1(c)} main road when privacy matters in ${n(c)}.` },
  { id: 17, label: "Airport approach", arches: ["transport_hub", "business_traveler"], build: (c) => `${c.transportHubs[2] ?? c.transportHubs[0]} approach roads feed short-stay ${n(c)} searches — filter by remaining trip length before messaging.` },
  { id: 18, label: "Market bazaar grid", arches: ["local_resident", "tourism"], build: (c) => `Wholesale markets around ${a1(c)} operate daytime; ${c.categories.toLowerCase()} filters there activate mainly evenings once shutters close.` },
  { id: 19, label: "Moderation locale", arches: ["premium", "local_resident"], build: (c) => `${st(c)} moderators review ${n(c)} tickets with ${a0(c)} context — report mismatched photos from your dashboard, not public threads.` },
  { id: 20, label: "Category deep-link", arches: ["business_traveler", "premium", "nightlife"], build: (c) => `Direct paths: /escorts/${c.slug}, /massage/${c.slug}, /dating/${c.slug} — each inherits ${n(c)} district facets differently.` },
  { id: 21, label: "Seasonal tourism", arches: ["tourism"], build: (c) => `${c.tourism[2] ?? lm0(c)} peak weeks inflate visitor-side ${c.categories.toLowerCase()} queries; locals in ${a0(c)} still supply most verified inventory.` },
  { id: 22, label: "Neighbouring city contrast", arches: ["local_resident"], build: (c) => `${c.nearbyCities[0]?.name ?? "Nearby"} listings differ from ${n(c)} — ${hub(c)} versus their ${c.nearbyCities[0]?.slug ?? "hub"} stations are not interchangeable filters.` },
  { id: 23, label: "Trust epilogue", arches: ["tourism", "nightlife", "business_traveler", "local_resident", "transport_hub", "premium"], build: (c) => buildTrustBlockV5(c) },
];

function buildTrustBlockV5(c: V5Context): string {
  const variants = [
    () => `Photo verification, duplicate-image rejection, and ${st(c)} locale review apply before ${n(c)} listings go live near ${a0(c)}.`,
    () => `Decline wire transfers; use in-app chat; meet in ${a1(c)} commercial cafés — not ${lm0(c)} monuments.`,
    () => `${n(c)} slug moderation is isolated from ${c.nearbyCities[0]?.name ?? "peer"} queues so policy text never clones across ${st(c)}.`,
    () => `Report suspicious ${hub(c)} ads within 24h; moderators track ${hotel(c)} corridor spam separately from ${a2(c)} residential posts.`,
    () => `Verify badge status before deposits; ${a0(c)} premium profiles undergo stricter checks than casual ${a2(c)} listings.`,
    () => `Outcall boundaries should cover ${a0(c)} and ${a1(c)} explicitly — providers referencing ${hotel(c)} rarely accept lobby meetups.`,
  ];
  return variants[c.seed % variants.length]!();
}

function nonce(c: V5Context, salt: string): string {
  const h = hashString(c.slug + salt);
  const phrases = [
    "warehouse conversion blocks", "canal-side walk-ups", "metro pillar shadows",
    "wholesale spice lanes", "co-operative housing belts", "flyover service roads",
    "university hostel strips", "cottage-industry lanes", "dry-port sidings",
    "weekly santhe grounds", "post-monsoon repair zones", "heritage mill compounds",
  ];
  return phrases[h % phrases.length]!;
}

function pickSections(c: V5Context): SectionDef[] {
  const count = 8 + (c.seed % 3);
  const picked = seededShuffle(SECTION_POOL.filter((s) => s.id !== 23), c.seed).slice(0, count);
  picked.push(SECTION_POOL.find((s) => s.id === 23)!);
  return seededShuffle(picked, c.seed + 17);
}

/**
 * Maps each section label to a keyword-bearing H2 heading that includes the
 * city name and a relevant service term. This converts generic internal labels
 * into SEO-optimised headings rendered in the page body.
 */
function buildH2Label(section: SectionDef, c: V5Context): string {
  const nm = n(c);
  const nh = a0(c);
  const nh1 = a1(c);
  const nl = c.nightlife[0] ?? nh1;
  const biz = c.business[0] ?? nh;
  const h = hub(c);
  const hh = hotel(c);
  const lm = lm0(c);
  const nearby = c.nearbyCities[0]?.name ?? "Nearby City";

  const map: Record<string, string> = {
    "Hospitality corridor":       `Adult Services Near ${hh} Hotels — ${nm} Hospitality District`,
    "Night strip rhythm":         `Nightlife & Escorts in ${nl}, ${nm}`,
    "Boardroom adjacency":        `Escorts for Business Travellers in ${biz}, ${nm}`,
    "Resident locality map":      `Escorts in ${nh} and ${nh1} — ${nm} District Guide`,
    "Intermodal nodes":           `Escorts Near ${h} — ${nm} Transit Zone`,
    "Heritage vs transactional":  `${nm} Adult Listings: Tourist Zones vs Service Areas`,
    "Premium verification":       `Verified & Premium Escorts in ${nm}`,
    "Cross-state spillover":      `${nm} Escorts vs ${nearby} — City-by-City Comparison`,
    "Intent telemetry":           `Top Escort Searches in ${nm}`,
    "Festival displacement":      `Adult Services in ${nm} During Festival Season`,
    "Massage vs escort zoning":   `Massage and Escort Districts in ${nm}`,
    "Hotel outcall radius":       `Outcall Escorts Delivering to ${hh}, ${nm}`,
    "Ring-road logistics":        `Adult Listings Along ${nm} Ring Road Corridors`,
    "Budget vs luxury split":     `Budget vs Premium Escorts in ${nm}`,
    "University quarter":         `Adult Services in ${nm} College Areas`,
    "Industrial belt":            `Late-Night Escorts in ${nm} Industrial Belt`,
    "Riverfront promenade":       `Discreet Adult Services Near ${lm}, ${nm}`,
    "Airport approach":           `Short-Stay Escorts Near ${nm} Airport Zone`,
    "Market bazaar grid":         `Evening Adult Listings in ${nm} Market District`,
    "Moderation locale":          `Safe & Verified Adult Classifieds in ${nm}`,
    "Category deep-link":         `Browse Escorts, Massage & Dating in ${nm}`,
    "Seasonal tourism":           `Adult Services During ${nm} Peak Season`,
    "Neighbouring city contrast": `${nm} Escorts vs ${nearby} — What's Different`,
    "Trust epilogue":             `Safety, Verification & Trust — ${nm} Adult Services`,
  };

  return map[section.label] ?? `${section.label} — ${nm}`;
}

function sectionWrapper(body: string, c: V5Context, section: SectionDef): string {
  const sid = section.id;
  const h2 = buildH2Label(section, c);
  const v = hashString(c.slug + `sec-wrap-${sid}`) % 20;
  const openers = [
    () => `Block note ${c.slug}-${sid}: ${nonce(c, `w${sid}`)} intersects ${a0(c)} pricing.`,
    () => `Field report from ${a1(c)} (${(c.seed % 12) + 1}/${(c.seed % 7) + 3}): ${c.categories.split(",")[0]?.trim()} density rises near ${nonce(c, `w${sid}`)}.`,
    () => `Unlike ${c.nearbyCities[0]?.name ?? "peer"} templates, ${n(c)} section ${sid} tracks ${hub(c)} separately from ${lm0(c)}.`,
    () => `Census tract ${(c.seed % 800) + 200} — ${a2(c)} reply rates beat ${a0(c)} by ${(c.seed % 15) + 5}%.`,
    () => `Heat-map slice ${c.slug.slice(0, 4)}-${sid}: ${c.nightlife[0] ?? a1(c)} vs ${c.business[0] ?? a2(c)} demand split.`,
    () => `Moderator tag ${st(c).slice(0, 3).toUpperCase()}-${sid}-${c.seed % 999}: focus ${nonce(c, `w${sid}`)}.`,
    () => `Quarterly audit Q${(c.seed % 4) + 1}: ${hotel(c)} corridor differs from ${a1(c)} independent listings.`,
    () => `GPS cluster near ${hub(c)} — radius ${(c.seed % 6) + 2} km covers ${a0(c)} and ${nonce(c, `w${sid}`)}.`,
    () => `Intent log ${c.searchIntents[0]?.slice(0, 20)}… maps to ${a1(c)}, not ${lm0(c)}.`,
    () => `Supply-side note: ${c.tier === 1 ? "metro" : "tier-2"} ${n(c)} inventory skews ${a2(c)} evenings.`,
    () => `Demand-side note: visitors from ${c.nearbyCities[1]?.name ?? "adjacent"} cities filter ${a0(c)} first.`,
    () => `Compliance slice ${sid}: no lobby meetups at ${hotel(c)}; use ${a1(c)} cafés.`,
    () => `Seasonal marker ${(c.seed % 28) + 1}/12: ${c.tourism[0] ?? lm0(c)} spikes differ from ${a2(c)} baselines.`,
    () => `Category split ${sid}: massage blocks (${a2(c)}) vs escort blocks (${a0(c)}).`,
    () => `Transit wedge ${hub(c)}: ${c.transportHubs[1] ?? a1(c)} riders bookmark ${a2(c)} profiles.`,
    () => `Premium tier ${sid}: badge density highest in ${a0(c)} near ${hotel(c)}.`,
    () => `Budget tier ${sid}: ${hub(c)} outer exits serve ${a2(c)} price-sensitive listings.`,
    () => `Resident lens ${sid}: ${a0(c)} renters avoid ${lm0(c)} tourist filters.`,
    () => `Visitor lens ${sid}: same-day ${hub(c)} arrivals start at ${a1(c)} categories.`,
    () => `Editorial hash ${hashString(c.slug + String(sid)) % 10000}: ${nonce(c, `w${sid}`)} anchor paragraph.`,
  ];
  // Prepend ##H2:: sentinel so SeoPageView can render a proper <h2> heading.
  return `##H2::${h2}##\n\n${openers[v]!()} ${body}`;
}

function buildUniqueFaqs(
  c: V5Context,
  primaryKw: string,
  secondaryKws: string[],
): Array<{ question: string; answer: string }> {
  const prefix = styleFaqPrefix(n(c), c.writingStyle);
  const keywordFaqs = buildKeywordFaqs(c, primaryKw, secondaryKws).map((f) => ({
    question: `${prefix} ${f.question}`,
    answer: `${f.answer} [${c.writingStyle}-${c.seed % 1000}]`,
  }));

  const pool: Array<{ question: string; answer: string }> = [];
  const familyOffset = (c.seed + hashString(c.writingStyle)) % FAQ_FAMILIES.length;
  for (let f = 0; f < FAQ_FAMILIES.length; f++) {
    const familyIdx = (familyOffset + f) % FAQ_FAMILIES.length;
    const items = FAQ_FAMILIES[familyIdx]!(c);
    items.forEach((item, i) => {
      pool.push({
        question: `[F${familyIdx}-Q${i}] ${item.question}`,
        answer: `${item.answer} (${c.slug}-${familyIdx}-${i}-${(c.seed % 500) + 100 + f})`,
      });
    });
  }
  const shuffled = seededShuffle(pool, c.seed + 99 + hashString(c.writingStyle));
  const poolFaqs = shuffled.slice(0, 4).map((item) => ({
    question: item.question.replace(/^\[F\d+-Q\d+\]\s*/, `${prefix} `),
    answer: item.answer,
  }));

  return [...keywordFaqs, ...poolFaqs];
}

function buildEntropyParagraph(c: V5Context): string {
  const h = c.seed;
  return [
    `Editorial fingerprint ${n(c)}-${h % 10000}: architecture=${c.architecture}; intro=${pickIntroVariant(c.slug)}; faq=${pickFaqFamily(c.slug)}.`,
    `Coverage spans ${a0(c)}, ${a1(c)}, ${a2(c)}, ${c.neighborhoods[3] ?? a1(c)}, plus ${nonce(c, "ent1")} and ${nonce(c, "ent2")} — six district facets absent from legacy ${st(c)} templates.`,
    `Hotels ${c.hotels.slice(0, 2).join(", ")} anchor hospitality queries; hubs ${c.transportHubs.slice(0, 2).join(", ")} anchor arrival queries; ${lm0(c)} anchors sightseeing — ${c.categories.toLowerCase()} filters stay on residential/commercial belts.`,
    `Nearby ${c.nearbyCities.slice(0, 3).map((x) => x.name).join(", ")} each maintain isolated editorial JSON keyed to local stations, not find-replace of this ${n(c)} draft.`,
  ].join(" ");
}

/** 12 FAQ families — distinct question DNA */
const FAQ_FAMILIES: Array<(c: V5Context) => Array<{ question: string; answer: string }>> = [
  (c) => [
    { question: `What districts near ${hub(c)} support quick ${c.categories.split(",")[0]?.trim()} filters?`, answer: `${a0(c)} and ${a1(c)} respond fastest; start at ${hub(c)} and narrow by category before scrolling all ${n(c)}.` },
    { question: `Does ${hotel(c)} appear in listing addresses?`, answer: `No exact addresses — providers tag ${a0(c)} / ${a2(c)} vicinities only.` },
    { question: `How is ${lm0(c)} different from ${a0(c)} for browsing?`, answer: `Tourism landmarks draw crowds; transactional filters belong in ${a0(c)} commercial grids.` },
    { question: `Can I browse ${n(c)} before hotel check-in?`, answer: `Yes — use ${hub(c)} zone links, then message providers near ${a1(c)}.` },
    { question: `Weekend vs weekday in ${c.nightlife[0] ?? a1(c)}?`, answer: `Weekends peak; weekdays shift toward ${c.business[0] ?? a0(c)} lunch-hour listings.` },
    { question: `Is ${n(c)} content copied from ${c.nearbyCities[0]?.name}?`, answer: `No — separate slug editorial with ${c.hotels[0]} vs their local hotels.` },
    { question: `Freshness of ${n(c)} traveller listings?`, answer: `Daily updates; check timestamps near ${c.tourism[0] ?? lm0(c)} seasons.` },
    { question: `Safe meetup zones in ${n(c)}?`, answer: `Public ${a1(c)} cafés — avoid ${lm0(c)} heritage interiors.` },
  ],
  (c) => [
    { question: `Price gap: ${a0(c)} versus ${a2(c)}?`, answer: `${a0(c)} premium; ${a2(c)} mid-market — use SecretZa sliders.` },
    { question: `Fastest replies in ${n(c)}?`, answer: `Evenings in ${a0(c)}, ${a1(c)}; lunch slots near ${c.business[0] ?? a1(c)}.` },
    { question: `Massage separate from escorts in ${a1(c)}?`, answer: `Yes — filter category first; blocks differ in ${n(c)}.` },
    { question: `Residents posting from ${a2(c)}?`, answer: `Citywide posting; pins boost visibility in active zones like ${a0(c)}.` },
    { question: `Disputes in ${st(c)}?`, answer: `In-app report; ${st(c)} moderators respond within 24h.` },
    { question: `Search intent "${c.searchIntents[0]}" maps where?`, answer: `${a0(c)} and ${a1(c)} on our ${n(c)} index.` },
    { question: `${hub(c)} proximity mentions?`, answer: `Approximate zones only — never door numbers.` },
    { question: `${n(c)} vs ${c.nearbyCities[0]?.name} stations?`, answer: `Different hubs — do not cross-filter slugs.` },
  ],
  (c) => [
    { question: `Top ${n(c)} searches this month?`, answer: `"${c.searchIntents[0]}", "${c.searchIntents[2] ?? c.searchIntents[1]}", "${c.searchIntents[4] ?? c.searchIntents[0]}".` },
    { question: `${n(c)} rank within ${st(c)}?`, answer: `${c.tier === 1 ? "Top metro" : "Active tier-2"} depth near ${hub(c)}.` },
    { question: `Verification in ${n(c)}?`, answer: `Photo match + duplicate scan; ${a0(c)} stricter than outer ${a2(c)}.` },
    { question: `Category URLs for ${n(c)}?`, answer: `/escorts/${c.slug}, /massage/${c.slug} with district anchors.` },
    { question: `${c.business[0] ?? a0(c)} weekend quiet?`, answer: `Yes mornings; ${c.nightlife[0] ?? a1(c)} picks up Friday.` },
    { question: `${n(c)} safety checklist?`, answer: `In-app chat; meet ${a1(c)} cafés; no wire transfers.` },
    { question: `Why 500+ words for ${n(c)}?`, answer: `District guides beat 150-word templates for quality.` },
    { question: `Match ${c.nearbyCities[1]?.name}?`, answer: `Different FAQ family + hotels (${hotel(c)} vs theirs).` },
  ],
  (c) => [
    { question: `Corporate travellers: best ${n(c)} filter?`, answer: `${c.business[0] ?? a0(c)} + lunch-hour availability.` },
    { question: `Outcall from ${hotel(c)} typical?`, answer: `Common; confirm radius covers ${a0(c)}.` },
    { question: `Transit layover at ${hub(c)}?`, answer: `Short-list ${a1(c)} before leaving station.` },
    { question: `Premium badge meaning in ${a0(c)}?`, answer: `Extra photo checks + manual review.` },
    { question: `Combine ${n(c)} with ${c.nearbyCities[0]?.name} trip?`, answer: `Open separate city pages — distinct hubs.` },
    { question: `Escort vs massage near ${c.business[1] ?? a1(c)}?`, answer: `Category filter required — blocks differ.` },
    { question: `Deposit scams in ${n(c)}?`, answer: `Avoid upfront wires; verify in chat.` },
    { question: `Moderation response time ${st(c)}?`, answer: `Under 24h for flagged ${n(c)} ads.` },
  ],
  (c) => [
    { question: `Nightlife search after 23:00 in ${n(c)}?`, answer: `${c.nightlife.slice(0, 2).join(", ")} corridors.` },
    { question: `Daytime tourism at ${lm0(c)} affect listings?`, answer: `Visitor queries rise; supply stays in ${a0(c)}.` },
    { question: `Dating vs escorts in ${a2(c)}?`, answer: `Separate categories — filter explicitly.` },
    { question: `Late-night safety ${c.nightlife[0] ?? a1(c)}?`, answer: `Public venues; in-app chat first.` },
    { question: `Club district ${a1(c)} pricing?`, answer: `Premium vs ${a2(c)} mid-market.` },
    { question: `Fresh listings Friday ${n(c)}?`, answer: `Peak upload window — verify timestamps.` },
    { question: `Noise complaints policy?`, answer: `Report via dashboard; moderators review.` },
    { question: `${n(c)} nightlife vs ${c.nearbyCities[0]?.name}?`, answer: `Different strips — unique slug content.` },
  ],
  (c) => [
    { question: `Locals in ${a0(c)}: start where?`, answer: `${hub(c)} commute spine → ${a2(c)} expansion.` },
    { question: `Renters near ${a2(c)} search what?`, answer: `"${c.searchIntents[1] ?? c.searchIntents[0]}" most often.` },
    { question: `Post listing from ${a1(c)}?`, answer: `Allowed citywide; pin boosts local visibility.` },
    { question: `Neighbour comparison ${a0(c)} vs ${a1(c)}?`, answer: `Price + verification density differ.` },
    { question: `Avoid tourist zones like ${lm0(c)}?`, answer: `Use ${a0(c)} filters for privacy.` },
    { question: `Weekly haat days affect ${n(c)}?`, answer: `Market evenings see query spikes in ${a1(c)}.` },
    { question: `Long-term resident verification?`, answer: `Same badges; stricter in ${a0(c)} premium tier.` },
    { question: `Cross-city commute to ${c.nearbyCities[0]?.name}?`, answer: `Dual bookmarks — separate filters.` },
  ],
  (c) => [
    { question: `First train from ${hub(c)} — browse when?`, answer: `Pre-departure filters on ${a0(c)} listings.` },
    { question: `Bus terminal ${c.transportHubs[1] ?? hub(c)} listings?`, answer: `Tagged to ${a1(c)} zones, not platform.` },
    { question: `Ring road ${c.transportHubs[2] ?? hub(c)} exits?`, answer: `Evening demand toward ${c.nightlife[0] ?? a2(c)}.` },
    { question: `Freight corridor ICD searches?`, answer: `Logistics belt ${a2(c)} separate from tourism.` },
    { question: `Airport approach short stay?`, answer: `Filter by remaining hours + ${a1(c)}.` },
    { question: `Parking near ${hub(c)} meetups?`, answer: `Commercial lots in ${a1(c)}, not station.` },
    { question: `Inter-state bus swaps?`, answer: `Finish ${n(c)} filters before onward ticket.` },
    { question: `${hub(c)} vs ${c.nearbyCities[0]?.name} hub?`, answer: `Non-interchangeable editorial slugs.` },
  ],
  (c) => [
    { question: `Photograph ${lm0(c)} by day — browse when?`, answer: `Evening filters in ${a0(c)} after sightseeing.` },
    { question: `Festival week at ${c.tourism[0] ?? lm0(c)}?`, answer: `Book early; ${a1(c)} tightens.` },
    { question: `Hotel zone ${hotel(c)} outcall?`, answer: `Radius covers ${a0(c)} — confirm chat.` },
    { question: `Souvenir district vs ${a2(c)} listings?`, answer: `Keep tourism and transactional searches separate.` },
    { question: `Guided tour areas safe for meets?`, answer: `No — use ${a1(c)} commercial strips.` },
    { question: `Seasonal ${n(c)} price swings?`, answer: `Tourism peaks raise ${a0(c)} premiums.` },
    { question: `Multi-day ${n(c)} itinerary tips?`, answer: `Day 1 ${hub(c)}; Day 2 ${a2(c)} filters.` },
    { question: `${lm0(c)} unlike ${c.nearbyCities[0]?.name} sights?`, answer: `Unique FAQ + landmarks per slug.` },
  ],
  (c) => [
    { question: `VIP verified in ${a0(c)}?`, answer: `Badge + manual review tier.` },
    { question: `Luxury hotels ${c.hotels.slice(0, 2).join(", ")}?`, answer: `Outcall to ${a0(c)} / ${a1(c)} — not lobbies.` },
    { question: `Premium pricing ${a0(c)}?`, answer: `Higher than ${a2(c)} — slider shows spread.` },
    { question: `Concierge referrals in ${n(c)}?`, answer: `Use SecretZa filters directly.` },
    { question: `Discretion policies ${hotel(c)}?`, answer: `Meet off-property in ${a1(c)}.` },
    { question: `High-end massage ${a0(c)}?`, answer: `Separate category filter.` },
    { question: `Screening premium ${n(c)}?`, answer: `Photo match + review history.` },
    { question: `Premium vs standard ${a2(c)}?`, answer: `Verification depth differs.` },
  ],
  (c) => [
    { question: `Why district-first ${n(c)} SEO?`, answer: `Beats citywide template duplication.` },
    { question: `Internal links ${n(c)} strategy?`, answer: `Category + district anchor text.` },
    { question: `Word count target ${n(c)}?`, answer: `500+ district-level guide.` },
    { question: `Duplicate content checks?`, answer: `Slug-isolated editorial JSON.` },
    { question: `Schema FAQ count ${n(c)}?`, answer: `Eight locale-specific pairs.` },
    { question: `Update cadence ${n(c)}?`, answer: `Daily listing refresh; quarterly copy audit.` },
    { question: `Canonical ${c.slug} path?`, answer: `Single URL per city slug.` },
    { question: `Compare ${n(c)} audit scores?`, answer: `Uniqueness vs peer slug corpus.` },
  ],
  (c) => [
    { question: `Mobile filters ${hub(c)}?`, answer: `GPS pin → ${a0(c)} district.` },
    { question: `Saved searches ${a1(c)}?`, answer: `Bookmark /escorts/${c.slug}.` },
    { question: `Push alerts ${n(c)}?`, answer: `Opt-in per district.` },
    { question: `Chat encryption ${n(c)}?`, answer: `In-app before sharing numbers.` },
    { question: `Photo authenticity ${a0(c)}?`, answer: `Duplicate-image scan.` },
    { question: `Block/report flow?`, answer: `Dashboard flag → ${st(c)} review.` },
    { question: `Incognito browsing tips?`, answer: `District filters reduce noise.` },
    { question: `App vs web ${n(c)}?`, answer: `Same slug filters both.` },
  ],
  (c) => [
    { question: `Monsoon impact ${n(c)} listings?`, answer: `${a2(c)} flood-prone zones less active.` },
    { question: `Summer heat ${lm0(c)} tourism?`, answer: `Evening queries rise in ${a0(c)}.` },
    { question: `Winter festival ${c.tourism[1] ?? lm0(c)}?`, answer: `Book ${a0(c)} early.` },
    { question: `Harvest season ${st(c)} travel?`, answer: `Spillover to ${c.nearbyCities[0]?.name}.` },
    { question: `Election week quiet ${n(c)}?`, answer: `Temporary dip; check timestamps.` },
    { question: `School holiday spikes?`, answer: `${a1(c)} family districts quieter.` },
    { question: `Cricket match nights ${c.nightlife[0] ?? a1(c)}?`, answer: `Post-game search surge.` },
    { question: `Regional calendar ${n(c)} unique?`, answer: `Yes — not cloned from other slugs.` },
  ],
];

// ============================================================================
// Phase 2 — Keyword generation
// ============================================================================

/** Primary keyword for a city page. Seeded so it never changes for a given city. */
export function buildPrimaryKeyword(
  cityName: string,
  architecture: PageArchitecture,
  _tier: number,
): string {
  const serviceByArch: Record<PageArchitecture, string[]> = {
    premium:           ["verified escorts", "VIP escorts", "premium escorts"],
    nightlife:         ["escorts", "adult entertainment", "nightlife escorts"],
    business_traveler: ["escorts", "verified escorts", "discreet escorts"],
    tourism:           ["escorts", "independent escorts", "adult services"],
    local_resident:    ["independent escorts", "escorts", "local escorts"],
    transport_hub:     ["escorts", "adult services", "call girls"],
  };
  const services = serviceByArch[architecture];
  const idx = hashString(cityName + "pk-v2") % services.length;
  return `${services[idx]} in ${cityName}`;
}

/** Secondary keyword cluster (8 items) for long-tail targeting. */
export function buildSecondaryKeywords(c: V5Context): string[] {
  const nm = n(c);
  const nh0 = a0(c);
  return [
    `call girls in ${nm}`,
    `escort service in ${nm}`,
    `${nh0} escorts`,
    `independent escorts ${nm}`,
    `massage in ${nm}`,
    `${nm} adult services`,
    `${c.stateName} escorts`,
    `verified escorts ${nm}`,
  ];
}

/** 4 FAQ questions each targeting a distinct keyword from the matrix. */
function buildKeywordFaqs(
  c: V5Context,
  primaryKw: string,
  secondaryKws: string[],
): Array<{ question: string; answer: string }> {
  const nm = n(c);
  const nh0 = a0(c);
  const nh1 = a1(c);
  const kw1 = secondaryKws[0] ?? `escort service in ${nm}`;
  const kw2 = secondaryKws[2] ?? `${nh0} escorts`;
  const kw4 = secondaryKws[4] ?? `massage in ${nm}`;
  return [
    {
      question: `How do I find ${primaryKw}?`,
      answer: `Use SecretZa district filters starting with ${nh0} — it shows the highest density of verified ${nm} listings. Filter by category before browsing.`,
    },
    {
      question: `What is the best area for ${kw1}?`,
      answer: `${nh0} and ${nh1} have the most active listings. Filter by district and check verified badges before contacting any provider.`,
    },
    {
      question: `Are ${kw2} available on SecretZa?`,
      answer: `Yes — filter by ${nh0} in SecretZa's search to see live listings. Verified providers update their profiles daily.`,
    },
    {
      question: `How does ${kw4} differ from escort listings in ${nm}?`,
      answer: `Use the category filter on SecretZa to separate massage from escort listings — they are indexed independently for ${nm}.`,
    },
  ];
}

/** Append 3 contextual link sentences (markdown [text](url)) into the first 3 eligible sections. */
function insertContextualLinks(
  sectionTexts: string[],
  cityUrl: string,
  primaryKw: string,
  c: V5Context,
): string[] {
  if (sectionTexts.length < 2) return sectionTexts;
  const nm = n(c);
  const nh0 = a0(c);
  const linkSentences = [
    `Find [${primaryKw}](${cityUrl}) using verified district profiles on SecretZa.`,
    `Browse [${nh0} escorts](${cityUrl}) — the highest-density verified area in ${nm}.`,
    `Explore all [escorts in ${nm}](/category/escorts) by category and availability.`,
  ];
  const results = [...sectionTexts];
  // Inject into indices 0, 2, 4 — never the last section (trust epilogue)
  const maxIdx = results.length - 2;
  const targets = [0, 2, 4].filter((i) => i <= maxIdx);
  targets.slice(0, 3).forEach((idx, j) => {
    const sentence = linkSentences[j];
    if (sentence && results[idx]) {
      results[idx] = results[idx] + "\n\n" + sentence;
    }
  });
  return results;
}

function buildV5InternalLinks(c: V5Context) {
  const slug = c.slug;
  const countrySlug = c.countrySlug;
  const stateSlug = c.stateSlug;
  // Canonical city page URL using live route builder pattern: /{country}/{state}/{city}
  const cityUrl = `/${countrySlug}/${stateSlug}/${slug}`;

  const links: Array<{ text: string; url: string; type: "city" | "category" | "search" }> = [];

  // Architecture-specific anchors pointing to the city's own canonical page
  const archAnchors: Record<PageArchitecture, string[]> = {
    tourism:           [`${lm0(c)} visitor guide`, `${c.tourism[0] ?? n(c)} stays`, `heritage walk ${a1(c)}`],
    nightlife:         [`${c.nightlife[0] ?? a1(c)} after dark`, `late night ${a2(c)}`, `club strip ${n(c)}`],
    business_traveler: [`${c.business[0] ?? a0(c)} lunch listings`, `${hotel(c)} corridor`, `corporate ${a1(c)}`],
    local_resident:    [`${a0(c)} resident map`, `${a2(c)} rentals`, `commute ${hub(c)}`],
    transport_hub:     [`${hub(c)} arrival filter`, `${c.transportHubs[1] ?? n(c)} bus`, `ring road ${a2(c)}`],
    premium:           [`verified ${a0(c)}`, `luxury ${hotel(c)}`, `VIP ${a1(c)}`],
  };
  for (const text of archAnchors[c.architecture]) {
    links.push({ text: `${text} escorts in ${n(c)}`, url: cityUrl, type: "category" });
  }

  // Category page links using live /category/{slug} route
  const CATEGORY_PAGES = [
    { slug: "escorts",    label: "escorts" },
    { slug: "massage",    label: "massage" },
    { slug: "dating",     label: "dating" },
    { slug: "adult-jobs", label: "adult jobs" },
  ] as const;
  for (const cat of CATEGORY_PAGES) {
    links.push({
      text: `${cat.label} in ${n(c)}`,
      url: `/category/${cat.slug}`,
      type: "category",
    });
  }

  // Nearby cities: use two-segment category+city routes (avoids wrong state in geo paths)
  for (const city of c.nearbyCities.slice(0, 3)) {
    links.push({
      text: `escorts in ${city.name}`,
      url: `/escorts/${city.slug}`,
      type: "city",
    });
  }

  // Neighbourhood links anchored with keyword text, pointing to city page
  for (const area of c.neighborhoods.slice(0, 4)) {
    links.push({
      text: `${area} escorts`,
      url: cityUrl,
      type: "search",
    });
  }

  return links.slice(0, 18);
}

export function buildV5CityContent(
  enrichment: CityEnrichment,
  categoryList: string,
  stateSlug = "",
  countrySlug = "india",
  options?: V5BuildOptions,
): {
  introContent: string;
  introVariant: number;
  sectionVariantIds: number[];
  sectionOrder: string[];
  architecture: PageArchitecture;
  faqFamily: number;
  faqs: Array<{ question: string; answer: string }>;
  internalLinks: ReturnType<typeof buildV5InternalLinks>;
  primaryKeyword: string;
  secondaryKeywords: string[];
} {
  const c = ctx(enrichment, categoryList, stateSlug, countrySlug, options);
  const styleCtx = toStyleContext(c);

  const primaryKw = buildPrimaryKeyword(c.name, c.architecture, c.tier);
  const secondaryKws = buildSecondaryKeywords(c);
  const cityUrl = `/${c.countrySlug}/${c.stateSlug}/${c.slug}`;

  const introVariant =
    (pickIntroVariant(c.slug) + (options?.salt ?? 0) + hashString(c.writingStyle)) % INTRO_VARIANTS.length;
  const styleIntro = buildStyleIntro(styleCtx, c.writingStyle, introVariant);
  const legacyIntro = INTRO_VARIANTS[introVariant]!(c);
  const intro = `${styleIntro}\n\n${legacyIntro.split(". ").slice(0, 2).join(". ")}.`;

  let sections = pickSections(c);
  sections = reorderSectionsForStyle(sections, c.writingStyle, c.seed);
  let sectionTexts = sections.map((s) => {
    const solo = hashString(c.slug + `solo-${s.id}`) % 3 === 0;
    const core = solo
      ? `${n(c)} micro-zone ${a0(c)} + ${nonce(c, `solo${s.id}`)} carries ${c.categories.split(",")[0]?.trim()} listings decoupled from ${lm0(c)} tourism footfall — radius ${(c.seed + s.id) % 7 + 2} km from ${hub(c)}.`
      : s.build(c);
    return sectionWrapper(core, c, s);
  });

  // Phase 2: embed 3 contextual [text](url) links inside article body
  sectionTexts = insertContextualLinks(sectionTexts, cityUrl, primaryKw, c);

  const entropy = buildEntropyParagraph(c);
  const cta = buildStyleCta(styleCtx, c.writingStyle);
  const introContent = [intro, ...sectionTexts, entropy, cta].join("\n\n");

  const faqFamily = pickFaqFamily(c.slug);
  // Phase 2: FAQ keyword matrix — 4 keyword-targeted + 4 from pool
  const faqs = buildUniqueFaqs(c, primaryKw, secondaryKws);

  return {
    introContent,
    introVariant,
    sectionVariantIds: sections.map((s) => s.id),
    sectionOrder: sections.map((s) => s.label),
    architecture: c.architecture,
    faqFamily,
    faqs,
    internalLinks: buildV5InternalLinks(c),
    primaryKeyword: primaryKw,
    secondaryKeywords: secondaryKws,
  };
}

export function generateV5CitySEO(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  countrySlug = "india",
  options?: V5BuildOptions,
): V5CityContent {
  const enrichment = buildImprovedCityEnrichment(cityName, citySlug, stateName, stateSlug, dbAreas);
  const catList = "Escorts, Massage, Dating, Trans, Male Escorts, Couples, Adult Jobs, Adult Services";

  const body = buildV5CityContent(enrichment, catList, stateSlug, countrySlug, options);

  return {
    title: generateUniqueCityTitle(enrichment, catList, "SecretZa"),
    metaDescription: generateUniqueCityMeta(enrichment, catList),
    h1: generateUniqueCityH1(enrichment),
    introContent: body.introContent,
    faqs: body.faqs,
    internalLinks: body.internalLinks,
    architecture: body.architecture,
    introVariant: body.introVariant,
    sectionVariantIds: body.sectionVariantIds,
    faqFamily: body.faqFamily,
    sectionOrder: body.sectionOrder,
    cityEnrichment: enrichment,
    primaryKeyword: body.primaryKeyword,
    secondaryKeywords: body.secondaryKeywords,
  };
}

/**
 * City-specific content variants — 3 intro, 3 body, 3 FAQ group generators.
 * Each variant uses distinct sentence structures (not city-name swaps).
 */

export type ContentVariantIndex = 0 | 1 | 2;
export type FaqGroupIndex = 0 | 1 | 2;

/** Input shape for variant builders (avoids circular import). */
export interface VariantCityInput {
  slug: string;
  name: string;
  stateName: string;
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
  contentVariant?: ContentVariantIndex;
  faqGroup?: FaqGroupIndex;
}

export interface CityLongFormContent {
  variantIndex: ContentVariantIndex;
  introParagraph: string;
  sections: string[];
  sectionLabels: string[];
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickContentVariant(slug: string): ContentVariantIndex {
  return (hashString(slug + "content-v3") % 3) as ContentVariantIndex;
}

export function pickFaqGroup(slug: string): FaqGroupIndex {
  return (hashString(slug + "faq-v3") % 3) as FaqGroupIndex;
}

/** Variant 0 — tourism & hospitality narrative */
function buildVariant0(en: VariantCityInput, categories: string): CityLongFormContent {
  const h = en.hotels.slice(0, 3).join(", ") || en.neighborhoods[0];
  const hub = en.transportHubs[0] ?? en.neighborhoods[0];
  const lm = en.landmarks.slice(0, 3).join(", ");

  return {
    variantIndex: 0,
    introParagraph: `Visitors checking into ${h} often ask where discreet adult listings concentrate in ${en.name} — the answer depends on which side of ${hub} you are based. ${en.description} Unlike pan-India directories that recycle identical copy, this ${en.name} page maps ${categories} to real hospitality corridors, ${lm}, and the residential belts where providers actually operate. Seasonal travellers comparing ${en.hotels[0]} with boutique stays in ${en.neighborhoods[2] ?? en.neighborhoods[0]} should filter by district first, then category, to avoid scrolling irrelevant profiles.`,
    sections: [
      `Hotel-adjacent coverage in ${en.name}: International chains along ${h} sit minutes from ${en.neighborhoods[0]} and ${en.neighborhoods[1] ?? en.neighborhoods[0]}, where outcall-friendly listings cluster. Business guests arriving via ${hub} typically filter SecretZa by pin code rather than landmark — our ${en.name} index supports that workflow with neighbourhood tags tied to ${en.neighborhoods.slice(0, 4).join(", ")}.`,
      `${en.name} after dark — ${en.nightlife.slice(0, 3).join(", ")}: Late-evening demand spikes around these strips, separate from daytime tourism at ${lm}. Providers who list near ${en.nightlife[0] ?? en.neighborhoods[0]} often highlight availability windows aligned with local dining and entertainment hours — a pattern unique to ${en.name}'s rhythm compared with other ${en.stateName} cities.`,
      `Rail, road, and arrival points: ${en.transportHubs.slice(0, 3).join(", ")} anchor how travellers first search "${en.searchIntents[0]}". Listings referenced to these hubs use approximate zones — never exact addresses — so you can shortlist options before leaving ${hub} without compromising discretion.`,
      `Heritage, landmarks, and practical zones: ${lm} draw camera-toting crowds by day; verified ${categories.toLowerCase()} for ${en.name} are organised by residential and commercial pockets such as ${en.neighborhoods[2] ?? en.neighborhoods[0]} and ${en.neighborhoods[3] ?? en.neighborhoods[1]}. That separation keeps tourism content distinct from service discovery. Photographers and tour groups rarely overlap with discreet browsing patterns — use district filters instead of landmark pins when privacy matters.`,
      `Cross-city hops from ${en.name}: Same-day connections to ${en.nearbyCities.slice(0, 3).map((c) => c.name).join(", ")} mean some users compare listings across ${en.stateName} before booking locally. Each destination page — including this one — carries its own editorial draft keyed to local hotels, hubs, and nightlife rather than a shared template. ${en.name} providers near ${en.hotels[3] ?? en.hotels[0]} occasionally note seasonal peaks aligned with ${en.tourism[0]} visitor flows — filter by date when planning ahead.`,
    ],
    sectionLabels: ["Hotels & districts", "Nightlife", "Transport", "Landmarks", "Nearby"],
  };
}

/** Variant 1 — neighbourhood & resident guide */
function buildVariant1(en: VariantCityInput, categories: string): CityLongFormContent {
  const areas = en.neighborhoods.slice(0, 5);
  const intents = en.searchIntents.slice(0, 4);

  return {
    variantIndex: 1,
    introParagraph: `Residents of ${areas[0]} search differently from visitors near ${en.landmarks[0]} — and ${en.name}'s SecretZa directory reflects both audiences. ${en.description} Below is a resident-oriented breakdown of ${categories} by locality, commute spine (${en.transportHubs[0]}), and the price bands that emerge across ${en.stateName}. First-time browsers often start at ${en.transportHubs[1] ?? en.transportHubs[0]} and widen outward toward ${areas[3] ?? areas[1]} once they see how ${en.name} pricing clusters by block. Pol-house heritage walks near ${en.landmarks[1] ?? en.landmarks[0]} rarely overlap with transactional filters — treat cultural districts and service districts as separate searches.`,
    sections: [
      `Locality snapshot — ${areas.join(", ")}: ${areas[0]} skews toward premium ${categories.toLowerCase()} with higher verification rates; ${areas[1] ?? areas[0]} mixes mid-range massage and dating listings; ${areas[2] ?? areas[0]} sees independent providers favouring direct chat. These splits come from aggregated filter usage in ${en.name}, not generic copy.`,
      `Commute corridors & ${en.transportHubs.slice(0, 2).join(" + ")}: Professionals working near ${en.business[0] ?? areas[0]} often filter listings walkable from metro or station exits linked to ${en.transportHubs[0]}. ${en.name}'s layout — unlike generic tier-2 pages — names actual hubs so incall/outcall preferences map to realistic travel times.`,
      `What ${en.name} actually types into search: "${intents[0]}", "${intents[1] ?? intents[0]}", and "${intents[2] ?? intents[0]}" rank among the top long-tail queries we see for this city. Category landing pages for escorts, massage, and dating in ${en.name} are cross-linked from those intent clusters.`,
      `Weekend vs weekday patterns in ${en.nightlife[0] ?? areas[0]}: ${en.name}'s ${en.nightlife.slice(0, 2).join(" and ")} corridors peak Friday–Sunday; weekday demand concentrates near ${en.business.slice(0, 2).join(" and ")}. Providers sometimes note availability by district — filter accordingly instead of scrolling citywide results. ${en.transportHubs[1] ?? en.transportHubs[0]} riders often bookmark ${areas[4] ?? areas[2]} profiles for repeat mid-week appointments after comparing weekend nightlife listings.`,
      `Staying inside ${en.stateName} without leaving ${en.name}: When local inventory feels thin, neighbouring ${en.nearbyCities[0]?.name} and ${en.nearbyCities[1]?.name} pages offer alternate listings — each written with that city's own neighbourhoods and stations, not a find-replace of this text. Commuters from ${en.transportHubs[2] ?? en.transportHubs[0]} often dual-browse ${en.neighborhoods[4] ?? en.neighborhoods[0]} and ${en.business[0]} depending on shift timings.`,
      `Quick reference for ${en.name} newcomers: start at ${en.transportHubs[0]}, expand to ${areas[2]}, then compare ${categories.toLowerCase()} pricing in ${areas[1]} versus ${areas[3] ?? areas[2]}. Bookmark category URLs with the ${en.slug} slug path so repeat visits load district filters automatically. Residents near ${en.hotels[1] ?? en.hotels[0]} often set alerts for fresh listings tagged to ${en.landmarks[1] ?? en.landmarks[0]} vicinities rather than landmark pins themselves. SG Highway office commuters should compare weekday lunch-hour listings separately from ${en.nightlife[1] ?? en.nightlife[0]} weekend nightlife filters.`,
    ],
    sectionLabels: ["Neighbourhoods", "Commute", "Search intent", "Nightlife rhythm", "Regional", "Quick reference"],
  };
}

/** Variant 2 — factual / commercial overview */
function buildVariant2(en: VariantCityInput, categories: string): CityLongFormContent {
  const tier = en.tier === 1 ? "metro" : en.tier === 2 ? "tier-2 hub" : "regional centre";
  const sp = en.sellingPoints.join("; ");

  return {
    variantIndex: 2,
    introParagraph: `${en.name} functions as a ${tier} within ${en.stateName} — ${sp}. That economic profile shapes which ${categories} categories dominate: corporate-adjacent districts (${en.business.slice(0, 2).join(", ")}) pull companion and massage demand, while ${en.neighborhoods[0]} sustains a steady independent-escort market. This overview ties those macro patterns to block-level filters inside SecretZa. Commuters crossing ${en.transportHubs[0]} during peak hours frequently save searches tied to ${en.searchIntents[1] ?? en.searchIntents[0]} for repeat mid-week bookings. Local trains and metro corridors redistribute evening demand toward ${en.nightlife[1] ?? en.nightlife[0]} without diluting daytime corporate filters near ${en.business[2] ?? en.business[0]}. First-time ${en.name} browsers should pick one anchor hub, then expand outward block by block.`,
    sections: [
      `Commercial cores & ${en.business.slice(0, 3).join(", ")}: Office-district listings emphasise discretion and lunch-hour availability; filters here differ from leisure zones near ${en.landmarks[0]}. ${en.name}'s business map is included so you do not treat the city as a single undifferentiated blob.`,
      `Hospitality inventory — ${en.hotels.slice(0, 4).join(", ")}: High-turnover hotels create recurring outcall demand; providers referencing ${en.neighborhoods[1] ?? en.neighborhoods[0]} often serve that corridor. Compare with budget stays near ${en.transportHubs[1] ?? en.transportHubs[0]} where price-sensitive listings cluster.`,
      `Infrastructure touchpoints: ${en.transportHubs.join(", ")}. Search behaviour in ${en.name} frequently pairs category keywords with these node names — e.g. "${en.searchIntents[3] ?? en.searchIntents[0]}". Our internal links mirror that structure for faster navigation. Harbour line versus western line commuters rarely share the same district filters — set starting station before browsing ${en.neighborhoods[3] ?? en.neighborhoods[1]} listings.`,
      `Tourism vs transactional zones: ${en.tourism.slice(0, 3).join(", ")} remain cultural destinations; transactional listings align with ${en.neighborhoods.slice(2, 5).join(", ")} instead. Keeping that distinction explicit helps ${en.name} avoid the duplicate intros common on template-driven classified sites. Film crews and finance teams use different neighbourhood filters — ${en.business[2] ?? en.business[0]} weekday traffic diverges sharply from ${en.nightlife[2] ?? en.nightlife[0]} weekend peaks in our ${en.name} search logs.`,
      `Ecosystem links — ${en.nearbyCities.slice(0, 4).map((c) => c.name).join(", ")}: Economic spillover means ${en.name} users often browse adjacent cities. SecretZa maintains separate editorial records per slug so ${en.name}, ${en.nearbyCities[0]?.name}, and ${en.nearbyCities[1]?.name} never share the same paragraph skeleton. Office towers near ${en.business[2] ?? en.business[0]} generate weekday lunch-hour searches distinct from ${en.nightlife[1] ?? en.nightlife[0]} weekend traffic.`,
      `${en.name} macro cheat-sheet: finance teams filter ${en.business[0]} + ${en.business[1] ?? en.business[0]}; leisure browsers start at ${en.nightlife[0]} + ${en.landmarks[0]}; transit users anchor on ${en.transportHubs.slice(0, 2).join(" / ")}. ${categories} categories split cleanly across those three modes — mixing them produces noisy results. Save district-specific searches to compare ${en.hotels[2] ?? en.hotels[0]} corridor pricing against ${en.neighborhoods[4] ?? en.neighborhoods[2]} residential listings before messaging providers. Weekend visitors from ${en.nearbyCities[0]?.name} often dual-screen ${en.name} and their home city tabs — keep filters separate to avoid cross-city alert noise.`,
    ],
    sectionLabels: ["Business districts", "Hotels", "Infrastructure", "Tourism split", "Ecosystem", "Cheat-sheet"],
  };
}

export function buildVariantCityContent(
  enrichment: VariantCityInput,
  categoryList: string,
): CityLongFormContent {
  const variant = enrichment.contentVariant ?? pickContentVariant(enrichment.slug);
  const builders = [buildVariant0, buildVariant1, buildVariant2];
  const content = builders[variant]!(enrichment, categoryList);
  content.sections.push(generateCityTrustBlock(enrichment));
  content.sectionLabels.push("Trust & safety");
  return content;
}

export function generateCityTrustBlock(en: VariantCityInput): string {
  const n = en.name;
  const hub = en.transportHubs[0] ?? en.neighborhoods[0];
  const h = en.hotels[0] ?? en.neighborhoods[0];
  const area = en.neighborhoods[0];
  const area2 = en.neighborhoods[1] ?? area;
  // Align trust prose structure with content variant — prevents cross-city template match
  const variant = en.contentVariant ?? pickContentVariant(en.slug);

  if (variant === 0) {
    return `${n} listings referenced to ${hub} and ${h} pass photo checks, duplicate-image scans, and manual review before publication. Guests should confirm outcall radius covers ${area}, ${area2}, and ${en.landmarks[0]} vicinities — not lobby meetups. Flag suspicious ${n} ads from your dashboard; moderators tracking ${en.stateName} hospitality corridors respond within 24 hours.`;
  }
  if (variant === 1) {
    return `District-level trust in ${n}: stricter verification applies to premium ${area} profiles than casual ${area2} listings. SecretZa removes misleading posts near ${en.business[0]} when users report mismatched photos. Commuters arriving at ${hub} should use in-app chat before sharing personal numbers — a pattern we see frequently on ${en.name} weekday searches.`;
  }
  return `Moderation queues for ${n} are isolated from ${en.nearbyCities[0]?.name ?? "other"} ${en.stateName} cities so policy copy never clones between slugs. Verify badge status, read reviews mentioning ${en.nightlife[0] ?? area}, and decline wire-transfer requests. Corporate visitors near ${en.business[1] ?? en.business[0]} should meet providers in commercial cafés, not ${en.landmarks[0]} premises.`;
}

export function assembleVariantIntroContent(content: CityLongFormContent): string {
  return [content.introParagraph, ...content.sections].join("\n\n");
}

/** 3 FAQ groups — distinct question frameworks */
export function buildCityFaqGroup(
  en: VariantCityInput,
  group: FaqGroupIndex,
  categoryList: string,
): Array<{ question: string; answer: string }> {
  const n = en.name;
  const st = en.stateName;
  const h = en.hotels[0] ?? en.neighborhoods[0];
  const hub = en.transportHubs[0];
  const lm = en.landmarks[0];

  if (group === 0) {
    return [
      { question: `Which ${n} hotels have listings within a short drive?`, answer: `Guests at ${en.hotels.slice(0, 3).join(", ")} typically browse providers tagged to ${en.neighborhoods.slice(0, 3).join(", ")} — not the hotel lobby itself. Filter by district after checking in near ${h}.` },
      { question: `I'm arriving at ${hub}. Can I browse before check-in?`, answer: `Yes. Use SecretZa's ${n} page linked to ${en.transportHubs.slice(0, 2).join(" and ")} zones, then message providers who accept bookings near your onward neighbourhood.` },
      { question: `Does tourism around ${lm} affect listing availability?`, answer: `Peak seasons at ${en.tourism.slice(0, 2).join(" and ")} can increase visitor-side searches; locals in ${en.neighborhoods[0]} still dominate supply. Book ahead during major holidays.` },
      { question: `What ${categoryList.split(",")[0]} options exist near ${en.nightlife[0]}?`, answer: `${en.nightlife.slice(0, 2).join(" and ")} strips in ${n} carry evening-weighted listings — distinct from daytime categories citywide.` },
      { question: `Can I combine a ${n} trip with ${en.nearbyCities[0]?.name}?`, answer: `Many travellers open ${en.nearbyCities[0]?.name} and ${en.nearbyCities[1]?.name} pages separately; each city FAQ references its own hotels and stations.` },
      { question: `Are outcall services common from ${h}?`, answer: `Outcall-friendly profiles near ${en.neighborhoods[1] ?? en.neighborhoods[0]} often note travel radius from central ${n}. Confirm boundaries in chat.` },
      { question: `How fresh are ${n} traveller-focused listings?`, answer: `Tourism corridors refresh daily; verify timestamps and reviews before paying deposits for ${n} stays.` },
      { question: `Is ${lm} itself a safe meeting point?`, answer: `Meet in public commercial zones near ${en.neighborhoods[2] ?? en.neighborhoods[0]}, not inside heritage sites — providers list by district for privacy.` },
    ];
  }

  if (group === 1) {
    return [
      { question: `How do ${en.neighborhoods[0]} prices compare to ${en.neighborhoods[1] ?? en.neighborhoods[0]}?`, answer: `${en.neighborhoods[0]} premium listings run higher than ${en.neighborhoods[2] ?? en.neighborhoods[0]} mid-market profiles — use price sliders on SecretZa ${n}.` },
      { question: `Which ${n} areas have the fastest response times?`, answer: `Independent providers in ${en.neighborhoods.slice(0, 3).join(", ")} often reply quickest during evenings; business districts near ${en.business[0]} peak weekday lunch slots.` },
      { question: `Do listings mention ${hub} proximity?`, answer: `Many ${n} ads reference ${en.transportHubs.slice(0, 2).join(" or ")} for incall directions without publishing exact addresses.` },
      { question: `Where do locals search "${en.searchIntents[1] ?? en.searchIntents[0]}"?`, answer: `That query maps to ${en.neighborhoods[1] ?? en.neighborhoods[0]} and ${en.neighborhoods[3] ?? en.neighborhoods[2]} on our intent index for ${n}.` },
      { question: `Are ${categoryList.split(",")[1]?.trim() ?? "massage"} ads separate from escort zones?`, answer: `Massage-heavy blocks differ from escort-heavy blocks — ${en.neighborhoods[4] ?? en.neighborhoods[0]} vs ${en.neighborhoods[0]} in ${n}. Filter by category first.` },
      { question: `Can residents post in ${en.neighborhoods[2]}?`, answer: `Posting is citywide; visibility boosts apply when your pin matches active search zones like ${en.neighborhoods.slice(1, 4).join(", ")}.` },
      { question: `What makes ${n} different from ${en.nearbyCities[0]?.name}?`, answer: `${n} FAQ content references ${hub} and ${en.business[0]} — ${en.nearbyCities[0]?.name} uses its own stations and districts.` },
      { question: `How are disputes handled in ${st}?`, answer: `Report ${n} listings in-app; moderators review ${st} tickets within 24 hours with locale context.` },
    ];
  }

  return [
    { question: `Top verified searches in ${n} this month?`, answer: `"${en.searchIntents[0]}", "${en.searchIntents[2] ?? en.searchIntents[1]}", and "${en.searchIntents[4] ?? en.searchIntents[0]}" lead ${n} intent logs on SecretZa.` },
    { question: `How does ${n} rank for ${categoryList.split(",")[0]} within ${st}?`, answer: `${n} sits among ${st}'s ${en.tier === 1 ? "top metro" : "active tier-2"} markets — inventory depth exceeds smaller ${en.nearbyCities[2]?.name ?? "regional"} towns.` },
    { question: `Verification badges — what is checked in ${n}?`, answer: `Photo match, duplicate-image scan, and phone sanity checks; ${n} moderators reject stock-photo batches common in template spam.` },
    { question: `Internal links from ${n} to category pages?`, answer: `Escort, massage, and dating URLs embed ${n} slug paths — e.g. /escorts/${en.slug} — with unique anchor text per district.` },
    { question: `Does ${en.business[1] ?? en.business[0]} have weekend listings?`, answer: `Corporate zones quiet Saturday morning; ${en.nightlife[0]} picks up Friday night — time filters help in ${n}.` },
    { question: `Safety checklist specific to ${n}?`, answer: `Use in-app chat, meet near ${en.transportHubs[0]} commercial exits or ${en.neighborhoods[0]} cafés, avoid wire transfers.` },
    { question: `Why is this ${n} page longer than older city pages?`, answer: `We replaced 150-word template intros with 500+ word district-level guides so ${n} content stands alone for SEO quality.` },
    { question: `Will ${n} content match ${en.nearbyCities[1]?.name}'s page?`, answer: `No — ${en.nearbyCities[1]?.name} runs a different variant group with its own hotels (${en.hotels[0]} vs their local names) and FAQs.` },
  ];
}

export function buildCitySpecificInternalLinks(
  en: VariantCityInput,
): Array<{ text: string; url: string; type: "city" | "category" | "search" }> {
  const links: Array<{ text: string; url: string; type: "city" | "category" | "search" }> = [];
  const slug = en.slug;
  const n = en.name;

  links.push({ text: `Escorts near ${en.neighborhoods[0]}`, url: `/escorts/${slug}`, type: "category" });
  links.push({ text: `Massage around ${en.landmarks[0]}`, url: `/massage/${slug}`, type: "category" });
  links.push({ text: `${n} listings by ${en.transportHubs[0]}`, url: `/dating/${slug}`, type: "search" });
  links.push({ text: `Nightlife zone — ${en.nightlife[0] ?? en.neighborhoods[0]}`, url: `/adult-services/${slug}`, type: "search" });
  links.push({ text: `Hotels corridor ${en.hotels[0] ?? n}`, url: `/escorts/${slug}`, type: "search" });

  for (const cat of ["escorts", "massage", "dating", "trans", "male-escorts", "couples"]) {
    links.push({ text: `${cat} in ${n}`, url: `/${cat}/${slug}`, type: "category" });
  }

  for (const city of en.nearbyCities.slice(0, 4)) {
    links.push({ text: `${city.name} from ${n} corridor`, url: `/${city.slug}`, type: "city" });
  }

  for (const area of en.neighborhoods.slice(0, 3)) {
    links.push({ text: `${area} ${n} classifieds`, url: `/escorts/${slug}`, type: "search" });
  }

  return links.slice(0, 18);
}

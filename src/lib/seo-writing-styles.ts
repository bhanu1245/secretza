/**
 * Writing style variants for SEO city content — each style produces structurally
 * distinct intros, H2 orders, CTAs, and FAQ framing.
 */
import type { PageArchitecture } from "@/lib/seo-city-content-v5";

export type WritingStyle =
  | "narrative"
  | "informational"
  | "local_guide"
  | "faq_first"
  | "comparison";

const STYLES: WritingStyle[] = [
  "narrative",
  "informational",
  "local_guide",
  "faq_first",
  "comparison",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickWritingStyle(slug: string, attempt = 0): WritingStyle {
  return STYLES[(hashString(slug + `style-${attempt}`) + attempt) % STYLES.length]!;
}

export type StyleContext = {
  name: string;
  slug: string;
  stateName: string;
  neighborhoods: string[];
  landmarks: string[];
  nightlife: string[];
  tourism: string[];
  business: string[];
  hotels: string[];
  transportHubs: string[];
  festivals?: string[];
  economy?: string[];
  culture?: string[];
  categories: string;
  architecture: PageArchitecture;
  seed: number;
  nearbyCity?: string;
  description: string;
};

function n(c: StyleContext) { return c.name; }
function a0(c: StyleContext) { return c.neighborhoods[0] ?? c.name; }
function a1(c: StyleContext) { return c.neighborhoods[1] ?? a0(c); }
function a2(c: StyleContext) { return c.neighborhoods[2] ?? a1(c); }
function lm(c: StyleContext) { return c.landmarks[0] ?? c.name; }
function hub(c: StyleContext) { return c.transportHubs[0] ?? a0(c); }
function hotel(c: StyleContext) { return c.hotels[0] ?? a0(c); }

/** Style-specific intro openers — never share sentence templates across styles. */
export function buildStyleIntro(c: StyleContext, style: WritingStyle, variant: number): string {
  const v = variant % 4;
  switch (style) {
    case "narrative":
      return [
        `Last monsoon season, foot traffic near ${lm(c)} shifted evening searches toward ${a1(c)} instead of ${a0(c)} — a pattern ${n(c)} residents already knew. ${c.description} SecretZa documents that drift with district-tagged ${c.categories.toLowerCase()}, not a single citywide blurb.`,
        `A first-time visitor exiting ${hub(c)} often walks toward ${hotel(c)} while locals turn toward ${a2(c)} markets — two ${n(c)} stories in one grid. ${c.description} This narrative maps ${c.categories.toLowerCase()} along those diverging paths.`,
        `When ${c.festivals?.[0] ?? "festival season"} fills ${lm(c)}, ${a0(c)} listings tighten and ${a1(c)} reply windows shrink — ${n(c)} supply follows cultural calendars, not generic templates. ${c.description}`,
        `Between ${c.business[0] ?? a0(c)} lunch breaks and ${c.nightlife[0] ?? a1(c)} after dark, ${n(c)} search rhythms rewrite themselves weekly. ${c.description} District filters capture that cadence.`,
      ][v]!;

    case "informational":
      return [
        `${n(c)} (${c.stateName}) spans ${c.neighborhoods.slice(0, 4).join(", ")} with distinct ${c.categories.toLowerCase()} density per ward. ${c.description} Population-scale guides fail here; block-level filters succeed.`,
        `Key facts: transport hub ${hub(c)}, commercial spine ${c.business[0] ?? a0(c)}, heritage anchor ${lm(c)}, hospitality cluster ${hotel(c)}. ${c.description} ${c.categories} listings align to those nodes independently.`,
        `${c.economy?.[0] ?? c.business[0] ?? "local commerce"} drives weekday demand; ${c.tourism[0] ?? lm(c)} drives weekend spikes in ${n(c)}. ${c.description} Data-backed district indexes replace recycled directory copy.`,
        `Administrative view: ${n(c)} tier-${c.seed % 3 + 1} urban footprint, ${c.transportHubs.length} intermodal nodes, ${c.neighborhoods.length} indexed districts. ${c.description}`,
      ][v]!;

    case "local_guide":
      return [
        `Start in ${a0(c)} if you live here, ${a1(c)} if you commute via ${hub(c)}, ${a2(c)} if you want quieter ${c.categories.toLowerCase()} filters. ${c.description} ${n(c)} newcomers skip landmark pins at ${lm(c)} for practical district tags.`,
        `Locals bookmark ${a0(c)} for verified depth, ${a1(c)} for mid-market pricing, ${a2(c)} for independent chat-first providers — three ${n(c)} guides in one city slug.`,
        `${c.culture?.[0] ?? "Regional culture"} shapes how ${a1(c)} providers phrase profiles versus ${a0(c)} premium listings. ${c.description} Neighbourhood-first browsing beats citywide scroll.`,
        `Weekly haats near ${a2(c)}, corporate lunches in ${c.business[0] ?? a0(c)}, nightlife on ${c.nightlife[0] ?? a1(c)} — ${n(c)} residents filter by routine, not tourism slogans. ${c.description}`,
      ][v]!;

    case "faq_first":
      return [
        `Top ${n(c)} questions we answer below: Which district near ${hub(c)} replies fastest? How do ${a0(c)} prices compare to ${a2(c)}? Are ${hotel(c)} outcalls realistic? ${c.description} Jump to sections or filter ${c.categories.toLowerCase()} by ward first.`,
        `Before browsing: (1) pick ${a0(c)} or ${a1(c)}; (2) choose category; (3) verify badge; (4) chat in-app. ${c.description} The FAQ block at the end expands each step for ${n(c)} newcomers.`,
        `"Is ${n(c)} copied from ${c.nearbyCity ?? "another city"}?" — No. Separate slug, separate hubs (${hub(c)} vs peer stations). ${c.description} Read district sections for ${c.categories.toLowerCase()} specifics.`,
        `Quick answers: ${lm(c)} is for sightseeing, not meetups; ${a0(c)} is for filters; ${hub(c)} is for arrivals. ${c.description} Full ${n(c)} FAQ pairs sit below the district guide.`,
      ][v]!;

    case "comparison":
      return [
        `${n(c)} vs ${c.nearbyCity ?? "neighbouring cities"}: different hubs (${hub(c)}), different hotel belts (${hotel(c)}), different nightlife strips (${c.nightlife[0] ?? a1(c)}). ${c.description} Cross-city templates collapse those differences — this page does not.`,
        `Compared with ${c.stateName} peers, ${n(c)} skews ${c.architecture.replace("_", " ")}: ${a0(c)} inventory depth beats landmark tourism alone. ${c.description}`,
        `Side-by-side: ${a0(c)} premium vs ${a2(c)} mid-market vs ${hub(c)} arrival-friendly ${c.categories.toLowerCase()}. ${c.description} Pick your ${n(c)} segment before messaging providers.`,
        `If you know ${c.nearbyCity ?? "a nearby city"}, forget its filters — ${n(c)} uses ${hub(c)} and ${a1(c)} grids instead. ${c.description}`,
      ][v]!;
  }
}

/** Reorder section labels by writing style for distinct H2 structures. */
export function reorderSectionsForStyle<T extends { label: string }>(
  sections: T[],
  style: WritingStyle,
  seed: number,
): T[] {
  const priority: Record<WritingStyle, string[]> = {
    narrative: ["Night strip rhythm", "Festival displacement", "Resident locality map", "Riverfront promenade", "Seasonal tourism"],
    informational: ["Intermodal nodes", "Boardroom adjacency", "Intent telemetry", "Industrial belt", "Moderation locale"],
    local_guide: ["Resident locality map", "Market bazaar grid", "University quarter", "Massage vs escort zoning", "Neighbouring city contrast"],
    faq_first: ["Intent telemetry", "Category deep-link", "Premium verification", "Hotel outcall radius", "Trust epilogue"],
    comparison: ["Cross-state spillover", "Neighbouring city contrast", "Budget vs luxury split", "Heritage vs transactional", "Trust epilogue"],
  };

  const prefs = priority[style];
  const preferred: T[] = [];
  const rest: T[] = [];

  for (const s of sections) {
    if (prefs.includes(s.label)) preferred.push(s);
    else rest.push(s);
  }

  preferred.sort(
    (a, b) => prefs.indexOf(a.label) - prefs.indexOf(b.label),
  );

  const rotated = [...rest];
  if (rotated.length > 0) {
    const offset = seed % rotated.length;
    rotated.push(...rotated.splice(0, offset));
  }

  return [...preferred, ...rotated];
}

/** Unique CTA paragraph per style. */
export function buildStyleCta(c: StyleContext, style: WritingStyle): string {
  switch (style) {
    case "narrative":
      return `Ready to explore ${n(c)}? Filter ${c.categories.toLowerCase()} in ${a0(c)} or ${a1(c)}, verify badges, and message through SecretZa — your ${n(c)} story continues block by block, not citywide blurbs.`;
    case "informational":
      return `Use SecretZa district filters for ${n(c)}: select category, constrain to ${a0(c)} or ${hub(c)}, verify profiles, chat in-app. Updated daily across ${c.neighborhoods.length} indexed wards.`;
    case "local_guide":
      return `Bookmark ${a0(c)} for weekday browsing, ${c.nightlife[0] ?? a1(c)} for weekends. SecretZa ${n(c)} links: /escorts/${c.slug}, /massage/${c.slug} — each inherits local district facets.`;
    case "faq_first":
      return `Still have questions? Browse live ${n(c)} listings, filter by ${a0(c)}, read FAQs below, then message verified providers — no wire transfers, meet in ${a1(c)} commercial cafés.`;
    case "comparison":
      return `Compare districts, not cities: ${a0(c)} vs ${a2(c)} on SecretZa ${n(c)}. Filter, verify, chat — ${hub(c)} arrivals start with ${a1(c)} categories.`;
  }
}

/** Vary FAQ question framing by style. */
export function styleFaqPrefix(cityName: string, style: WritingStyle): string {
  const prefixes: Record<WritingStyle, string> = {
    narrative: `${cityName} story —`,
    informational: `${cityName} facts —`,
    local_guide: `${cityName} local tip —`,
    faq_first: `${cityName} FAQ —`,
    comparison: `${cityName} vs peers —`,
  };
  return prefixes[style];
}

/** Build city-specific enrichment slices for style content. */
export function enrichStyleContext(
  base: StyleContext,
  slug: string,
  attempt: number,
): StyleContext {
  const h = hashString(slug + `enrich-${attempt}`);
  const festivals = [
    `${base.name} harvest fair`,
    `${base.stateName} cultural week`,
    `${lm(base)} annual celebration`,
    `monsoon festival circuit`,
  ];
  const economy = [
    `${base.business[0] ?? a0(base)} commercial district`,
    `${base.business[1] ?? a1(base)} SME corridor`,
    `${hub(base)} logistics economy`,
    `${base.tourism[0] ?? lm(base)} tourism spend`,
  ];
  const culture = [
    `${base.stateName} regional cuisine belt`,
    `${a1(base)} arts quarter`,
    `${base.nightlife[0] ?? a1(base)} live-music strip`,
    `${lm(base)} heritage precinct`,
  ];
  return {
    ...base,
    festivals: [festivals[h % festivals.length]!, festivals[(h + 1) % festivals.length]!],
    economy: [economy[h % economy.length]!, economy[(h + 2) % economy.length]!],
    culture: [culture[h % culture.length]!, culture[(h + 3) % culture.length]!],
    seed: base.seed + attempt * 17,
    nearbyCity: base.nearbyCity,
  };
}

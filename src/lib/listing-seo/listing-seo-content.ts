// ==========================================
// SecretZa — Listing SEO V5 Lite: deterministic content engine
// ==========================================
// Primary generation for ADVERTISER LISTINGS. No AI dependency: titles and
// descriptions are produced from structured listing fields using the SEO V5
// philosophy — seeded variant selection + template rotation for deterministic
// per-listing uniqueness. AI (if enabled) only enhances this draft afterwards.
//
// Hard rule: NEVER invent services, pricing, guarantees, or contact details.
// Only the advertiser's own fields are interpolated.

import { humanizeSlug, normalizeKeywords } from "@/lib/ai/context";

export interface ListingSeoInput {
  /** Stable seed source for deterministic variant selection. */
  id?: string | null;
  slug?: string | null;
  /** Advertiser-entered title (used as a seed hint, not required). */
  title?: string | null;
  /** Advertiser-entered description (preserved/used as grounding). */
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  country?: string | null;
  /** Target keywords (comma string or array). */
  keywords?: string | string[] | null;
  /** Advertiser-provided services (array or comma string). */
  services?: string[] | string | null;
  /** Advertiser-provided tags (array or comma string). */
  tags?: string[] | string | null;
}

const TITLE_MIN = 50;
const TITLE_MAX = 70;
const DESC_MIN_WORDS = 150;
const DESC_MAX_WORDS = 300;

const DESCRIPTORS = [
  "Independent",
  "Premium",
  "Verified",
  "Elite",
  "Top-Rated",
  "Professional",
];

// Known acronyms that should not be Title-cased (e.g. "vip" → "VIP").
const ACRONYMS: Record<string, string> = {
  vip: "VIP",
  bdsm: "BDSM",
  gfe: "GFE",
};

function prettifyToken(word: string): string {
  const lower = word.toLowerCase();
  return ACRONYMS[lower] ?? word;
}

/** Light singularizer for category nouns ("Escorts" → "Escort"). */
function singularize(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/(ches|shes|sses|xes|zes)$/i.test(word)) return word.replace(/es$/i, "");
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.replace(/s$/i, "");
  return word;
}

/**
 * Build an adjective-first, singular offering phrase:
 *   category "escorts" + subcategory "independent"    → "Independent Escort"
 *   category "massage" + subcategory "thai"           → "Thai Massage"
 *   category "companions" + subcategory "social"      → "Social Companion"
 *   category "escorts" + subcategory "female-escorts" → "Female Escort"   (no "Escorts Escort")
 *   category "escorts" + subcategory "vip-escorts"    → "VIP Escort"
 */
function buildOfferingPhrase(category: string, subcategory: string): string {
  const catSingular = singularize(category.trim())
    .split(" ")
    .map(prettifyToken)
    .filter(Boolean)
    .join(" ")
    .trim();

  const subWords = subcategory.split(" ").map(prettifyToken).filter(Boolean);
  if (subWords.length === 0) return catSingular || "Companion";

  // Singularize the trailing word so "Female Escorts" → "Female Escort".
  const lastIdx = subWords.length - 1;
  subWords[lastIdx] = prettifyToken(singularize(subWords[lastIdx]));
  const sub = subWords.join(" ").trim();

  // If the subcategory already references the category noun (e.g. "Female
  // Escorts"), do NOT append the category again — avoids "Female Escort Escort".
  const catLast = (catSingular.split(" ").pop() ?? catSingular).toLowerCase();
  if (catLast && subWords[lastIdx].toLowerCase() === catLast) return sub;

  return catSingular ? `${sub} ${catSingular}` : sub;
}

/** Deterministic string hash (matches the SEO V5 rotation approach). */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Pick a deterministic element from a pool given a seed + salt. */
function seededPick<T>(pool: T[], seed: number, salt: number): T {
  if (pool.length === 0) throw new Error("seededPick: empty pool");
  return pool[(seed + salt) % pool.length];
}

function toList(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(",");
  return raw.map((v) => v.trim()).filter(Boolean);
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function countWords(text: string): number {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain ? plain.split(/\s+/).length : 0;
}

interface NormalizedContext {
  seed: number;
  category: string;
  subcategory: string;
  city: string;
  area: string;
  state: string;
  keywords: string[];
  services: string[];
  tags: string[];
  advertiserDescription: string;
  location: string;
  /** Adjective-first, singular offering ("Independent Escort"). */
  offering: string;
  primaryKeyword: string;
  /** Keywords beyond the first, distributed across paragraphs. */
  secondaryKeywords: string[];
}

function normalize(input: ListingSeoInput): NormalizedContext {
  const category = humanizeSlug(input.category);
  const subcategory = humanizeSlug(input.subcategory);
  const city = humanizeSlug(input.city);
  let area = humanizeSlug(input.area);
  let state = humanizeSlug(input.state);

  // De-duplicate location tokens: "Delhi, Delhi" → "Delhi", "Goa, Goa" → "Goa".
  if (state && state.toLowerCase() === city.toLowerCase()) state = "";
  if (area && area.toLowerCase() === city.toLowerCase()) area = "";
  if (area && state && area.toLowerCase() === state.toLowerCase()) area = "";

  const keywords = normalizeKeywords(input.keywords);
  const services = toList(input.services).map((s) => humanizeSlug(s) || s);
  const tags = toList(input.tags);
  const advertiserDescription = (input.description ?? "").trim();

  const seedSource =
    (input.id || input.slug || input.title || `${category}-${city}-${area}` || "listing").toString();
  const seed = hashString(seedSource);

  const location = [area, city, state].filter(Boolean).join(", ");
  const offering = buildOfferingPhrase(category, subcategory);
  const primaryKeyword = keywords[0] || "";
  const secondaryKeywords = keywords.slice(1);

  return {
    seed,
    category,
    subcategory,
    city,
    area,
    state,
    keywords,
    services,
    tags,
    advertiserDescription,
    location,
    offering,
    primaryKeyword,
    secondaryKeywords,
  };
}

// ------------------------------------------
// Title
// ------------------------------------------

function clampTitle(raw: string, ctx: NormalizedContext): string {
  let title = raw.replace(/\s+/g, " ").trim();
  const titleHas = (token: string) => title.toLowerCase().includes(token.toLowerCase());

  // Pad up to the minimum using deterministic, factual fragments — but never
  // append a fragment whose key token is already present in the title (prevents
  // "Saket, Delhi – in Delhi" / "Delhi – Delhi" duplication). `text` is what
  // gets appended; `token` is what we test for prior presence.
  const padPool: Array<{ text: string; token: string }> = [
    ctx.city ? { text: `in ${ctx.city}`, token: ctx.city } : { text: "", token: "" },
    ctx.state ? { text: ctx.state, token: ctx.state } : { text: "", token: "" },
    { text: "Verified", token: "Verified" },
    (() => {
      const d = seededPick(DESCRIPTORS, ctx.seed, 7);
      return { text: d, token: d };
    })(),
  ].filter((p) => p.text);
  let padIdx = 0;
  while (title.length < TITLE_MIN && padIdx < padPool.length) {
    const { text, token } = padPool[padIdx];
    padIdx++;
    if (titleHas(token)) continue;
    const candidate = `${title} – ${text}`;
    if (candidate.length <= TITLE_MAX) title = candidate;
  }

  // Trim down to the maximum at a word boundary.
  if (title.length > TITLE_MAX) {
    const cut = title.slice(0, TITLE_MAX);
    const lastSpace = cut.lastIndexOf(" ");
    title = (lastSpace > TITLE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return title;
}

export function generateListingTitle(input: ListingSeoInput): string {
  const ctx = normalize(input);
  // Offering is already adjective-first + singular ("Independent Escort").
  const cat = ctx.offering;
  // Avoid repeating a word already present in the offering phrase (e.g. an
  // "Independent" subcategory should not also produce an "Independent" descriptor).
  const catLower = cat.toLowerCase();
  const descriptorPool = DESCRIPTORS.filter((d) => !catLower.includes(d.toLowerCase()));
  const descriptor = seededPick(descriptorPool.length ? descriptorPool : DESCRIPTORS, ctx.seed, 1);
  const cityPart = ctx.city || "Your City";
  // Always surface Area + City together when an area is present.
  const placeA = ctx.area ? `${ctx.area}, ${cityPart}` : cityPart; // "Andheri, Mumbai"
  const placeB = ctx.area ? `${cityPart} – ${ctx.area}` : cityPart; // "Mumbai – Andheri"

  const templates: string[] = [
    `${descriptor} ${cat} in ${placeB}`,
    `${cat} in ${placeA} | ${descriptor}`,
    `${descriptor} ${cat} in ${placeA}`,
    `${cat} in ${placeB} – ${descriptor}`,
  ];

  const base = seededPick(templates, ctx.seed, 2).replace(/\s+/g, " ").trim();
  return clampTitle(base, ctx);
}

// ------------------------------------------
// Description
// ------------------------------------------

function subjectNoun(ctx: NormalizedContext): string {
  if (ctx.offering) return ctx.offering.toLowerCase();
  return "companion";
}

/** Inline a keyword clause only if the keyword is not already present. */
function primaryKeywordClause(ctx: NormalizedContext): string {
  const subj = subjectNoun(ctx);
  const kw = ctx.primaryKeyword.trim().toLowerCase();
  if (!kw || subj.includes(kw)) return "";
  const variants = [
    ` If you're searching for ${kw}, you've found the right profile.`,
    ` A great match if ${kw} is what you have in mind.`,
    ` Often sought out for ${kw}.`,
  ];
  return seededPick(variants, ctx.seed, 6);
}

function buildIntro(ctx: NormalizedContext): string {
  const subj = subjectNoun(ctx);
  const loc = ctx.location || ctx.city;
  const kw = primaryKeywordClause(ctx);

  const variants = [
    `Welcome to a refined ${subj} listing${loc ? ` in ${loc}` : ""}.${kw} Expect a warm, attentive presence and a genuinely professional approach from the very first message onward.`,
    `Looking for ${subj}${loc ? ` in ${loc}` : ""}? You're in the right place.${kw} Every meeting is handled with care, courtesy, and an easy, relaxed manner.`,
    `Meet a trusted ${subj}${loc ? ` serving ${loc}` : ""}.${kw} Genuine warmth, reliability, and a polished, professional style come as standard.`,
  ];
  return seededPick(variants, ctx.seed, 3);
}

function buildOffering(ctx: NormalizedContext): string {
  if (ctx.services.length > 0) {
    const lead = seededPick(
      [
        `Services on offer include ${joinNatural(ctx.services.slice(0, 6))}.`,
        `Available services cover ${joinNatural(ctx.services.slice(0, 6))}.`,
        `On the menu you'll find ${joinNatural(ctx.services.slice(0, 6))}.`,
      ],
      ctx.seed,
      8,
    );
    const tail = seededPick(
      [
        ` Each is tailored to what you're after, with genuine attention to your time and preferences.`,
        ` Everything is shaped around what suits you, with real care for the details.`,
        ` Each one is delivered thoughtfully, at a pace that works for you.`,
      ],
      ctx.seed,
      9,
    );
    return `${lead}${tail}`;
  }
  if (ctx.advertiserDescription) {
    // Reuse the advertiser's own words rather than inventing services.
    return ctx.advertiserDescription.replace(/\s+/g, " ").trim().slice(0, 320);
  }
  return seededPick(
    [
      `Reach out to talk through exactly what you have in mind. Everything is organised around your preferences, with no pressure at any stage.`,
      `Get in touch to share what you're looking for. Plans are arranged entirely around you, at your pace and on your terms.`,
      `Message to discuss what would suit you best. The whole experience is built around your wishes, with no surprises.`,
    ],
    ctx.seed,
    8,
  );
}

const LOCATION_LEAD_AREA = [
  (a: string, c: string, s: string) => `Conveniently based in ${a}, ${c}${s ? `, ${s}` : ""}, with easy reach across the wider area.`,
  (a: string, c: string, s: string) => `Located in ${a}, ${c}${s ? `, ${s}` : ""}, and well connected to the nearby neighbourhoods.`,
  (a: string, c: string, s: string) => `Based around ${a} in ${c}${s ? `, ${s}` : ""}, within easy reach of the surrounding districts.`,
  (a: string, c: string, s: string) => `Operating from ${a}, ${c}${s ? `, ${s}` : ""}, close to the main spots nearby.`,
];

const LOCATION_LEAD_CITY = [
  (c: string, s: string) => `Based in ${c}${s ? `, ${s}` : ""}, with flexibility across the nearby areas.`,
  (c: string, s: string) => `Located in ${c}${s ? `, ${s}` : ""} and happy to travel within the surrounding parts of town.`,
  (c: string, s: string) => `Covering ${c}${s ? `, ${s}` : ""} and the districts close by.`,
];

const LOCATION_TAIL = [
  "Setting up a time and place is kept simple and flexible.",
  "Arranging when and where to meet is straightforward and low-key.",
  "Scheduling is relaxed, with options to suit your day.",
  "Sorting out the details is easy and fits around your plans.",
];

function buildLocation(ctx: NormalizedContext): string {
  if (ctx.area && ctx.city) {
    const lead = seededPick(LOCATION_LEAD_AREA, ctx.seed, 10)(ctx.area, ctx.city, ctx.state);
    const tail = seededPick(LOCATION_TAIL, ctx.seed, 11);
    return `${lead} ${tail}`;
  }
  if (ctx.city) {
    const lead = seededPick(LOCATION_LEAD_CITY, ctx.seed, 10)(ctx.city, ctx.state);
    const tail = seededPick(LOCATION_TAIL, ctx.seed, 11);
    return `${lead} ${tail}`;
  }
  return `Flexible on location to keep meeting simple and stress-free, wherever works best for you.`;
}

const CLOSING_LEAD = [
  (c: string) => `Get in touch to arrange a relaxed, memorable meeting${c ? ` in ${c}` : ""}.`,
  (c: string) => `Send a message to check availability and plan your visit${c ? ` in ${c}` : ""}.`,
  (c: string) => `Reach out today to arrange a private meeting at a time that suits you.`,
  (c: string) => `Drop a message to start the conversation whenever you're ready.`,
];

const CLOSING_TAIL = [
  "Discretion and a genuinely good experience are always the priority.",
  "Your privacy is respected at every step.",
  "Expect honesty, punctuality, and a friendly welcome.",
  "It's all about making you feel comfortable and looked after.",
];

function buildClosing(ctx: NormalizedContext): string {
  const lead = seededPick(CLOSING_LEAD, ctx.seed, 4)(ctx.city);
  const tail = seededPick(CLOSING_TAIL, ctx.seed, 5);
  return `${lead} ${tail}`;
}

/** Natural clauses that weave a secondary keyword into a paragraph. */
function secondaryKeywordClause(kw: string, seed: number, salt: number): string {
  const variants = [
    `A popular choice for ${kw}.`,
    `Frequently sought for ${kw}.`,
    `A great match for ${kw}.`,
    `Highly rated for ${kw}.`,
  ];
  return seededPick(variants, seed, salt);
}

/**
 * Distribute remaining keywords across paragraphs (services → location →
 * closing → intro), skipping any keyword already present. The primary keyword
 * is handled separately inside the intro.
 */
function weaveSecondaryKeywords(paragraphs: string[], ctx: NormalizedContext): string[] {
  if (ctx.secondaryKeywords.length === 0) return paragraphs;
  const result = [...paragraphs];
  const slots = [1, 2, 3, 0];
  ctx.secondaryKeywords.forEach((kw, k) => {
    const kwl = kw.trim().toLowerCase();
    if (!kwl) return;
    if (result.join(" ").toLowerCase().includes(kwl)) return; // already present
    const slot = slots[k % slots.length] % result.length;
    const clause = secondaryKeywordClause(kwl, ctx.seed, 12 + k);
    result[slot] = `${result[slot]} ${clause}`.trim();
  });
  return result;
}

// Safe, platform-true filler sentences (facts about the platform, NOT invented
// services) used only to reach the minimum word target. Expanded to 20+ so
// seeded rotation keeps cross-listing repetition low.
const FILLER_POOL = [
  "All profiles on SecretZa go through verification and active moderation for your peace of mind.",
  "Communication stays private, and messages are only ever seen by you.",
  "Honest reviews and verified photos help you choose with confidence.",
  "Expect clear communication and a genuinely friendly approach throughout.",
  "Your safety and satisfaction are taken seriously at every step.",
  "Browsing, messaging, and arranging a meeting are simple and secure on the platform.",
  "Every detail is handled thoughtfully so you can simply relax.",
  "Quality, authenticity, and trust sit at the heart of every listing here.",
  "Listings are kept up to date so what you see is what you get.",
  "Punctuality and a respectful manner are part of the standard.",
  "There's no rush — take your time to find the right fit.",
  "Real photos and accurate details mean fewer surprises.",
  "A calm, professional approach makes the whole thing easy.",
  "Genuine attention and a warm welcome are always on offer.",
  "Everything is handled with maturity and good judgement.",
  "Flexibility and clear planning make arranging a visit painless.",
  "A friendly first message is the best way to get started.",
  "Reliability and good manners go a long way, and you'll find both here.",
  "Comfort and ease are the focus from the first hello.",
  "Discreet, secure messaging keeps your details to yourself.",
  "Expect a relaxed pace and zero pressure at any point.",
  "Care, courtesy, and consistency are what set this profile apart.",
];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Deterministic, fully-distinct sample of filler sentences. Uses a stride that
 * is coprime with the pool length so the walk is a full-cycle permutation
 * (every sentence is reachable before any repeat), seeded per listing so
 * different listings draw different sentences in a different order.
 */
function seededFillers(seed: number, count: number): string[] {
  const len = FILLER_POOL.length;
  const coprime: number[] = [];
  for (let s = 1; s < len; s++) {
    if (gcd(s, len) === 1) coprime.push(s);
  }
  const stride = coprime.length ? coprime[seed % coprime.length] : 1;
  const start = seed % len;
  const out: string[] = [];
  for (let k = 0; k < Math.min(count, len); k++) {
    out.push(FILLER_POOL[(start + k * stride) % len]);
  }
  return out;
}

function padToMinWords(paragraphs: string[], ctx: NormalizedContext): string[] {
  const result = [...paragraphs];
  // Distribute distinct, seeded filler across paragraphs to keep flow natural
  // and cross-listing repetition low.
  const targets = [1, 2, 0, 3];
  const fillers = seededFillers(ctx.seed, FILLER_POOL.length);
  let i = 0;
  while (countWords(result.join("\n\n")) < DESC_MIN_WORDS && i < fillers.length) {
    const idx = targets[i % targets.length] % result.length;
    result[idx] = `${result[idx]} ${fillers[i]}`.trim();
    i++;
  }
  return result;
}

function trimToMaxWords(text: string): string {
  const words = text.replace(/\s+/g, " ").trim().split(/\s+/);
  if (words.length <= DESC_MAX_WORDS) return text;
  // Trim whole paragraphs from the end until within budget.
  const paras = text.split(/\n\n+/);
  while (paras.length > 2 && countWords(paras.join("\n\n")) > DESC_MAX_WORDS) {
    paras.pop();
  }
  let joined = paras.join("\n\n");
  if (countWords(joined) > DESC_MAX_WORDS) {
    joined = joined.split(/\s+/).slice(0, DESC_MAX_WORDS).join(" ");
  }
  return joined;
}

export function generateListingDescription(input: ListingSeoInput): string {
  const ctx = normalize(input);
  let paragraphs = [
    buildIntro(ctx),
    buildOffering(ctx),
    buildLocation(ctx),
    buildClosing(ctx),
  ].map((p) => p.replace(/\s+/g, " ").trim());

  paragraphs = weaveSecondaryKeywords(paragraphs, ctx);

  const padded = padToMinWords(paragraphs, ctx);
  return trimToMaxWords(padded.join("\n\n"));
}

// ------------------------------------------
// Improve (deterministic readability normalizer)
// ------------------------------------------

export function improveListingDescription(
  content: string,
  input?: ListingSeoInput,
): string {
  const trimmed = (content ?? "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    // Nothing to improve — fall back to a fresh draft if context is available.
    return input ? generateListingDescription(input) : "";
  }

  // Normalize whitespace, collapse 3+ newlines, ensure sentence spacing.
  let text = trimmed
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])([A-Z])/g, "$1 $2")
    .trim();

  // If it reads as one block, split into readable paragraphs (~2 sentences each).
  if (!text.includes("\n\n")) {
    const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
    const chunks: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" "));
    }
    text = chunks.join("\n\n");
  }

  // Expand thin content toward the minimum using safe, seeded platform filler.
  if (input && countWords(text) < DESC_MIN_WORDS) {
    const ctx = normalize(input);
    const paras = text.split(/\n\n+/);
    const fillers = seededFillers(ctx.seed, FILLER_POOL.length);
    let i = 0;
    while (countWords(paras.join("\n\n")) < DESC_MIN_WORDS && i < fillers.length) {
      paras[paras.length - 1] = `${paras[paras.length - 1]} ${fillers[i]}`.trim();
      i++;
    }
    text = paras.join("\n\n");
  }

  return trimToMaxWords(text);
}

export const LISTING_SEO_LIMITS = {
  TITLE_MIN,
  TITLE_MAX,
  DESC_MIN_WORDS,
  DESC_MAX_WORDS,
} as const;

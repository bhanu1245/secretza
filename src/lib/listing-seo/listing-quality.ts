// ==========================================
// SecretZa — Listing SEO V5 Lite: scoring
// ==========================================
// Listing-specific quality score (0–100). Reuses the canonical primitives from
// seo-quality.ts (word count, normalization, similarity, composite uniqueness,
// duplicate risk) but with LISTING weights. Deliberately excludes FAQ scoring,
// internal-link scoring, canonical scoring, and the 500-word page target.

import {
  countWords,
  normalizeForComparison,
  computeCompositeUniqueness,
  computeDuplicateRisk,
  type DuplicateRisk,
} from "@/lib/seo-quality";
import { normalizeKeywords } from "@/lib/ai/context";
import { LISTING_SEO_LIMITS } from "@/lib/listing-seo/listing-seo-content";

const { DESC_MIN_WORDS, DESC_MAX_WORDS, TITLE_MIN, TITLE_MAX } = LISTING_SEO_LIMITS;

export interface ListingContactInput {
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  email?: string | null;
}

export interface ListingScoreInput {
  title?: string | null;
  description?: string | null;
  keywords?: string | string[] | null;
  imageCount?: number;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  contacts?: ListingContactInput;
  /** Sibling listings (title + description) for uniqueness. */
  peers?: Array<{ title: string; description: string }>;
}

export interface ListingScoreBreakdown {
  titleQuality: number;
  descriptionQuality: number;
  keywordCoverage: number;
  readability: number;
  images: number;
  locationCompleteness: number;
  contactCompleteness: number;
  uniqueness: number;
}

export interface ListingQualityResult {
  total: number;
  breakdown: ListingScoreBreakdown;
  wordCount: number;
  uniquenessScore: number;
  duplicateRisk: DuplicateRisk;
  meetsMinWords: boolean;
}

export const LISTING_SCORE_WEIGHTS = {
  titleQuality: 12,
  descriptionQuality: 18,
  keywordCoverage: 12,
  readability: 8,
  images: 10,
  locationCompleteness: 10,
  contactCompleteness: 10,
  // Uniqueness carries more weight so near-duplicate listings can no longer
  // score in the high 90s (audit finding: duplication was barely penalised).
  uniqueness: 20,
} as const;

// Total points deducted from the final score by duplicate risk. Applied on top
// of the (already lower) uniqueness sub-score so genuine duplicates are clearly
// flagged in the headline number.
const DUPLICATE_RISK_PENALTY: Record<DuplicateRisk, number> = {
  high: 12,
  medium: 6,
  low: 0,
};

const CONTACT_RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  telegram: /^@?[A-Za-z0-9_]{4,}$/,
};

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

/** All sub-scorers return a 0..1 fraction; weights are applied centrally. */
function scoreTitleFrac(title: string): number {
  const t = title.trim();
  if (!t) return 0;
  const len = t.length;
  let lenScore: number;
  if (len >= TITLE_MIN && len <= TITLE_MAX) lenScore = 1;
  else if (len >= 40 && len <= 80) lenScore = 0.7;
  else if (len >= 25) lenScore = 0.45;
  else lenScore = 0.2;

  const words = countWords(t);
  const wordScore = words >= 4 ? 1 : words >= 2 ? 0.5 : 0;
  const caseScore = isAllCaps(t) ? 0 : 1;
  return lenScore * 0.5 + wordScore * 0.2 + caseScore * 0.3;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function scoreDescriptionFrac(description: string): { frac: number; words: number } {
  const words = countWords(description);
  let wordFrac: number;
  if (words >= DESC_MIN_WORDS && words <= DESC_MAX_WORDS) wordFrac = 1;
  else if (words > DESC_MAX_WORDS) wordFrac = 0.85;
  else if (words >= 100) wordFrac = 0.7;
  else wordFrac = (words / DESC_MIN_WORDS) * 0.55;

  const paras = splitParagraphs(description).length;
  const paraFrac = paras >= 2 && paras <= 4 ? 1 : paras === 1 ? 0.33 : paras > 4 ? 0.66 : 0;

  return { frac: Math.min(1, wordFrac * 0.7 + paraFrac * 0.3), words };
}

function scoreKeywordCoverageFrac(
  keywords: string[],
  title: string,
  description: string,
): number {
  if (keywords.length === 0) return 0.66; // neutral when none provided
  const haystack = normalizeForComparison(`${title} ${description}`);
  let matched = 0;
  for (const kw of keywords) {
    const needle = normalizeForComparison(kw);
    if (needle && haystack.includes(needle)) matched++;
  }
  return matched / keywords.length;
}

function scoreReadabilityFrac(description: string): number {
  const words = countWords(description);
  if (words === 0) return 0;
  const sentences = description.match(/[^.!?]+[.!?]+/g)?.length ?? 1;
  const avg = words / Math.max(1, sentences);
  if (avg >= 8 && avg <= 22) return 1;
  if (avg > 22 && avg <= 30) return 0.7;
  if (avg < 8 && avg >= 5) return 0.6;
  return 0.4;
}

function scoreImagesFrac(imageCount: number): number {
  return Math.min(imageCount / 3, 1);
}

function scoreLocationFrac(city: string, area: string, state: string): number {
  let s = 0;
  if (city.trim()) s += 0.4;
  if (area.trim()) s += 0.3;
  if (state.trim()) s += 0.3;
  return s;
}

function countValidContacts(contacts: ListingContactInput): number {
  let n = 0;
  const phone = (contacts.phone ?? "").replace(/\D/g, "");
  const whatsapp = (contacts.whatsapp ?? "").replace(/\D/g, "");
  if (phone.length >= 8 && phone.length <= 15) n++;
  if (whatsapp.length >= 8 && whatsapp.length <= 15) n++;
  if (CONTACT_RE.telegram.test((contacts.telegram ?? "").trim())) n++;
  if (CONTACT_RE.email.test((contacts.email ?? "").trim())) n++;
  return n;
}

function scoreContactFrac(contacts: ListingContactInput): number {
  const channels = countValidContacts(contacts);
  return Math.min(channels / 2, 1);
}

export function computeListingQuality(input: ListingScoreInput): ListingQualityResult {
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const keywords = normalizeKeywords(input.keywords);
  const city = (input.city ?? "").trim();
  const area = (input.area ?? "").trim();
  const state = (input.state ?? "").trim();
  const contacts = input.contacts ?? {};
  const peers = input.peers ?? [];

  const desc = scoreDescriptionFrac(description);

  // Uniqueness via the canonical composite engine (reused).
  const breakdown = computeCompositeUniqueness({
    introContent: description,
    faqText: "",
    title,
    metaDescription: "",
    peerIntros: peers.map((p) => p.description).filter(Boolean),
    peerFaqs: [],
    peerTitles: peers.map((p) => p.title).filter(Boolean),
    peerMetas: [],
  });
  const uniquenessScore = breakdown.overall;
  const duplicateRisk = computeDuplicateRisk(
    uniquenessScore,
    { title: false, metaDescription: false, h1: false, introContent: false, faqContent: false },
    breakdown.maxIntroSimilarity,
  );

  const W = LISTING_SCORE_WEIGHTS;
  const b: ListingScoreBreakdown = {
    titleQuality: Math.round(scoreTitleFrac(title) * W.titleQuality),
    descriptionQuality: Math.round(desc.frac * W.descriptionQuality),
    keywordCoverage: Math.round(scoreKeywordCoverageFrac(keywords, title, description) * W.keywordCoverage),
    readability: Math.round(scoreReadabilityFrac(description) * W.readability),
    images: Math.round(scoreImagesFrac(input.imageCount ?? 0) * W.images),
    locationCompleteness: Math.round(scoreLocationFrac(city, area, state) * W.locationCompleteness),
    contactCompleteness: Math.round(scoreContactFrac(contacts) * W.contactCompleteness),
    uniqueness: Math.round((uniquenessScore / 100) * W.uniqueness),
  };

  const rawTotal =
    b.titleQuality +
    b.descriptionQuality +
    b.keywordCoverage +
    b.readability +
    b.images +
    b.locationCompleteness +
    b.contactCompleteness +
    b.uniqueness;

  // Duplicate-risk penalty applied to the headline score (not the breakdown).
  const total = Math.max(0, Math.min(100, rawTotal - DUPLICATE_RISK_PENALTY[duplicateRisk]));

  return {
    total,
    breakdown: b,
    wordCount: desc.words,
    uniquenessScore,
    duplicateRisk,
    meetsMinWords: desc.words >= DESC_MIN_WORDS,
  };
}

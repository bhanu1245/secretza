// ==========================================
// SecretZa — AI Context Builder (shared)
// ==========================================
// One place that turns raw form/page fields into a normalized, human-readable
// context used by every AI prompt. Reused by listing tools and the admin SEO
// editor so context assembly never gets duplicated.

/** Humanize a slug ("business-traveler" → "Business Traveler"). */
export function humanizeSlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export interface SeoContextInput {
  /** The advertiser's listing title or the SEO page's working title. */
  listingTitle?: string | null;
  category?: string | null;
  subcategory?: string | null;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  country?: string | null;
  /** Existing description/intro copy (used by the improver and for grounding). */
  description?: string | null;
  /** SEO page type for admin pages (city, category, category_city, ...). */
  pageType?: string | null;
  /** Advertiser target keywords (comma-separated string or array). */
  keywords?: string | string[] | null;
}

export interface SeoContext {
  listingTitle: string;
  category: string;
  subcategory: string;
  city: string;
  area: string;
  state: string;
  country: string;
  description: string;
  pageType: string;
  /** Cleaned, de-duplicated target keywords. */
  keywords: string[];
  /** A compact human sentence describing the subject, for prompt grounding. */
  summary: string;
  /** A richer, listing-oriented phrase (category › subcategory in area, city). */
  listingSummary: string;
}

/** Normalize a comma/array keyword input into a clean, de-duplicated list. */
export function normalizeKeywords(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : input.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const cleaned = entry.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Normalize raw inputs (slugs or names) into a clean context object plus a
 * one-line summary string for prompt grounding. Accepts slugs and humanizes
 * them so callers don't need name lookups.
 */
export function buildSeoContext(input: SeoContextInput): SeoContext {
  const listingTitle = (input.listingTitle ?? "").trim();
  const category = humanizeSlug(input.category);
  const subcategory = humanizeSlug(input.subcategory);
  const city = humanizeSlug(input.city);
  const area = humanizeSlug(input.area);
  const state = humanizeSlug(input.state);
  const country = humanizeSlug(input.country);
  const description = (input.description ?? "").trim();
  const pageType = (input.pageType ?? "").trim();
  const keywords = normalizeKeywords(input.keywords);

  const location = [city, state, country].filter(Boolean).join(", ");
  const parts: string[] = [];
  if (category) parts.push(category);
  if (location) parts.push(`in ${location}`);
  const summary =
    parts.length > 0
      ? `A ${parts.join(" ")} listing${listingTitle ? ` titled "${listingTitle}"` : ""}.`
      : listingTitle
        ? `A listing titled "${listingTitle}".`
        : "An adult classifieds listing.";

  // Richer, listing-oriented phrasing used by the listing AI prompts.
  const offering = [category, subcategory].filter(Boolean).join(" \u203A ");
  const listingLocation = [area, city, state, country].filter(Boolean).join(", ");
  const listingSummary =
    offering && listingLocation
      ? `${offering} in ${listingLocation}`
      : offering || listingLocation || (listingTitle ? `Listing "${listingTitle}"` : "An adult classifieds listing");

  return {
    listingTitle,
    category,
    subcategory,
    city,
    area,
    state,
    country,
    description,
    pageType,
    keywords,
    summary,
    listingSummary,
  };
}

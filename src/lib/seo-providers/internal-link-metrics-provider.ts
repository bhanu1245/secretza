/**
 * InternalLinkMetricsProvider
 *
 * Purpose:
 *   Measures objective internal-link characteristics of a page.
 *   Measurement only — no scoring, no thresholds, no quality judgments.
 *
 * Owned QualityMetrics fields:
 *   internalLinkCount, externalLinkCount, followLinkCount, nofollowLinkCount,
 *   anchorTextCount, uniqueAnchorTextCount, duplicateAnchorTextCount,
 *   averageAnchorLength, longestAnchorLength, shortestAnchorLength,
 *   emptyAnchorCount, samePageAnchorCount, relativeLinkCount,
 *   absoluteInternalLinkCount, externalHttpLinkCount, mailtoLinkCount,
 *   telLinkCount, categoryLinkCount, cityLinkCount, listingLinkCount,
 *   faqInternalLinkCount, ctaInternalLinkCount, sectionLinkDistribution,
 *   firstLinkPosition, lastLinkPosition, linkSpread, linkDensity,
 *   uniqueTargetCount, duplicateTargetCount, anchorKeywordCoverage,
 *   descriptiveAnchorCount, genericAnchorCount, imageLinkCount
 *
 * Execution order: 6 (wave 1 — no provider dependencies)
 *
 * Classification strategy:
 *   All classification is deterministic, based on href prefix and path patterns.
 *   No network calls, no DB queries, no AI.
 *
 * Performance:
 *   Single-pass over internalLinks array.
 *   O(n) time, O(n) space (for dedup Maps).
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
  InternalLink,
} from "@/lib/seo-quality-types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Anchor texts treated as generic / non-descriptive */
const GENERIC_ANCHOR_PHRASES = new Set([
  "click here",
  "here",
  "read more",
  "more",
  "learn more",
  "view more",
  "see more",
  "this",
  "link",
  "visit",
  "go",
  "continue",
  "next",
  "prev",
  "previous",
  "back",
  "home",
  "page",
]);

/** Anchor texts that are CTA-style (superset of generic for link-intent detection) */
const CTA_ANCHOR_PHRASES = [
  "click here",
  "read more",
  "learn more",
  "contact us",
  "call us",
  "book now",
  "visit us",
  "get in touch",
  "book your",
  "enquire now",
  "enquire",
  "inquire",
  "whatsapp",
  "message us",
  "sign up",
  "register",
  "reserve",
  "view more",
  "see more",
];

/** Number of equal-index sections for sectionLinkDistribution */
const SECTION_COUNT = 5;

// ─── URL classification ───────────────────────────────────────────────────────

export function classifyHref(href: string): {
  isSamePage: boolean;
  isRelative: boolean;
  isAbsoluteInternal: boolean; // absolute URL in the internalLinks list
  isMailto: boolean;
  isTel: boolean;
  isCategory: boolean;
  isCity: boolean;
  isListing: boolean;
  isFaq: boolean;
} {
  const h = (href ?? "").trim();
  const lower = h.toLowerCase();

  if (lower.startsWith("#")) {
    return {
      isSamePage: true,
      isRelative: false,
      isAbsoluteInternal: false,
      isMailto: false,
      isTel: false,
      isCategory: false,
      isCity: false,
      isListing: false,
      isFaq: false,
    };
  }

  if (lower.startsWith("mailto:")) {
    return {
      isSamePage: false,
      isRelative: false,
      isAbsoluteInternal: false,
      isMailto: true,
      isTel: false,
      isCategory: false,
      isCity: false,
      isListing: false,
      isFaq: false,
    };
  }

  if (lower.startsWith("tel:")) {
    return {
      isSamePage: false,
      isRelative: false,
      isAbsoluteInternal: false,
      isMailto: false,
      isTel: true,
      isCategory: false,
      isCity: false,
      isListing: false,
      isFaq: false,
    };
  }

  // Absolute URL (http/https): treat as absolute internal since it's in the internalLinks list
  const isAbsoluteInternal = lower.startsWith("http://") || lower.startsWith("https://");

  // Protocol-relative //: classify as relative-ish, not caught above
  const isRelative = lower.startsWith("/") && !lower.startsWith("//") && !isAbsoluteInternal;

  // Path-based classification (works on both relative and absolute URLs)
  // Extract just the pathname portion
  const path = isAbsoluteInternal ? extractPathname(lower) : lower;

  const isCategory = /\/categor(?:y|ies)\/|\/cat\//.test(path);
  const isCity     = /\/cit(?:y|ies)\/|\/location\//.test(path);
  const isListing  = /\/listings?\/|\/profiles?\/|\/escorts?\//.test(path);
  const isFaq      = /\/faq/.test(path);

  return {
    isSamePage: false,
    isRelative,
    isAbsoluteInternal,
    isMailto: false,
    isTel: false,
    isCategory,
    isCity,
    isListing,
    isFaq,
  };
}

/** Extract just the pathname from an absolute URL, ignoring query/hash. */
function extractPathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    // Malformed absolute URL — use the raw string
    const m = url.match(/^https?:\/\/[^/]*(\/[^?#]*)/);
    return m ? m[1]! : url;
  }
}

// ─── Anchor analysis ──────────────────────────────────────────────────────────

/** Normalise anchor text for dedup and classification. */
export function normaliseAnchor(anchor: string): string {
  return anchor.toLowerCase().replace(/\s+/g, " ").trim();
}

/** True if the normalised anchor matches a generic phrase exactly. */
export function isGenericAnchor(normAnchor: string): boolean {
  return GENERIC_ANCHOR_PHRASES.has(normAnchor);
}

/** True if the normalised anchor contains a CTA phrase (substring match). */
export function isCtaAnchor(normAnchor: string): boolean {
  return CTA_ANCHOR_PHRASES.some((p) => normAnchor.includes(p));
}

/** True if the anchor (normalised) contains the primary keyword (whole-word, case-insensitive). */
export function anchorContainsKeyword(
  normAnchor: string,
  primaryKeyword: string | null,
): boolean {
  if (!primaryKeyword) return false;
  const escaped = primaryKeyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  return pattern.test(normAnchor);
}

/** True if the InternalLink's rel attribute contains "nofollow". */
export function isNofollow(link: InternalLink): boolean {
  if (!link.rel) return false;
  return link.rel.toLowerCase().split(/[\s,]+/).includes("nofollow");
}

// ─── FAQ anchor detection ─────────────────────────────────────────────────────

function isFaqAnchor(normAnchor: string): boolean {
  return normAnchor.includes("faq") || normAnchor.includes("frequently asked");
}

// ─── Word count helper ────────────────────────────────────────────────────────

function roughWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Rounding helpers ─────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "internalLinkCount",
  "externalLinkCount",
  "followLinkCount",
  "nofollowLinkCount",
  "anchorTextCount",
  "uniqueAnchorTextCount",
  "duplicateAnchorTextCount",
  "averageAnchorLength",
  "longestAnchorLength",
  "shortestAnchorLength",
  "emptyAnchorCount",
  "samePageAnchorCount",
  "relativeLinkCount",
  "absoluteInternalLinkCount",
  "externalHttpLinkCount",
  "mailtoLinkCount",
  "telLinkCount",
  "categoryLinkCount",
  "cityLinkCount",
  "listingLinkCount",
  "faqInternalLinkCount",
  "ctaInternalLinkCount",
  "sectionLinkDistribution",
  "firstLinkPosition",
  "lastLinkPosition",
  "linkSpread",
  "linkDensity",
  "uniqueTargetCount",
  "duplicateTargetCount",
  "anchorKeywordCoverage",
  "descriptiveAnchorCount",
  "genericAnchorCount",
  "imageLinkCount",
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class InternalLinkMetricsProvider implements MetricsProvider {
  readonly id             = "internal-link-metrics";
  readonly name           = "Internal Link Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 6;
  readonly dependencies: string[] = [];
  readonly estimatedCost: EstimatedCost = "fast";
  readonly cacheStrategy  = CACHE_STRATEGY_NONE;
  readonly outputFields   = OUTPUT_FIELDS;

  provide(
    input: MetricsCollectorInput,
    _priorMetrics: Partial<QualityMetrics>,
  ): Partial<QualityMetrics> {
    return measure(input);
  }
}

/**
 * Pure measurement function — separated from the class for direct testability.
 */
export function measure(input: MetricsCollectorInput): Partial<QualityMetrics> {
  const { internalLinks, primaryKeyword, introContent } = input;
  const n = internalLinks.length;

  // ── Page word count for linkDensity ──────────────────────────────────────
  const pageWords = roughWordCount(introContent ?? "");

  // ── Empty list fast path ──────────────────────────────────────────────────
  if (n === 0) {
    return {
      internalLinkCount:       0,
      externalLinkCount:       0,
      followLinkCount:         0,
      nofollowLinkCount:       0,
      anchorTextCount:         0,
      uniqueAnchorTextCount:   0,
      duplicateAnchorTextCount: 0,
      averageAnchorLength:     0,
      longestAnchorLength:     0,
      shortestAnchorLength:    0,
      emptyAnchorCount:        0,
      samePageAnchorCount:     0,
      relativeLinkCount:       0,
      absoluteInternalLinkCount: 0,
      externalHttpLinkCount:   0,
      mailtoLinkCount:         0,
      telLinkCount:            0,
      categoryLinkCount:       0,
      cityLinkCount:           0,
      listingLinkCount:        0,
      faqInternalLinkCount:    0,
      ctaInternalLinkCount:    0,
      sectionLinkDistribution: 0,
      firstLinkPosition:       -1,
      lastLinkPosition:        -1,
      linkSpread:              0,
      linkDensity:             0,
      uniqueTargetCount:       0,
      duplicateTargetCount:    0,
      anchorKeywordCoverage:   0,
      descriptiveAnchorCount:  0,
      genericAnchorCount:      0,
      imageLinkCount:          0,
    };
  }

  // ── Accumulators ─────────────────────────────────────────────────────────
  let followCount       = 0;
  let nofollowCount     = 0;
  let anchorTextCount   = 0; // non-empty anchors
  let emptyAnchorCount  = 0;
  let totalAnchorLen    = 0;
  let maxAnchorLen      = 0;
  let minAnchorLen      = Infinity;

  let samePageCount     = 0;
  let relativeCount     = 0;
  let absoluteIntCount  = 0;
  let mailtoCount       = 0;
  let telCount          = 0;
  let categoryCount     = 0;
  let cityCount         = 0;
  let listingCount      = 0;
  let faqLinkCount      = 0;
  let ctaAnchorCount    = 0;
  let genericCount      = 0;
  let descriptiveCount  = 0;
  let imageLinkCount    = 0;
  let kwAnchorCount     = 0; // anchors containing primary keyword

  // Dedup structures
  const seenAnchors = new Map<string, number>();   // normAnchor → count
  const seenTargets = new Map<string, number>();   // normHref → count

  // Section tracking (divide link indices into SECTION_COUNT buckets)
  const sectionsWithLinks = new Set<number>();

  // ── Single-pass ───────────────────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const link   = internalLinks[i]!;
    const anchor = (link.anchor ?? "").trim();
    const href   = (link.href   ?? "").trim();
    const norm   = normaliseAnchor(anchor);
    const normHref = href.toLowerCase();

    // Follow / nofollow
    if (isNofollow(link)) {
      nofollowCount++;
    } else {
      followCount++;
    }

    // Anchor text
    if (!norm) {
      emptyAnchorCount++;
      imageLinkCount++; // empty anchor = likely image or icon link
    } else {
      anchorTextCount++;
      totalAnchorLen += anchor.length;
      if (anchor.length > maxAnchorLen) maxAnchorLen = anchor.length;
      if (anchor.length < minAnchorLen) minAnchorLen = anchor.length;

      // Generic / descriptive / CTA / keyword
      if (isGenericAnchor(norm)) {
        genericCount++;
      } else {
        descriptiveCount++;
      }
      if (isCtaAnchor(norm)) ctaAnchorCount++;
      if (anchorContainsKeyword(norm, primaryKeyword)) kwAnchorCount++;

      // FAQ via anchor
      if (isFaqAnchor(norm)) faqLinkCount++;
    }

    // Anchor dedup
    seenAnchors.set(norm, (seenAnchors.get(norm) ?? 0) + 1);

    // Target dedup
    seenTargets.set(normHref, (seenTargets.get(normHref) ?? 0) + 1);

    // URL classification
    const cls = classifyHref(href);
    if (cls.isSamePage)          samePageCount++;
    if (cls.isRelative)          relativeCount++;
    if (cls.isAbsoluteInternal)  absoluteIntCount++;
    if (cls.isMailto)            mailtoCount++;
    if (cls.isTel)               telCount++;
    if (cls.isCategory)          categoryCount++;
    if (cls.isCity)              cityCount++;
    if (cls.isListing)           listingCount++;
    if (cls.isFaq)               faqLinkCount++; // may also be counted via anchor above

    // Section distribution (map index to one of SECTION_COUNT buckets)
    const bucket = Math.min(Math.floor((i / n) * SECTION_COUNT), SECTION_COUNT - 1);
    sectionsWithLinks.add(bucket);
  }

  // Clamp min anchor length
  if (!isFinite(minAnchorLen)) minAnchorLen = 0;

  // Dedup tallies
  let dupAnchorCount  = 0;
  for (const count of seenAnchors.values()) {
    if (count > 1) dupAnchorCount++;
  }
  let uniqueTargetCount    = 0;
  let duplicateTargetCount = 0;
  for (const count of seenTargets.values()) {
    if (count === 1) uniqueTargetCount++;
    else             duplicateTargetCount++;
  }

  // Unique anchor texts (exclude empty-anchor slot which is always "")
  const uniqueAnchors = Array.from(seenAnchors.keys()).filter((k) => k !== "");
  const uniqueAnchorTextCount = uniqueAnchors.length;

  // Keyword coverage over non-empty anchors
  const anchorKeywordCoverage = anchorTextCount > 0
    ? round4(kwAnchorCount / anchorTextCount)
    : 0;

  // Section distribution
  const sectionLinkDistribution = round4(sectionsWithLinks.size / SECTION_COUNT);

  // Position
  const firstLinkPosition = 0;
  const lastLinkPosition  = n - 1;
  const linkSpread        = n > 1 ? round4((lastLinkPosition - firstLinkPosition) / (n - 1)) : 0;

  // Link density per 100 words
  const linkDensity = pageWords > 0 ? round4((n / pageWords) * 100) : 0;

  return {
    internalLinkCount:         n,
    externalLinkCount:         0, // not available in internalLinks input
    followLinkCount:           followCount,
    nofollowLinkCount:         nofollowCount,
    anchorTextCount,
    uniqueAnchorTextCount,
    duplicateAnchorTextCount:  dupAnchorCount,
    averageAnchorLength:       anchorTextCount > 0 ? round2(totalAnchorLen / anchorTextCount) : 0,
    longestAnchorLength:       maxAnchorLen,
    shortestAnchorLength:      minAnchorLen,
    emptyAnchorCount,
    samePageAnchorCount:       samePageCount,
    relativeLinkCount:         relativeCount,
    absoluteInternalLinkCount: absoluteIntCount,
    externalHttpLinkCount:     0, // not available from internalLinks alone
    mailtoLinkCount:           mailtoCount,
    telLinkCount:              telCount,
    categoryLinkCount:         categoryCount,
    cityLinkCount:             cityCount,
    listingLinkCount:          listingCount,
    faqInternalLinkCount:      faqLinkCount,
    ctaInternalLinkCount:      ctaAnchorCount,
    sectionLinkDistribution,
    firstLinkPosition,
    lastLinkPosition,
    linkSpread,
    linkDensity,
    uniqueTargetCount,
    duplicateTargetCount,
    anchorKeywordCoverage,
    descriptiveAnchorCount:    descriptiveCount,
    genericAnchorCount:        genericCount,
    imageLinkCount,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const internalLinkMetricsProvider = new InternalLinkMetricsProvider();

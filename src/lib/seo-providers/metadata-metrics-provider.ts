/**
 * MetadataMetricsProvider
 *
 * Purpose:
 *   Measures objective metadata characteristics of a page.
 *   This provider performs measurement only — no scoring, no thresholds,
 *   no quality decisions, no recommendations.
 *
 * Owned QualityMetrics fields:
 *   titlePresent, titleLength, estimatedTitlePixelWidth,
 *   metaPresent, metaLength, metaDescriptionPixelWidth,
 *   h1Present, h1Count, h1EqualsTitle,
 *   canonicalPresent,
 *   featuredImagePresent, imageAltPresent,
 *   robotsMetaExists, robotsMetaContent, robotsNoindex, robotsNofollow,
 *   openGraphExists, openGraphPropertyCount,
 *   twitterCardExists, twitterMetaCount,
 *   structuredDataPresent, structuredDataParseable, jsonLdCount, schemaTypeList,
 *   breadcrumbSchemaExists, organizationSchemaExists, websiteSchemaExists,
 *   faqSchemaExists, articleSchemaExists,
 *   hreflangExists, hreflangCount, alternateLinkCount,
 *   viewportMetaExists, charsetMetaExists, faviconExists, manifestExists
 *
 * Execution order: 3 (wave 1 — no provider dependencies)
 *
 * Parsing strategy:
 *   All measurements derive from scalar fields already present on
 *   MetricsCollectorInput. JSON-LD is parsed once; all schema-type checks
 *   are done in a single pass over the resulting array. O(n) overall.
 *
 * Thread safety:
 *   All methods are pure functions; the class holds no mutable state.
 *
 * Extension points:
 *   - Add a new schema-type boolean by appending to SCHEMA_TYPE_FLAGS.
 *   - Add new QualityMetrics fields and compute them in measure().
 *   - No changes to the engine or other providers required.
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
} from "@/lib/seo-quality-types";

// ─── Pixel-width estimation ───────────────────────────────────────────────────

/**
 * Approximate rendered pixel width of a string at a given font size.
 *
 * Uses three character-width buckets calibrated against common browser
 * defaults (Arial/sans-serif at 16 px):
 *   narrow  (i l ! | . , ; : ' " ` f t j r 1)  ≈ 4.5 px / char
 *   wide    (m w M W)                             ≈ 11 px / char
 *   normal  (everything else)                     ≈ 7.5 px / char
 *
 * Accuracy: ±10–15 % of actual browser rendering — sufficient for
 * detecting titles near SERP truncation boundaries (~600 px).
 */
const NARROW_CHARS = new Set("ilIL!|.,;:'\"` ftjr1");
const WIDE_CHARS   = new Set("mwMW");

const NARROW_PX = 4.5;
const WIDE_PX   = 11;
const NORMAL_PX = 7.5;

export function estimatePixelWidth(text: string, fontSizePx = 16): number {
  let width = 0;
  for (const ch of text) {
    if (NARROW_CHARS.has(ch))     width += NARROW_PX;
    else if (WIDE_CHARS.has(ch))  width += WIDE_PX;
    else                          width += NORMAL_PX;
  }
  return Math.round(width * (fontSizePx / 16));
}

// ─── JSON-LD parsing ──────────────────────────────────────────────────────────

/**
 * Parsed representation of one JSON-LD block.
 * We only care about @type for schema detection.
 */
interface JsonLdBlock {
  "@type"?: string | string[];
  [key: string]: unknown;
}

/**
 * Parse the structured data string into an array of JSON-LD blocks.
 * Handles:
 *   - single JSON object:  { "@type": "FAQPage", ... }
 *   - top-level array:     [ { "@type": "FAQPage" }, ... ]
 *   - @graph wrapper:      { "@graph": [ ... ] }
 *   - malformed JSON:      returns empty array (parseable = false)
 */
export function parseJsonLd(raw: string | null): {
  blocks: JsonLdBlock[];
  parseable: boolean;
} {
  if (!raw || !raw.trim()) return { blocks: [], parseable: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { blocks: [], parseable: false };
  }

  // Normalise to array of blocks
  let blocks: JsonLdBlock[] = [];
  if (Array.isArray(parsed)) {
    blocks = parsed as JsonLdBlock[];
  } else if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as JsonLdBlock;
    if (Array.isArray(obj["@graph"])) {
      blocks = obj["@graph"] as JsonLdBlock[];
    } else {
      blocks = [obj];
    }
  }

  return { blocks, parseable: blocks.length > 0 };
}

/**
 * Extract all @type values from an array of JSON-LD blocks.
 * Handles both string and string[] @type declarations.
 */
export function extractSchemaTypes(blocks: JsonLdBlock[]): string[] {
  const types: string[] = [];
  for (const block of blocks) {
    const t = block["@type"];
    if (typeof t === "string")  types.push(t);
    else if (Array.isArray(t))  types.push(...t.filter((v): v is string => typeof v === "string"));
  }
  return types;
}

// ─── Robots directive parsing ─────────────────────────────────────────────────

/**
 * Parse the robots meta content attribute into directive flags.
 * "noindex, nofollow" → { noindex: true, nofollow: true }
 */
export function parseRobotsDirectives(content: string | null | undefined): {
  noindex: boolean;
  nofollow: boolean;
} {
  if (!content) return { noindex: false, nofollow: false };
  const lower = content.toLowerCase();
  return {
    noindex:  lower.includes("noindex"),
    nofollow: lower.includes("nofollow"),
  };
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope: "none",
  ttlMs: null,
  keyFields: [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "titlePresent",
  "titleLength",
  "estimatedTitlePixelWidth",
  "metaPresent",
  "metaLength",
  "metaDescriptionPixelWidth",
  "h1Present",
  "h1Count",
  "h1EqualsTitle",
  "canonicalPresent",
  "featuredImagePresent",
  "imageAltPresent",
  "robotsMetaExists",
  "robotsMetaContent",
  "robotsNoindex",
  "robotsNofollow",
  "openGraphExists",
  "openGraphPropertyCount",
  "twitterCardExists",
  "twitterMetaCount",
  "structuredDataPresent",
  "structuredDataParseable",
  "jsonLdCount",
  "schemaTypeList",
  "breadcrumbSchemaExists",
  "organizationSchemaExists",
  "websiteSchemaExists",
  "faqSchemaExists",
  "articleSchemaExists",
  "hreflangExists",
  "hreflangCount",
  "alternateLinkCount",
  "viewportMetaExists",
  "charsetMetaExists",
  "faviconExists",
  "manifestExists",
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class MetadataMetricsProvider implements MetricsProvider {
  readonly id             = "metadata-metrics";
  readonly name           = "Metadata Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 3;
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
  const {
    title,
    metaDescription,
    h1,
    canonicalUrl,
    featuredImage,
    imageAlt,
    structuredData,
    robots,
    openGraphTags,
    twitterTags,
    hreflangEntries,
    alternateLinks,
    viewportMeta,
    charsetMeta,
    faviconHref,
    manifestHref,
  } = input;

  // ── Title ────────────────────────────────────────────────────────────────
  const titlePresent = typeof title === "string" && title.length > 0;
  const titleLength  = titlePresent ? title!.length : 0;
  const estimatedTitlePixelWidth = titlePresent ? estimatePixelWidth(title!) : 0;

  // ── Meta description ──────────────────────────────────────────────────────
  const metaPresent = typeof metaDescription === "string" && metaDescription.length > 0;
  const metaLength  = metaPresent ? metaDescription!.length : 0;
  const metaDescriptionPixelWidth = metaPresent ? estimatePixelWidth(metaDescription!) : 0;

  // ── H1 ───────────────────────────────────────────────────────────────────
  const h1Present    = typeof h1 === "string" && h1.length > 0;
  const h1Count      = h1Present ? 1 : 0;
  const h1EqualsTitle =
    h1Present && titlePresent
      ? h1!.trim().toLowerCase() === title!.trim().toLowerCase()
      : false;

  // ── Canonical & images ────────────────────────────────────────────────────
  const canonicalPresent    = typeof canonicalUrl === "string" && canonicalUrl.length > 0;
  const featuredImagePresent = typeof featuredImage === "string" && featuredImage.length > 0;
  const imageAltPresent      = typeof imageAlt === "string" && imageAlt.length > 0;

  // ── Robots meta ───────────────────────────────────────────────────────────
  const robotsMetaExists  = typeof robots === "string" && robots.length > 0;
  const robotsMetaContent = robotsMetaExists ? robots! : null;
  const robotsDirs        = parseRobotsDirectives(robots);

  // ── Open Graph ────────────────────────────────────────────────────────────
  const ogTags              = openGraphTags ?? null;
  const openGraphExists     = ogTags !== null && Object.keys(ogTags).length > 0;
  const openGraphPropertyCount = openGraphExists ? Object.keys(ogTags!).length : 0;

  // ── Twitter card ──────────────────────────────────────────────────────────
  const twTags          = twitterTags ?? null;
  const twitterCardExists = twTags !== null && Object.keys(twTags).length > 0;
  const twitterMetaCount  = twitterCardExists ? Object.keys(twTags!).length : 0;

  // ── JSON-LD / Structured data ─────────────────────────────────────────────
  const structuredDataPresent  = typeof structuredData === "string" && structuredData.trim().length > 0;
  const { blocks, parseable }  = structuredDataPresent
    ? parseJsonLd(structuredData!)
    : { blocks: [], parseable: false };
  const structuredDataParseable = parseable;
  const jsonLdCount             = blocks.length;

  // Single pass over detected @type values
  const schemaTypes        = extractSchemaTypes(blocks);
  const schemaTypeSet      = new Set(schemaTypes.map((t) => t.toLowerCase()));
  const schemaTypeList     = schemaTypes.length > 0 ? schemaTypes.join(", ") : null;

  const breadcrumbSchemaExists   = schemaTypeSet.has("breadcrumblist");
  const organizationSchemaExists = schemaTypeSet.has("organization");
  const websiteSchemaExists      = schemaTypeSet.has("website");
  const faqSchemaExists          = schemaTypeSet.has("faqpage");
  const articleSchemaExists      = schemaTypeSet.has("article")
    || schemaTypeSet.has("newsarticle")
    || schemaTypeSet.has("blogposting");

  // ── Hreflang & alternate links ────────────────────────────────────────────
  const hreflangArr  = hreflangEntries ?? [];
  const hreflangExists = hreflangArr.length > 0;
  const hreflangCount  = hreflangArr.length;
  const alternateLinkCount = (alternateLinks ?? []).length;

  // ── Technical page signals ────────────────────────────────────────────────
  const viewportMetaExists = typeof viewportMeta === "string" && viewportMeta.length > 0;
  const charsetMetaExists  = typeof charsetMeta  === "string" && charsetMeta.length > 0;
  const faviconExists      = typeof faviconHref  === "string" && faviconHref.length > 0;
  const manifestExists     = typeof manifestHref === "string" && manifestHref.length > 0;

  return {
    titlePresent,
    titleLength,
    estimatedTitlePixelWidth,
    metaPresent,
    metaLength,
    metaDescriptionPixelWidth,
    h1Present,
    h1Count,
    h1EqualsTitle,
    canonicalPresent,
    featuredImagePresent,
    imageAltPresent,
    robotsMetaExists,
    robotsMetaContent,
    robotsNoindex:  robotsDirs.noindex,
    robotsNofollow: robotsDirs.nofollow,
    openGraphExists,
    openGraphPropertyCount,
    twitterCardExists,
    twitterMetaCount,
    structuredDataPresent,
    structuredDataParseable,
    jsonLdCount,
    schemaTypeList,
    breadcrumbSchemaExists,
    organizationSchemaExists,
    websiteSchemaExists,
    faqSchemaExists,
    articleSchemaExists,
    hreflangExists,
    hreflangCount,
    alternateLinkCount,
    viewportMetaExists,
    charsetMetaExists,
    faviconExists,
    manifestExists,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const metadataMetricsProvider = new MetadataMetricsProvider();

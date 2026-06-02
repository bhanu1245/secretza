// ==========================================
// SecretZa Crawl Optimization Engine
// ==========================================
// Server-side module that governs how search engine crawlers discover,
// prioritise, and consume pages on the classifieds site.
//
// Covers: crawl budget management, canonical URL analysis, faceted
// navigation control, duplicate detection, pagination consolidation,
// crawl-trap detection, robots.txt generation, and URL fingerprinting.

import { indiaCities } from "@/lib/india-geo-data";

// ────────────────────────────────────────────
// Type definitions
// ────────────────────────────────────────────

/**
 * Tuning knobs for how fast and how deep crawlers are allowed to go.
 * Affects robots.txt output, internal prioritisation, and API rate-limiting.
 */
export interface CrawlBudgetConfig {
  /** Maximum number of requests per minute a single crawler may make */
  maxCrawlRatePerMinute: number;
  /** Paths that should be crawled most frequently (high-priority landing pages) */
  priorityPages: string[];
  /** Paths that should be de-prioritised or heavily throttled */
  lowPriorityPaths: string[];
  /** Milliseconds the server should wait between serving successive low-priority pages */
  crawlDelay: number;
  /** Once a URL has more query params than this it is treated as a potential crawl trap */
  maxParamsPerUrl: number;
}

/**
 * Result of analysing a single URL's canonical handling.
 * Used to decide whether a `<link rel="canonical">` is correct
 * or whether a duplicate-content issue exists.
 */
export interface CanonicalAnalysis {
  /** The original URL that was analysed */
  url: string;
  /** The URL that *should* appear in the canonical tag */
  canonicalUrl: string;
  /** `true` when the canonical URL points to itself (ideal for primary pages) */
  hasSelfReferencing: boolean;
  /** `true` when another page already claims the same canonical */
  hasDuplicateIssue: boolean;
  /** Human-readable next step (e.g. "Self-referencing canonical is correct") */
  recommendation: string;
}

/**
 * Configuration that gates which query parameters are allowed to create
 * indexable URLs versus which should be nofollowed or blocked entirely.
 * This is the primary defence against faceted-navigation crawl bloat.
 */
export interface FacetNavConfig {
  /** Params that are allowed to create indexable, crawlable URLs */
  allowedParams: string[];
  /** Params that may appear in links but must carry `rel="nofollow"` */
  nofollowParams: string[];
  /** Glob-style patterns for params that should be stripped / robots-disallowed */
  blockedPatterns: string[];
  /** If the combination of allowed + nofollow params exceeds this, noindex the page */
  maxCombinations: number;
}

/**
 * Result of checking whether a path is a duplicate of another page
 * (e.g. alias city slugs like "bombay" vs "mumbai").
 */
export interface DuplicateCheck {
  /** The original URL / path being checked */
  url: string;
  /** Other paths that resolve to the same content */
  duplicates: string[];
  /** The canonical path that should be used instead */
  canonical: string;
  /** How severe the duplication risk is for search rankings */
  risk: "high" | "medium" | "low";
}

/**
 * Controls for paginated listing pages so that deep pagination
 * doesn't waste crawl budget on low-value, thin pages.
 */
export interface PaginationConfig {
  /** Absolute maximum page number before everything beyond is noindexed */
  maxPagesPerPaginated: number;
  /** Whether to emit `rel="next"` / `rel="prev"` link headers */
  useRelNextPrev: boolean;
  /** Whether to provide a "View All" alternative that consolidates pages */
  useViewAll: boolean;
  /** Beyond this page number, consolidate (noindex in favour of the parent) */
  consolidateAfter: number;
}

/**
 * Result of a crawl-trap analysis on a single URL.
 * Crawl traps are infinite or near-infinite URL spaces that can
 * consume a site's entire crawl budget.
 */
export interface CrawlTrapDetection {
  /** The URL that was analysed */
  url: string;
  /** `true` when the URL is believed to be part of a crawl trap */
  isTrap: boolean;
  /** Human-readable label (e.g. "calendar_pagination", "infinite_scroll") */
  trapType: string;
  /** How many path segments deep the URL is (deeper = more suspicious) */
  depth: number;
}

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/** Domain used when constructing absolute URLs */
const SITE_ORIGIN = "https://SecretZa.com";

/**
 * Known session-id, tracking, and bot-trap query-param names.
 * Any URL containing these is immediately flagged.
 */
const SESSION_PARAM_NAMES = new Set([
  "jsessionid",
  "phpsessid",
  "asp.net_sessionid",
  "sid",
  "sessionid",
  "session_id",
  "token",
  "csrf_token",
  "_t",
  "_ga",
  "_gid",
]);

/**
 * Regex patterns that indicate calendar / date-based pagination,
 * which is a classic crawl-trap pattern.
 */
const CALENDAR_PATTERNS = [
  /\/(?:19|20)\d{2}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])/,
  /\/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(?:19|20)\d{2}/i,
  /\/archive\/(?:19|20)\d{2}/i,
  /\/date\/(?:19|20)\d{2}/i,
  /[\?&]year=(?:19|20)\d{2}/i,
  /[\?&]month=(?:0[1-9]|1[0-2])(?:&|$)/,
  /[\?&]day=(?:0[1-9]|[12]\d|3[01])(?:&|$)/,
];

/**
 * Patterns that indicate infinite-scroll / auto-generated pagination
 * via query params.
 */
const INFINITE_SCROLL_PATTERNS = [
  /[\?&](?:offset|start|from)=(?:\d{4,})/,  // suspiciously large offsets
  /[\?&]_escaped_fragment_=/,                // old Google AJAX crawl scheme
  /[\?&]__a=\d/,                            // Facebook-style infinite scroll
  /[\?&]page=\d{3,}/,                        // page > 99 is almost always a trap
];

/**
 * Extract the slug segment from a path (first meaningful segment).
 */
function extractSlug(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
}

/**
 * Count the number of query parameters in a URL string.
 */
function countParams(url: string): number {
  const qs = url.includes("?") ? url.split("?")[1] : "";
  if (!qs) return 0;
  return qs.split("&").filter((p) => p.length > 0).length;
}

/**
 * Measure URL depth — the number of path segments after the host.
 */
function measureDepth(url: string): number {
  try {
    const { pathname } = new URL(url, SITE_ORIGIN);
    return pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).length;
  } catch {
    return url.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).length;
  }
}

// ────────────────────────────────────────────
// 1. Default crawl budget configuration
// ────────────────────────────────────────────

/**
 * Returns the default crawl-budget tuning for SecretZa.
 *
 * Priority pages are the landing pages that drive the most organic
 * traffic — the homepage, the /india country page, top category hubs,
 * and the biggest metro city pages (tier-1 cities).
 *
 * Low-priority paths are internal or authenticated routes that should
 * never appear in search results.
 */
export function getDefaultCrawlBudgetConfig(): CrawlBudgetConfig {
  // Build priority pages from tier-1 and tier-2 metro cities
  const metroCityPaths = indiaCities
    .filter((c) => c.isMetro || c.tier === 1)
    .map((c) => `/${c.slug}`);

  // Ensure no duplicates while preserving explicit ordering
  const explicitPriority = [
    "/",
    "/india",
    "/escorts",
    "/mumbai",
    "/delhi",
    "/bangalore",
    "/hyderabad",
    "/chennai",
    "/kolkata",
    "/pune",
    "/ahmedabad",
    "/jaipur",
    "/lucknow",
    "/chandigarh",
    "/kochi",
  ];

  const prioritySet = new Set<string>(explicitPriority);
  for (const p of metroCityPaths) {
    prioritySet.add(p);
  }

  return {
    maxCrawlRatePerMinute: 60,
    priorityPages: [...prioritySet],
    lowPriorityPaths: ["/api/", "/dashboard", "/admin", "/auth/", "/settings"],
    crawlDelay: 1000,
    maxParamsPerUrl: 3,
  };
}

// ────────────────────────────────────────────
// 2. Canonical URL analysis
// ────────────────────────────────────────────

/**
 * Analyse canonical handling for a given URL.
 *
 * - **Primary pages** (homepage, category, city) → self-referencing canonical.
 * - **Paginated pages** → canonical points to page-1 with `?page=N` appended
 *   only for `N > 1`; deeper pages point back to page 1.
 * - **Listing detail pages** → self-referencing, slug-based.
 *
 * @param url   The absolute or path-only URL to analyse.
 * @param pageType  One of `"homepage"`, `"category"`, `"city"`, `"listing"`, `"paginated"`, `"search"`.
 * @param slug The primary slug for the page (city slug, category slug, etc.).
 */
export function analyzeCanonical(
  url: string,
  pageType: string,
  slug: string
): CanonicalAnalysis {
  // Normalise to an absolute URL for consistent comparison
  let absoluteUrl: string;
  try {
    absoluteUrl = url.startsWith("http")
      ? url
      : `${SITE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
  } catch {
    absoluteUrl = `${SITE_ORIGIN}/${url}`;
  }

  const parsed = new URL(absoluteUrl);
  const basePath = parsed.pathname;

  let canonicalUrl = absoluteUrl;
  let hasSelfReferencing = true;
  let hasDuplicateIssue = false;
  let recommendation = "";

  switch (pageType) {
    // ── Homepage & landing pages: strict self-referencing ──
    case "homepage":
    case "city":
    case "category": {
      // Strip any query string — canonical should be the clean path
      const cleanUrl = `${parsed.origin}${basePath}`;
      canonicalUrl = cleanUrl.replace(/\/+$/, "") || `${parsed.origin}/`;
      hasSelfReferencing = true;
      hasDuplicateIssue = false;
      recommendation =
        "Self-referencing canonical is correct. Ensure no other page claims this URL as its canonical.";
      break;
    }

    // ── Paginated series: page 1 is canonical, deeper pages point back ──
    case "paginated": {
      const pageParam = parsed.searchParams.get("page");
      const pageNum = pageParam ? parseInt(pageParam, 10) : 1;

      if (isNaN(pageNum) || pageNum <= 1) {
        // Page 1 (or no page param) → self-referencing, but strip ?page=1
        parsed.searchParams.delete("page");
        canonicalUrl = parsed.toString().replace(/\?$/, "");
        hasSelfReferencing = true;
        recommendation =
          "First page of paginated series uses self-referencing canonical. No action needed.";
      } else {
        // Deeper pages → canonical points to the first page
        parsed.searchParams.delete("page");
        parsed.searchParams.sort();
        canonicalUrl = parsed.toString().replace(/\?$/, "");
        hasSelfReferencing = false;
        hasDuplicateIssue = false;
        recommendation = `Page ${pageNum} should canonicalise to page 1 (${canonicalUrl}). Add rel="prev" links as well.`;
      }
      break;
    }

    // ── Individual listing: self-referencing by slug ──
    case "listing": {
      // Canonical should be /{category}/{slug} — no query params
      const cleanListingUrl = `${parsed.origin}/${slug}`.replace(/\/+$/, "");
      canonicalUrl = cleanListingUrl;
      hasSelfReferencing =
        absoluteUrl.replace(/\?.*$/, "").replace(/\/+$/, "") === cleanListingUrl;
      hasDuplicateIssue = false;
      recommendation = hasSelfReferencing
        ? "Listing page has a correct self-referencing canonical."
        : `Listing URL should canonicalise to ${cleanListingUrl}. Current URL differs.`;
      break;
    }

    // ── Search results: noindex / self-referencing ──
    case "search": {
      canonicalUrl = absoluteUrl;
      hasSelfReferencing = true;
      hasDuplicateIssue = false;
      recommendation =
        "Search result pages should carry noindex. Canonical is self-referencing for correctness but the page should not be indexed.";
      break;
    }

    // ── Fallback: generic handling ──
    default: {
      canonicalUrl = absoluteUrl.replace(/\?.*$/, "").replace(/\/+$/, "") || `${parsed.origin}/`;
      hasSelfReferencing = true;
      hasDuplicateIssue = false;
      recommendation =
        "Unrecognised page type. Using clean self-referencing canonical as a safe default.";
    }
  }

  return {
    url: absoluteUrl,
    canonicalUrl,
    hasSelfReferencing,
    hasDuplicateIssue,
    recommendation,
  };
}

// ────────────────────────────────────────────
// 3. Faceted navigation configuration
// ────────────────────────────────────────────

/**
 * Returns the faceted-navigation gating configuration.
 *
 * - **allowedParams** create crawlable, indexable URLs.
 * - **nofollowParams** may appear in on-page links but carry `rel="nofollow"`.
 * - **blockedPatterns** are stripped entirely and disallowed in robots.txt.
 * - **maxCombinations** sets a ceiling on the total unique URLs a single
 *   faceted path tree may produce before noindex kicks in.
 */
export function getFacetNavigationConfig(): FacetNavConfig {
  return {
    allowedParams: ["page", "sort", "q", "city"],
    nofollowParams: [
      "price_min",
      "price_max",
      "location",
      "category",
      "verified",
      "premium",
      "photos_only",
      "posted_within",
    ],
    blockedPatterns: [
      "utm_*",
      "fbclid",
      "gclid",
      "ref=*",
      "msclkid",
      "dclid",
      "_gl",
      "mc_eid",
      "mc_cid",
    ],
    maxCombinations: 100,
  };
}

// ────────────────────────────────────────────
// 4. Duplicate URL detection
// ────────────────────────────────────────────

/**
 * Check whether a given path might be a duplicate of another page.
 *
 * The primary mechanism is **city alias resolution**: many Indian cities
 * have historical / colloquial names (e.g. "bombay" → "mumbai",
 * "calcutta" → "kolkata").  If the first path segment matches an alias
 * of a known city, the function returns the canonical city slug.
 *
 * It also checks for trailing-slash and case-sensitivity duplicates
 * against the provided `knownSlugs` list.
 *
 * @param path       The path to check (e.g. `/bombay/escorts`).
 * @param knownSlugs An array of existing slugs in the system to compare against.
 */
export function detectDuplicateUrls(
  path: string,
  knownSlugs: string[]
): DuplicateCheck {
  const normalisedPath = path.replace(/^\/+|\/+$/g, "").toLowerCase();
  const firstSegment = extractSlug(path).toLowerCase();

  const duplicates: string[] = [];
  let canonical = path;
  let risk: "high" | "medium" | "low" = "low";

  // ── 1. Alias resolution against indiaCities ──
  const matchingCity = indiaCities.find(
    (city) =>
      city.slug === firstSegment ||
      city.aliases.some((a) => a.toLowerCase() === firstSegment)
  );

  if (matchingCity && matchingCity.slug !== firstSegment) {
    // The path uses an alias — it's a duplicate of the canonical city slug
    const canonicalPath = path.replace(
      `/${firstSegment}`,
      `/${matchingCity.slug}`
    );
    duplicates.push(canonicalPath);
    canonical = canonicalPath;
    risk = "high";
  }

  // ── 2. Trailing-slash duplicates ──
  const withSlash = `/${normalisedPath}/`;
  const withoutSlash = `/${normalisedPath}`;
  for (const s of knownSlugs) {
    const ns = s.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (ns === normalisedPath && s !== path.replace(/^\/+|\/+$/g, "")) {
      duplicates.push(`/${ns}`);
      if (risk === "low") risk = "medium";
    }
  }

  // ── 3. Case-sensitivity duplicates ──
  for (const s of knownSlugs) {
    const ns = s.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (ns === normalisedPath && s !== path.replace(/^\/+|\/+$/g, "")) {
      if (!duplicates.includes(s)) {
        duplicates.push(s);
        if (risk === "low") risk = "medium";
      }
    }
  }

  // Deduplicate the list
  const uniqueDuplicates = [...new Set(duplicates)];

  // If nothing was found, canonical stays as-is
  if (uniqueDuplicates.length === 0) {
    canonical = path;
    risk = "low";
  }

  return {
    url: path,
    duplicates: uniqueDuplicates,
    canonical,
    risk,
  };
}

// ────────────────────────────────────────────
// 5. Pagination configuration
// ────────────────────────────────────────────

/**
 * Returns the pagination SEO configuration for paginated listing pages.
 *
 * The strategy is:
 * - Allow up to `maxPagesPerPaginated` pages to be indexed.
 * - Emit `rel="next"` / `rel="prev"` for series navigation.
 * - Offer a "View All" page for users who want everything on one page
 *   (only when the total items is manageable).
 * - Beyond `consolidateAfter`, apply `noindex` and consolidate back
 *   to the first page.
 */
export function getPaginationConfig(): PaginationConfig {
  return {
    maxPagesPerPaginated: 10,
    useRelNextPrev: true,
    useViewAll: true,
    consolidateAfter: 5,
  };
}

// ────────────────────────────────────────────
// 6. Crawl-trap detection
// ────────────────────────────────────────────

/**
 * Detect whether a URL is likely part of a crawl trap.
 *
 * A crawl trap is an infinite (or very large) URL space that wastes
 * crawl budget.  Common patterns include:
 *
 * - **Calendar pagination**: `/blog/2024/01/01`, `?year=2024&month=01`
 * - **Infinite scroll virtual pages**: `?offset=10000`, `?start=99999`
 * - **Session IDs in URLs**: `?jsessionid=abc123`
 * - **Excessive path depth**: more than 7 segments
 * - **Excessive query parameters**: more than the configured `maxParamsPerUrl`
 *
 * @param url   The URL to analyse.
 * @param depth The current crawl depth (how many hops from a known seed page).
 */
export function detectCrawlTrap(
  url: string,
  depth: number
): CrawlTrapDetection {
  const urlDepth = measureDepth(url);
  const paramCount = countParams(url);
  const lowerUrl = url.toLowerCase();

  const traps: Array<{ type: string; isTrap: boolean }> = [];

  // ── Calendar pagination patterns ──
  for (const pattern of CALENDAR_PATTERNS) {
    if (pattern.test(lowerUrl)) {
      traps.push({ type: "calendar_pagination", isTrap: true });
      break;
    }
  }

  // ── Infinite-scroll / auto-generated page patterns ──
  for (const pattern of INFINITE_SCROLL_PATTERNS) {
    if (pattern.test(lowerUrl)) {
      traps.push({ type: "infinite_scroll", isTrap: true });
      break;
    }
  }

  // ── Session ID in URL ──
  try {
    const parsed = new URL(url, SITE_ORIGIN);
    for (const [key] of parsed.searchParams) {
      if (SESSION_PARAM_NAMES.has(key.toLowerCase())) {
        traps.push({ type: "session_id", isTrap: true });
        break;
      }
    }
  } catch {
    // If URL parsing fails, check raw string
    for (const name of SESSION_PARAM_NAMES) {
      if (lowerUrl.includes(`${name}=`)) {
        traps.push({ type: "session_id", isTrap: true });
        break;
      }
    }
  }

  // ── Excessive path depth (> 7 segments) ──
  if (urlDepth > 7) {
    traps.push({ type: "excessive_depth", isTrap: true });
  }

  // ── Excessive query parameters ──
  const defaultConfig = getDefaultCrawlBudgetConfig();
  if (paramCount > defaultConfig.maxParamsPerUrl) {
    traps.push({ type: "excessive_params", isTrap: true });
  }

  // ── Sort / filter combinations that explode combinatorially ──
  const sortPatterns = /[\?&]sort=[^&]*.*[\?&]sort=/;
  if (sortPatterns.test(lowerUrl)) {
    traps.push({ type: "duplicate_sort_params", isTrap: true });
  }

  // ── Crawl depth exceeds safe threshold ──
  if (depth > 10) {
    traps.push({ type: "excessive_crawl_depth", isTrap: true });
  }

  // ── Sorting / price-range explosion patterns ──
  const priceRangePattern = /[\?&]price_\w+=\d+.*[\?&]price_\w+=\d+/;
  if (priceRangePattern.test(lowerUrl)) {
    traps.push({ type: "price_range_explosion", isTrap: true });
  }

  const isTrap = traps.length > 0;
  const trapType = isTrap ? traps.map((t) => t.type).join(", ") : "none";

  return {
    url,
    isTrap,
    trapType,
    depth: urlDepth,
  };
}

// ────────────────────────────────────────────
// 7. Robots.txt directive generation
// ────────────────────────────────────────────

/**
 * Generate robots.txt directives based on the crawl budget configuration.
 *
 * Returns an array of rule groups, each targeting a specific user-agent.
 * The output can be serialised directly into a robots.txt file.
 *
 * Three groups are always produced:
 * 1. **Googlebot** — most permissive, no crawl-delay (Google ignores it).
 * 2. **Bingbot** — moderate crawl-delay.
 * 3. **\*** (all other bots) — strictest settings with crawl-delay.
 *
 * @param config  Optional partial override of the default crawl budget config.
 */
export function generateRobotsDirectives(
  config?: Partial<CrawlBudgetConfig>
): Array<{ userAgent: string; allow: string[]; disallow: string[]; crawlDelay?: number }> {
  const defaults = getDefaultCrawlBudgetConfig();
  const merged: CrawlBudgetConfig = { ...defaults, ...config };

  const facetConfig = getFacetNavigationConfig();

  // Build disallow paths from low-priority + facet blocked patterns
  const disallowPaths = [
    ...merged.lowPriorityPaths,
    // Facet blocked patterns
    ...facetConfig.blockedPatterns.map((p) => {
      // Convert glob patterns to robots.txt prefix patterns
      if (p.endsWith("*")) {
        return `/*?${p.replace("*", "")}`;
      }
      if (p.includes("=")) {
        return `/*?${p}`;
      }
      return `/${p}`;
    }),
    // Nofollow params as disallow for non-Googlebot
    ...facetConfig.nofollowParams.map((p) => `/*?${p}=`),
  ];

  // Ensure no trailing slash duplication
  const cleanDisallow = [...new Set(disallowPaths.map((d) => d.replace(/\/+$/, "")))];

  // Allow rules: everything not disallowed
  const allowPaths = ["/", "/india", "/sitemap.xml", "/robots.txt"];

  // Allow priority pages explicitly
  for (const pp of merged.priorityPages) {
    if (!allowPaths.includes(pp)) {
      allowPaths.push(pp);
    }
  }

  return [
    // ── Googlebot: no crawl-delay, most permissive ──
    {
      userAgent: "Googlebot",
      allow: allowPaths,
      disallow: cleanDisallow,
      // Google ignores Crawl-delay, but we include it for documentation
    },
    // ── Bingbot: moderate crawl-delay ──
    {
      userAgent: "Bingbot",
      allow: allowPaths,
      disallow: cleanDisallow,
      crawlDelay: Math.ceil(merged.crawlDelay / 1000), // convert ms → seconds
    },
    // ── All other bots: strictest ──
    {
      userAgent: "*",
      allow: ["/", "/sitemap.xml", "/robots.txt"],
      disallow: [
        ...cleanDisallow,
        // Additional restrictions for unknown bots
        "/api/",
        "/dashboard",
        "/admin",
        "/auth/",
        "/_next/",
        // Block all facet nofollow params for unknown bots
        ...facetConfig.nofollowParams.map((p) => `/*?${p}=`),
      ],
      crawlDelay: Math.ceil((merged.crawlDelay * 2) / 1000), // 2× slower for unknown bots
    },
  ];
}

// ────────────────────────────────────────────
// 8. Page consolidation decision
// ────────────────────────────────────────────

/**
 * Determine whether a page should be consolidated (noindexed in favour of
 * a parent page) based on listing count and page type.
 *
 * Consolidation is recommended when:
 * - A paginated listing page has very few items (thin content).
 * - A city or category page has too few listings to provide value.
 * - A search results page has no results or just one.
 *
 * @param listingCount  The number of listings on the page.
 * @param pageType      The type of page (`"listing"`, `"city"`, `"category"`, `"search"`, `"paginated"`).
 * @returns `true` if the page should be noindexed / consolidated.
 */
export function shouldConsolidatePage(
  listingCount: number,
  pageType: string
): boolean {
  const paginationConfig = getPaginationConfig();

  switch (pageType) {
    case "listing":
      // Individual listing pages always stand on their own
      return false;

    case "city":
      // City pages with fewer than 3 listings are too thin to index
      return listingCount < 3;

    case "category":
      // Category pages with fewer than 5 listings are thin
      return listingCount < 5;

    case "search":
      // Search results should generally not be indexed, but we leave that
      // to the canonical analysis. Here we only flag empty results.
      return listingCount === 0;

    case "paginated":
      // Paginated pages are consolidated based on the pagination config
      // The caller should also check the page number against consolidateAfter.
      // This check is for content thin-ness on any given page.
      return listingCount < 2;

    default:
      // Unknown page types: consolidate if very thin
      return listingCount < 2;
  }
}

// ────────────────────────────────────────────
// 9. URL fingerprinting
// ────────────────────────────────────────────

/**
 * Generate a normalised fingerprint for a URL.
 *
 * This is used for **duplicate detection**: two URLs that produce the
 * same fingerprint are considered duplicates for SEO purposes.
 *
 * Normalisation steps:
 * 1. Parse the URL and extract pathname + query string.
 * 2. Remove session-ID parameters.
 * 3. Remove tracking parameters (utm_*, fbclid, gclid, etc.).
 * 4. Sort remaining query parameters alphabetically.
 * 5. Normalise path: remove trailing slash, collapse double slashes.
 * 6. Lowercase the entire result.
 *
 * @param url  The URL to fingerprint (absolute or path-only).
 * @returns    A stable, normalised string suitable for hashing or comparison.
 */
export function getUrlFingerprint(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, SITE_ORIGIN);
  } catch {
    // Last resort: treat as a bare path
    const cleaned = url
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/{2,}/g, "/")
      .toLowerCase();
    return cleaned;
  }

  // ── Remove session & tracking params ──
  const facetConfig = getFacetNavigationConfig();
  const paramsToRemove = new Set<string>([
    ...SESSION_PARAM_NAMES,
    // Blocked facet patterns (expand glob)
    "fbclid",
    "gclid",
    "dclid",
    "msclkid",
    "_gl",
    "mc_eid",
    "mc_cid",
  ]);

  // Add all utm_* params
  for (const [key] of parsed.searchParams) {
    if (key.toLowerCase().startsWith("utm_")) {
      paramsToRemove.add(key.toLowerCase());
    }
    // Blocked patterns that are exact param names (not globs with =)
    for (const pattern of facetConfig.blockedPatterns) {
      if (!pattern.includes("*") && !pattern.includes("=") && key.toLowerCase() === pattern.toLowerCase()) {
        paramsToRemove.add(key.toLowerCase());
      }
    }
  }

  // ── Build cleaned query string ──
  const remainingParams: Array<[string, string]> = [];
  for (const [key, value] of parsed.searchParams) {
    if (!paramsToRemove.has(key.toLowerCase())) {
      remainingParams.push([key.toLowerCase(), value.toLowerCase()]);
    }
  }

  // Sort params for stable ordering
  remainingParams.sort((a, b) => a[0].localeCompare(b[0]));

  const cleanQuery =
    remainingParams.length > 0
      ? `?${remainingParams.map(([k, v]) => `${k}=${v}`).join("&")}`
      : "";

  // ── Normalise path ──
  let cleanPath = parsed.pathname
    .replace(/\/{2,}/g, "/")   // collapse double slashes
    .replace(/\/+$/, "")        // remove trailing slash
    .toLowerCase();

  // Ensure root path is "/"
  if (cleanPath === "") cleanPath = "/";

  return `${cleanPath}${cleanQuery}`;
}

// ────────────────────────────────────────────
// 10. Crawl priority scoring
// ────────────────────────────────────────────

/**
 * Calculate a crawl priority score (0–100) for a given path.
 *
 * Higher scores indicate pages that should be crawled more frequently
 * and with higher priority by search engines.
 *
 * Scoring breakdown:
 * - **Priority pages**: +60–80 base points
 * - **Metro / tier-1 city pages**: +50–70 base points
 * - **Tier-2 city pages**: +30–50 base points
 * - **Tier-3 city pages**: +15–30 base points
 * - **Low-priority paths**: 0 points (should not be crawled)
 * - **Crawl traps**: 0 points
 * - **Pagination penalty**: −10 per page depth beyond 1
 * - **Query param penalty**: −5 per param
 *
 * @param path    The URL path to score (e.g. `/mumbai/escorts?page=3`).
 * @param config  The crawl budget configuration (uses defaults if not provided).
 * @returns       A number from 0 to 100. Higher = more important.
 */
export function getCrawlPriority(
  path: string,
  config: CrawlBudgetConfig
): number {
  // ── Early exit: low-priority paths get zero ──
  const normalisedPath = path.replace(/^\/+|\/+$/g, "").toLowerCase();
  for (const lp of config.lowPriorityPaths) {
    const cleanLp = lp.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (normalisedPath === cleanLp || normalisedPath.startsWith(cleanLp + "/")) {
      return 0;
    }
  }

  // ── Early exit: crawl traps get zero ──
  const trapCheck = detectCrawlTrap(path, 0);
  if (trapCheck.isTrap) {
    return 0;
  }

  // ── Early exit: API / internal routes ──
  if (normalisedPath.startsWith("api/") || normalisedPath.startsWith("_next/")) {
    return 0;
  }

  let score = 0;
  const firstSegment = extractSlug(path);

  // ── Explicit priority pages: high base score ──
  const isPriorityPage = config.priorityPages.some(
    (pp) => pp.replace(/^\/+|\/+$/g, "").toLowerCase() === normalisedPath
  );
  if (isPriorityPage) {
    score += 80;
  } else if (normalisedPath === "" || normalisedPath === "/") {
    // Homepage
    score += 100;
  }

  // ── City-based scoring ──
  const city = indiaCities.find(
    (c) => c.slug === firstSegment || c.aliases.includes(firstSegment)
  );
  if (city) {
    switch (city.tier) {
      case 1:
        score += city.isMetro ? 70 : 60;
        break;
      case 2:
        score += 40;
        break;
      case 3:
        score += 20;
        break;
      case 4:
        score += 10;
        break;
    }
  }

  // ── Category / section scoring ──
  const knownCategories = [
    "escorts",
    "dating",
    "massage",
    "body-rubs",
    "strippers",
    "female-escorts",
    "male-escorts",
    "trans-escorts",
    "casual-encounters",
  ];
  const segments = normalisedPath.split("/");
  for (const seg of segments) {
    if (knownCategories.includes(seg)) {
      score += 30;
      break;
    }
  }

  // ── Penalties ──

  // Query parameter penalty
  const paramCount = countParams(path);
  score -= paramCount * 5;

  // Pagination depth penalty
  try {
    const parsed = new URL(path, SITE_ORIGIN);
    const pageParam = parsed.searchParams.get("page");
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 1) {
        score -= (pageNum - 1) * 10;
      }
    }
  } catch {
    // Ignore URL parse failures
  }

  // Path depth penalty for very deep pages
  const depth = segments.length;
  if (depth > 4) {
    score -= (depth - 4) * 5;
  }

  // ── Clamp to 0–100 ──
  return Math.max(0, Math.min(100, score));
}

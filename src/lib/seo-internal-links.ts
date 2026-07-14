/**
 * Internal linking utilities for SEO pages — supplementation, validation, graph analysis.
 */

import { db } from "@/lib/db";
import { titleCaseFromSlug } from "@/lib/seo-fallback";
import {
  getSeoPagePublicUrl,
  type SeoBreadcrumbItem,
  type SeoRelatedLink,
} from "@/lib/seo-public-page";

export const SEO_LONGTAIL_KEYWORDS = [
  { keyword: "Cheap Escorts", slug: "cheap-escorts" },
  { keyword: "Independent Escorts", slug: "independent-escorts" },
  { keyword: "VIP Escorts", slug: "vip-escorts" },
  { keyword: "Russian Escorts", slug: "russian-escorts" },
  { keyword: "Housewife Escorts", slug: "housewife-escorts" },
  { keyword: "College Escorts", slug: "college-escorts" },
  { keyword: "High Profile Escorts", slug: "high-profile-escorts" },
  { keyword: "Verified Escorts", slug: "verified-escorts" },
] as const;

export const MIN_INTERNAL_LINKS_PER_PAGE = 15;

export type PageLinkInventory = {
  breadcrumbLinks: number;
  relatedLinks: number;
  listingLinks: number;
  totalLinks: number;
  nearbyCities: number;
  relatedCategories: number;
  relatedSearches: number;
  hasBreadcrumbs: boolean;
  hasNearbyCities: boolean;
  hasRelatedCategories: boolean;
  hasRelatedSearches: boolean;
};

export function countPageLinks(input: {
  breadcrumbs: SeoBreadcrumbItem[];
  relatedLinks: SeoRelatedLink[];
  listingCount: number;
}): PageLinkInventory {
  const breadcrumbLinks = input.breadcrumbs.filter((b) => b.href?.trim()).length;
  const nearbyCities = input.relatedLinks.filter((l) => l.group === "city").length;
  const relatedCategories = input.relatedLinks.filter((l) => l.group === "category").length;
  const relatedSearches = input.relatedLinks.filter((l) => l.group === "longtail").length;
  const relatedLinks = input.relatedLinks.length;
  const listingLinks = input.listingCount;

  return {
    breadcrumbLinks,
    relatedLinks,
    listingLinks,
    totalLinks: breadcrumbLinks + relatedLinks + listingLinks,
    nearbyCities,
    relatedCategories,
    relatedSearches,
    hasBreadcrumbs: input.breadcrumbs.length >= 2,
    hasNearbyCities: nearbyCities >= 1,
    hasRelatedCategories: relatedCategories >= 1,
    hasRelatedSearches: relatedSearches >= 1,
  };
}

export function passesInternalLinkTarget(inventory: PageLinkInventory, pageType?: string): boolean {
  const needsNearby = pageType !== "country";
  return (
    inventory.totalLinks >= MIN_INTERNAL_LINKS_PER_PAGE &&
    inventory.hasBreadcrumbs &&
    (needsNearby ? inventory.hasNearbyCities : inventory.nearbyCities + inventory.relatedCategories >= 4) &&
    inventory.hasRelatedCategories &&
    inventory.hasRelatedSearches
  );
}

function normalizePath(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith("http")) {
    try {
      return new URL(trimmed).pathname.replace(/\/+$/, "") || "/";
    } catch {
      return trimmed;
    }
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return path.replace(/\/+$/, "") || "/";
}

let slugCaches: {
  countries: Set<string>;
  categories: Set<string>;
  cityPaths: Map<string, string>;
} | null = null;

export async function loadSlugCaches(): Promise<{
  countries: Set<string>;
  categories: Set<string>;
  cityPaths: Map<string, string>;
}> {
  if (!slugCaches) {
    const [countries, categories, cities] = await Promise.all([
      db.country.findMany({ where: { isActive: true }, select: { slug: true } }),
      db.category.findMany({ where: { isActive: true }, select: { slug: true } }),
      db.city.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          state: { select: { slug: true, country: { select: { slug: true } } } },
        },
      }),
    ]);
    const cityPaths = new Map<string, string>();
    for (const city of cities) {
      if (city.state?.country) {
        cityPaths.set(
          city.slug,
          `/${city.state.country.slug}/${city.state.slug}/${city.slug}`,
        );
      }
    }
    slugCaches = {
      countries: new Set(countries.map((c) => c.slug)),
      categories: new Set(categories.map((c) => c.slug)),
      cityPaths,
    };
  }
  return slugCaches;
}

/** Fix legacy breadcrumb paths (/india → /country/india, /ahmedabad → full geo path). */
export function normalizePublicSeoPath(
  href: string,
  caches?: { countries: Set<string>; categories: Set<string>; cityPaths: Map<string, string> },
): string {
  const path = normalizePath(href);
  if (path === "/") return path;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1 && caches) {
    const slug = segments[0]!;
    if (caches.countries.has(slug)) return `/country/${slug}`;
    if (caches.categories.has(slug)) return `/category/${slug}`;
    const cityPath = caches.cityPaths.get(slug);
    if (cityPath) return cityPath;
  }

  return path;
}

export async function normalizeBreadcrumbItems(
  items: SeoBreadcrumbItem[],
): Promise<SeoBreadcrumbItem[]> {
  const caches = await loadSlugCaches();
  return items.map((item) => ({
    ...item,
    href: item.href ? normalizePublicSeoPath(item.href, caches) : undefined,
  }));
}

export async function normalizeRelatedLinks(links: SeoRelatedLink[]): Promise<SeoRelatedLink[]> {
  const caches = await loadSlugCaches();
  return links.map((link) => ({
    ...link,
    href: normalizePublicSeoPath(link.href, caches),
  }));
}

/** Resolve whether an internal href targets a valid public SEO route. */
export async function validateInternalHref(href: string): Promise<boolean> {
  const caches = await loadSlugCaches();
  const path = normalizePublicSeoPath(href, caches);
  if (path === "/") return true;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  if (segments[0] === "category" && segments.length === 2) {
    const cat = await db.category.findFirst({
      where: { slug: segments[1], isActive: true },
      select: { id: true },
    });
    return !!cat;
  }

  if (segments[0] === "country" && segments.length === 2) {
    const country = await db.country.findFirst({
      where: { slug: segments[1], isActive: true },
      select: { id: true },
    });
    return !!country;
  }

  if (segments.length === 3) {
    const [countrySlug, stateSlug, citySlug] = segments;
    const city = await db.city.findFirst({
      where: {
        slug: citySlug,
        isActive: true,
        state: { slug: stateSlug, country: { slug: countrySlug } },
      },
      select: { id: true },
    });
    return !!city;
  }

  if (segments.length === 2) {
    const [first, second] = segments;
    const state = await db.state.findFirst({
      where: { slug: second, isActive: true, country: { slug: first } },
      select: { id: true },
    });
    if (state) return true;

    const city = await db.city.findFirst({
      where: { slug: second, isActive: true },
      select: { id: true },
    });
    if (!city) return false;

    const category = await db.category.findFirst({
      where: { slug: first, isActive: true },
      select: { id: true },
    });
    if (category) return true;

    const isKeyword = SEO_LONGTAIL_KEYWORDS.some((k) => k.slug === first);
    return isKeyword;
  }

  return false;
}

export type LinkGraphNode = {
  id: string;
  pageType: string;
  pageSlug: string;
};

export type LinkGraph = {
  nodes: LinkGraphNode[];
  edges: Array<{ from: string; to: string }>;
  inDegree: Map<string, number>;
  orphans: string[];
  poorConnectivity: string[];
  maxDepth: number;
  avgDepth: number;
  circularPairs: Array<[string, string]>;
};

export function buildInternalLinkGraph(
  pages: Array<{
    id: string;
    pageType: string;
    pageSlug: string;
    publicPath: string;
    outboundHrefs: string[];
  }>,
): LinkGraph {
  const pathToId = new Map<string, string>();
  for (const p of pages) {
    pathToId.set(normalizePath(p.publicPath), p.id);
  }

  const edges: Array<{ from: string; to: string }> = [];
  const inDegree = new Map<string, number>();
  for (const p of pages) {
    inDegree.set(p.id, 0);
  }

  for (const p of pages) {
    for (const href of p.outboundHrefs) {
      const targetPath = normalizePath(href);
      const targetId = pathToId.get(targetPath);
      if (targetId && targetId !== p.id) {
        edges.push({ from: p.id, to: targetId });
        inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
      }
    }
  }

  const orphans = pages.filter((p) => (inDegree.get(p.id) ?? 0) === 0).map((p) => p.id);
  const poorConnectivity = pages
    .filter((p) => (inDegree.get(p.id) ?? 0) <= 1 && p.pageType !== "country")
    .map((p) => p.id);

  const adjacency = new Map<string, string[]>();
  for (const p of pages) {
    adjacency.set(p.id, []);
  }
  for (const e of edges) {
    adjacency.get(e.from)?.push(e.to);
  }

  const homeId = pages.find((p) => normalizePath(p.publicPath) === "/")?.id;
  const depths = new Map<string, number>();
  if (homeId) {
    const queue: Array<{ id: string; depth: number }> = [{ id: homeId, depth: 0 }];
    depths.set(homeId, 0);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current.id) ?? []) {
        if (!depths.has(next)) {
          depths.set(next, current.depth + 1);
          queue.push({ id: next, depth: current.depth + 1 });
        }
      }
    }
  }

  const depthValues = [...depths.values()];
  const maxDepth = depthValues.length ? Math.max(...depthValues) : 0;
  const avgDepth =
    depthValues.length > 0
      ? Math.round((depthValues.reduce((a, b) => a + b, 0) / depthValues.length) * 10) / 10
      : 0;

  const circularPairs: Array<[string, string]> = [];
  const edgeSet = new Set(edges.map((e) => `${e.from}->${e.to}`));
  for (const e of edges) {
    if (edgeSet.has(`${e.to}->${e.from}`)) {
      circularPairs.push([e.from, e.to]);
    }
  }

  return {
    nodes: pages.map((p) => ({ id: p.id, pageType: p.pageType, pageSlug: p.pageSlug })),
    edges,
    inDegree,
    orphans: orphans.filter((id) => id !== homeId),
    poorConnectivity,
    maxDepth,
    avgDepth,
    circularPairs,
  };
}

export type SupplementContext = {
  currentPath: string;
  pageType: string;
  pageSlug: string;
  keywordSlug?: string;
  categorySlug?: string;
  citySlug?: string;
  cityName?: string;
  stateId?: string;
  countrySlug?: string;
  stateSlug?: string;
};

/** Fill related-link sections until minimum targets are met (works for fallback pages). */
export async function supplementRelatedLinks(
  links: SeoRelatedLink[],
  ctx: SupplementContext,
  minRelated = 12,
): Promise<SeoRelatedLink[]> {
  const seen = new Set<string>([normalizePath(ctx.currentPath)]);
  const result: SeoRelatedLink[] = [];

  const addLink = (link: SeoRelatedLink) => {
    const path = normalizePath(link.href);
    if (seen.has(path)) return;
    seen.add(path);
    result.push({ ...link, href: path });
  };

  for (const link of links) {
    addLink(link);
  }

  const citySlug = ctx.citySlug;
  const cityName = ctx.cityName;

  if (citySlug && cityName) {
    const longtailSlugs = SEO_LONGTAIL_KEYWORDS.map((k) => k.slug).filter(
      (s) => s !== ctx.keywordSlug,
    );
    for (const kw of longtailSlugs) {
      if (result.filter((l) => l.group === "longtail").length >= 6) break;
      addLink({
        title: `${titleCaseFromSlug(kw)} in ${cityName}`,
        href: `/${kw}/${citySlug}`,
        group: "longtail",
      });
    }

    const categories = await db.category.findMany({
      where: { isActive: true },
      orderBy: { listingCount: "desc" },
      take: 8,
      select: { slug: true, name: true },
    });
    for (const cat of categories) {
      if (result.filter((l) => l.group === "category").length >= 6) break;
      addLink({
        title: `${cat.name} in ${cityName}`,
        href: `/${cat.slug}/${citySlug}`,
        group: "category",
      });
    }

    if (ctx.stateId) {
      const nearby = await db.city.findMany({
        where: { isActive: true, slug: { not: citySlug }, stateId: ctx.stateId },
        orderBy: { listingCount: "desc" },
        take: 8,
        select: { slug: true, name: true },
      });
      for (const c of nearby) {
        if (result.filter((l) => l.group === "city").length >= 6) break;
        if (ctx.keywordSlug) {
          addLink({
            title: `${titleCaseFromSlug(ctx.keywordSlug)} in ${c.name}`,
            href: `/${ctx.keywordSlug}/${c.slug}`,
            group: "city",
          });
        } else if (ctx.countrySlug && ctx.stateSlug) {
          addLink({
            title: `Listings in ${c.name}`,
            href: `/${ctx.countrySlug}/${ctx.stateSlug}/${c.slug}`,
            group: "city",
          });
        }
      }
    }

    if (ctx.countrySlug && ctx.stateSlug) {
      addLink({
        title: `All listings in ${cityName}`,
        href: `/${ctx.countrySlug}/${ctx.stateSlug}/${citySlug}`,
        group: "city",
      });
    }
  }

  if (ctx.pageType === "category" && ctx.categorySlug) {
    const topCities = await db.city.findMany({
      where: { isActive: true },
      orderBy: { listingCount: "desc" },
      take: 8,
      select: { slug: true, name: true },
    });
    for (const city of topCities) {
      if (result.filter((l) => l.group === "longtail").length >= 6) break;
      for (const kw of SEO_LONGTAIL_KEYWORDS.slice(0, 4)) {
        addLink({
          title: `${kw.keyword} in ${city.name}`,
          href: `/${kw.slug}/${city.slug}`,
          group: "longtail",
        });
      }
    }
  }

  if (ctx.pageType === "country" && ctx.countrySlug) {
    for (const kw of SEO_LONGTAIL_KEYWORDS) {
      if (result.filter((l) => l.group === "longtail").length >= 6) break;
      const topCity = await db.city.findFirst({
        where: { isActive: true, state: { country: { slug: ctx.countrySlug } } },
        orderBy: { listingCount: "desc" },
        select: { slug: true, name: true },
      });
      if (topCity) {
        addLink({
          title: `${kw.keyword} in ${topCity.name}`,
          href: `/${kw.slug}/${topCity.slug}`,
          group: "longtail",
        });
      }
    }
  }

  while (result.length < minRelated) {
    const kw = SEO_LONGTAIL_KEYWORDS[result.length % SEO_LONGTAIL_KEYWORDS.length]!;
    const city =
      citySlug ??
      (
        await db.city.findFirst({
          where: { isActive: true },
          orderBy: { listingCount: "desc" },
          select: { slug: true, name: true },
        })
      )?.slug;
    if (!city) break;
    addLink({
      title: `${kw.keyword} listings`,
      href: `/${kw.slug}/${city}`,
      group: "longtail",
    });
    if (result.length >= 24) break;
  }

  return result.slice(0, 24);
}

export async function finalizeRelatedLinks(
  links: SeoRelatedLink[],
  ctx: SupplementContext,
): Promise<SeoRelatedLink[]> {
  const supplemented = await supplementRelatedLinks(links, ctx, 12);
  return supplemented;
}

export function collectOutboundHrefs(input: {
  breadcrumbs: SeoBreadcrumbItem[];
  relatedLinks: SeoRelatedLink[];
}): string[] {
  const hrefs: string[] = [];
  for (const b of input.breadcrumbs) {
    if (b.href) hrefs.push(b.href);
  }
  for (const l of input.relatedLinks) {
    hrefs.push(l.href);
  }
  return hrefs;
}

export function getPublicPathForPage(pageType: string, pageSlug: string, canonicalUrl?: string | null): string {
  if (pageType === "country") {
    return `/country/${pageSlug}`;
  }
  if (canonicalUrl?.trim()) {
    return normalizePath(canonicalUrl);
  }
  return normalizePath(getSeoPagePublicUrl({ pageType, pageSlug, canonicalUrl }));
}

// ---------------------------------------------------------------------------
// Central internal link builder — all SEO generators should use these helpers
// ---------------------------------------------------------------------------

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export type BrokenInternalLink = {
  sourcePageId?: string;
  sourcePageSlug?: string;
  sourcePageType?: string;
  anchor: string;
  brokenUrl: string;
  suggestedReplacement: string | null;
};

export type LinkBuildContext = {
  citySlug?: string;
  stateSlug?: string;
  countrySlug?: string;
  categorySlug?: string;
  keywordSlug?: string;
  pageType?: string;
  pageSlug?: string;
};

/** Reset slug caches (e.g. after bulk geo seed). */
export function clearSlugCaches(): void {
  slugCaches = null;
}

/** Legacy ISO alias `/in/...` — invalid in rendered HTML (404). Always rewrite to `india`. */
export function rewriteLegacyInPaths(text: string): string {
  if (!text.includes("/in/") && !text.includes('"/in') && !text.includes("'/in")) {
    return text;
  }
  return text
    .replace(/(^|["'(])\/in\//g, "$1/india/")
    .replace(/(^|["'(])\/in(["')/])/g, "$1/country/india$2");
}

/** Map legacy ISO alias `/in/...` to live country slug `india`. */
function resolveLegacyCountryAlias(path: string): string {
  if (path === "/in") return "/country/india";
  if (path.startsWith("/in/")) return `/india${path.slice(3)}`;
  return path;
}

/** True when href uses the invalid `/in/` prefix (must be rewritten before render/save). */
export function hasLegacyInPath(href: string): boolean {
  const path = normalizePath(href);
  return path === "/in" || path.startsWith("/in/");
}

/**
 * Build and validate an internal URL. Returns the normalized href or null when
 * the destination cannot resolve to a live public route.
 */
export async function getValidInternalLink(
  href: string,
  _context?: LinkBuildContext,
): Promise<string | null> {
  const caches = await loadSlugCaches();
  let path = normalizePublicSeoPath(href, caches);
  path = resolveLegacyCountryAlias(path);
  path = normalizePublicSeoPath(path, caches);
  if (!(await validateInternalHref(path))) return null;
  return path;
}

export function extractMarkdownLinks(
  content: string,
): Array<{ anchor: string; url: string; fullMatch: string }> {
  const links: Array<{ anchor: string; url: string; fullMatch: string }> = [];
  const re = new RegExp(MARKDOWN_LINK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    links.push({
      anchor: match[1]!,
      url: match[2]!.trim(),
      fullMatch: match[0]!,
    });
  }
  return links;
}

/** Count unique internal URLs in visible intro markdown — single source for dashboard + issues. */
export function calculateInternalLinksCount(introContent: string | null | undefined): number {
  const seen = new Set<string>();
  for (const link of extractMarkdownLinks(introContent ?? "")) {
    const path = normalizePath(link.url);
    if (path && path !== "#") seen.add(path);
  }
  return seen.size;
}

const FALLBACK_INTERNAL_LINKS: Array<{ text: string; url: string }> = [
  { text: "Escorts nationwide", url: "/category/escorts" },
  { text: "Massage listings", url: "/category/massage" },
  { text: "Dating connections", url: "/category/dating" },
  { text: "Adult jobs board", url: "/category/adult-jobs" },
  { text: "Adult services index", url: "/category/adult-services" },
  { text: "Male escorts", url: "/category/male-escorts" },
  { text: "Couples listings", url: "/category/couples" },
  { text: "Browse India directory", url: "/country/india" },
  { text: "Mumbai listings", url: "/escorts/mumbai" },
  { text: "Delhi listings", url: "/escorts/delhi" },
  { text: "Bangalore listings", url: "/escorts/bangalore" },
  { text: "Hyderabad listings", url: "/escorts/hyderabad" },
  { text: "Chennai listings", url: "/escorts/chennai" },
  { text: "Kolkata listings", url: "/escorts/kolkata" },
  { text: "Pune listings", url: "/escorts/pune" },
  { text: "Ahmedabad listings", url: "/escorts/ahmedabad" },
  { text: "Jaipur listings", url: "/escorts/jaipur" },
  { text: "Lucknow listings", url: "/escorts/lucknow" },
  { text: "Kochi listings", url: "/escorts/kochi" },
  { text: "Indore listings", url: "/escorts/indore" },
  { text: "Nagpur listings", url: "/escorts/nagpur" },
  { text: "Vadodara listings", url: "/escorts/vadodara" },
];

/**
 * Embed markdown internal links into intro until the visible count meets the target.
 * Uses sanitized metadata links first, then site-wide fallbacks.
 */
export function ensureIntroInternalLinks(
  introContent: string,
  candidates: Array<{ text: string; url: string }> = [],
  target = MIN_INTERNAL_LINKS_PER_PAGE,
): string {
  const seen = new Set<string>();
  for (const link of extractMarkdownLinks(introContent)) {
    const path = normalizePath(link.url);
    if (path && path !== "#") seen.add(path);
  }

  if (seen.size >= target) return introContent;

  const toAdd: Array<{ text: string; url: string }> = [];
  const candidateList =
    candidates.length > 0 ? candidates : FALLBACK_INTERNAL_LINKS;
  for (const link of candidateList) {
    if (seen.size >= target) break;
    const path = normalizePath(link.url);
    if (!path || path === "#" || seen.has(path)) continue;
    seen.add(path);
    toAdd.push(link);
  }

  if (toAdd.length === 0) return introContent;

  const lines = toAdd.map((l) => `- [${l.text}](${l.url})`);
  return `${introContent.trim()}\n\n## Related Pages\n\n${lines.join("\n")}`;
}

async function resolveValidLinkCandidates(
  metadataLinks: Array<{ text: string; url: string }>,
  context: LinkBuildContext,
): Promise<Array<{ text: string; url: string }>> {
  const seen = new Set<string>();
  const result: Array<{ text: string; url: string }> = [];
  for (const link of [...metadataLinks, ...FALLBACK_INTERNAL_LINKS]) {
    const valid = await getValidInternalLink(link.url, context);
    if (!valid || seen.has(valid)) continue;
    seen.add(valid);
    result.push({ text: link.text, url: valid });
  }
  return result;
}

/**
 * Ensure intro meets the link target, then sanitize for storage.
 * Re-embeds links if sanitization strips invalid URLs (upsertSeoPage runs the same sanitizer).
 */
export async function finalizeIntroForPersistence(
  introContent: string,
  pageType: string,
  pageSlug: string,
  metadataLinks: Array<{ text: string; url: string }> = [],
  target = MIN_INTERNAL_LINKS_PER_PAGE,
): Promise<string> {
  const context = buildLinkContextFromPage(pageType, pageSlug);
  const candidates = await resolveValidLinkCandidates(metadataLinks, context);
  let intro = introContent;
  for (let attempt = 0; attempt < 6; attempt++) {
    intro = ensureIntroInternalLinks(intro, candidates, target);
    const sanitized = await sanitizeStoredIntroContent(intro, pageType, pageSlug);
    if (calculateInternalLinksCount(sanitized) >= target) return sanitized;
    intro = sanitized;
  }
  return intro;
}

export function buildLinkContextFromPage(pageType: string, pageSlug: string): LinkBuildContext {
  if (pageType === "city") {
    return { pageType, pageSlug, citySlug: pageSlug };
  }
  const slash = pageSlug.indexOf("/");
  if (slash >= 0) {
    const first = pageSlug.slice(0, slash);
    const citySlug = pageSlug.slice(slash + 1);
    if (pageType === "category_city") {
      return { pageType, pageSlug, citySlug, categorySlug: first };
    }
    if (pageType === "longtail") {
      return { pageType, pageSlug, citySlug, keywordSlug: first };
    }
    if (pageType === "state") {
      return { pageType, pageSlug, countrySlug: first, stateSlug: citySlug };
    }
  }
  return { pageType, pageSlug };
}

let publishedTwoSegmentCache: Set<string> | null = null;

async function loadPublishedTwoSegmentSlugs(): Promise<Set<string>> {
  if (!publishedTwoSegmentCache) {
    const pages = await db.seoPage.findMany({
      where: {
        isPublished: true,
        pageType: { in: ["longtail", "category_city"] },
      },
      select: { pageSlug: true },
    });
    publishedTwoSegmentCache = new Set(pages.map((p) => `/${p.pageSlug.replace(/\/+/g, "/")}`));
  }
  return publishedTwoSegmentCache;
}

/** Prefer published SEO pages (longtail / category_city) for a city context. */
export async function findPreferredCitySeoLink(
  citySlug: string,
  excludePath?: string,
): Promise<string | null> {
  const published = await loadPublishedTwoSegmentSlugs();
  const normalizedExclude = excludePath ? normalizePath(excludePath) : null;

  for (const kw of SEO_LONGTAIL_KEYWORDS) {
    const candidate = `/${kw.slug}/${citySlug}`;
    if (normalizedExclude && normalizePath(candidate) === normalizedExclude) continue;
    if (published.has(candidate)) {
      const valid = await getValidInternalLink(candidate);
      if (valid) return valid;
    }
  }

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { listingCount: "desc" },
    take: 12,
    select: { slug: true },
  });
  for (const cat of categories) {
    const candidate = `/${cat.slug}/${citySlug}`;
    if (normalizedExclude && normalizePath(candidate) === normalizedExclude) continue;
    if (published.has(candidate)) {
      const valid = await getValidInternalLink(candidate);
      if (valid) return valid;
    }
  }

  const caches = await loadSlugCaches();
  const geo = caches.cityPaths.get(citySlug);
  if (geo) {
    const valid = await getValidInternalLink(geo);
    if (valid && valid !== normalizedExclude) return valid;
  }

  for (const kw of SEO_LONGTAIL_KEYWORDS) {
    const candidate = `/${kw.slug}/${citySlug}`;
    if (normalizedExclude && normalizePath(candidate) === normalizedExclude) continue;
    const valid = await getValidInternalLink(candidate);
    if (valid) return valid;
  }

  for (const cat of categories) {
    const candidate = `/${cat.slug}/${citySlug}`;
    if (normalizedExclude && normalizePath(candidate) === normalizedExclude) continue;
    const valid = await getValidInternalLink(candidate);
    if (valid) return valid;
  }

  return null;
}

export async function findReplacementLink(
  brokenHref: string,
  _anchor: string,
  context: LinkBuildContext,
): Promise<string | null> {
  const citySlug = context.citySlug;
  if (!citySlug) return null;
  return findPreferredCitySeoLink(citySlug, brokenHref);
}

export async function findBrokenLinksInContent(
  content: string,
  context: LinkBuildContext = {},
): Promise<BrokenInternalLink[]> {
  const broken: BrokenInternalLink[] = [];
  for (const link of extractMarkdownLinks(content)) {
    const legacy = hasLegacyInPath(link.url);
    const valid = legacy ? null : await getValidInternalLink(link.url, context);
    if (!valid) {
      const suggested = legacy
        ? resolveLegacyCountryAlias(normalizePath(link.url))
        : await findReplacementLink(link.url, link.anchor, context);
      broken.push({
        sourcePageSlug: context.pageSlug,
        sourcePageType: context.pageType,
        anchor: link.anchor,
        brokenUrl: link.url,
        suggestedReplacement: suggested,
      });
    }
  }
  return broken;
}

export async function sanitizeMarkdownLinksInContent(
  content: string,
  context: LinkBuildContext = {},
): Promise<{ content: string; fixed: number; removed: number }> {
  let output = rewriteLegacyInPaths(content);
  let fixed = output !== content ? 1 : 0;
  let removed = 0;

  for (const link of extractMarkdownLinks(output)) {
    let targetUrl = link.url;
    if (hasLegacyInPath(targetUrl)) {
      targetUrl = resolveLegacyCountryAlias(normalizePath(targetUrl));
    }

    const valid = await getValidInternalLink(targetUrl, context);
    if (valid) {
      if (valid !== normalizePath(link.url)) {
        output = output.replace(link.fullMatch, `[${link.anchor}](${valid})`);
        fixed++;
      }
      continue;
    }

    const replacement = await findReplacementLink(link.url, link.anchor, context);
    if (replacement) {
      output = output.replace(link.fullMatch, `[${link.anchor}](${replacement})`);
      fixed++;
    } else {
      output = output.replace(link.fullMatch, link.anchor);
      removed++;
    }
  }

  return { content: output, fixed, removed };
}

/** Sanitize stored intro/body text before any DB write or public render. */
export async function sanitizeStoredIntroContent(
  introContent: string,
  pageType: string,
  pageSlug: string,
): Promise<string> {
  if (!introContent?.trim()) return introContent;
  const context = buildLinkContextFromPage(pageType, pageSlug);
  const { content } = await sanitizeMarkdownLinksInContent(introContent, context);
  return content;
}

/** Sanitize JSON-LD / customData strings for legacy `/in/` paths. */
export function sanitizeStoredCustomData(customData: string | null | undefined): string | null {
  if (!customData?.trim()) return customData ?? null;
  return rewriteLegacyInPaths(customData);
}

async function sanitizeUrlEntries<T extends { url: string }>(
  entries: T[],
  context: LinkBuildContext,
  getText: (entry: T) => string,
): Promise<T[]> {
  const result: T[] = [];
  for (const entry of entries) {
    const valid = await getValidInternalLink(entry.url, context);
    if (valid) {
      result.push({ ...entry, url: valid });
      continue;
    }
    const replacement = await findReplacementLink(entry.url, getText(entry), context);
    if (replacement) {
      result.push({ ...entry, url: replacement });
    }
  }
  return result;
}

/** Sanitize all link-bearing fields on generated SEO content before persistence. */
export async function sanitizeSeoContentLinks(
  content: import("@/lib/seo-content").SEOContent,
  context: LinkBuildContext,
): Promise<import("@/lib/seo-content").SEOContent> {
  const intro = content.fullIntroContent ?? content.introParagraph;
  const { content: sanitizedIntro } = await sanitizeMarkdownLinksInContent(intro, context);

  const internalLinks = await sanitizeUrlEntries(
    content.internalLinks ?? [],
    context,
    (l) => l.text,
  );

  const breadcrumbItems = await sanitizeUrlEntries(
    content.breadcrumbItems ?? [],
    context,
    (b) => b.name,
  );

  const relatedPages = content.relatedPages
    ? await sanitizeUrlEntries(content.relatedPages, context, (p) => p.title)
    : undefined;

  const introParagraph = sanitizedIntro.split("\n\n")[0] ?? sanitizedIntro;

  return {
    ...content,
    introParagraph,
    fullIntroContent: sanitizedIntro,
    internalLinks,
    breadcrumbItems,
    relatedPages,
  };
}

export async function repairBrokenLinksInIntro(
  introContent: string,
  pageType: string,
  pageSlug: string,
): Promise<{ introContent: string; changed: boolean; fixed: number; removed: number }> {
  const context = buildLinkContextFromPage(pageType, pageSlug);
  const { content, fixed, removed } = await sanitizeMarkdownLinksInContent(introContent, context);
  return {
    introContent: content,
    changed: fixed > 0 || removed > 0,
    fixed,
    removed,
  };
}

export type PageWithBrokenLinks = {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  wordCount: number | null;
  internalLinksCount: number | null;
  seoQualityScore: number | null;
  updatedAt: Date;
  duplicateRisk: string | null;
  isPublished: boolean;
  brokenLinks: BrokenInternalLink[];
};

export async function scanPagesWithBrokenInternalLinks(input?: {
  pageIds?: string[];
  search?: string;
  pageType?: string;
  isPublished?: boolean;
}): Promise<PageWithBrokenLinks[]> {
  const where: import("@prisma/client").Prisma.SeoPageWhereInput = {};
  if (input?.pageIds?.length) where.id = { in: input.pageIds };
  if (input?.pageType) where.pageType = input.pageType;
  if (input?.isPublished === true) where.isPublished = true;
  if (input?.isPublished === false) where.isPublished = false;
  if (input?.search) {
    where.OR = [
      { title: { contains: input.search } },
      { pageSlug: { contains: input.search } },
    ];
  }

  const pages = await db.seoPage.findMany({
    where,
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      title: true,
      metaDescription: true,
      h1: true,
      canonicalUrl: true,
      wordCount: true,
      internalLinksCount: true,
      seoQualityScore: true,
      updatedAt: true,
      duplicateRisk: true,
      isPublished: true,
      introContent: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const affected: PageWithBrokenLinks[] = [];
  for (const page of pages) {
    if (!page.introContent?.trim()) continue;
    const context = buildLinkContextFromPage(page.pageType, page.pageSlug);
    const brokenLinks = await findBrokenLinksInContent(page.introContent, context);
    if (brokenLinks.length === 0) continue;
    const enriched = brokenLinks.map((b) => ({
      ...b,
      sourcePageId: page.id,
      sourcePageSlug: page.pageSlug,
      sourcePageType: page.pageType,
    }));
    const { introContent: _intro, ...rest } = page;
    affected.push({ ...rest, brokenLinks: enriched });
  }
  return affected;
}

export async function countBrokenInternalLinks(): Promise<number> {
  const pages = await db.seoPage.findMany({
    where: { introContent: { not: null } },
    select: { pageType: true, pageSlug: true, introContent: true },
  });
  let total = 0;
  for (const page of pages) {
    if (!page.introContent?.trim()) continue;
    const context = buildLinkContextFromPage(page.pageType, page.pageSlug);
    const broken = await findBrokenLinksInContent(page.introContent, context);
    total += broken.length;
  }
  return total;
}

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

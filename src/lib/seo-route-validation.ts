/**
 * Validates that SeoPage records map to real Next.js public routes.
 * Country pages must use /country/{slug}; category pages /category/{slug}; etc.
 */

import { db } from "@/lib/db";
import {
  getSeoPagePublicUrl,
  getServedPathForSeoPage,
} from "@/lib/seo-public-page";
import { validateInternalHref } from "@/lib/seo-internal-links";

export { getServedPathForSeoPage };

export type SeoPageRouteInput = {
  id?: string;
  pageType: string;
  pageSlug: string;
  canonicalUrl?: string | null;
  isPublished?: boolean;
};

export type SeoRouteCheck = {
  routable: boolean;
  publicPath: string;
  servedPath: string;
  reason?: string;
};

/** Expected canonical URL for persistence (must match served path). */
export function getExpectedCanonicalUrl(page: SeoPageRouteInput, servedPath?: string): string {
  return servedPath ?? getServedPathForSeoPage(page);
}

async function resolveServedPath(page: SeoPageRouteInput): Promise<string | null> {
  switch (page.pageType) {
    case "country":
      return `/country/${page.pageSlug}`;
    case "category":
      return `/category/${page.pageSlug}`;
    case "longtail":
    case "category_city":
      return `/${page.pageSlug}`;
    case "city": {
      const city = await db.city.findFirst({
        where: { slug: page.pageSlug, isActive: true },
        select: {
          slug: true,
          state: { select: { slug: true, country: { select: { slug: true } } } },
        },
      });
      if (!city?.state?.country) return null;
      return `/${city.state.country.slug}/${city.state.slug}/${city.slug}`;
    }
    case "state": {
      const state = await db.state.findFirst({
        where: { slug: page.pageSlug, isActive: true },
        select: { slug: true, country: { select: { slug: true } } },
      });
      if (!state?.country) return null;
      return `/${state.country.slug}/${state.slug}`;
    }
    default:
      return getServedPathForSeoPage(page);
  }
}

/** True when the backing entity exists and the served path resolves to a live route. */
export async function isSeoPageRoutable(page: SeoPageRouteInput): Promise<SeoRouteCheck> {
  const publicPath = getSeoPagePublicUrl(page);
  const servedPath = await resolveServedPath(page);

  if (!servedPath) {
    return {
      routable: false,
      publicPath,
      servedPath: getServedPathForSeoPage(page),
      reason: `Missing backing entity for ${page.pageType}/${page.pageSlug}`,
    };
  }

  const hrefValid = await validateInternalHref(servedPath);
  if (!hrefValid) {
    return {
      routable: false,
      publicPath,
      servedPath,
      reason: `No route handler for ${servedPath}`,
    };
  }

  return { routable: true, publicPath, servedPath };
}

export async function filterRoutableSeoPages<T extends SeoPageRouteInput>(
  pages: T[],
): Promise<{ routable: T[]; skipped: Array<T & { reason: string }> }> {
  const routable: T[] = [];
  const skipped: Array<T & { reason: string }> = [];

  for (const page of pages) {
    const check = await isSeoPageRoutable(page);
    if (check.routable) {
      routable.push(page);
    } else {
      skipped.push({ ...page, reason: check.reason ?? "not routable" });
    }
  }

  return { routable, skipped };
}

export async function assertAllSeoPagesRoutable(): Promise<{
  total: number;
  invalid: Array<SeoPageRouteInput & { reason: string; publicPath: string; servedPath: string }>;
}> {
  const pages = await db.seoPage.findMany({
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      canonicalUrl: true,
      isPublished: true,
    },
  });

  const invalid: Array<
    SeoPageRouteInput & { reason: string; publicPath: string; servedPath: string }
  > = [];

  for (const page of pages) {
    const check = await isSeoPageRoutable(page);
    if (!check.routable) {
      invalid.push({
        ...page,
        reason: check.reason ?? "not routable",
        publicPath: check.publicPath,
        servedPath: check.servedPath,
      });
    }
  }

  return { total: pages.length, invalid };
}

let unroutableIdsCache: { ids: Set<string>; at: number } | null = null;
const CACHE_MS = 60_000;

/** Bulk-resolve IDs of SeoPages with no live route (for dashboard/metrics filters). */
export async function listUnroutableSeoPageIds(forceRefresh = false): Promise<Set<string>> {
  if (
    !forceRefresh &&
    unroutableIdsCache &&
    Date.now() - unroutableIdsCache.at < CACHE_MS
  ) {
    return unroutableIdsCache.ids;
  }

  const pages = await db.seoPage.findMany({
    select: { id: true, pageType: true, pageSlug: true, canonicalUrl: true },
  });

  const [countries, categories, cities, states] = await Promise.all([
    db.country.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.city.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.state.findMany({ where: { isActive: true }, select: { slug: true } }),
  ]);

  const countrySet = new Set(countries.map((c) => c.slug));
  const categorySet = new Set(categories.map((c) => c.slug));
  const citySet = new Set(cities.map((c) => c.slug));
  const stateSet = new Set(states.map((s) => s.slug));

  const invalid = new Set<string>();

  for (const page of pages) {
    let routable = true;
    switch (page.pageType) {
      case "country":
        routable = countrySet.has(page.pageSlug);
        break;
      case "category":
        routable = categorySet.has(page.pageSlug);
        break;
      case "city":
        routable = citySet.has(page.pageSlug);
        break;
      case "state":
        routable = stateSet.has(page.pageSlug);
        break;
      case "longtail":
      case "category_city": {
        const slash = page.pageSlug.indexOf("/");
        const citySlug = slash >= 0 ? page.pageSlug.slice(slash + 1) : "";
        const first = slash >= 0 ? page.pageSlug.slice(0, slash) : page.pageSlug;
        if (!citySlug || !citySet.has(citySlug)) {
          routable = false;
          break;
        }
        if (page.pageType === "category_city") {
          routable = categorySet.has(first);
        }
        break;
      }
      default:
        routable = false;
    }
    if (!routable && page.id) invalid.add(page.id);
  }

  unroutableIdsCache = { ids: invalid, at: Date.now() };
  return invalid;
}

export function routableSeoPageWhere(
  unroutableIds: Set<string>,
): { id?: { notIn: string[] } } {
  if (unroutableIds.size === 0) return {};
  return { id: { notIn: [...unroutableIds] } };
}

/** Archive pages that cannot be served (unpublish + noindex). */
export async function archiveUnroutableSeoPages(): Promise<{
  scanned: number;
  archived: number;
  ids: string[];
}> {
  const pages = await db.seoPage.findMany({
    select: { id: true, pageType: true, pageSlug: true, canonicalUrl: true },
  });

  const toArchive: string[] = [];
  for (const page of pages) {
    const check = await isSeoPageRoutable(page);
    if (!check.routable && page.id) {
      toArchive.push(page.id);
    }
  }

  if (toArchive.length > 0) {
    await db.seoPage.updateMany({
      where: { id: { in: toArchive } },
      data: { isPublished: false, noindex: true },
    });
  }

  return { scanned: pages.length, archived: toArchive.length, ids: toArchive };
}

/** Fix country (and other) canonical URLs to match served paths. */
export async function repairSeoPageCanonicalUrls(): Promise<{
  scanned: number;
  repaired: number;
}> {
  const pages = await db.seoPage.findMany({
    select: { id: true, pageType: true, pageSlug: true, canonicalUrl: true },
  });

  let repaired = 0;
  for (const page of pages) {
    const check = await isSeoPageRoutable(page);
    if (!check.routable) continue;

    const expected = check.servedPath;
    const current = page.canonicalUrl?.trim();
    if (current === expected) continue;

    await db.seoPage.update({
      where: { id: page.id },
      data: { canonicalUrl: expected },
    });
    repaired++;
  }

  return { scanned: pages.length, repaired };
}

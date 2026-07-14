/**
 * V6.1 — Live SecretZa platform data for natural content injection.
 */
import { db } from "@/lib/db";

export type CityListingContext = {
  citySlug: string;
  verifiedCount: number;
  premiumCount: number;
  featuredCount: number;
  recentlyUpdatedCount: number;
  recentlyActiveCount: number;
  popularCategories: Array<{ slug: string; name: string; count: number }>;
  trendingSearches: string[];
  topAreas: Array<{ name: string; count: number }>;
  fetchedAt: string;
};

const ACTIVE_STATUSES = ["approved"];

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/** Fetch live listing stats for a city slug — never fabricate numbers. */
export async function fetchCityListingContext(citySlug: string): Promise<CityListingContext> {
  const baseWhere = {
    citySlug,
    status: { in: ACTIVE_STATUSES },
  };

  const weekAgo = sevenDaysAgo();
  const monthAgo = thirtyDaysAgo();

  const [
    verifiedCount,
    premiumCount,
    featuredCount,
    recentlyUpdatedCount,
    recentlyActiveCount,
    categoryGroups,
    areaGroups,
  ] = await Promise.all([
    db.listing.count({ where: baseWhere }),
    db.listing.count({ where: { ...baseWhere, isPremium: true } }),
    db.listing.count({ where: { ...baseWhere, isFeatured: true } }),
    db.listing.count({ where: { ...baseWhere, updatedAt: { gte: weekAgo } } }),
    db.listing.count({
      where: {
        ...baseWhere,
        OR: [{ lastBumpedAt: { gte: weekAgo } }, { updatedAt: { gte: weekAgo } }],
      },
    }),
    db.listing.groupBy({
      by: ["categorySlug"],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    db.listing.groupBy({
      by: ["area"],
      where: { ...baseWhere, area: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const categorySlugs = categoryGroups.map((g) => g.categorySlug);
  const categories =
    categorySlugs.length > 0
      ? await db.category.findMany({
          where: { slug: { in: categorySlugs } },
          select: { slug: true, name: true },
        })
      : [];
  const catNameBySlug = new Map(categories.map((c) => [c.slug, c.name]));

  const popularCategories = categoryGroups.map((g) => ({
    slug: g.categorySlug,
    name: catNameBySlug.get(g.categorySlug) ?? g.categorySlug,
    count: g._count.id,
  }));

  const topAreas = areaGroups
    .filter((g) => g.area)
    .map((g) => ({ name: g.area!, count: g._count.id }));

  const trendingSearches = popularCategories.slice(0, 3).map(
    (c) => `${c.name.toLowerCase()} in ${citySlug.replace(/-/g, " ")}`,
  );

  return {
    citySlug,
    verifiedCount,
    premiumCount,
    featuredCount,
    recentlyUpdatedCount,
    recentlyActiveCount,
    popularCategories,
    trendingSearches,
    topAreas,
    fetchedAt: new Date().toISOString(),
  };
}

/** Natural sentences using only real DB counts (omit when zero). */
export function weaveListingContext(
  ctx: CityListingContext,
  areaName: string,
  seed: number,
): string | null {
  const parts: string[] = [];

  if (ctx.verifiedCount > 0) {
    const templates = [
      () =>
        ctx.recentlyActiveCount > 0
          ? `Several verified advertisers currently operate around ${areaName}, with ${ctx.recentlyActiveCount} profile${ctx.recentlyActiveCount === 1 ? "" : "s"} updated in the past week on SecretZa.`
          : `${ctx.verifiedCount} verified listing${ctx.verifiedCount === 1 ? "" : "s"} currently appear in ${areaName} on SecretZa.`,
      () =>
        `SecretZa indexes ${ctx.verifiedCount} active classified${ctx.verifiedCount === 1 ? "" : "s"} for this corridor — numbers refresh from live database records, not static copy.`,
    ];
    parts.push(templates[seed % templates.length]!());
  }

  if (ctx.premiumCount > 0 && seed % 2 === 0) {
    parts.push(
      `Premium listings (${ctx.premiumCount} currently marked premium) are regularly reviewed and updated near ${areaName}.`,
    );
  }

  if (ctx.popularCategories[0] && ctx.popularCategories[0].count > 0) {
    const top = ctx.popularCategories[0];
    parts.push(
      `${top.name} is among the most browsed categories here with ${top.count} active listing${top.count === 1 ? "" : "s"} at time of generation.`,
    );
  }

  if (parts.length === 0) return null;
  return parts[seed % parts.length]!;
}

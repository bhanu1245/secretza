import { db } from "@/lib/db";
import {
  buildTwoSegmentCanonicalUrl,
  isSingleSegmentSeoSlug,
  proposeSeoSlugRepair,
} from "@/lib/seo-longtail-slug";

const REPAIR_PAGE_TYPES = ["longtail", "category_city"] as const;

export type SeoUrlRepairEntry = {
  id: string;
  pageType: string;
  oldSlug: string;
  newSlug: string;
  oldCanonicalUrl: string | null;
  newCanonicalUrl: string;
  willRepair: boolean;
  skipReason?: string;
};

export type SeoUrlRepairPreview = {
  brokenCount: number;
  repairableCount: number;
  skipCount: number;
  entries: SeoUrlRepairEntry[];
};

export type SeoUrlRepairResult = {
  processed: number;
  repaired: number;
  skipped: number;
  entries: SeoUrlRepairEntry[];
};

export function resolveSeoUrlRepairAccess(role: string | undefined): 401 | 403 | null {
  if (!role) return 401;
  if (role.toLowerCase() !== "admin") return 403;
  return null;
}

async function loadRepairContext() {
  const [cities, categories] = await Promise.all([
    db.city.findMany({ select: { slug: true } }),
    db.category.findMany({
      where: { isActive: true, parentId: null },
      select: { slug: true },
    }),
  ]);
  return {
    citySlugs: cities.map((c) => c.slug),
    categorySlugs: categories.map((c) => c.slug),
  };
}

export async function previewSeoUrlRepair(): Promise<SeoUrlRepairPreview> {
  const { citySlugs, categorySlugs } = await loadRepairContext();

  const brokenPages = await db.seoPage.findMany({
    where: {
      pageType: { in: [...REPAIR_PAGE_TYPES] },
    },
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      canonicalUrl: true,
    },
    orderBy: { pageSlug: "asc" },
  });

  const entries: SeoUrlRepairEntry[] = [];
  const existingSlugs = new Set(brokenPages.map((p) => `${p.pageType}:${p.pageSlug}`));

  for (const page of brokenPages) {
    if (!isSingleSegmentSeoSlug(page.pageSlug)) continue;

    const newSlug = proposeSeoSlugRepair(page.pageSlug, page.pageType, citySlugs, categorySlugs);
    if (!newSlug) {
      entries.push({
        id: page.id,
        pageType: page.pageType,
        oldSlug: page.pageSlug,
        newSlug: page.pageSlug,
        oldCanonicalUrl: page.canonicalUrl,
        newCanonicalUrl: page.canonicalUrl || `/${page.pageSlug}`,
        willRepair: false,
        skipReason: "Could not derive two-segment slug",
      });
      continue;
    }

    const newCanonicalUrl = buildTwoSegmentCanonicalUrl(...newSlug.split("/") as [string, string]);
    const conflictKey = `${page.pageType}:${newSlug}`;
    const hasConflict = existingSlugs.has(conflictKey);

    entries.push({
      id: page.id,
      pageType: page.pageType,
      oldSlug: page.pageSlug,
      newSlug,
      oldCanonicalUrl: page.canonicalUrl,
      newCanonicalUrl,
      willRepair: !hasConflict,
      skipReason: hasConflict ? "Target slug already exists" : undefined,
    });
  }

  const repairableCount = entries.filter((e) => e.willRepair).length;
  const skipCount = entries.length - repairableCount;

  return {
    brokenCount: entries.length,
    repairableCount,
    skipCount,
    entries,
  };
}

const REPAIR_DIAG = "[SEO-REPAIR-DIAG]";

export async function repairSeoUrlStructure(): Promise<SeoUrlRepairResult> {
  const preview = await previewSeoUrlRepair();
  let repaired = 0;
  let skipped = 0;

  const repairableEntries = preview.entries.filter((e) => e.willRepair);
  console.log(`${REPAIR_DIAG} repairSeoUrlStructure — total repairable pages: ${repairableEntries.length}`);

  for (const entry of preview.entries) {
    if (!entry.willRepair) {
      skipped++;
      continue;
    }

    console.log(`${REPAIR_DIAG} updating page id=${entry.id} oldSlug=${entry.oldSlug} newSlug=${entry.newSlug}`);

    try {
      await db.seoPage.update({
        where: { id: entry.id },
        data: {
          pageSlug: entry.newSlug,
          canonicalUrl: entry.newCanonicalUrl,
        },
      });
      console.log(`${REPAIR_DIAG} db update success id=${entry.id}`);
      repaired++;
    } catch (error) {
      console.error(`${REPAIR_DIAG} db update failed id=${entry.id}:`, error);
      throw error;
    }
  }

  console.log(`${REPAIR_DIAG} repairSeoUrlStructure done — repaired: ${repaired}, skipped: ${skipped}`);

  return {
    processed: preview.entries.length,
    repaired,
    skipped,
    entries: preview.entries,
  };
}

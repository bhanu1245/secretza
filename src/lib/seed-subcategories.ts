import type { PrismaClient } from "@prisma/client";
import {
  buildSubcategorySeo,
  CATEGORY_TAXONOMY,
  EXTRA_ROOT_CATEGORIES,
  type ParentCategoryDef,
  type SubcategoryDef,
} from "@/lib/category-taxonomy";

export type SeedSubcategoriesResult = {
  parentsCreated: number;
  parentsUpdated: number;
  subcategoriesCreated: number;
  subcategoriesUpdated: number;
  subcategoriesSkipped: number;
  parentsMissing: string[];
};

async function upsertRootCategory(
  db: PrismaClient,
  parent: Pick<ParentCategoryDef, "name" | "slug" | "order" | "icon" | "color" | "isFeatured">,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.category.findUnique({ where: { slug: parent.slug } });
  const data = {
    name: parent.name,
    description: `${parent.name} listings and services`,
    icon: parent.icon ?? "📁",
    color: parent.color ?? "#7C3AED",
    order: parent.order,
    isFeatured: parent.isFeatured ?? false,
    isActive: true,
    parentId: null as string | null,
  };

  if (existing) {
    await db.category.update({
      where: { slug: parent.slug },
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        order: data.order,
        isFeatured: data.isFeatured,
        isActive: true,
      },
    });
    return { id: existing.id, created: false };
  }

  const created = await db.category.create({
    data: {
      slug: parent.slug,
      ...data,
    },
  });
  return { id: created.id, created: true };
}

async function upsertSubcategory(
  db: PrismaClient,
  parent: ParentCategoryDef,
  parentId: string,
  child: SubcategoryDef,
): Promise<"created" | "updated" | "skipped"> {
  const seo = buildSubcategorySeo(parent.name, child.name);
  const existing = await db.category.findUnique({
    where: { slug: child.slug },
    select: { id: true, parentId: true, createdAt: true, updatedAt: true },
  });

  if (existing) {
    // Preserve existing parent linkage and IDs — only refresh metadata.
    if (existing.parentId && existing.parentId !== parentId) {
      return "skipped";
    }

    await db.category.update({
      where: { slug: child.slug },
      data: {
        name: child.name,
        description: `${child.name} under ${parent.name}`,
        order: child.order,
        isActive: true,
        isFeatured: false,
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        ...(existing.parentId ? {} : { parentId }),
      },
    });
    return "updated";
  }

  await db.category.create({
    data: {
      name: child.name,
      slug: child.slug,
      description: `${child.name} under ${parent.name}`,
      order: child.order,
      isActive: true,
      isFeatured: false,
      parentId,
      seoTitle: seo.seoTitle,
      seoDescription: seo.seoDescription,
      color: "#7C3AED",
    },
  });
  return "created";
}

/**
 * Idempotent subcategory expansion for Secretza.
 * - Never changes existing category IDs or root slugs.
 * - Does not touch listings.
 * - Safe to run multiple times.
 */
export async function seedSubcategories(db: PrismaClient): Promise<SeedSubcategoriesResult> {
  const result: SeedSubcategoriesResult = {
    parentsCreated: 0,
    parentsUpdated: 0,
    subcategoriesCreated: 0,
    subcategoriesUpdated: 0,
    subcategoriesSkipped: 0,
    parentsMissing: [],
  };

  for (const extra of EXTRA_ROOT_CATEGORIES) {
    const { created } = await upsertRootCategory(db, extra);
    if (created) result.parentsCreated++;
    else result.parentsUpdated++;
  }

  for (const parent of CATEGORY_TAXONOMY) {
    const root = await db.category.findUnique({
      where: { slug: parent.slug },
      select: { id: true },
    });

    if (!root) {
      result.parentsMissing.push(parent.slug);
      continue;
    }

    for (const child of parent.subcategories) {
      const outcome = await upsertSubcategory(db, parent, root.id, child);
      if (outcome === "created") result.subcategoriesCreated++;
      else if (outcome === "updated") result.subcategoriesUpdated++;
      else result.subcategoriesSkipped++;
    }
  }

  return result;
}

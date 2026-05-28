import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { order: "asc" },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { order: "asc" },
      },
    },
  });

  const categoryIds = categories.flatMap((category) => [
    category.id,
    ...category.children.map((child) => child.id),
  ]);
  const counts = categoryIds.length
    ? await db.listing.groupBy({
        by: ["categoryId"],
        where: {
          status: "approved",
          categoryId: { in: categoryIds },
        },
        _count: { _all: true },
      })
    : [];
  const subcategoryCounts = categoryIds.length
    ? await db.listing.groupBy({
        by: ["subcategoryId"],
        where: {
          status: "approved",
          subcategoryId: { in: categoryIds },
        },
        _count: { _all: true },
      })
    : [];
  const countByCategory = new Map<string, number>();
  for (const count of counts) {
    countByCategory.set(count.categoryId, (countByCategory.get(count.categoryId) || 0) + count._count._all);
  }
  for (const count of subcategoryCounts) {
    if (!count.subcategoryId) continue;
    countByCategory.set(count.subcategoryId, (countByCategory.get(count.subcategoryId) || 0) + count._count._all);
  }

  const withCounts = categories.map((category) => {
    const children = category.children.map((child) => ({
      ...child,
      listingCount: countByCategory.get(child.id) || 0,
    }));
    return {
      ...category,
      children,
      listingCount:
        (countByCategory.get(category.id) || 0) +
        children.reduce((sum, child) => sum + child.listingCount, 0),
    };
  });

  return NextResponse.json({
    categories: withCounts,
    total: withCounts.length,
  });
}

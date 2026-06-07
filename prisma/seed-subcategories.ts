// ==========================================
// Secretza Subcategory Seed Script
// ==========================================
// Expands existing root categories with SEO-friendly subcategories.
// Run with: bunx tsx prisma/seed-subcategories.ts
//
// Idempotent: safe to run multiple times.
// Does NOT modify listings or existing category IDs.
// ==========================================

import { PrismaClient } from "@prisma/client";
import { seedSubcategories } from "../src/lib/seed-subcategories";

const db = new PrismaClient();

async function main() {
  console.log("📂 Seeding Secretza subcategories...\n");
  const result = await seedSubcategories(db);

  console.log(`   Parents created: ${result.parentsCreated}`);
  console.log(`   Parents updated: ${result.parentsUpdated}`);
  console.log(`   Subcategories created: ${result.subcategoriesCreated}`);
  console.log(`   Subcategories updated: ${result.subcategoriesUpdated}`);
  if (result.subcategoriesSkipped > 0) {
    console.log(`   Subcategories skipped (parent conflict): ${result.subcategoriesSkipped}`);
  }
  if (result.parentsMissing.length > 0) {
    console.warn(`   ⚠️  Missing parent slugs: ${result.parentsMissing.join(", ")}`);
  }

  const total = await db.category.count();
  const roots = await db.category.count({ where: { parentId: null } });
  const children = await db.category.count({ where: { parentId: { not: null } } });
  console.log(`\n✅ Category totals — roots: ${roots}, subcategories: ${children}, all: ${total}`);
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

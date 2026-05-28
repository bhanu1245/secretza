// ==========================================
// Secretza Master Seed Script
// ==========================================
// Seeds all database data for the application.
// Run with: bunx tsx prisma/seed.ts
//
// Strategy:
//   1. Seeds comprehensive world geo data (50+ countries, 200+ states, 800+ cities)
//   2. Seeds initial categories
//
// The geo seeder is idempotent - safe to run multiple times.
// ==========================================

import { PrismaClient } from "@prisma/client";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedGeoData } from "../src/lib/seed-geo";

const db = new PrismaClient();

const DEFAULT_ADMIN = {
  email: "admin@secretza.com",
  password: "Admin@123",
  name: "Secretza Admin",
};

// ==========================================
// Categories
// ==========================================
const CATEGORIES = [
  { name: "Escorts", slug: "escorts", icon: "👩", color: "#7C3AED", order: 1, isFeatured: true },
  { name: "Massage", slug: "massage", icon: "💆", color: "#EC4899", order: 2, isFeatured: true },
  { name: "Dating", slug: "dating", icon: "💑", color: "#F43F5E", order: 3, isFeatured: true },
  { name: "Companionship", slug: "companionship", icon: "🤝", color: "#10B981", order: 4, isFeatured: true },
  { name: "Adult Services", slug: "adult-services", icon: "⚡", color: "#F59E0B", order: 5, isFeatured: true },
  { name: "Striptease", slug: "striptease", icon: "🎵", color: "#8B5CF6", order: 6, isFeatured: false },
  { name: "BDSM", slug: "bdsm", icon: "🔗", color: "#6366F1", order: 7, isFeatured: false },
  { name: "Fetish", slug: "fetish", icon: "🔥", color: "#DC2626", order: 8, isFeatured: false },
  { name: "Webcam", slug: "webcam", icon: "📷", color: "#0891B2", order: 9, isFeatured: false },
  { name: "Phone & Sexting", slug: "phone-sexting", icon: "📱", color: "#059669", order: 10, isFeatured: false },
  { name: "Events & Parties", slug: "events-parties", icon: "🎉", color: "#D946EF", order: 11, isFeatured: false },
  { name: "Gigolo", slug: "gigolo", icon: "🤵", color: "#0EA5E9", order: 12, isFeatured: false },
];

async function seedCategories() {
  console.log(`\n📂 Seeding ${CATEGORIES.length} categories...`);

  let created = 0;
  let updated = 0;

  for (const cat of CATEGORIES) {
    const result = await db.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: `${cat.name} listings and services`,
        icon: cat.icon,
        color: cat.color,
        order: cat.order,
        isFeatured: cat.isFeatured,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: `${cat.name} listings and services`,
        icon: cat.icon,
        color: cat.color,
        order: cat.order,
        isFeatured: cat.isFeatured,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`   ✅ Categories: ${created} created, ${updated} updated`);
}

async function seedDefaultAdmin() {
  console.log(`\n🔐 Seeding default admin user...`);

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  const admin = await db.user.upsert({
    where: { email: DEFAULT_ADMIN.email },
    update: {
      name: DEFAULT_ADMIN.name,
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
      isSuspended: false,
      provider: "email",
      emailVerified: new Date(),
      sessionVersion: { increment: 1 },
    },
    create: {
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
      isSuspended: false,
      provider: "email",
      emailVerified: new Date(),
    },
  });

  console.log(`   ✅ Admin ready: ${admin.email} (${admin.role})`);
}

async function main() {
  console.log("🌱 Secretza Master Seed\n");

  // 0. Seed default admin login
  await seedDefaultAdmin();

  // 1. Seed comprehensive geo data
  await seedGeoData();

  // 2. Seed categories
  await seedCategories();

  console.log("\n🎉 All seed data complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

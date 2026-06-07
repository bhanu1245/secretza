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
import { randomUUID } from "crypto";
import { seedGeoData } from "../src/lib/seed-geo";
import { seedSubcategories } from "../src/lib/seed-subcategories";

const db = new PrismaClient();

const PRICING_PLANS = [
  {
    name: "Basic",
    slug: "basic",
    description: "Standard listing visibility for new posts",
    price: 0,
    durationDays: 7,
    featuredDays: 0,
    boostDays: 0,
    listingLimit: 1,
    imageLimit: 3,
    premiumBadge: false,
    priorityScore: 0,
    features: ["1 active listing", "3 images", "7-day duration", "Basic search visibility"],
    sortOrder: 1,
  },
  {
    name: "Featured",
    slug: "featured",
    description: "Better placement with featured visibility",
    price: 999,
    durationDays: 14,
    featuredDays: 14,
    boostDays: 3,
    listingLimit: 1,
    imageLimit: 8,
    premiumBadge: false,
    priorityScore: 25,
    features: ["Featured badge", "8 images", "Priority in category pages", "3 boost days"],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: "Premium",
    slug: "premium",
    description: "Maximum visibility with premium badge and boosts",
    price: 2499,
    durationDays: 30,
    featuredDays: 30,
    boostDays: 10,
    listingLimit: 5,
    imageLimit: 20,
    premiumBadge: true,
    priorityScore: 75,
    features: ["Premium badge", "5 listings", "20 images per listing", "Top search priority", "10 boost days"],
    sortOrder: 3,
  },
];

const CMS_PAGES = [
  { title: "Terms & Conditions", slug: "terms", excerpt: "Rules for using Secretza.", content: "<p>These Terms & Conditions govern your use of Secretza. Users must comply with all applicable laws and platform policies.</p>" },
  { title: "Privacy Policy", slug: "privacy", excerpt: "How Secretza handles user data.", content: "<p>Secretza respects your privacy and only collects data needed to operate the platform, provide support, and keep users safe.</p>" },
  { title: "About Us", slug: "about", excerpt: "Learn about Secretza.", content: "<p>Secretza is a premium classified platform focused on secure publishing, moderation, and discoverability.</p>" },
  { title: "Contact", slug: "contact", excerpt: "Contact Secretza support.", content: "<p>For support, moderation, or business inquiries, contact the Secretza admin team.</p>" },
  { title: "Safety Tips", slug: "safety-tips", excerpt: "Practical safety guidance.", content: "<p>Always verify information, protect your privacy, and report suspicious behavior to moderators.</p>" },
  { title: "FAQ", slug: "faq", excerpt: "Common Secretza questions.", content: "<p>Find answers about listings, moderation, upgrades, payments, and account safety.</p>" },
  { title: "DMCA", slug: "dmca", excerpt: "Copyright and takedown policy.", content: "<p>Secretza respects intellectual property rights. To submit a DMCA notice, contact our admin team with proof of ownership and the infringing URL.</p>" },
  { title: "Advertise", slug: "advertise", excerpt: "Promote your business on Secretza.", content: "<p>Reach premium audiences with featured listings, boosts, and banner placements. Contact us for advertising packages and partnership opportunities.</p>" },
];

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
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Secretza Admin";

  if (!adminEmail && !adminPassword) {
    console.log("\n🔐 Skipping admin seed: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set.");
    return;
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("Both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed an admin user.");
  }

  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }

  console.log(`\n🔐 Seeding configured admin user...`);

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
      isSuspended: false,
      provider: "email",
      emailVerified: new Date(),
      sessionVersion: { increment: 1 },
    },
    create: {
      name: adminName,
      email: adminEmail,
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

async function seedPricingPlans() {
  console.log(`\n💳 Seeding ${PRICING_PLANS.length} pricing plans...`);
  for (const plan of PRICING_PLANS) {
    const existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM PricingPlan WHERE slug = ${plan.slug} LIMIT 1
    `;
    const now = new Date();
    if (existing[0]) {
      await db.$executeRaw`
        UPDATE PricingPlan SET
          name = ${plan.name},
          description = ${plan.description},
          price = ${plan.price},
          currency = ${"INR"},
          durationDays = ${plan.durationDays},
          featuredDays = ${plan.featuredDays},
          boostDays = ${plan.boostDays},
          listingLimit = ${plan.listingLimit},
          imageLimit = ${plan.imageLimit},
          premiumBadge = ${plan.premiumBadge ? 1 : 0},
          priorityScore = ${plan.priorityScore},
          features = ${JSON.stringify(plan.features)},
          isActive = ${1},
          isPopular = ${plan.isPopular ? 1 : 0},
          sortOrder = ${plan.sortOrder},
          updatedAt = ${now}
        WHERE id = ${existing[0].id}
      `;
    } else {
      await db.$executeRaw`
        INSERT INTO PricingPlan (
          id, name, slug, description, price, currency, durationDays, featuredDays,
          boostDays, listingLimit, imageLimit, premiumBadge, priorityScore, features,
          isActive, isPopular, sortOrder, createdAt, updatedAt
        ) VALUES (
          ${randomUUID()}, ${plan.name}, ${plan.slug}, ${plan.description}, ${plan.price}, ${"INR"},
          ${plan.durationDays}, ${plan.featuredDays}, ${plan.boostDays}, ${plan.listingLimit},
          ${plan.imageLimit}, ${plan.premiumBadge ? 1 : 0}, ${plan.priorityScore},
          ${JSON.stringify(plan.features)}, ${1}, ${plan.isPopular ? 1 : 0}, ${plan.sortOrder}, ${now}, ${now}
        )
      `;
    }
  }
  console.log("   ✅ Pricing plans ready");
}

async function seedCmsPages() {
  console.log(`\n📄 Seeding ${CMS_PAGES.length} CMS pages...`);
  for (const page of CMS_PAGES) {
    const existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM CmsPage WHERE slug = ${page.slug} LIMIT 1
    `;
    const now = new Date();
    if (existing[0]) {
      await db.$executeRaw`
        UPDATE CmsPage SET
          title = ${page.title},
          excerpt = ${page.excerpt},
          content = ${page.content},
          seoTitle = ${`${page.title} | Secretza`},
          metaDescription = ${page.excerpt},
          isPublished = ${1},
          publishedAt = ${now},
          updatedAt = ${now}
        WHERE id = ${existing[0].id}
      `;
    } else {
      await db.$executeRaw`
        INSERT INTO CmsPage (
          id, title, slug, content, excerpt, seoTitle, metaDescription,
          isPublished, publishedAt, createdAt, updatedAt
        ) VALUES (
          ${randomUUID()}, ${page.title}, ${page.slug}, ${page.content}, ${page.excerpt},
          ${`${page.title} | Secretza`}, ${page.excerpt}, ${1}, ${now}, ${now}, ${now}
        )
      `;
    }
  }
  console.log("   ✅ CMS pages ready");
}

async function seedSocialSettings() {
  const { DEFAULT_SOCIAL_URLS, SOCIAL_SETTING_KEYS } = await import("../src/lib/footer-routes");
  const entries = [
    [SOCIAL_SETTING_KEYS.twitter, DEFAULT_SOCIAL_URLS.twitter],
    [SOCIAL_SETTING_KEYS.instagram, DEFAULT_SOCIAL_URLS.instagram],
    [SOCIAL_SETTING_KEYS.youtube, DEFAULT_SOCIAL_URLS.youtube],
    [SOCIAL_SETTING_KEYS.website, DEFAULT_SOCIAL_URLS.website],
  ] as const;
  for (const [key, value] of entries) {
    await db.siteSettings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  console.log("   ✅ Social settings ready");
}

async function main() {
  console.log("🌱 Secretza Master Seed\n");

  // 0. Optionally seed an admin login from SEED_ADMIN_* env vars.
  await seedDefaultAdmin();

  // 1. Seed comprehensive geo data
  await seedGeoData();

  // 2. Seed categories
  await seedCategories();

  // 2b. Expand categories with SEO subcategories (idempotent)
  const subResult = await seedSubcategories(db);
  console.log(
    `   ✅ Subcategories: ${subResult.subcategoriesCreated} created, ${subResult.subcategoriesUpdated} updated`,
  );
  if (subResult.parentsMissing.length > 0) {
    console.warn(`   ⚠️  Missing parent slugs: ${subResult.parentsMissing.join(", ")}`);
  }

  // 3. Seed pricing and CMS defaults
  await seedPricingPlans();
  await seedCmsPages();
  await seedSocialSettings();

  console.log("\n🎉 All seed data complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

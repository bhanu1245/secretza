import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  console.log("🚀 Seeding Secretza database...\n");

  // ==========================================
  // 1. Admin User
  // ==========================================
  const adminEmail = "admin@secretza.com";
  const adminPassword = "Admin123";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Secretza Admin",
        passwordHash,
        role: "admin",
        isVerified: true,
        emailVerified: new Date(),
        provider: "email",
        lastLoginAt: new Date(),
      },
    });
    console.log(`✅ Admin user created:`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     admin`);
    console.log();
  } else {
    console.log(`⏭️  Admin user already exists: ${adminEmail}`);
  }

  // ==========================================
  // 2. Moderator User
  // ==========================================
  const modEmail = "moderator@secretza.com";
  const modPassword = "Mod12345";

  const existingMod = await prisma.user.findUnique({
    where: { email: modEmail },
  });

  if (!existingMod) {
    const passwordHash = await bcrypt.hash(modPassword, 12);
    const modUser = await prisma.user.create({
      data: {
        email: modEmail,
        name: "Moderator",
        passwordHash,
        role: "moderator",
        isVerified: true,
        emailVerified: new Date(),
        provider: "email",
      },
    });
    console.log(`✅ Moderator user created:`);
    console.log(`   Email:    ${modUser.email}`);
    console.log(`   Password: ${modPassword}`);
    console.log(`   Role:     moderator`);
    console.log();
  } else {
    console.log(`⏭️  Moderator user already exists: ${modEmail}`);
  }

  // ==========================================
  // 3. Verified User
  // ==========================================
  const testEmail = "test@secretza.com";
  const testPassword = "Test1234";

  const existingTestUser = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (!existingTestUser) {
    const passwordHash = await bcrypt.hash(testPassword, 12);
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Test User",
        passwordHash,
        role: "user",
        isVerified: true,
        emailVerified: new Date(),
        provider: "email",
        lastLoginAt: new Date(),
      },
    });
    console.log(`✅ Verified test user created:`);
    console.log(`   Email:    ${testUser.email}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Role:     user (verified)`);
    console.log();
  } else {
    console.log(`⏭️  Verified test user already exists: ${testEmail}`);
  }

  // ==========================================
  // 4. Unverified User (for testing verification flow)
  // ==========================================
  const unverifiedEmail = "unverified@secretza.com";
  const unverifiedPassword = "Unverified123";

  const existingUnverified = await prisma.user.findUnique({
    where: { email: unverifiedEmail },
  });

  if (!existingUnverified) {
    const passwordHash = await bcrypt.hash(unverifiedPassword, 12);
    const unverifiedUser = await prisma.user.create({
      data: {
        email: unverifiedEmail,
        name: "Unverified User",
        passwordHash,
        role: "user",
        isVerified: false,
        provider: "email",
      },
    });
    console.log(`✅ Unverified user created:`);
    console.log(`   Email:    ${unverifiedUser.email}`);
    console.log(`   Password: ${unverifiedPassword}`);
    console.log(`   Role:     user (unverified)`);
    console.log();
  } else {
    console.log(`⏭️  Unverified user already exists: ${unverifiedEmail}`);
  }

  // ==========================================
  // 5. Suspended User (for testing suspension)
  // ==========================================
  const suspendedEmail = "suspended@secretza.com";
  const suspendedPassword = "Suspended123";

  const existingSuspended = await prisma.user.findUnique({
    where: { email: suspendedEmail },
  });

  if (!existingSuspended) {
    const passwordHash = await bcrypt.hash(suspendedPassword, 12);
    const suspendedUser = await prisma.user.create({
      data: {
        email: suspendedEmail,
        name: "Suspended User",
        passwordHash,
        role: "user",
        isVerified: true,
        emailVerified: new Date(),
        isSuspended: true,
        provider: "email",
      },
    });
    console.log(`✅ Suspended user created:`);
    console.log(`   Email:    ${suspendedUser.email}`);
    console.log(`   Password: ${suspendedPassword}`);
    console.log(`   Role:     user (suspended)`);
    console.log();
  } else {
    console.log(`⏭️  Suspended user already exists: ${suspendedEmail}`);
  }

  // ==========================================
  // 6. Premium User
  // ==========================================
  const premiumEmail = "premium@secretza.com";
  const premiumPassword = "Premium123";

  const existingPremium = await prisma.user.findUnique({
    where: { email: premiumEmail },
  });

  if (!existingPremium) {
    const passwordHash = await bcrypt.hash(premiumPassword, 12);
    const premiumUser = await prisma.user.create({
      data: {
        email: premiumEmail,
        name: "Premium User",
        passwordHash,
        role: "user",
        isVerified: true,
        emailVerified: new Date(),
        isPremium: true,
        premiumExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        provider: "email",
        lastLoginAt: new Date(),
      },
    });
    console.log(`✅ Premium user created:`);
    console.log(`   Email:    ${premiumUser.email}`);
    console.log(`   Password: ${premiumPassword}`);
    console.log(`   Role:     user (premium)`);
    console.log();
  } else {
    console.log(`⏭️  Premium user already exists: ${premiumEmail}`);
  }

    // ==========================================
  // Countries
  // ==========================================

  const india = await prisma.country.upsert({
    where: { slug: "india" },
    update: {},
    create: {
      name: "India",
      code: "IN",
      slug: "india",
      isActive: true,
    },
  });

  // ==========================================
  // States
  // ==========================================

  const maharashtra = await prisma.state.create({
    data: {
      name: "Maharashtra",
      slug: "maharashtra",
      countryId: india.id,
      isActive: true,
    },
  }).catch(async () => {
    return prisma.state.findFirst({
      where: {
        slug: "maharashtra",
      },
    });
  });

  // ==========================================
  // Cities
  // ==========================================

  await prisma.city.create({
    data: {
      name: "Mumbai",
      slug: "mumbai",
      stateId: maharashtra!.id,
      isActive: true,
      isFeatured: true,
    },
  }).catch(() => null);

  // ==========================================
  // Categories
  // ==========================================

  await prisma.category.upsert({
    where: { slug: "escorts" },
    update: {},
    create: {
      name: "Escorts",
      slug: "escorts",
      description: "Escort listings",
      isActive: true,
      isFeatured: true,
      color: "#7C3AED",
    },
  });

  await prisma.category.upsert({
    where: { slug: "massage" },
    update: {},
    create: {
      name: "Massage",
      slug: "massage",
      description: "Massage listings",
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: "dating" },
    update: {},
    create: {
      name: "Dating",
      slug: "dating",
      description: "Dating listings",
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: "trans" },
    update: {},
    create: {
      name: "Trans",
      slug: "trans",
      description: "Trans listings",
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: "male-escorts" },
    update: {},
    create: {
      name: "Male Escorts",
      slug: "male-escorts",
      description: "Male escort listings",
      isActive: true,
    },
  });

  console.log("🎉 Seed completed!\n");
  console.log("=========================================");
  console.log("Available test accounts:");
  console.log("=========================================");
  console.log("Admin:      admin@secretza.com / Admin123");
  console.log("Moderator:  moderator@secretza.com / Mod12345");
  console.log("Verified:   test@secretza.com / Test1234");
  console.log("Unverified: unverified@secretza.com / Unverified123");
  console.log("Suspended:  suspended@secretza.com / Suspended123");
  console.log("Premium:    premium@secretza.com / Premium123");
  console.log("=========================================\n");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

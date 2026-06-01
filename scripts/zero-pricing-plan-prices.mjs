import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? 'file:./prisma/db/custom.db' } } });
const r = await db.$executeRaw`UPDATE PricingPlan SET price = 0, durationDays = 0, featuredDays = 0, boostDays = 0, listingLimit = 0, imageLimit = 0, premiumBadge = 0, priorityScore = 0 WHERE slug IN ('featured', 'premium')`;
console.log('Rows updated:', r);
await db.$disconnect();

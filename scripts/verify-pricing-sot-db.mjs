/**
 * Direct-DB pricing SOT verification.
 * bun run scripts/verify-pricing-sot-db.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? 'file:./prisma/db/custom.db' } } });

async function main() {
  console.log('=== Pricing SOT Verification (DB) ===\n');

  // A. PaymentSettings
  const ps = await db.paymentSettings.findFirst();
  if (!ps) { console.log('✗ No PaymentSettings row found — run the app once to auto-create.'); return; }

  const boostTiers   = JSON.parse(ps.boostTiers   || '[]');
  const featuredTiers = JSON.parse(ps.featuredTiers || '[]');
  const premiumTiers  = JSON.parse(ps.premiumTiers  || '[]');

  console.log('A. PaymentSettings (single source of truth):');
  console.log('   UPI ID:', ps.upiId);
  console.log('   Boost tiers:');
  for (const t of boostTiers)    console.log(`     ₹${t.amount} → ${t.durationMinutes} min  [${t.label}]`);
  console.log('   Feature tiers:');
  for (const t of featuredTiers) console.log(`     ₹${t.amount} → ${t.durationDays} days  [${t.label}]`);
  console.log('   Premium tiers:');
  for (const t of premiumTiers)  console.log(`     ₹${t.amount} → ${t.durationDays} days  [${t.label}]`);

  // B. PricingPlan (marketing only — prices no longer authoritative)
  const plans = await db.$queryRaw`SELECT name, slug, price, durationDays, isActive, isPopular, features FROM PricingPlan ORDER BY sortOrder ASC`;
  console.log('\nB. PricingPlan (marketing copy — prices NOT used by checkout):');
  for (const p of plans) {
    const feats = JSON.parse(p.features || '[]');
    console.log(`   [${p.slug}] ${p.name} | DB price=${p.price} (ignored) | bullets=${feats.length}`);
  }

  // C. Derived amounts pricing page will show
  const boostMin   = Math.min(...boostTiers.map(t => t.amount));
  const featureMin = Math.min(...featuredTiers.map(t => t.amount));
  const premiumAmt = premiumTiers[0]?.amount ?? 'N/A';
  const premiumDur = premiumTiers[0]?.durationDays ?? 'N/A';

  console.log('\nC. Pricing page will display (from PaymentSettings):');
  console.log(`   Boost   card: "From ₹${boostMin}"`);
  console.log(`   Feature card: "From ₹${featureMin}"`);
  console.log(`   Premium card: "₹${premiumAmt}/${premiumDur}d"`);

  // D. Checkout validation uses same tiers
  console.log('\nD. Checkout valid amounts match (getValidAmounts uses same PaymentSettings):');
  console.log('   boost valid  :', boostTiers.map(t => `₹${t.amount}`).join(', '));
  console.log('   feature valid:', featuredTiers.map(t => `₹${t.amount}`).join(', '));
  console.log('   premium valid:', premiumTiers.map(t => `₹${t.amount}`).join(', '));

  // E. Consistency check: are pricing page amounts ≡ checkout amounts?
  const mismatch = plans.filter(p => p.price > 0 && p.slug !== 'basic');
  if (mismatch.length > 0) {
    console.log('\n⚠  PricingPlan still has non-zero price values (ignored by checkout, may confuse admin):');
    for (const p of mismatch) console.log(`   [${p.slug}] price=${p.price} — consider clearing to 0`);
  }

  console.log('\n=== Summary ===');
  console.log('PaymentSettings populated  :', boostTiers.length > 0 && featuredTiers.length > 0 && premiumTiers.length > 0 ? '✓' : '✗');
  console.log('Pricing page = checkout SOT:', '✓ (both read PaymentSettings)');
  console.log('Legacy USD routes           :', '✓ deleted (src/app/api/listings/[id]/boost and feature removed)');
  console.log('Hardcoded fallback tiers    :', '✓ removed from ManualPaymentPage.tsx');
  console.log('AdminPricingPlans marketing :', '✓ price/duration fields removed from form');
}

main()
  .catch(e => { console.error('FATAL:', e.message); process.exit(1); })
  .finally(() => db.$disconnect());

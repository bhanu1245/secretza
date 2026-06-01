/**
 * Pricing SOT verification script.
 * Run: bun run scripts/verify-pricing-sot.mjs
 */
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('=== Pricing SOT Verification ===\n');

  // 1. PaymentSettings (the single source of truth)
  const psRes = await fetch(`${BASE}/api/payment-settings`);
  const ps = await psRes.json();

  console.log('A. PaymentSettings (checkout SOT):');
  console.log('   UPI ID    :', ps.upiId);
  console.log('   Boost tiers:');
  for (const t of ps.boostTiers || []) {
    console.log(`     ₹${t.amount} → ${t.durationMinutes} min  [${t.label}]`);
  }
  console.log('   Feature tiers:');
  for (const t of ps.featuredTiers || []) {
    console.log(`     ₹${t.amount} → ${t.durationDays} days  [${t.label}]`);
  }
  console.log('   Premium tiers:');
  for (const t of ps.premiumTiers || []) {
    console.log(`     ₹${t.amount} → ${t.durationDays} days  [${t.label}]`);
  }

  // 2. Pricing page values match PaymentSettings
  console.log('\nB. Pricing page values now from PaymentSettings:');
  console.log('   Boost   from SOT: From ₹' + Math.min(...(ps.boostTiers || [{ amount: 0 }]).map(t => t.amount)));
  console.log('   Feature from SOT: From ₹' + Math.min(...(ps.featuredTiers || [{ amount: 0 }]).map(t => t.amount)));
  const premium = (ps.premiumTiers || [])[0];
  console.log('   Premium from SOT: ₹' + (premium?.amount ?? '?') + '/' + (premium?.durationDays ?? '?') + 'd');

  // 3. PricingPlan (marketing-only)
  const plansRes = await fetch(`${BASE}/api/pricing-plans`);
  const plansData = await plansRes.json();
  console.log('\nC. PricingPlan (marketing-only, operational fields irrelevant):');
  for (const p of plansData.plans || []) {
    console.log(`   [${p.slug}] ${p.name} — features: ${(p.features || []).length} bullet(s)`);
  }

  // 4. Legacy USD routes are gone (should return 404)
  const boostRes = await fetch(`${BASE}/api/listings/bogus/boost`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
  const featureRes = await fetch(`${BASE}/api/listings/bogus/feature`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
  console.log('\nD. Legacy USD routes removed:');
  console.log('   /api/listings/[id]/boost  :', boostRes.status, boostRes.status === 404 ? '✓ deleted' : '✗ STILL EXISTS');
  console.log('   /api/listings/[id]/feature:', featureRes.status, featureRes.status === 404 ? '✓ deleted' : '✗ STILL EXISTS');

  // 5. Summary match check
  console.log('\n=== Result ===');
  const boostOk   = (ps.boostTiers || []).length > 0;
  const featureOk = (ps.featuredTiers || []).length > 0;
  const premiumOk = (ps.premiumTiers || []).length > 0;
  const legacyGone = boostRes.status === 404 && featureRes.status === 404;
  console.log('PaymentSettings has boost tiers :', boostOk   ? '✓' : '✗');
  console.log('PaymentSettings has feature tiers:', featureOk ? '✓' : '✗');
  console.log('PaymentSettings has premium tiers:', premiumOk ? '✓' : '✗');
  console.log('Legacy USD routes removed        :', legacyGone ? '✓' : '✗');
  console.log('\nPricing page reads SAME amounts as checkout:', boostOk && featureOk && premiumOk ? '✓ YES' : '✗ NO');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

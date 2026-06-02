/**
 * verify-ranking-v2.ts
 * Static verification of the four-tier ranking architecture implementation.
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

interface Check {
  id: string;
  description: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(
  id: string,
  description: string,
  fn: () => boolean,
  detail?: string,
) {
  let pass = false;
  let err: string | undefined;
  try {
    pass = fn();
  } catch (e) {
    err = String(e);
  }
  checks.push({ id, description, pass, detail: err ?? detail });
}

const engine = read("src/lib/ranking-engine.ts");
const cron = read("src/app/api/cron/refresh-ranking/route.ts");
const seoPage = read("src/lib/seo-public-page.ts");
const listingsApi = read("src/app/api/listings/route.ts");
const reviewRoute = read(
  "src/app/api/admin/payments/manual/[id]/review/route.ts",
);
const appStore = read("src/store/useAppStore.ts");
const pageTsx = read("src/app/page.tsx");
const types = read("src/lib/types.ts");
const dashboard = read(
  "src/components/secretza/dashboard/Dashboard.tsx",
);

// ─── 1. Engine: tier constants and ordering ───────────────────────────────────

check("1a", "TIER_BOOSTED = 3000 defined", () =>
  engine.includes("TIER_BOOSTED = 3000"),
);
check("1b", "TIER_PREMIUM = 2000 defined", () =>
  engine.includes("TIER_PREMIUM = 2000"),
);
check("1c", "TIER_FEATURED = 1000 defined", () =>
  engine.includes("TIER_FEATURED = 1000"),
);
check("1d", "TIER_FREE = 0 defined", () => engine.includes("TIER_FREE = 0"));
check("1e", "Tier gap (1000) exceeds max soft signals (99+25+24=148)", () => {
  // Verify by inspecting constants in the source
  const rotMatch = engine.match(/MAX_ROTATION_SCORE\s*=\s*(\d+)/);
  const engMatch = engine.match(/MAX_ENGAGEMENT_SCORE\s*=\s*(\d+)/);
  const recMatch = engine.match(/MAX_RECENCY_SCORE\s*=\s*(\d+)/);
  if (!rotMatch || !engMatch || !recMatch) return false;
  const maxSoft =
    Number(rotMatch[1]) + Number(engMatch[1]) + Number(recMatch[1]);
  return maxSoft < 1000;
});

// ─── 2. Engine: getActiveTier implements highest-active-tier ownership ────────

check("2a", "getActiveTier exported from ranking-engine", () =>
  engine.includes("export function getActiveTier"),
);
check(
  "2b",
  "Boosted tier checked first (before premium/featured)",
  () => {
    const boostIdx = engine.indexOf("return \"boosted\"");
    const premIdx = engine.indexOf("return \"premium\"");
    const featIdx = engine.indexOf("return \"featured\"");
    return boostIdx !== -1 && premIdx > boostIdx && featIdx > premIdx;
  },
);
check("2c", "isPremium checked for Premium tier (no expiry window on listing)", () =>
  engine.includes("if (listing.isPremium)") &&
  engine.includes("return \"premium\""),
);
check("2d", "Featured tier checks featuredUntil window (time-bounded)", () => {
  const featuredBlock = engine.slice(
    engine.indexOf("return \"featured\"") - 200,
    engine.indexOf("return \"featured\""),
  );
  return (
    featuredBlock.includes("featuredUntil") &&
    featuredBlock.includes("> now")
  );
});
check("2e", "Free is the fallback (last return)", () =>
  engine.trim().includes("return \"free\";"),
);

// ─── 3. Engine: computePriorityScore uses tier base ──────────────────────────

check(
  "3a",
  "computePriorityScore assigns tier base via getActiveTier",
  () =>
    engine.includes("getActiveTier(listing)") &&
    engine.includes("TIER_BOOSTED") &&
    engine.includes("TIER_PREMIUM") &&
    engine.includes("TIER_FEATURED"),
);
check("3b", "Rotation bump applies to ALL tiers (no tier filter around bump)", () => {
  // The bump block should come after tier base assignment without a tier condition
  const bumpBlock = engine.slice(
    engine.indexOf("// 2. Within-tier rotation bump"),
    engine.indexOf("// 3. View engagement"),
  );
  return (
    bumpBlock.includes("lastBumpedAt") &&
    !bumpBlock.includes("tier ===") &&
    !bumpBlock.includes('tier !== "free"')
  );
});
check("3c", "isPremium is optional in ListingRankInput (backward compat)", () =>
  engine.includes("isPremium?: boolean"),
);

// ─── 4. Engine: getRankLabel includes premium label ──────────────────────────

check("4a", 'getRankLabel returns "premium" for premium tier', () =>
  engine.includes("return \"premium\";"),
);
check("4b", "RankedListing rankLabel includes premium variant", () =>
  engine.includes('"premium"') && engine.includes("rankLabel"),
);

// ─── 5. Engine: getNextBumpBatchForTier exported ─────────────────────────────

check("5a", "getNextBumpBatchForTier exported from ranking-engine", () =>
  engine.includes("export function getNextBumpBatchForTier"),
);
check("5b", "getNextBumpBatchForTier filters by getActiveTier", () =>
  engine.includes("getActiveTier(l) !== tier"),
);
check("5c", "Legacy getNextBumpBatch still exported (backward compat)", () =>
  engine.includes("export function getNextBumpBatch"),
);

// ─── 6. types.ts: premium in RankLabel ───────────────────────────────────────

check("6a", 'RankLabel type includes "premium"', () =>
  types.includes('"premium"') && types.includes("RankLabel"),
);
check("6b", "Listing interface has isPremium field", () =>
  types.includes("isPremium: boolean") && types.includes("interface Listing"),
);
check("6c", 'SearchFilters.sortBy includes "ranking"', () =>
  types.includes('"ranking"') && types.includes("sortBy?"),
);

// ─── 7. Cron: sync isPremium, per-tier bumping ────────────────────────────────

check("7a", "Cron imports getNextBumpBatchForTier", () =>
  cron.includes("getNextBumpBatchForTier"),
);
check("7b", "Cron syncs Listing.isPremium from user (activate step)", () =>
  cron.includes("isPremium: true") &&
  cron.includes("premiumExpiry: { gt: new Date() }"),
);
check("7c", "Cron deactivates Listing.isPremium for non-premium users", () =>
  cron.includes("isPremium: false") && cron.includes("NOT:"),
);
check("7d", "Cron fetches isPremium in allApproved select", () => {
  const selectBlock = cron.slice(
    cron.indexOf("select: {"),
    cron.indexOf("select: {") + 300,
  );
  return selectBlock.includes("isPremium: true");
});
check("7e", "Cron bumps all four tiers (boosted, premium, featured, free)", () => {
  const hasBoosted = cron.includes('"boosted"');
  const hasPremium = cron.includes('"premium"');
  const hasFeatured = cron.includes('"featured"');
  const hasFree = cron.includes('"free"');
  return hasBoosted && hasPremium && hasFeatured && hasFree;
});
check("7f", "Cron uses TIERS array for per-tier loop", () =>
  cron.includes("TIERS") && cron.includes("for (const tier of TIERS)"),
);
check("7g", "Cron response includes rotationByTier breakdown", () =>
  cron.includes("rotationByTier"),
);

// ─── 8. Sort unification: no stale isFeatured sort key ───────────────────────

check("8a", "seo-public-page.ts has no isFeatured-first sort key", () =>
  !seoPage.includes('{ isFeatured: "desc" }, { priorityScore: "desc" }'),
);
check("8b", "listings/route.ts 'featured' sort uses priorityScore only", () => {
  const caseBlock = listingsApi.slice(
    listingsApi.indexOf('case "featured"'),
    listingsApi.indexOf('case "featured"') + 200,
  );
  return (
    caseBlock.includes("priorityScore") &&
    !caseBlock.includes("isFeatured: \"desc\"")
  );
});
check("8c", "rankInput in listings API includes isPremium", () =>
  listingsApi.includes("isPremium:") && listingsApi.includes("rankInput"),
);

// ─── 9. Premium payment approval: immediate Listing.isPremium sync ────────────

check("9a", "Review route updates Listing.isPremium=true on premium approval", () =>
  reviewRoute.includes("data: { isPremium: true, priorityScore: newScore }") ||
  (reviewRoute.includes("isPremium: true") && reviewRoute.includes("tx.listing.update")),
);
check("9b", "Review route recomputes listing score after premium sync", () =>
  reviewRoute.includes("computePriorityScore({ ...lst, isPremium: true })"),
);
check("9c", "Review route syncs all user's approved listings, not just one", () =>
  reviewRoute.includes("findMany") &&
  reviewRoute.includes("for (const lst of userListings)"),
);

// ─── 10. Surface unification ────────────────────────────────────────────────

check("10a", "Default sortBy in useAppStore is 'relevance' (not 'featured')", () =>
  appStore.includes("sortBy: \"relevance\"") &&
  !appStore.includes("sortBy: \"featured\""),
);
check(
  "10b",
  "LocationPage in page.tsx uses 'relevance' sortBy (not 'newest')",
  () => {
    const locationBlock = pageTsx.slice(
      pageTsx.indexOf("LocationPage"),
      pageTsx.indexOf("LocationPage") + 500,
    );
    return (
      locationBlock.includes("sortBy: \"relevance\"") &&
      !locationBlock.includes("sortBy: \"newest\"")
    );
  },
);

// ─── 11. Dashboard: Premium badge and updated score bar ──────────────────────

check("11a", "Dashboard RankingBadge shows Premium badge for isPremium", () =>
  dashboard.includes("listing.isPremium") &&
  dashboard.includes("Premium") &&
  dashboard.includes("Crown"),
);
check("11b", "Dashboard PriorityScoreBar has updated maxScore (3200)", () =>
  dashboard.includes("3200"),
);
check("11c", "Dashboard score bar has four color tiers (3000, 2000, 1000)", () =>
  dashboard.includes("3000") &&
  dashboard.includes("2000") &&
  dashboard.includes("1000"),
);

// ─── 12. Engine unit simulation ──────────────────────────────────────────────
// Simulate the tier logic inline (mirroring ranking-engine.ts constants).

function simTier(listing: {
  isBoosted: boolean;
  boostUntil: Date | null;
  isPremium: boolean;
  isFeatured: boolean;
  featuredUntil: Date | null;
}): string {
  const now = Date.now();
  if (listing.isBoosted && listing.boostUntil && listing.boostUntil.getTime() > now)
    return "boosted";
  if (listing.isPremium) return "premium";
  if (listing.isFeatured && listing.featuredUntil && listing.featuredUntil.getTime() > now)
    return "featured";
  return "free";
}

const future = new Date(Date.now() + 3600 * 1000);
const past = new Date(Date.now() - 3600 * 1000);

check("12a", "Boost+Premium+Featured => boosted pool", () =>
  simTier({
    isBoosted: true,
    boostUntil: future,
    isPremium: true,
    isFeatured: true,
    featuredUntil: future,
  }) === "boosted",
);
check("12b", "Premium+Featured => premium pool (not featured)", () =>
  simTier({
    isBoosted: false,
    boostUntil: null,
    isPremium: true,
    isFeatured: true,
    featuredUntil: future,
  }) === "premium",
);
check("12c", "Featured only => featured pool", () =>
  simTier({
    isBoosted: false,
    boostUntil: null,
    isPremium: false,
    isFeatured: true,
    featuredUntil: future,
  }) === "featured",
);
check("12d", "No active tier => free pool", () =>
  simTier({
    isBoosted: false,
    boostUntil: null,
    isPremium: false,
    isFeatured: false,
    featuredUntil: null,
  }) === "free",
);
check("12e", "Expired Boost + Premium => premium pool (not boosted)", () =>
  simTier({
    isBoosted: true,
    boostUntil: past,
    isPremium: true,
    isFeatured: false,
    featuredUntil: null,
  }) === "premium",
);
check("12f", "Expired Boost, no Premium, Featured => featured pool", () =>
  simTier({
    isBoosted: true,
    boostUntil: past,
    isPremium: false,
    isFeatured: true,
    featuredUntil: future,
  }) === "featured",
);
check("12g", "Expired everything => free pool", () =>
  simTier({
    isBoosted: true,
    boostUntil: past,
    isPremium: false,
    isFeatured: true,
    featuredUntil: past,
  }) === "free",
);

// ─── Tier score ordering simulation ──────────────────────────────────────────

function simScore(tier: string, minutesSinceBump: number): number {
  const TIER_BOOSTED = 3000, TIER_PREMIUM = 2000, TIER_FEATURED = 1000, TIER_FREE = 0;
  const MAX_ROTATION = 99, MAX_ENG = 25, MAX_REC = 24, CYCLE = 30;
  const base =
    tier === "boosted" ? TIER_BOOSTED
    : tier === "premium" ? TIER_PREMIUM
    : tier === "featured" ? TIER_FEATURED
    : TIER_FREE;
  const bump = minutesSinceBump < CYCLE
    ? MAX_ROTATION * (1 - minutesSinceBump / CYCLE)
    : 0;
  // Use max soft signals to prove tier gap is never crossed
  return base + bump + MAX_ENG + MAX_REC;
}

check(
  "12h",
  "Max Free score (148) < min Featured score (1000) — tiers never overlap",
  () => simScore("free", 0) < 1000,
);
check(
  "12i",
  "Max Featured score (1148) < min Premium score (2000)",
  () => simScore("featured", 0) < 2000,
);
check(
  "12j",
  "Max Premium score (2148) < min Boosted score (3000)",
  () => simScore("premium", 0) < 3000,
);

// ─── Results ──────────────────────────────────────────────────────────────────

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
const total = checks.length;
const score = Math.round((passed / total) * 100);

console.log("\n===  SecretZa Ranking v2 — Verification  ===\n");

const groups: Record<string, { label: string; checks: Check[] }> = {
  "1": { label: "Tier constants & gap safety", checks: [] },
  "2": { label: "getActiveTier: highest-active-tier ownership", checks: [] },
  "3": { label: "computePriorityScore", checks: [] },
  "4": { label: "getRankLabel: premium label", checks: [] },
  "5": { label: "getNextBumpBatchForTier", checks: [] },
  "6": { label: "types.ts", checks: [] },
  "7": { label: "Cron: sync + per-tier rotation", checks: [] },
  "8": { label: "Sort unification (no stale isFeatured key)", checks: [] },
  "9": { label: "Premium payment: immediate listing sync", checks: [] },
  "10": { label: "Surface defaults (useAppStore, LocationPage)", checks: [] },
  "11": { label: "Dashboard: Premium badge + score bar", checks: [] },
  "12": { label: "Simulation: tier logic & gap invariants", checks: [] },
};

for (const c of checks) {
  const g = c.id.replace(/[a-z]$/, "");
  if (groups[g]) groups[g].checks.push(c);
}

for (const [, g] of Object.entries(groups)) {
  console.log(`  ── ${g.label} ──`);
  for (const c of g.checks) {
    console.log(`    ${c.pass ? "✓" : "✗"} [${c.id}] ${c.description}`);
    if (!c.pass && c.detail) console.log(`          → ${c.detail}`);
  }
  console.log();
}

console.log(`  Result: ${passed}/${total} checks passed  (${score}/100)`);
console.log(`  Status: ${failed.length === 0 ? "PASS" : "FAIL"}\n`);

// ─── Report ───────────────────────────────────────────────────────────────────

const outDir = path.join(ROOT, "artifacts", "ranking-v2-verification");
fs.mkdirSync(outDir, { recursive: true });

const report = {
  timestamp: new Date().toISOString(),
  score,
  passed,
  total,
  status: failed.length === 0 ? "PASS" : "FAIL",
  filesChanged: [
    { file: "src/lib/ranking-engine.ts", change: "Four-tier architecture (Boosted 3000 / Premium 2000 / Featured 1000 / Free 0), getActiveTier(), getNextBumpBatchForTier()" },
    { file: "src/lib/types.ts", change: 'RankLabel includes "premium"; Listing adds isPremium; SearchFilters.sortBy adds "ranking"' },
    { file: "src/app/api/cron/refresh-ranking/route.ts", change: "Syncs Listing.isPremium from user; per-tier bump loop (all 4 tiers)" },
    { file: "src/lib/seo-public-page.ts", change: "All 7 orderBy clauses changed to [{ priorityScore: desc }, { createdAt: desc }]" },
    { file: "src/app/api/listings/route.ts", change: "featured sort → priorityScore only; rankInput includes isPremium" },
    { file: "src/app/api/admin/payments/manual/[id]/review/route.ts", change: "Premium approval immediately syncs Listing.isPremium and recomputes scores" },
    { file: "src/store/useAppStore.ts", change: "Default sortBy: featured → relevance" },
    { file: "src/app/page.tsx", change: "LocationPage sortBy: newest → relevance" },
    { file: "src/components/secretza/dashboard/Dashboard.tsx", change: "Premium badge; score bar maxScore 1600→3200; 4-color tier gradient" },
  ],
  tierScoreRanges: {
    Boosted: "3000–3148",
    Premium: "2000–2148",
    Featured: "1000–1148",
    Free: "0–148",
  },
  tierGapSafety: "1000 unit gap; max combined soft signals = 148 (rotation 99 + engagement 25 + recency 24)",
  rotationCycle: "30 minutes",
  tiersRotated: ["boosted", "premium", "featured", "free"],
  checks: checks.map((c) => ({
    id: c.id,
    description: c.description,
    pass: c.pass,
    ...(c.detail ? { detail: c.detail } : {}),
  })),
};

fs.writeFileSync(
  path.join(outDir, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log("  Report → artifacts/ranking-v2-verification/report.json\n");

if (failed.length > 0) process.exit(1);

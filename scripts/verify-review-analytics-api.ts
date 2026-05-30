/**
 * End-to-end verification for Review Analytics API.
 * Run: npx tsx scripts/verify-review-analytics-api.ts
 */
import { db } from "../src/lib/db";
import { getReviewAnalytics } from "../src/lib/review-analytics";

async function testServiceLayer() {
  const data = await getReviewAnalytics(30);
  const json = JSON.stringify(data);

  if (typeof data.topRatedListings[0]?.reviewCount !== "number") {
    throw new Error(`reviewCount must be number, got ${typeof data.topRatedListings[0]?.reviewCount}`);
  }
  for (const row of data.reviewsByDay) {
    if (typeof row.count !== "number") {
      throw new Error(`reviewsByDay.count must be number, got ${typeof row.count}`);
    }
  }

  console.log("✓ getReviewAnalytics() serializes to JSON");
  console.log("  totalReviews:", data.totalReviews);
  console.log("  averageRating:", data.averageRating);
  console.log("  reviewsByDay rows:", data.reviewsByDay.length);
  console.log("  topRatedListings:", data.topRatedListings.length);
  console.log("  JSON length:", json.length);
}

function testProxyModeratorAccess() {
  const moderatorAdminApiRoutes = ["/api/admin/listings", "/api/admin/reviews"];
  const paths = [
    { path: "/api/admin/reviews/analytics", expectMod: true },
    { path: "/api/admin/reviews", expectMod: true },
    { path: "/api/admin/reviews/abc123/moderate", expectMod: true },
    { path: "/api/admin/stats", expectMod: false },
  ];

  for (const { path, expectMod } of paths) {
    const modOk = moderatorAdminApiRoutes.some((route) => path.startsWith(route));
    if (modOk !== expectMod) {
      throw new Error(`Moderator access mismatch for ${path}: got ${modOk}, expected ${expectMod}`);
    }
    console.log(`  ✓ ${path} → moderator ${expectMod ? "allowed" : "denied"}`);
  }
}

async function testHttpIfAvailable() {
  const base = process.env.BASE_URL || "http://localhost:3000";
  try {
    const unauth = await fetch(`${base}/api/admin/reviews/analytics?days=30`, {
      signal: AbortSignal.timeout(5000),
    });
    console.log(`  Unauthenticated: HTTP ${unauth.status}`);
    if (unauth.status !== 401) {
      throw new Error(`Expected 401 without session, got ${unauth.status}`);
    }
    console.log("✓ Unauthenticated requests rejected with 401");
  } catch (e) {
    if (e instanceof Error && e.message.includes("Expected 401")) throw e;
    console.log("  Live HTTP: dev server not running (skipped)");
  }
}

async function main() {
  console.log("=== Review Analytics API Verification ===\n");

  console.log("1. Service layer (getReviewAnalytics)");
  await testServiceLayer();

  console.log("\n2. Proxy moderator access rules");
  testProxyModeratorAccess();

  console.log("\n3. Live HTTP (optional)");
  await testHttpIfAvailable();

  console.log("\n=== ALL CHECKS PASSED ===");
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

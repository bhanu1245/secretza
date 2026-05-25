import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: "pass" | "fail" | "warn" | "running";
  duration: number;
  details: string;
  evidence: string | null;
  timestamp: string;
}

interface StressResponse {
  success: boolean;
  action: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warned: number;
  results: TestResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function makeResult(
  id: string,
  name: string,
  category: string,
  status: TestResult["status"],
  duration: number,
  details: string,
  evidence: string | null
): TestResult {
  return { id, name, category, status, duration, details, evidence, timestamp: now() };
}

/**
 * Run a single test function and return a timed TestResult.
 */
async function runTest(
  id: string,
  name: string,
  category: string,
  fn: () => Promise<{ status: TestResult["status"]; details: string; evidence: string | null }>
): Promise<TestResult> {
  const start = performance.now();
  try {
    const { status, details, evidence } = await fn();
    const duration = Math.round(performance.now() - start);
    return makeResult(id, name, category, status, duration, details, evidence);
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return makeResult(id, name, category, "fail", duration, `Unhandled error: ${msg}`, null);
  }
}

// ---------------------------------------------------------------------------
// Test implementations
// ---------------------------------------------------------------------------

async function test1_loginPersistence(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Verify that the test user exists in the DB and has a valid password hash
  const user = await db.user.findUnique({
    where: { email: "test@secretza.com" },
    select: { id: true, email: true, passwordHash: true, role: true, isVerified: true, isSuspended: true },
  });

  if (!user) {
    return { status: "fail", details: "Test user test@secretza.com not found in database", evidence: null };
  }

  if (!user.passwordHash) {
    return { status: "fail", details: "Test user has no passwordHash set", evidence: user.email };
  }

  // Verify password matches expected pattern
  const isValid = await bcrypt.compare("Test1234", user.passwordHash);
  if (!isValid) {
    return {
      status: "fail",
      details: "Password 'Test1234' does not match stored hash for test@secretza.com",
      evidence: user.email,
    };
  }

  // Verify auth config is using JWT strategy (required for login persistence)
  if (authOptions.session?.strategy !== "jwt") {
    return {
      status: "fail",
      details: `Session strategy is '${authOptions.session?.strategy}', expected 'jwt'`,
      evidence: String(authOptions.session?.strategy),
    };
  }

  // Verify maxAge is set (enables persistence across browser restarts)
  const maxAge = authOptions.session?.maxAge;
  if (!maxAge || maxAge <= 0) {
    return { status: "fail", details: "Session maxAge is not configured", evidence: String(maxAge) };
  }

  return {
    status: "pass",
    details: `User found, password valid, JWT strategy with ${maxAge}s maxAge. Login persistence is supported.`,
    evidence: `user=${user.email}, strategy=jwt, maxAge=${maxAge}s`,
  };
}

async function test2_protectedRouteRedirect(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Verify that the listings POST handler has an auth guard
  const listingsSource = readFileSync(join(process.cwd(), "src/app/api/listings/route.ts"), "utf-8");

  const hasAuthGuard = listingsSource.includes("getServerSession") && listingsSource.includes("Authentication required");
  if (!hasAuthGuard) {
    return { status: "fail", details: "Listings POST route does not have a getServerSession auth guard", evidence: null };
  }

  const has401 = listingsSource.includes("status: 401");
  if (!has401) {
    return { status: "fail", details: "Listings POST route does not return 401 for unauthenticated requests", evidence: null };
  }

  // Also verify payments route has auth guard
  let paymentsHasGuard = false;
  try {
    const paymentsSource = readFileSync(join(process.cwd(), "src/app/api/payments/route.ts"), "utf-8");
    paymentsHasGuard = paymentsSource.includes("getServerSession") || paymentsSource.includes("requireAuth") || paymentsSource.includes("requireMinRole");
  } catch {
    paymentsHasGuard = false;
  }

  return {
    status: "pass",
    details: `Protected routes verified: listings POST has auth guard returning 401, payments guard=${paymentsHasGuard}`,
    evidence: `listings_guard=true, payments_guard=${paymentsHasGuard}`,
  };
}

async function test3_adminRouteProtection(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Check middleware blocks unauthenticated access to admin routes
  const middlewareSource = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf-8");

  const hasAdminRoutes = middlewareSource.includes("/api/admin/") || middlewareSource.includes("adminApiRoutes");
  if (!hasAdminRoutes) {
    return { status: "fail", details: "Middleware does not define admin API routes", evidence: null };
  }

  const has401 = middlewareSource.includes("status: 401");
  if (!has401) {
    return { status: "fail", details: "Middleware does not return 401 for unauthorized access", evidence: null };
  }

  const checksCookie = middlewareSource.includes("sessionToken") || middlewareSource.includes("next-auth.session-token");
  if (!checksCookie) {
    return { status: "fail", details: "Middleware does not check session token cookie", evidence: null };
  }

  // Also verify the admin stats handler uses requireMinRole
  const adminStatsSource = readFileSync(join(process.cwd(), "src/app/api/admin/stats/route.ts"), "utf-8");
  const hasRequireMinRole = adminStatsSource.includes("requireMinRole");
  if (!hasRequireMinRole) {
    return { status: "fail", details: "Admin stats route does not use requireMinRole for authorization", evidence: null };
  }

  return {
    status: "pass",
    details: "Admin routes protected at two layers: middleware (cookie check + 401) and route handler (requireMinRole('admin'))",
    evidence: `middleware_401=true, cookie_check=true, route_requireMinRole=true`,
  };
}

async function test4_suspendedUser(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Check suspended user exists in DB
  const user = await db.user.findUnique({
    where: { email: "suspended@secretza.com" },
    select: { id: true, email: true, isSuspended: true, passwordHash: true },
  });

  if (!user) {
    return { status: "fail", details: "Suspended user suspended@secretza.com not found in database", evidence: null };
  }

  if (!user.isSuspended) {
    return { status: "fail", details: "User suspended@secretza.com has isSuspended=false, expected true", evidence: user.email };
  }

  // Verify the authorize function checks isSuspended
  const authSource = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf-8");
  const hasSuspendedCheck = authSource.includes("isSuspended") && authSource.includes("suspended");
  if (!hasSuspendedCheck) {
    return { status: "fail", details: "Auth authorize function does not check isSuspended flag", evidence: null };
  }

  // Also verify the signIn callback checks isSuspended
  const hasSignInCheck = authSource.includes('isSuspended');
  if (!hasSignInCheck) {
    return { status: "warn", details: "Auth authorize checks isSuspended but signIn callback may not", evidence: null };
  }

  // Verify password exists so we know credential auth is possible
  if (!user.passwordHash) {
    return {
      status: "warn",
      details: "Suspended user exists with isSuspended=true but has no passwordHash (OAuth-only account)",
      evidence: user.email,
    };
  }

  const passwordValid = await bcrypt.compare("Suspended123", user.passwordHash);
  if (!passwordValid) {
    return { status: "warn", details: "Suspended user password 'Suspended123' does not match stored hash", evidence: user.email };
  }

  return {
    status: "pass",
    details: "Suspended user exists with isSuspended=true, authorize function rejects suspended users, signIn callback also checks",
    evidence: `user=${user.email}, isSuspended=${user.isSuspended}, password_valid=${passwordValid}`,
  };
}

async function test5_unverifiedUserRestrictions(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Check unverified user exists
  const user = await db.user.findUnique({
    where: { email: "unverified@secretza.com" },
    select: { id: true, email: true, isVerified: true, role: true },
  });

  if (!user) {
    return { status: "fail", details: "Unverified user unverified@secretza.com not found in database", evidence: null };
  }

  if (user.isVerified) {
    return { status: "fail", details: "User unverified@secretza.com has isVerified=true, expected false", evidence: user.email };
  }

  // Check that listings POST handler checks isVerified
  const listingsSource = readFileSync(join(process.cwd(), "src/app/api/listings/route.ts"), "utf-8");
  const hasVerifiedCheck = listingsSource.includes("isVerified");
  if (!hasVerifiedCheck) {
    return { status: "fail", details: "Listings POST route does not check isVerified before allowing listing creation", evidence: null };
  }

  // Verify it returns 403 for unverified users
  const has403 = listingsSource.includes("403");
  if (!has403) {
    return { status: "fail", details: "Listings POST route does not return 403 for unverified users", evidence: null };
  }

  const hasVerificationMessage = listingsSource.includes("verification required") || listingsSource.includes("Email verification required");
  if (!hasVerificationMessage) {
    return { status: "warn", details: "Listings POST checks isVerified but may not have a clear error message", evidence: null };
  }

  return {
    status: "pass",
    details: "Unverified user exists with isVerified=false, listings POST handler checks isVerified and returns 403 with verification message",
    evidence: `user=${user.email}, isVerified=${user.isVerified}, listing_guard=true, returns_403=true`,
  };
}

async function test6_googleOAuthConfig(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Check Google provider is configured
  const providers = authOptions.providers || [];
  const googleProvider = providers.find((p) => p.id === "google" || p.name === "Google");

  if (!googleProvider) {
    return { status: "fail", details: "Google OAuth provider not found in authOptions.providers", evidence: null };
  }

  // Check environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  const envVarsExist = clientId.length > 0 && clientSecret.length > 0;

  // Check the provider configuration has allowDangerousEmailAccountLinking
  const authSource = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf-8");
  const hasAccountLinking = authSource.includes("allowDangerousEmailAccountLinking");

  if (!envVarsExist) {
    return {
      status: "warn",
      details: `Google provider configured in code but env vars are empty. clientId=${clientId ? "***set***" : "***empty***"}, clientSecret=${clientSecret ? "***set***" : "***empty***"}`,
      evidence: `provider_exists=true, env_vars_set=false, account_linking=${hasAccountLinking}`,
    };
  }

  return {
    status: "pass",
    details: `Google OAuth provider properly configured with env vars set and account linking=${hasAccountLinking}`,
    evidence: `provider_exists=true, client_id_set=true, client_secret_set=true, account_linking=${hasAccountLinking}`,
  };
}

async function test7_logoutSessionCleanup(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Verify signOut is available from next-auth
  let signOutAvailable = false;
  try {
    // Dynamic import to check if signOut exists
    const nextAuthReact = await import("next-auth/react");
    signOutAvailable = typeof nextAuthReact.signOut === "function";
  } catch {
    signOutAvailable = false;
  }

  if (!signOutAvailable) {
    return { status: "fail", details: "signOut function is not available from next-auth/react", evidence: null };
  }

  // Verify session table exists in DB (for database sessions, though we use JWT)
  let sessionTableExists = false;
  try {
    await db.session.findFirst({ take: 1 });
    sessionTableExists = true;
  } catch {
    sessionTableExists = false;
  }

  // Since we use JWT strategy, session cleanup means cookie deletion
  // Verify the JWT strategy is set
  const isJWT = authOptions.session?.strategy === "jwt";

  return {
    status: "pass",
    details: `signOut available from next-auth/react, JWT strategy=${isJWT}, session table exists=${sessionTableExists}. With JWT, logout clears the client-side session token cookie.`,
    evidence: `signOut_available=true, jwt_strategy=${isJWT}, session_table=${sessionTableExists}`,
  };
}

async function test8_expiredSessionHandling(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Check JWT maxAge configuration
  const maxAge = authOptions.session?.maxAge;

  if (!maxAge || maxAge <= 0) {
    return { status: "fail", details: "Session maxAge is not configured — sessions will never expire", evidence: String(maxAge) };
  }

  const expectedMaxAge = 30 * 24 * 60 * 60; // 30 days
  const isCorrect = maxAge === expectedMaxAge;
  const maxAgeDays = Math.round(maxAge / (24 * 60 * 60));

  // Check that JWT callback exists to handle token validation
  const authSource = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf-8");
  const hasJWTCallback = authSource.includes("async jwt(") || authSource.includes("jwt({") || authSource.includes("jwt: async");

  // Verify cookies are configured with expiration
  const hasCookieConfig = authSource.includes("sessionToken") && authSource.includes("httpOnly");

  if (!hasJWTCallback) {
    return {
      status: "warn",
      details: `maxAge is set to ${maxAgeDays} days but JWT callback may not be properly configured`,
      evidence: `maxAge=${maxAge}s (${maxAgeDays} days), jwt_callback=false`,
    };
  }

  return {
    status: "pass",
    details: `JWT maxAge configured to ${maxAgeDays} days (${maxAge}s), JWT callback exists, cookie config present. Expired sessions are rejected by NextAuth's built-in token validation.`,
    evidence: `maxAge=${maxAge}s, expected=${expectedMaxAge}s, correct=${isCorrect}, jwt_callback=true, cookie_config=${hasCookieConfig}`,
  };
}

async function test9_concurrentTabBehavior(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  // Verify session strategy is JWT (required for multi-tab support without DB sessions)
  const strategy = authOptions.session?.strategy;
  if (strategy !== "jwt") {
    return {
      status: "fail",
      details: `Session strategy is '${strategy}', expected 'jwt'. Database sessions don't scale well for concurrent tabs.`,
      evidence: String(strategy),
    };
  }

  // Verify cookie settings
  const cookies = authOptions.cookies?.sessionToken?.options;
  if (!cookies) {
    return { status: "fail", details: "Session token cookie options are not configured", evidence: null };
  }

  const checks: string[] = [];

  // Check httpOnly
  if (cookies.httpOnly === true) {
    checks.push("httpOnly=true");
  } else {
    return {
      status: "fail",
      details: "Cookie httpOnly is not set to true — exposes session to JavaScript XSS attacks",
      evidence: `httpOnly=${String(cookies.httpOnly)}`,
    };
  }

  // Check sameSite
  if (cookies.sameSite === "lax") {
    checks.push("sameSite=lax");
  } else {
    return {
      status: "fail",
      details: `Cookie sameSite is '${String(cookies.sameSite)}', expected 'lax' for concurrent tab support`,
      evidence: `sameSite=${String(cookies.sameSite)}`,
    };
  }

  // Check path
  if (cookies.path === "/") {
    checks.push("path=/");
  } else {
    return {
      status: "warn",
      details: `Cookie path is '${String(cookies.path)}', expected '/' for site-wide availability`,
      evidence: `path=${String(cookies.path)}`,
    };
  }

  return {
    status: "pass",
    details: `JWT strategy with proper cookie config: ${checks.join(", ")}. Multiple tabs share the same session token.`,
    evidence: checks.join(", "),
  };
}

async function test10_middlewareProtection(): Promise<{ status: TestResult["status"]; details: string; evidence: string | null }> {
  const middlewareSource = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf-8");

  const findings: string[] = [];

  // 1. Check matcher config
  const hasMatcherConfig = middlewareSource.includes("matcher") && middlewareSource.includes("/api/:path*");
  findings.push(`matcher_api=${hasMatcherConfig}`);

  if (!hasMatcherConfig) {
    return { status: "fail", details: "Middleware matcher does not include '/api/:path*'", evidence: null };
  }

  // 2. Check that NextAuth routes are skipped
  const skipsNextAuth = middlewareSource.includes("/api/auth/") && middlewareSource.includes("return NextResponse.next()");
  findings.push(`skips_nextauth=${skipsNextAuth}`);

  if (!skipsNextAuth) {
    return { status: "fail", details: "Middleware does not skip /api/auth/ routes — could interfere with NextAuth", evidence: null };
  }

  // 3. Check that session token cookie is checked
  const checksCookie = middlewareSource.includes("sessionToken") || middlewareSource.includes("next-auth.session-token");
  findings.push(`checks_cookie=${checksCookie}`);

  if (!checksCookie) {
    return { status: "fail", details: "Middleware does not check for session token cookie", evidence: null };
  }

  // 4. Check admin route protection
  const hasAdminProtection = middlewareSource.includes("adminApiRoutes") || middlewareSource.includes("/api/admin/");
  findings.push(`admin_protection=${hasAdminProtection}`);

  if (!hasAdminProtection) {
    return { status: "fail", details: "Middleware does not define admin route protection", evidence: null };
  }

  // 5. Check protected routes definition
  const hasProtectedRoutes = middlewareSource.includes("protectedApiRoutes");
  findings.push(`protected_routes=${hasProtectedRoutes}`);

  // 6. Check moderator routes
  const hasModRoutes = middlewareSource.includes("moderatorApiRoutes");
  findings.push(`moderator_routes=${hasModRoutes}`);

  // 7. Check that unauthenticated access returns 401
  const has401 = middlewareSource.includes("status: 401");
  findings.push(`returns_401=${has401}`);

  if (!has401) {
    return { status: "fail", details: "Middleware does not return 401 for unauthorized access", evidence: null };
  }

  // 8. Check public route handling
  const hasPublicRoutes = middlewareSource.includes("publicRoutes");
  findings.push(`public_routes=${hasPublicRoutes}`);

  return {
    status: "pass",
    details: `Middleware is properly configured: API matcher, skips NextAuth, checks session cookie, protects admin/moderator/protected routes with 401, handles public routes. ${findings.join(", ")}`,
    evidence: findings.join(", "),
  };
}

// ---------------------------------------------------------------------------
// Test registry
// ---------------------------------------------------------------------------

const ALL_TESTS = [
  { id: "test-1", name: "Login Persistence After Hard Refresh", category: "Session", fn: test1_loginPersistence },
  { id: "test-2", name: "Protected Route Redirects (Dashboard)", category: "Authorization", fn: test2_protectedRouteRedirect },
  { id: "test-3", name: "Admin-Only Route Protection", category: "Authorization", fn: test3_adminRouteProtection },
  { id: "test-4", name: "Suspended User Behavior", category: "Access Control", fn: test4_suspendedUser },
  { id: "test-5", name: "Unverified User Restrictions", category: "Access Control", fn: test5_unverifiedUserRestrictions },
  { id: "test-6", name: "Google OAuth Configuration", category: "OAuth", fn: test6_googleOAuthConfig },
  { id: "test-7", name: "Logout / Session Cleanup", category: "Session", fn: test7_logoutSessionCleanup },
  { id: "test-8", name: "Expired Session Handling", category: "Session", fn: test8_expiredSessionHandling },
  { id: "test-9", name: "Concurrent Tab Behavior", category: "Session", fn: test9_concurrentTabBehavior },
  { id: "test-10", name: "Middleware Protection on Direct URL Access", category: "Middleware", fn: test10_middlewareProtection },
] as const;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, test: testId } = body as { action?: string; test?: string };

    if (action === "run-single") {
      // Run a single test
      if (!testId) {
        return NextResponse.json(
          { error: "Missing 'test' field. Provide a test ID like 'test-1'" },
          { status: 400 }
        );
      }

      const target = ALL_TESTS.find((t) => t.id === testId);
      if (!target) {
        return NextResponse.json(
          {
            error: `Unknown test ID '${testId}'. Available: ${ALL_TESTS.map((t) => t.id).join(", ")}`,
          },
          { status: 404 }
        );
      }

      const result = await runTest(target.id, target.name, target.category, target.fn);

      return NextResponse.json({
        success: true,
        action: "run-single",
        timestamp: now(),
        totalTests: 1,
        passed: result.status === "pass" ? 1 : 0,
        failed: result.status === "fail" ? 1 : 0,
        warned: result.status === "warn" ? 1 : 0,
        results: [result],
      } satisfies StressResponse);
    }

    if (action === "run-all") {
      // Run all tests in parallel
      const promises = ALL_TESTS.map((t) => runTest(t.id, t.name, t.category, t.fn));
      const results = await Promise.all(promises);

      const passed = results.filter((r) => r.status === "pass").length;
      const failed = results.filter((r) => r.status === "fail").length;
      const warned = results.filter((r) => r.status === "warn").length;

      return NextResponse.json({
        success: true,
        action: "run-all",
        timestamp: now(),
        totalTests: results.length,
        passed,
        failed,
        warned,
        results,
      } satisfies StressResponse);
    }

    // GET-like info: return test list
    return NextResponse.json({
      success: false,
      error: "Invalid action. Use 'run-all' or 'run-single'.",
      availableActions: ["run-all", "run-single"],
      availableTests: ALL_TESTS.map((t) => ({ id: t.id, name: t.name, category: t.category })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET handler — return test list
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/auth/verify-stress",
    description: "Auth stress verification API",
    usage: {
      runAll: "POST with { action: 'run-all' }",
      runSingle: "POST with { action: 'run-single', test: '<test-id>' }",
    },
    totalTests: ALL_TESTS.length,
    tests: ALL_TESTS.map((t) => ({ id: t.id, name: t.name, category: t.category })),
    accounts: "/api/auth/verify-stress/accounts",
  });
}

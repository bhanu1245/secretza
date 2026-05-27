import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, type JWTPayload } from "jose";
import { validateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

/** Routes that require any authenticated user */
const protectedApiRoutes = [
  "/api/payments/",
  "/api/listings/create",
  "/api/upload/",
];

/** Routes that require the `admin` role */
const adminApiRoutes = ["/api/admin/"];

/** Routes that require `moderator` or `admin` role */
const moderatorApiRoutes = ["/api/cron/", "/api/upload/moderate"];

/** Routes exempt from CSRF validation (read-only or external webhooks) */
const csrfExemptRoutes = ["/api/auth/", "/api/sentry-tunnel"];

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<string, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

type RoleName = "user" | "moderator" | "admin";

// ---------------------------------------------------------------------------
// JWT verification (Edge Runtime compatible via jose)
// ---------------------------------------------------------------------------

/**
 * Cached secret key to avoid re-encoding on every request.
 * In Edge Runtime the module is re-instantiated per cold start, so this is safe.
 */
let cachedSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array | null {
  if (!process.env.NEXTAUTH_SECRET) return null;
  if (cachedSecret) return cachedSecret;
  cachedSecret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  return cachedSecret;
}

/** Minimal claim shape we care about in the middleware */
interface SessionClaims extends JWTPayload {
  id?: string;
  role?: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  sessionVersion?: number;
}

/**
 * Verify a NextAuth JWT session token.
 *
 * Checks:
 *  1. Signature validity  (jose jwtVerify)
 *  2. Expiration          (jose jwtVerify — `exp` claim)
 *  3. sessionVersion      (must be a non-negative integer)
 *  4. Basic structural    (id and role must be present)
 *
 * Returns the decoded payload on success, or `null` on any failure.
 */
async function verifySessionToken(
  token: string,
): Promise<SessionClaims | null> {
  const secret = getJwtSecret();

  // If no secret is configured (dev without NEXTAUTH_SECRET), we cannot
  // verify.  Let the request through — individual route handlers still
  // validate via NextAuth getServerSession().
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[middleware] NEXTAUTH_SECRET not set — skipping JWT verification. " +
          "Set NEXTAUTH_SECRET (≥32 chars) for production.",
      );
    }
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      // NextAuth v4 defaults to HS256
      algorithms: ["HS256"],
    });

    // ---- Structural checks ----
    if (!payload.id || typeof payload.id !== "string") {
      return null;
    }

    if (!payload.role || typeof payload.role !== "string") {
      return null;
    }

    // ---- sessionVersion check ----
    // Must be present and a valid non-negative integer.
    // (The periodic JWT refresh in auth.ts compares this against the DB;
    //  here we just confirm the claim exists and is structurally valid.)
    if (
      payload.sessionVersion !== undefined &&
      (typeof payload.sessionVersion !== "number" ||
        payload.sessionVersion < 0 ||
        !Number.isInteger(payload.sessionVersion))
    ) {
      return null;
    }

    // ---- Suspended user check ----
    // If the JWT was refreshed while the user was suspended, the
    // isSuspended flag will be true. Reject immediately.
    if (payload.isSuspended === true) {
      return null;
    }

    return payload as SessionClaims;
  } catch {
    // jwtVerify throws on: invalid signature, expired token, malformed JWT
    return null;
  }
}

/**
 * Check whether a JWT payload meets a minimum role requirement.
 */
function hasMinRole(
  payload: SessionClaims | null,
  minRole: RoleName,
): boolean {
  if (!payload?.role) return false;
  const userLevel = ROLE_LEVEL[payload.role] ?? -1;
  return userLevel >= (ROLE_LEVEL[minRole] ?? 0);
}

// ---------------------------------------------------------------------------
// Lazy-loaded crawl analytics (avoids Prisma on Edge Runtime)
// ---------------------------------------------------------------------------

let recordCrawlEventFn:
  | ((data: Record<string, unknown>) => Promise<void>)
  | null = null;

// ---------------------------------------------------------------------------
// CSP nonce (Edge-compatible Web Crypto API)
// ---------------------------------------------------------------------------

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ========================================================================
  // API route authentication & authorization
  // ========================================================================
  if (pathname.startsWith("/api/")) {
    // Skip NextAuth routes entirely
    if (pathname.startsWith("/api/auth/")) {
      return NextResponse.next();
    }

    // ---- Public GET routes (listings, categories, locations) ----
    const publicRoutes = [
      "/api/listings",
      "/api/categories",
      "/api/locations",
    ];
    const isPublicRoute = publicRoutes.some((route) => {
      if (pathname === route || pathname.startsWith(route + "/")) {
        if (request.method === "GET" && !pathname.includes("/create")) {
          const needsAuth = protectedApiRoutes.some((prot) =>
            pathname.startsWith(prot),
          );
          return !needsAuth;
        }
      }
      return false;
    });

    if (isPublicRoute) {
      return NextResponse.next();
    }

    // ---- Extract session token from cookies ----
    const sessionToken =
      request.cookies.get("next-auth.session-token")?.value ??
      request.cookies.get("__Secure-next-auth.session-token")?.value;

    // ---- Determine what level of access this route requires ----
    const isAdminRoute = adminApiRoutes.some((route) =>
      pathname.startsWith(route),
    );
    const isModRoute = moderatorApiRoutes.some((route) =>
      pathname.startsWith(route),
    );
    const isProtectedRoute = protectedApiRoutes.some((route) =>
      pathname.startsWith(route),
    );
    const isListingPost =
      pathname === "/api/listings" && request.method === "POST";

    const requiresAuth =
      isProtectedRoute || isListingPost || isAdminRoute || isModRoute;

    if (requiresAuth) {
      // No cookie at all → reject immediately
      if (!sessionToken) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      // Verify the JWT
      const payload = await verifySessionToken(sessionToken);

      if (!payload) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 },
        );
      }

      // ---- Role-based authorization ----
      if (isAdminRoute && !hasMinRole(payload, "admin")) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }

      if (isModRoute && !hasMinRole(payload, "moderator")) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }
    }

    // ---- CSRF validation for mutating requests ----
    if (
      request.method !== "GET" &&
      !csrfExemptRoutes.some((r) => pathname.startsWith(r))
    ) {
      const headerToken = request.headers.get("x-csrf-token");
      const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      if (!validateCsrfToken(headerToken ?? null, cookieToken ?? null)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 403 });
      }
    }
  }

  // ========================================================================
  // Crawl analytics tracking (non-API routes only)
  // ========================================================================
  if (!pathname.startsWith("/api/")) {
    if (!recordCrawlEventFn) {
      import("@/lib/crawl-analytics")
        .then(({ recordCrawlEvent }) => {
          recordCrawlEventFn = recordCrawlEvent as any;
        })
        .catch(() => {});
    }
    if (recordCrawlEventFn) {
      recordCrawlEventFn({
        userAgent: request.headers.get("user-agent") || "unknown",
        path: pathname,
        method: request.method,
        statusCode: 200,
        referer: request.headers.get("referer") || undefined,
        ipAddress:
          request.headers.get("x-real-ip") ||
          request.headers.get("x-forwarded-for") ||
          undefined,
      }).catch(() => {});
    }
  }

  // ========================================================================
  // Security headers & CSP
  // ========================================================================
  // NOTE: script-src uses 'unsafe-inline' because Next.js App Router injects
  // inline scripts for RSC hydration that cannot be nonced without deep
  // integration (experimental.cspNonce generates a separate nonce). Once the
  // nonce propagation pipeline (middleware → layout) is implemented, replace
  // 'unsafe-inline' with 'nonce-${nonce}' and remove this fallback.
  const nonce = generateNonce();

  const securityHeaders: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.resend.com https://www.google-analytics.com https://plausible.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  // x-csp-nonce kept for future use by custom client scripts that opt into nonce
  response.headers.set("x-csp-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};

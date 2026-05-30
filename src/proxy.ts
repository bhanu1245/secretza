import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";
import { validateCsrfToken, CSRF_COOKIE_NAME, describeCsrfValidationFailure } from "@/lib/csrf";

/** Routes that require any authenticated user */
const protectedApiRoutes = [
  "/api/payments/",
  "/api/listings/create",
  "/api/listings/",
  "/api/upload",
  "/api/upload/",
];

/** Routes that require the `admin` role */
const adminApiRoutes = ["/api/admin/"];

/** Routes that require `moderator` or `admin` role */
const moderatorApiRoutes = ["/api/cron/", "/api/upload/moderate"];

/** Admin API routes moderators may access (listing + review moderation) */
const moderatorAdminApiRoutes = ["/api/admin/listings", "/api/admin/reviews"];

/** Routes exempt from CSRF validation */
const csrfExemptRoutes = [
  "/api/auth/",
  "/api/admin/",
  "/api/sentry-tunnel",
  "/api/listings/create",
  "/api/listings/",
  "/api/upload",
  "/api/upload/",
  "/api/upload/moderate",
  "/api/payments/",
];

const ROLE_LEVEL: Record<string, number> = {
  user: 0,
  USER: 0,
  moderator: 1,
  MODERATOR: 1,
  admin: 2,
  ADMIN: 2,
};

type RoleName = "user" | "moderator" | "admin";

interface SessionClaims extends JWT {
  id?: string;
  role?: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  sessionVersion?: number;
}

async function verifySessionToken(
  request: NextRequest,
): Promise<SessionClaims | null> {
  try {
    const payload = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!payload) return null;
    if (!payload.id || typeof payload.id !== "string") return null;
    if (!payload.role || typeof payload.role !== "string") return null;

    if (
      payload.sessionVersion !== undefined &&
      (typeof payload.sessionVersion !== "number" ||
        payload.sessionVersion < 0 ||
        !Number.isInteger(payload.sessionVersion))
    ) {
      return null;
    }

    if (payload.isSuspended === true) return null;

    return payload as SessionClaims;
  } catch {
    return null;
  }
}

function hasMinRole(
  payload: SessionClaims | null,
  minRole: RoleName,
): boolean {
  if (!payload?.role) return false;
  const userLevel = ROLE_LEVEL[payload.role] ?? -1;
  return userLevel >= (ROLE_LEVEL[minRole] ?? 0);
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const payload = await verifySessionToken(request);
    if (!hasMinRole(payload, "moderator")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/")) {
      return NextResponse.next();
    }

    // Listing images — moderation gate enforced in route handler
    if (pathname.startsWith("/api/upload/file")) {
      return NextResponse.next();
    }

    // CSRF token issuance — must stay public
    if (pathname === "/api/csrf") {
      return NextResponse.next();
    }

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

    const sessionToken =
      request.cookies.get("next-auth.session-token")?.value ??
      request.cookies.get("__Secure-next-auth.session-token")?.value;

    const isAdminRoute = adminApiRoutes.some((route) =>
      pathname.startsWith(route),
    );
    const isModRoute = moderatorApiRoutes.some((route) =>
      pathname.startsWith(route),
    );
    const isProtectedRoute =
      request.method !== "GET" &&
      protectedApiRoutes.some((route) => pathname.startsWith(route));
    const isListingPost =
      pathname === "/api/listings" && request.method === "POST";

    const requiresAuth =
      isProtectedRoute || isListingPost || isAdminRoute || isModRoute;

    if (requiresAuth) {
      if (!sessionToken) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const payload = await verifySessionToken(request);

      if (!payload) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 },
        );
      }

      if (isAdminRoute && !hasMinRole(payload, "admin")) {
        const modAdminOk = moderatorAdminApiRoutes.some((route) =>
          pathname.startsWith(route),
        );
        if (!modAdminOk || !hasMinRole(payload, "moderator")) {
          return NextResponse.json(
            { error: "Insufficient permissions" },
            { status: 403 },
          );
        }
      }

      if (isModRoute && !hasMinRole(payload, "moderator")) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }
    }

    if (
      request.method !== "GET" &&
      !csrfExemptRoutes.some((r) => pathname.startsWith(r))
    ) {
      const headerToken = request.headers.get("x-csrf-token");
      const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      if (!validateCsrfToken(headerToken ?? null, cookieToken ?? null)) {
        const details = describeCsrfValidationFailure(
          headerToken ?? null,
          cookieToken ?? null,
        );
        return NextResponse.json(
          {
            error: "CSRF validation failed",
            field: "csrf",
            details,
          },
          { status: 403 },
        );
      }
    }
  }

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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
  response.headers.set("x-csp-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};

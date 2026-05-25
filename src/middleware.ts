import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedApiRoutes = [
  "/api/payments/",
  "/api/listings/create",
  "/api/upload/",
];

// Routes that require admin role
const adminApiRoutes = [
  "/api/admin/",
];

// Routes that require moderator or admin role
const moderatorApiRoutes = [
  "/api/cron/",
  "/api/upload/moderate",
];

// Lazy-loaded crawl analytics to avoid Prisma on edge runtime
let recordCrawlEventFn: ((data: Record<string, unknown>) => Promise<void>) | null = null;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process API route auth checks for /api/ routes
  if (pathname.startsWith("/api/")) {
    // Skip NextAuth routes
    if (pathname.startsWith("/api/auth/")) {
      return NextResponse.next();
    }

    // Skip public API routes (listings GET, categories, locations)
    const publicRoutes = ["/api/listings", "/api/categories", "/api/locations"];
    const isPublicRoute = publicRoutes.some(route => {
      if (pathname === route || pathname.startsWith(route + "/")) {
        if (request.method === "GET" && !pathname.includes("/create")) {
          const needsAuth = protectedApiRoutes.some(prot => pathname.startsWith(prot));
          return !needsAuth;
        }
      }
      return false;
    });

    if (isPublicRoute) {
      return NextResponse.next();
    }

    // Check for session token cookie
    const sessionToken = request.cookies.get("next-auth.session-token")
      || request.cookies.get("__Secure-next-auth.session-token");

    // Admin routes require the session
    const isAdminRoute = adminApiRoutes.some(route => pathname.startsWith(route));
    if (isAdminRoute && !sessionToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Moderator routes
    const isModRoute = moderatorApiRoutes.some(route => pathname.startsWith(route));
    if (isModRoute && !sessionToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Protected API routes
    const isProtectedRoute = protectedApiRoutes.some(route => pathname.startsWith(route));
    const isListingPost = pathname === "/api/listings" && request.method === "POST";

    if ((isProtectedRoute || isListingPost) && !sessionToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  // Track crawler visits (non-API routes only) — lazy load to avoid Prisma on edge
  if (!pathname.startsWith('/api/')) {
    if (!recordCrawlEventFn) {
      import("@/lib/crawl-analytics").then(({ recordCrawlEvent }) => {
        recordCrawlEventFn = recordCrawlEvent;
      }).catch(() => {});
    }
    if (recordCrawlEventFn) {
      recordCrawlEventFn({
        userAgent: request.headers.get("user-agent") || 'unknown',
        path: pathname,
        method: request.method,
        statusCode: 200,
        referer: request.headers.get("referer") || undefined,
        ipAddress: request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || undefined,
      }).catch(() => {});
    }
  }

  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.resend.com https://www.google-analytics.com https://plausible.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  };

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};

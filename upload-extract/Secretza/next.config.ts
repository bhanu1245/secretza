import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com";

const nextConfig: NextConfig = {
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "space-z.ai",
    "*.space-z.ai",
  ],

  // ---- Allowed Image Domains ----
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "secretza.com",
      },
      {
        protocol: "https",
        hostname: "*.secretza.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },

  // ---- Rewrites: Sitemap .xml extension mapping ----
  async rewrites() {
    return [
      {
        source: '/sitemap/:id.xml',
        destination: '/sitemap/:id',
      },
    ];
  },

  // ---- Compression ----
  compress: true,

  // ---- Production CSP + Security Headers ----
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Content Security Policy (production-hardened)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://plausible.io`,
              `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
              `font-src 'self' https://fonts.gstatic.com`,
              `img-src 'self' data: blob: https:`,
              `connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://plausible.io https://vitals.vercel-insights.com`,
              `frame-ancestors 'none'`,
              `base-uri 'self'`,
              `form-action 'self'`,
            ].join('; '),
          },
          // HSTS — enforce HTTPS in production
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Server-Timing header for monitoring (dev only, removed in prod via Cloudflare)
          ...(process.env.NODE_ENV === 'development' ? [{
            key: "X-Dev-Server",
            value: "true",
          }] : []),
        ],
      },
      {
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes: no cache, prevent browser storage
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

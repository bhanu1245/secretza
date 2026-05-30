import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/upload/file?key=:path*",
      },
      // CMS public aliases
      { source: "/about", destination: "/cms/about" },
      { source: "/terms", destination: "/cms/terms" },
      { source: "/privacy-policy", destination: "/cms/privacy" },
      { source: "/privacy", destination: "/cms/privacy" },
      { source: "/contact", destination: "/cms/contact" },
      { source: "/faq", destination: "/cms/faq" },
      { source: "/safety-tips", destination: "/cms/safety-tips" },
      { source: "/dmca", destination: "/cms/dmca" },
      { source: "/advertise", destination: "/cms/advertise" },
      // Category shortcuts
      { source: "/escorts", destination: "/category/escorts" },
      { source: "/massage", destination: "/category/massage" },
      { source: "/dating", destination: "/category/dating" },
      { source: "/trans", destination: "/category/adult-services" },
      { source: "/male-escorts", destination: "/category/gigolo" },
      { source: "/couples", destination: "/category/companionship" },
      // City shortcuts
      { source: "/mumbai", destination: "/india/maharashtra/mumbai" },
      { source: "/delhi", destination: "/india/delhi/new-delhi" },
      { source: "/bangalore", destination: "/india/karnataka/bangalore" },
      { source: "/hyderabad", destination: "/india/telangana/hyderabad" },
      { source: "/chennai", destination: "/india/tamil-nadu/chennai" },
      { source: "/kolkata", destination: "/india/west-bengal/kolkata" },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "3000",
        pathname: "/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  tunnelRoute: "/api/sentry-tunnel",
});

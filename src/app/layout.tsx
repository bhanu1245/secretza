import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import SessionProvider from "@/components/providers/SessionProvider";
import AuthSync from "@/components/providers/AuthSync";
import Analytics from "@/components/providers/AnalyticsProvider";
import StructuredData from "@/components/seo/StructuredData";
import { getVerificationMetaTag } from '@/lib/seo-verification';
import { BRAND_NAME, BRAND_ASSETS } from "@/lib/brand";
import AgeGate from "@/components/secretza/AgeGate";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase is the canonical origin for the site. Next.js uses it to
  // resolve relative URLs in openGraph.images, twitter.images, alternates.canonical
  // and any other URL-typed metadata field. Must be set for OG/Twitter previews
  // to use absolute URLs in production.
  metadataBase: new URL(SITE_URL),
  title: `${BRAND_NAME} - Premium Adult Classifieds | Worldwide Discreet Listings`,
  description:
    "Discover premium adult classifieds worldwide. Browse escorts, massage, dating, and adult services with complete privacy. Verified listings, secure platform.",
  keywords: [
    "adult classifieds",
    "premium listings",
    "worldwide",
    "escorts",
    "massage",
    "dating",
    "adult services",
    "discreet",
    BRAND_NAME,
  ],
  authors: [{ name: BRAND_NAME }],
  // Homepage canonical — child pages override this via their own generateMetadata.
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: BRAND_ASSETS.favicon, type: "image/svg+xml" },
    ],
    apple: [{ url: BRAND_ASSETS.icon192, type: "image/svg+xml" }],
  },
  openGraph: {
    title: `${BRAND_NAME} - Premium Adult Classifieds`,
    description: "Discover premium adult classifieds worldwide. Complete privacy. Verified listings.",
    url: "/",
    siteName: BRAND_NAME,
    type: "website",
    // BRAND_ASSETS.ogImage is a root-relative path ("/brand/og-image.svg").
    // With metadataBase set, Next.js resolves it to an absolute URL automatically.
    images: [{ url: BRAND_ASSETS.ogImage, width: 1200, height: 630, alt: BRAND_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} - Premium Adult Classifieds`,
    description: "Discover premium adult classifieds worldwide. Complete privacy.",
    images: [BRAND_ASSETS.ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://SecretZa.com" />
        {/* Analytics preload hints */}
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://plausible.io" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#0a0a0f" />
        <StructuredData />
        {getVerificationMetaTag()}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <SessionProvider>
          <Analytics>
            <AuthSync />
            {children}
            <Toaster />
            <AgeGate />
          </Analytics>
        </SessionProvider>
      </body>
    </html>
  );
}

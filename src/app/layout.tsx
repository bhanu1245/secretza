import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import SessionProvider from "@/components/providers/SessionProvider";
import AuthSync from "@/components/providers/AuthSync";
import Analytics from "@/components/providers/AnalyticsProvider";
import StructuredData from "@/components/seo/StructuredData";
import { getVerificationMetaTag } from '@/lib/seo-verification';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Secretza - Premium Adult Classifieds | Worldwide Discreet Listings",
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
    "Secretza",
  ],
  authors: [{ name: "Secretza" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Secretza - Premium Adult Classifieds",
    description: "Discover premium adult classifieds worldwide. Complete privacy. Verified listings.",
    siteName: "Secretza",
    type: "website",
    images: [{ url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com"}/logo.svg`, width: 1200, height: 630, alt: "Secretza" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Secretza - Premium Adult Classifieds",
    description: "Discover premium adult classifieds worldwide. Complete privacy.",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com"}/logo.svg`],
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
        <link rel="dns-prefetch" href="https://secretza.com" />
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
          <Analytics />
          <AuthSync />
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}

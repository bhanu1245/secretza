// ==========================================
// Application Configuration
// ==========================================
// Static configuration data that does NOT come from the database.
// This replaces the pricingPackages export from mock-data.ts.

import type { PricingPackage } from "./types";

export const pricingPackages: PricingPackage[] = [
  {
    id: "pkg-free",
    name: "Basic",
    description: "Get started with a standard listing",
    price: 0,
    currency: "USD",
    duration: 7,
    features: ["1 active listing", "3 images", "7-day duration", "Basic search visibility"],
  },
  {
    id: "pkg-featured",
    name: "Featured",
    description: "Stand out with a featured listing",
    price: 29.99,
    currency: "USD",
    duration: 14,
    features: ["1 active listing", "8 images", "14-day duration", "Featured badge", "Priority in search", "Boost visibility"],
    isPopular: true,
  },
  {
    id: "pkg-premium",
    name: "Premium",
    description: "Maximum exposure and features",
    price: 59.99,
    currency: "USD",
    duration: 30,
    features: [
      "5 active listings",
      "20 images per listing",
      "30-day duration",
      "Featured badge",
      "Top of search results",
      "Analytics dashboard",
      "Priority support",
      "Auto-renewal option",
    ],
  },
  {
    id: "pkg-vip",
    name: "VIP",
    description: "The ultimate premium experience",
    price: 149.99,
    currency: "USD",
    duration: 30,
    features: [
      "Unlimited listings",
      "Unlimited images",
      "30-day duration",
      "VIP badge & glow",
      "Always top placement",
      "Full analytics suite",
      "Dedicated support",
      "Auto-renewal",
      "Custom branding",
    ],
  },
];

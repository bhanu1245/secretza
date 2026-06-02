import { db } from "@/lib/db";
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all approved listings
  const listings = await db.listing.findMany({
    where: { status: "approved" },
    select: { slug: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50000, // Safety cap
  });

  // Fetch categories
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  });

  // Fetch countries
  const countries = await db.country.findMany({
    where: { isActive: true },
    select: { slug: true },
  });

  // Fetch states with country slugs
  const states = await db.state.findMany({
    where: { isActive: true },
    select: { slug: true, country: { select: { slug: true } } },
  });

  // Fetch cities with listing counts
  const cities = await db.city.findMany({
    where: { isActive: true, listingCount: { gt: 0 } },
    select: {
      slug: true,
      state: {
        select: { slug: true, country: { select: { slug: true } } },
      },
    },
  });

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/categories`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/how-it-works`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Category pages — clean SSR URLs
  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/category/${cat.slug}`,
    lastModified: cat.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Country pages
  const countryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${BASE_URL}/country/${country.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // State pages — clean SSR URLs
  const statePages: MetadataRoute.Sitemap = states.map((state) => ({
    url: `${BASE_URL}/${state.country.slug}/${state.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // City pages — clean SSR URLs
  const cityPages: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${BASE_URL}/${city.state.country.slug}/${city.state.slug}/${city.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Listing pages
  const listingPages: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${BASE_URL}/listing/${listing.slug}`,
    lastModified: listing.updatedAt > listing.createdAt ? listing.updatedAt : listing.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // Published SEO pages (includes canonical URLs from DB)
  const seoPages = await db.seoPage.findMany({
    where: { isPublished: true, noindex: false },
    select: { canonicalUrl: true, updatedAt: true, pageType: true, pageSlug: true },
    take: 50000,
  });

  const seoSitemapPages: MetadataRoute.Sitemap = seoPages
    .filter((p) => p.canonicalUrl)
    .map((p) => ({
      url: p.canonicalUrl!.startsWith("http")
        ? p.canonicalUrl!
        : `${BASE_URL}${p.canonicalUrl}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.55,
    }));

  return [
    ...staticPages,
    ...categoryPages,
    ...countryPages,
    ...statePages,
    ...cityPages,
    ...listingPages,
    ...seoSitemapPages,
  ];
}

import type { Metadata } from "next";

export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";

export function buildUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function buildListingUrl(slug: string): string {
  return buildUrl(`/listing/${slug}`);
}

export function buildCategoryUrl(slug: string): string {
  return buildUrl(`/category/${slug}`);
}

export function buildCountryUrl(slug: string): string {
  return buildUrl(`/country/${slug}`);
}

export function buildStateUrl(countrySlug: string, stateSlug: string): string {
  return buildUrl(`/${countrySlug}/${stateSlug}`);
}

export function buildCityUrl(
  countrySlug: string,
  stateSlug: string,
  citySlug: string
): string {
  return buildUrl(`/${countrySlug}/${stateSlug}/${citySlug}`);
}

// Helper to truncate text for meta descriptions
export function truncate(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + "...";
}

// Build breadcrumb structured data
export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Build listing JSON-LD schema
export function buildListingSchema(listing: {
  title: string;
  description: string;
  slug: string;
  category: { name: string };
  city: { name: string };
  country: { name: string };
  images: { url: string }[];
  createdAt: string;
  averageRating?: number;
  reviewCount?: number;
}) {
  const primaryImage =
    listing.images?.[0]?.url || `${BASE_URL}/brand/logo-icon-dark.svg`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    url: buildListingUrl(listing.slug),
    image: primaryImage,
    brand: {
      "@type": "Brand",
      name: "SecretZa",
    },
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceCurrency: "USD",
    },
    aggregateRating: listing.averageRating
      ? {
          "@type": "AggregateRating",
          ratingValue: listing.averageRating,
          reviewCount: listing.reviewCount || 0,
        }
      : undefined,
    datePosted: listing.createdAt,
  };
}

// Build collection page schema (categories, locations)
export function buildCollectionSchema(params: {
  name: string;
  description: string;
  url: string;
  numberOfItems: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: params.name,
    description: params.description,
    url: params.url,
    isPartOf: {
      "@type": "WebSite",
      name: "SecretZa",
      url: BASE_URL,
    },
    numberOfItems: params.numberOfItems,
  };
}

// Build OG image metadata helper
export function ogImage(title: string, description?: string): string {
  // Use the logo as default OG image (in production, generate dynamic OG images)
  return `${BASE_URL}/brand/logo-icon-dark.svg`;
}

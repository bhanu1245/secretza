import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BASE_URL,
  buildUrl,
  buildCountryUrl,
  buildStateUrl,
  buildCityUrl,
  truncate,
  buildBreadcrumbSchema,
  buildCollectionSchema,
} from "@/lib/seo-ssr";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import ListingCard from "@/components/secretza/listing/ListingCard";
import type { Listing } from "@/lib/types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface CityPageProps {
  params: Promise<{ country: string; state: string; city: string }>;
}

// ------------------------------------------------------------------
// Static Params
// ------------------------------------------------------------------
export async function generateStaticParams() {
  const cities = await db.city.findMany({
    where: { isActive: true },
    include: {
      state: { include: { country: { select: { slug: true } } } },
    },
  });
  return cities.map((c) => ({
    country: c.state.country.slug,
    state: c.state.slug,
    city: c.slug,
  }));
}

// ------------------------------------------------------------------
// Metadata
// ------------------------------------------------------------------
export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const { country: countrySlug, state: stateSlug, city: citySlug } = await params;

  const city = await db.city.findFirst({
    where: {
      slug: citySlug,
      state: { slug: stateSlug, country: { slug: countrySlug } },
      isActive: true,
    },
    include: {
      state: { include: { country: true } },
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!city) {
    return { title: "City Not Found | Secretza" };
  }

  const fullUrl = buildCityUrl(countrySlug, stateSlug, citySlug);
  const total = city._count.listings;
  const countryName = city.state.country.name;
  const stateName = city.state.name;
  const title = `Classifieds in ${city.name}, ${stateName}, ${countryName} - ${total} Listings | Secretza`;
  const description = truncate(
    `Browse ${total} classified ads in ${city.name}, ${stateName}, ${countryName}. Find local listings on Secretza.`
  );

  return {
    title,
    description,
    alternates: {
      canonical: fullUrl,
    },
    openGraph: {
      title,
      description,
      url: fullUrl,
      siteName: "Secretza",
      type: "website",
      images: [{ url: `${BASE_URL}/logo.svg`, width: 1200, height: 630, alt: "Secretza" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/logo.svg`],
    },
  };
}

// ------------------------------------------------------------------
// Helper to serialize a listing from DB to Listing type
// ------------------------------------------------------------------
function serializeListing(l: {
  id: string;
  title: string;
  slug: string;
  description: string;
  tags: string;
  price: string;
  currency: string;
  status: string;
  isFeatured: boolean;
  isBoosted: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null; image: string | null; isVerified: boolean };
  category: { id: string; name: string; slug: string; color: string };
  country: { id: string; name: string; slug: string };
  state: { id: string; name: string; slug: string } | null;
  city: { id: string; name: string; slug: string };
  listingImages: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    mediumUrl: string;
    width: number;
    height: number;
    sortOrder: number;
    blurHash: string | null;
  }>;
  _count: { reviews: number };
}): Listing {
  let tags: string[] = [];
  try {
    tags = JSON.parse(l.tags || "[]");
  } catch {
    tags = [];
  }
  let legacyImages: { url: string; alt?: string; isPrimary?: boolean }[] = [];
  try {
    // legacyImages not used anymore - listingImages is the primary source
    legacyImages = [];
  } catch {
    legacyImages = [];
  }

  return {
    id: l.id,
    title: l.title,
    slug: l.slug,
    description: l.description,
    tags,
    price: l.price,
    currency: l.currency,
    contact: {},
    status: l.status as Listing["status"],
    isFeatured: l.isFeatured,
    isBoosted: l.isBoosted,
    featuredUntil: null,
    boostUntil: null,
    lastBumpedAt: null,
    priorityScore: 0,
    expiresAt: null,
    viewCount: l.viewCount,
    createdAt: l.createdAt.toISOString(),
    user: { id: l.user.id, name: l.user.name, avatar: l.user.image },
    category: l.category as any,
    country: l.country as any,
    state: (l.state || { id: "", name: "", slug: "", countryId: "", isActive: true, listingCount: 0 }) as any,
    city: l.city as any,
    images: legacyImages,
    listingImages: l.listingImages as any,
    reviewCount: l._count.reviews,
  };
}

// ------------------------------------------------------------------
// Page Component
// ------------------------------------------------------------------
export default async function CityPage({ params }: CityPageProps) {
  const { country: countrySlug, state: stateSlug, city: citySlug } = await params;

  const city = await db.city.findFirst({
    where: {
      slug: citySlug,
      state: { slug: stateSlug, country: { slug: countrySlug } },
      isActive: true,
    },
    include: {
      state: { include: { country: true } },
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!city) {
    notFound();
  }

  const total = city._count.listings;
  const countryName = city.state.country.name;
  const stateName = city.state.name;
  const countrySlugActual = city.state.country.slug;
  const stateSlugActual = city.state.slug;

  // Fetch listings (limit 24)
  const listings = await db.listing.findMany({
    where: {
      citySlug,
      stateSlug: stateSlugActual,
      countrySlug: countrySlugActual,
      status: "approved",
    },
    include: {
      user: { select: { id: true, name: true, image: true, isVerified: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      country: { select: { id: true, name: true, slug: true } },
      state: { select: { id: true, name: true, slug: true } },
      city: { select: { id: true, name: true, slug: true } },
      listingImages: {
        where: { moderationStatus: "approved" },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
      _count: { select: { reviews: true } },
    },
    orderBy: { priorityScore: "desc" },
    take: 24,
  });

  const serializedListings = listings.map((l) => serializeListing(l as any));

  // Breadcrumb
  const breadcrumbItems = [
    { label: "Home", href: buildUrl("/") },
    { label: countryName, href: buildCountryUrl(countrySlugActual) },
    {
      label: stateName,
      href: buildStateUrl(countrySlugActual, stateSlugActual),
    },
    { label: city.name },
  ];

  // JSON-LD
  const fullUrl = buildCityUrl(countrySlug, stateSlug, citySlug);
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems as any);
  const collectionSchema = buildCollectionSchema({
    name: `Classifieds in ${city.name}, ${stateName}, ${countryName}`,
    description: `Browse ${total} classified ads in ${city.name}`,
    url: fullUrl,
    numberOfItems: total,
  });

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={collectionSchema} />

      <div className="min-h-screen pt-20 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={breadcrumbItems} />

          {/* City Header */}
          <div className="flex flex-col gap-3 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Classifieds in {city.name}, {stateName}, {countryName}
            </h1>
            <p className="text-muted-foreground text-sm">
              {total} listing{total !== 1 ? "s" : ""} available
            </p>
          </div>

          {/* Listings Grid */}
          {serializedListings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {serializedListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-light flex items-center justify-center mb-4">
                <span className="text-3xl">📍</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                No listings in {city.name} yet
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                There are no approved listings in {city.name} yet. Be the first to
                post!
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

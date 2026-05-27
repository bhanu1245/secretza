import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
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
interface StatePageProps {
  params: Promise<{ country: string; state: string }>;
}

// ------------------------------------------------------------------
// Static Params
// ------------------------------------------------------------------
export async function generateStaticParams() {
  const states = await db.state.findMany({
    where: { isActive: true },
    include: { country: { select: { slug: true } } },
  });
  return states.map((s) => ({
    country: s.country.slug,
    state: s.slug,
  }));
}

// ------------------------------------------------------------------
// Metadata
// ------------------------------------------------------------------
export async function generateMetadata({
  params,
}: StatePageProps): Promise<Metadata> {
  const { country: countrySlug, state: stateSlug } = await params;

  const state = await db.state.findFirst({
    where: { slug: stateSlug, country: { slug: countrySlug }, isActive: true },
    include: {
      country: true,
      cities: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!state) {
    return { title: "State Not Found | Secretza" };
  }

  const fullUrl = buildStateUrl(countrySlug, stateSlug);
  const total = state._count.listings;
  const title = `Classifieds in ${state.name}, ${state.country.name} - ${total} Listings | Secretza`;
  const description = truncate(
    `Browse ${total} classified ads in ${state.name}, ${state.country.name}. Find local listings on Secretza.`
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
export default async function StatePage({ params }: StatePageProps) {
  const { country: countrySlug, state: stateSlug } = await params;

  const state = await db.state.findFirst({
    where: { slug: stateSlug, country: { slug: countrySlug }, isActive: true },
    include: {
      country: true,
      cities: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!state) {
    notFound();
  }

  const total = state._count.listings;

  // Fetch top listings (limit 24)
  const listings = await db.listing.findMany({
    where: { stateSlug, countrySlug, status: "approved" },
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
    { label: state.country.name, href: buildCountryUrl(state.country.slug) },
    { label: state.name },
  ];

  // JSON-LD
  const fullUrl = buildStateUrl(countrySlug, stateSlug);
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems as any);
  const collectionSchema = buildCollectionSchema({
    name: `Classifieds in ${state.name}, ${state.country.name}`,
    description: `Browse ${total} classified ads in ${state.name}, ${state.country.name}`,
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

          {/* State Header */}
          <div className="flex flex-col gap-3 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Classifieds in {state.name}, {state.country.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {total} listing{total !== 1 ? "s" : ""} across{" "}
              {state.cities.length} cit{state.cities.length !== 1 ? "ies" : "y"}
            </p>
          </div>

          {/* Cities List */}
          {state.cities.length > 0 && (
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Browse by City
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {state.cities
                  .filter((c) => c.listingCount > 0)
                  .map((city) => (
                    <Link
                      key={city.id}
                      href={buildCityUrl(
                        state.country.slug,
                        state.slug,
                        city.slug
                      )}
                      className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface px-4 py-3 hover:border-violet/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-muted-foreground group-hover:text-violet transition-colors" />
                        <span className="text-sm font-medium text-foreground">
                          {city.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{city.listingCount}</span>
                        <ChevronRight className="size-3" />
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Top Listings */}
          {serializedListings.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Top Listings in {state.name}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {serializedListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

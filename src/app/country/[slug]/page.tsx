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
interface CountryPageProps {
  params: Promise<{ slug: string }>;
}

// ------------------------------------------------------------------
// Static Params
// ------------------------------------------------------------------
export async function generateStaticParams() {
  const countries = await db.country.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return countries.map((c) => ({ slug: c.slug }));
}

// ------------------------------------------------------------------
// Metadata
// ------------------------------------------------------------------
export async function generateMetadata({
  params,
}: CountryPageProps): Promise<Metadata> {
  const { slug } = await params;

  const country = await db.country.findUnique({
    where: { slug },
    include: {
      states: { where: { isActive: true }, orderBy: { listingCount: "desc" } },
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!country) {
    return { title: "Country Not Found | Secretza" };
  }

  const fullUrl = buildCountryUrl(country.slug);
  const total = country._count.listings;
  const title = `Classifieds in ${country.name} - ${total} Listings | Secretza`;
  const description = truncate(
    `Browse ${total} classified ads in ${country.name}. Find the best listings across all categories on Secretza.`
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
  user: { id: string; name: string | null; avatar: string | null; isVerified: boolean };
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
    legacyImages = JSON.parse(l.images || "[]");
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
    updatedAt: l.updatedAt.toISOString(),
    user: { id: l.user.id, name: l.user.name, avatar: l.user.image },
    category: l.category,
    country: l.country,
    state: l.state || { id: "", name: "", slug: "", countryId: "", isActive: true, listingCount: 0 },
    city: l.city,
    images: legacyImages,
    listingImages: l.listingImages,
    reviewCount: l._count.reviews,
  };
}

// ------------------------------------------------------------------
// Page Component
// ------------------------------------------------------------------
export default async function CountryPage({ params }: CountryPageProps) {
  const { slug } = await params;

  const country = await db.country.findUnique({
    where: { slug },
    include: {
      states: {
        where: { isActive: true },
        orderBy: { listingCount: "desc" },
      },
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!country || !country.isActive) {
    notFound();
  }

  const total = country._count.listings;

  // Fetch top listings in this country (limit 12)
  const listings = await db.listing.findMany({
    where: { countrySlug: slug, status: "approved" },
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
    take: 12,
  });

  const serializedListings = listings.map(serializeListing);

  // Breadcrumb
  const breadcrumbItems = [
    { name: "Home", url: buildUrl("/") },
    { name: country.name },
  ];

  // JSON-LD
  const fullUrl = buildCountryUrl(country.slug);
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems);
  const collectionSchema = buildCollectionSchema({
    name: `Classifieds in ${country.name}`,
    description: `Browse ${total} classified ads in ${country.name} on Secretza`,
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

          {/* Country Header */}
          <div className="flex flex-col gap-3 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Classifieds in {country.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {total} listing{total !== 1 ? "s" : ""} across{" "}
              {country.states.length} region
              {country.states.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* States List */}
          {country.states.length > 0 && (
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Browse by Region
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {country.states
                  .filter((s) => s.listingCount > 0)
                  .map((state) => (
                    <Link
                      key={state.id}
                      href={buildStateUrl(country.slug, state.slug)}
                      className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface px-4 py-3 hover:border-violet/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-muted-foreground group-hover:text-violet transition-colors" />
                        <span className="text-sm font-medium text-foreground">
                          {state.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{state.listingCount}</span>
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
                Top Listings in {country.name}
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

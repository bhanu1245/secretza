import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BASE_URL,
  buildUrl,
  buildListingUrl,
  buildCategoryUrl,
  buildCityUrl,
  truncate,
  buildBreadcrumbSchema,
  buildListingSchema,
} from "@/lib/seo-ssr";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import ListingPageContent from "./ListingPageContent";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

// ------------------------------------------------------------------
// Static Params
// ------------------------------------------------------------------
export async function generateStaticParams() {
  const listings = await db.listing.findMany({
    where: { status: "approved" },
    select: { slug: true },
  });
  return listings.map((l) => ({ slug: l.slug }));
}

// ------------------------------------------------------------------
// Metadata
// ------------------------------------------------------------------
export async function generateMetadata({
  params,
}: ListingPageProps): Promise<Metadata> {
  const { slug } = await params;

  const listing = await db.listing.findFirst({
    where: { slug, status: "approved" },
    include: {
      user: { select: { name: true, image: true, isVerified: true } },
      category: true,
      country: true,
      state: true,
      city: true,
      listingImages: {
        where: { moderationStatus: "approved" },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { reviews: true } },
    },
  });

  if (!listing) {
    return { title: "Listing Not Found | Secretza" };
  }

  const reviews = await db.review.aggregate({
    where: { listingId: listing.id, status: "approved" },
    _avg: { rating: true },
    _count: true,
  });

  const fullUrl = buildListingUrl(listing.slug);
  const primaryImage =
    listing.listingImages[0]?.url || `${BASE_URL}/logo.svg`;

  const title = `${listing.title} - ${listing.category.name} in ${listing.city.name} | Secretza`;
  const description = truncate(listing.description);

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
      type: "article",
      images: [{ url: primaryImage, width: 1200, height: 630, alt: listing.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [primaryImage],
    },
  };
}

// ------------------------------------------------------------------
// Page Component
// ------------------------------------------------------------------
export default async function ListingPage({ params }: ListingPageProps) {
  const { slug } = await params;

  const listing = await db.listing.findFirst({
    where: { slug, status: "approved" },
    include: {
      user: { select: { id: true, name: true, image: true, isVerified: true } },
      category: true,
      country: true,
      state: true,
      city: true,
      listingImages: {
        where: { moderationStatus: "approved" },
        orderBy: { sortOrder: "asc" },
      },
      reviews: {
        where: { status: "approved" },
        select: { rating: true },
      },
    },
  });

  if (!listing) {
    notFound();
  }

  // Increment viewCount (fire-and-forget)
  try {
    await db.listing.update({
      where: { id: listing.id },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Silently fail — view count is not critical
  }

  // Parse tags from JSON string
  let tags: string[] = [];
  try {
    tags = JSON.parse(listing.tags || "[]");
  } catch {
    tags = [];
  }

  let services: string[] = [];
  try {
    services = JSON.parse(listing.services || "[]");
  } catch {
    services = [];
  }

  // Parse images from JSON string (legacy format)
  let legacyImages: { url: string; alt?: string; isPrimary?: boolean }[] = [];
  try {
    legacyImages = JSON.parse(listing.images || "[]");
  } catch {
    legacyImages = [];
  }

  // Compute review stats
  const ratings = listing.reviews.map((r) => r.rating);
  const reviewCount = ratings.length;
  const averageRating =
    reviewCount > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / reviewCount
      : 0;

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: buildUrl("/") },
    {
      name: listing.category.name,
      url: buildCategoryUrl(listing.category.slug),
    },
    {
      name: listing.city.name,
      url: listing.state
        ? buildCityUrl(
            listing.country.slug,
            listing.state.slug,
            listing.city.slug
          )
        : buildUrl("/"),
    },
    { name: listing.title },
  ];

  // JSON-LD schemas
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems as any);
  const listingSchema = buildListingSchema({
    title: listing.title,
    description: listing.description,
    slug: listing.slug,
    category: { name: listing.category.name },
    city: { name: listing.city.name },
    country: { name: listing.country.name },
    images: listing.listingImages.map((img) => ({ url: img.url })),
    createdAt: listing.createdAt.toISOString(),
    averageRating,
    reviewCount,
  });

  // Serialize listing data for client component
  const serializedListing = {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    tags,
    services,
    price: listing.price,
    currency: listing.currency,
    status: listing.status,
    isFeatured: listing.isFeatured,
    isBoosted: listing.isBoosted,
    viewCount: listing.viewCount,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    contactEmail: listing.contactEmail,
    contactTelegram: listing.contactTelegram,
    contactInstagram: listing.contactInstagram,
    contactWebsite: listing.contactWebsite,
    contactText: listing.contactText,
    whatsapp: listing.whatsapp,
    telegram: listing.telegram,
    age: listing.age,
    profileImage: listing.profileImage,
    galleryImages: listing.galleryImages,
    user: {
      id: listing.user?.id || "",
      name: listing.user?.name || "Unknown user",
      avatar: listing.user?.image || null,
      isVerified: listing.user?.isVerified || false,
    },
    category: {
      id: listing.category.id,
      name: listing.category.name,
      slug: listing.category.slug,
      color: listing.category.color,
    },
    country: {
      id: listing.country.id,
      name: listing.country.name,
      slug: listing.country.slug,
    },
    state: listing.state
      ? {
          id: listing.state.id,
          name: listing.state.name,
          slug: listing.state.slug,
        }
      : null,
    city: {
      id: listing.city.id,
      name: listing.city.name,
      slug: listing.city.slug,
    },
    listingImages: listing.listingImages.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      mediumUrl: img.mediumUrl,
      width: img.width,
      height: img.height,
      sortOrder: img.sortOrder,
      blurHash: img.blurHash,
    })),
    legacyImages,
    averageRating,
    reviewCount,
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={listingSchema} />

      <div className="min-h-screen pt-20 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={breadcrumbItems as any} />
          <ListingPageContent listing={serializedListing} />
        </div>
      </div>
    </>
  );
}

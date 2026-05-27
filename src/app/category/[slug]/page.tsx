import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BASE_URL,
  buildUrl,
  buildCategoryUrl,
  buildListingUrl,
  truncate,
  buildBreadcrumbSchema,
  buildCollectionSchema,
} from "@/lib/seo-ssr";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import CategoryPageContent from "./CategoryPageContent";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

// ------------------------------------------------------------------
// Static Params
// ------------------------------------------------------------------
export async function generateStaticParams() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return categories.map((c) => ({ slug: c.slug }));
}

// ------------------------------------------------------------------
// Metadata
// ------------------------------------------------------------------
export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  const category = await db.category.findUnique({
    where: { slug },
    include: {
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!category) {
    return { title: "Category Not Found | Secretza" };
  }

  const fullUrl = buildCategoryUrl(category.slug);
  const total = category._count.listings;
  const title = `${category.name} - ${total} Listings | Secretza`;
  const description = truncate(
    category.seoDescription ||
      category.description ||
      `Browse ${total} ${category.name} listings on Secretza. Find the best ${category.name.toLowerCase()} services worldwide.`
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
// Page Component
// ------------------------------------------------------------------
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  const category = await db.category.findUnique({
    where: { slug },
    include: {
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!category || !category.isActive) {
    notFound();
  }

  const total = category._count.listings;

  // Fetch approved listings for this category (limit 24)
  const listings = await db.listing.findMany({
    where: { categorySlug: slug, status: "approved" },
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

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: buildUrl("/") },
    { label: category.name },
  ];

  // JSON-LD schemas
  const fullUrl = buildCategoryUrl(category.slug);
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems as any);
  const collectionSchema = buildCollectionSchema({
    name: category.name,
    description:
      category.description ||
      `${category.name} classifieds on Secretza`,
    url: fullUrl,
    numberOfItems: total,
  });

  // Serialize listings for client component
  const serializedListings = listings.map((l) => {
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

    const primaryImage = l.listingImages[0];

    return {
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      tags,
      price: l.price,
      currency: l.currency,
      status: l.status,
      isFeatured: l.isFeatured,
      isBoosted: l.isBoosted,
      viewCount: l.viewCount,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      user: {
        id: l.user.id,
        name: l.user.name,
        avatar: l.user.image,
        isVerified: l.user.isVerified,
      },
      category: {
        id: l.category.id,
        name: l.category.name,
        slug: l.category.slug,
        color: l.category.color,
      },
      country: {
        id: l.country.id,
        name: l.country.name,
        slug: l.country.slug,
      },
      state: l.state ? {
        id: l.state.id,
        name: l.state.name,
        slug: l.state.slug,
      } : { id: "", name: "", slug: "" },
      city: {
        id: l.city.id,
        name: l.city.name,
        slug: l.city.slug,
      },
      images: legacyImages,
      listingImages: l.listingImages.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        mediumUrl: img.mediumUrl,
        width: img.width,
        height: img.height,
        sortOrder: img.sortOrder,
        blurHash: img.blurHash,
      })),
      reviewCount: l._count.reviews,
    };
  });

  // Serialize category
  const serializedCategory = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    color: category.color,
    listingCount: total,
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={collectionSchema} />

      <div className="min-h-screen pt-20 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={breadcrumbItems} />
          <CategoryPageContent
            category={serializedCategory}
            listings={serializedListings as any}
            total={total}
          />
        </div>
      </div>
    </>
  );
}

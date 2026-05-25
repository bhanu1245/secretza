// ==========================================
// Category, City & State Page: /[slug]
// ==========================================
// Server component for category-level, city-level, and state-level pages.
// - /escorts → Category page
// - /mumbai → City page
// - /goa → State page
// - /unknown → 404

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  resolveSlug,
  CATEGORIES,
  getTopCities,
  getNearbyCitiesForCity,
  getStateName,
  getCitiesByState,
} from "@/lib/seo-resolver";
import {
  generateCategorySEO,
  generateCitySEO,
  generateStateSEO,
  shouldNoindex,
} from "@/lib/seo-content";
import { getSeoPageData } from "@/lib/seo-helpers";
import { indiaCities } from "@/lib/india-geo-data";
import { db } from "@/lib/db";
import SeoPageLayout from "@/components/seo/SeoPageLayout";
import {
  generateCategoryPageSchemas,
  generateCityPageSchemas,
  generateStatePageSchemas,
} from "@/components/seo/PageStructuredData";

export const revalidate = 3600; // ISR: revalidate every 1 hour

const ALL_CATEGORIES = [
  { slug: "escorts", name: "Escorts" },
  { slug: "massage", name: "Massage" },
  { slug: "dating", name: "Dating" },
  { slug: "trans", name: "Trans" },
  { slug: "male-escorts", name: "Male Escorts" },
  { slug: "couples", name: "Couples" },
  { slug: "adult-jobs", name: "Adult Jobs" },
  { slug: "adult-services", name: "Adult Services" },
  { slug: "webcam", name: "Webcam" },
  { slug: "phone-chat", name: "Phone & Chat" },
];

export async function generateStaticParams() {
  const topCities = getTopCities(50);
  const { getAllStateSlugs } = await import("@/lib/seo-resolver");
  return [
    ...CATEGORIES.map((c) => ({ slug: c.slug })),
    ...topCities.map((c) => ({ slug: c.slug })),
    ...getAllStateSlugs().map((s) => ({ slug: s })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Skip reserved system paths
  if (slug.includes('.') || slug.startsWith('_') || slug === 'sitemap' || slug === 'robots') {
    return {};
  }

  const resolved = resolveSlug(slug);

  if (!resolved || resolved.type === "longtail") return {};

  const canonicalUrl = `https://secretza.com/${slug}`;

  if (resolved.type === "state") {
    const state = resolved.data;
    const override = await getSeoPageData("state", state.slug);
    const seo = generateStateSEO(state.name, state.slug);
    const title = override?.title ?? seo.title;
    const description = override?.metaDescription ?? seo.metaDescription;

    return {
      title,
      description,
      openGraph: { title, description, url: canonicalUrl, siteName: "Secretza" },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: canonicalUrl },
      ...(override?.noindex ? { robots: { index: false } } : {}),
    };
  }

  if (resolved.type === "category") {
    const cat = resolved.data;
    const override = await getSeoPageData("category", cat.slug);
    const seo = generateCategorySEO(cat.name, cat.slug);
    const title = override?.title ?? seo.title;
    const description = override?.metaDescription ?? seo.metaDescription;

    return {
      title,
      description,
      openGraph: { title, description, url: canonicalUrl, siteName: "Secretza" },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: canonicalUrl },
      ...(override?.noindex ? { robots: { index: false } } : {}),
    };
  }

  if (resolved.type === "city") {
    const city = resolved.data;
    const stateName = getStateName(city.stateSlug);
    const override = await getSeoPageData("city", city.slug);

    const seo = generateCitySEO(city.name, city.slug, stateName);
    const title = override?.title ?? seo.title;
    const description = override?.metaDescription ?? seo.metaDescription;

    // Dynamic noindex based on listing count
    const listingCount = await db.listing.count({
      where: { citySlug: city.slug, status: 'approved' },
    });
    const isNoindex = override?.noindex || shouldNoindex('city', listingCount, { citySlug: city.slug });

    return {
      title,
      description,
      openGraph: { title, description, url: canonicalUrl, siteName: "Secretza" },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: canonicalUrl },
      ...(isNoindex ? { robots: { index: false } } : {}),
    };
  }

  return {};
}

function formatListings(listings: Array<{
  id: string; title: string; slug: string; description: string;
  price: string | null; citySlug: string; categorySlug: string;
  images: string; isFeatured: boolean; isBoosted: boolean; createdAt: Date;
}>) {
  return listings.map((l) => {
    const city = indiaCities.find((c) => c.slug === l.citySlug);
    const cat = ALL_CATEGORIES.find((c) => c.slug === l.categorySlug);
    let images: string[] = [];
    try { images = JSON.parse(l.images || "[]"); } catch { images = []; }
    return {
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      price: l.price,
      citySlug: l.citySlug,
      cityName: city?.name ?? l.citySlug,
      categorySlug: l.categorySlug,
      categoryName: cat?.name ?? l.categorySlug,
      images,
      isFeatured: l.isFeatured,
      isBoosted: l.isBoosted,
      createdAt: l.createdAt.toISOString(),
    };
  });
}

// Reserved system paths that must never be handled by the [slug] catch-all
const RESERVED_SLUGS = new Set([
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
  'favicon',
  'manifest.json',
  'manifest',
  'sitemap',
  'robots',
  'api',
  '_next',
  'india',
]);

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Block reserved system paths immediately
  if (RESERVED_SLUGS.has(slug) || slug.includes('.') || slug.startsWith('_')) {
    notFound();
  }

  const resolved = resolveSlug(slug);

  if (!resolved || resolved.type === "longtail") {
    notFound();
  }

  if (resolved.type === "state") {
    return <StatePageContent slug={resolved.data.slug} name={resolved.data.name} />;
  }

  if (resolved.type === "category") {
    return <CategoryPageContent slug={resolved.data.slug} name={resolved.data.name} />;
  }

  if (resolved.type === "city") {
    return <CityPageContent city={resolved.data} />;
  }

  notFound();
}

// ------------------------------------------
// State Page Content (accessible at /goa, /maharashtra, etc.)
// ------------------------------------------

async function StatePageContent({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const canonicalUrl = `https://secretza.com/${slug}`;

  // SEO content with override
  const override = await getSeoPageData("state", slug);
  const generated = generateStateSEO(name, slug);
  const seo = {
    ...generated,
    title: override?.title ?? generated.title,
    metaDescription: override?.metaDescription ?? generated.metaDescription,
    h1: override?.h1 ?? generated.h1,
    introParagraph: override?.introContent ?? generated.introParagraph,
    faqs: override?.faqs && override.faqs.length > 0 ? override.faqs : generated.faqs,
  };

  // Listings in this state
  const listings = await db.listing.findMany({
    where: { stateSlug: slug, status: "approved" },
    take: 20,
    orderBy: { priorityScore: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, price: true,
      citySlug: true, categorySlug: true, images: true, isFeatured: true,
      isBoosted: true, createdAt: true,
    },
  });

  // Cities in this state
  const stateCities = getCitiesByState(slug);

  const structuredData = generateStatePageSchemas(seo, { name, slug } as any);
  const noindex = override?.noindex ?? false;

  return (
    <>
      {/* Prefetch top state city links */}
      {stateCities.slice(0, 6).map((city) => (
        <link key={`prefetch-state-${city.slug}`} rel="prefetch" href={`/${city.slug}`} />
      ))}
    <SeoPageLayout
      seo={seo}
      listings={formatListings(listings)}
      structuredData={structuredData}
      canonicalUrl={canonicalUrl}
      noindex={noindex}
    >
      {/* Cities in this state */}
      {stateCities.length > 0 && (
        <section className="mb-12" aria-label={`Cities in ${name}`}>
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Cities in {name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {stateCities.slice(0, 24).map((city) => (
              <Link
                key={city.slug}
                href={`/${city.slug}`}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200"
              >
                <svg className="w-4 h-4 text-violet/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="truncate">{city.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SeoPageLayout>
    </>
  );
}

// ------------------------------------------
// Category Page Content
// ------------------------------------------

async function CategoryPageContent({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const canonicalUrl = `https://secretza.com/${slug}`;

  // SEO content with override
  const override = await getSeoPageData("category", slug);
  const generated = generateCategorySEO(name, slug);
  const seo = {
    ...generated,
    title: override?.title ?? generated.title,
    metaDescription: override?.metaDescription ?? generated.metaDescription,
    h1: override?.h1 ?? generated.h1,
    introParagraph: override?.introContent ?? generated.introParagraph,
    faqs: override?.faqs && override.faqs.length > 0 ? override.faqs : generated.faqs,
  };

  // Listings
  const listings = await db.listing.findMany({
    where: { categorySlug: slug, status: "approved" },
    take: 20,
    orderBy: { priorityScore: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, price: true,
      citySlug: true, categorySlug: true, images: true, isFeatured: true,
      isBoosted: true, createdAt: true,
    },
  });

  // Top cities for this category
  const topCities = getTopCities(24);

  // Total count
  const totalListings = await db.listing.count({
    where: { categorySlug: slug, status: "approved" },
  });

  const structuredData = generateCategoryPageSchemas(seo, { name, slug });
  const noindex = override?.noindex ?? false;

  return (
    <>
      {/* Prefetch top category-city links */}
      {topCities.slice(0, 6).map((city) => (
        <link key={`prefetch-cat-${city.slug}`} rel="prefetch" href={`/${slug}/${city.slug}`} />
      ))}
    <SeoPageLayout
      seo={seo}
      listings={formatListings(listings)}
      structuredData={structuredData}
      canonicalUrl={canonicalUrl}
      noindex={noindex}
      totalListings={totalListings}
    >
      {/* Top Cities Grid for this Category */}
      <section className="mb-12" aria-label={`${name} by City`}>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {name} by City
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {topCities.map((city) => (
            <Link
              key={city.slug}
              href={`/${slug}/${city.slug}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200"
            >
              <svg className="w-4 h-4 text-violet/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
              </svg>
              <span className="truncate">{city.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </SeoPageLayout>
    </>
  );
}

// ------------------------------------------
// City Page Content
// ------------------------------------------

async function CityPageContent({
  city,
}: {
  city: { name: string; slug: string; stateSlug: string };
}) {
  const canonicalUrl = `https://secretza.com/${city.slug}`;
  const stateName = getStateName(city.stateSlug);

  // SEO content with override
  const override = await getSeoPageData("city", city.slug);
  const generated = generateCitySEO(city.name, city.slug, stateName);
  const seo = {
    ...generated,
    title: override?.title ?? generated.title,
    metaDescription: override?.metaDescription ?? generated.metaDescription,
    h1: override?.h1 ?? generated.h1,
    introParagraph: override?.introContent ?? generated.introParagraph,
    faqs: override?.faqs && override.faqs.length > 0 ? override.faqs : generated.faqs,
  };

  // Listings
  const listings = await db.listing.findMany({
    where: { citySlug: city.slug, status: "approved" },
    take: 20,
    orderBy: { priorityScore: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, price: true,
      citySlug: true, categorySlug: true, images: true, isFeatured: true,
      isBoosted: true, createdAt: true,
    },
  });

  // Nearby cities
  const nearbyCities = getNearbyCitiesForCity(city.slug, 8);

  // Total count
  const totalListings = await db.listing.count({
    where: { citySlug: city.slug, status: "approved" },
  });

  const structuredData = generateCityPageSchemas(seo, city as any, stateName);
  const noindex = override?.noindex ?? false;

  return (
    <>
      {/* Prefetch category links for this city */}
      {CATEGORIES.slice(0, 6).map((cat) => (
        <link key={`prefetch-city-cat-${cat.slug}`} rel="prefetch" href={`/${cat.slug}/${city.slug}`} />
      ))}
      {/* Prefetch nearby city links */}
      {nearbyCities.slice(0, 4).map((nc) => (
        <link key={`prefetch-nearby-${nc.slug}`} rel="prefetch" href={`/${nc.slug}`} />
      ))}
    <SeoPageLayout
      seo={seo}
      listings={formatListings(listings)}
      structuredData={structuredData}
      canonicalUrl={canonicalUrl}
      noindex={noindex}
      totalListings={totalListings}
    >
      {/* Categories in this city */}
      <section className="mb-12" aria-label="Categories">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Categories in {city.name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/${cat.slug}/${city.slug}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200"
            >
              <svg className="w-4 h-4 text-violet/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              <span className="truncate">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Nearby Cities */}
      {nearbyCities.length > 0 && (
        <section className="mb-12" aria-label="Nearby Cities">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Nearby Cities
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {nearbyCities.map((nc) => (
              <Link
                key={nc.slug}
                href={`/${nc.slug}`}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200"
              >
                <svg className="w-4 h-4 text-violet/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="truncate">{nc.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SeoPageLayout>
    </>
  );
}

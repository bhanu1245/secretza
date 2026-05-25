// ==========================================
// Country Page: /india
// ==========================================
// Server component for the India country-level SEO page.
// Shows all 36 states, top cities, and listings.

import { Metadata } from "next";
import Link from "next/link";
import { generateCountrySEO } from "@/lib/seo-content";
import { getSeoPageData } from "@/lib/seo-helpers";
import { indiaCities, indiaStates } from "@/lib/india-geo-data";
import { getTopCities } from "@/lib/seo-resolver";
import { db } from "@/lib/db";
import SeoPageLayout from "@/components/seo/SeoPageLayout";
import { generateCountryPageSchemas } from "@/components/seo/PageStructuredData";

export const dynamic = "force-dynamic";

const CANONICAL_URL = "https://secretza.com/india";

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

export async function generateMetadata(): Promise<Metadata> {
  const override = await getSeoPageData("country", "india");

  if (override?.noindex) {
    return { robots: { index: false } };
  }

  const seo = generateCountrySEO("India", "india");
  const title = override?.title ?? seo.title;
  const description = override?.metaDescription ?? seo.metaDescription;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Secretza",
      url: CANONICAL_URL,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: CANONICAL_URL,
    },
  };
}

export default async function IndiaPage() {
  // 1. Get SEO content with DB override support
  const override = await getSeoPageData("country", "india");
  const generated = generateCountrySEO("India", "india");

  const seo = {
    ...generated,
    title: override?.title ?? generated.title,
    metaDescription: override?.metaDescription ?? generated.metaDescription,
    h1: override?.h1 ?? generated.h1,
    introParagraph: override?.introContent ?? generated.introParagraph,
    faqs: override?.faqs && override.faqs.length > 0 ? override.faqs : generated.faqs,
  };

  // 2. Fetch top 20 approved listings
  const listings = await db.listing.findMany({
    where: { status: "approved" },
    take: 20,
    orderBy: { priorityScore: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      price: true,
      citySlug: true,
      categorySlug: true,
      images: true,
      isFeatured: true,
      isBoosted: true,
      createdAt: true,
    },
  });

  const formattedListings = listings.map((l) => {
    const city = indiaCities.find((c) => c.slug === l.citySlug);
    const cat = ALL_CATEGORIES.find((c) => c.slug === l.categorySlug);
    let images: string[] = [];
    try {
      images = JSON.parse(l.images || "[]");
    } catch {
      images = [];
    }
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

  // 3. Get data for state and city grids
  const topCities = getTopCities(24);
  const noindex = override?.noindex ?? false;

  // 4. Generate structured data
  const structuredData = generateCountryPageSchemas(seo);

  // 5. Get total approved listings count
  const totalListings = await db.listing.count({
    where: { status: "approved" },
  });

  return (
    <SeoPageLayout
      seo={seo}
      listings={formattedListings}
      structuredData={structuredData}
      canonicalUrl={CANONICAL_URL}
      noindex={noindex}
      totalListings={totalListings}
    >
      {/* States Grid */}
      <section className="mb-12" aria-label="Indian States">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Browse by State ({indiaStates.length} States &amp; Union Territories)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {indiaStates.map((state) => (
            <Link
              key={state.slug}
              href={`/india/${state.slug}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200"
            >
              <svg className="w-4 h-4 text-violet/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span className="truncate">{state.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Top Cities Grid */}
      <section className="mb-12" aria-label="Top Indian Cities">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Top Cities
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {topCities.map((city) => (
            <Link
              key={city.slug}
              href={`/${city.slug}`}
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
  );
}

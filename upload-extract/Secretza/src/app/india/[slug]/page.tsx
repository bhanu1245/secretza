// ==========================================
// State & City Page: /india/[slug]
// ==========================================
// Server component for state-level and city-level pages under /india/.
// - /india/maharashtra → State page
// - /india/mumbai → City page

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  resolveIndiaSlug,
  getCitiesByState,
  getStateName,
  getNearbyCitiesForCity,
  CATEGORIES,
} from "@/lib/seo-resolver";
import {
  generateStateSEO,
  generateCitySEO,
} from "@/lib/seo-content";
import { getSeoPageData } from "@/lib/seo-helpers";
import { indiaCities } from "@/lib/india-geo-data";
import { db } from "@/lib/db";
import SeoPageLayout from "@/components/seo/SeoPageLayout";
import {
  generateStatePageSchemas,
  generateCityPageSchemas,
} from "@/components/seo/PageStructuredData";

export const dynamic = "force-dynamic";

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
  const { indiaStates } = await import("@/lib/india-geo-data");
  return indiaStates.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = resolveIndiaSlug(slug);

  if (!resolved) return {};

  const canonicalUrl = `https://secretza.com/india/${slug}`;

  if (resolved.type === "state") {
    const state = resolved.data;
    const override = await getSeoPageData("state", state.slug);
    if (override?.noindex) return { robots: { index: false } };

    const seo = generateStateSEO(state.name, state.slug);
    const title = override?.title ?? seo.title;
    const description = override?.metaDescription ?? seo.metaDescription;

    return {
      title,
      description,
      openGraph: { title, description, url: canonicalUrl, siteName: "Secretza" },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: canonicalUrl },
    };
  }

  if (resolved.type === "city") {
    const city = resolved.data;
    const stateName = getStateName(city.stateSlug);
    const override = await getSeoPageData("city", city.slug);
    if (override?.noindex) return { robots: { index: false } };

    const seo = generateCitySEO(city.name, city.slug, stateName);
    const title = override?.title ?? seo.title;
    const description = override?.metaDescription ?? seo.metaDescription;

    return {
      title,
      description,
      openGraph: { title, description, url: canonicalUrl, siteName: "Secretza" },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: canonicalUrl },
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

export default async function IndiaSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = resolveIndiaSlug(slug);
  if (!resolved) notFound();

  if (resolved.type === "state") {
    return <StatePageContent state={resolved.data} />;
  }

  if (resolved.type === "city") {
    return <CityPageContent city={resolved.data} />;
  }

  notFound();
}

// ------------------------------------------
// State Page Content
// ------------------------------------------

async function StatePageContent({
  state,
}: {
  state: { name: string; slug: string };
}) {
  const canonicalUrl = `https://secretza.com/india/${state.slug}`;

  // SEO content with override
  const override = await getSeoPageData("state", state.slug);
  const generated = generateStateSEO(state.name, state.slug);
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
    where: { stateSlug: state.slug, status: "approved" },
    take: 20,
    orderBy: { priorityScore: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, price: true,
      citySlug: true, categorySlug: true, images: true, isFeatured: true,
      isBoosted: true, createdAt: true,
    },
  });

  // Cities in this state
  const stateCities = getCitiesByState(state.slug);

  // Total count
  const totalListings = await db.listing.count({
    where: { stateSlug: state.slug, status: "approved" },
  });

  const structuredData = generateStatePageSchemas(seo, state);
  const noindex = override?.noindex ?? false;

  return (
    <SeoPageLayout
      seo={seo}
      listings={formatListings(listings)}
      structuredData={structuredData}
      canonicalUrl={canonicalUrl}
      noindex={noindex}
      totalListings={totalListings}
    >
      {/* Cities in this state */}
      <section className="mb-12" aria-label={`Cities in ${state.name}`}>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Cities in {state.name}
        </h2>
        {stateCities.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {stateCities
              .sort((a, b) => b.population - a.population)
              .map((city) => (
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
        ) : (
          <p className="text-sm text-muted-foreground">
            No cities listed yet for {state.name}.
          </p>
        )}
      </section>

      {/* Categories in this state */}
      <section className="mb-12" aria-label="Categories">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Categories in {state.name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/${cat.slug}`}
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
    </SeoPageLayout>
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
  const canonicalUrl = `https://secretza.com/india/${city.slug}`;
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
  );
}

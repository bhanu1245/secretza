// ==========================================
// Category + City Page: /[slug]/[city]
// ==========================================
// Server component for category+city longtail pages.
// - /escorts/mumbai → Escorts in Mumbai
// - /massage/delhi → Massage in Delhi

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  isCategorySlug,
  getCityBySlug,
  getCategoryBySlug,
  CATEGORIES,
  getNearbyCitiesForCity,
  getStateName,
  getTopCities,
} from "@/lib/seo-resolver";
import { generateCategoryCitySEO, shouldNoindex } from "@/lib/seo-content";
import { getSeoPageData } from "@/lib/seo-helpers";
import { indiaCities } from "@/lib/india-geo-data";
import { db } from "@/lib/db";
import SeoPageLayout from "@/components/seo/SeoPageLayout";
import { generateCategoryCityPageSchemas } from "@/components/seo/PageStructuredData";

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
  const topCities = getTopCities(30);
  const combos: Array<{ slug: string; city: string }> = [];

  for (const cat of CATEGORIES) {
    for (const city of topCities) {
      combos.push({ slug: cat.slug, city: city.slug });
    }
  }

  return combos;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; city: string }>;
}): Promise<Metadata> {
  const { slug, city: citySlug } = await params;

  // Validate
  if (!isCategorySlug(slug) || !getCityBySlug(citySlug)) return {};

  const category = getCategoryBySlug(slug)!;
  const city = getCityBySlug(citySlug)!;
  const stateName = getStateName(city.stateSlug);
  const canonicalUrl = `https://secretza.com/${slug}/${citySlug}`;

  const override = await getSeoPageData("category_city", `${slug}/${citySlug}`);

  const seo = generateCategoryCitySEO(category.name, slug, city.name, citySlug, stateName);
  const title = override?.title ?? seo.title;
  const description = override?.metaDescription ?? seo.metaDescription;

  // Dynamic noindex based on listing count
  const listingCount = await db.listing.count({
    where: { categorySlug: slug, citySlug: citySlug, status: 'approved' },
  });
  const isNoindex = override?.noindex || shouldNoindex('category_city', listingCount, { citySlug });

  return {
    title,
    description,
    openGraph: { title, description, url: canonicalUrl, siteName: "Secretza" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: canonicalUrl },
    ...(isNoindex ? { robots: { index: false } } : {}),
    };
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

export default async function CategoryCityPage({
  params,
}: {
  params: Promise<{ slug: string; city: string }>;
}) {
  const { slug, city: citySlug } = await params;

  // Validate both slug and city
  if (!isCategorySlug(slug)) notFound();

  const category = getCategoryBySlug(slug);
  const city = getCityBySlug(citySlug);

  if (!category || !city) notFound();

  const stateName = getStateName(city.stateSlug);
  const canonicalUrl = `https://secretza.com/${slug}/${citySlug}`;

  // SEO content with override
  const override = await getSeoPageData("category_city", `${slug}/${citySlug}`);
  const generated = generateCategoryCitySEO(category.name, slug, city.name, citySlug, stateName);
  const seo = {
    ...generated,
    title: override?.title ?? generated.title,
    metaDescription: override?.metaDescription ?? generated.metaDescription,
    h1: override?.h1 ?? generated.h1,
    introParagraph: override?.introContent ?? generated.introParagraph,
    faqs: override?.faqs && override.faqs.length > 0 ? override.faqs : generated.faqs,
  };

  // Fetch listings matching category + city
  const listings = await db.listing.findMany({
    where: { categorySlug: slug, citySlug: citySlug, status: "approved" },
    take: 20,
    orderBy: { priorityScore: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, price: true,
      citySlug: true, categorySlug: true, images: true, isFeatured: true,
      isBoosted: true, createdAt: true,
    },
  });

  // Other categories in this city
  const otherCategories = CATEGORIES.filter((c) => c.slug !== slug);

  // This category in nearby cities
  const nearbyCities = getNearbyCitiesForCity(citySlug, 8);

  // Total count
  const totalListings = await db.listing.count({
    where: { categorySlug: slug, citySlug: citySlug, status: "approved" },
  });

  const structuredData = generateCategoryCityPageSchemas(seo, city as any, category, stateName);
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
      {/* Other Categories in this City */}
      <section className="mb-12" aria-label="Other Categories">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          More in {city.name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {otherCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/${cat.slug}/${citySlug}`}
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

      {/* This Category in Nearby Cities */}
      {nearbyCities.length > 0 && (
        <section className="mb-12" aria-label="Nearby Cities">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {category.name} in Nearby Cities
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {nearbyCities.map((nc) => (
              <Link
                key={nc.slug}
                href={`/${slug}/${nc.slug}`}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200"
              >
                <svg className="w-4 h-4 text-violet/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="truncate">{category.name} in {nc.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SeoPageLayout>
  );
}

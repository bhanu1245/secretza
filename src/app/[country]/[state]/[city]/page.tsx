import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCityUrl, truncate } from "@/lib/seo-ssr";
import { resolvePublicSeoMetadata } from "@/lib/seo-helpers";
import { loadCitySeoPageView } from "@/lib/seo-public-page";
import SeoPublicPageView from "@/components/seo/SeoPublicPageView";

interface CityPageProps {
  params: Promise<{ country: string; state: string; city: string }>;
}

export async function generateStaticParams() {
  return [];
}

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
    return { title: "City Not Found | SecretZa" };
  }

  const fullUrl = buildCityUrl(countrySlug, stateSlug, citySlug);
  const total = city._count.listings;
  const title = `Classifieds in ${city.name}, ${city.state.name}, ${city.state.country.name} - ${total} Listings | SecretZa`;
  const description = truncate(
    `Browse ${total} classified ads in ${city.name}, ${city.state.name}, ${city.state.country.name}. Find local listings on SecretZa.`,
  );

  return resolvePublicSeoMetadata("city", citySlug, {
    title,
    metaDescription: description,
    canonicalUrl: fullUrl,
  });
}

export default async function CityPage({ params }: CityPageProps) {
  const { country, state, city } = await params;
  const view = await loadCitySeoPageView(country, state, city);

  if (!view) {
    notFound();
  }

  return <SeoPublicPageView {...view} />;
}

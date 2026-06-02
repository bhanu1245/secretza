import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCountryUrl, truncate } from "@/lib/seo-ssr";
import { resolvePublicSeoMetadata } from "@/lib/seo-helpers";
import { loadCountrySeoPageView } from "@/lib/seo-public-page";
import SeoPublicPageView from "@/components/seo/SeoPublicPageView";

interface CountryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const countries = await db.country.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return countries.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: CountryPageProps): Promise<Metadata> {
  const { slug } = await params;

  const country = await db.country.findUnique({
    where: { slug },
    include: {
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!country) {
    return { title: "Country Not Found | SecretZa" };
  }

  const fullUrl = buildCountryUrl(country.slug);
  const total = country._count.listings;
  const title = `Classifieds in ${country.name} - ${total} Listings | SecretZa`;
  const description = truncate(
    `Browse ${total} classified ads in ${country.name}. Find the best listings across all categories on SecretZa.`,
  );

  return resolvePublicSeoMetadata("country", slug, {
    title,
    metaDescription: description,
    canonicalUrl: fullUrl,
  });
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { slug } = await params;
  const view = await loadCountrySeoPageView(slug);

  if (!view) {
    notFound();
  }

  return <SeoPublicPageView {...view} />;
}

import { db } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildUrl,
  buildStateUrl,
  truncate,
} from "@/lib/seo-ssr";
import { resolvePublicSeoMetadata } from "@/lib/seo-helpers";
import { resolveLongtailCityFallbackMetadata } from "@/lib/seo-fallback-metadata";
import {
  buildTwoSegmentPageSlug,
  findPublishedTwoSegmentSeoPage,
  loadCategoryCityFallbackView,
  loadLongtailCityFallbackView,
  loadStateSeoPageView,
  loadTwoSegmentSeoPageView,
} from "@/lib/seo-public-page";
import SeoPublicPageView from "@/components/seo/SeoPublicPageView";

interface StatePageProps {
  params: Promise<{ country: string; state: string }>;
}

export async function generateStaticParams() {
  const [states, seoPages] = await Promise.all([
    db.state.findMany({
      where: { isActive: true },
      include: { country: { select: { slug: true } } },
    }),
    db.seoPage.findMany({
      where: {
        isPublished: true,
        pageType: { in: ["longtail", "category_city"] },
      },
      select: { pageSlug: true },
    }),
  ]);

  const stateParams = states.map((s) => ({
    country: s.country.slug,
    state: s.slug,
  }));

  const seoParams = seoPages
    .map((page) => {
      const [country, state] = page.pageSlug.split("/");
      if (!country || !state) return null;
      return { country, state };
    })
    .filter(Boolean) as Array<{ country: string; state: string }>;

  const seen = new Set<string>();
  return [...stateParams, ...seoParams].filter((entry) => {
    const key = `${entry.country}/${entry.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateMetadata({
  params,
}: StatePageProps): Promise<Metadata> {
  const { country: countrySlug, state: stateSlug } = await params;

  const state = await db.state.findFirst({
    where: { slug: stateSlug, country: { slug: countrySlug }, isActive: true },
    include: {
      country: true,
      _count: { select: { listings: { where: { status: "approved" } } } },
    },
  });

  if (!state) {
    const pageSlug = buildTwoSegmentPageSlug(countrySlug, stateSlug);
    const publishedSeo = await findPublishedTwoSegmentSeoPage(countrySlug, stateSlug);

    if (publishedSeo) {
      const fullUrl = publishedSeo.canonicalUrl?.startsWith("http")
        ? publishedSeo.canonicalUrl
        : buildUrl(publishedSeo.canonicalUrl || `/${pageSlug}`);
      return resolvePublicSeoMetadata(publishedSeo.pageType, pageSlug, {
        title: publishedSeo.title || "SecretZa",
        metaDescription: publishedSeo.metaDescription || "SecretZa adult classifieds",
        canonicalUrl: fullUrl,
      });
    }

    const [category, city] = await Promise.all([
      db.category.findFirst({
        where: { slug: countrySlug, isActive: true },
      }),
      db.city.findFirst({
        where: { slug: stateSlug, isActive: true },
        include: { state: { include: { country: true } } },
      }),
    ]);

    if (city && category) {
      const total = await db.listing.count({
        where: {
          citySlug: city.slug,
          OR: [{ categorySlug: category.slug }, { subcategorySlug: category.slug }],
          status: "approved",
        },
      });
      const fullUrl = buildUrl(`/${category.slug}/${city.slug}`);
      const title = `${category.name} in ${city.name} - ${total} Listings | SecretZa`;
      const description = truncate(
        `Browse ${total} ${category.name} listings in ${city.name}. Find verified premium classifieds on SecretZa.`,
      );

      return resolvePublicSeoMetadata("category_city", `${category.slug}/${city.slug}`, {
        title,
        metaDescription: description,
        canonicalUrl: fullUrl,
      });
    }

    const longtailMetadata = await resolveLongtailCityFallbackMetadata(
      countrySlug,
      stateSlug,
    );
    if (longtailMetadata) {
      return longtailMetadata;
    }

    return { title: "Page Not Found | SecretZa" };
  }

  const fullUrl = buildStateUrl(countrySlug, stateSlug);
  const total = state._count.listings;
  const title = `Classifieds in ${state.name}, ${state.country.name} - ${total} Listings | SecretZa`;
  const description = truncate(
    `Browse ${total} classified ads in ${state.name}, ${state.country.name}. Find local listings on SecretZa.`,
  );

  return resolvePublicSeoMetadata("state", stateSlug, {
    title,
    metaDescription: description,
    canonicalUrl: fullUrl,
  });
}

export default async function StatePage({ params }: StatePageProps) {
  const { country, state } = await params;

  const geoStateView = await loadStateSeoPageView(country, state);
  if (geoStateView) {
    return <SeoPublicPageView {...geoStateView} />;
  }

  const twoSegmentView = await loadTwoSegmentSeoPageView(country, state);
  if (twoSegmentView) {
    return <SeoPublicPageView {...twoSegmentView} />;
  }

  const categoryCityView = await loadCategoryCityFallbackView(country, state);
  if (categoryCityView) {
    return <SeoPublicPageView {...categoryCityView} />;
  }

  const longtailView = await loadLongtailCityFallbackView(country, state);
  if (longtailView) {
    return <SeoPublicPageView {...longtailView} />;
  }

  notFound();
}

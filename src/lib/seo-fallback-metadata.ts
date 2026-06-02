import type { Metadata } from "next";
import { db } from "@/lib/db";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";
import { buildLongtailCityFallbackFields } from "@/lib/seo-fallback";

/** Metadata for fallback longtail city routes (no published SeoPage required). */
export async function resolveLongtailCityFallbackMetadata(
  keywordSlug: string,
  citySlug: string,
): Promise<Metadata | null> {
  const [realCountry, city, page] = await Promise.all([
    db.country.findFirst({ where: { slug: keywordSlug, isActive: true } }),
    db.city.findFirst({
      where: { slug: citySlug, isActive: true },
      select: { name: true, slug: true },
    }),
    db.seoPage.findUnique({
      where: {
        pageType_pageSlug: { pageType: "longtail", pageSlug: `${keywordSlug}/${citySlug}` },
      },
    }),
  ]);

  if (!city || realCountry) return null;

  const fields = buildLongtailCityFallbackFields(keywordSlug, city.name, city.slug);

  return buildSeoPageMetadata(
    {
      title: page?.title || fields.title,
      metaDescription: page?.metaDescription || fields.metaDescription,
      canonicalUrl: page?.canonicalUrl || fields.canonicalUrl,
      featuredImage: page?.featuredImage,
      imageAlt: page?.imageAlt || fields.title,
      noindex: page?.noindex,
    },
    process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com",
  );
}

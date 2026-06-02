import { truncate } from "@/lib/seo-ssr";

export function titleCaseFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type LongtailCityFallbackFields = {
  pageSlug: string;
  keywordLabel: string;
  cityName: string;
  h1: string;
  title: string;
  metaDescription: string;
  canonicalPath: string;
  canonicalUrl: string;
};

/** Shared copy for longtail /{keyword}/{city} pages without a SeoPage record. */
export function buildLongtailCityFallbackFields(
  keywordSlug: string,
  cityName: string,
  citySlug: string,
  siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com",
): LongtailCityFallbackFields {
  const keywordLabel = titleCaseFromSlug(keywordSlug);
  const pageSlug = `${keywordSlug}/${citySlug}`;
  const h1 = `${keywordLabel} in ${cityName}`;
  const title = `${h1} | SecretZa`;
  const metaDescription = truncate(
    `Discover ${keywordLabel.toLowerCase()} in ${cityName}. Browse verified listings, photos, and reviews on SecretZa. Updated daily.`,
  );
  const canonicalPath = `/${pageSlug}`;
  const canonicalUrl = `${siteOrigin.replace(/\/+$/, "")}${canonicalPath}`;

  return {
    pageSlug,
    keywordLabel,
    cityName,
    h1,
    title,
    metaDescription,
    canonicalPath,
    canonicalUrl,
  };
}

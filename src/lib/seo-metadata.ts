import type { Metadata } from "next";
import { resolveSeoImageUrl, SEO_IMAGE_WIDTH, SEO_IMAGE_HEIGHT } from "@/lib/seo-images";

const SITE_NAME = "SecretZa";

export type SeoMetadataInput = {
  title?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  featuredImage?: string | null;
  imageAlt?: string | null;
  noindex?: boolean;
};

export function buildSeoPageMetadata(
  input: SeoMetadataInput,
  siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com",
): Metadata {
  const title = input.title || SITE_NAME;
  const description = input.metaDescription || `${SITE_NAME} adult classifieds`;
  const canonicalPath = input.canonicalUrl?.startsWith("http")
    ? input.canonicalUrl
    : `${siteOrigin.replace(/\/+$/, "")}${input.canonicalUrl || ""}`;
  const ogImage = resolveSeoImageUrl(input.featuredImage, siteOrigin);
  const absoluteOgImage =
    ogImage.startsWith("http") ? ogImage : `${siteOrigin.replace(/\/+$/, "")}${ogImage}`;

  return {
    title,
    description,
    alternates: input.canonicalUrl ? { canonical: canonicalPath } : undefined,
    robots: input.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: absoluteOgImage,
          width: SEO_IMAGE_WIDTH,
          height: SEO_IMAGE_HEIGHT,
          alt: input.imageAlt || title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteOgImage],
    },
  };
}

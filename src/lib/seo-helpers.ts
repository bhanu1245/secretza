import type { Metadata } from "next";
import { db } from "@/lib/db";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";
import {
  resolveSeoImageUrl,
  serializeSeoPageImages,
  type SeoImageFields,
} from "@/lib/seo-images";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";

export interface SeoPageData extends SeoImageFields {
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introContent?: string | null;
  canonicalUrl?: string | null;
  customData?: string | null;
  noindex?: boolean;
  isPublished?: boolean;
  faqs?: Array<{ question: string; answer: string }>;
}

export type SeoPageRecord = {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  introContent: string | null;
  canonicalUrl: string | null;
  featuredImage: string | null;
  imageAlt: string | null;
  imageTitle: string | null;
  imageCaption: string | null;
  noindex: boolean;
  isPublished: boolean;
  customData: string | null;
  wordCount?: number | null;
  faqCount?: number | null;
  internalLinksCount?: number | null;
  uniquenessScore?: number | null;
  duplicateRisk?: string | null;
  seoQualityScore?: number | null;
  contentHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Serialize SEO page for API responses with resolved image URLs. */
export function serializeSeoPageForApi(page: SeoPageRecord) {
  const images = serializeSeoPageImages({
    ...page,
    pageType: page.pageType,
  });

  return {
    id: page.id,
    pageType: page.pageType,
    pageSlug: page.pageSlug,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    introContent: page.introContent,
    canonicalUrl: page.canonicalUrl,
    featuredImage: page.featuredImage,
    featuredImageUrl: images.featuredImage,
    imageAlt: page.imageAlt ?? images.imageAlt,
    imageTitle: page.imageTitle ?? images.imageTitle,
    imageCaption: page.imageCaption ?? images.imageCaption,
    ogImageUrl: resolveSeoImageUrl(page.featuredImage, SITE_ORIGIN),
    noindex: page.noindex,
    isPublished: page.isPublished,
    customData: page.customData,
    faqCount: page.faqCount,
    wordCount: page.wordCount,
    internalLinksCount: page.internalLinksCount,
    uniquenessScore: page.uniquenessScore,
    duplicateRisk: page.duplicateRisk,
    seoQualityScore: page.seoQualityScore,
    contentHash: page.contentHash,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

/**
 * Get SEO overrides for a page (falls back to generated content if no custom data)
 */
export async function getSeoPageData(
  pageType: string,
  pageSlug: string,
): Promise<SeoPageData | null> {
  const page = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    include: {
      faqs: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { question: true, answer: true },
      },
    },
  });

  if (!page) return null;

  return {
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    introContent: page.introContent,
    canonicalUrl: page.canonicalUrl,
    featuredImage: page.featuredImage,
    imageAlt: page.imageAlt,
    imageTitle: page.imageTitle,
    imageCaption: page.imageCaption,
    customData: page.customData,
    noindex: page.noindex,
    isPublished: page.isPublished,
    faqs: page.faqs,
  };
}

/** Resolved featured image for public page rendering. */
export async function getSeoFeaturedImageDisplay(
  pageType: string,
  pageSlug: string,
) {
  const page = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    select: {
      featuredImage: true,
      imageAlt: true,
      imageTitle: true,
      imageCaption: true,
      title: true,
      h1: true,
      pageType: true,
      isPublished: true,
    },
  });

  if (!page?.isPublished) return null;

  return serializeSeoPageImages({
    ...page,
    pageType: page.pageType,
  });
}

/** Build Next.js metadata from SeoPage record with sensible fallbacks. */
export async function resolvePublicSeoMetadata(
  pageType: string,
  pageSlug: string,
  fallback: {
    title: string;
    metaDescription: string;
    canonicalUrl: string;
  },
): Promise<Metadata> {
  const page = await db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
  });

  return buildSeoPageMetadata(
    {
      title: page?.title || fallback.title,
      metaDescription: page?.metaDescription || fallback.metaDescription,
      canonicalUrl: page?.canonicalUrl || fallback.canonicalUrl,
      featuredImage: page?.featuredImage,
      imageAlt: page?.imageAlt || page?.title || fallback.title,
      noindex: page?.noindex,
    },
    SITE_ORIGIN,
  );
}

/**
 * Save/update SEO page data (upsert)
 */
export async function saveSeoPageData(
  pageType: string,
  pageSlug: string,
  data: {
    title?: string;
    metaDescription?: string;
    h1?: string;
    introContent?: string;
    noindex?: boolean;
    canonicalUrl?: string;
    featuredImage?: string | null;
    imageAlt?: string | null;
    imageTitle?: string | null;
    imageCaption?: string | null;
  },
) {
  return db.seoPage.upsert({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    create: {
      pageType,
      pageSlug,
      ...data,
    },
    update: { ...data },
  });
}

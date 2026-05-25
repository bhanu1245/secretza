import { db } from "@/lib/db";

export interface SeoPageData {
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introContent?: string | null;
  noindex?: boolean;
  faqs?: Array<{ question: string; answer: string }>;
}

/**
 * Get SEO overrides for a page (falls back to generated content if no custom data)
 */
export async function getSeoPageData(
  pageType: string,
  pageSlug: string
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
    noindex: page.noindex,
    faqs: page.faqs,
  };
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
  }
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

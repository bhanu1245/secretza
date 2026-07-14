/**
 * Pre-save validation for SEO job item processing.
 */
import { db } from "@/lib/db";
import {
  calculateInternalLinksCount,
  MIN_INTERNAL_LINKS_PER_PAGE,
} from "@/lib/seo-internal-links";
import {
  calculateVisibleWordCount,
  computeContentHash,
  SEO_MIN_WORD_COUNT,
} from "@/lib/seo-quality";
import { isSeoPageRoutable } from "@/lib/seo-route-validation";

export type PageValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function validateSeoPageRecord(page: {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  introContent: string | null;
  customData: string | null;
  contentHash: string | null;
  wordCount: number | null;
  internalLinksCount: number | null;
}): Promise<PageValidationResult> {
  const routeCheck = await isSeoPageRoutable({
    pageType: page.pageType,
    pageSlug: page.pageSlug,
    canonicalUrl: page.canonicalUrl,
  });
  if (!routeCheck.routable) {
    return { ok: false, reason: routeCheck.reason ?? "Page has no valid route" };
  }

  if (!page.canonicalUrl?.trim()) {
    return { ok: false, reason: "Missing canonical URL" };
  }

  const intro = page.introContent ?? "";
  const words = calculateVisibleWordCount(intro);
  if (words < SEO_MIN_WORD_COUNT) {
    return { ok: false, reason: `Word count ${words} below minimum ${SEO_MIN_WORD_COUNT}` };
  }

  const links = calculateInternalLinksCount(intro);
  if (links < MIN_INTERNAL_LINKS_PER_PAGE) {
    return {
      ok: false,
      reason: `Internal link count ${links} below minimum ${MIN_INTERNAL_LINKS_PER_PAGE}`,
    };
  }

  const hash = computeContentHash(intro);
  if (page.contentHash !== hash) {
    return { ok: false, reason: "contentHash not synced to introContent" };
  }

  if (!page.title?.trim()) return { ok: false, reason: "Missing title" };
  if (!page.metaDescription?.trim()) return { ok: false, reason: "Missing meta description" };
  if (!page.h1?.trim()) return { ok: false, reason: "Missing H1" };

  if (!page.customData?.includes('"@type"')) {
    return { ok: false, reason: "Missing structured data schema" };
  }

  return { ok: true };
}

export async function loadPageForValidation(pageId: string) {
  return db.seoPage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      title: true,
      metaDescription: true,
      h1: true,
      canonicalUrl: true,
      introContent: true,
      customData: true,
      contentHash: true,
      wordCount: true,
      internalLinksCount: true,
    },
  });
}

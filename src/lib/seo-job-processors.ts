/**
 * Per-page processors for SEO background jobs — wraps existing services.
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
import { calculateReadabilityScore } from "@/lib/readability";
import { regenerateSeoPageById } from "@/lib/seo-regeneration-service";
import {
  resolveAutoFixStrategy,
  runUniversalAutoFix,
  type AutoFixIssueType,
} from "@/lib/seo-autofix";
import { isSeoPageRoutable } from "@/lib/seo-route-validation";
import { loadPageForValidation, validateSeoPageRecord } from "@/lib/seo-job-validation";
import type { SeoJobPayload, SeoJobType } from "@/lib/seo-job-types";

export type ItemProcessResult =
  | { status: "completed" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

type JobContext = {
  jobType: SeoJobType;
  payload: SeoJobPayload;
  createdBy?: { id: string; email: string };
};

export async function processSeoJobItem(
  item: {
    id: string;
    seoPageId: string | null;
    pageType: string;
    pageSlug: string;
  },
  ctx: JobContext,
): Promise<ItemProcessResult> {
  if (!item.seoPageId) {
    return { status: "failed", error: "Missing seoPageId" };
  }

  try {
    switch (ctx.jobType) {
      case "regenerate":
        return await processRegenerate(item.seoPageId, ctx.createdBy);

      case "autofix":
      case "bulk_autofix":
      case "generate_missing_meta":
      case "generate_missing_schema":
      case "generate_missing_images":
      case "repair_canonicals":
      case "repair_urls":
        return await processAutofixItem(item.seoPageId, ctx);

      case "recalculate_word_count":
        return await processRecalculateWordCount(item.seoPageId);

      case "recalculate_internal_links":
        return await processRecalculateInternalLinks(item.seoPageId);

      case "recalculate_content_hash":
        return await processRecalculateContentHash(item.seoPageId);

      case "recalculate_seo_score":
        return await processRecalculateSeoScore(item.seoPageId);

      case "recalculate_readability":
        return await processRecalculateReadability(item.seoPageId);

      case "archive_pages":
        return await processArchivePage(item.seoPageId);

      case "unarchive_pages":
        return await processUnarchivePage(item.seoPageId);

      case "delete_pages":
        return await processDeletePage(item.seoPageId, ctx.payload.confirmDestructive);

      case "generate_ai_improvements":
        return await processRegenerate(item.seoPageId, ctx.createdBy);

      default:
        return { status: "failed", error: `Unsupported job type: ${ctx.jobType}` };
    }
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown processing error",
    };
  }
}

async function processRegenerate(
  pageId: string,
  createdBy?: { id: string; email: string },
): Promise<ItemProcessResult> {
  const existing = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { pageType: true, pageSlug: true, canonicalUrl: true },
  });
  if (!existing) return { status: "failed", error: "Page not found" };

  const routeCheck = await isSeoPageRoutable(existing);
  if (!routeCheck.routable) {
    return { status: "skipped", reason: routeCheck.reason ?? "Unroutable page" };
  }

  const result = await regenerateSeoPageById(pageId, createdBy);
  if (!result.ok) {
    return { status: "failed", error: result.error ?? "Regeneration failed" };
  }
  if (result.skipped) {
    return { status: "skipped", reason: result.error ?? "Regeneration skipped" };
  }

  const page = await loadPageForValidation(pageId);
  if (!page) return { status: "failed", error: "Page missing after regeneration" };
  const validation = await validateSeoPageRecord(page);
  if (!validation.ok) {
    return { status: "failed", error: validation.reason };
  }
  return { status: "completed" };
}

function resolveIssueType(jobType: SeoJobType, payload: SeoJobPayload): string | null {
  if (payload.issueType) return payload.issueType;
  const map: Partial<Record<SeoJobType, AutoFixIssueType>> = {
    generate_missing_meta: "missing_meta",
    generate_missing_schema: "missing_schema",
    generate_missing_images: "missing_image",
    repair_canonicals: "missing_canonical",
    repair_urls: "broken_internal_links",
  };
  return map[jobType] ?? null;
}

async function processAutofixItem(
  pageId: string,
  ctx: JobContext,
): Promise<ItemProcessResult> {
  const issueType = resolveIssueType(ctx.jobType, ctx.payload);
  if (!issueType || !resolveAutoFixStrategy(issueType)) {
    return { status: "failed", error: `No autofix strategy for ${ctx.jobType}` };
  }

  const result = await runUniversalAutoFix({
    pageIds: [pageId],
    issueType,
    createdBy: ctx.createdBy,
  });

  const detail = result.details.find((d) => d.pageId === pageId);
  if (!detail) {
    return { status: "failed", error: "No result for page" };
  }
  if (detail.status === "failed") {
    return { status: "failed", error: detail.reason ?? "Auto fix failed" };
  }
  if (detail.status === "skipped") {
    return { status: "skipped", reason: detail.reason ?? "Skipped" };
  }

  const page = await loadPageForValidation(pageId);
  if (!page) return { status: "failed", error: "Page missing after autofix" };
  const validation = await validateSeoPageRecord(page);
  if (!validation.ok) {
    return { status: "failed", error: validation.reason };
  }
  return { status: "completed" };
}

async function processRecalculateWordCount(pageId: string): Promise<ItemProcessResult> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { introContent: true, wordCount: true },
  });
  if (!page) return { status: "failed", error: "Page not found" };
  const actual = calculateVisibleWordCount(page.introContent);
  if (actual < SEO_MIN_WORD_COUNT) {
    return { status: "skipped", reason: `Below word threshold (${actual})` };
  }
  if (page.wordCount === actual) {
    return { status: "skipped", reason: "Already synced" };
  }
  await db.seoPage.update({ where: { id: pageId }, data: { wordCount: actual } });
  return { status: "completed" };
}

async function processRecalculateInternalLinks(pageId: string): Promise<ItemProcessResult> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { introContent: true, internalLinksCount: true },
  });
  if (!page) return { status: "failed", error: "Page not found" };
  const actual = calculateInternalLinksCount(page.introContent);
  if (actual < MIN_INTERNAL_LINKS_PER_PAGE) {
    return { status: "skipped", reason: `Below link threshold (${actual})` };
  }
  if (page.internalLinksCount === actual) {
    return { status: "skipped", reason: "Already synced" };
  }
  await db.seoPage.update({
    where: { id: pageId },
    data: { internalLinksCount: actual },
  });
  return { status: "completed" };
}

async function processRecalculateContentHash(pageId: string): Promise<ItemProcessResult> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { introContent: true, contentHash: true },
  });
  if (!page) return { status: "failed", error: "Page not found" };
  const actual = computeContentHash(page.introContent);
  if (page.contentHash === actual) {
    return { status: "skipped", reason: "Already synced" };
  }
  await db.seoPage.update({ where: { id: pageId }, data: { contentHash: actual } });
  return { status: "completed" };
}

async function processRecalculateSeoScore(pageId: string): Promise<ItemProcessResult> {
  const result = await regenerateSeoPageById(pageId);
  if (!result.ok && !result.skipped) {
    return { status: "failed", error: result.error ?? "Score recalculation failed" };
  }
  return result.skipped
    ? { status: "skipped", reason: result.error ?? "Skipped" }
    : { status: "completed" };
}

async function processRecalculateReadability(pageId: string): Promise<ItemProcessResult> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { introContent: true },
  });
  if (!page?.introContent?.trim()) {
    return { status: "skipped", reason: "No intro content" };
  }
  const score = calculateReadabilityScore(page.introContent);
  if (score <= 0) {
    return { status: "skipped", reason: "Readability not computable" };
  }
  return { status: "completed" };
}

async function processArchivePage(pageId: string): Promise<ItemProcessResult> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { isPublished: true, pageType: true, pageSlug: true, canonicalUrl: true },
  });
  if (!page) return { status: "failed", error: "Page not found" };
  const route = await isSeoPageRoutable({
    pageType: page.pageType,
    pageSlug: page.pageSlug,
    canonicalUrl: page.canonicalUrl,
  });
  if (route.routable) {
    return { status: "skipped", reason: "Page is routable — not archived" };
  }
  if (!page.isPublished) {
    return { status: "skipped", reason: "Already unpublished" };
  }
  await db.seoPage.update({
    where: { id: pageId },
    data: { isPublished: false, noindex: true },
  });
  return { status: "completed" };
}

async function processUnarchivePage(pageId: string): Promise<ItemProcessResult> {
  const page = await db.seoPage.findUnique({
    where: { id: pageId },
    select: { isPublished: true },
  });
  if (!page) return { status: "failed", error: "Page not found" };
  if (page.isPublished) {
    return { status: "skipped", reason: "Already published" };
  }
  await db.seoPage.update({
    where: { id: pageId },
    data: { isPublished: true },
  });
  return { status: "completed" };
}

async function processDeletePage(
  pageId: string,
  confirmed?: boolean,
): Promise<ItemProcessResult> {
  if (!confirmed) {
    return { status: "failed", error: "Destructive delete requires confirmation" };
  }
  await db.seoPage.delete({ where: { id: pageId } });
  return { status: "completed" };
}

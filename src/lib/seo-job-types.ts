/** SEO Dashboard V2 Phase 4 — background job types. */

export const SEO_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type SeoJobStatus = (typeof SEO_JOB_STATUSES)[number];

export const SEO_JOB_ITEM_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "skipped",
] as const;

export type SeoJobItemStatus = (typeof SEO_JOB_ITEM_STATUSES)[number];

export const SEO_JOB_TYPES = [
  "autofix",
  "bulk_autofix",
  "regenerate",
  "generate_missing_meta",
  "generate_missing_schema",
  "generate_missing_images",
  "repair_canonicals",
  "repair_urls",
  "recalculate_word_count",
  "recalculate_internal_links",
  "recalculate_content_hash",
  "recalculate_seo_score",
  "recalculate_readability",
  "generate_ai_improvements",
  "archive_pages",
  "unarchive_pages",
  "delete_pages",
] as const;

export type SeoJobType = (typeof SEO_JOB_TYPES)[number];

/** Job types that block concurrent runs of the same type. */
export const CONCURRENT_JOB_TYPES = new Set<SeoJobType>([
  "autofix",
  "bulk_autofix",
  "regenerate",
  "generate_missing_meta",
  "generate_missing_schema",
  "generate_missing_images",
  "repair_canonicals",
  "repair_urls",
  "recalculate_word_count",
  "recalculate_internal_links",
  "recalculate_content_hash",
  "recalculate_seo_score",
  "recalculate_readability",
  "generate_ai_improvements",
  "archive_pages",
  "unarchive_pages",
  "delete_pages",
]);

export const DEFAULT_JOB_BATCH_SIZE = 100;
export const ALLOWED_BATCH_SIZES = [25, 50, 100, 200] as const;

export type SeoJobPayload = {
  pageIds?: string[];
  issueType?: string;
  issueTypes?: string[];
  pageTypeFilter?: string;
  confirmDestructive?: boolean;
  retryFailedOnly?: boolean;
};

export const JOB_TYPE_LABELS: Record<SeoJobType, string> = {
  autofix: "Auto Fix",
  bulk_autofix: "Bulk Auto Fix",
  regenerate: "Regenerate SEO",
  generate_missing_meta: "Generate Missing Meta",
  generate_missing_schema: "Generate Missing Schema",
  generate_missing_images: "Generate Missing Images",
  repair_canonicals: "Repair Canonicals",
  repair_urls: "Repair URLs",
  recalculate_word_count: "Recalculate Word Count",
  recalculate_internal_links: "Recalculate Internal Links",
  recalculate_content_hash: "Recalculate Content Hash",
  recalculate_seo_score: "Recalculate SEO Score",
  recalculate_readability: "Recalculate Readability",
  generate_ai_improvements: "Generate AI Improvements",
  archive_pages: "Archive Invalid Pages",
  unarchive_pages: "Unarchive Pages",
  delete_pages: "Delete Pages",
};

/** Map bulk UI actions to job types. */
export const BULK_ACTION_TO_JOB_TYPE: Record<string, SeoJobType> = {
  auto_fix: "bulk_autofix",
  regenerate: "regenerate",
  generate_missing: "generate_missing_meta",
  repair_canonical: "repair_canonicals",
  generate_missing_schema: "generate_missing_schema",
  generate_missing_images: "generate_missing_images",
  repair_urls: "repair_urls",
  recalculate_word_count: "recalculate_word_count",
  recalculate_internal_links: "recalculate_internal_links",
  recalculate_content_hash: "recalculate_content_hash",
  recalculate_seo_score: "recalculate_seo_score",
  recalculate_readability: "recalculate_readability",
  archive_pages: "archive_pages",
  unarchive_pages: "unarchive_pages",
  delete_pages: "delete_pages",
};

export function isSeoJobType(value: string): value is SeoJobType {
  return (SEO_JOB_TYPES as readonly string[]).includes(value);
}

export function estimateJobDurationMinutes(pageCount: number, jobType: SeoJobType): number {
  const perPageMs: Record<string, number> = {
    regenerate: 4000,
    bulk_autofix: 3500,
    autofix: 3500,
    recalculate_word_count: 50,
    recalculate_internal_links: 80,
    recalculate_content_hash: 80,
    recalculate_seo_score: 2000,
    recalculate_readability: 100,
    delete_pages: 200,
    archive_pages: 200,
    unarchive_pages: 200,
  };
  const ms = (perPageMs[jobType] ?? 3000) * pageCount;
  return Math.max(1, Math.ceil(ms / 60000));
}

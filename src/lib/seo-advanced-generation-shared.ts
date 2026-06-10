/**
 * Browser-safe constants and types for advanced SEO generation.
 * Client components must import from this module only — never from seo-advanced-generation.ts.
 */

export const BULK_WARNING_THRESHOLD = 500;
export const BULK_STRICT_THRESHOLD = 2000;
export const PREVIEW_EXAMPLE_LIMIT = 25;

export type AdvancedSeoGeneratorMode =
  | "keyword_multi_city"
  | "city_category_longtail"
  | "city_category_keywords";

export interface AdvancedSeoEntry {
  keyword: string;
  title: string;
  slug: string;
  pageType: "longtail";
  canonicalUrl: string;
  exists: boolean;
  willGenerate: boolean;
  cityId?: string;
  cityName?: string;
}

export interface AdvancedSeoPreview {
  mode: AdvancedSeoGeneratorMode;
  keywordCount: number;
  cityCount: number;
  cityIds: string[];
  cityNames: string[];
  categoryId?: string;
  categoryName?: string;
  templateCount?: number;
  toGenerate: number;
  toSkip: number;
  total: number;
  estimatedTotal: number;
  examples: AdvancedSeoEntry[];
  entries: AdvancedSeoEntry[];
  requiresBulkWarning: boolean;
  requiresStrictConfirmation: boolean;
}

export interface AdvancedSeoGenerateResult {
  generated: number;
  skipped: number;
  failed: number;
  total: number;
  cityIds: string[];
  cityNames: string[];
  categoryId?: string;
  categoryName?: string;
  keywords: string[];
}

/** Pure helper safe for client preview UI. */
export function applyBulkSafetyFlags(total: number): {
  requiresBulkWarning: boolean;
  requiresStrictConfirmation: boolean;
} {
  return {
    requiresBulkWarning: total >= BULK_WARNING_THRESHOLD,
    requiresStrictConfirmation: total >= BULK_STRICT_THRESHOLD,
  };
}

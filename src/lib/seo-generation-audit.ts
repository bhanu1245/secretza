import { db } from "@/lib/db";

export type SeoGenerationAuditAction =
  | "seo_generate_city"
  | "seo_generate_city_pack"
  | "seo_generate_category_city"
  | "seo_generate_keywords"
  | "seo_generate_keyword_city"
  | "seo_generate_keyword_multi_city"
  | "seo_generate_city_category_longtail"
  | "seo_generate_city_category_keywords"
  | "seo_repair_url_structure"
  | "sitemap_validate"
  | "sitemap_submit"
  | "sitemap_regenerate";

export async function logSeoGenerationAction(params: {
  adminUserId: string;
  action: SeoGenerationAuditAction;
  processed?: number;
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  generated: number;
  skipped: number;
  failed?: number;
  keywords?: string[];
  cityId?: string;
  cityIds?: string[];
  cityNames?: string[];
  categoryId?: string;
  categoryName?: string;
}) {
  await db.auditLog.create({
    data: {
      userId: params.adminUserId,
      action: params.action,
      entityType: "SeoPage",
      entityId: null,
      details: JSON.stringify({
        adminId: params.adminUserId,
        country: params.country ?? null,
        state: params.state ?? null,
        city: params.city ?? null,
        category: params.category ?? null,
        categoryId: params.categoryId ?? null,
        categoryName: params.categoryName ?? null,
        processed: params.processed ?? null,
        processedCount: params.processed ?? null,
        generated: params.generated,
        generatedCount: params.generated,
        repaired: params.action === "seo_repair_url_structure" ? params.generated : null,
        repairedCount: params.action === "seo_repair_url_structure" ? params.generated : null,
        skipped: params.skipped,
        skippedCount: params.skipped,
        failed: params.failed ?? 0,
        failedCount: params.failed ?? 0,
        keywords: params.keywords ?? null,
        cityId: params.cityId ?? null,
        cityIds: params.cityIds ?? null,
        cityNames: params.cityNames ?? null,
        timestamp: new Date().toISOString(),
      }),
    },
  });
}

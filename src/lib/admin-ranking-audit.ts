import { db } from "@/lib/db";

type RankingAuditAction =
  | "ranking_recalculate_all"
  | "ranking_refresh_premium"
  | "ranking_refresh_city";

export async function logRankingMaintenanceAction(params: {
  adminUserId: string;
  action: RankingAuditAction;
  processed: number;
  cityId?: string;
  cityName?: string;
}) {
  const details: Record<string, unknown> = {
    processed: params.processed,
    timestamp: new Date().toISOString(),
  };
  if (params.cityId) details.cityId = params.cityId;
  if (params.cityName) details.cityName = params.cityName;

  await db.auditLog.create({
    data: {
      userId: params.adminUserId,
      action: params.action,
      entityType: "Listing",
      entityId: params.cityId ?? null,
      details: JSON.stringify(details),
    },
  });
}

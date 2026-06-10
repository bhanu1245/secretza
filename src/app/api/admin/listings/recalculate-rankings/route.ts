import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  recalculateAllListingRankings,
  resolveAdminRankingAccess,
} from "@/lib/admin-ranking-tools";
import { logRankingMaintenanceAction } from "@/lib/admin-ranking-audit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    const denied = resolveAdminRankingAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const processed = await recalculateAllListingRankings();

    await logRankingMaintenanceAction({
      adminUserId: user!.id,
      action: "ranking_recalculate_all",
      processed,
    });

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings/recalculate-rankings" });
    return NextResponse.json({ error: "Failed to recalculate rankings" }, { status: 500 });
  }
}

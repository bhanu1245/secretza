import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import {
  refreshPremiumListingRankings,
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

    const processed = await refreshPremiumListingRankings();

    await logRankingMaintenanceAction({
      adminUserId: user!.id,
      action: "ranking_refresh_premium",
      processed,
    });

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    logError(error, { component: "route:api/admin/listings/refresh-premium-rankings" });
    return NextResponse.json({ error: "Failed to refresh premium rankings" }, { status: 500 });
  }
}

/**
 * listing-count-sync.ts
 *
 * Keeps City.listingCount equal to:
 *   COUNT(Listing WHERE cityId = City.id AND status = 'approved')
 *
 * Two entry points:
 *   syncCityListingCount(cityId)   — recompute a single city (used on approve/reject/delete)
 *   syncAllCityListingCounts()     — full reconciliation across every city (used by cron)
 */

import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";

/**
 * Recompute and persist listingCount for a single city.
 * Uses a COUNT query so it is idempotent and can never drift.
 */
export async function syncCityListingCount(cityId: string): Promise<void> {
  try {
    const count = await db.listing.count({
      where: { cityId, status: "approved" },
    });
    await db.city.update({
      where: { id: cityId },
      data: { listingCount: count },
    });
  } catch (err) {
    logError(err, { component: "listing-count-sync:syncCityListingCount", cityId });
  }
}

/**
 * Recompute and persist listingCount for every city in one batch.
 * Safe to call repeatedly — values are set, not incremented.
 *
 * Returns:
 *   updated   — number of cities whose count changed
 *   unchanged — number of cities already correct
 */
export async function syncAllCityListingCounts(): Promise<{
  updated: number;
  unchanged: number;
}> {
  try {
    // Fetch live approved counts grouped by city
    const liveCounts = await db.listing.groupBy({
      by: ["cityId"],
      where: { status: "approved" },
      _count: { _all: true },
    });

    // Build a map: cityId → approvedCount
    const countMap = new Map<string, number>();
    for (const row of liveCounts) {
      if (row.cityId) countMap.set(row.cityId, row._count._all);
    }

    // Fetch all cities with their current stored count
    const cities = await db.city.findMany({
      select: { id: true, listingCount: true },
    });

    const updates: { id: string; newCount: number }[] = [];
    for (const city of cities) {
      const newCount = countMap.get(city.id) ?? 0;
      if (city.listingCount !== newCount) {
        updates.push({ id: city.id, newCount });
      }
    }

    // Apply changes in a single transaction
    if (updates.length > 0) {
      await db.$transaction(
        updates.map(({ id, newCount }) =>
          db.city.update({
            where: { id },
            data: { listingCount: newCount },
          }),
        ),
      );
    }

    return { updated: updates.length, unchanged: cities.length - updates.length };
  } catch (err) {
    logError(err, { component: "listing-count-sync:syncAllCityListingCounts" });
    return { updated: 0, unchanged: 0 };
  }
}

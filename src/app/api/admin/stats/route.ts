import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { getAdminRevenueCurrency } from "@/lib/payment-settings";

export async function GET() {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      totalUsers,
      totalListings,
      activeListings,
      pendingReview,
      pendingPayments,
      revenueResult,
      featuredListings,
      premiumUsers,
      recentPayments,
      revenueCurrency,
    ] = await Promise.all([
      db.user.count(),
      db.listing.count(),
      db.listing.count({ where: { status: "approved" } }),
      db.listing.count({ where: { status: "pending" } }),
      db.manualPaymentSubmission.count({ where: { status: "pending" } }),
      db.payment.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
      }),
      db.listing.count({ where: { isFeatured: true } }),
      // Count only genuinely active premium users: isPremium=true with no expiry
      // set (admin-granted, no expiry) OR with an expiry that has not yet passed.
      db.user.count({
        where: {
          isPremium: true,
          OR: [
            { premiumExpiry: null },
            { premiumExpiry: { gt: new Date() } },
          ],
        },
      }),
      // Monthly revenue: fetch completed payments from the last 8 months
      (() => {
        const eightMonthsAgo = new Date();
        eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
        eightMonthsAgo.setHours(0, 0, 0, 0);
        return db.payment.findMany({
          where: {
            status: "completed",
            createdAt: { gte: eightMonthsAgo },
          },
          select: { amount: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
      })(),
      getAdminRevenueCurrency(),
    ]);

    // Group payments by month for the revenue chart
    const monthlyRevenue: Array<{ month: string; revenue: number; listings: number }> = [];
    const monthMap = new Map<string, { revenue: number; listings: number }>();

    for (const p of recentPayments) {
      const month = new Date(p.createdAt).toLocaleString("default", { month: "short" });
      const year = new Date(p.createdAt).getFullYear();
      const key = `${month} ${year}`;
      const existing = monthMap.get(key);
      if (existing) {
        existing.revenue += p.amount;
        existing.listings += 1;
      } else {
        monthMap.set(key, { revenue: p.amount, listings: 1 });
      }
    }

    // Convert to array, sort by date, and take last 8 months
    const monthEntries = Array.from(monthMap.entries());
    for (const [key, val] of monthEntries) {
      monthlyRevenue.push({ month: key.split(" ")[0], revenue: Math.round(val.revenue), listings: val.listings });
    }

    return NextResponse.json({
      totalUsers,
      totalListings,
      activeListings,
      pendingReview,
      pendingPayments,
      totalRevenue: revenueResult._sum.amount ?? 0,
      revenueCurrency,
      featuredListings,
      premiumUsers,
      monthlyRevenue,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/stats" });
    return NextResponse.json(
      { error: "Failed to fetch admin statistics" },
      { status: 500 }
    );
  }
}

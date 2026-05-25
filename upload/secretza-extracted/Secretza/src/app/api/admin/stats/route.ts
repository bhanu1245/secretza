import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";

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
      revenueResult,
      featuredListings,
      premiumUsers,
    ] = await Promise.all([
      db.user.count(),
      db.listing.count(),
      db.listing.count({ where: { status: "approved" } }),
      db.listing.count({ where: { status: "pending" } }),
      db.payment.aggregate({
        where: { status: "completed" },
        _sum: { amount: true },
      }),
      db.listing.count({ where: { isFeatured: true } }),
      db.user.count({ where: { isPremium: true } }),
    ]);

    return NextResponse.json({
      totalUsers,
      totalListings,
      activeListings,
      pendingReview,
      totalRevenue: revenueResult._sum.amount ?? 0,
      featuredListings,
      premiumUsers,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin statistics" },
      { status: 500 }
    );
  }
}

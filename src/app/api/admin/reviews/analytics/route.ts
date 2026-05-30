import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";
import { getReviewAnalytics } from "@/lib/review-analytics";

// GET /api/admin/reviews/analytics?days=30
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "moderator") {
      return NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));

    const data = await getReviewAnalytics(days);
    return NextResponse.json(data);
  } catch (error) {
    logError(error, { component: "route:api/admin/reviews/analytics" });
    return NextResponse.json(
      { error: "Failed to fetch review analytics" },
      { status: 500 }
    );
  }
}

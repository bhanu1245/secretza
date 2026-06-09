import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";

/** GET /api/reviews/mine — authenticated user's reviews (optional listingId filter) */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId") || undefined;

    const where = {
      userId: session.user.id,
      ...(listingId ? { listingId } : {}),
    };

    const reviews = await db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        listingId: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        adminNote: true,
        flaggedReason: true,
        createdAt: true,
        updatedAt: true,
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      reviews: reviews.map((review) => ({
        ...review,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logError(error, { component: "route:api/reviews/mine" });
    return NextResponse.json({ error: "Failed to fetch your reviews" }, { status: 500 });
  }
}

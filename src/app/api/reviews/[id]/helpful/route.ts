import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

// POST /api/reviews/[id]/helpful — toggle helpful (once per user)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting per user for helpful votes
    const rl = await rateLimit(`review-helpful:${session.user.id}`, RATE_LIMITS.api);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { id } = await params;
    const userId = session.user.id;

    const review = await db.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.status !== "approved") {
      return NextResponse.json(
        { error: "Can only mark approved reviews as helpful" },
        { status: 400 }
      );
    }

    // Prevent self-voting
    if (review.userId === userId) {
      return NextResponse.json(
        { error: "Cannot mark your own review as helpful" },
        { status: 400 }
      );
    }

    // Check if user already voted using dedicated HelpfulVote table
    const existingVote = await db.helpfulVote.findUnique({
      where: {
        reviewId_userId: {
          reviewId: id,
          userId: userId,
        },
      },
    });

    if (existingVote) {
      // Toggle off: remove vote and decrement count
      await db.$transaction([
        db.helpfulVote.delete({ where: { id: existingVote.id } }),
        db.review.update({
          where: { id },
          data: { helpfulCount: { decrement: 1 } },
        }),
      ]);

      return NextResponse.json({
        message: "Removed helpful vote",
        voted: false,
        helpfulCount: Math.max(0, review.helpfulCount - 1),
      });
    }

    // Create a helpful vote record
    await db.$transaction([
      db.helpfulVote.create({
        data: {
          reviewId: id,
          userId: userId,
        },
      }),
      db.review.update({
        where: { id },
        data: {
          helpfulCount: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({
      message: "Marked as helpful",
      voted: true,
      helpfulCount: review.helpfulCount + 1,
    });
  } catch (error: unknown) {
    logError(error, { component: "route:api/reviews/[id]/helpful" });

    // Handle Prisma unique constraint violation (race condition)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You have already marked this review as helpful" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to mark review as helpful" },
      { status: 500 }
    );
  }
}

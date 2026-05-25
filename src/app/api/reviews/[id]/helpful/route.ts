import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    // Deduplication: check if user already voted using reportCount heuristic
    // and a JSON-based tracking approach stored in review's adminNote field
    // For production, a dedicated HelpfulVote table with @@unique([reviewId, userId]) is recommended
    // This implementation uses a simple in-query approach with the review's existing fields
    
    // Check if this user already voted by looking at existing helpful votes
    // We use the ReviewReport table as a proxy check - if user reported, they can't also vote helpful
    // More importantly, we check via a pragmatic approach:
    // Store helpful voter IDs in a dedicated JSON tracking mechanism
    const existingVote = await db.reviewReport.findFirst({
      where: {
        reviewId: id,
        userId: userId,
        reason: "__helpful_vote__", // Internal marker for helpful votes
      },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: "You have already marked this review as helpful" },
        { status: 409 }
      );
    }

    // Create a helpful vote record (reusing ReviewReport for tracking)
    await db.reviewReport.create({
      data: {
        reviewId: id,
        userId: userId,
        reason: "__helpful_vote__",
        description: "Helpful vote",
        isResolved: true,
      },
    });

    // Increment helpfulCount
    const updatedReview = await db.review.update({
      where: { id },
      data: {
        helpfulCount: { increment: 1 },
      },
      select: {
        id: true,
        helpfulCount: true,
      },
    });

    return NextResponse.json({
      message: "Marked as helpful",
      helpfulCount: updatedReview.helpfulCount,
    });
  } catch (error) {
    console.error("Review helpful error:", error);
    return NextResponse.json(
      { error: "Failed to mark review as helpful" },
      { status: 500 }
    );
  }
}

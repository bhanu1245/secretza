import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/reviews/[id]/helpful — toggle helpful (increment once)
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

    // Increment helpfulCount (simple approach — just increment, allow once)
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

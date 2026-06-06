import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";
import { validateUserContent } from "@/lib/content-filter";

// GET /api/reviews/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const review = await db.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isVerified: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Only return approved reviews (or any status for the review owner / admins)
    const session = await getServerSession(authOptions);
    const isOwner = session?.user?.id === review.userId;
    const isAdmin = session?.user?.role === "admin" || session?.user?.role === "moderator";

    if (review.status !== "approved" && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({
      review: {
        ...review,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        featuredUntil: review.featuredUntil?.toISOString() ?? null,
        moderatedAt: review.moderatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/reviews/[id]" });
    return NextResponse.json(
      { error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}

// PATCH /api/reviews/[id] — review owner only, only if status is still "pending"
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Email verification required to submit reviews" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { rating, title, body: reviewBody } = body as {
      rating?: number;
      title?: string;
      body?: string;
    };

    const existingReview = await db.review.findUnique({
      where: { id },
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Only the review owner can edit
    if (existingReview.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own reviews" },
        { status: 403 }
      );
    }

    // Only allow editing if status is still "pending"
    if (existingReview.status !== "pending") {
      return NextResponse.json(
        { error: "Can only edit reviews that are still pending" },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Validate body length if provided
    if (reviewBody !== undefined && reviewBody.length > 2000) {
      return NextResponse.json(
        { error: "Review body must be at most 2000 characters" },
        { status: 400 }
      );
    }

    // Validate title length if provided
    if (title !== undefined && title.length > 200) {
      return NextResponse.json(
        { error: "Review title must be at most 200 characters" },
        { status: 400 }
      );
    }

    const contentError = validateUserContent([
      { field: "title", label: "Review title", value: title },
      { field: "body", label: "Review", value: reviewBody },
    ]);
    if (contentError) {
      return NextResponse.json(
        { error: contentError.message, field: contentError.field },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (rating !== undefined) updateData.rating = rating;
    if (title !== undefined) updateData.title = title || null;
    if (reviewBody !== undefined) updateData.body = reviewBody || null;

    const updatedReview = await db.review.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isVerified: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Review updated successfully",
      review: {
        ...updatedReview,
        createdAt: updatedReview.createdAt.toISOString(),
        updatedAt: updatedReview.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/reviews/[id]" });
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}

// DELETE /api/reviews/[id] — review owner or admin/moderator
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Email verification required to submit reviews" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingReview = await db.review.findUnique({
      where: { id },
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const isOwner = existingReview.userId === session.user.id;
    const isAdmin = session.user.role === "admin" || session.user.role === "moderator";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You can only delete your own reviews" },
        { status: 403 }
      );
    }

    await db.review.delete({ where: { id } });

    return NextResponse.json({ message: "Review deleted successfully" });
  } catch (error) {
    logError(error, { component: "route:api/reviews/[id]" });
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    );
  }
}

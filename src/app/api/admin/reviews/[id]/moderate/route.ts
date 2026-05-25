import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/admin/reviews/[id]/moderate
// Body: { action: "approve"|"reject"|"flag"|"feature"|"unfeature", flaggedReason?, adminNote? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "moderator") {
      return NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, flaggedReason, adminNote } = body as {
      action?: string;
      flaggedReason?: string;
      adminNote?: string;
    };

    const validActions = ["approve", "reject", "flag", "feature", "unfeature"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const review = await db.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const moderatorId = session.user.id;
    const now = new Date();
    let updateData: Record<string, unknown> = {};
    let message = "";

    switch (action) {
      case "approve":
        updateData = {
          status: "approved",
          moderatedBy: moderatorId,
          moderatedAt: now,
          ...(adminNote ? { adminNote } : {}),
        };
        message = "Review approved";
        break;

      case "reject":
        updateData = {
          status: "rejected",
          moderatedBy: moderatorId,
          moderatedAt: now,
          ...(adminNote ? { adminNote } : {}),
        };
        message = "Review rejected";
        break;

      case "flag":
        if (!flaggedReason) {
          return NextResponse.json(
            { error: "flaggedReason is required when flagging a review" },
            { status: 400 }
          );
        }
        updateData = {
          status: "flagged",
          flaggedReason,
          moderatedBy: moderatorId,
          moderatedAt: now,
          ...(adminNote ? { adminNote } : {}),
        };
        message = "Review flagged";
        break;

      case "feature":
        const featuredUntil = new Date();
        featuredUntil.setDate(featuredUntil.getDate() + 30);
        updateData = {
          isFeatured: true,
          featuredUntil,
          ...(adminNote ? { adminNote } : {}),
        };
        message = "Review featured for 30 days";
        break;

      case "unfeature":
        updateData = {
          isFeatured: false,
          featuredUntil: null,
          ...(adminNote ? { adminNote } : {}),
        };
        message = "Review unfeatured";
        break;
    }

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
      message,
      review: {
        ...updatedReview,
        createdAt: updatedReview.createdAt.toISOString(),
        updatedAt: updatedReview.updatedAt.toISOString(),
        featuredUntil: updatedReview.featuredUntil?.toISOString() ?? null,
        moderatedAt: updatedReview.moderatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Review moderate error:", error);
    return NextResponse.json(
      { error: "Failed to moderate review" },
      { status: 500 }
    );
  }
}

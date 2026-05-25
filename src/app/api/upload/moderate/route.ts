import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/upload/moderate — list images pending moderation
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "moderator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = {};
    if (status === "pending") {
      where.moderationStatus = "pending";
    } else if (status === "flagged") {
      where.isFlagged = true;
    } else if (status === "rejected") {
      where.moderationStatus = "rejected";
    }

    const images = await db.listingImage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
            userId: true,
          },
        },
      },
    });

    return NextResponse.json({
      images: images.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        mediumUrl: img.mediumUrl,
        width: img.width,
        height: img.height,
        moderationStatus: img.moderationStatus,
        moderationReason: img.moderationReason,
        isFlagged: img.isFlagged,
        createdAt: img.createdAt.toISOString(),
        listing: img.listing
          ? {
              id: img.listing.id,
              title: img.listing.title,
              status: img.listing.status,
              userId: img.listing.userId,
            }
          : undefined,
      })),
    });
  } catch (error) {
    console.error("[GET /api/upload/moderate] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}

// POST /api/upload/moderate — approve, reject, or flag an image
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "moderator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { imageId, action } = body as {
      imageId?: string;
      action?: "approve" | "reject" | "flag";
    };

    if (!imageId || !action) {
      return NextResponse.json(
        { error: "imageId and action are required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    };

    if (action === "approve") {
      updateData.moderationStatus = "approved";
      updateData.isFlagged = false;
      updateData.moderationReason = null;
    } else if (action === "reject") {
      updateData.moderationStatus = "rejected";
      updateData.moderationReason = "Rejected by moderator";
    } else if (action === "flag") {
      updateData.isFlagged = true;
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be approve, reject, or flag." },
        { status: 400 }
      );
    }

    await db.listingImage.update({
      where: { id: imageId },
      data: updateData,
    });

    return NextResponse.json({ success: true, imageId, action });
  } catch (error) {
    console.error("[POST /api/upload/moderate] Failed:", error);
    return NextResponse.json(
      { error: "Failed to moderate image" },
      { status: 500 }
    );
  }
}

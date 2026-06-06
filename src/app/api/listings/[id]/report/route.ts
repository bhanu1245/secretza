import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { logError } from "@/lib/monitoring";
import { notifyAdminsOfNewReport } from "@/lib/admin-notifications";

// POST /api/listings/[id]/report — report a listing
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason, description } = body as {
      reason?: string;
      description?: string;
    };

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    if (description && description.length > 1000) {
      return NextResponse.json({ error: "Description must be at most 1000 characters" }, { status: 400 });
    }

    const listing = await db.listing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, reportCount: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.userId === session.user.id) {
      return NextResponse.json({ error: "You cannot report your own listing" }, { status: 400 });
    }

    const [report, updatedListing] = await db.$transaction(async (tx) => {
      const newReport = await tx.listingReport.create({
        data: {
          listingId: id,
          userId: session.user.id,
          reason: reason.trim(),
          description: description?.trim() || null,
        },
      });

      const newReportCount = listing.reportCount + 1;
      const updateData: Record<string, unknown> = {
        reportCount: { increment: 1 },
      };

      // Auto-flag at 3+ reports
      if (newReportCount >= 3 && listing.status === "approved") {
        updateData.riskScore = { increment: 10 };
      }

      const updated = await tx.listing.update({
        where: { id },
        data: updateData,
      });

      return [newReport, updated];
    });

    notifyAdminsOfNewReport({
      id: report.id,
      listingId: id,
      reason: reason.trim(),
    }).catch(() => {});

    // Notify listing owner
    if (listing.userId && listing.userId !== session.user.id) {
      createNotification({
        userId: listing.userId,
        type: "listing_reported",
        title: "Your listing has been reported",
        message: `Your listing received a new report. Reason: ${reason}`,
        entityType: "listing",
        entityId: id,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        message: updatedListing.reportCount >= 3
          ? "Listing has been reported and flagged for review"
          : "Listing reported successfully",
        report: {
          id: report.id,
          listingId: report.listingId,
          reason: report.reason,
          createdAt: report.createdAt.toISOString(),
        },
        reportCount: updatedListing.reportCount,
        riskScore: updatedListing.riskScore,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logError(error, { component: "route:api/listings/[id]/report" });

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "You have already reported this listing" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to report listing" }, { status: 500 });
  }
}

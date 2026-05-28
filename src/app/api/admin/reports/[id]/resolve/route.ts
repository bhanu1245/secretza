import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logAdminAction, extractIpAddress } from "@/lib/audit-logger";
import { logError } from "@/lib/monitoring";

// POST /api/admin/reports/[id]/resolve — resolve a listing report
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, moderatorNotes } = body as {
      action: "resolve" | "dismiss" | "suspend_listing" | "suspend_user";
      moderatorNotes?: string;
    };

    if (!["resolve", "dismiss", "suspend_listing", "suspend_user"].includes(action)) {
      return NextResponse.json({ error: "Invalid report action" }, { status: 400 });
    }

    const report = await db.listingReport.findUnique({
      where: { id },
      include: { listing: { select: { id: true, userId: true } } },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const updated = await db.$transaction(async (tx) => {
      if (action === "suspend_listing") {
        await tx.listing.update({
          where: { id: report.listingId },
          data: { status: "rejected" },
        });
      }

      if (action === "suspend_user" && report.listing.userId) {
        await tx.user.update({
          where: { id: report.listing.userId },
          data: { isSuspended: true, sessionVersion: { increment: 1 } },
        });
      }

      const updatedReport = await tx.listingReport.update({
        where: { id },
        data: {
          isResolved: true,
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        },
      });
      await tx.$executeRaw`
        UPDATE ListingReport
        SET moderatorNotes = ${moderatorNotes ? String(moderatorNotes) : null}
        WHERE id = ${id}
      `;
      return updatedReport;
    });

    // Audit log the report resolution
    logAdminAction(
      admin.id,
      `report_${action}` as any,
      "ListingReport",
      id,
      { action, listingId: report.listingId, moderatorNotes },
      extractIpAddress(request)
    );

    return NextResponse.json({
      message: `Report ${action === "resolve" ? "resolved" : "dismissed"} successfully`,
      report: {
        id: updated.id,
        isResolved: updated.isResolved,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/reports/[id]/resolve" });
    return NextResponse.json({ error: "Failed to resolve report" }, { status: 500 });
  }
}

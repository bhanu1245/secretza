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
    const { action } = body as { action: "resolve" | "dismiss" };

    if (action !== "resolve" && action !== "dismiss") {
      return NextResponse.json({ error: "Action must be 'resolve' or 'dismiss'" }, { status: 400 });
    }

    const report = await db.listingReport.findUnique({
      where: { id },
      select: { id: true, listingId: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const updated = await db.listingReport.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedBy: admin.id,
        resolvedAt: new Date(),
      },
    });

    // Audit log the report resolution
    logAdminAction(
      admin.id,
      `report_${action}`,
      "ListingReport",
      id,
      { action, listingId: report.listingId },
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

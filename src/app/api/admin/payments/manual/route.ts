import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { logError } from "@/lib/monitoring";
import { buildManualPaymentSearchOr } from "@/lib/admin-payments-search";

/**
 * GET /api/admin/payments/manual
 * Admin endpoint: List all manual payment submissions with pagination and filtering
 */
export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    // Build where clause
    const where: Prisma.ManualPaymentSubmissionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      const listingMatches = await db.listing.findMany({
        where: { title: { contains: search } },
        select: { id: true },
        take: 100,
      });
      where.OR = buildManualPaymentSearchOr(
        search,
        listingMatches.map((listing) => listing.id),
      );
    }

    // Validate status value if provided
    const validStatuses = ["pending", "approved", "rejected", "proof_requested", "duplicate"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch submissions with user info + status counts in parallel
    const [submissions, total, statusCounts] = await Promise.all([
      db.manualPaymentSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      db.manualPaymentSubmission.count({ where }),
      // Get counts per status for dashboard
      db.manualPaymentSubmission.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    // Format status counts into a usable object
    const countsByStatus: Record<string, number> = {};
    for (const sc of statusCounts) {
      countsByStatus[sc.status] = sc._count.status;
    }

    const listingIds = submissions
      .map((s) => s.listingId)
      .filter((id): id is string => Boolean(id));
    const listings =
      listingIds.length > 0
        ? await db.listing.findMany({
            where: { id: { in: listingIds } },
            select: { id: true, title: true, slug: true },
          })
        : [];
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        userId: s.userId,
        listingId: s.listingId,
        listing: s.listingId ? listingMap.get(s.listingId) ?? null : null,
        paymentType: s.paymentType,
        amount: s.amount,
        utrNumber: s.utrNumber,
        screenshotUrl: s.screenshotUrl,
        selectedPlan: s.planLabel,
        paymentMethod: s.paymentMethod,
        notes: s.notes,
        status: s.status,
        adminNotes: s.adminNotes,
        reviewedBy: s.reviewedBy,
        reviewedAt: s.reviewedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        user: {
          id: s.user.id,
          email: s.user.email,
          name: s.user.name,
          image: s.user.image,
        },
        reviewer: s.reviewer
          ? {
              id: s.reviewer.id,
              name: s.reviewer.name,
              email: s.reviewer.email,
            }
          : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts: countsByStatus,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/payments/manual" });
    return NextResponse.json(
      { error: "Failed to fetch manual payment submissions" },
      { status: 500 }
    );
  }
}

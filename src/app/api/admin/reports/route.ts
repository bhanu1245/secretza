import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";

// GET /api/admin/reports — list listing reports (admin only)
export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const isResolved = searchParams.get("isResolved");
    const query = searchParams.get("q")?.trim();

    const where: Record<string, unknown> = {};
    if (isResolved !== null && isResolved !== undefined) {
      where.isResolved = isResolved === "true";
    }
    if (query) {
      where.OR = [
        { reason: { contains: query } },
        { description: { contains: query } },
        { listing: { title: { contains: query } } },
        { reporter: { email: { contains: query } } },
      ];
    }

    const [reports, total] = await Promise.all([
      db.listingReport.findMany({
        where,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              profileImage: true,
              galleryImages: true,
              images: true,
              userId: true,
              user: { select: { id: true, name: true, email: true, isSuspended: true } },
              category: { select: { id: true, name: true, slug: true } },
              city: { select: { id: true, name: true, slug: true } },
              listingImages: {
                orderBy: { sortOrder: "asc" },
                take: 1,
              },
            },
          },
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.listingReport.count({ where }),
    ]);

    // Count unresolved
    const unresolvedCount = await db.listingReport.count({ where: { isResolved: false } });
    const reportIds = reports.map((report) => report.id);
    const notesRows = reportIds.length
      ? await db.$queryRawUnsafe<Array<{ id: string; moderatorNotes: string | null }>>(
          `SELECT id, moderatorNotes FROM ListingReport WHERE id IN (${reportIds.map(() => "?").join(",")})`,
          ...reportIds
        )
      : [];
    const notesById = new Map(notesRows.map((row) => [row.id, row.moderatorNotes]));

    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        listing: r.listing,
        reporter: r.reporter,
        reason: r.reason,
        description: r.description,
        isResolved: r.isResolved,
        resolvedBy: r.resolvedBy,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        moderatorNotes: notesById.get(r.id) || null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      unresolvedCount,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/reports" });
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

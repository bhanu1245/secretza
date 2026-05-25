import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

// POST /api/reviews/[id]/report — report a review

const VALID_REPORT_REASONS = new Set([
  "spam",
  "inappropriate",
  "fake",
  "offensive",
  "misleading",
  "other",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting per user for review reports
    const rl = await rateLimit(`review-report:${session.user.id}`, RATE_LIMITS.api);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many report requests. Please try again later.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { reason, description } = body as {
      reason?: string;
      description?: string;
    };

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Validate reason against whitelist
    if (typeof reason !== "string" || !VALID_REPORT_REASONS.has(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${Array.from(VALID_REPORT_REASONS).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate description length
    if (description !== undefined && description !== null) {
      if (typeof description !== "string" || description.length > 1000) {
        return NextResponse.json(
          { error: "Description must be at most 1000 characters" },
          { status: 400 }
        );
      }
    }

    const review = await db.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Cannot report your own review
    if (review.userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot report your own review" },
        { status: 400 }
      );
    }

    // Check if user already reported this review (unique constraint)
    const existingReport = await db.reviewReport.findUnique({
      where: {
        reviewId_userId: {
          reviewId: id,
          userId: session.user.id,
        },
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this review" },
        { status: 409 }
      );
    }

    // Create the report and increment reportCount
    const [report, updatedReview] = await db.$transaction(async (tx) => {
      const newReport = await tx.reviewReport.create({
        data: {
          reviewId: id,
          userId: session.user.id,
          reason,
          description: description || null,
        },
      });

      const newCount = review.reportCount + 1;

      // Auto-flag if reportCount >= 3
      const updateData: Record<string, unknown> = {
        reportCount: { increment: 1 },
      };

      if (newCount >= 3 && review.status === "approved") {
        updateData.status = "flagged";
        updateData.flaggedReason = "Auto-flagged due to multiple reports";
      }

      const updated = await tx.review.update({
        where: { id },
        data: updateData,
      });

      return [newReport, updated];
    });

    return NextResponse.json(
      {
        message:
          updatedReview.status === "flagged"
            ? "Review has been reported and auto-flagged for moderation"
            : "Review reported successfully",
        report: {
          id: report.id,
          reviewId: report.reviewId,
          reason: report.reason,
          createdAt: report.createdAt.toISOString(),
        },
        reviewStatus: updatedReview.status,
        reportCount: updatedReview.reportCount,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logError(error, { component: "route:api/reviews/[id]/report" });

    // Handle Prisma unique constraint violation (race condition)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You have already reported this review" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to report review" },
      { status: 500 }
    );
  }
}

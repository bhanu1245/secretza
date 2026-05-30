import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import {
  computePriorityScore,
  getBoostExpiry,
  getFeatureExpiry,
} from "@/lib/ranking-engine";
import { createNotification } from "@/lib/notifications";
import { logError } from "@/lib/monitoring";
import { redeemCouponOnApproval } from "@/lib/coupons";

// Valid review actions
const VALID_ACTIONS = ["approve", "reject", "request_proof", "duplicate"] as const;
type ReviewAction = (typeof VALID_ACTIONS)[number];

// Boost duration map (amount INR → minutes)
const BOOST_DURATIONS: Record<number, number> = {
  99: 60,   // 1 hour
  199: 180, // 3 hours
  499: 720, // 12 hours
};

// Feature duration map (amount INR → days)
const FEATURE_DURATIONS: Record<number, number> = {
  149: 3,   // 3 days
  399: 7,   // 7 days
  799: 30,  // 30 days
};

// Premium duration: 30 days
const PREMIUM_DURATION_DAYS = 30;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/payments/manual/[id]/review
 * Admin endpoint: Review (approve/reject/request_proof/duplicate) a manual payment submission
 */
export async function POST(
  request: Request,
  { params }: RouteParams
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, adminNotes } = body as {
      action: string;
      adminNotes?: string;
    };

    // --- Validate action ---
    if (!action || !VALID_ACTIONS.includes(action as ReviewAction)) {
      return NextResponse.json(
        {
          error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const reviewAction = action as ReviewAction;

    // --- Fetch the submission ---
    const submission = await db.manualPaymentSubmission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Don't allow re-reviewing already processed submissions
    if (submission.status === "approved" || submission.status === "rejected") {
      return NextResponse.json(
        { error: `This submission has already been ${submission.status}` },
        { status: 409 }
      );
    }

    // --- Determine new status ---
    let newStatus: string;
    switch (reviewAction) {
      case "approve":
        newStatus = "approved";
        break;
      case "reject":
        newStatus = "rejected";
        break;
      case "request_proof":
        newStatus = "proof_requested";
        break;
      case "duplicate":
        newStatus = "duplicate";
        break;
    }

    // --- Update submission (and activate features atomically if approved) ---
    let updatedSubmission;
    if (reviewAction === "approve") {
      await db.$transaction(async (tx) => {
        // Update submission status
        updatedSubmission = await tx.manualPaymentSubmission.update({
          where: { id },
          data: {
            status: newStatus,
            adminNotes: adminNotes || null,
            reviewedBy: admin.id,
            reviewedAt: new Date(),
          },
        });

        // Activate the corresponding feature (tier lookup uses original plan amount)
        const tierAmount = submission.originalAmount ?? submission.amount;

        if (submission.paymentType === "boost") {
          if (submission.listingId) {
            const listing = await tx.listing.findUnique({
              where: { id: submission.listingId },
            });
            if (listing) {
              const boostMinutes = BOOST_DURATIONS[tierAmount] || 60;
              const boostUntil = getBoostExpiry(boostMinutes);

              // Recompute priority score with the new boost
              const rankedListing = {
                ...listing,
                isBoosted: true,
                boostUntil,
              };
              const newPriorityScore = computePriorityScore(rankedListing);

              await tx.listing.update({
                where: { id: submission.listingId },
                data: {
                  isBoosted: true,
                  boostUntil,
                  lastBumpedAt: new Date(),
                  priorityScore: newPriorityScore,
                },
              });
            }
          }
        } else if (submission.paymentType === "feature") {
          // Activate featured status on listing
          if (submission.listingId) {
            const listing = await tx.listing.findUnique({
              where: { id: submission.listingId },
            });
            if (listing) {
              const featureDays = FEATURE_DURATIONS[tierAmount] || 7;
              const featuredUntil = getFeatureExpiry(featureDays);

              // Recompute priority score with the new featured status
              const rankedListing = {
                ...listing,
                isFeatured: true,
                featuredUntil,
              };
              const newPriorityScore = computePriorityScore(rankedListing);

              await tx.listing.update({
                where: { id: submission.listingId },
                data: {
                  isFeatured: true,
                  featuredUntil,
                  priorityScore: newPriorityScore,
                },
              });
            }
          }
        } else if (submission.paymentType === "premium") {
          // Activate premium for user
          const premiumExpiry = getFeatureExpiry(PREMIUM_DURATION_DAYS);
          await tx.user.update({
            where: { id: submission.userId },
            data: {
              isPremium: true,
              premiumExpiry,
            },
          });
        }

        if (submission.couponId) {
          await redeemCouponOnApproval({
            couponId: submission.couponId,
            userId: submission.userId,
            submissionId: submission.id,
            tx,
          });
        }

        await tx.payment.create({
          data: {
            userId: submission.userId,
            listingId: submission.listingId || null,
            amount: submission.amount,
            currency: "INR",
            status: "completed",
            method: "manual_upi",
            gatewayTxId: submission.utrNumber,
            couponCode: submission.couponCode,
          },
        });
      });
    } else {
      // Non-approve actions: just update submission status
      updatedSubmission = await db.manualPaymentSubmission.update({
        where: { id },
        data: {
          status: newStatus,
          adminNotes: adminNotes || null,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });
    }

    // --- Audit log ---
    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: `manual_payment_${reviewAction === "request_proof" ? "proof_requested" : reviewAction}`,
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
        details: JSON.stringify({
          originalStatus: submission.status,
          newStatus,
          paymentType: submission.paymentType,
          amount: submission.amount,
          utrNumber: submission.utrNumber,
          listingId: submission.listingId,
          targetUserId: submission.userId,
          adminNotes: adminNotes || null,
        }),
      },
    });

    // --- Notification to user ---
    if (reviewAction === "approve") {
      await createNotification({
        userId: submission.userId,
        type: "payment_approved",
        title: "Payment Approved!",
        message: `Your ${submission.paymentType} payment of ₹${submission.amount} has been approved and activated.`,
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
      });
    } else if (reviewAction === "reject") {
      await createNotification({
        userId: submission.userId,
        type: "payment_rejected",
        title: "Payment Rejected",
        message: `Your ${submission.paymentType} payment of ₹${submission.amount} has been rejected. ${adminNotes ? "Reason: " + adminNotes : ""}`,
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
      });
    } else if (reviewAction === "request_proof") {
      await createNotification({
        userId: submission.userId,
        type: "payment_proof_requested",
        title: "Additional Proof Requested",
        message: `We need additional proof for your ${submission.paymentType} payment. ${adminNotes || "Please upload a clearer screenshot."}`,
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
      });
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: updatedSubmission.id,
        status: updatedSubmission.status,
        adminNotes: updatedSubmission.adminNotes,
        reviewedBy: updatedSubmission.reviewedBy,
        reviewedAt: updatedSubmission.reviewedAt?.toISOString() ?? null,
        updatedAt: updatedSubmission.updatedAt.toISOString(),
      },
      message:
        reviewAction === "approve"
          ? "Payment approved and feature activated successfully."
          : reviewAction === "reject"
            ? "Payment submission rejected."
            : reviewAction === "request_proof"
              ? "Additional proof requested from user."
              : "Submission marked as duplicate.",
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/payments/manual/[id]/review" });
    return NextResponse.json(
      { error: "Failed to review payment submission" },
      { status: 500 }
    );
  }
}

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
import { getDurationForTier } from "@/lib/payment-settings";

// Valid review actions
const VALID_ACTIONS = ["approve", "reject", "request_proof", "duplicate"] as const;
type ReviewAction = (typeof VALID_ACTIONS)[number];

// Terminal statuses that block re-review for any action
const TERMINAL_STATUSES = ["approved", "rejected"] as const;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Sentinel error thrown inside the transaction when a concurrent approval
// is detected — caught in the outer handler and returned as 409.
class SubmissionAlreadyProcessedError extends Error {
  readonly submissionStatus: string;
  constructor(status: string) {
    super(`Submission already ${status}`);
    this.name = "SubmissionAlreadyProcessedError";
    this.submissionStatus = status;
  }
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
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const reviewAction = action as ReviewAction;

    // --- Fetch the submission ---
    const submission = await db.manualPaymentSubmission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // --- Guard: terminal statuses block any further review ---
    if ((TERMINAL_STATUSES as readonly string[]).includes(submission.status)) {
      return NextResponse.json(
        { error: `This submission has already been ${submission.status}` },
        { status: 409 }
      );
    }

    // --- Guard (P1 Fix 5): "duplicate" submissions cannot be approved ---
    // They may still be rejected or have proof requested (admin workflow flexibility),
    // but approval is blocked because the submission was flagged as fraudulent.
    // The user must submit fresh payment proof to proceed.
    if (reviewAction === "approve" && submission.status === "duplicate") {
      return NextResponse.json(
        {
          error:
            "Submissions marked as duplicate cannot be approved. " +
            "If this payment is legitimate, ask the user to submit a new payment proof.",
          code: "DUPLICATE_STATUS",
        },
        { status: 409 }
      );
    }

    // --- Determine new status ---
    let newStatus: string;
    switch (reviewAction) {
      case "approve":       newStatus = "approved";        break;
      case "reject":        newStatus = "rejected";        break;
      case "request_proof": newStatus = "proof_requested"; break;
      case "duplicate":     newStatus = "duplicate";       break;
    }

    // --- Execute review ---
    let updatedSubmission: Awaited<ReturnType<typeof db.manualPaymentSubmission.update>>;

    if (reviewAction === "approve") {
      // All approval side-effects run atomically inside a single transaction.
      await db.$transaction(async (tx) => {

        // --- P1 Fix 4: Re-read status inside transaction (concurrent-approval guard) ---
        // A second admin could have approved between our outer read and now.
        // Reading inside the transaction gives a consistent snapshot in SQLite.
        const freshSubmission = await tx.manualPaymentSubmission.findUnique({
          where: { id },
          select: { status: true },
        });
        if (
          freshSubmission &&
          ((TERMINAL_STATUSES as readonly string[]).includes(freshSubmission.status) ||
            freshSubmission.status === "duplicate")
        ) {
          throw new SubmissionAlreadyProcessedError(freshSubmission.status);
        }

        // Update submission to approved
        updatedSubmission = await tx.manualPaymentSubmission.update({
          where: { id },
          data: {
            status: newStatus,
            adminNotes: adminNotes || null,
            reviewedBy: admin.id,
            reviewedAt: new Date(),
          },
        });

        // Activate the corresponding feature.
        // Duration is resolved from live PaymentSettings — no hardcoded maps.
        const tierAmount = submission.originalAmount ?? submission.amount;

        if (submission.paymentType === "boost") {
          if (submission.listingId) {
            const listing = await tx.listing.findUnique({ where: { id: submission.listingId } });
            if (listing) {
              const { durationMinutes, label, matched } = await getDurationForTier("boost", tierAmount);
              if (!matched) {
                console.warn("[review/approve] boost tier not found in PaymentSettings", {
                  tierAmount, label, submissionId: submission.id,
                });
              }
              const boostUntil = getBoostExpiry(durationMinutes);
              const newPriorityScore = computePriorityScore({ ...listing, isBoosted: true, boostUntil });
              await tx.listing.update({
                where: { id: submission.listingId },
                data: { isBoosted: true, boostUntil, lastBumpedAt: new Date(), priorityScore: newPriorityScore },
              });
            }
          }
        } else if (submission.paymentType === "feature") {
          if (submission.listingId) {
            const listing = await tx.listing.findUnique({ where: { id: submission.listingId } });
            if (listing) {
              const { durationDays, label, matched } = await getDurationForTier("feature", tierAmount);
              if (!matched) {
                console.warn("[review/approve] feature tier not found in PaymentSettings", {
                  tierAmount, label, submissionId: submission.id,
                });
              }
              const featuredUntil = getFeatureExpiry(durationDays);
              const newPriorityScore = computePriorityScore({ ...listing, isFeatured: true, featuredUntil });
              await tx.listing.update({
                where: { id: submission.listingId },
                data: { isFeatured: true, featuredUntil, priorityScore: newPriorityScore },
              });
            }
          }
        } else if (submission.paymentType === "premium") {
          const { durationDays, label, matched } = await getDurationForTier("premium", tierAmount);
          if (!matched) {
            console.warn("[review/approve] premium tier not found in PaymentSettings", {
              tierAmount, label, submissionId: submission.id,
            });
          }
          const premiumExpiry = getFeatureExpiry(durationDays);
          await tx.user.update({
            where: { id: submission.userId },
            data: { isPremium: true, premiumExpiry },
          });

          // Immediately sync premium status to the user's approved listings so they
          // gain Premium-tier ranking without waiting for the next 30-minute cron run.
          const userListings = await tx.listing.findMany({
            where: { userId: submission.userId, status: "approved" },
            select: {
              id: true,
              isFeatured: true,
              isBoosted: true,
              featuredUntil: true,
              boostUntil: true,
              lastBumpedAt: true,
              viewCount: true,
              createdAt: true,
              status: true,
            },
          });
          for (const lst of userListings) {
            const newScore = computePriorityScore({ ...lst, isPremium: true });
            await tx.listing.update({
              where: { id: lst.id },
              data: { isPremium: true, priorityScore: newScore },
            });
          }
        }

        // Coupon redemption: graceful — never blocks approval (see redeemCouponOnApproval).
        if (submission.couponId) {
          await redeemCouponOnApproval({
            couponId: submission.couponId,
            userId: submission.userId,
            submissionId: submission.id,
            paymentType: submission.paymentType,
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
      // Non-approve actions: update submission status only.
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

    // --- Notifications ---
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
    } else if (reviewAction === "duplicate") {
      // P1 Fix 3: notify users when their submission is marked duplicate so
      // they know to contact support rather than waiting indefinitely.
      await createNotification({
        userId: submission.userId,
        type: "payment_duplicate",
        title: "Payment Marked as Duplicate",
        message:
          `Your ${submission.paymentType} payment of ₹${submission.amount} has been flagged as a duplicate submission. ` +
          (adminNotes ? `Note: ${adminNotes}` : "Please contact support if you believe this is an error."),
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
      });
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: updatedSubmission!.id,
        status: updatedSubmission!.status,
        adminNotes: updatedSubmission!.adminNotes,
        reviewedBy: updatedSubmission!.reviewedBy,
        reviewedAt: updatedSubmission!.reviewedAt?.toISOString() ?? null,
        updatedAt: updatedSubmission!.updatedAt.toISOString(),
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
    // Concurrent approval detected inside the transaction
    if (error instanceof SubmissionAlreadyProcessedError) {
      return NextResponse.json(
        { error: `This submission has already been ${error.submissionStatus}` },
        { status: 409 }
      );
    }
    logError(error, { component: "route:api/admin/payments/manual/[id]/review" });
    return NextResponse.json(
      { error: "Failed to review payment submission" },
      { status: 500 }
    );
  }
}

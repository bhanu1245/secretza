// ==========================================
// SecretZa Admin Notifications
// ==========================================
// Thin, fire-and-forget wrappers around sendAdminNotification for the three
// admin-facing events. Each is called exactly once at the originating event so
// there are no duplicate sends. All are safe to call without awaiting; they
// never throw and no-op when ADMIN_NOTIFICATION_EMAIL is unset.

import { sendAdminNotification } from "@/lib/email";
import { logError } from "@/lib/monitoring";

export async function notifyAdminsOfNewListing(listing: {
  id: string;
  title: string;
  slug: string;
}): Promise<void> {
  try {
    await sendAdminNotification(
      "New listing awaiting approval",
      "New Listing Awaiting Approval",
      [
        `A new listing "${listing.title}" was submitted and is pending moderation.`,
        `Listing ID: ${listing.id}`,
      ],
    );
  } catch (error) {
    logError(error, { component: "admin-notifications:new-listing" });
  }
}

export async function notifyAdminsOfNewPayment(submission: {
  id: string;
  paymentType: string;
  amount: number;
}): Promise<void> {
  try {
    await sendAdminNotification(
      "New payment submission",
      "New Manual Payment Submission",
      [
        `A new ${submission.paymentType} payment of \u20B9${submission.amount} was submitted and needs review.`,
        `Submission ID: ${submission.id}`,
      ],
    );
  } catch (error) {
    logError(error, { component: "admin-notifications:new-payment" });
  }
}

export async function notifyAdminsOfNewReport(report: {
  id: string;
  listingId: string;
  reason: string;
}): Promise<void> {
  try {
    await sendAdminNotification(
      "New listing report",
      "New Abuse / Listing Report",
      [
        `A listing was reported. Reason: ${report.reason}`,
        `Listing ID: ${report.listingId}`,
        `Report ID: ${report.id}`,
      ],
    );
  } catch (error) {
    logError(error, { component: "admin-notifications:new-report" });
  }
}

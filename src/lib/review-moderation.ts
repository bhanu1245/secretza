export const REVIEW_REJECTION_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "duplicate", label: "Duplicate" },
  { id: "offensive", label: "Offensive Content" },
  { id: "low_quality", label: "Low Quality" },
  { id: "other", label: "Other" },
] as const;

export type ReviewRejectionReasonId =
  (typeof REVIEW_REJECTION_REASONS)[number]["id"];

const REASON_LABELS = Object.fromEntries(
  REVIEW_REJECTION_REASONS.map((r) => [r.id, r.label]),
) as Record<ReviewRejectionReasonId, string>;

const REASON_PREFIX = /^\[([a-z_]+)\](?:\s+(.*))?$/i;

export function formatRejectionAdminNote(
  reason: ReviewRejectionReasonId,
  note?: string,
): string {
  const trimmed = note?.trim();
  return trimmed ? `[${reason}] ${trimmed}` : `[${reason}]`;
}

export function parseRejectionAdminNote(adminNote: string | null | undefined): {
  reasonId: ReviewRejectionReasonId | null;
  reasonLabel: string | null;
  note: string | null;
} {
  if (!adminNote?.trim()) {
    return { reasonId: null, reasonLabel: null, note: null };
  }
  const match = adminNote.trim().match(REASON_PREFIX);
  if (!match) {
    return { reasonId: null, reasonLabel: null, note: adminNote.trim() };
  }
  const reasonId = match[1] as ReviewRejectionReasonId;
  const label = REASON_LABELS[reasonId] ?? match[1];
  return {
    reasonId: reasonId in REASON_LABELS ? reasonId : null,
    reasonLabel: label,
    note: match[2]?.trim() || null,
  };
}

export function getReviewStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "flagged":
      return "Flagged";
    default:
      return status;
  }
}

// ============================================================================
// Listing moderation helpers (rejection reasons, audit parsing)
// ============================================================================

export const LISTING_REJECTION_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "duplicate", label: "Duplicate" },
  { id: "fake_content", label: "Fake Content" },
  { id: "contact_violation", label: "Contact Violation" },
  { id: "wrong_category", label: "Wrong Category" },
  { id: "other", label: "Other" },
] as const;

export type ListingRejectionReasonId = (typeof LISTING_REJECTION_REASONS)[number]["id"];

const REJECTION_REASON_IDS = new Set<string>(LISTING_REJECTION_REASONS.map((r) => r.id));

export function isValidRejectionReasonId(value: string): value is ListingRejectionReasonId {
  return REJECTION_REASON_IDS.has(value);
}

export function getRejectionReasonLabel(id: string): string {
  return LISTING_REJECTION_REASONS.find((r) => r.id === id)?.label ?? id;
}

export type ParsedRejectionAudit = {
  reasonId: string | null;
  reasonLabel: string | null;
  note: string | null;
  rejectedAt: string | null;
};

export function parseRejectionFromAuditDetails(
  details: string | null | undefined,
  createdAt?: Date | string | null,
): ParsedRejectionAudit {
  if (!details) {
    return {
      reasonId: null,
      reasonLabel: null,
      note: null,
      rejectedAt: createdAt ? new Date(createdAt).toISOString() : null,
    };
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const reasonId =
      typeof parsed.rejectionReason === "string"
        ? parsed.rejectionReason
        : typeof parsed.reason === "string"
          ? parsed.reason
          : null;
    const reasonLabel =
      typeof parsed.rejectionReasonLabel === "string"
        ? parsed.rejectionReasonLabel
        : reasonId
          ? getRejectionReasonLabel(reasonId)
          : null;
    const note = typeof parsed.rejectionNote === "string" ? parsed.rejectionNote : null;

    return {
      reasonId,
      reasonLabel,
      note,
      rejectedAt: createdAt ? new Date(createdAt).toISOString() : null,
    };
  } catch {
    return {
      reasonId: null,
      reasonLabel: null,
      note: null,
      rejectedAt: createdAt ? new Date(createdAt).toISOString() : null,
    };
  }
}

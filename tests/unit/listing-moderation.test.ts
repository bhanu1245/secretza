import { describe, expect, it } from "vitest";
import {
  LISTING_REJECTION_REASONS,
  getRejectionReasonLabel,
  isValidRejectionReasonId,
  parseRejectionFromAuditDetails,
} from "@/lib/listing-moderation";

describe("listing-moderation", () => {
  it("exposes six standard rejection reasons", () => {
    expect(LISTING_REJECTION_REASONS).toHaveLength(6);
    expect(LISTING_REJECTION_REASONS.map((r) => r.id)).toContain("spam");
    expect(LISTING_REJECTION_REASONS.map((r) => r.id)).toContain("other");
  });

  it("validates rejection reason ids", () => {
    expect(isValidRejectionReasonId("wrong_category")).toBe(true);
    expect(isValidRejectionReasonId("invalid")).toBe(false);
  });

  it("parses rejection details from audit log JSON", () => {
    const parsed = parseRejectionFromAuditDetails(
      JSON.stringify({
        rejectionReason: "spam",
        rejectionReasonLabel: "Spam",
        rejectionNote: "Repeated posts",
      }),
      "2026-01-01T00:00:00.000Z",
    );
    expect(parsed.reasonId).toBe("spam");
    expect(parsed.reasonLabel).toBe("Spam");
    expect(parsed.note).toBe("Repeated posts");
  });

  it("labels unknown reason ids via helper", () => {
    expect(getRejectionReasonLabel("fake_content")).toBe("Fake Content");
  });
});

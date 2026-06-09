import { describe, expect, it } from "vitest";
import {
  formatRejectionAdminNote,
  parseRejectionAdminNote,
} from "@/lib/review-moderation";

describe("review-moderation", () => {
  it("formats rejection admin note with reason only", () => {
    expect(formatRejectionAdminNote("spam")).toBe("[spam]");
  });

  it("formats rejection admin note with reason and note", () => {
    expect(formatRejectionAdminNote("offensive", "Contains profanity")).toBe(
      "[offensive] Contains profanity",
    );
  });

  it("parses rejection reason and note", () => {
    expect(parseRejectionAdminNote("[duplicate] Same text as another review")).toEqual({
      reasonId: "duplicate",
      reasonLabel: "Duplicate",
      note: "Same text as another review",
    });
  });
});

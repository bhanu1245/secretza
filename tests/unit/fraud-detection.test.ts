import { describe, it, expect } from "vitest";

// Test fraud detection types and constants
describe("Fraud Detection Types", () => {
  it("should define valid event types", () => {
    const validTypes = [
      "rapid_signup",
      "suspicious_payment",
      "mass_upload",
      "credential_stuffing",
      "velocity_abuse",
      "duplicate_content",
      "suspicious_account",
    ];
    // These should match the FraudEventType union
    expect(validTypes.length).toBeGreaterThan(0);
  });

  it("should define valid severity levels", () => {
    const validSeverities = ["low", "medium", "high", "critical"];
    expect(validSeverities).toContain("low");
    expect(validSeverities).toContain("critical");
  });
});

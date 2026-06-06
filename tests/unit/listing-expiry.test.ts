import { describe, it, expect, afterEach, vi } from "vitest";
import { getListingExpiryDays, computeListingExpiry } from "@/lib/listing-expiry";

describe("listing-expiry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 60 days", () => {
    vi.stubEnv("LISTING_EXPIRY_DAYS", "");
    expect(getListingExpiryDays()).toBe(60);
  });

  it("honors a valid env override", () => {
    vi.stubEnv("LISTING_EXPIRY_DAYS", "30");
    expect(getListingExpiryDays()).toBe(30);
  });

  it("falls back to default on invalid env values", () => {
    vi.stubEnv("LISTING_EXPIRY_DAYS", "-5");
    expect(getListingExpiryDays()).toBe(60);
    vi.stubEnv("LISTING_EXPIRY_DAYS", "abc");
    expect(getListingExpiryDays()).toBe(60);
  });

  it("computes a future expiry relative to the given date", () => {
    vi.stubEnv("LISTING_EXPIRY_DAYS", "10");
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expiry = computeListingExpiry(from);
    expect(expiry.toISOString()).toBe("2026-01-11T00:00:00.000Z");
  });
});

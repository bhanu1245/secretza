import { describe, expect, it, vi } from "vitest";
import {
  normalizeListingSlugInput,
  resolveListingUpdateSlug,
  slugifyListingTitle,
  validateListingSlugFormat,
} from "@/lib/listing-slug";

describe("normalizeListingSlugInput", () => {
  it("returns null for undefined and null", () => {
    expect(normalizeListingSlugInput(undefined)).toBeNull();
    expect(normalizeListingSlugInput(null)).toBeNull();
  });

  it("trims and lowercases slug input", () => {
    expect(normalizeListingSlugInput("  Massage-In-Dwarka-Delhi  ")).toBe(
      "massage-in-dwarka-delhi",
    );
  });

  it("returns null for blank strings", () => {
    expect(normalizeListingSlugInput("   ")).toBeNull();
  });
});

describe("validateListingSlugFormat", () => {
  it("accepts valid slugs", () => {
    expect(validateListingSlugFormat("massage-in-dwarka-delhi")).toBeNull();
    expect(validateListingSlugFormat("premium-massage-123")).toBeNull();
  });

  it("rejects empty slugs", () => {
    expect(validateListingSlugFormat("")).toBe("Slug is required");
  });

  it("rejects uppercase and invalid characters", () => {
    expect(validateListingSlugFormat("Massage-In-Dwarka")).toBe(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    );
    expect(validateListingSlugFormat("massage in dwarka")).toBe(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    );
    expect(validateListingSlugFormat("massage_in_dwarka")).toBe(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    );
  });
});

describe("slugifyListingTitle", () => {
  it("slugifies titles without timestamps", () => {
    expect(slugifyListingTitle("Premium Massage in Dwarka Delhi")).toBe(
      "premium-massage-in-dwarka-delhi",
    );
  });
});

describe("resolveListingUpdateSlug", () => {
  const listingId = "listing-1";
  const existingSlug = "premium-massage-in-dwarka-delhi-verified-1780838217490";

  it("keeps existing slug when body slug is undefined", async () => {
    const result = await resolveListingUpdateSlug(
      {
        listingId,
        bodySlug: undefined,
        existingSlug,
        title: "Premium Massage",
      },
      async () => false,
    );

    expect(result).toEqual({ ok: true, slug: existingSlug });
  });

  it("persists a user-provided slug", async () => {
    const result = await resolveListingUpdateSlug(
      {
        listingId,
        bodySlug: "massage-in-dwarka-delhi",
        existingSlug,
        title: "Premium Massage",
      },
      async () => false,
    );

    expect(result).toEqual({ ok: true, slug: "massage-in-dwarka-delhi" });
  });

  it("allows keeping the current slug for the same listing", async () => {
    const isSlugTaken = vi.fn(async () => true);

    const result = await resolveListingUpdateSlug(
      {
        listingId,
        bodySlug: existingSlug,
        existingSlug,
        title: "Premium Massage",
      },
      isSlugTaken,
    );

    expect(result).toEqual({ ok: true, slug: existingSlug });
    expect(isSlugTaken).not.toHaveBeenCalled();
  });

  it("rejects duplicate slugs owned by another listing", async () => {
    const result = await resolveListingUpdateSlug(
      {
        listingId,
        bodySlug: "taken-slug",
        existingSlug,
        title: "Premium Massage",
      },
      async () => true,
    );

    expect(result).toEqual({
      ok: false,
      error: "Slug is already in use",
      field: "slug",
      status: 409,
    });
  });

  it("auto-generates from title when slug is missing", async () => {
    const result = await resolveListingUpdateSlug(
      {
        listingId,
        bodySlug: "",
        existingSlug,
        title: "Massage in Dwarka Delhi",
      },
      async () => false,
    );

    expect(result).toEqual({ ok: true, slug: "massage-in-dwarka-delhi" });
  });

  it("returns validation errors for invalid slugs", async () => {
    const result = await resolveListingUpdateSlug(
      {
        listingId,
        bodySlug: "Invalid Slug!",
        existingSlug,
        title: "Premium Massage",
      },
      async () => false,
    );

    expect(result).toEqual({
      ok: false,
      error: "Slug must contain only lowercase letters, numbers, and hyphens",
      field: "slug",
      status: 400,
    });
  });
});

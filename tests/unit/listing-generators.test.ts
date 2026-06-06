import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the single AI client so generators are tested without network/keys.
vi.mock("@/lib/ai/client", () => ({
  generateCompletion: vi.fn(),
}));

import { generateCompletion } from "@/lib/ai/client";
import {
  generateListingTitle,
  generateListingDescription,
  improveListingDescription,
  AiUnsafeOutputError,
} from "@/lib/ai/listing-generators";

const mockedComplete = generateCompletion as unknown as ReturnType<typeof vi.fn>;

describe("Listing AI generators", () => {
  beforeEach(() => mockedComplete.mockReset());

  it("generates a clean listing title and strips wrapping quotes", async () => {
    mockedComplete.mockResolvedValue('"Independent VIP Escort in Chennai – Anna Nagar"');
    const { text } = await generateListingTitle({
      category: "escorts",
      subcategory: "independent",
      city: "chennai",
      area: "anna-nagar",
    });
    expect(text).toBe("Independent VIP Escort in Chennai – Anna Nagar");
  });

  it("caps title length at the safety max (90 chars)", async () => {
    mockedComplete.mockResolvedValue("A".repeat(200));
    const { text } = await generateListingTitle({ category: "escorts", city: "delhi" });
    expect(text.length).toBeLessThanOrEqual(90);
  });

  it("feeds humanized category, subcategory, city and area into the title prompt", async () => {
    mockedComplete.mockResolvedValue("Some Title Here For The Listing In Navi Mumbai");
    await generateListingTitle({
      category: "massage-therapy",
      subcategory: "body-to-body",
      city: "navi-mumbai",
      area: "vashi",
    });
    const arg = mockedComplete.mock.calls[0][0];
    expect(arg.prompt).toContain("Massage Therapy");
    expect(arg.prompt).toContain("Body To Body");
    expect(arg.prompt).toContain("Navi Mumbai");
    expect(arg.prompt).toContain("Vashi");
  });

  it("includes keywords in the title prompt when provided", async () => {
    mockedComplete.mockResolvedValue("Verified Companion In Pune For An Evening Out");
    await generateListingTitle({
      category: "escorts",
      city: "pune",
      keywords: "verified companion, vip, outcall",
    });
    const arg = mockedComplete.mock.calls[0][0];
    expect(arg.prompt).toContain("verified companion");
    expect(arg.prompt).toContain("vip");
  });

  it("generates a long listing description without 160-char truncation", async () => {
    const longBody = "Paragraph one. ".repeat(40); // ~600 chars
    mockedComplete.mockResolvedValue(longBody);
    const { text } = await generateListingDescription({ category: "escorts", city: "mumbai" });
    expect(text.length).toBeGreaterThan(160);
  });

  it("feeds keywords and existing description into the description prompt", async () => {
    mockedComplete.mockResolvedValue("A friendly, location-aware description.");
    await generateListingDescription({
      category: "escorts",
      city: "delhi",
      keywords: "vip, discreet",
      description: "Existing copy to build on.",
    });
    const arg = mockedComplete.mock.calls[0][0];
    expect(arg.prompt).toContain("vip");
    expect(arg.prompt).toContain("Existing copy to build on.");
  });

  it("improves a listing description", async () => {
    mockedComplete.mockResolvedValue("An improved, well-structured description.");
    const { text } = await improveListingDescription("some original text");
    expect(text).toBe("An improved, well-structured description.");
  });

  it("short-circuits empty improve input without calling AI", async () => {
    const { text } = await improveListingDescription("   ");
    expect(text).toBe("");
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("rejects unsafe title output (phone leak)", async () => {
    mockedComplete.mockResolvedValue("Call me on 98765 43210 in Mumbai");
    await expect(
      generateListingTitle({ category: "escorts", city: "mumbai" }),
    ).rejects.toBeInstanceOf(AiUnsafeOutputError);
  });

  it("rejects unsafe description output (email leak)", async () => {
    mockedComplete.mockResolvedValue("Reach me at someone@example.com any time.");
    await expect(
      generateListingDescription({ category: "escorts", city: "mumbai" }),
    ).rejects.toBeInstanceOf(AiUnsafeOutputError);
  });

  it("rejects unsafe improve output (phone leak)", async () => {
    mockedComplete.mockResolvedValue("Text +91 99999 88888 to book now.");
    await expect(
      improveListingDescription("original safe text"),
    ).rejects.toBeInstanceOf(AiUnsafeOutputError);
  });
});

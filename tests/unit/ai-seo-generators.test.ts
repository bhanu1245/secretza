import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the single AI client so generators are tested without network/keys.
vi.mock("@/lib/ai/client", () => ({
  generateCompletion: vi.fn(),
}));

import { generateCompletion } from "@/lib/ai/client";
import {
  generateSeoTitle,
  generateSeoDescription,
  improveContent,
  AiUnsafeOutputError,
} from "@/lib/ai/seo-generators";

const mockedComplete = generateCompletion as unknown as ReturnType<typeof vi.fn>;

describe("AI SEO generators", () => {
  beforeEach(() => mockedComplete.mockReset());

  it("generates a clean title, strips wrapping quotes, caps at 60 chars", async () => {
    mockedComplete.mockResolvedValue('"Verified Companions in Mumbai"');
    const { text } = await generateSeoTitle({ category: "escorts", city: "mumbai" });
    expect(text).toBe("Verified Companions in Mumbai");
    expect(text.length).toBeLessThanOrEqual(60);
  });

  it("caps the description at 160 chars", async () => {
    mockedComplete.mockResolvedValue("a".repeat(300));
    const { text } = await generateSeoDescription({ city: "delhi" });
    expect(text.length).toBe(160);
  });

  it("rejects AI output that leaks a phone number", async () => {
    mockedComplete.mockResolvedValue("Call me at 9876543210 now");
    await expect(generateSeoTitle({ city: "pune" })).rejects.toBeInstanceOf(AiUnsafeOutputError);
  });

  it("rejects improved content that leaks an email", async () => {
    mockedComplete.mockResolvedValue("Reach a@b.com for details");
    await expect(improveContent("some original text")).rejects.toBeInstanceOf(AiUnsafeOutputError);
  });

  it("improveContent short-circuits empty input without calling AI", async () => {
    const { text } = await improveContent("   ");
    expect(text).toBe("");
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("feeds humanized context (city/category) into the prompt", async () => {
    mockedComplete.mockResolvedValue("A clean professional title");
    await generateSeoTitle({ category: "massage-therapy", city: "navi-mumbai" });
    const arg = mockedComplete.mock.calls[0][0] as { prompt: string; system: string };
    expect(arg.prompt).toContain("Massage Therapy");
    expect(arg.prompt).toContain("Navi Mumbai");
    expect(arg.system).toContain("NEVER include phone numbers");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/client", () => ({
  isAiConfigured: vi.fn(),
}));
vi.mock("@/lib/ai/listing-generators", () => ({
  generateListingTitle: vi.fn(),
  improveListingDescription: vi.fn(),
}));

import { isAiConfigured } from "@/lib/ai/client";
import {
  generateListingTitle as aiTitle,
  improveListingDescription as aiImprove,
} from "@/lib/ai/listing-generators";
import { generateListingContent } from "@/lib/listing-seo/listing-seo-engine";
import { generateListingDescription } from "@/lib/listing-seo/listing-seo-content";
import { isContentClean } from "@/lib/content-filter";
import { countWords } from "@/lib/seo-quality";

const mockConfigured = isAiConfigured as unknown as ReturnType<typeof vi.fn>;
const mockAiTitle = aiTitle as unknown as ReturnType<typeof vi.fn>;
const mockAiImprove = aiImprove as unknown as ReturnType<typeof vi.fn>;

const INPUT = {
  id: "listing-1",
  category: "escorts",
  subcategory: "independent",
  city: "chennai",
  area: "anna-nagar",
  state: "tamil-nadu",
  keywords: "vip companion",
  services: ["dinner date"],
};

/** A description that passes the AI acceptance gate (>= draft score, 150-300w, 3+ paras). */
function passingAiDescription(): string {
  return generateListingDescription(INPUT);
}

describe("Listing SEO V5 Lite — engine (AI optional + fallback)", () => {
  beforeEach(() => {
    mockConfigured.mockReset();
    mockAiTitle.mockReset();
    mockAiImprove.mockReset();
  });

  it("enhance OFF → deterministic draft, source lite, no AI call", async () => {
    mockConfigured.mockReturnValue(true);
    const r = await generateListingContent("title", INPUT, { enhance: false });
    expect(r.source).toBe("lite");
    expect(r.text.length).toBeGreaterThan(0);
    expect(mockAiTitle).not.toHaveBeenCalled();
  });

  it("enhance ON but AI unconfigured → lite fallback", async () => {
    mockConfigured.mockReturnValue(false);
    const r = await generateListingContent("description", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
    expect(mockAiImprove).not.toHaveBeenCalled();
  });

  it("enhance ON, AI throws → lite fallback (never fails)", async () => {
    mockConfigured.mockReturnValue(true);
    mockAiImprove.mockRejectedValue(new Error("boom"));
    const r = await generateListingContent("description", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("enhance ON, AI returns unsafe (caught upstream) → lite fallback", async () => {
    mockConfigured.mockReturnValue(true);
    mockAiImprove.mockRejectedValue(new Error("unsafe"));
    const r = await generateListingContent("improve", INPUT, {
      enhance: true,
      currentContent: "Some original safe text about the listing.",
    });
    expect(r.source).toBe("lite");
  });

  it("enhance ON, AI passes quality gate → source ai", async () => {
    mockConfigured.mockReturnValue(true);
    const aiText = passingAiDescription();
    mockAiImprove.mockResolvedValue({ text: aiText });
    const r = await generateListingContent("description", INPUT, { enhance: true });
    expect(r.source).toBe("ai");
    expect(countWords(r.text)).toBeGreaterThanOrEqual(150);
    expect(r.text.split(/\n\n+/).length).toBeGreaterThanOrEqual(3);
  });

  it("enhance ON, AI too short (<150 words) → lite fallback", async () => {
    mockConfigured.mockReturnValue(true);
    mockAiImprove.mockResolvedValue({ text: "A polished, clean, AI-enhanced description." });
    const r = await generateListingContent("description", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
  });

  it("enhance ON, AI has fewer than 3 paragraphs → lite fallback", async () => {
    mockConfigured.mockReturnValue(true);
    const oneBlock = Array(160).fill("word").join(" ") + ".";
    mockAiImprove.mockResolvedValue({ text: oneBlock });
    const r = await generateListingContent("description", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
    expect(r.text.split(/\n\n+/).length).toBeGreaterThanOrEqual(3); // draft has 4
  });

  it("enhance ON, AI worse keyword coverage → lite fallback", async () => {
    mockConfigured.mockReturnValue(true);
    // 150+ words, 3 paragraphs, but omits "vip companion" keyword present in draft.
    const noKw =
      "Welcome to a refined independent escort listing in Anna Nagar, Chennai, Tamil Nadu. " +
      "Expect a warm, attentive presence and a genuinely professional approach from the very first message onward. " +
      "Everything is handled with maturity and good judgement.\n\n" +
      "Services on offer include Dinner Date. Each is tailored to what you are after, with genuine attention to your time and preferences. " +
      "A calm, professional approach makes the whole thing easy. Reliability and good manners go a long way, and you will find both here.\n\n" +
      "Conveniently based in Anna Nagar, Chennai, Tamil Nadu, with easy reach across the wider area. " +
      "Arranging when and where to meet is straightforward and low-key. Flexibility and clear planning make arranging a visit painless. " +
      "Quality, authenticity, and trust sit at the heart of every listing here. Honest reviews and verified photos help you choose with confidence. " +
      "Expect clear communication and a genuinely friendly approach throughout. Your safety and satisfaction are taken seriously at every step.";
    expect(countWords(noKw)).toBeGreaterThanOrEqual(150);
    mockAiImprove.mockResolvedValue({ text: noKw });
    const r = await generateListingContent("description", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
  });

  it("enhance ON title, AI returns contact leak → lite fallback (filtered)", async () => {
    mockConfigured.mockReturnValue(true);
    mockAiTitle.mockResolvedValue({ text: "Call 98765 43210 now in Chennai for booking" });
    const r = await generateListingContent("title", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
    expect(isContentClean(r.text)).toBe(true);
  });

  it("enhance ON title, AI returns too-short text → lite fallback", async () => {
    mockConfigured.mockReturnValue(true);
    mockAiTitle.mockResolvedValue({ text: "Nung" });
    const r = await generateListingContent("title", INPUT, { enhance: true });
    expect(r.source).toBe("lite");
    expect(r.text.length).toBeGreaterThan(10);
  });

  it("all generated output passes the content filter", async () => {
    mockConfigured.mockReturnValue(false);
    for (const action of ["title", "description", "improve"] as const) {
      const r = await generateListingContent(action, INPUT, {
        enhance: false,
        currentContent: "Original safe text.",
      });
      expect(isContentClean(r.text)).toBe(true);
    }
  });
});

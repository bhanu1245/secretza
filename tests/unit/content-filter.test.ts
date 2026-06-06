import { describe, it, expect } from "vitest";
import {
  detectProhibitedContent,
  validateUserContent,
} from "@/lib/content-filter";

describe("detectProhibitedContent", () => {
  it("blocks email addresses", () => {
    const v = detectProhibitedContent("reach me at john.doe@example.com today");
    expect(v?.type).toBe("email");
  });

  it("blocks http/https URLs", () => {
    expect(detectProhibitedContent("visit https://mysite.com/profile")?.type).toBe("url");
  });

  it("blocks www URLs", () => {
    expect(detectProhibitedContent("see www.example.org now")?.type).toBe("url");
  });

  it("blocks bare domains with known TLDs", () => {
    expect(detectProhibitedContent("book at myescort.vip")?.type).toBe("url");
  });

  it("blocks Telegram handles", () => {
    expect(detectProhibitedContent("dm @secret_handle here")?.type).toBe("telegram");
  });

  it("blocks t.me links", () => {
    // t.me matches the bare-domain rule first; either way it is blocked.
    expect(detectProhibitedContent("t.me/secretchat")).not.toBeNull();
  });

  it("blocks 10-digit phone numbers", () => {
    expect(detectProhibitedContent("call 9876543210 anytime")?.type).toBe("phone");
  });

  it("blocks spaced/formatted phone numbers with country code", () => {
    expect(detectProhibitedContent("whatsapp +91 98765 43210")?.type).toBe("phone");
  });

  it("blocks fullwidth/obfuscated phone digits via NFKC", () => {
    // Fullwidth digits for 9876543210
    expect(detectProhibitedContent("call \uFF19\uFF18\uFF17\uFF16\uFF15\uFF14\uFF13\uFF12\uFF11\uFF10")?.type).toBe("phone");
  });

  it("allows clean marketing copy", () => {
    expect(
      detectProhibitedContent("Premium companion available for dinner dates and events."),
    ).toBeNull();
  });

  it("does not flag prices or short numbers", () => {
    expect(detectProhibitedContent("Rate is 5000 for 2 hours")).toBeNull();
  });

  it("does not flag measurements like 38-24-36", () => {
    expect(detectProhibitedContent("stats 38-24-36 figure")).toBeNull();
  });
});

describe("validateUserContent", () => {
  it("returns the first violating field", () => {
    const result = validateUserContent([
      { field: "title", label: "Title", value: "Clean title" },
      { field: "description", label: "Description", value: "email me at a@b.com" },
    ]);
    expect(result?.field).toBe("description");
    expect(result?.message).toContain("email");
  });

  it("skips empty and non-string values", () => {
    const result = validateUserContent([
      { field: "title", label: "Title", value: "" },
      { field: "x", label: "X", value: undefined },
      { field: "y", label: "Y", value: 12345 },
    ]);
    expect(result).toBeNull();
  });

  it("passes fully clean content", () => {
    const result = validateUserContent([
      { field: "title", label: "Title", value: "Elegant evening companion" },
      { field: "description", label: "Description", value: "Available for upscale events." },
    ]);
    expect(result).toBeNull();
  });
});

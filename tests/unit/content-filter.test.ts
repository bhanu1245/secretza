import { describe, it, expect } from "vitest";
import {
  CONTACT_CONTENT_BLOCKED_MESSAGE,
  containsEmail,
  containsPhoneNumber,
  containsTelegramReference,
  containsUrl,
  containsWhatsappReference,
  detectContactContent,
  detectProhibitedContent,
  validateUserContent,
} from "@/lib/content-filter";

describe("containsPhoneNumber", () => {
  it("detects 10-digit Indian numbers", () => {
    expect(containsPhoneNumber("call 9876543210 anytime")).toBe(true);
  });

  it("detects +91 numbers with spacing", () => {
    expect(containsPhoneNumber("whatsapp +91 98765 43210")).toBe(true);
  });

  it("detects dashed phone numbers", () => {
    expect(containsPhoneNumber("reach 987-654-3210")).toBe(true);
  });

  it("allows short numbers and prices", () => {
    expect(containsPhoneNumber("Rate is 5000 for 2 hours")).toBe(false);
  });
});

describe("containsWhatsappReference", () => {
  it("detects whatsapp keyword", () => {
    expect(containsWhatsappReference("message me on whatsapp")).toBe(true);
  });

  it("detects whats app spacing variant", () => {
    expect(containsWhatsappReference("contact via whats app")).toBe(true);
  });

  it("detects wa shorthand", () => {
    expect(containsWhatsappReference("ping me on wa")).toBe(true);
  });

  it("detects wa.me links", () => {
    expect(containsWhatsappReference("open wa.me/1234567890")).toBe(true);
  });
});

describe("containsTelegramReference", () => {
  it("detects telegram keyword", () => {
    expect(containsTelegramReference("find me on telegram")).toBe(true);
  });

  it("detects t.me links", () => {
    expect(containsTelegramReference("chat at t.me/secretchat")).toBe(true);
  });

  it("detects telegram.me links", () => {
    expect(containsTelegramReference("telegram.me/secretchat")).toBe(true);
  });

  it("detects @username handles", () => {
    expect(containsTelegramReference("dm @secret_handle here")).toBe(true);
  });
});

describe("containsEmail", () => {
  it("detects standard email addresses", () => {
    expect(containsEmail("reach me at john.doe@example.com today")).toBe(true);
  });
});

describe("containsUrl", () => {
  it("detects http/https URLs", () => {
    expect(containsUrl("visit https://mysite.com/profile")).toBe(true);
  });

  it("detects www URLs", () => {
    expect(containsUrl("see www.example.org now")).toBe(true);
  });

  it("detects bare domains with known TLDs", () => {
    expect(containsUrl("book at myescort.vip")).toBe(true);
  });
});

describe("detectContactContent", () => {
  it("returns structured detection for mixed contact content", () => {
    const result = detectContactContent("email me at a@b.com or call 9876543210");
    expect(result.hasEmail).toBe(true);
    expect(result.hasPhone).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain("email");
    expect(result.reasons).toContain("phone");
  });

  it("passes clean marketing copy", () => {
    const result = detectContactContent(
      "Premium companion available for dinner dates and events.",
    );
    expect(result.blocked).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});

describe("detectProhibitedContent", () => {
  it("blocks email addresses first", () => {
    const v = detectProhibitedContent("reach me at john.doe@example.com today");
    expect(v?.type).toBe("email");
  });

  it("blocks fullwidth/obfuscated phone digits via NFKC", () => {
    expect(
      detectProhibitedContent("call \uFF19\uFF18\uFF17\uFF16\uFF15\uFF14\uFF13\uFF12\uFF11\uFF10")?.type,
    ).toBe("phone");
  });

  it("does not flag measurements like 38-24-36", () => {
    expect(detectProhibitedContent("stats 38-24-36 figure")).toBeNull();
  });
});

describe("validateUserContent", () => {
  it("returns standardized blocked message", () => {
    const result = validateUserContent([
      { field: "title", label: "Title", value: "Clean title" },
      { field: "description", label: "Description", value: "email me at a@b.com" },
    ]);
    expect(result?.field).toBe("description");
    expect(result?.message).toBe(CONTACT_CONTENT_BLOCKED_MESSAGE);
    expect(result?.reasons).toContain("email");
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
      { field: "seoTitle", label: "SEO title", value: "Luxury companion in Mumbai" },
    ]);
    expect(result).toBeNull();
  });
});

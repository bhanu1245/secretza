import { describe, expect, it } from "vitest";
import {
  normalizeTelegramValue,
  validateEmail,
  validateListingContact,
  validatePhone,
  validateTelegram,
  validateWebsite,
  validateWhatsapp,
} from "@/lib/contact-validation";

describe("validatePhone", () => {
  it("accepts 10-digit Indian numbers", () => {
    expect(validatePhone("9876543210")).toBeNull();
  });

  it("accepts +91 numbers", () => {
    expect(validatePhone("+919876543210")).toBeNull();
  });

  it("rejects alphabetic input", () => {
    expect(validatePhone("abcdef")).toBe("Invalid phone number");
  });

  it("rejects short numbers", () => {
    expect(validatePhone("123")).toBe("Invalid phone number");
  });

  it("rejects symbols only", () => {
    expect(validatePhone("+++")).toBe("Invalid phone number");
  });
});

describe("validateWhatsapp", () => {
  it("accepts valid WhatsApp numbers", () => {
    expect(validateWhatsapp("9876543210")).toBeNull();
  });

  it("rejects invalid WhatsApp numbers", () => {
    expect(validateWhatsapp("abc")).toBe("Invalid WhatsApp number");
  });
});

describe("normalizeTelegramValue", () => {
  it("returns null for null", () => {
    expect(normalizeTelegramValue(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeTelegramValue(undefined)).toBeNull();
  });

  it("returns empty string for empty input", () => {
    expect(normalizeTelegramValue("")).toBe("");
  });

  it("strips leading @ from usernames", () => {
    expect(normalizeTelegramValue("@escortdelhi")).toBe("escortdelhi");
  });

  it("strips t.me links", () => {
    expect(normalizeTelegramValue("https://t.me/escortdelhi")).toBe("escortdelhi");
  });
});

describe("validateTelegram", () => {
  it("accepts plain usernames", () => {
    expect(validateTelegram("escortdelhi")).toBeNull();
  });

  it("accepts @ prefixed usernames", () => {
    expect(validateTelegram("@escortdelhi")).toBeNull();
  });

  it("rejects usernames with spaces", () => {
    expect(validateTelegram("escort delhi")).toBe("Invalid Telegram username");
  });

  it("rejects usernames that are too short", () => {
    expect(validateTelegram("ab")).toBe("Invalid Telegram username");
  });

  it("rejects special characters", () => {
    expect(validateTelegram("escort-delhi")).toBe("Invalid Telegram username");
  });
});

describe("validateEmail", () => {
  it("accepts valid email addresses", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("rejects invalid email addresses", () => {
    expect(validateEmail("not-an-email")).toBe("Invalid email address");
  });
});

describe("validateWebsite", () => {
  it("accepts https URLs", () => {
    expect(validateWebsite("https://example.com")).toBeNull();
  });

  it("accepts http URLs", () => {
    expect(validateWebsite("http://example.com")).toBeNull();
  });

  it("accepts www URLs", () => {
    expect(validateWebsite("www.example.com")).toBeNull();
  });

  it("rejects random text", () => {
    expect(validateWebsite("not a website")).toBe("Invalid website URL");
  });
});

describe("validateListingContact", () => {
  it("allows empty contact fields", () => {
    expect(validateListingContact({})).toEqual({ valid: true, errors: {} });
  });

  it("validates phone aliases", () => {
    const result = validateListingContact({
      contactPhone: "9876543210",
      contactText: "123",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toBe("Invalid phone number");
  });

  it("validates canonical and alias fields together", () => {
    const result = validateListingContact({
      whatsapp: "9876543210",
      telegram: "escortdelhi",
      contactEmail: "user@example.com",
      contactWebsite: "https://example.com",
    });
    expect(result).toEqual({ valid: true, errors: {} });
  });
});

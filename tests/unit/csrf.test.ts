import { describe, it, expect } from "vitest";
import { generateCsrfToken, createCsrfPair, validateCsrfToken } from "@/lib/csrf";

describe("CSRF Protection", () => {
  describe("generateCsrfToken", () => {
    it("should generate a 64-character hex token", () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).toBe(50);
    });
  });

  describe("createCsrfPair", () => {
    it("should return matching token and cookie header", () => {
      const { token, cookieHeader } = createCsrfPair();
      expect(token).toBeTruthy();
      expect(cookieHeader).toContain("csrf_token=");
      expect(cookieHeader).toContain(token);
      expect(cookieHeader).toContain("Path=/");
      expect(cookieHeader).toContain("HttpOnly");
    });
  });

  describe("validateCsrfToken", () => {
    it("should validate matching tokens", () => {
      const token = generateCsrfToken();
      expect(validateCsrfToken(token, token)).toBe(true);
    });

    it("should reject mismatched tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(validateCsrfToken(token1, token2)).toBe(false);
    });

    it("should reject null tokens", () => {
      expect(validateCsrfToken(null, null)).toBe(false);
      expect(validateCsrfToken("abc", null)).toBe(false);
      expect(validateCsrfToken(null, "abc")).toBe(false);
    });

    it("should reject non-hex tokens", () => {
      expect(validateCsrfToken("not-hex-at-all!", generateCsrfToken())).toBe(false);
    });
  });
});

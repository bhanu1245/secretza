import { describe, it, expect } from "vitest";
import { generateToken } from "@/lib/auth-helpers";

describe("generateToken", () => {
  it("should generate a token of the specified length", () => {
    const token = generateToken(32);
    expect(token).toHaveLength(32);
  });

  it("should generate different tokens on each call", () => {
    const token1 = generateToken(32);
    const token2 = generateToken(32);
    expect(token1).not.toBe(token2);
  });

  it("should generate URL-safe tokens", () => {
    const token = generateToken(64);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("should support custom lengths", () => {
    const short = generateToken(16);
    const long = generateToken(128);
    expect(short).toHaveLength(16);
    expect(long).toHaveLength(128);
  });

  it("should generate tokens with sufficient entropy", () => {
    // Generate 100 tokens and check for uniqueness
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken(32));
    }
    expect(tokens.size).toBe(100);
  });
});

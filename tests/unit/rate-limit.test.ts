import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, RATE_LIMITS, checkAbuse, recordFailure, clearFailures } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Rate limit state is in-memory; we can't easily reset it between tests,
    // but we use unique keys to avoid interference.
  });

  it("should allow requests under the limit", async () => {
    const result = await rateLimit(`test:${Date.now()}`, { maxRequests: 5, windowSeconds: 60 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("should reject requests over the limit", async () => {
    const key = `test-burst:${Date.now()}`;
    const config = { maxRequests: 3, windowSeconds: 60 };

    // Use up all 3 slots
    expect((await rateLimit(key, config)).success).toBe(true);
    expect((await rateLimit(key, config)).success).toBe(true);
    expect((await rateLimit(key, config)).success).toBe(true);

    // 4th should fail
    const result = await rateLimit(key, config);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should provide correct rate limit headers", async () => {
    const result = await rateLimit(`test-headers:${Date.now()}`, { maxRequests: 10, windowSeconds: 60 });
    expect(result.current).toBe(1);
    expect(result.resetAt).toBeGreaterThan(Date.now() / 1000 - 1);
  });
});

describe("checkAbuse", () => {
  it("should not flag normal traffic", async () => {
    const result = await checkAbuse(`abuse-test:${Date.now()}`, {
      burstThreshold: 100,
      failureThreshold: 100,
    });
    expect(result.isAbusive).toBe(false);
  });
});

describe("recordFailure / clearFailures", () => {
  it("should record and clear failures", async () => {
    const key = `fail-test:${Date.now()}`;
    await recordFailure(key);
    await recordFailure(key);
    await recordFailure(key);

    const result = await checkAbuse(key, {
      failureThreshold: 2,
      failureWindowSeconds: 300,
      burstThreshold: 100,
    });
    expect(result.failureCount).toBeGreaterThanOrEqual(2);

    await clearFailures(key);

    const resultAfter = await checkAbuse(key, {
      failureThreshold: 2,
      failureWindowSeconds: 300,
      burstThreshold: 100,
    });
    expect(resultAfter.failureCount).toBeLessThan(2);
  });
});

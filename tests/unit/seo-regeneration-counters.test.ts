import { describe, it, expect } from "vitest";
import {
  checkRegenInvariant,
  clampRunProgressFields,
  countItemsByStatus,
  deriveRunCounters,
  sumRegenStatusCounts,
} from "@/lib/seo-regeneration-counters";

describe("seo-regeneration-counters", () => {
  it("satisfies invariant when counts sum to total", () => {
    const counts = { queued: 10, processing: 2, completed: 350, failed: 10, skipped: 2 };
    expect(checkRegenInvariant(374, counts).ok).toBe(true);
  });

  it("detects invariant drift", () => {
    const counts = { queued: -5, processing: 0, completed: 400, failed: 0, skipped: 0 };
    expect(checkRegenInvariant(374, counts).ok).toBe(false);
  });

  it("never allows completed to exceed total", () => {
    const counts = countItemsByStatus([
      { status: "completed" },
      { status: "completed" },
      { status: "queued" },
    ]);
    const derived = deriveRunCounters(2, counts);
    expect(derived.completedCount).toBeLessThanOrEqual(2);
    expect(derived.completedCount).toBe(2);
  });

  it("never allows queued or remaining to be negative", () => {
    const derived = deriveRunCounters(374, {
      queued: -184,
      processing: 0,
      completed: 558,
      failed: 0,
      skipped: 0,
    });
    expect(derived.queuedCount).toBeGreaterThanOrEqual(0);
    expect(derived.remaining).toBeGreaterThanOrEqual(0);
    expect(derived.completedCount).toBeLessThanOrEqual(374);
    expect(derived.completedCount).toBe(374);
  });

  it("clampRunProgressFields repairs drifted stored counters", () => {
    const clamped = clampRunProgressFields(374, {
      completedCount: 558,
      queuedCount: -184,
      processingCount: -1,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(clamped.completedCount).toBeLessThanOrEqual(374);
    expect(clamped.queuedCount).toBeGreaterThanOrEqual(0);
    expect(clamped.remaining).toBeGreaterThanOrEqual(0);
  });

  it("sum of item statuses equals total for a valid run", () => {
    const items = Array.from({ length: 374 }, (_, i) => ({
      status: i < 300 ? "completed" : i < 350 ? "queued" : "failed",
    }));
    const counts = countItemsByStatus(items);
    expect(sumRegenStatusCounts(counts)).toBe(374);
    const inv = checkRegenInvariant(374, counts);
    expect(inv.ok).toBe(true);
    expect(deriveRunCounters(374, counts).completedCount).toBe(300);
    expect(deriveRunCounters(374, counts).queuedCount).toBe(50);
    expect(deriveRunCounters(374, counts).failedCount).toBe(24);
  });
});

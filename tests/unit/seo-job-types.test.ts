import { describe, it, expect } from "vitest";
import {
  BULK_ACTION_TO_JOB_TYPE,
  SEO_JOB_TYPES,
  estimateJobDurationMinutes,
  isSeoJobType,
  DEFAULT_JOB_BATCH_SIZE,
} from "@/lib/seo-job-types";

describe("seo-job-types", () => {
  it("recognizes all defined job types", () => {
    for (const t of SEO_JOB_TYPES) {
      expect(isSeoJobType(t)).toBe(true);
    }
    expect(isSeoJobType("invalid")).toBe(false);
  });

  it("maps bulk UI actions to job types", () => {
    expect(BULK_ACTION_TO_JOB_TYPE.auto_fix).toBe("bulk_autofix");
    expect(BULK_ACTION_TO_JOB_TYPE.regenerate).toBe("regenerate");
    expect(BULK_ACTION_TO_JOB_TYPE.generate_missing).toBe("generate_missing_meta");
    expect(BULK_ACTION_TO_JOB_TYPE.repair_canonical).toBe("repair_canonicals");
  });

  it("estimates duration with a minimum of 1 minute", () => {
    expect(estimateJobDurationMinutes(0, "regenerate")).toBe(1);
    expect(estimateJobDurationMinutes(100, "recalculate_word_count")).toBeGreaterThanOrEqual(1);
    expect(estimateJobDurationMinutes(100, "regenerate")).toBeGreaterThan(
      estimateJobDurationMinutes(100, "recalculate_word_count"),
    );
  });

  it("uses default batch size of 100", () => {
    expect(DEFAULT_JOB_BATCH_SIZE).toBe(100);
  });
});

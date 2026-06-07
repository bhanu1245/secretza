import { describe, expect, it } from "vitest";
import {
  CONTACT_REVEAL_DAILY_LIMIT,
  CONTACT_REVEAL_HOURLY_LIMIT,
  isRevealRateLimited,
} from "@/lib/contact-reveal";

describe("contact reveal rate limits", () => {
  it("allows reveals below hourly and daily limits", () => {
    expect(
      isRevealRateLimited({
        hourCount: CONTACT_REVEAL_HOURLY_LIMIT - 1,
        dayCount: CONTACT_REVEAL_DAILY_LIMIT - 1,
      }),
    ).toBe(false);
  });

  it("blocks when hourly limit is reached", () => {
    expect(
      isRevealRateLimited({
        hourCount: CONTACT_REVEAL_HOURLY_LIMIT,
        dayCount: 0,
      }),
    ).toBe(true);
  });

  it("blocks when daily limit is reached", () => {
    expect(
      isRevealRateLimited({
        hourCount: 0,
        dayCount: CONTACT_REVEAL_DAILY_LIMIT,
      }),
    ).toBe(true);
  });
});

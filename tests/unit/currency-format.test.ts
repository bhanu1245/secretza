import { describe, expect, it } from "vitest";
import {
  formatRevenueAmount,
  formatRevenueAxisTick,
  formatRevenueCompact,
  getCurrencySymbol,
} from "@/lib/currency-format";

describe("currency-format", () => {
  it("returns INR symbol", () => {
    expect(getCurrencySymbol("INR")).toBe("₹");
  });

  it("formats compact revenue in INR", () => {
    expect(formatRevenueCompact(1500, "INR")).toBe("₹1.5K");
  });

  it("formats chart axis ticks in INR", () => {
    expect(formatRevenueAxisTick(2000, "INR")).toBe("₹2k");
  });

  it("formats tooltip amounts in INR", () => {
    expect(formatRevenueAmount(1500, "INR")).toBe("₹1,500");
  });
});

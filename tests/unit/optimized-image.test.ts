import { describe, expect, it } from "vitest";
import { isImageAlreadyLoaded } from "@/components/secretza/listing/ListingCard";

describe("isImageAlreadyLoaded", () => {
  it("returns false for null", () => {
    expect(isImageAlreadyLoaded(null)).toBe(false);
  });

  it("returns false when not complete", () => {
    expect(
      isImageAlreadyLoaded({ complete: false, naturalWidth: 100 } as HTMLImageElement),
    ).toBe(false);
  });

  it("returns false when complete but zero width (broken)", () => {
    expect(
      isImageAlreadyLoaded({ complete: true, naturalWidth: 0 } as HTMLImageElement),
    ).toBe(false);
  });

  it("returns true when complete with decoded pixels", () => {
    expect(
      isImageAlreadyLoaded({ complete: true, naturalWidth: 720 } as HTMLImageElement),
    ).toBe(true);
  });
});

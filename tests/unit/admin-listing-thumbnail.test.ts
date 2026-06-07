import { describe, expect, it } from "vitest";
import {
  ADMIN_LISTING_PLACEHOLDER,
  resolveAdminListingThumbnail,
} from "@/lib/listing-images";

describe("resolveAdminListingThumbnail", () => {
  it("prefers listing image thumbnail over full url", () => {
    expect(
      resolveAdminListingThumbnail({
        listingImages: [
          {
            thumbnailUrl: "/api/upload/file?key=listings%2Fu%2Fthumb.webp",
            url: "/api/upload/file?key=listings%2Fu%2Ffull.webp",
          },
        ],
      }),
    ).toBe("/api/upload/file?key=listings%2Fu%2Fthumb.webp");
  });

  it("falls back to profileImage when listingImages are missing", () => {
    expect(
      resolveAdminListingThumbnail({
        profileImage: "/api/upload/file?key=listings%2Fu%2Fprofile.webp",
      }),
    ).toBe("/api/upload/file?key=listings%2Fu%2Fprofile.webp");
  });

  it("uses placeholder when no image fields exist", () => {
    expect(resolveAdminListingThumbnail({})).toBe(ADMIN_LISTING_PLACEHOLDER);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    listingImage: {
      findFirst,
    },
  },
}));

import {
  canAccessListingImageFile,
  resolveListingImageParentStorageKey,
} from "@/lib/image-moderation";

const PARENT = "listings/user-1/1780835589416-abc.webp";
const THUMB = "listings/user-1/1780835589416-abc-thumb.webp";
const MEDIUM = "listings/user-1/1780835589416-abc-medium.webp";

function pendingImage(ownerId = "owner-1") {
  return {
    moderationStatus: "pending" as const,
    listing: { userId: ownerId },
  };
}

function approvedImage(ownerId = "owner-1") {
  return {
    moderationStatus: "approved" as const,
    listing: { userId: ownerId },
  };
}

beforeEach(() => {
  findFirst.mockReset();
});

describe("resolveListingImageParentStorageKey", () => {
  it("maps -thumb.webp to parent .webp", () => {
    expect(resolveListingImageParentStorageKey(THUMB)).toBe(PARENT);
  });

  it("maps -medium.webp to parent .webp", () => {
    expect(resolveListingImageParentStorageKey(MEDIUM)).toBe(PARENT);
  });

  it("returns original key unchanged", () => {
    expect(resolveListingImageParentStorageKey(PARENT)).toBe(PARENT);
  });
});

describe("canAccessListingImageFile", () => {
  it("allows admin access to pending thumbnail via parent lookup", async () => {
    findFirst.mockResolvedValue(pendingImage());

    await expect(
      canAccessListingImageFile(THUMB, { id: "admin-1", role: "ADMIN" }),
    ).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith({
      where: { storageKey: PARENT },
      select: {
        moderationStatus: true,
        listing: { select: { userId: true } },
      },
    });
  });

  it("allows moderator access to pending medium via parent lookup", async () => {
    findFirst.mockResolvedValue(pendingImage());

    await expect(
      canAccessListingImageFile(MEDIUM, { id: "mod-1", role: "moderator" }),
    ).resolves.toBe(true);
  });

  it("allows public access to approved original and derivatives", async () => {
    findFirst.mockResolvedValue(approvedImage());

    await expect(canAccessListingImageFile(PARENT)).resolves.toBe(true);
    await expect(canAccessListingImageFile(THUMB)).resolves.toBe(true);
    await expect(canAccessListingImageFile(MEDIUM)).resolves.toBe(true);
  });

  it("denies anonymous access to pending original and derivatives", async () => {
    findFirst.mockResolvedValue(pendingImage());

    await expect(canAccessListingImageFile(PARENT)).resolves.toBe(false);
    await expect(canAccessListingImageFile(THUMB)).resolves.toBe(false);
    await expect(canAccessListingImageFile(MEDIUM)).resolves.toBe(false);
  });

  it("denies non-owner users access to pending images", async () => {
    findFirst.mockResolvedValue(pendingImage("owner-1"));

    const viewer = { id: "other-user", role: "USER" };
    await expect(canAccessListingImageFile(PARENT, viewer)).resolves.toBe(false);
    await expect(canAccessListingImageFile(THUMB, viewer)).resolves.toBe(false);
    await expect(canAccessListingImageFile(MEDIUM, viewer)).resolves.toBe(false);
  });

  it("allows listing owner access to pending original and derivatives", async () => {
    findFirst.mockResolvedValue(pendingImage("owner-1"));

    const owner = { id: "owner-1", role: "USER" };
    await expect(canAccessListingImageFile(PARENT, owner)).resolves.toBe(true);
    await expect(canAccessListingImageFile(THUMB, owner)).resolves.toBe(true);
    await expect(canAccessListingImageFile(MEDIUM, owner)).resolves.toBe(true);
  });

  it("allows owner path access when no ListingImage row exists yet", async () => {
    findFirst.mockResolvedValue(null);

    const owner = { id: "user-1", role: "USER" };
    await expect(canAccessListingImageFile(THUMB, owner)).resolves.toBe(true);
    await expect(canAccessListingImageFile(MEDIUM, owner)).resolves.toBe(true);
  });

  it("denies admin when parent ListingImage row does not exist", async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      canAccessListingImageFile(THUMB, { id: "admin-1", role: "admin" }),
    ).resolves.toBe(false);
  });
});

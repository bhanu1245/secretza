import { db } from "@/lib/db";
import {
  extractStorageKeyFromUrl,
  resolveListingImageUrl,
} from "@/lib/listing-images";

type UploadResultInput = Record<string, unknown>;

function mimeFromKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function normalizeGalleryUrls(urls: string[]): string[] {
  return urls
    .map((raw) => resolveListingImageUrl(raw) || raw.trim())
    .filter(Boolean);
}

function resolveStorageKey(
  img: UploadResultInput,
  listingId: string,
  index: number,
): string {
  const rawUrl = String(img.url || "");
  const url = resolveListingImageUrl(rawUrl) || rawUrl;
  return (
    String(img.storageKey || img.key || "") ||
    extractStorageKeyFromUrl(url) ||
    extractStorageKeyFromUrl(rawUrl) ||
    `listings/${listingId}/${index}`
  );
}

function toListingImageRow(
  listingId: string,
  img: UploadResultInput,
  index: number,
) {
  const rawUrl = String(img.url || "");
  const url = resolveListingImageUrl(rawUrl) || rawUrl;
  const storageKey = resolveStorageKey(img, listingId, index);

  return {
    listingId,
    url,
    thumbnailUrl: resolveListingImageUrl(String(img.thumbnailUrl || "")) || url,
    mediumUrl: resolveListingImageUrl(String(img.mediumUrl || "")) || url,
    storageKey,
    mimeType: String(img.mimeType || mimeFromKey(storageKey)),
    width: Number(img.width || 0),
    height: Number(img.height || 0),
    sizeBytes: Number(img.sizeBytes || 0),
    sortOrder: Number(img.sortOrder ?? index),
    moderationStatus: "pending" as const,
  };
}

/**
 * Persist listing images for create and edit flows.
 * - Appends new uploadResults as pending ListingImage rows (deduped by storageKey).
 * - Syncs gallery URLs that are not yet in ListingImage (edit path when uploadResults missing).
 * - replace=true wipes existing rows first (create-only / full reset).
 */
export async function persistListingImages(
  listingId: string,
  options: {
    galleryImages?: string[];
    uploadResults?: UploadResultInput[];
    replace?: boolean;
  } = {},
): Promise<number> {
  const { galleryImages = [], uploadResults = [], replace = false } = options;
  const normalizedGallery = normalizeGalleryUrls(galleryImages);

  if (replace) {
    await db.listingImage.deleteMany({ where: { listingId } });
    const sources: UploadResultInput[] =
      uploadResults.length > 0
        ? uploadResults
        : normalizedGallery.map((url, index) => ({
            url,
            storageKey: extractStorageKeyFromUrl(url) || `listings/${listingId}/${index}`,
            sortOrder: index,
          }));

    const validSources = sources.filter((img) => String(img.url || "").trim());
    if (validSources.length === 0) return 0;

    await db.listingImage.createMany({
      data: validSources.map((img, index) => toListingImageRow(listingId, img, index)),
    });
    return validSources.length;
  }

  const existingRows = await db.listingImage.findMany({
    where: { listingId },
    select: { storageKey: true, url: true },
  });
  const existingKeys = new Set<string>();
  for (const row of existingRows) {
    if (row.storageKey) existingKeys.add(row.storageKey);
    const fromUrl = extractStorageKeyFromUrl(row.url);
    if (fromUrl) existingKeys.add(fromUrl);
  }

  const candidates: UploadResultInput[] = [];
  const seenKeys = new Set<string>();
  const reuploadKeys: string[] = [];

  for (const img of uploadResults) {
    const url = String(img.url || "").trim();
    if (!url || url.startsWith("blob:")) continue;

    const storageKey = resolveStorageKey(img, listingId, candidates.length);
    if (seenKeys.has(storageKey)) continue;
    seenKeys.add(storageKey);

    if (existingKeys.has(storageKey)) {
      reuploadKeys.push(storageKey);
    }
    candidates.push(img);
  }

  for (const url of normalizedGallery) {
    if (url.startsWith("blob:")) continue;
    const storageKey = extractStorageKeyFromUrl(url) || `listings/${listingId}/${candidates.length}`;
    if (seenKeys.has(storageKey) || existingKeys.has(storageKey)) continue;
    seenKeys.add(storageKey);
    candidates.push({ url, storageKey, sortOrder: candidates.length });
  }

  if (candidates.length === 0) return 0;

  const keysToReplace = [
    ...new Set([
      ...reuploadKeys,
      ...candidates
        .map((img, index) => resolveStorageKey(img, listingId, index))
        .filter((key) => uploadResults.length > 0 && existingKeys.has(key)),
    ]),
  ];

  if (keysToReplace.length > 0) {
    await db.listingImage.deleteMany({
      where: { listingId, storageKey: { in: keysToReplace } },
    });
  }

  await db.listingImage.createMany({
    data: candidates.map((img, index) => toListingImageRow(listingId, img, index)),
  });

  return candidates.length;
}

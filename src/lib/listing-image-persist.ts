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

  const existingCount = await db.listingImage.count({ where: { listingId } });
  if (existingCount > 0 && !replace && uploadResults.length === 0) {
    return 0;
  }

  if (replace) {
    await db.listingImage.deleteMany({ where: { listingId } });
  }

  await db.listingImage.createMany({
    data: validSources.map((img, index) => {
      const rawUrl = String(img.url || "");
      const url = resolveListingImageUrl(rawUrl) || rawUrl;
      const storageKey =
        String(img.storageKey || img.key || "") ||
        extractStorageKeyFromUrl(url) ||
        extractStorageKeyFromUrl(rawUrl) ||
        `listings/${listingId}/${index}`;

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
        moderationStatus: "pending",
      };
    }),
  });

  return validSources.length;
}

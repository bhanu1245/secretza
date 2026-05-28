export type ListingImageCandidate = {
  url?: string | null;
  thumbnailUrl?: string | null;
  mediumUrl?: string | null;
  alt?: string | null;
  isPrimary?: boolean | null;
  sortOrder?: number | null;
  blurHash?: string | null;
  width?: number | null;
  height?: number | null;
};

export type ListingLikeWithImages = {
  title?: string | null;
  images?: unknown;
  listingImages?: ListingImageCandidate[] | null;
  profileImage?: string | null;
  galleryImages?: unknown;
};

export type ResolvedListingImage = {
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  alt: string;
  blurHash?: string;
  width?: number;
  height?: number;
};

/** Shown when a listing has no resolvable image URL. */
export const LISTING_IMAGE_PLACEHOLDER = "/logo.svg";

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Extract a storage key from known upload URL formats. */
export function extractStorageKeyFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("blob:")) return null;

  if (!trimmed.includes("://") && trimmed.startsWith("listings/")) {
    return trimmed;
  }

  if (trimmed.startsWith("/uploads/")) {
    return trimmed.slice("/uploads/".length);
  }

  try {
    const parsed = trimmed.startsWith("/")
      ? new URL(trimmed, "http://localhost")
      : new URL(trimmed);

    if (parsed.pathname === "/api/upload/file") {
      const key = parsed.searchParams.get("key");
      return key ? decodeURIComponent(key) : null;
    }

    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname.slice("/uploads/".length);
    }
  } catch {
    return null;
  }

  return null;
}

/** Normalize relative paths, storage keys, and API routes to a browser-loadable URL. */
export function resolveListingImageUrl(value: unknown): string | null {
  const url = stringUrl(value);
  if (!url || url.startsWith("blob:")) return null;

  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    const key = extractStorageKeyFromUrl(url);
    if (key && url.includes("/api/upload/file")) {
      return `/api/upload/file?key=${encodeURIComponent(key)}`;
    }
    return url;
  }

  if (url.startsWith("/api/upload/file")) {
    const key = extractStorageKeyFromUrl(url);
    return key ? `/api/upload/file?key=${encodeURIComponent(key)}` : url;
  }

  if (url.startsWith("/uploads/")) {
    const key = url.slice("/uploads/".length);
    return `/api/upload/file?key=${encodeURIComponent(key)}`;
  }

  if (url.startsWith("listings/")) {
    return `/api/upload/file?key=${encodeURIComponent(url)}`;
  }

  if (url.startsWith("/")) {
    return url;
  }

  return url;
}

function normalizeUrl(value: unknown): string | null {
  return resolveListingImageUrl(value);
}

function fromUnknownImage(value: unknown, title: string): ResolvedListingImage | null {
  if (typeof value === "string") {
    const url = normalizeUrl(value);
    return url ? { url, thumbnailUrl: url, mediumUrl: url, alt: title } : null;
  }

  if (!value || typeof value !== "object") return null;
  const image = value as Record<string, unknown>;
  const url = normalizeUrl(image.url || image.src || image.image);
  if (!url) return null;

  const thumbnailUrl = normalizeUrl(image.thumbnailUrl) || url;
  const mediumUrl = normalizeUrl(image.mediumUrl) || url;
  const alt = stringUrl(image.alt) || title;

  return {
    url,
    thumbnailUrl,
    mediumUrl,
    alt,
    blurHash: stringUrl(image.blurHash) || undefined,
    width: typeof image.width === "number" ? image.width : undefined,
    height: typeof image.height === "number" ? image.height : undefined,
  };
}

export function getListingImages(listing: ListingLikeWithImages): ResolvedListingImage[] {
  const title = listing.title || "Listing image";
  const resolved: ResolvedListingImage[] = [];

  const dbImages = [...(listing.listingImages || [])].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  for (const image of dbImages) {
    const url = normalizeUrl(image.url);
    if (!url) continue;
    resolved.push({
      url,
      thumbnailUrl: normalizeUrl(image.thumbnailUrl) || url,
      mediumUrl: normalizeUrl(image.mediumUrl) || url,
      alt: title,
      blurHash: image.blurHash || undefined,
      width: image.width || undefined,
      height: image.height || undefined,
    });
  }

  const profileImage = normalizeUrl(listing.profileImage);
  if (profileImage && !resolved.some((image) => image.url === profileImage)) {
    resolved.push({
      url: profileImage,
      thumbnailUrl: profileImage,
      mediumUrl: profileImage,
      alt: title,
    });
  }

  for (const image of parseJsonArray(listing.galleryImages)) {
    const resolvedImage = fromUnknownImage(image, title);
    if (resolvedImage && !resolved.some((item) => item.url === resolvedImage.url)) {
      resolved.push(resolvedImage);
    }
  }

  for (const image of parseJsonArray(listing.images)) {
    const resolvedImage = fromUnknownImage(image, title);
    if (resolvedImage && !resolved.some((item) => item.url === resolvedImage.url)) {
      resolved.push(resolvedImage);
    }
  }

  return resolved;
}

export function getListingCoverImage(listing: ListingLikeWithImages): ResolvedListingImage | null {
  return getListingImages(listing)[0] || null;
}

export function getListingCoverImageWithPlaceholder(
  listing: ListingLikeWithImages,
): ResolvedListingImage {
  const cover = getListingCoverImage(listing);
  if (cover) return cover;

  const title = listing.title || "Listing";
  return {
    url: LISTING_IMAGE_PLACEHOLDER,
    thumbnailUrl: LISTING_IMAGE_PLACEHOLDER,
    mediumUrl: LISTING_IMAGE_PLACEHOLDER,
    alt: title,
  };
}

import "server-only";

import { createStorageService } from "@/lib/storage";
import {
  buildDefaultImageAlt,
  buildDefaultImageCaption,
  buildDefaultImageTitle,
  buildSeoPlaceholderSvg,
  seoImageStorageKey,
  type SeoImageFields,
} from "@/lib/seo-images-utils";

export {
  SEO_IMAGE_PLACEHOLDER,
  SEO_IMAGE_WIDTH,
  SEO_IMAGE_HEIGHT,
  SEO_IMAGE_ACCEPTED_TYPES,
  SEO_IMAGE_MAX_BYTES,
  seoImageStorageKey,
  resolveSeoImageUrl,
  buildDefaultImageAlt,
  buildDefaultImageTitle,
  buildDefaultImageCaption,
  buildSeoPlaceholderSvg,
  validateSeoImageFile,
  extensionForMime,
  buildImageObjectSchema,
  enrichSchemaWithFeaturedImage,
  serializeSeoPageImages,
  type SeoImageFields,
} from "@/lib/seo-images-utils";

export async function generateAndStoreSeoImage(options: {
  pageType: string;
  pageSlug: string;
  headline: string;
  subtitle?: string;
}): Promise<SeoImageFields & { storageKey: string }> {
  const storage = createStorageService();
  const headline = options.headline.trim() || options.pageSlug;
  const subtitle = options.subtitle?.trim() || "Adult Classifieds India";
  const storageKey = seoImageStorageKey(options.pageType, options.pageSlug, "svg");
  const buffer = buildSeoPlaceholderSvg(headline, subtitle);
  const result = await storage.upload(storageKey, buffer, "image/svg+xml");

  return {
    featuredImage: result.url,
    imageAlt: buildDefaultImageAlt(headline, options.pageType),
    imageTitle: buildDefaultImageTitle(headline),
    imageCaption: buildDefaultImageCaption(headline, options.pageType),
    storageKey: result.key,
  };
}

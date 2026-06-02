import { createStorageService } from "@/lib/storage";

export const SEO_IMAGE_PLACEHOLDER = "/brand/logo-icon-dark.svg";

export const SEO_IMAGE_WIDTH = 1200;
export const SEO_IMAGE_HEIGHT = 630;

export const SEO_IMAGE_ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

export const SEO_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type SeoImageFields = {
  featuredImage?: string | null;
  imageAlt?: string | null;
  imageTitle?: string | null;
  imageCaption?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Storage key under uploads/seo/ */
export function seoImageStorageKey(
  pageType: string,
  pageSlug: string,
  ext = "svg",
): string {
  const safeSlug = pageSlug.replace(/\//g, "--");
  return `seo/${pageType}/${safeSlug}.${ext}`;
}

/** Resolve relative upload URLs; fallback to placeholder when missing. */
export function resolveSeoImageUrl(
  url: string | null | undefined,
  siteOrigin?: string,
): string {
  const trimmed = url?.trim();
  if (!trimmed) return SEO_IMAGE_PLACEHOLDER;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/api/upload/file") || trimmed.startsWith("/uploads/")) {
    return siteOrigin ? `${siteOrigin.replace(/\/+$/, "")}${trimmed}` : trimmed;
  }

  if (trimmed.startsWith("seo/")) {
    const apiUrl = `/api/upload/file?key=${encodeURIComponent(trimmed)}`;
    return siteOrigin ? `${siteOrigin.replace(/\/+$/, "")}${apiUrl}` : apiUrl;
  }

  if (trimmed.startsWith("/")) {
    return siteOrigin ? `${siteOrigin.replace(/\/+$/, "")}${trimmed}` : trimmed;
  }

  return SEO_IMAGE_PLACEHOLDER;
}

export function buildDefaultImageAlt(headline: string, pageType: string): string {
  const typeLabel = pageType.replace(/_/g, " ");
  return `${headline} — ${typeLabel} featured image on SecretZa`;
}

export function buildDefaultImageTitle(headline: string): string {
  return headline.slice(0, 120);
}

export function buildDefaultImageCaption(headline: string, pageType: string): string {
  return `Featured image for ${headline} (${pageType.replace(/_/g, " ")} page)`;
}

export function buildSeoPlaceholderSvg(headline: string, subtitle: string): Buffer {
  const title = escapeXml(headline.slice(0, 60));
  const sub = escapeXml(subtitle.slice(0, 80));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0B0B0F"/>
      <stop offset="50%" style="stop-color:#15151D"/>
      <stop offset="100%" style="stop-color:#1E1E2A"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.4"/>
  <text x="600" y="280" text-anchor="middle" fill="#F5F5F7" font-family="system-ui,sans-serif" font-size="48" font-weight="700">${title}</text>
  <text x="600" y="350" text-anchor="middle" fill="#A1A1AA" font-family="system-ui,sans-serif" font-size="28">${sub}</text>
  <text x="600" y="420" text-anchor="middle" fill="#3B82F6" font-family="system-ui,sans-serif" font-size="22" font-weight="600">SecretZa</text>
</svg>`;

  return Buffer.from(svg, "utf-8");
}

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

export function validateSeoImageFile(file: File): string | null {
  if (!SEO_IMAGE_ACCEPTED_TYPES.has(file.type)) {
    return "Only JPG, PNG, WebP, and SVG images are allowed";
  }
  if (file.size > SEO_IMAGE_MAX_BYTES) {
    return "SEO image must be 10MB or smaller";
  }
  return null;
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "jpg";
}

/** Standard ImageObject JSON-LD block for SEO pages. */
export function buildImageObjectSchema(input: {
  imageUrl: string;
  imageAlt: string;
  pageUrl: string;
  width?: number;
  height?: number;
}): object {
  const width = input.width ?? SEO_IMAGE_WIDTH;
  const height = input.height ?? SEO_IMAGE_HEIGHT;
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    url: input.imageUrl,
    contentUrl: input.imageUrl,
    width,
    height,
    name: input.imageAlt,
    description: input.imageAlt,
    caption: input.imageAlt,
    mainEntityOfPage: input.pageUrl,
  };
}

/** Append ImageObject to schema JSON stored in customData. */
export function enrichSchemaWithFeaturedImage(
  customData: string | null | undefined,
  imageUrl: string,
  imageAlt: string,
  pageUrl: string,
): string {
  let parsed: { schemas?: object[] } = {};
  if (customData?.trim()) {
    try {
      parsed = JSON.parse(customData) as { schemas?: object[] };
    } catch {
      parsed = {};
    }
  }

  const schemas = Array.isArray(parsed.schemas) ? [...parsed.schemas] : [];
  schemas.push(
    buildImageObjectSchema({
      imageUrl,
      imageAlt,
      pageUrl,
    }),
  );

  return JSON.stringify({ schemas }, null, 2);
}

export function serializeSeoPageImages(page: SeoImageFields & { title?: string | null; h1?: string | null; pageType?: string }) {
  const headline = page.h1 || page.title || "SecretZa";
  return {
    featuredImage: resolveSeoImageUrl(page.featuredImage),
    imageAlt: page.imageAlt || buildDefaultImageAlt(headline, page.pageType || "page"),
    imageTitle: page.imageTitle || buildDefaultImageTitle(headline),
    imageCaption: page.imageCaption || null,
  };
}

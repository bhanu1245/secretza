import { BASE_URL } from "@/lib/seo-ssr";

export type SharePlatform = "whatsapp" | "telegram" | "facebook" | "twitter" | "copy";

export function absoluteShareUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${BASE_URL}${path}`;
}

export function buildShareUrl(
  platform: Exclude<SharePlatform, "copy">,
  url: string,
  title: string
): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const text = encodeURIComponent(`${title} ${url}`.trim());

  switch (platform) {
    case "whatsapp":
      return `https://wa.me/?text=${text}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
    default:
      return url;
  }
}

export function seoPageShareUrl(canonicalUrl: string | null | undefined, pageSlug: string): string {
  const path = canonicalUrl?.trim() || `/${pageSlug}`;
  return absoluteShareUrl(path.startsWith("/") ? path : `/${path}`);
}

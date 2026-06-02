import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSeoImageUrl } from "@/lib/seo-images";
import { getSeoPagePublicUrl } from "@/lib/seo-public-page";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://SecretZa.com";

/**
 * GET /sitemap-seo-images.xml
 * Google image sitemap for published SEO pages with featured images.
 */
export async function GET() {
  const pages = await db.seoPage.findMany({
    where: {
      isPublished: true,
      noindex: false,
      featuredImage: { not: null },
    },
    select: {
      pageSlug: true,
      pageType: true,
      canonicalUrl: true,
      featuredImage: true,
      imageAlt: true,
      imageTitle: true,
      imageCaption: true,
      title: true,
      updatedAt: true,
    },
    take: 50000,
  });

  const entries = pages
    .filter((page) => page.featuredImage?.trim())
    .map((page) => {
      const publicPath = getSeoPagePublicUrl(page);
      const pageUrl = page.canonicalUrl?.startsWith("http")
        ? page.canonicalUrl
        : `${BASE_URL.replace(/\/+$/, "")}${publicPath}`;
      const imageUrl = resolveSeoImageUrl(page.featuredImage, BASE_URL);
      const absoluteImage = imageUrl.startsWith("http")
        ? imageUrl
        : `${BASE_URL}${imageUrl}`;
      const caption = page.imageCaption || page.imageAlt || page.title || page.pageSlug;
      const title = page.imageTitle || page.title || page.pageSlug;

      return `
  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <lastmod>${page.updatedAt.toISOString()}</lastmod>
    <image:image>
      <image:loc>${escapeXml(absoluteImage)}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
      <image:caption>${escapeXml(caption)}</image:caption>
    </image:image>
  </url>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

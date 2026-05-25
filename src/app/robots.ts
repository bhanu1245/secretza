import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://secretza.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/listing/", "/categories", "/sitemap.xml"],
        disallow: ["/api/", "/admin/", "/_next/", "/account/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

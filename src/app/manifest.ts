import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_ASSETS, BRAND_COLORS } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: "Premium classified marketplace — verified listings, trusted platform.",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.darkBg,
    theme_color: BRAND_COLORS.darkBg,
    icons: [
      {
        src: BRAND_ASSETS.favicon,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: BRAND_ASSETS.icon192,
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: BRAND_ASSETS.icon512,
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

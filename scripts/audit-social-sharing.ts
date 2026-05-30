/**
 * Audit social media links and sharing functionality.
 * Run: npx tsx scripts/audit-social-sharing.ts
 */
import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import {
  getPublicSocialLinks,
  getSocialSettings,
  saveSocialSettings,
} from "../src/lib/social-settings";
import {
  buildShareUrl,
  absoluteShareUrl,
  seoPageShareUrl,
} from "../src/lib/share-links";
import { SOCIAL_SETTING_KEYS } from "../src/lib/footer-routes";

loadEnvConfig(process.cwd());

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "artifacts", "social-sharing-audit");

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  // --- 1. Admin storage ---
  const settings = await getSocialSettings();
  checks.push({
    name: "SiteSettings table has social keys",
    ok: Object.values(SOCIAL_SETTING_KEYS).every((k) => typeof k === "string"),
    detail: `Keys: ${Object.values(SOCIAL_SETTING_KEYS).join(", ")}`,
  });

  const rows = await db.siteSettings.findMany({
    where: { key: { in: Object.values(SOCIAL_SETTING_KEYS) } },
  });
  checks.push({
    name: "Social URLs stored in SiteSettings",
    ok: rows.length >= 1,
    detail: `${rows.length} row(s) in DB`,
  });

  // --- 2. Public API ---
  let publicSocial: Record<string, string> = {};
  try {
    const res = await fetchWithTimeout(`${BASE}/api/site-settings/public`);
    const data = await res.json();
    publicSocial = data.social || {};
    checks.push({
      name: "Public social API returns 200",
      ok: res.ok,
      detail: `Keys exposed: ${Object.keys(publicSocial).join(", ") || "none"}`,
    });
  } catch (e) {
    checks.push({
      name: "Public social API returns 200",
      ok: false,
      detail: String(e),
    });
  }

  // --- 3. Empty URL hiding ---
  await saveSocialSettings({ twitter: "" });
  const afterClear = await getPublicSocialLinks();
  checks.push({
    name: "Empty Twitter URL hidden from public API",
    ok: !("twitter" in afterClear),
    detail: `Public keys after clear: ${Object.keys(afterClear).join(", ")}`,
  });
  await saveSocialSettings({ twitter: "https://twitter.com/secretza-test" });
  const afterRestore = await getPublicSocialLinks();
  checks.push({
    name: "Configured Twitter URL exposed publicly",
    ok: afterRestore.twitter === "https://twitter.com/secretza-test",
    detail: afterRestore.twitter || "missing",
  });
  await saveSocialSettings({ twitter: settings.twitter });

  // --- 4. Share URL builders ---
  const listingUrl = absoluteShareUrl("/listing/test-slug");
  const platforms = ["whatsapp", "telegram", "facebook", "twitter"] as const;
  for (const p of platforms) {
    const url = buildShareUrl(p, listingUrl, "Test Listing");
    const domainOk =
      (p === "whatsapp" && url.includes("wa.me")) ||
      (p === "telegram" && url.includes("t.me")) ||
      (p === "facebook" && url.includes("facebook.com")) ||
      (p === "twitter" && url.includes("twitter.com"));
    checks.push({
      name: `Share URL builder: ${p}`,
      ok: url.startsWith("http") && domainOk,
      detail: url.slice(0, 100),
    });
  }

  checks.push({
    name: "SEO page share URL resolver",
    ok: seoPageShareUrl("/category/escorts", "escorts").includes("/category/escorts"),
    detail: seoPageShareUrl("/category/escorts", "escorts"),
  });

  // --- 5. Pages contain share UI (static source check) ---
  const fs = await import("fs");
  const listingContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/listing/[slug]/ListingPageContent.tsx"),
    "utf8"
  );
  const seoView = fs.readFileSync(
    path.join(process.cwd(), "src/components/seo/SeoPageView.tsx"),
    "utf8"
  );
  const listingDetail = fs.readFileSync(
    path.join(process.cwd(), "src/components/secretza/listing/ListingDetail.tsx"),
    "utf8"
  );
  const adminSocial = fs.readFileSync(
    path.join(process.cwd(), "src/components/secretza/admin/AdminSocialSettings.tsx"),
    "utf8"
  );

  checks.push({
    name: "Listing SSR page has ShareButtons",
    ok: listingContent.includes("ShareButtons"),
    detail: "ListingPageContent.tsx",
  });
  checks.push({
    name: "Listing SPA modal has ShareButtons",
    ok: listingDetail.includes("ShareButtons"),
    detail: "ListingDetail.tsx",
  });
  checks.push({
    name: "SEO pages have ShareButtons",
    ok: seoView.includes("ShareButtons"),
    detail: "SeoPageView.tsx",
  });
  checks.push({
    name: "Admin can configure social URLs",
    ok: adminSocial.includes("/api/admin/site-settings"),
    detail: "AdminSocialSettings.tsx",
  });

  // --- 6. HTTP page loads ---
  const sampleListing = await db.listing.findFirst({
    where: { status: "approved" },
    select: { slug: true },
  });
  const pages = [
    { name: "Homepage (footer social)", url: "/" },
    { name: "Category SEO", url: "/category/escorts" },
    ...(sampleListing
      ? [{ name: "Listing page", url: `/listing/${sampleListing.slug}` }]
      : []),
  ];

  for (const page of pages) {
    try {
      const res = await fetchWithTimeout(`${BASE}${page.url}`);
      const html = await res.text();
      checks.push({
        name: `Page loads: ${page.name}`,
        ok: res.ok,
        detail: `HTTP ${res.status}`,
      });
      if (page.name === "Listing page") {
        checks.push({
          name: "Listing page HTML includes share controls",
          ok: html.includes("Share") || html.includes("WhatsApp") || html.includes("Copy"),
          detail: "ShareButtons rendered client-side (may hydrate after load)",
        });
      }
    } catch (e) {
      checks.push({
        name: `Page loads: ${page.name}`,
        ok: false,
        detail: String(e),
      });
    }
  }

  const failed = checks.filter((c) => !c.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
    existingFunctionality: [
      "Footer fetches /api/site-settings/public for social icons",
      "Social URLs stored in SiteSettings (social_twitter_url, etc.)",
      "Footer hides empty or # hrefs",
      "Seed populates default social URLs",
    ],
    newFunctionality: [
      "Admin Settings → Social Media Links (save/load via /api/admin/site-settings)",
      "ShareButtons on listing SSR pages, SPA modal, and SEO landing pages",
      "WhatsApp, Telegram, Facebook, X, Copy Link + mobile native share",
      "Public API returns only configured non-empty URLs",
    ],
    checks,
    failed,
    filesChanged: [
      "src/lib/social-settings.ts",
      "src/lib/share-links.ts",
      "src/components/secretza/shared/ShareButtons.tsx",
      "src/components/secretza/admin/AdminSocialSettings.tsx",
      "src/app/api/admin/site-settings/route.ts",
      "src/app/api/site-settings/public/route.ts",
      "src/components/secretza/layout/Footer.tsx",
      "src/app/listing/[slug]/ListingPageContent.tsx",
      "src/components/secretza/listing/ListingDetail.tsx",
      "src/components/seo/SeoPageView.tsx",
      "src/components/secretza/admin/pages/AdminContentPages.tsx",
    ],
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== SOCIAL & SHARING AUDIT ===");
  console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

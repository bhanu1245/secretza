/**
 * Capture SEO Regeneration simulation screenshots.
 * Usage: bun run scripts/capture-seo-regeneration-screenshot.ts
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "artifacts", "seo-regeneration-sim-10");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    timeout: 120000,
    channel: "msedge",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const regenLink = page.getByText("SEO Regeneration", { exact: true });
  if (await regenLink.count()) {
    await regenLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT, "admin-seo-regeneration-panel.png"),
      fullPage: true,
    });
  }

  const auditLink = page.getByText("SEO Audit", { exact: true });
  if (await auditLink.count()) {
    await auditLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT, "admin-seo-audit-panel.png"),
      fullPage: true,
    });
  }

  // Sample public city page (Agra — v3 regenerated)
  await page.goto(`${BASE}/india/uttar-pradesh/agra`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(OUT, "public-city-agra.png"),
    fullPage: false,
  });

  console.log(`Screenshots saved to ${OUT}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

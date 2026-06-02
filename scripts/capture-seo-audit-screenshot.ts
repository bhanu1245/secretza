/**
 * Capture SEO Audit admin panel screenshots.
 * Usage: bun run scripts/capture-seo-audit-screenshot.ts
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "artifacts", "seo-audit-screenshots");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|admin/, { timeout: 15000 }).catch(() => {});

  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(2000);

  const auditLink = page.getByText("SEO Audit", { exact: true });
  if (await auditLink.count()) {
    await auditLink.click();
  } else {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("admin-nav", { detail: "seo-audit" }));
    });
  }

  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(OUT, "seo-audit-panel.png"), fullPage: true });

  const mumbaiCard = page.getByText("mumbai").first();
  if (await mumbaiCard.count()) {
    await mumbaiCard.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "seo-audit-mumbai-expanded.png"), fullPage: true });
  }

  console.log(`Screenshots saved to ${OUT}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

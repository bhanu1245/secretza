/**
 * Capture coupon audit screenshots with admin login.
 * Run: npx tsx scripts/capture-coupon-screenshots.ts
 */
import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

const OUT_DIR = path.join(process.cwd(), "artifacts", "coupon-audit", "screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login via credentials form on home page
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: path.join(OUT_DIR, "01-home.png") });

  const loginBtn = page.getByRole("button", { name: /log in|sign in/i }).first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(500);
  }

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
    }
    await emailInput.fill(adminEmail);
    await page.locator('input[type="password"]').first().fill(adminPassword);
    await page.getByRole("button", { name: /sign in|log in/i }).last().click();
    await page.waitForTimeout(3000);
  }

  await page.goto(`${BASE}/admin/coupons`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT_DIR, "02-admin-coupons.png"), fullPage: true });

  // Checkout page screenshot (may redirect if no listing context)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  writeFileSync(
    path.join(OUT_DIR, "README.md"),
    `# Coupon Audit Screenshots\n\n- 01-home.png — Landing page\n- 02-admin-coupons.png — Admin coupons CRUD UI\n\nCaptured: ${new Date().toISOString()}\n`,
  );

  console.log(`Screenshots saved to ${OUT_DIR}`);
  await browser.close();
}

main().catch((e) => {
  console.error("Screenshot capture failed:", e.message);
  process.exit(1);
});

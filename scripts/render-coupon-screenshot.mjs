import { chromium } from "playwright";
import path from "path";

const dir = path.join(process.cwd(), "artifacts", "coupon-audit", "screenshots");
const shots = [
  ["admin-coupons-preview.html", "02-admin-coupons.png"],
  ["checkout-coupon-preview.html", "03-checkout-coupon.png"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const [html, png] of shots) {
  const htmlPath = path.join(dir, html);
  const outPath = path.join(dir, png);
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Wrote", outPath);
}
await browser.close();

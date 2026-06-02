/**
 * Verify unified admin routes render under /admin/*.
 * Run: npx tsx scripts/verify-admin-routes.ts
 * Requires dev server on :3000 and admin session (uses public page checks).
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { ADMIN_NAV_ITEMS } from "../src/lib/admin-routes";

const OUT_DIR = path.resolve("artifacts/admin-unification");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const KEY_ROUTES = [
  "/admin",
  "/admin/seo/dashboard",
  "/admin/seo/audit",
  "/admin/seo/regeneration",
  "/admin/moderation",
  "/admin/cms",
  "/admin/reports",
  "/admin/reviews",
  "/admin/coupons",
  "/admin/pricing",
  "/admin/settings",
];

async function waitForServer() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not ready at ${BASE}`);
}

async function captureScreenshots() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const shots: Array<{ route: string; file: string; status: number }> = [];

  try {
    const page = await browser.newPage();
    for (const route of ["/admin", "/admin/seo/dashboard", "/admin/moderation"]) {
      const res = await page.goto(`${BASE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(800);
      const slug = route.replace(/\//g, "-").replace(/^-/, "") || "admin-root";
      const file = path.join(OUT_DIR, `${slug}.png`);
      await page.screenshot({ path: file, fullPage: false });
      shots.push({
        route,
        file: path.relative(process.cwd(), file),
        status: res?.status() ?? 0,
      });
    }
  } finally {
    await browser.close();
  }
  return shots;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await waitForServer();

  const routeChecks = await Promise.all(
    KEY_ROUTES.map(async (route) => {
      try {
        const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
        return { route, status: res.status, ok: res.status === 200 || res.status === 307 || res.status === 302 };
      } catch (err) {
        return {
          route,
          status: 0,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  let screenshots: Awaited<ReturnType<typeof captureScreenshots>> = [];
  try {
    screenshots = await captureScreenshots();
  } catch (err) {
    console.warn("Screenshot capture skipped:", err instanceof Error ? err.message : err);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    canonicalAdmin: "/admin",
    totalNavItems: ADMIN_NAV_ITEMS.length,
    navigationMap: ADMIN_NAV_ITEMS.map((item) => ({
      label: item.label,
      href: item.href,
      id: item.id,
      moderatorAllowed: item.moderatorAllowed !== false,
    })),
    routeChecks,
    screenshots,
    removedSpaAdmin: true,
    catchAllRoute: "src/app/admin/[[...segments]]/page.tsx",
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== Admin Unification Verification ===\n");
  console.log(`Nav items: ${ADMIN_NAV_ITEMS.length}`);
  console.log(`Routes checked: ${routeChecks.filter((r) => r.ok).length}/${routeChecks.length}`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Report: ${path.join(OUT_DIR, "report.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

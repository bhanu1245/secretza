/**
 * Logo rollout audit — maps UI surfaces to rendered assets, captures before/after screenshots.
 * Run: npx tsx scripts/audit-logo-rollout.ts
 */
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import path from "path";
import { chromium } from "playwright";

loadEnvConfig(process.cwd());

const ROOT = process.cwd();
const OUT = path.join(ROOT, "artifacts", "logo-rollout");
const BASE = process.env.BASE_URL || "http://localhost:3000";

type Surface = {
  id: string;
  label: string;
  component: string;
  renderSource: string;
  staticAsset: string | null;
  url: string | null;
  selector: string;
  notes: string;
};

const SURFACES: Surface[] = [
  {
    id: "header",
    label: "Header (desktop)",
    component: "src/components/secretza/layout/Header.tsx",
    renderSource: "Logo variant=full → LogoIcon (LogoMark.tsx inline SVG)",
    staticAsset: null,
    url: "/",
    selector: "header a[href='/'] svg, header .shrink-0 svg",
    notes: "Full wordmark hidden below sm; icon always visible",
  },
  {
    id: "footer",
    label: "Footer",
    component: "src/components/secretza/layout/Footer.tsx",
    renderSource: "Logo variant=full → LogoMark + BrandWordmark",
    staticAsset: null,
    url: "/",
    selector: "footer svg",
    notes: "Scroll to footer for capture",
  },
  {
    id: "mobile-header",
    label: "Mobile header / sheet",
    component: "src/components/secretza/layout/Header.tsx",
    renderSource: "Logo variant=mobile in mobile sheet",
    staticAsset: null,
    url: "/",
    selector: "[data-slot='sheet-content'] svg",
    notes: "Requires mobile viewport + menu open",
  },
  {
    id: "admin-sidebar",
    label: "Admin sidebar",
    component: "src/components/secretza/admin/routes/AdminShell.tsx",
    renderSource: "Logo variant=icon iconSize=32 → LogoMark",
    staticAsset: null,
    url: "/admin",
    selector: "aside svg",
    notes: "Requires admin session",
  },
  {
    id: "auth-modal",
    label: "Login / Register",
    component: "src/components/secretza/auth/AuthModal.tsx",
    renderSource: "Logo variant=icon iconSize=44 → LogoMark",
    staticAsset: null,
    url: "/?auth=login",
    selector: "[role='dialog'] svg",
    notes: "Auth modal via ?auth=login if supported, else homepage",
  },
  {
    id: "email",
    label: "Email templates",
    component: "src/lib/email.ts",
    renderSource: "emailBrandHeader() → img src BRAND_ASSETS.logoIconDark",
    staticAsset: "public/brand/logo-icon-dark.svg",
    url: null,
    selector: "",
    notes: "Static SVG served at /brand/logo-icon-dark.svg",
  },
  {
    id: "favicon",
    label: "Favicon / tab icon",
    component: "src/app/layout.tsx",
    renderSource: "metadata.icons → BRAND_ASSETS.favicon",
    staticAsset: "public/brand/favicon.svg",
    url: "/brand/favicon.svg",
    selector: "body",
    notes: "Also src/app/icon.svg for Next.js",
  },
  {
    id: "og-image",
    label: "Social / OG image",
    component: "src/app/layout.tsx",
    renderSource: "openGraph.images → BRAND_ASSETS.ogImage",
    staticAsset: "public/brand/og-image.svg",
    url: "/brand/og-image.svg",
    selector: "body",
    notes: "1200×630 share card",
  },
  {
    id: "not-found",
    label: "404 page",
    component: "src/app/not-found.tsx",
    renderSource: "img src={BRAND_ASSETS.logoIconDark}",
    staticAsset: "public/brand/logo-icon-dark.svg",
    url: "/this-page-does-not-exist-secretza",
    selector: "img[alt='SecretZa']",
    notes: "Static asset reference",
  },
];

function fileHasShieldSvg(file: string): boolean {
  if (!existsSync(file)) return false;
  const c = readFileSync(file, "utf8");
  return c.includes("#7C3AED") && c.includes("M32 6 C32 6 50 10");
}

function logoMarkSourceCheck(): boolean {
  const src = readFileSync(path.join(ROOT, "src/components/brand/LogoMark.tsx"), "utf8");
  return src.includes("Premium SecretZa mark") && src.includes("#7C3AED");
}

async function captureScreenshots(serverUp: boolean) {
  const shotsDir = path.join(OUT, "screenshots");
  mkdirSync(shotsDir, { recursive: true });

  if (!serverUp) {
    console.log("Dev server offline — skipping live screenshots");
    return { captured: [] as string[], skipped: SURFACES.filter((s) => s.url).map((s) => s.id) };
  }

  const browser = await chromium.launch({ headless: true });
  const captured: string[] = [];
  const skipped: string[] = [];

  try {
    const page = await browser.newPage();

    // Homepage header + footer
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
    const headerSvg = page.locator("header").locator("svg").first();
    if (await headerSvg.count()) {
      await headerSvg.screenshot({ path: path.join(shotsDir, "after-header.png") });
      captured.push("after-header.png");
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footerSvg = page.locator("footer").locator("svg").first();
    if (await footerSvg.count()) {
      await footerSvg.screenshot({ path: path.join(shotsDir, "after-footer.png") });
      captured.push("after-footer.png");
    }

    // Mobile menu
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
    const menuBtn = page.locator("header button").filter({ has: page.locator("svg") }).first();
    if (await menuBtn.count()) {
      await menuBtn.click();
      await page.waitForTimeout(600);
      const mobileSvg = page.locator("[data-slot='sheet-content'] svg").first();
      if (await mobileSvg.count()) {
        await mobileSvg.screenshot({ path: path.join(shotsDir, "after-mobile-header.png") });
        captured.push("after-mobile-header.png");
      } else skipped.push("mobile-header");
    }

    // Static assets
    for (const asset of ["favicon.svg", "logo-icon-dark.svg", "logo-full-dark.svg"]) {
      await page.setViewportSize({ width: 400, height: 400 });
      await page.goto(`${BASE}/brand/${asset}`, { waitUntil: "load", timeout: 15000 });
      await page.screenshot({ path: path.join(shotsDir, `after-${asset.replace(".svg", "")}.png`), fullPage: false, timeout: 10000 });
      captured.push(`after-${asset.replace(".svg", "")}.png`);
    }
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(`${BASE}/brand/og-image.svg`, { waitUntil: "load", timeout: 15000 });
    await page.screenshot({ path: path.join(shotsDir, "after-og-image.png"), fullPage: false, timeout: 10000 });
    captured.push("after-og-image.png");

    // 404
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto(`${BASE}/this-page-does-not-exist-secretza`, { waitUntil: "networkidle", timeout: 15000 });
    const nf = page.locator("img[alt='SecretZa']").first();
    if (await nf.count()) {
      await nf.screenshot({ path: path.join(shotsDir, "after-not-found.png") });
      captured.push("after-not-found.png");
    }

    // Before comparisons from backed-up SVGs rendered in HTML
    const beforeHtml = `<!DOCTYPE html><html><body style="background:#0B0B0F;margin:0;padding:2rem;display:flex;gap:2rem;flex-wrap:wrap">
      ${["logo-icon-dark.svg", "logo-full-dark.svg", "favicon.svg"].map((f) => {
        const p = path.join(OUT, "before", f);
        if (!existsSync(p)) return "";
        const svg = readFileSync(p, "utf8");
        return `<div style="text-align:center"><p style="color:#94a3b8;font-family:system-ui">${f}</p>${svg}</div>`;
      }).join("")}
    </body></html>`;
    writeFileSync(path.join(OUT, "before-preview.html"), beforeHtml);
    await page.goto(`file:///${path.join(OUT, "before-preview.html").replace(/\\/g, "/")}`, { timeout: 10000 });
    await page.screenshot({ path: path.join(shotsDir, "before-assets-comparison.png"), fullPage: false, timeout: 10000 });
    captured.push("before-assets-comparison.png");

    // After assets comparison
    const afterHtml = `<!DOCTYPE html><html><body style="background:#0B0B0F;margin:0;padding:2rem;display:flex;gap:2rem;flex-wrap:wrap">
      ${["logo-icon-dark.svg", "logo-full-dark.svg", "favicon.svg"].map((f) => {
        const svg = readFileSync(path.join(ROOT, "public/brand", f), "utf8");
        return `<div style="text-align:center"><p style="color:#94a3b8;font-family:system-ui">${f}</p>${svg}</div>`;
      }).join("")}
    </body></html>`;
    writeFileSync(path.join(OUT, "after-preview.html"), afterHtml);
    await page.goto(`file:///${path.join(OUT, "after-preview.html").replace(/\\/g, "/")}`, { timeout: 10000 });
    await page.screenshot({ path: path.join(shotsDir, "after-assets-comparison.png"), fullPage: false, timeout: 10000 });
    captured.push("after-assets-comparison.png");
  } finally {
    await browser.close();
  }

  return { captured, skipped };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  let serverUp = false;
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }

  const assetChecks = [
    "public/brand/logo-icon-dark.svg",
    "public/brand/logo-full-dark.svg",
    "public/brand/logo-mobile-dark.svg",
    "public/brand/favicon.svg",
    "public/brand/og-image.svg",
    "public/brand/icon-192.svg",
    "public/brand/icon-512.svg",
    "public/logo.svg",
    "src/app/icon.svg",
  ].map((rel) => ({
    file: rel,
    premium: fileHasShieldSvg(path.join(ROOT, rel)),
  }));

  const checks = {
    logoMarkComponent: logoMarkSourceCheck(),
    allStaticAssetsPremium: assetChecks.every((a) => a.premium),
    assets: assetChecks,
  };

  const { captured, skipped } = await captureScreenshots(serverUp);

  const uiFilesUsed = [
    { surface: "Header", files: ["src/components/secretza/layout/Header.tsx", "src/components/brand/Logo.tsx", "src/components/brand/LogoIcon.tsx", "src/components/brand/LogoMark.tsx", "src/components/brand/BrandWordmark.tsx"] },
    { surface: "Footer", files: ["src/components/secretza/layout/Footer.tsx", "src/components/brand/Logo.tsx", "src/components/brand/LogoMark.tsx", "src/components/brand/BrandWordmark.tsx"] },
    { surface: "Mobile header sheet", files: ["src/components/secretza/layout/Header.tsx", "src/components/brand/Logo.tsx (variant=mobile)"] },
    { surface: "Admin sidebar", files: ["src/components/secretza/admin/routes/AdminShell.tsx", "src/components/brand/Logo.tsx (variant=icon)"] },
    { surface: "Dashboard mobile nav", files: ["src/components/secretza/dashboard/Dashboard.tsx", "src/components/brand/Logo.tsx (variant=mobile)"] },
    { surface: "Auth modal", files: ["src/components/secretza/auth/AuthModal.tsx", "src/components/brand/Logo.tsx (variant=icon)"] },
    { surface: "CMS pages", files: ["src/components/secretza/cms/CmsPageContent.tsx", "src/components/brand/Logo.tsx (variant=mobile)"] },
    { surface: "Emails", files: ["src/lib/email.ts", "src/lib/brand.ts", "public/brand/logo-icon-dark.svg"] },
    { surface: "Favicon / metadata", files: ["src/app/layout.tsx", "src/app/icon.svg", "public/brand/favicon.svg"] },
    { surface: "404 / global error", files: ["src/app/not-found.tsx", "src/app/global-error.tsx", "public/brand/logo-icon-dark.svg"] },
    { surface: "PWA manifest", files: ["src/app/manifest.ts", "public/brand/icon-192.svg", "public/brand/icon-512.svg"] },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      premiumLogoMarkInReact: checks.logoMarkComponent,
      allStaticAssetsUpdated: checks.allStaticAssetsPremium,
      serverUp,
      screenshotsCaptured: captured.length,
    },
    finding: {
      rootCause: "Header/Footer/Admin/Auth render LogoIcon inline SVG (LogoMark.tsx), NOT public/brand/*.svg. Old design persisted because LogoIcon.tsx was never updated to the premium mark.",
      resolution: "LogoMark.tsx is now the single React source; public/brand/* synced via scripts/generate-brand-assets.mjs",
    },
    surfaces: SURFACES,
    uiFilesUsed,
    assetChecks: checks.assets,
    screenshots: captured.map((f) => `artifacts/logo-rollout/screenshots/${f}`),
    skippedScreenshots: skipped,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>SecretZa Logo Rollout Audit</title>
<style>
:root{--bg:#0B0B0F;--surface:#15151D;--border:rgba(255,255,255,.08);--text:#F5F5F7;--muted:#94a3b8;--blue:#3B82F6;--violet:#6366F1}
body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:2rem;line-height:1.5}
h1{background:linear-gradient(135deg,var(--blue),var(--violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pass{color:#34d399}.fail{color:#f87171}
table{width:100%;border-collapse:collapse;font-size:14px;margin:1rem 0}
th,td{border:1px solid var(--border);padding:.5rem;text-align:left;vertical-align:top}
th{background:var(--surface)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin:1.5rem 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem}
.card img{max-width:100%;border-radius:8px;background:#0B0B0F}
code{font-size:12px;color:var(--muted)}
.box{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);border-radius:12px;padding:1rem;margin:1rem 0}
</style></head><body>
<h1>SecretZa Logo Rollout Audit</h1>
<p style="color:var(--muted)">${report.generatedAt}</p>
<div class="box">
  <strong>Finding:</strong> ${report.finding.rootCause}<br/>
  <strong>Resolution:</strong> ${report.finding.resolution}
</div>
<p>Premium mark in React: <span class="${checks.logoMarkComponent ? "pass" : "fail"}">${checks.logoMarkComponent ? "YES" : "NO"}</span> ·
Static assets updated: <span class="${checks.allStaticAssetsPremium ? "pass" : "fail"}">${checks.allStaticAssetsPremium ? "YES" : "NO"}</span></p>

<h2>Where the logo is rendered</h2>
<table><tr><th>Surface</th><th>Component</th><th>Actual render source</th><th>Static asset</th></tr>
${SURFACES.map((s) => `<tr><td>${s.label}</td><td><code>${s.component}</code></td><td>${s.renderSource}</td><td>${s.staticAsset ?? "—"}</td></tr>`).join("")}
</table>

<h2>UI files used</h2>
<table><tr><th>Surface</th><th>Files</th></tr>
${uiFilesUsed.map((u) => `<tr><td>${u.surface}</td><td>${u.files.map((f) => `<code>${f}</code>`).join("<br/>")}</td></tr>`).join("")}
</table>

<h2>Before / After</h2>
<div class="grid">
  <div class="card"><h3>Before (old SZ monogram)</h3>
  ${existsSync(path.join(OUT,"before","logo-icon-dark.svg")) ? `<img src="../before/logo-icon-dark.svg" width="120" alt="before"/>` : "<p>See before/ folder</p>"}
  <p><code>artifacts/logo-rollout/before/</code></p></div>
  <div class="card"><h3>After (premium shield + silhouette)</h3>
  <img src="../../public/brand/logo-icon-dark.svg" width="120" alt="after"/>
  <p><code>LogoMark.tsx + public/brand/*</code></p></div>
</div>

<h2>Screenshots</h2>
<div class="grid">
${captured.map((f) => `<div class="card"><h3>${f}</h3><img src="screenshots/${f}" alt="${f}"/></div>`).join("")}
${captured.length === 0 ? "<p>No live screenshots — start dev server and re-run audit.</p>" : ""}
</div>
</body></html>`;

  writeFileSync(path.join(OUT, "report.html"), html);

  console.log("\n=== LOGO ROLLOUT AUDIT ===");
  console.log(`Premium LogoMark: ${checks.logoMarkComponent ? "PASS" : "FAIL"}`);
  console.log(`Static assets: ${checks.allStaticAssetsPremium ? "PASS" : "FAIL"}`);
  console.log(`Screenshots: ${captured.length}`);
  console.log(`Report: ${path.join(OUT, "report.html")}`);

  if (!checks.logoMarkComponent || !checks.allStaticAssetsPremium) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

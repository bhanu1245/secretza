/**
 * SecretZa branding audit — assets, naming, and placement verification.
 * Run: npx tsx scripts/audit-logo-branding.ts
 */
import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { BRAND_NAME, BRAND_ASSETS, BRAND_COLORS } from "../src/lib/brand";

loadEnvConfig(process.cwd());

const ROOT = process.cwd();
const OUT = path.join(ROOT, "artifacts", "logo-audit");
const SRC = path.join(ROOT, "src");

type Check = { name: string; ok: boolean; detail: string };

function walkTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walkTsFiles(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  // Brand name constant
  checks.push({
    name: "BRAND_NAME is SecretZa",
    ok: BRAND_NAME === "SecretZa",
    detail: BRAND_NAME,
  });

  checks.push({
    name: "Primary color #3B82F6",
    ok: BRAND_COLORS.primary === "#3B82F6",
    detail: BRAND_COLORS.primary,
  });

  checks.push({
    name: "Secondary color #6366F1",
    ok: BRAND_COLORS.secondary === "#6366F1",
    detail: BRAND_COLORS.secondary,
  });

  // SVG assets
  const requiredAssets = [
    "logo-full-dark.svg",
    "logo-full-light.svg",
    "logo-icon-dark.svg",
    "logo-icon-light.svg",
    "logo-mobile-dark.svg",
    "favicon.svg",
    "og-image.svg",
    "icon-192.svg",
    "icon-512.svg",
  ];

  for (const file of requiredAssets) {
    const p = path.join(ROOT, "public", "brand", file);
    checks.push({
      name: `Asset exists: ${file}`,
      ok: existsSync(p),
      detail: p,
    });
    if (existsSync(p)) {
      const svg = readFileSync(p, "utf8");
      checks.push({
        name: `${file} contains brand gradient`,
        ok: svg.includes("#3B82F6") && svg.includes("#6366F1"),
        detail: "gradient colors present",
      });
    }
  }

  checks.push({
    name: "Next.js app icon.svg",
    ok: existsSync(path.join(SRC, "app", "icon.svg")),
    detail: "src/app/icon.svg",
  });

  checks.push({
    name: "Web manifest configured",
    ok: existsSync(path.join(SRC, "app", "manifest.ts")),
    detail: "src/app/manifest.ts",
  });

  // Component usage
  const componentFiles = [
    "src/components/brand/Logo.tsx",
    "src/components/brand/LogoIcon.tsx",
    "src/components/brand/BrandWordmark.tsx",
    "src/components/secretza/layout/Header.tsx",
    "src/components/secretza/layout/Footer.tsx",
    "src/components/secretza/admin/routes/AdminShell.tsx",
    "src/components/secretza/dashboard/Dashboard.tsx",
    "src/components/secretza/auth/AuthModal.tsx",
  ];

  for (const rel of componentFiles) {
    const content = readFileSync(path.join(ROOT, rel), "utf8");
    const usesLogo =
      content.includes("Logo") ||
      content.includes("BrandWordmark") ||
      content.includes("LogoIcon");
    checks.push({
      name: `Logo component in ${path.basename(rel)}`,
      ok: usesLogo || rel.includes("Logo"),
      detail: rel,
    });
  }

  // Wrong casing scan (user-facing src only, exclude domain emails)
  const srcFiles = walkTsFiles(SRC);
  const wrongNameHits: string[] = [];
  for (const file of srcFiles) {
    const rel = path.relative(ROOT, file);
    const content = readFileSync(file, "utf8");
    if (/\bSecretza\b/.test(content)) {
      wrongNameHits.push(rel);
    }
  }

  checks.push({
    name: "No legacy 'Secretza' in src (display name)",
    ok: wrongNameHits.length === 0,
    detail: wrongNameHits.length
      ? wrongNameHits.slice(0, 10).join(", ")
      : "clean",
  });

  // Email branding
  const email = readFileSync(path.join(SRC, "lib", "email.ts"), "utf8");
  checks.push({
    name: "Email templates use SecretZa",
    ok: email.includes("BRAND_NAME") && email.includes("emailBrandHeader"),
    detail: "email.ts",
  });

  // Favicon viewBox (retina / small size)
  const favicon = readFileSync(path.join(ROOT, "public", "brand", "favicon.svg"), "utf8");
  checks.push({
    name: "Favicon optimized viewBox 32x32",
    ok: favicon.includes('viewBox="0 0 32 32"'),
    detail: "32x32 vector — scales to 16/32/48",
  });

  const failed = checks.filter((c) => !c.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    brandName: BRAND_NAME,
    colors: BRAND_COLORS,
    assets: BRAND_ASSETS,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
    checks,
    failed,
    filesChanged: [
      "src/lib/brand.ts",
      "src/components/brand/Logo.tsx",
      "src/components/brand/LogoIcon.tsx",
      "src/components/brand/BrandWordmark.tsx",
      "public/brand/*.svg",
      "public/logo.svg",
      "src/app/icon.svg",
      "src/app/manifest.ts",
      "src/app/layout.tsx",
      "src/app/globals.css",
      "src/components/secretza/layout/Header.tsx",
      "src/components/secretza/layout/Footer.tsx",
      "src/components/secretza/admin/routes/AdminShell.tsx",
      "src/components/secretza/dashboard/Dashboard.tsx",
      "src/components/secretza/auth/AuthModal.tsx",
      "src/lib/email.ts",
      "src/app/not-found.tsx",
      "src/app/global-error.tsx",
    ],
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SecretZa Logo Audit</title>
<style>
body{font-family:system-ui;max-width:960px;margin:2rem auto;padding:0 1rem;background:#0B0B0F;color:#F5F5F7}
.pass{color:#34d399}.fail{color:#f87171}
h1{background:linear-gradient(135deg,#3B82F6,#6366F1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1rem;margin:1.5rem 0}
.card{background:#15151D;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:1rem;text-align:center}
.card img{max-width:100%;height:auto}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{border:1px solid #333;padding:.5rem;font-size:14px;text-align:left}
</style></head><body>
<h1>SecretZa Branding Audit</h1>
<p>Generated: ${report.generatedAt}</p>
<p>Passed: <span class="pass">${report.summary.passed}</span> / ${report.summary.total}</p>
<h2>Logo Previews</h2>
<div class="grid">
  <div class="card"><img src="/brand/logo-icon-dark.svg" alt="Icon dark" width="64"/><p>Icon Dark</p></div>
  <div class="card"><img src="/brand/logo-full-dark.svg" alt="Full dark" width="180"/><p>Full Dark</p></div>
  <div class="card" style="background:#fff"><img src="/brand/logo-full-light.svg" alt="Full light" width="180"/><p>Full Light</p></div>
  <div class="card"><img src="/brand/favicon.svg" alt="Favicon" width="32"/><p>Favicon 32px</p></div>
</div>
<h2>Checks</h2>
<table><tr><th>Check</th><th>Status</th><th>Detail</th></tr>
${checks.map((c) => `<tr><td>${c.name}</td><td class="${c.ok ? "pass" : "fail"}">${c.ok ? "PASS" : "FAIL"}</td><td>${c.detail}</td></tr>`).join("")}
</table>
</body></html>`;

  writeFileSync(path.join(OUT, "report.html"), html);

  console.log("\n=== SECRETZA BRANDING AUDIT ===");
  console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log(`Report: ${path.join(OUT, "report.json")}`);
}

main();

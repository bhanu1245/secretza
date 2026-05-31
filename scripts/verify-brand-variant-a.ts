/**
 * Brand Variant A — Verification + Report Generator
 *
 * Validates that the location-pin logo was fully replaced by the
 * "Classic Serif Bold" SZ monogram across components and static assets,
 * then emits:
 *   - artifacts/brand-variant-a/report.json        (structural checks)
 *   - artifacts/brand-variant-a/visual-report.html (rendered previews)
 *   - artifacts/brand-variant-a/favicon-report.html (16/32/64 favicon proof)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const BRAND = path.join(ROOT, "public", "brand");
const OUT = path.join(ROOT, "artifacts", "brand-variant-a");
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];
const add = (name: string, pass: boolean, detail?: string) =>
  checks.push({ name, pass, detail });

function read(rel: string): string {
  const p = path.join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

// ── Legacy artifacts that must NOT appear anywhere ──────────────────────────
const TEARDROP = "M32 6 C32 6 50 10 50 24"; // the old location-pin path
const BLUR = "feGaussianBlur";
const GRADIENT = "linearGradient";

const staticAssets = [
  "public/brand/favicon.svg",
  "public/brand/logo-icon-dark.svg",
  "public/brand/logo-icon-light.svg",
  "public/brand/logo-full-dark.svg",
  "public/brand/logo-full-light.svg",
  "public/brand/logo-mobile-dark.svg",
  "public/brand/icon-192.svg",
  "public/brand/icon-512.svg",
  "public/brand/og-image.svg",
  "public/logo.svg",
  "src/app/icon.svg",
];

for (const rel of staticAssets) {
  const svg = read(rel);
  add(`${rel} exists`, svg.length > 0);
  if (!svg) continue;
  add(`${rel} — no location-pin path`, !svg.includes(TEARDROP));
  add(`${rel} — no gaussian blur`, !svg.includes(BLUR));
  // og-image is allowed to be monochrome too; none should carry gradients now
  add(`${rel} — monochrome (no gradient)`, !svg.includes(GRADIENT));
}

// ── Icon-bearing assets must contain the rounded-square + SZ monogram ───────
const monogramAssets = [
  "public/brand/favicon.svg",
  "public/brand/logo-icon-dark.svg",
  "public/brand/logo-icon-light.svg",
  "public/brand/icon-192.svg",
  "public/brand/icon-512.svg",
  "src/app/icon.svg",
  "public/logo.svg",
];
for (const rel of monogramAssets) {
  const svg = read(rel);
  if (!svg) continue;
  add(`${rel} — rounded-square tile (rx="8")`, /rx="8"/.test(svg));
  add(`${rel} — bold SZ monogram`, />SZ<\/text>/.test(svg) && /font-weight="700"/.test(svg));
  add(`${rel} — serif typeface`, /Georgia/.test(svg));
}

// ── Theme correctness ───────────────────────────────────────────────────────
const dark = read("public/brand/logo-icon-dark.svg");
const light = read("public/brand/logo-icon-light.svg");
add("dark icon — dark tile + white ink", /fill="#0B0B0F"/.test(dark) && /fill="#FFFFFF"/.test(dark));
add("light icon — light tile + dark ink", /fill="#FFFFFF"/.test(light) && /fill="#0B0B0F"/.test(light));

// ── Wordmark assets ─────────────────────────────────────────────────────────
const full = read("public/brand/logo-full-dark.svg");
add("full logo — SECRETZA serif wordmark", />SECRETZA<\/text>/.test(full) && /Georgia/.test(full));

// ── Component source checks ─────────────────────────────────────────────────
const logoMark = read("src/components/brand/LogoMark.tsx");
add("LogoMark.tsx — renders SZ", /SZ/.test(logoMark));
add("LogoMark.tsx — serif stack", /Georgia/.test(logoMark));
add("LogoMark.tsx — rounded-square rx=8", /rx="8"/.test(logoMark));
add("LogoMark.tsx — no teardrop path", !logoMark.includes(TEARDROP));
add("LogoMark.tsx — no gaussian blur", !logoMark.includes(BLUR));
add("LogoMark.tsx — theme-aware (dark/light tile)", /darkBg/.test(logoMark) && /lightBg/.test(logoMark));
add("LogoMark.tsx — preserves idPrefix prop (API compat)", /idPrefix\?: string/.test(logoMark));

const wordmark = read("src/components/brand/BrandWordmark.tsx");
add("BrandWordmark.tsx — serif", /font-serif/.test(wordmark));
add("BrandWordmark.tsx — uppercase caps", /uppercase/.test(wordmark));
add("BrandWordmark.tsx — monochrome (no hardcoded blue)", !/#3B82F6/.test(wordmark));

const globals = read("src/app/globals.css");
add("globals.css — --font-serif token registered", /--font-serif/.test(globals));

// ── Summary ─────────────────────────────────────────────────────────────────
const passed = checks.filter((c) => c.pass).length;
const failed = checks.length - passed;

const report = {
  variant: "A — Classic Serif Bold",
  date: new Date().toISOString(),
  result: failed === 0 ? "PASS" : "FAIL",
  passed,
  failed,
  total: checks.length,
  checks,
};
writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

// ── Visual HTML report ──────────────────────────────────────────────────────
const faviconSvg = read("public/brand/favicon.svg");
const iconDarkSvg = read("public/brand/logo-icon-dark.svg");
const iconLightSvg = read("public/brand/logo-icon-light.svg");
const fullDarkSvg = read("public/brand/logo-full-dark.svg");
const fullLightSvg = read("public/brand/logo-full-light.svg");
const ogSvg = read("public/brand/og-image.svg");
const beforeFavicon = read("artifacts/logo-rollout/before/favicon.svg");

function sized(svg: string, px: number): string {
  // strip width/height attrs so the wrapper controls the rendered size
  const cleaned = svg.replace(/\s(width|height)="[^"]*"/g, "");
  return `<span style="display:inline-flex;width:${px}px;height:${px}px">${cleaned}</span>`;
}
function sizedFull(svg: string, h: number): string {
  const cleaned = svg.replace(/\s(width|height)="[^"]*"/g, "");
  return `<span style="display:inline-flex;height:${h}px">${cleaned}</span>`;
}

const css = `
  body{margin:0;font-family:system-ui,sans-serif;background:#0d0d12;color:#e5e5ea}
  h1{font-weight:700;letter-spacing:-.02em}
  .wrap{max-width:1000px;margin:0 auto;padding:32px}
  .grid{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end}
  .cell{display:flex;flex-direction:column;align-items:center;gap:8px}
  .lbl{font-size:11px;color:#8a8a99;letter-spacing:.06em}
  .panel{padding:18px;border-radius:12px;border:1px solid #23232e}
  .dark{background:#0B0B0F}
  .light{background:#FFFFFF}
  .row{display:flex;gap:24px;flex-wrap:wrap;margin:14px 0 30px}
  .badge{display:inline-block;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600}
  .ok{background:#0f3d2e;color:#4ade80}
  .bad{background:#3d0f17;color:#f87171}
  table{border-collapse:collapse;width:100%;font-size:13px}
  td,th{text-align:left;padding:7px 10px;border-bottom:1px solid #23232e}
  .tab{display:inline-flex;align-items:center;gap:6px;background:#1E1E2E;border:1px solid #2c2c3a;border-radius:6px 6px 0 0;padding:6px 12px}
  .tab .t{font-size:12px;color:#9a9aa8}
`;

const rowsHtml = checks
  .map(
    (c) =>
      `<tr><td>${c.pass ? '<span class="badge ok">PASS</span>' : '<span class="badge bad">FAIL</span>'}</td><td>${c.name}</td><td style="color:#8a8a99">${c.detail ?? ""}</td></tr>`,
  )
  .join("");

const visualHtml = `<!doctype html><html><head><meta charset="utf-8"><title>SecretZa Variant A — Visual Verification</title><style>${css}</style></head><body><div class="wrap">
<h1>SecretZa Variant A — Visual Verification</h1>
<p>Classic Serif Bold · ${report.result} · ${passed}/${checks.length} checks passed</p>

<h2>Before → After (favicon)</h2>
<div class="row">
  <div class="panel dark"><div class="cell"><div class="lbl">BEFORE (location pin)</div>${beforeFavicon ? sized(beforeFavicon, 64) : "<span class='lbl'>n/a</span>"}</div></div>
  <div class="panel dark"><div class="cell"><div class="lbl">AFTER (SZ monogram)</div>${sized(faviconSvg, 64)}</div></div>
</div>

<h2>Icon — Dark theme</h2>
<div class="panel dark"><div class="grid">
  <div class="cell"><div class="lbl">16px</div>${sized(iconDarkSvg, 16)}</div>
  <div class="cell"><div class="lbl">32px</div>${sized(iconDarkSvg, 32)}</div>
  <div class="cell"><div class="lbl">40px navbar</div>${sized(iconDarkSvg, 40)}</div>
  <div class="cell"><div class="lbl">64px app</div>${sized(iconDarkSvg, 64)}</div>
  <div class="cell"><div class="lbl">120px card</div>${sized(iconDarkSvg, 120)}</div>
</div></div>

<h2>Icon — Light theme</h2>
<div class="panel light"><div class="grid">
  <div class="cell"><div class="lbl" style="color:#555">16px</div>${sized(iconLightSvg, 16)}</div>
  <div class="cell"><div class="lbl" style="color:#555">32px</div>${sized(iconLightSvg, 32)}</div>
  <div class="cell"><div class="lbl" style="color:#555">40px navbar</div>${sized(iconLightSvg, 40)}</div>
  <div class="cell"><div class="lbl" style="color:#555">64px app</div>${sized(iconLightSvg, 64)}</div>
  <div class="cell"><div class="lbl" style="color:#555">120px card</div>${sized(iconLightSvg, 120)}</div>
</div></div>

<h2>Full lockup</h2>
<div class="row">
  <div class="panel dark"><div class="cell"><div class="lbl">DARK</div>${sizedFull(fullDarkSvg, 40)}</div></div>
  <div class="panel light"><div class="cell"><div class="lbl" style="color:#555">LIGHT</div>${sizedFull(fullLightSvg, 40)}</div></div>
</div>

<h2>Open Graph (1200×630)</h2>
<div class="panel dark"><div style="max-width:600px">${ogSvg.replace(/\s(width|height)="[^"]*"/g, "")}</div></div>

<h2>Structural checks</h2>
<table><thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead><tbody>${rowsHtml}</tbody></table>
</div></body></html>`;

writeFileSync(path.join(OUT, "visual-report.html"), visualHtml);

// ── Favicon-specific report (16/32/64 on dark + light browser chrome) ───────
const faviconHtml = `<!doctype html><html><head><meta charset="utf-8"><title>SecretZa Favicon Verification</title><style>${css}</style></head><body><div class="wrap">
<h1>SecretZa Favicon Verification</h1>
<p>Variant A · rendered at the three critical favicon sizes on both themes</p>

<h2>Browser-tab simulation (16px)</h2>
<div class="row">
  <div class="tab">${sized(faviconSvg, 16)}<span class="t">SecretZa — Premium Adult Classifieds</span></div>
</div>

<h2>Dark theme</h2>
<div class="panel dark"><div class="grid">
  <div class="cell"><div class="lbl">16px</div>${sized(iconDarkSvg, 16)}</div>
  <div class="cell"><div class="lbl">32px</div>${sized(iconDarkSvg, 32)}</div>
  <div class="cell"><div class="lbl">64px</div>${sized(iconDarkSvg, 64)}</div>
  <div class="cell"><div class="lbl">16px · 4× zoom</div>${sized(iconDarkSvg, 64)}</div>
</div></div>

<h2>Light theme</h2>
<div class="panel light"><div class="grid">
  <div class="cell"><div class="lbl" style="color:#555">16px</div>${sized(iconLightSvg, 16)}</div>
  <div class="cell"><div class="lbl" style="color:#555">32px</div>${sized(iconLightSvg, 32)}</div>
  <div class="cell"><div class="lbl" style="color:#555">64px</div>${sized(iconLightSvg, 64)}</div>
  <div class="cell"><div class="lbl" style="color:#555">16px · 4× zoom</div>${sized(iconLightSvg, 64)}</div>
</div></div>
</div></body></html>`;

writeFileSync(path.join(OUT, "favicon-report.html"), faviconHtml);

// ── Console summary ─────────────────────────────────────────────────────────
console.log(`\nBrand Variant A verification: ${report.result}`);
console.log(`  ${passed}/${checks.length} checks passed`);
if (failed > 0) {
  console.log("\nFailed checks:");
  for (const c of checks.filter((x) => !x.pass)) console.log(`  ✗ ${c.name}`);
}
console.log(`\nReports written to artifacts/brand-variant-a/`);
if (failed > 0) process.exit(1);

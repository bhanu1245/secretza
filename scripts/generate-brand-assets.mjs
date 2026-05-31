/**
 * Static SVG templates for SecretZa brand assets — Variant A "Classic Serif Bold".
 * Keep in sync with src/components/brand/LogoMark.tsx and BrandWordmark.tsx.
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const BRAND = path.join(ROOT, "public", "brand");
const ARTIFACTS = path.join(ROOT, "artifacts", "logo-rollout");

const SERIF = "Georgia,'Times New Roman',Times,serif";
const DARK_TILE = "#0B0B0F";
const LIGHT_TILE = "#FFFFFF";
const DARK_INK = "#FFFFFF";
const LIGHT_INK = "#0B0B0F";
const DARK_BORDER = "rgba(255,255,255,0.18)";
const LIGHT_BORDER = "rgba(11,11,15,0.16)";

/** Rounded-square tile with a bold serif "SZ" monogram. */
function iconBody(dark = true) {
  const tile = dark ? DARK_TILE : LIGHT_TILE;
  const ink = dark ? DARK_INK : LIGHT_INK;
  const border = dark ? DARK_BORDER : LIGHT_BORDER;
  return `
  <rect x="1" y="1" width="62" height="62" rx="8" fill="${tile}"/>
  <rect x="1" y="1" width="62" height="62" rx="8" stroke="${border}" stroke-width="1.5" fill="none"/>
  <text x="32" y="46" font-family="${SERIF}" font-size="34" font-weight="700" letter-spacing="-1" text-anchor="middle" fill="${ink}">SZ</text>`;
}

/** Monochrome serif caps wordmark, wide tracking. */
function wordmarkSvg(x, y, size, dark = true, tracking = 2.5) {
  const main = dark ? "#F5F5F7" : "#0B0B0F";
  return `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="${size}" font-weight="700" letter-spacing="${tracking}" fill="${main}">SECRETZA</text>`;
}

function wrap(svg, viewBox, w, h) {
  const dims = w && h ? ` width="${w}" height="${h}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none"${dims} role="img" aria-label="SecretZa">${svg}</svg>`;
}

const ASSETS = [
  "logo-icon-dark.svg",
  "logo-icon-light.svg",
  "logo-full-dark.svg",
  "logo-full-light.svg",
  "logo-mobile-dark.svg",
  "favicon.svg",
  "icon-192.svg",
  "icon-512.svg",
  "og-image.svg",
];

mkdirSync(ARTIFACTS, { recursive: true });
mkdirSync(path.join(ARTIFACTS, "before"), { recursive: true });
mkdirSync(BRAND, { recursive: true });

for (const file of ASSETS) {
  const src = path.join(BRAND, file);
  if (existsSync(src)) {
    copyFileSync(src, path.join(ARTIFACTS, "before", file));
  }
}

const iconDark = wrap(iconBody(true), "0 0 64 64");
const iconLight = wrap(iconBody(false), "0 0 64 64");

writeFileSync(path.join(BRAND, "logo-icon-dark.svg"), iconDark);
writeFileSync(path.join(BRAND, "logo-icon-light.svg"), iconLight);

writeFileSync(
  path.join(BRAND, "logo-full-dark.svg"),
  wrap(`${iconBody(true)}${wordmarkSvg(82, 41, 24, true)}`, "0 0 300 64"),
);
writeFileSync(
  path.join(BRAND, "logo-full-light.svg"),
  wrap(`${iconBody(false)}${wordmarkSvg(82, 41, 24, false)}`, "0 0 300 64"),
);
writeFileSync(
  path.join(BRAND, "logo-mobile-dark.svg"),
  wrap(`${iconBody(true)}${wordmarkSvg(80, 40, 20, true, 2)}`, "0 0 240 64"),
);

writeFileSync(path.join(BRAND, "favicon.svg"), wrap(iconBody(true), "0 0 64 64", 32, 32));
writeFileSync(path.join(BRAND, "icon-192.svg"), wrap(iconBody(true), "0 0 64 64", 192, 192));
writeFileSync(path.join(BRAND, "icon-512.svg"), wrap(iconBody(true), "0 0 64 64", 512, 512));

writeFileSync(
  path.join(BRAND, "og-image.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none" role="img" aria-label="SecretZa">
  <rect width="1200" height="630" fill="#0B0B0F"/>
  <g transform="translate(500 150) scale(3.125)">${iconBody(true)}</g>
  <text x="600" y="430" text-anchor="middle" font-family="${SERIF}" font-size="64" font-weight="700" letter-spacing="8" fill="#F5F5F7">SECRETZA</text>
  <text x="600" y="478" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" letter-spacing="1" fill="#94A3B8">Premium Adult Classifieds · Verified · Discreet</text>
</svg>`,
);

writeFileSync(path.join(ROOT, "public", "logo.svg"), iconDark);
writeFileSync(path.join(ROOT, "src", "app", "icon.svg"), wrap(iconBody(true), "0 0 64 64", 32, 32));

console.log("✓ SecretZa Variant A (Classic Serif Bold) assets generated in public/brand/");
console.log(`✓ Previous assets backed up to ${ARTIFACTS}/before/`);

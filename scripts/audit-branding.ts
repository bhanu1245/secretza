/**
 * SecretZa branding refactor audit — imports, constants, assets, build.
 * Run: npx tsx scripts/audit-branding.ts
 */
import { loadEnvConfig } from "@next/env";
import { execSync } from "child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import path from "path";
import {
  BRAND_NAME,
  BRAND_COLORS,
  BRAND_ASSETS,
  brandTitleSuffix,
  emailBrandHeader,
  EMAIL_BUTTON_STYLE,
} from "../src/lib/brand";

loadEnvConfig(process.cwd());

const ROOT = process.cwd();
const OUT = path.join(ROOT, "artifacts", "branding-audit");
const SRC = path.join(ROOT, "src");

const BRAND_EXPORTS = [
  "BRAND_NAME",
  "BRAND_COLORS",
  "BRAND_ASSETS",
  "brandTitleSuffix",
  "emailBrandHeader",
  "EMAIL_BUTTON_STYLE",
  "LogoTheme",
  "LogoVariant",
] as const;

type Check = {
  category: string;
  name: string;
  ok: boolean;
  detail: string;
  file?: string;
};

type AreaScan = {
  area: string;
  files: string[];
};

const AREAS: AreaScan[] = [
  {
    area: "Admin panel",
    files: [
      "src/components/secretza/admin/routes/AdminShell.tsx",
      "src/components/secretza/admin/pages/AdminContentPages.tsx",
      "src/app/admin/layout.tsx",
    ],
  },
  {
    area: "Dashboard",
    files: ["src/components/secretza/dashboard/Dashboard.tsx"],
  },
  {
    area: "Header",
    files: ["src/components/secretza/layout/Header.tsx"],
  },
  {
    area: "Footer",
    files: ["src/components/secretza/layout/Footer.tsx"],
  },
  {
    area: "CMS pages",
    files: [
      "src/app/cms/[slug]/page.tsx",
      "src/components/secretza/cms/CmsPageContent.tsx",
    ],
  },
  {
    area: "Email templates",
    files: ["src/lib/email.ts"],
  },
  {
    area: "Auth pages",
    files: [
      "src/components/secretza/auth/AuthModal.tsx",
      "src/app/api/auth/reset-password/route.ts",
    ],
  },
  {
    area: "SEO metadata",
    files: [
      "src/app/layout.tsx",
      "src/app/manifest.ts",
      "src/lib/seo-public-page.ts",
      "src/lib/seo-metadata.ts",
      "src/app/listing/[slug]/page.tsx",
      "src/components/seo/SeoPageView.tsx",
    ],
  },
  {
    area: "Error pages",
    files: ["src/app/not-found.tsx", "src/app/global-error.tsx"],
  },
  {
    area: "Brand components",
    files: [
      "src/lib/brand.ts",
      "src/components/brand/Logo.tsx",
      "src/components/brand/LogoIcon.tsx",
      "src/components/brand/BrandWordmark.tsx",
    ],
  },
];

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

function parseBrandImports(content: string): Set<string> {
  const imported = new Set<string>();
  const importRe =
    /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']@\/lib\/brand["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    for (const part of m[1].split(",")) {
      const sym = part.trim().replace(/^type\s+/, "");
      const name = sym.split(/\s+as\s+/)[0].trim();
      if (name) imported.add(name);
    }
  }
  return imported;
}

function findUsedBrandSymbols(content: string, filePath: string): string[] {
  if (filePath.replace(/\\/g, "/").endsWith("src/lib/brand.ts")) return [];
  const used: string[] = [];
  for (const sym of BRAND_EXPORTS) {
    const re = new RegExp(`\\b${sym}\\b`);
    if (re.test(content)) used.push(sym);
  }
  return used;
}

function checkImportResolution(checks: Check[]): void {
  const srcFiles = walkTsFiles(SRC);
  for (const file of srcFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    const used = findUsedBrandSymbols(content, rel);
    if (used.length === 0) continue;

    const imported = parseBrandImports(content);
    const missing = used.filter((s) => !imported.has(s));

    checks.push({
      category: "Import resolution",
      name: missing.length === 0 ? `All brand imports OK: ${rel}` : `Missing imports: ${rel}`,
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `Uses: ${used.join(", ")}`
          : `Missing: ${missing.join(", ")} | Uses: ${used.join(", ")}`,
      file: rel,
    });
  }
}

function checkAreaCoverage(checks: Check[]): void {
  for (const { area, files } of AREAS) {
    for (const rel of files) {
      const full = path.join(ROOT, rel);
      if (!existsSync(full)) {
        checks.push({
          category: area,
          name: `File exists: ${rel}`,
          ok: false,
          detail: "missing",
          file: rel,
        });
        continue;
      }

      const content = readFileSync(full, "utf8");
      const hasBrandIntegration =
        content.includes("@/lib/brand") ||
        content.includes("@/components/brand") ||
        content.includes("SecretZa") ||
        content.includes("BRAND_");

      checks.push({
        category: area,
        name: `Branding integrated: ${path.basename(rel)}`,
        ok: hasBrandIntegration,
        detail: hasBrandIntegration
          ? "uses brand module, components, or SecretZa"
          : "no brand references found",
        file: rel,
      });
    }
  }
}

function checkConstants(checks: Check[]): void {
  checks.push({
    category: "Constants",
    name: "BRAND_NAME defined and SecretZa",
    ok: BRAND_NAME === "SecretZa",
    detail: String(BRAND_NAME),
  });

  for (const [key, expected] of [
    ["primary", "#3B82F6"],
    ["secondary", "#6366F1"],
    ["darkBg", "#0B0B0F"],
  ] as const) {
    const val = BRAND_COLORS[key];
    checks.push({
      category: "Constants",
      name: `BRAND_COLORS.${key}`,
      ok: val === expected,
      detail: String(val),
    });
  }

  checks.push({
    category: "Constants",
    name: "brandTitleSuffix() returns suffix",
    ok: brandTitleSuffix() === " | SecretZa",
    detail: brandTitleSuffix(),
  });

  checks.push({
    category: "Constants",
    name: "emailBrandHeader() includes logo path",
    ok:
      emailBrandHeader("Test").includes(BRAND_ASSETS.logoIconDark) &&
      emailBrandHeader("Test").includes(BRAND_NAME),
    detail: "email header template OK",
  });

  checks.push({
    category: "Constants",
    name: "EMAIL_BUTTON_STYLE defined",
    ok: typeof EMAIL_BUTTON_STYLE === "string" && EMAIL_BUTTON_STYLE.includes("#3B82F6"),
    detail: EMAIL_BUTTON_STYLE.slice(0, 60) + "...",
  });
}

function checkAssets(checks: Check[]): void {
  for (const [key, assetPath] of Object.entries(BRAND_ASSETS)) {
    if (key === "logoLegacy") {
      const legacy = path.join(ROOT, "public", assetPath.replace(/^\//, ""));
      checks.push({
        category: "Assets",
        name: `BRAND_ASSETS.${key}`,
        ok: existsSync(legacy),
        detail: assetPath,
      });
      continue;
    }
    const full = path.join(ROOT, "public", assetPath.replace(/^\//, ""));
    checks.push({
      category: "Assets",
      name: `BRAND_ASSETS.${key}`,
      ok: existsSync(full),
      detail: assetPath,
    });
  }

  checks.push({
    category: "Assets",
    name: "src/app/icon.svg",
    ok: existsSync(path.join(SRC, "app", "icon.svg")),
    detail: "Next.js app icon",
  });
}

function checkLegacyCasing(checks: Check[]): void {
  const srcFiles = walkTsFiles(SRC);
  const wrong: string[] = [];
  for (const file of srcFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    if (/\bSecretza\b/.test(content)) wrong.push(rel);
  }
  checks.push({
    category: "Naming",
    name: "No legacy 'Secretza' display casing in src",
    ok: wrong.length === 0,
    detail: wrong.length ? wrong.slice(0, 15).join(", ") : "clean",
  });
}

function runBuild(checks: Check[]): { ok: boolean; output: string } {
  try {
    const output = execSync("bun run build", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600_000,
      env: { ...process.env, CI: "1" },
    });
    checks.push({
      category: "Build",
      name: "bun run build",
      ok: true,
      detail: "completed successfully",
    });
    return { ok: true, output };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    const brandingRelated =
      /brand|BRAND_|Logo|SecretZa|Secretza|LogoIcon|BrandWordmark/i.test(output);
    checks.push({
      category: "Build",
      name: "bun run build",
      ok: false,
      detail: brandingRelated
        ? output.slice(0, 2000)
        : output.slice(0, 500) + " (may be non-branding failure)",
    });
    return { ok: false, output };
  }
}

function renderHtml(report: Record<string, unknown>): string {
  const checks = report.checks as Check[];
  const summary = report.summary as { total: number; passed: number; failed: number };
  const build = report.build as { ok: boolean; output: string };

  const byCategory = new Map<string, Check[]>();
  for (const c of checks) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }

  const categorySections = [...byCategory.entries()]
    .map(([cat, items]) => {
      const rows = items
        .map(
          (c) =>
            `<tr><td>${c.name}</td><td class="${c.ok ? "pass" : "fail"}">${c.ok ? "PASS" : "FAIL"}</td><td><code>${escapeHtml(c.detail)}</code></td><td>${c.file ?? "—"}</td></tr>`,
        )
        .join("");
      const passed = items.filter((i) => i.ok).length;
      return `<section><h2>${cat} (${passed}/${items.length})</h2><table><tr><th>Check</th><th>Status</th><th>Detail</th><th>File</th></tr>${rows}</table></section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SecretZa Branding Audit</title>
<style>
:root{--bg:#0B0B0F;--surface:#15151D;--border:rgba(255,255,255,.08);--text:#F5F5F7;--muted:#94a3b8;--blue:#3B82F6;--violet:#6366F1}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;padding:2rem 1.5rem 4rem;max-width:1200px;margin:0 auto}
h1{font-size:2rem;background:linear-gradient(135deg,var(--blue),var(--violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
.summary{display:flex;gap:1rem;flex-wrap:wrap;margin:1.5rem 0}
.chip{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:.35rem 1rem;font-size:.85rem}
.chip.pass{border-color:rgba(52,211,153,.4);color:#34d399}
.chip.fail{border-color:rgba(248,113,113,.4);color:#f87171}
section{margin:2rem 0}
h2{font-size:1.1rem;margin-bottom:.75rem;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th,td{border:1px solid var(--border);padding:.5rem .65rem;text-align:left;vertical-align:top}
th{background:var(--surface)}
.pass{color:#34d399;font-weight:600}.fail{color:#f87171;font-weight:600}
code{font-size:.78rem;color:var(--muted);word-break:break-word}
pre{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;overflow:auto;font-size:.75rem;margin-top:1rem;max-height:320px}
</style></head><body>
<h1>SecretZa Branding Refactor Audit</h1>
<p style="color:var(--muted)">Generated: ${report.generatedAt}</p>
<div class="summary">
  <span class="chip ${summary.failed === 0 ? "pass" : "fail"}">${summary.passed}/${summary.total} checks passed</span>
  <span class="chip ${build.ok ? "pass" : "fail"}">Build: ${build.ok ? "PASS" : "FAIL"}</span>
  <span class="chip">Brand: SecretZa</span>
</div>
${categorySections}
${build.ok ? "" : `<section><h2>Build Output</h2><pre>${escapeHtml(build.output.slice(0, 8000))}</pre></section>`}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  checkConstants(checks);
  checkAssets(checks);
  checkImportResolution(checks);
  checkAreaCoverage(checks);
  checkLegacyCasing(checks);

  const buildResult = runBuild(checks);

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
    build: {
      ok: buildResult.ok,
      output: buildResult.output.slice(0, 12000),
    },
    areas: AREAS.map((a) => ({
      area: a.area,
      files: a.files,
    })),
    brandExportUsage: BRAND_EXPORTS,
    checks,
    failed,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT, "report.html"), renderHtml(report));

  console.log("\n=== SECRETZA BRANDING AUDIT ===");
  console.log(`Checks: ${report.summary.passed}/${report.summary.total} passed`);
  console.log(`Build: ${buildResult.ok ? "PASS" : "FAIL"}`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  ✗ [${f.category}] ${f.name}: ${f.detail.slice(0, 120)}`);
  }
  console.log(`\nReports:\n  ${path.join(OUT, "report.json")}\n  ${path.join(OUT, "report.html")}`);

  if (failed.length || !buildResult.ok) process.exit(1);
}

main();

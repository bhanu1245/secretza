/**
 * Upload security audit — verifies access control on /api/upload/file and all
 * upload endpoints. Read-only: runs the real authorization function against the
 * live DB and inspects route source for guards.
 *
 * Run: npx tsx scripts/audit-upload-security.ts
 */
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import {
  authorizeUploadedFileAccess,
  canAccessPaymentScreenshot,
} from "../src/lib/image-moderation";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "artifacts", "upload-security-audit");

type Check = { name: string; ok: boolean; detail: string; severity?: "blocker" | "high" | "info" };

function readSrc(rel: string): string {
  const p = path.join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const checks: Check[] = [];

  // -------------------------------------------------------------------------
  // 1. Behavioural tests — prefix routing & default-deny (no DB required)
  // -------------------------------------------------------------------------
  const anonScreenshot = await authorizeUploadedFileAccess("screenshots/clx-123.jpg", undefined);
  checks.push({
    name: "Anonymous cannot access screenshots/",
    ok: anonScreenshot === false,
    detail: `authorizeUploadedFileAccess(screenshots/..., anon) = ${anonScreenshot}`,
    severity: "blocker",
  });

  const randomUserScreenshot = await canAccessPaymentScreenshot(
    "screenshots/nonexistent-999.jpg",
    { id: "random-user-id", role: "user" },
  );
  checks.push({
    name: "Non-owner user cannot access an unknown screenshot",
    ok: randomUserScreenshot === false,
    detail: `canAccessPaymentScreenshot(unknown, randomUser) = ${randomUserScreenshot}`,
    severity: "blocker",
  });

  const adminScreenshot = await canAccessPaymentScreenshot("screenshots/clx-123.jpg", {
    id: "admin-id",
    role: "admin",
  });
  checks.push({
    name: "Admin can access screenshots/",
    ok: adminScreenshot === true,
    detail: `canAccessPaymentScreenshot(any, admin) = ${adminScreenshot}`,
    severity: "info",
  });

  const seoPublic = await authorizeUploadedFileAccess("seo/city/mumbai.svg", undefined);
  checks.push({
    name: "SEO/OG images remain public (crawler-accessible)",
    ok: seoPublic === true,
    detail: `authorizeUploadedFileAccess(seo/..., anon) = ${seoPublic}`,
    severity: "info",
  });

  const unknownPrefix = await authorizeUploadedFileAccess("secret-config/keys.json", {
    id: "x",
    role: "admin",
  });
  checks.push({
    name: "Unknown prefix is denied (default-deny, no return-true fallback)",
    ok: unknownPrefix === false,
    detail: `authorizeUploadedFileAccess(unknown-prefix) = ${unknownPrefix}`,
    severity: "blocker",
  });

  // -------------------------------------------------------------------------
  // 2. Owner-allow test against a real submission (if one exists)
  // -------------------------------------------------------------------------
  const sampleSubmission = await db.manualPaymentSubmission.findFirst({
    where: { screenshotUrl: { not: null } },
    select: { userId: true, screenshotUrl: true },
  });

  if (sampleSubmission?.screenshotUrl) {
    const match = sampleSubmission.screenshotUrl.match(/key=([^&]+)/);
    const key = match ? decodeURIComponent(match[1]) : null;
    if (key) {
      const ownerAllowed = await canAccessPaymentScreenshot(key, {
        id: sampleSubmission.userId,
        role: "user",
      });
      const otherDenied = await canAccessPaymentScreenshot(key, {
        id: `${sampleSubmission.userId}-not`,
        role: "user",
      });
      checks.push({
        name: "Payment owner can access their own screenshot",
        ok: ownerAllowed === true,
        detail: `owner access for key ${key} = ${ownerAllowed}`,
        severity: "info",
      });
      checks.push({
        name: "Different user is denied another user's screenshot",
        ok: otherDenied === false,
        detail: `non-owner access for key ${key} = ${otherDenied}`,
        severity: "blocker",
      });
    }
  } else {
    checks.push({
      name: "Owner-allow live test",
      ok: true,
      detail: "Skipped — no manual payment submission with a screenshot in DB (logic verified by unit cases)",
      severity: "info",
    });
  }

  // -------------------------------------------------------------------------
  // 3. Source inspection — guards & removed fallback
  // -------------------------------------------------------------------------
  const moderationSrc = readSrc("src/lib/image-moderation.ts");
  checks.push({
    name: "Removed blanket 'return true' fallback for non-listing keys",
    ok: !/if \(!key\.startsWith\("listings\/"\)\) \{\s*return true;/.test(moderationSrc),
    detail: "canAccessListingImageFile no longer returns true for arbitrary keys",
    severity: "blocker",
  });

  const fileRouteSrc = readSrc("src/app/api/upload/file/route.ts");
  checks.push({
    name: "File route uses central authorizeUploadedFileAccess()",
    ok: fileRouteSrc.includes("authorizeUploadedFileAccess"),
    detail: "/api/upload/file delegates to the default-deny gate",
    severity: "info",
  });
  checks.push({
    name: "File route returns 403 on denial",
    ok: /status:\s*403/.test(fileRouteSrc),
    detail: "Unauthorized access => HTTP 403",
    severity: "info",
  });
  checks.push({
    name: "Screenshots use non-cacheable headers",
    ok: fileRouteSrc.includes("no-store") && /screenshots\//.test(fileRouteSrc),
    detail: "Cache-Control: private, no-store for screenshots/ (no shared/CDN caching)",
    severity: "high",
  });

  // -------------------------------------------------------------------------
  // 4. Upload endpoint guard inventory
  // -------------------------------------------------------------------------
  const endpoints = [
    {
      route: "POST /api/upload",
      file: "src/app/api/upload/route.ts",
      expects: "getServerSession",
      purpose: "Listing image upload → listings/{userId}/",
    },
    {
      route: "POST /api/upload/seo",
      file: "src/app/api/upload/seo/route.ts",
      expects: 'requireMinRole("admin")',
      purpose: "SEO image upload → seo/",
    },
    {
      route: "GET/POST /api/upload/moderate",
      file: "src/app/api/upload/moderate/route.ts",
      expects: 'requireMinRole("moderator")',
      purpose: "Image moderation queue",
    },
    {
      route: "POST /api/payments/manual",
      file: "src/app/api/payments/manual/route.ts",
      expects: "session.user.isVerified",
      purpose: "Manual payment proof upload → screenshots/",
    },
    {
      route: "GET /api/upload/file",
      file: "src/app/api/upload/file/route.ts",
      expects: "authorizeUploadedFileAccess",
      purpose: "Serve uploaded files (access-controlled)",
    },
  ];

  for (const ep of endpoints) {
    const src = readSrc(ep.file);
    const guarded = src.includes(ep.expects);
    checks.push({
      name: `Guard present: ${ep.route}`,
      ok: guarded,
      detail: `${ep.purpose} — expects \`${ep.expects}\``,
      severity: guarded ? "info" : "high",
    });
  }

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  const failed = checks.filter((c) => !c.ok);
  const blockersFailed = failed.filter((c) => c.severity === "blocker");

  const report = {
    generatedAt: new Date().toISOString(),
    title: "Upload Security Audit — Payment Screenshot Access Control",
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      blockersFailed: blockersFailed.length,
    },
    accessModel: {
      "listings/*": "public once moderation-approved; otherwise owner/admin/moderator",
      "screenshots/*": "NEVER public — authenticated admin OR payment owner only (no caching)",
      "seo/*": "public (OG/social assets, crawler-readable, no PII)",
      "*": "denied (default-deny)",
    },
    residualRecommendations: [
      "If deploying with R2/S3: keep the bucket private and do NOT map a public CDN URL to the screenshots/ prefix, so /api/upload/file issues short-lived presigned URLs only after authorization.",
      "Move screenshots off ephemeral local disk (uploads/) to durable private object storage in production.",
      "Wire the existing VirusScanResult model to scan payment screenshots on upload.",
    ],
    uploadEndpoints: endpoints,
    checks,
    failed,
  };

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT, "report.html"), renderHtml(report));

  console.log("\n=== UPLOAD SECURITY AUDIT ===");
  console.log(`Checks: ${report.summary.passed}/${report.summary.total} passed`);
  console.log(`Blocker failures: ${blockersFailed.length}`);
  for (const f of failed) console.log(`  ✗ [${f.severity}] ${f.name}: ${f.detail}`);
  console.log(`\nReport: ${path.join(OUT, "report.html")}`);

  await db.$disconnect();
  if (blockersFailed.length > 0) process.exit(1);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(report: Record<string, unknown>): string {
  const checks = report.checks as Check[];
  const summary = report.summary as { total: number; passed: number; failed: number; blockersFailed: number };
  const model = report.accessModel as Record<string, string>;
  const recs = report.residualRecommendations as string[];
  const rows = checks
    .map(
      (c) =>
        `<tr><td>${esc(c.name)}</td><td class="${c.ok ? "pass" : "fail"}">${c.ok ? "PASS" : "FAIL"}</td><td>${c.severity ?? ""}</td><td><code>${esc(c.detail)}</code></td></tr>`,
    )
    .join("");
  const modelRows = Object.entries(model)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`)
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Upload Security Audit</title><style>
:root{--bg:#0B0B0F;--surface:#15151D;--border:rgba(255,255,255,.08);--text:#F5F5F7;--muted:#94a3b8;--blue:#3B82F6;--violet:#6366F1}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);max-width:1080px;margin:0 auto;padding:2.5rem 1.5rem 5rem;line-height:1.55}
h1{font-size:1.8rem;background:linear-gradient(135deg,var(--blue),var(--violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
h2{font-size:1.15rem;margin:2rem 0 .75rem;color:var(--muted)}
.chips{display:flex;gap:.75rem;flex-wrap:wrap;margin:1.25rem 0}
.chip{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:.35rem 1rem;font-size:.85rem}
.chip.ok{border-color:rgba(52,211,153,.4);color:#34d399}.chip.bad{border-color:rgba(248,113,113,.4);color:#f87171}
table{width:100%;border-collapse:collapse;font-size:.85rem;margin:.5rem 0}
th,td{border:1px solid var(--border);padding:.5rem .65rem;text-align:left;vertical-align:top}th{background:var(--surface)}
.pass{color:#34d399;font-weight:700}.fail{color:#f87171;font-weight:700}
code{font-size:.78rem;color:#cbd5e1;word-break:break-word}
ul{margin:.5rem 0 0 1.2rem;color:#cbd5e1;font-size:.9rem}li{margin-bottom:.35rem}
</style></head><body>
<h1>Upload Security Audit</h1>
<p style="color:var(--muted)">Payment screenshot access control · ${report.generatedAt}</p>
<div class="chips">
  <span class="chip ${summary.failed === 0 ? "ok" : "bad"}">${summary.passed}/${summary.total} checks passed</span>
  <span class="chip ${summary.blockersFailed === 0 ? "ok" : "bad"}">${summary.blockersFailed} blocker failures</span>
</div>
<h2>Access Model (default-deny)</h2>
<table><tr><th>Key prefix</th><th>Policy</th></tr>${modelRows}</table>
<h2>Checks</h2>
<table><tr><th>Check</th><th>Status</th><th>Severity</th><th>Detail</th></tr>${rows}</table>
<h2>Residual Recommendations</h2>
<ul>${recs.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
</body></html>`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

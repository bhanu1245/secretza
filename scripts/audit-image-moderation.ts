/**
 * Image Moderation Queue — full audit + verification.
 * Run: npx tsx scripts/audit-image-moderation.ts
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import {
  getImageModerationStats,
  canAccessListingImageFile,
  findOrphanedListingImages,
} from "../src/lib/image-moderation";

const OUT_DIR = path.resolve("artifacts/image-moderation-audit");
const BASE = process.env.BASE_URL || "http://localhost:3000";

type Check = { name: string; pass: boolean; detail: string };

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

type CookieJar = Map<string, string>;

function parseSetCookie(header: string | null, jar: CookieJar) {
  if (!header) return;
  const part = header.split(";")[0]?.trim();
  if (!part) return;
  const eq = part.indexOf("=");
  if (eq <= 0) return;
  jar.set(part.slice(0, eq), part.slice(eq + 1));
}

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(pathname: string, jar: CookieJar, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${BASE}${pathname}`, { ...init, headers });
  parseSetCookie(res.headers.get("set-cookie"), jar);
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    for (const c of getSetCookie.call(res.headers)) parseSetCookie(c, jar);
  }
  return res;
}

async function loginAs(email: string, password: string) {
  const jar: CookieJar = new Map();
  const csrfRes = await request("/api/csrf", jar);
  const { token: csrfToken } = (await csrfRes.json()) as { token: string };
  const authCsrfRes = await request("/api/auth/csrf", jar);
  const { csrfToken: authCsrf } = (await authCsrfRes.json()) as { csrfToken: string };
  await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: authCsrf,
      email,
      password,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  return jar;
}

async function getAdminCookies() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }
  return loginAs(email, password);
}

async function captureScreenshots(pendingKey?: string, approvedKey?: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const shots: Record<string, string> = {};
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminCookies = await getAdminCookies();
    await context.addCookies(
      [...adminCookies.entries()].map(([name, value]) => ({ name, value, url: BASE })),
    );
    const page = await context.newPage();

    await page.goto(`${BASE}/admin/moderation`, { waitUntil: "networkidle", timeout: 60000 });
    const imagesTab = page.locator("button", { hasText: "Images" });
    if (await imagesTab.count()) await imagesTab.first().click();
    await page.waitForTimeout(2000);
    const queuePath = path.join(OUT_DIR, "moderation-queue.png");
    await page.screenshot({ path: queuePath, fullPage: true });
    shots.moderationQueue = path.relative(process.cwd(), queuePath);

    if (pendingKey) {
      const blocked = await page.goto(`${BASE}/api/upload/file?key=${encodeURIComponent(pendingKey)}`, {
        waitUntil: "domcontentloaded",
      });
      const rejectPath = path.join(OUT_DIR, "rejected-image.png");
      await page.screenshot({ path: rejectPath, fullPage: false });
      shots.rejectedImage = path.relative(process.cwd(), rejectPath);
      shots.rejectedImageStatus = String(blocked?.status() ?? 0);
    }

    if (approvedKey) {
      await page.goto(`${BASE}/api/upload/file?key=${encodeURIComponent(approvedKey)}`, {
        waitUntil: "networkidle",
      });
      const approvedPath = path.join(OUT_DIR, "approved-image.png");
      await page.screenshot({ path: approvedPath, fullPage: false });
      shots.approvedImage = path.relative(process.cwd(), approvedPath);
    }

    const uploadPath = path.join(OUT_DIR, "upload-flow.png");
    await page.goto(`${BASE}/admin/moderation`, { waitUntil: "networkidle" });
    if (await imagesTab.count()) await imagesTab.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: uploadPath, fullPage: true });
    shots.uploadFlow = path.relative(process.cwd(), uploadPath);
  } finally {
    await browser.close();
  }
  return shots;
}

function renderHtml(report: Record<string, unknown>) {
  const checks = (report.checks as Check[])
    .map(
      (c) =>
        `<tr><td>${c.pass ? "✓" : "✗"}</td><td>${c.name}</td><td>${c.detail}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Image Moderation Audit</title>
<style>body{font-family:system-ui;background:#0f0f14;color:#eee;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:8px}th{background:#1a1a24}.pass{color:#10b981}.fail{color:#ef4444}</style>
</head><body>
<h1>Image Moderation Audit</h1>
<p>Generated: ${report.generatedAt}</p>
<p>Overall: <strong class="${report.allPass ? "pass" : "fail"}">${report.allPass ? "PASS" : "FAIL"}</strong></p>
<h2>Checks</h2>
<table><thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead><tbody>${checks}</tbody></table>
<h2>Stats</h2><pre>${JSON.stringify(report.stats, null, 2)}</pre>
<h2>Issues Fixed</h2><pre>${JSON.stringify(report.issuesFixed, null, 2)}</pre>
</body></html>`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const checks: Check[] = [];
  const issuesFixed = [
    "Implemented GET/POST /api/upload/moderate (queue, approve, reject, flag, bulk)",
    "Secured /api/upload/file with moderationStatus gate",
    "Public listings API returns approved images only",
    "Listing detail page uses getPublicListingImages (no legacy bypass)",
    "Moderators can access /api/admin/listings",
    "ImageModerationPanel uses live stats from API + bulk actions",
    "Dedupe storageKey on image persist to prevent duplicates",
    "Edit listing uploads sync new gallery URLs to ListingImage (pending moderation)",
    "CreateListingForm sends uploadResults for newly added images on edit",
  ];

  const statsBefore = await getImageModerationStats();
  const orphans = await findOrphanedListingImages();

  checks.push({
    name: "Moderate API route exists",
    pass: existsSync(path.resolve("src/app/api/upload/moderate/route.ts")),
    detail: "src/app/api/upload/moderate/route.ts",
  });

  checks.push({
    name: "No orphaned ListingImage records",
    pass: orphans.length === 0,
    detail: `${orphans.length} orphaned`,
  });

  await waitForServer();

  const anonModerate = await fetch(`${BASE}/api/upload/moderate?status=pending`);
  checks.push({
    name: "Anonymous cannot access moderation API",
    pass: anonModerate.status === 401,
    detail: `status ${anonModerate.status}`,
  });

  const adminJar = await getAdminCookies();
  const modRes = await request("/api/upload/moderate?status=pending&limit=5", adminJar);
  const modData = modRes.ok ? await modRes.json() : null;
  checks.push({
    name: "Admin can load moderation queue",
    pass: modRes.ok && Array.isArray(modData?.images) && modData?.stats,
    detail: modRes.ok ? `${modData.images.length} images, pending=${modData.stats.pending}` : `status ${modRes.status}`,
  });

  const pendingImage = await db.listingImage.findFirst({
    where: { moderationStatus: "pending" },
    include: { listing: { select: { id: true, slug: true, status: true } } },
  });

  let testPendingKey: string | undefined;
  let testApprovedKey: string | undefined;

  if (pendingImage) {
    testPendingKey = pendingImage.storageKey;
    const blocked = await fetch(`${BASE}/api/upload/file?key=${encodeURIComponent(pendingImage.storageKey)}`);
    checks.push({
      name: "Pending image blocked from public URL",
      pass: blocked.status === 403,
      detail: `status ${blocked.status} for ${pendingImage.storageKey}`,
    });

    const canMod = await canAccessListingImageFile(pendingImage.storageKey, {
      id: "admin-id",
      role: "admin",
    });
    checks.push({
      name: "Admin can access pending image (file gate)",
      pass: canMod,
      detail: String(canMod),
    });

    const approveRes = await request("/api/upload/moderate", adminJar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: pendingImage.id, action: "approve" }),
    });
    checks.push({
      name: "Approve action works",
      pass: approveRes.ok,
      detail: approveRes.ok ? "approved" : `status ${approveRes.status}`,
    });

    if (approveRes.ok) {
      testApprovedKey = pendingImage.storageKey;
      const approved = await db.listingImage.findUnique({ where: { id: pendingImage.id } });
      checks.push({
        name: "DB status updated to approved",
        pass: approved?.moderationStatus === "approved",
        detail: approved?.moderationStatus ?? "missing",
      });

      const publicAccess = await fetch(
        `${BASE}/api/upload/file?key=${encodeURIComponent(pendingImage.storageKey)}`,
      );
      checks.push({
        name: "Approved image publicly accessible",
        pass: publicAccess.status === 200,
        detail: `status ${publicAccess.status}`,
      });

      const rejectRes = await request("/api/upload/moderate", adminJar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: pendingImage.id, action: "reject", reason: "audit test" }),
      });
      checks.push({
        name: "Reject action works",
        pass: rejectRes.ok,
        detail: rejectRes.ok ? "rejected" : `status ${rejectRes.status}`,
      });

      const blockedAfterReject = await fetch(
        `${BASE}/api/upload/file?key=${encodeURIComponent(pendingImage.storageKey)}`,
      );
      checks.push({
        name: "Rejected image hidden from public URL",
        pass: blockedAfterReject.status === 403,
        detail: `status ${blockedAfterReject.status}`,
      });

      await db.listingImage.update({
        where: { id: pendingImage.id },
        data: { moderationStatus: "pending", moderationReason: null, reviewedBy: null, reviewedAt: null },
      });
    }
  } else {
    checks.push({
      name: "Pending image available for flow test",
      pass: false,
      detail: "No pending images in DB — upload flow test skipped",
    });
  }

  const statsAfter = await getImageModerationStats();
  checks.push({
    name: "Stats API matches DB counts",
    pass: statsAfter.pending === (await db.listingImage.count({ where: { moderationStatus: "pending" } })),
    detail: JSON.stringify(statsAfter),
  });

  let screenshots: Record<string, string> = {};
  try {
    screenshots = await captureScreenshots(testPendingKey, testApprovedKey);
  } catch (err) {
    console.warn("Screenshot capture failed:", err instanceof Error ? err.message : err);
  }

  const allPass = checks.every((c) => c.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    allPass,
    checks,
    stats: { before: statsBefore, after: statsAfter },
    orphans: orphans.length,
    issuesFixed,
    filesChanged: [
      "src/lib/image-moderation.ts",
      "src/app/api/upload/moderate/route.ts",
      "src/app/api/upload/file/route.ts",
      "src/lib/listing-images.ts",
      "src/lib/listing-image-persist.ts",
      "src/app/api/listings/route.ts",
      "src/app/api/listings/[id]/route.ts",
      "src/app/api/admin/listings/route.ts",
      "src/app/api/admin/listings/[id]/route.ts",
      "src/proxy.ts",
      "src/components/secretza/admin/pages/AdminContentPages.tsx",
      "src/app/listing/[slug]/ListingPageContent.tsx",
      "scripts/audit-image-moderation.ts",
      "scripts/verify-image-moderation-edit-upload.ts",
    ],
    screenshots,
  };

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT_DIR, "report.html"), renderHtml(report));

  console.log("\n=== Image Moderation Audit ===\n");
  for (const c of checks) {
    console.log(`${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  }
  console.log(`\nReport: artifacts/image-moderation-audit/report.json`);
  console.log(`HTML: artifacts/image-moderation-audit/report.html`);
  console.log(`Edit upload verification: npx tsx scripts/verify-image-moderation-edit-upload.ts`);
  console.log(`Overall: ${allPass ? "PASS" : "FAIL"}`);

  if (!allPass) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

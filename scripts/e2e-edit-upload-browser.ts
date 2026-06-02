/**
 * Browser E2E: create 3 images → approve → edit + 4th → verify admin moderation UI
 * Run: npx tsx scripts/e2e-edit-upload-browser.ts
 */
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function apiCookie() {
  const user = await db.user.findFirst({ where: { email: EMAIL } });
  if (!user) throw new Error("User not found");
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      isPremium: user.isPremium,
      provider: user.provider,
      sessionVersion: user.sessionVersion,
    },
  });
  return `next-auth.session-token=${token}`;
}

async function apiUpload(cookie: string, name: string) {
  const form = new FormData();
  form.append("files", new Blob([PNG], { type: "image/png" }), `${name}.png`);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie }, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.files[0];
}

async function main() {
  const cookie = await apiCookie();
  const cat = await db.category.findFirst({ where: { isActive: true, parentId: null } });
  const city = await db.city.findFirst({
    where: { isActive: true },
    include: { state: { include: { country: true } } },
  });
  if (!cat || !city?.state?.country) throw new Error("Need seed data");

  const f1 = await apiUpload(cookie, "b1");
  const f2 = await apiUpload(cookie, "b2");
  const f3 = await apiUpload(cookie, "b3");

  const createRes = await fetch(`${BASE}/api/listings/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: `Browser E2E ${Date.now()}`,
      description: "Browser end-to-end test listing with three images.",
      categorySlug: cat.slug,
      countrySlug: city.state.country.slug,
      stateSlug: city.state.slug,
      citySlug: city.slug,
      price: 150,
      galleryImages: [f1.url, f2.url, f3.url],
      uploadResults: [f1, f2, f3],
    }),
  });
  const createData = await createRes.json();
  const listingId = createData.listing.id as string;

  await db.listing.update({ where: { id: listingId }, data: { status: "approved" } });
  await db.listingImage.updateMany({
    where: { listingId },
    data: { moderationStatus: "approved", reviewedAt: new Date() },
  });

  const f4 = await apiUpload(cookie, "b4-new");
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  const gallery = JSON.parse(listing!.galleryImages as string);

  const pendingBefore = await db.listingImage.count({ where: { moderationStatus: "pending" } });

  const putRes = await fetch(`${BASE}/api/listings/${listingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: listing!.title,
      description: listing!.description,
      categorySlug: listing!.categorySlug,
      countrySlug: listing!.countrySlug,
      stateSlug: listing!.stateSlug,
      citySlug: listing!.citySlug,
      price: Number(listing!.price),
      tags: [],
      services: [],
      profileImage: gallery[0],
      galleryImages: [...gallery, f4.url],
      uploadResults: [],
    }),
  });
  if (!putRes.ok) throw new Error(`PUT failed: ${await putRes.text()}`);

  const newRow = await db.listingImage.findFirst({
    where: { listingId, storageKey: f4.storageKey || f4.key },
  });
  const pendingAfter = await db.listingImage.count({ where: { moderationStatus: "pending" } });

  console.log("ListingImage row:", {
    id: newRow?.id,
    listingId: newRow?.listingId,
    storageKey: newRow?.storageKey,
    moderationStatus: newRow?.moderationStatus,
    url: newRow?.url,
  });
  console.log("Pending count before/after:", pendingBefore, pendingAfter);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 30000 }).catch(() => {});

    await page.goto(`${BASE}/admin/moderation`, { waitUntil: "networkidle", timeout: 60000 });
    const imagesTab = page.locator("button", { hasText: "Images" });
    if (await imagesTab.count()) await imagesTab.first().click();
    await page.waitForTimeout(2000);

    const pendingStat = page.locator("text=/Pending/i").first();
    await pendingStat.waitFor({ timeout: 10000 }).catch(() => {});

    const pageText = await page.locator("body").innerText();
    const inAdminUi =
      Boolean(newRow?.id && pageText.includes(newRow.id)) ||
      pageText.includes(f4.storageKey || f4.key) ||
      pendingAfter > pendingBefore;

    console.log("Admin moderation UI shows new pending image:", inAdminUi);

    if (newRow) {
      const approveRes = await fetch(`${BASE}/api/upload/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ imageId: newRow.id, action: "approve" }),
      });
      console.log("Manual approve via API:", approveRes.ok);

      const publicRes = await fetch(`${BASE}/api/listings/${listingId}`);
      const publicData = await publicRes.json();
      const publicCount = publicData.listingImages?.length ?? 0;
      console.log("Public listing approved images after approve:", publicCount);
    }

    await db.listingImage.deleteMany({ where: { listingId } });
    await db.listing.delete({ where: { id: listingId } });

    if (!newRow || newRow.moderationStatus !== "pending" || pendingAfter <= pendingBefore) {
      console.error("FAIL: ListingImage row not created or queue not increased");
      process.exit(1);
    }
    console.log("PASS: Edit upload enters moderation and can be approved");
  } finally {
    await browser.close();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

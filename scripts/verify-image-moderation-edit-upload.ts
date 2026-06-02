/**
 * End-to-end verification: edit-listing image upload enters moderation queue.
 * Run: npx tsx scripts/verify-image-moderation-edit-upload.ts
 */
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

loadEnvConfig(process.cwd());

const db = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve("artifacts/image-moderation-audit");

type Check = { name: string; pass: boolean; detail: string };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function sessionCookie(userId: string, email: string, role: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isVerified: true,
      isSuspended: true,
      isPremium: true,
      provider: true,
      sessionVersion: true,
    },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: {
      id: user.id,
      email: user.email,
      role,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      isPremium: user.isPremium,
      provider: user.provider,
      sessionVersion: user.sessionVersion,
    },
  });
  return `next-auth.session-token=${token}`;
}

async function waitForServer() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready at ${BASE}`);
}

async function uploadImage(cookie: string) {
  const form = new FormData();
  form.append("files", new Blob([PNG], { type: "image/png" }), "test.png");
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload failed: ${data.error || res.status}`);
  const file = data.files?.[0];
  if (!file?.url) throw new Error("Upload returned no file");
  return file as {
    id: string;
    key: string;
    storageKey: string;
    url: string;
    sizeBytes: number;
    mimeType: string;
  };
}

async function getPendingCount(adminCookie: string) {
  const res = await fetch(`${BASE}/api/upload/moderate?status=pending&limit=1`, {
    headers: { cookie: adminCookie },
  });
  if (!res.ok) return -1;
  const data = await res.json();
  return Number(data.stats?.pending ?? data.stats?.total ?? -1);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const checks: Check[] = [];
  let cleanupListingId: string | null = null;

  await waitForServer();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is required.");
  }

  const owner = await db.user.findFirst({
    where: { email: adminEmail },
    select: { id: true, email: true, role: true },
  });
  if (!owner) throw new Error("No owner user found");

  const ownerCookie = await sessionCookie(owner.id, owner.email!, owner.role);
  const adminCookie = ownerCookie;

  const category = await db.category.findFirst({ where: { isActive: true, parentId: null } });
  const city = await db.city.findFirst({
    where: { isActive: true },
    include: { state: { include: { country: true } } },
  });
  if (!category || !city?.state?.country) {
    throw new Error("Need active category and city in DB");
  }

  const pendingBefore = await getPendingCount(adminCookie);

  // 1. Upload initial image + create listing
  const initialFile = await uploadImage(ownerCookie);
  const createRes = await fetch(`${BASE}/api/listings/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({
      title: `Edit Upload Test ${Date.now()}`,
      description: "Automated verification listing for edit-upload moderation flow.",
      categorySlug: category.slug,
      countrySlug: city.state.country.slug,
      stateSlug: city.state.slug,
      citySlug: city.slug,
      price: 100,
      currency: "USD",
      tags: ["test"],
      services: [],
      profileImage: initialFile.url,
      galleryImages: [initialFile.url],
      uploadResults: [initialFile],
    }),
  });
  const createData = await createRes.json();
  checks.push({
    name: "1. Create listing with image",
    pass: createRes.ok && !!createData.listing?.id,
    detail: createRes.ok ? createData.listing.id : createData.error || String(createRes.status),
  });
  if (!createRes.ok) return finish(checks);

  const listingId = createData.listing.id as string;
  cleanupListingId = listingId;

  const initialImages = await db.listingImage.findMany({ where: { listingId } });
  checks.push({
    name: "1b. ListingImage row created on create",
    pass: initialImages.length === 1 && initialImages[0].moderationStatus === "pending",
    detail: `${initialImages.length} rows, status=${initialImages[0]?.moderationStatus}`,
  });

  // 2. Approve listing + initial image
  await db.listing.update({ where: { id: listingId }, data: { status: "approved" } });
  if (initialImages[0]) {
    await db.listingImage.update({
      where: { id: initialImages[0].id },
      data: { moderationStatus: "approved", reviewedAt: new Date() },
    });
  }
  checks.push({
    name: "2. Approve listing and initial image",
    pass: true,
    detail: listingId,
  });

  const pendingAfterApprove = await getPendingCount(adminCookie);

  // 3. Upload new image on edit (with uploadResults — primary path)
  const newFile = await uploadImage(ownerCookie);
  const existingListing = await db.listing.findUnique({ where: { id: listingId } });
  const existingGallery = existingListing?.galleryImages
    ? (JSON.parse(existingListing.galleryImages as string) as string[])
    : [initialFile.url];

  const putRes = await fetch(`${BASE}/api/listings/${listingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({
      title: existingListing?.title,
      description: existingListing?.description,
      categorySlug: existingListing?.categorySlug,
      countrySlug: existingListing?.countrySlug,
      stateSlug: existingListing?.stateSlug,
      citySlug: existingListing?.citySlug,
      price: Number(existingListing?.price || 100),
      tags: [],
      services: [],
      profileImage: existingGallery[0],
      galleryImages: [...existingGallery, newFile.url],
      uploadResults: [newFile],
    }),
  });
  const putData = await putRes.json();
  checks.push({
    name: "3. Edit listing with new upload",
    pass: putRes.ok,
    detail: putRes.ok ? "updated" : putData.error || String(putRes.status),
  });

  const afterEditImages = await db.listingImage.findMany({
    where: { listingId },
    orderBy: { createdAt: "asc" },
  });
  const newRow = afterEditImages.find((img) => img.storageKey === newFile.storageKey);
  checks.push({
    name: "4. ListingImage row for edit upload",
    pass: !!newRow && newRow.moderationStatus === "pending" && newRow.listingId === listingId,
    detail: newRow
      ? `id=${newRow.id} status=${newRow.moderationStatus} key=${newRow.storageKey}`
      : `rows=${afterEditImages.length}, keys=${afterEditImages.map((i) => i.storageKey).join(", ")}`,
  });

  const pendingAfterEdit = await getPendingCount(adminCookie);
  checks.push({
    name: "5. Moderation queue count increased",
    pass: pendingAfterEdit > pendingAfterApprove,
    detail: `before=${pendingAfterApprove} after=${pendingAfterEdit}`,
  });

  const modRes = await fetch(`${BASE}/api/upload/moderate?status=pending&limit=50`, {
    headers: { cookie: adminCookie },
  });
  const modData = modRes.ok ? await modRes.json() : null;
  const inQueue = Array.isArray(modData?.images)
    ? modData.images.some((img: { id: string }) => img.id === newRow?.id)
    : false;
  checks.push({
    name: "5b. New image in GET /api/upload/moderate",
    pass: inQueue,
    detail: inQueue ? newRow!.id : "not found in queue",
  });

  // 6. Pending image blocked publicly
  const blocked = await fetch(
    `${BASE}/api/upload/file?key=${encodeURIComponent(newFile.storageKey)}`,
  );
  checks.push({
    name: "6. Pending edit image blocked publicly",
    pass: blocked.status === 403,
    detail: `status ${blocked.status}`,
  });

  // 7. Approve new image
  if (newRow) {
    const approveRes = await fetch(`${BASE}/api/upload/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ imageId: newRow.id, action: "approve" }),
    });
    checks.push({
      name: "7. Approve edit-upload image",
      pass: approveRes.ok,
      detail: approveRes.ok ? "approved" : `status ${approveRes.status}`,
    });

    const publicFile = await fetch(
      `${BASE}/api/upload/file?key=${encodeURIComponent(newFile.storageKey)}`,
    );
    checks.push({
      name: "8. Approved image publicly accessible",
      pass: publicFile.status === 200,
      detail: `status ${publicFile.status}`,
    });

    const slug = existingListing?.slug;
    if (slug) {
      const publicListingRes = await fetch(`${BASE}/api/listings/${listingId}`);
      const publicListing = publicListingRes.ok ? await publicListingRes.json() : null;
      const publicUrls = (publicListing?.listingImages || []).map((i: { url: string }) => i.url);
      const visible = publicUrls.some((u: string) => u.includes(encodeURIComponent(newFile.storageKey)) || u.includes(newFile.storageKey));
      checks.push({
        name: "9. Image on public listing API (approved only)",
        pass: visible,
        detail: `${publicUrls.length} approved images`,
      });
    }

    const ownerRes = await fetch(`${BASE}/api/listings/${listingId}`, {
      headers: { cookie: ownerCookie },
    });
    const ownerListing = ownerRes.ok ? await ownerRes.json() : null;
    const ownerCount = ownerListing?.listingImages?.length ?? 0;
    checks.push({
      name: "10. Image in owner dashboard API",
      pass: ownerCount >= 2,
      detail: `${ownerCount} images visible to owner`,
    });
  }

  // 11. Gallery-only edit path (no uploadResults) — backend sync fallback
  const listing2File = await uploadImage(ownerCookie);
  const create2 = await fetch(`${BASE}/api/listings/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({
      title: `Gallery-only edit test ${Date.now()}`,
      description: "Automated verification for gallery-only edit upload sync.",
      categorySlug: category.slug,
      countrySlug: city.state.country.slug,
      stateSlug: city.state.slug,
      citySlug: city.slug,
      price: 120,
      currency: "USD",
      tags: ["test"],
      services: [],
      profileImage: listing2File.url,
      galleryImages: [listing2File.url],
      uploadResults: [listing2File],
    }),
  });
  const create2Data = await create2.json();
  if (create2.ok && create2Data.listing?.id) {
    const listing2Id = create2Data.listing.id as string;
    await db.listing.update({ where: { id: listing2Id }, data: { status: "approved" } });
    await db.listingImage.updateMany({
      where: { listingId: listing2Id },
      data: { moderationStatus: "approved" },
    });

    const pendingBeforeGalleryOnly = await getPendingCount(adminCookie);
    const newFile2 = await uploadImage(ownerCookie);
    const row2 = await db.listing.findUnique({ where: { id: listing2Id } });
    const gallery2 = row2?.galleryImages
      ? (JSON.parse(row2.galleryImages as string) as string[])
      : [listing2File.url];

    const galleryOnlyPut = await fetch(`${BASE}/api/listings/${listing2Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        title: row2?.title,
        description: row2?.description,
        categorySlug: row2?.categorySlug,
        countrySlug: row2?.countrySlug,
        stateSlug: row2?.stateSlug,
        citySlug: row2?.citySlug,
        price: Number(row2?.price || 120),
        tags: [],
        services: [],
        profileImage: gallery2[0],
        galleryImages: [...gallery2, newFile2.url],
      }),
    });

    const syncedRow = await db.listingImage.findFirst({
      where: { listingId: listing2Id, storageKey: newFile2.storageKey },
    });
    const pendingAfterGalleryOnly = await getPendingCount(adminCookie);

    checks.push({
      name: "11. Gallery-only edit creates pending ListingImage",
      pass: galleryOnlyPut.ok && syncedRow?.moderationStatus === "pending",
      detail: galleryOnlyPut.ok
        ? syncedRow
          ? `status=${syncedRow.moderationStatus}`
          : "no row synced"
        : "PUT failed",
    });
    checks.push({
      name: "12. Gallery-only edit increases moderation queue",
      pass: pendingAfterGalleryOnly > pendingBeforeGalleryOnly,
      detail: `before=${pendingBeforeGalleryOnly} after=${pendingAfterGalleryOnly}`,
    });

    await db.listingImage.deleteMany({ where: { listingId: listing2Id } });
    await db.listing.delete({ where: { id: listing2Id } });
  } else {
    checks.push({
      name: "11. Gallery-only edit creates pending ListingImage",
      pass: false,
      detail: "Could not create secondary listing for fallback test",
    });
  }

  await finish(checks, cleanupListingId);
}

async function finish(checks: Check[], cleanupListingId?: string | null) {
  if (cleanupListingId) {
    await db.listingImage.deleteMany({ where: { listingId: cleanupListingId } }).catch(() => {});
    await db.listing.delete({ where: { id: cleanupListingId } }).catch(() => {});
  }

  const allPass = checks.every((c) => c.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    allPass,
    checks,
  };
  writeFileSync(path.join(OUT_DIR, "edit-upload-verification.json"), JSON.stringify(report, null, 2));

  console.log("\n=== Edit Upload Moderation Verification ===\n");
  for (const c of checks) {
    console.log(`${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  }
  console.log(`\nOverall: ${allPass ? "PASS" : "FAIL"}`);
  console.log(`Report: artifacts/image-moderation-audit/edit-upload-verification.json`);

  await db.$disconnect();
  if (!allPass) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});

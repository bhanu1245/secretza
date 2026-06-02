/**
 * Real E2E trace: 3 images create → approve → edit + 4th image → moderation queue
 * Run: npx tsx scripts/e2e-edit-upload-trace.ts
 */
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const BASE = process.env.BASE_URL || "http://localhost:3000";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function sessionCookie(email: string) {
  const user = await db.user.findFirst({
    where: { email },
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
  if (!user) throw new Error(`User ${email} not found`);
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
  return { cookie: `next-auth.session-token=${token}`, userId: user.id };
}

async function uploadImage(cookie: string, label: string) {
  const form = new FormData();
  form.append("files", new Blob([PNG], { type: "image/png" }), `${label}.png`);
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload ${label} failed: ${JSON.stringify(data)}`);
  const file = data.files[0];
  console.log(`[UPLOAD ${label}]`, {
    storageKey: file.storageKey || file.key,
    url: file.url,
    id: file.id,
  });
  return file;
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL is required.");
  }
  const { cookie, userId } = await sessionCookie(email);

  const cat = await db.category.findFirst({ where: { isActive: true, parentId: null } });
  const city = await db.city.findFirst({
    where: { isActive: true },
    include: { state: { include: { country: true } } },
  });
  if (!cat || !city?.state?.country) throw new Error("Need category + city");

  const f1 = await uploadImage(cookie, "img1");
  const f2 = await uploadImage(cookie, "img2");
  const f3 = await uploadImage(cookie, "img3");

  const createRes = await fetch(`${BASE}/api/listings/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: `E2E 3-img trace ${Date.now()}`,
      description: "End-to-end trace listing with three images minimum length.",
      categorySlug: cat.slug,
      countrySlug: city.state.country.slug,
      stateSlug: city.state.slug,
      citySlug: city.slug,
      price: 200,
      currency: "USD",
      tags: ["e2e"],
      services: [],
      profileImage: f1.url,
      galleryImages: [f1.url, f2.url, f3.url],
      uploadResults: [f1, f2, f3],
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(createData)}`);
  const listingId = createData.listing.id as string;
  console.log("\n[CREATE] listingId:", listingId);

  let rows = await db.listingImage.findMany({ where: { listingId }, orderBy: { sortOrder: "asc" } });
  console.log("[CREATE] ListingImage rows:", rows.length, rows.map((r) => ({ id: r.id, key: r.storageKey, status: r.moderationStatus })));

  await db.listing.update({ where: { id: listingId }, data: { status: "approved" } });
  await db.listingImage.updateMany({
    where: { listingId },
    data: { moderationStatus: "approved", reviewedAt: new Date() },
  });
  console.log("[APPROVE] listing + all images approved");

  const pendingBefore = await db.listingImage.count({ where: { moderationStatus: "pending" } });
  const modBefore = await fetch(`${BASE}/api/upload/moderate?status=pending&limit=5`, { headers: { cookie } });
  const modBeforeData = modBefore.ok ? await modBefore.json() : null;
  console.log("[QUEUE BEFORE EDIT] db pending:", pendingBefore, "api stats:", modBeforeData?.stats);

  const f4 = await uploadImage(cookie, "img4-new");
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  const gallery = JSON.parse(listing!.galleryImages as string) as string[];

  // Simulate form: existing keys = 3 loaded images
  const existingRows = await db.listingImage.findMany({ where: { listingId } });
  const existingImageKeys = new Set(existingRows.flatMap((r) => [r.id, r.url]));

  // Simulate buildUploadResultsForSubmit (current code)
  const allImages = [
    ...existingRows.map((r) => ({ id: r.id, url: r.url, uploadResult: undefined })),
    { id: f4.id, url: f4.url, uploadResult: { ...f4, storageKey: f4.storageKey || f4.key } },
  ];

  const uploadResultsBuggy = allImages
    .filter((img) => img.url && !String(img.url).startsWith("blob:"))
    .filter((img: any) => {
      if (img.uploadResult) return true;
      return !existingImageKeys.has(img.id) && !existingImageKeys.has(img.url);
    })
    .map((img: any) => img.uploadResult || {
      id: img.id,
      key: "",
      storageKey: "",
      url: img.url,
      sizeBytes: 0,
      mimeType: "image/jpeg",
    });

  console.log("\n[FORM SIMULATION] uploadResults count:", uploadResultsBuggy.length);
  console.log("[FORM SIMULATION] uploadResults:", JSON.stringify(uploadResultsBuggy, null, 2));

  const putPayload = {
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
    uploadResults: uploadResultsBuggy,
  };

  console.log("\n[PUT PAYLOAD] galleryImages:", putPayload.galleryImages.length, "uploadResults:", putPayload.uploadResults.length);

  const putRes = await fetch(`${BASE}/api/listings/${listingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(putPayload),
  });
  const putData = await putRes.json();
  console.log("[PUT] status:", putRes.status, putData);

  rows = await db.listingImage.findMany({ where: { listingId }, orderBy: { createdAt: "asc" } });
  const newRow = rows.find((r) => r.storageKey === (f4.storageKey || f4.key));
  console.log("\n[DB AFTER PUT] total rows:", rows.length);
  for (const r of rows) {
    console.log(" ", { id: r.id, listingId: r.listingId, storageKey: r.storageKey, status: r.moderationStatus, url: r.url.slice(0, 80) });
  }

  const pendingAfter = await db.listingImage.count({ where: { moderationStatus: "pending" } });
  const modAfter = await fetch(`${BASE}/api/upload/moderate?status=pending&limit=50`, { headers: { cookie } });
  const modAfterData = modAfter.ok ? await modAfter.json() : null;
  const inQueue = modAfterData?.images?.some((i: { id: string }) => i.id === newRow?.id);

  console.log("\n[QUEUE AFTER EDIT] db pending:", pendingAfter, "increase:", pendingAfter > pendingBefore);
  console.log("[QUEUE AFTER EDIT] new row in API queue:", inQueue, "newRow id:", newRow?.id);

  const listingAfter = await db.listing.findUnique({ where: { id: listingId } });
  const galleryAfter = JSON.parse(listingAfter!.galleryImages as string);
  console.log("[GALLERY JSON] length:", galleryAfter.length);

  await db.listingImage.deleteMany({ where: { listingId } });
  await db.listing.delete({ where: { id: listingId } });

  if (!newRow || newRow.moderationStatus !== "pending" || !inQueue) {
    console.error("\n*** FAIL: edit upload did not enter moderation queue ***");
    process.exit(1);
  }
  console.log("\n*** PASS ***");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

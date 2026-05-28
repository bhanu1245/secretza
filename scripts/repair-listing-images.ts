/**
 * Backfill ListingImage rows from files on disk when uploads succeeded
 * but DB links were never created (e.g. empty uploadResults on create).
 *
 * Usage: bun run scripts/repair-listing-images.ts [listingId]
 */
import { PrismaClient } from "@prisma/client";
import { readdir, stat } from "fs/promises";
import path from "path";
import { createStorageService } from "../src/lib/storage";
import { persistListingImages } from "../src/lib/listing-image-persist";

const db = new PrismaClient();
const storage = createStorageService();

async function listImageFiles(dir: string): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listImageFiles(full)));
    } else if (/\.(jpe?g|png|webp|gif)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

async function main() {
  const targetListingId = process.argv[2];

  const listings = targetListingId
    ? await db.listing.findMany({
        where: { id: targetListingId },
        include: { listingImages: true },
      })
    : await db.listing.findMany({ include: { listingImages: true } });

  let repaired = 0;

  for (const listing of listings) {
    if (listing.listingImages.length > 0) {
      console.log(`Skip ${listing.id} — already has ${listing.listingImages.length} image(s)`);
      continue;
    }

    const userDir = path.join(process.cwd(), "uploads", "listings", listing.userId);
    const diskFiles = await listImageFiles(userDir);

    if (diskFiles.length === 0) {
      console.log(`Skip ${listing.id} — no files for user ${listing.userId}`);
      continue;
    }

    const galleryUrls = diskFiles.map((filePath) => {
      const key = path
        .relative(path.join(process.cwd(), "uploads"), filePath)
        .replace(/\\/g, "/");
      return storage.getPublicUrl(key);
    });

    const profileImage = galleryUrls[0] || null;

    await db.listing.update({
      where: { id: listing.id },
      data: {
        profileImage,
        galleryImages: JSON.stringify(galleryUrls),
        images: JSON.stringify(
          galleryUrls.map((url, index) => ({ url, isPrimary: index === 0 })),
        ),
      } as any,
    });

    const count = await persistListingImages(listing.id, {
      galleryImages: galleryUrls,
      replace: true,
    });

    console.log(`Repaired ${listing.id} (${listing.title}): ${count} image(s)`);
    console.log(`  Example URL: ${galleryUrls[0]}`);
    repaired += 1;
  }

  console.log(`\nDone. Repaired ${repaired} listing(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

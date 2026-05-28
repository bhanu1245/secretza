import { PrismaClient } from "@prisma/client";
import { readdir, stat } from "fs/promises";
import path from "path";

const db = new PrismaClient();

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full)));
    } else if (/\.(jpe?g|png|webp|gif)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const listings = await db.listing.findMany({
    include: { listingImages: true },
  });

  console.log("=== Listings in DB ===");
  for (const l of listings) {
    console.log(
      JSON.stringify(
        {
          id: l.id,
          userId: l.userId,
          title: l.title,
          profileImage: l.profileImage,
          galleryImages: l.galleryImages,
          images: l.images,
          listingImageCount: l.listingImages.length,
        },
        null,
        2,
      ),
    );
  }

  const uploadsDir = path.resolve(process.cwd(), "uploads", "listings");
  const files = await listFiles(uploadsDir);
  console.log("\n=== Files on disk ===");
  for (const f of files) {
    const rel = path.relative(path.resolve(process.cwd(), "uploads"), f).replace(/\\/g, "/");
    console.log(rel);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

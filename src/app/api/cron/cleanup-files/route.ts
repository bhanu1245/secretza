import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { logInfo, logWarning } from "@/lib/monitoring";

/**
 * Cron endpoint: Cleanup orphaned uploaded files
 *
 * This endpoint should be called daily by a scheduler.
 * It performs:
 * 1. Finds all files in uploads/ directory
 * 2. Identifies orphaned files (not referenced in ListingImage table)
 * 3. Deletes orphaned files older than 24 hours (grace period for pending uploads)
 * 4. Cleans up expired verification tokens
 *
 * Security: Requires x-cron-secret header
 */
export async function GET(request: Request) {
  // Authentication: require cron secret header
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const stats = {
    filesScanned: 0,
    orphanedFilesDeleted: 0,
    bytesRecovered: 0,
    tokensCleaned: 0,
  };

  try {
    // ==========================================
    // Step 1: Clean expired verification tokens
    // ==========================================
    const deletedTokens = await db.verificationToken.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    stats.tokensCleaned = deletedTokens.count;

    // ==========================================
    // Step 2: Get all referenced storage keys from DB
    // ==========================================
    const referencedImages = await db.listingImage.findMany({
      select: { storageKey: true },
    });

    const referencedKeys = new Set(
      referencedImages.map((img) => img.storageKey).filter(Boolean)
    );

    // ==========================================
    // Step 3: Scan upload directories for orphaned files
    // ==========================================
    const uploadsDir = join(process.cwd(), "public", "uploads");
    const screenshotsDir = join(process.cwd(), "uploads", "screenshots");
    const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - gracePeriod;

    async function scanDirectory(dir: string) {
      try {
        const entries = await readdir(dir);
        for (const entry of entries) {
          const filePath = join(dir, entry);
          const fileStat = await stat(filePath);

          if (fileStat.isFile()) {
            stats.filesScanned++;
            const mtime = fileStat.mtimeMs;

            // Only delete files older than the grace period
            if (mtime < cutoff) {
              // Check if this file is referenced
              const storageKey = `listings/${entry}`;
              const screenshotKey = `screenshots/${entry}`;

              if (!referencedKeys.has(storageKey) && !referencedKeys.has(screenshotKey)) {
                try {
                  await unlink(filePath);
                  stats.orphanedFilesDeleted++;
                  stats.bytesRecovered += fileStat.size;
                  logInfo("Orphaned file deleted", { file: filePath, size: fileStat.size });
                } catch {
                  logWarning("Failed to delete orphaned file", { file: filePath });
                }
              }
            }
          } else if (fileStat.isDirectory()) {
            // Recursively scan subdirectories
            await scanDirectory(filePath);
          }
        }
      } catch {
        // Directory might not exist
      }
    }

    await scanDirectory(uploadsDir);
    await scanDirectory(screenshotsDir);

    // ==========================================
    // Step 4: Clean up orphaned ListingImage records (no actual file)
    // ==========================================
    // Images that reference non-existent files and are not attached to any listing
    // This is a safety net — these records are harmless but take up space
    // (We skip this in SQLite as it's low priority)

    const elapsed = Date.now() - startTime;

    logInfo("File cleanup cron completed", {
      stats,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      success: true,
      message: "File cleanup completed",
      stats,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error("File cleanup error:", error);

    return NextResponse.json(
      {
        error: "File cleanup failed",
        stats,
        elapsedMs: elapsed,
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readdir, stat, unlink } from "fs/promises";
import path, { join } from "path";
import { timingSafeEqual } from "crypto";
import { logInfo, logWarning, logError } from "@/lib/monitoring";
import { getUploadsBasePath } from "@/lib/storage";

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
  // Authentication: require cron secret header with constant-time comparison
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (!cronSecret || !expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(cronSecret, "utf-8");
  const b = Buffer.from(expectedSecret, "utf-8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
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
    const [referencedImages, paymentSubmissions] = await Promise.all([
      db.listingImage.findMany({
        select: { storageKey: true },
      }),
      db.manualPaymentSubmission.findMany({
        where: { screenshotUrl: { not: null } },
        select: { screenshotUrl: true },
      }),
    ]);

    const referencedKeys = new Set(
      referencedImages.map((img) => img.storageKey).filter(Boolean)
    );

    // Extract storage keys from payment screenshot URLs
    // URLs follow pattern: /api/upload/file?key=screenshots/file.jpg
    for (const sub of paymentSubmissions) {
      if (sub.screenshotUrl) {
        try {
          const url = new URL(sub.screenshotUrl, "http://localhost");
          const key = url.searchParams.get("key");
          if (key) referencedKeys.add(key);
        } catch {
          // If URL parsing fails, try using the raw value as a key
          referencedKeys.add(sub.screenshotUrl.replace(/^\/api\/upload\/file\?key=/, ""));
        }
      }
    }

    // ==========================================
    // Step 3: Scan upload directories for orphaned files
    // ==========================================
    const uploadsDir = getUploadsBasePath();
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
              const storageKey = filePath.replace(uploadsDir + path.sep, "").replace(/\\/g, "/");

              if (!referencedKeys.has(storageKey)) {
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
    logError(error, { component: "cron:cleanup-files", stats, elapsedMs: elapsed });

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

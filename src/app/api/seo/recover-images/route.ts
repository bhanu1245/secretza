/**
 * POST /api/seo/recover-images
 *
 * Recovers missing category_city SEO image files on disk without modifying
 * any page content or featuredImage DB values.
 *
 * Strategy:
 *   1. Derive expected storage key from pageSlug (same logic as generation).
 *   2. For local storage: skip if file exists on disk.
 *   3. For cloud (R2/S3): always re-upload (idempotent overwrite is safe).
 *   4. Write the SVG using the page's existing h1/title/metaDescription.
 *   5. Does NOT update SeoPage.featuredImage, content, or any DB field.
 *
 * Call in a loop from the client:
 *   POST { offset: 0, batchSize: 100 } → { regenerated, skipped, hasMore, nextOffset }
 *   POST { offset: 100, batchSize: 100 } → …
 *   … until hasMore === false
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import {
  buildSeoPlaceholderSvg,
  seoImageStorageKey,
} from "@/lib/seo-images";
import { createStorageService, getUploadsBasePath } from "@/lib/storage";
import { logError } from "@/lib/monitoring";
import { existsSync } from "fs";
import { writeFile, mkdir, stat } from "fs/promises";
import path from "path";

const DEFAULT_BATCH = 100;
const UPLOADS_BASE = getUploadsBasePath();

/** True when the storage provider is local filesystem. */
function isLocalStorage(): boolean {
  const p = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  return p === "local";
}

/**
 * Derive the absolute local disk path for a storage key.
 * e.g. "seo/category_city/escorts--mumbai.svg"
 *   → "<cwd>/uploads/seo/category_city/escorts--mumbai.svg"
 */
function localPathForKey(storageKey: string): string {
  return path.resolve(UPLOADS_BASE, storageKey);
}

interface RecoverStats {
  scanned: number;
  regenerated: number;
  skipped: number;
  errors: number;
  diskBytesWritten: number;
  elapsedMs: number;
  hasMore: boolean;
  nextOffset: number;
  errorSamples: string[];
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      dryRun?: boolean;
      batchSize?: number;
      offset?: number;
    };

    const dryRun = body.dryRun === true;
    const batchSize = typeof body.batchSize === "number"
      ? Math.min(Math.max(1, body.batchSize), 500)
      : DEFAULT_BATCH;
    const offset = typeof body.offset === "number" ? Math.max(0, body.offset) : 0;

    const startTime = Date.now();
    const storage = createStorageService();
    const local = isLocalStorage();

    // Fetch one batch of category_city pages
    const [pages, totalCount] = await Promise.all([
      db.seoPage.findMany({
        where: { pageType: "category_city" },
        select: {
          id: true,
          pageSlug: true,
          pageType: true,
          h1: true,
          title: true,
          metaDescription: true,
        },
        orderBy: { pageSlug: "asc" },
        skip: offset,
        take: batchSize,
      }),
      db.seoPage.count({ where: { pageType: "category_city" } }),
    ]);

    let scanned = 0;
    let regenerated = 0;
    let skipped = 0;
    let diskBytesWritten = 0;
    const errorSamples: string[] = [];

    for (const page of pages) {
      scanned++;
      const storageKey = seoImageStorageKey(page.pageType, page.pageSlug);

      // ── Existence check ───────────────────────────────────────────────
      if (local) {
        const filePath = localPathForKey(storageKey);
        if (existsSync(filePath)) {
          skipped++;
          continue;
        }
      }
      // For cloud providers: always regenerate (idempotent overwrite)

      if (dryRun) {
        regenerated++;
        diskBytesWritten += 1082; // avg SVG size
        continue;
      }

      // ── Generate SVG ─────────────────────────────────────────────────
      try {
        const headline = (page.h1 || page.title || page.pageSlug).trim();
        const subtitle = (page.metaDescription || "Adult Classifieds India").trim();
        const buffer = buildSeoPlaceholderSvg(headline, subtitle);

        if (local) {
          // Write directly to disk — bypasses storage.upload to avoid DB update
          const filePath = localPathForKey(storageKey);
          await mkdir(path.dirname(filePath), { recursive: true });
          await writeFile(filePath, buffer);
          // Confirm write
          const s = await stat(filePath);
          diskBytesWritten += s.size;
        } else {
          // Cloud: upload via storage service (overwrites if exists)
          const result = await storage.upload(storageKey, buffer, "image/svg+xml");
          diskBytesWritten += result.sizeBytes;
        }

        regenerated++;
      } catch (err) {
        const msg = `${page.pageSlug}: ${err instanceof Error ? err.message : String(err)}`;
        if (errorSamples.length < 10) errorSamples.push(msg);
      }
    }

    const processed = offset + pages.length;
    const hasMore = processed < totalCount;

    const stats: RecoverStats = {
      scanned,
      regenerated,
      skipped,
      errors: errorSamples.length,
      diskBytesWritten,
      elapsedMs: Date.now() - startTime,
      hasMore,
      nextOffset: hasMore ? offset + batchSize : offset,
      errorSamples,
    };

    return NextResponse.json({
      success: true,
      dryRun,
      totalCategoryCity: totalCount,
      processedSoFar: processed,
      ...stats,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/recover-images" });
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}

/** GET /api/seo/recover-images — returns how many files are missing on disk. */
export async function GET(): Promise<NextResponse> {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isLocalStorage()) {
      return NextResponse.json({
        message: "Existence check not supported for cloud storage without listing. Use POST to regenerate.",
        storageProvider: process.env.STORAGE_PROVIDER ?? "local",
      });
    }

    const pages = await db.seoPage.findMany({
      where: { pageType: "category_city" },
      select: { pageSlug: true, pageType: true },
    });

    let missing = 0;
    let present = 0;
    for (const page of pages) {
      const key = seoImageStorageKey(page.pageType, page.pageSlug);
      if (existsSync(localPathForKey(key))) {
        present++;
      } else {
        missing++;
      }
    }

    return NextResponse.json({
      total: pages.length,
      present,
      missing,
      percentComplete: pages.length > 0
        ? ((present / pages.length) * 100).toFixed(1)
        : "100.0",
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/recover-images:GET" });
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}

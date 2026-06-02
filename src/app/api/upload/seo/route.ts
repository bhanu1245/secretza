import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService } from "@/lib/storage";
import { requireMinRole } from "@/lib/auth-helpers";
import {
  extensionForMime,
  seoImageStorageKey,
  validateSeoImageFile,
} from "@/lib/seo-images";
import { logError } from "@/lib/monitoring";

/**
 * POST /api/upload/seo
 * Upload a featured image for an SEO page (stored under uploads/seo/).
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const pageType = String(formData.get("pageType") || "custom");
    const pageSlug = String(formData.get("pageSlug") || "image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validationError = validateSeoImageFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionForMime(file.type);
    const key = seoImageStorageKey(pageType, pageSlug, ext);
    const storage = createStorageService();
    const result = await storage.upload(key, buffer, file.type);

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      storageKey: result.key,
      sizeBytes: result.sizeBytes,
      mimeType: file.type,
    });
  } catch (error) {
    logError(error, { component: "route:api/upload/seo" });
    return NextResponse.json({ error: "Failed to upload SEO image" }, { status: 500 });
  }
}

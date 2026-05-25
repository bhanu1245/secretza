import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

// ==========================================
// POST /api/upload — Upload a listing image
// ==========================================
// Accepts FormData with a "file" field.
// Saves the file to public/uploads/listings/.
// Returns image metadata for later association with a listing.
//
// The file is saved to disk immediately. The ListingImage DB record
// is created when the listing is submitted (POST /api/listings),
// not here — because ListingImage.listingId is required and we
// don't have a listing ID yet.
// ==========================================

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "listings");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Magic-byte detection for actual MIME type validation
function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    (buffer[3] === 0x38) &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    // Auth guard
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limit: 30 uploads per hour per user
    const rl = rateLimit(`upload:${session.user.id}`, RATE_LIMITS.upload);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size first (before reading entire buffer)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 20MB` },
        { status: 400 }
      );
    }

    // Read file buffer for magic-byte validation
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate using magic bytes (not client-provided Content-Type)
    const detectedMime = detectMimeType(buffer);
    if (!detectedMime || !ACCEPTED_TYPES.includes(detectedMime)) {
      return NextResponse.json(
        { error: `Invalid file type. Accepted: JPEG, PNG, WEBP, GIF. Detected: ${detectedMime || "unknown"}` },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename preserving extension
    const ext = detectedMime.split("/")[1] === "jpeg" ? "jpg" : detectedMime.split("/")[1];
    const filename = `${randomUUID()}.${ext}`;
    const storageKey = `listings/${filename}`;
    const filePath = join(UPLOAD_DIR, filename);

    // Path traversal guard
    const resolvedPath = resolve(filePath);
    const resolvedBase = resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Write file to disk
    await writeFile(filePath, buffer);

    // Return upload result — this data will be sent back when creating the listing
    // The listing API will use this to create a ListingImage record
    const url = `/uploads/${storageKey}`;

    return NextResponse.json({
      id: randomUUID(), // Unique upload ID for tracking
      url,
      storageKey,
      fileName: filename,
      sizeBytes: file.size,
      mimeType: detectedMime, // Use detected MIME, not client-provided
      // Width and height will be filled client-side and sent with the listing
      width: 0,
      height: 0,
    });
  } catch (error) {
    console.error("[POST /api/upload] Failed:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

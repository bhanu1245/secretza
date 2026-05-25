import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

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

export async function POST(request: Request) {
  try {
    // Auth guard
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Accepted: JPEG, PNG, WEBP, GIF` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 20MB` },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename preserving extension
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const storageKey = `listings/${filename}`;
    const filePath = join(UPLOAD_DIR, filename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Return upload result — this data will be sent back when creating the listing
    // The listing API will use this to create a ListingImage record
    const url = `/uploads/${storageKey}`;

    return NextResponse.json({
      id: randomUUID(), // Unique upload ID for tracking
      url,
      storageKey,
      fileName: filename,
      sizeBytes: file.size,
      mimeType: file.type,
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

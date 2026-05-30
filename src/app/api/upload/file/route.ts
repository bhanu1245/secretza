import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService } from "@/lib/storage";
import { canAccessListingImageFile } from "@/lib/image-moderation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing file key" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const viewer = session?.user
      ? { id: session.user.id, role: session.user.role as string }
      : undefined;

    const allowed = await canAccessListingImageFile(key, viewer);
    if (!allowed) {
      return NextResponse.json({ error: "Image not available" }, { status: 403 });
    }

    const storage = createStorageService();
    const provider = storage.getProvider();

    if (provider !== "local") {
      const url = await storage.getUrl(key);
      return NextResponse.redirect(url);
    }

    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const filePath = path.resolve(process.cwd(), "uploads", key);
    const basePath = path.resolve(process.cwd(), "uploads");

    if (!filePath.startsWith(basePath + path.sep)) {
      console.warn("[UploadFile] invalid key", { key });
      return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
    }

    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Cache-Control":
          key.startsWith("listings/") ? "private, max-age=3600" : "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.warn("[UploadFile] failed to serve file", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

function contentTypeFor(key: string) {
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

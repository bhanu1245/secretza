import { NextResponse } from "next/server";
import { createStorageService } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing file key" }, { status: 400 });
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.warn("[UploadFile] failed to serve file", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

function contentTypeFor(key: string) {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

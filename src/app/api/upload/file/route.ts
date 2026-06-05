import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService, resolveUploadStoragePath } from "@/lib/storage";
import { authorizeUploadedFileAccess } from "@/lib/image-moderation";

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

    const allowed = await authorizeUploadedFileAccess(key, viewer);
    if (!allowed) {
      const prefix = key.split("/")[0] ?? "unknown";
      console.warn("[UploadFile] denied access", {
        prefix,
        viewerId: viewer?.id ?? null,
        role: viewer?.role ?? null,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storage = createStorageService();
    const provider = storage.getProvider();

    if (provider !== "local") {
      const url = await storage.getUrl(key);
      return NextResponse.redirect(url);
    }

    const { readFile } = await import("fs/promises");
    const filePath = resolveUploadStoragePath(key);

    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Cache-Control": cacheControlFor(key),
      },
    });
  } catch (error) {
    console.warn("[UploadFile] failed to serve file", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

/** Cache policy by key prefix — sensitive screenshots are never cached by shared caches. */
function cacheControlFor(key: string): string {
  if (key.startsWith("screenshots/")) {
    // Payment proofs: sensitive — no shared/CDN caching, no storage.
    return "private, no-store, max-age=0";
  }
  if (key.startsWith("listings/")) {
    return "private, max-age=3600";
  }
  if (key.startsWith("seo/")) {
    return "public, max-age=31536000, immutable";
  }
  return "private, no-store, max-age=0";
}

function contentTypeFor(key: string) {
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

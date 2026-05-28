import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService } from "@/lib/storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type UploadedFileResponse = {
  id: string;
  key: string;
  storageKey: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
};

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn("[Upload] rejected unauthenticated upload request");
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    if (files.length > 20) {
      return NextResponse.json({ error: "Maximum 20 files allowed" }, { status: 400 });
    }

    const storage = createStorageService();
    const uploaded: UploadedFileResponse[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        console.warn("[Upload] invalid mime type", {
          userId: session.user.id,
          fileName: file.name,
          mimeType: file.type,
        });
        return NextResponse.json({ error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        console.warn("[Upload] file too large", {
          userId: session.user.id,
          fileName: file.name,
          sizeBytes: file.size,
        });
        return NextResponse.json({ error: "Each image must be 10MB or smaller" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const key = `listings/${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
      const result = await storage.upload(key, buffer, file.type);

      uploaded.push({
        id: key,
        key: result.key,
        storageKey: result.key,
        url: result.url,
        sizeBytes: result.sizeBytes,
        mimeType: file.type,
        fileName: file.name,
      });
    }

    console.log("[Upload] uploaded listing images", {
      userId: session.user.id,
      count: uploaded.length,
      keys: uploaded.map((file) => file.key),
    });

    return NextResponse.json({ files: uploaded });
  } catch (error) {
    console.error("[Upload] failed to upload listing image", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

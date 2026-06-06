import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStorageService } from "@/lib/storage";
import { processImage, validateImage } from "@/lib/image-processing";
import { appendUploadAccessToken, createUploadAccessToken } from "@/lib/upload-access-token";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
type UploadedFileResponse = {
  id: string;
  key: string;
  storageKey: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  previewUrl: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  blurHash: string;
  fileName: string;
};

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
      if (file.size > MAX_FILE_SIZE) {
        console.warn("[Upload] file too large", {
          userId: session.user.id,
          fileName: file.name,
          sizeBytes: file.size,
        });
        return NextResponse.json({ error: "Each image must be 10MB or smaller" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = await validateImage(buffer, file.name);
      if (!validation.valid) {
        console.warn("[Upload] invalid image", {
          userId: session.user.id,
          fileName: file.name,
          mimeType: validation.mimeType || file.type,
          error: validation.error,
        });
        return NextResponse.json({ error: validation.error || "Unsupported image file" }, { status: 400 });
      }

      let processed;
      try {
        processed = await processImage(buffer);
      } catch (error) {
        console.warn("[Upload] image processing failed", {
          userId: session.user.id,
          fileName: file.name,
          mimeType: validation.mimeType || file.type,
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
          {
            error:
              validation.mimeType === "image/heic" || validation.mimeType === "image/heif"
                ? "This HEIC/HEIF image could not be converted on the server. Please choose JPEG, PNG, or WebP."
                : "Image processing failed. Please try a different image.",
          },
          { status: 400 },
        );
      }

      const baseKey = `listings/${session.user.id}/${Date.now()}-${crypto.randomUUID()}`;
      const key = `${baseKey}.webp`;
      const thumbnailKey = `${baseKey}-thumb.webp`;
      const mediumKey = `${baseKey}-medium.webp`;

      const [originalResult, thumbnailResult, mediumResult] = await Promise.all([
        storage.upload(key, processed.original, processed.mimeType),
        storage.upload(thumbnailKey, processed.thumbnail, processed.mimeType),
        storage.upload(mediumKey, processed.medium, processed.mimeType),
      ]);

      // Mint a short-lived signed preview URL for the thumbnail so the uploader
      // can render it immediately, before any ListingImage row exists and
      // regardless of session resolution on the <img> subresource request.
      const previewSignature = createUploadAccessToken(thumbnailResult.key);
      const previewUrl = appendUploadAccessToken(
        thumbnailResult.url,
        previewSignature.token,
        previewSignature.exp,
      );

      uploaded.push({
        id: key,
        key: originalResult.key,
        storageKey: originalResult.key,
        url: originalResult.url,
        thumbnailUrl: thumbnailResult.url,
        mediumUrl: mediumResult.url,
        previewUrl,
        sizeBytes: originalResult.sizeBytes,
        mimeType: processed.mimeType,
        width: processed.width,
        height: processed.height,
        blurHash: processed.blurHash,
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

import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { createStorageService } from "@/lib/storage";
import { db } from "@/lib/db";
import { getPaymentSettings } from "@/lib/payment-settings";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      console.warn("[PaymentQRUpload] rejected unauthenticated upload");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file =
      formData.get("qrImage") instanceof File
        ? (formData.get("qrImage") as File)
        : formData.get("files") instanceof File
          ? (formData.get("files") as File)
          : null;

    if (!file) {
      console.warn("[PaymentQRUpload] no file in request", {
        fields: Array.from(formData.keys()),
      });
      return NextResponse.json({ error: "No QR image uploaded" }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      console.warn("[PaymentQRUpload] invalid mime type", {
        fileName: file.name,
        mimeType: file.type,
      });
      return NextResponse.json(
        { error: "Only JPG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      console.warn("[PaymentQRUpload] file too large", {
        fileName: file.name,
        sizeBytes: file.size,
      });
      return NextResponse.json({ error: "QR image must be 2MB or smaller" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = createStorageService();
    const key = `payments/qr/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const uploaded = await storage.upload(key, buffer, file.type);

    const existing = await getPaymentSettings();
    await db.paymentSettings.update({
      where: { id: existing.id },
      data: { qrImageUrl: uploaded.url },
    });

    console.log("[PaymentQRUpload] saved payment QR", {
      adminId: admin.id,
      key: uploaded.key,
      url: uploaded.url,
    });

    return NextResponse.json({
      qrImageUrl: uploaded.url,
      storageKey: uploaded.key,
    });
  } catch (error) {
    console.error("[PaymentQRUpload] failed to upload payment QR", error);
    return NextResponse.json({ error: "Failed to upload QR image" }, { status: 500 });
  }
}

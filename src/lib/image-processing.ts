// ==========================================
// Secretza Image Processing Pipeline
// ==========================================
// Validates, normalises, and multi-size-encodes uploaded images using sharp.
// Produces thumbnails, medium variants, and processed originals — all in WebP.
// Strips EXIF data for privacy. Generates a BlurHash placeholder string.

import sharp from "sharp";
import { encode } from "blurhash";

// ==========================================
// Constants
// ==========================================

/** Maximum allowed file size: 10 MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types (checked via magic bytes, not extension) */
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Maximum pixel dimensions */
export const MAX_DIMENSIONS = { width: 8000, height: 8000 } as const;

/** Minimum pixel dimensions */
export const MIN_DIMENSIONS = { width: 50, height: 50 } as const;

// ==========================================
// Type Definitions
// ==========================================

export interface ProcessedImage {
  thumbnail: Buffer;
  medium: Buffer;
  original: Buffer;
  width: number;
  height: number;
  mimeType: string;
  blurHash: string;
}

export interface ImageValidation {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
}

// ==========================================
// Magic-byte detection
// ==========================================

/**
 * Detect the actual MIME type of a buffer by inspecting its leading bytes.
 * This is more reliable than trusting the file extension.
 */
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
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

// ==========================================
// Validation
// ==========================================

/**
 * Validate an image buffer.
 *
 * Checks performed (in order):
 *  1. File size ≤ 10 MB
 *  2. Magic bytes match an allowed type
 *  3. Sharp can parse the file and reports valid metadata
 *  4. Dimensions are within [50×50 … 8000×8000]
 */
export async function validateImage(buffer: Buffer, fileName: string): Promise<ImageValidation> {
  // 1. File size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is ${
        MAX_FILE_SIZE / 1024 / 1024
      } MB.`,
      sizeBytes: buffer.length,
    };
  }

  // 2. Magic-byte MIME detection
  const detectedMime = detectMimeType(buffer);
  if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime as typeof ALLOWED_MIME_TYPES[number])) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}. File: "${fileName}"`,
      mimeType: detectedMime ?? "unknown",
      sizeBytes: buffer.length,
    };
  }

  // 3. Sharp metadata check
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return {
      valid: false,
      error: "File is corrupted or not a valid image.",
      mimeType: detectedMime,
      sizeBytes: buffer.length,
    };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // 4. Dimension checks
  if (width < MIN_DIMENSIONS.width || height < MIN_DIMENSIONS.height) {
    return {
      valid: false,
      error: `Image too small (${width}×${height}). Minimum: ${MIN_DIMENSIONS.width}×${MIN_DIMENSIONS.height}.`,
      width,
      height,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
    };
  }

  if (width > MAX_DIMENSIONS.width || height > MAX_DIMENSIONS.height) {
    return {
      valid: false,
      error: `Image too large (${width}×${height}). Maximum: ${MAX_DIMENSIONS.width}×${MAX_DIMENSIONS.height}.`,
      width,
      height,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
    };
  }

  return {
    valid: true,
    width,
    height,
    mimeType: detectedMime,
    sizeBytes: buffer.length,
  };
}

// ==========================================
// Processing
// ==========================================

/**
 * Process an image buffer into production-ready assets.
 *
 * Pipeline per variant:
 *   rotate(EXIF) → strip EXIF → resize → webp(quality)
 *
 * Returns three buffers (thumbnail, medium, original) plus metadata and a
 * BlurHash string computed from the thumbnail.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // First pass: get original metadata (EXIF rotation still present for width/height)
  const srcMetadata = await sharp(buffer).metadata();
  const width = srcMetadata.width ?? 0;
  const height = srcMetadata.height ?? 0;
  const mimeType = "image/webp"; // All outputs are WebP

  // Helper: build a sharp pipeline that auto-rotates, strips EXIF, resizes, and outputs WebP.
  const pipeline = (targetWidth: number, maxHeight: number, quality: number) =>
    sharp(buffer)
      .rotate() // auto-rotate based on EXIF orientation
      .resize(targetWidth, maxHeight, {
        fit: "inside",       // contain within the bounding box
        withoutEnlargement: true, // don't upscale small images
      })
      .webp({ quality });

  // ---- Thumbnail (300px wide, max 400px tall, quality 70) ----
  const thumbnail = await pipeline(300, 400, 70).toBuffer();

  // ---- Medium (800px wide, max 1000px tall, quality 80) ----
  const medium = await pipeline(800, 1000, 80).toBuffer();

  // ---- Original (up to 4000px, quality 85) ----
  const original = await pipeline(4000, 4000, 85).toBuffer();

  // ---- BlurHash from thumbnail ----
  const blurHash = await generateBlurHash(thumbnail);

  return {
    thumbnail,
    medium,
    original,
    width,
    height,
    mimeType,
    blurHash,
  };
}

// ==========================================
// BlurHash generation
// ==========================================

/**
 * Encode a WebP (or any image) buffer into a BlurHash string.
 *
 * The image is decoded to raw RGB pixels via sharp, then passed directly
 * to the blurhash library which expects a Uint8ClampedArray of RGB values.
 */
async function generateBlurHash(imageBuffer: Buffer, xComponents = 4, yComponents = 3): Promise<string> {
  // Decode to raw RGB pixels (blurhash only needs RGB, not alpha)
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, { fit: "inside", withoutEnlargement: true }) // downscale for speed
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // sharp raw output with .removeAlpha() is a flat Buffer of R,G,B,R,G,B,...
  // blurhash.encode expects Uint8ClampedArray of RGB values.
  const rgbData = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  return encode(rgbData, info.width, info.height, xComponents, yComponents);
}

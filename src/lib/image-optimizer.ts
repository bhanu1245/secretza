import sharp from "sharp";

export interface ImageOptimizeOptions {
  /** Maximum width in pixels. Default: 1200 */
  maxWidth?: number;
  /** Maximum height in pixels. Default: 1200 */
  maxHeight?: number;
  /** Output quality (1-100). Default: 80 */
  quality?: number;
  /** Output format. Default: 'webp' */
  format?: "webp" | "jpeg" | "png";
  /** Generate a thumbnail? Default: true */
  generateThumbnail?: boolean;
  /** Thumbnail max width. Default: 400 */
  thumbnailWidth?: number;
}

export interface OptimizeResult {
  /** Optimized main image buffer */
  optimized: Buffer;
  /** Optimized main image info */
  info: {
    width: number;
    height: number;
    size: number;
    format: string;
  };
  /** Thumbnail buffer (if requested) */
  thumbnail?: Buffer;
  /** Thumbnail info */
  thumbnailInfo?: {
    width: number;
    height: number;
    size: number;
  };
  /** BlurHash string for placeholder */
  blurHash?: string;
}

/**
 * Optimize an image buffer using Sharp.
 * Returns the optimized image, optional thumbnail, and metadata.
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  options: ImageOptimizeOptions = {}
): Promise<OptimizeResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 80,
    format = "webp",
    generateThumbnail = true,
    thumbnailWidth = 400,
  } = options;

  // Get metadata from original image
  const metadata = await sharp(inputBuffer).metadata();

  // Build the main image pipeline
  const mainPipeline = sharp(inputBuffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .rotate(); // Auto-rotate based on EXIF

  // Set output format
  switch (format) {
    case "webp":
      mainPipeline.webp({ quality });
      break;
    case "jpeg":
      mainPipeline.jpeg({ quality, mozjpeg: true });
      break;
    case "png":
      mainPipeline.png({ quality });
      break;
  }

  // Generate optimized main image
  const [optimized, mainMetadata] = await Promise.all([
    mainPipeline.toBuffer(),
    mainPipeline.metadata(),
  ]);

  const info = {
    width: mainMetadata.width || metadata.width || 0,
    height: mainMetadata.height || metadata.height || 0,
    size: optimized.length,
    format: mainMetadata.format || format,
  };

  const result: OptimizeResult = { optimized, info };

  // Generate thumbnail
  if (generateThumbnail) {
    const thumbPipeline = sharp(inputBuffer)
      .resize(thumbnailWidth, thumbnailWidth, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .rotate();

    switch (format) {
      case "webp":
        thumbPipeline.webp({ quality: 70 });
        break;
      case "jpeg":
        thumbPipeline.jpeg({ quality: 70, mozjpeg: true });
        break;
      case "png":
        thumbPipeline.png({ quality: 70 });
        break;
    }

    const [thumbnail, thumbMeta] = await Promise.all([
      thumbPipeline.toBuffer(),
      thumbPipeline.metadata(),
    ]);

    result.thumbnail = thumbnail;
    result.thumbnailInfo = {
      width: thumbMeta.width || 0,
      height: thumbMeta.height || 0,
      size: thumbnail.length,
    };
  }

  return result;
}

/**
 * Get basic image metadata without full processing.
 */
export async function getImageMetadata(inputBuffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  hasAlpha: boolean;
}> {
  const metadata = await sharp(inputBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    sizeBytes: inputBuffer.length,
    hasAlpha: metadata.hasAlpha || false,
  };
}

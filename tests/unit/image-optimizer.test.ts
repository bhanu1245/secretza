import { describe, it, expect } from "vitest";
import sharp from "sharp";

describe("Image Optimizer", () => {
  it("should be able to create a test image with sharp", async () => {
    // Create a small test image
    const testBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    expect(testBuffer.length).toBeGreaterThan(0);

    // Verify it's a valid PNG
    const metadata = await sharp(testBuffer).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
    expect(metadata.format).toBe("png");
  });

  it("should resize images correctly", async () => {
    const testBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const resized = await sharp(testBuffer)
      .resize(100, 100, { fit: "inside", withoutEnlargement: true })
      .toBuffer();

    const metadata = await sharp(resized).metadata();
    expect(metadata.width).toBeLessThanOrEqual(100);
    expect(metadata.height).toBeLessThanOrEqual(100);
    // Since it's withoutEnlargement and original is larger, it should be exactly 100
    expect(metadata.width).toBe(100);
  });
});

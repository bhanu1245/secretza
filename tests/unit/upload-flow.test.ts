import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { hasHeicRuntimeSupport, processImage, validateImage } from "@/lib/image-processing";
import { createStorageService, getUploadsBasePath, resolveUploadStoragePath } from "@/lib/storage";

const originalEnv = { ...process.env };
const tempDirs: string[] = [];
const originalCwd = process.cwd();

async function makeTempUploadsDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "secretza-uploads-"));
  tempDirs.push(dir);
  return dir;
}

async function makeImageBuffer(width = 100, height = 100) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 60, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

afterEach(async () => {
  process.env = { ...originalEnv };
  process.chdir(originalCwd);
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("upload flow storage and processing", () => {
  it("uses an explicit persistent uploads directory in production local storage", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.STORAGE_PROVIDER = "local";
    delete process.env.UPLOADS_DIR;

    expect(() => getUploadsBasePath()).toThrow(/UPLOADS_DIR is required/);
  });

  it("serves local uploads through the guarded API route, not direct public paths", async () => {
    process.env.STORAGE_PROVIDER = "local";
    process.env.UPLOADS_DIR = await makeTempUploadsDir();
    process.env.LOCAL_PUBLIC_URL = "https://secretza.com/uploads";

    const storage = createStorageService();
    const result = await storage.upload("listings/user-1/one.webp", await makeImageBuffer(), "image/webp");

    expect(result.url).toBe("/api/upload/file?key=listings%2Fuser-1%2Fone.webp");
    expect(await readFile(path.join(process.env.UPLOADS_DIR, "listings/user-1/one.webp"))).toBeTruthy();
  });

  it("keeps files readable across a new storage service instance", async () => {
    process.env.STORAGE_PROVIDER = "local";
    process.env.UPLOADS_DIR = await makeTempUploadsDir();

    const firstService = createStorageService();
    await firstService.upload("listings/user-1/restart.webp", await makeImageBuffer(), "image/webp");

    const restartedService = createStorageService();
    const secondResult = await restartedService.upload("listings/user-1/after-restart.webp", await makeImageBuffer(), "image/webp");

    expect(secondResult.url).toContain("/api/upload/file?key=");
    await expect(readFile(path.join(process.env.UPLOADS_DIR, "listings/user-1/restart.webp"))).resolves.toBeTruthy();
  });

  it("resolves reads and writes from UPLOADS_DIR even when cwd is standalone output", async () => {
    const projectRoot = await makeTempUploadsDir();
    const standaloneDir = path.join(projectRoot, ".next", "standalone");
    const uploadsDir = path.join(projectRoot, "uploads");
    await rm(standaloneDir, { recursive: true, force: true });
    await import("fs/promises").then(({ mkdir }) => mkdir(standaloneDir, { recursive: true }));

    process.env.STORAGE_PROVIDER = "local";
    process.env.UPLOADS_DIR = uploadsDir;
    process.chdir(standaloneDir);

    const storage = createStorageService();
    const result = await storage.upload("listings/user-1/standalone.webp", await makeImageBuffer(), "image/webp");
    const physicalPath = resolveUploadStoragePath("listings/user-1/standalone.webp");

    expect(result.url).toBe("/api/upload/file?key=listings%2Fuser-1%2Fstandalone.webp");
    expect(physicalPath).toBe(path.join(uploadsDir, "listings", "user-1", "standalone.webp"));
    await expect(readFile(physicalPath)).resolves.toBeTruthy();
    await expect(readFile(path.join(standaloneDir, "uploads", "listings", "user-1", "standalone.webp"))).rejects.toThrow();
  });

  it.each([1, 5, 20])("writes %i listing images without changing URL contract", async (count) => {
    process.env.STORAGE_PROVIDER = "local";
    process.env.UPLOADS_DIR = await makeTempUploadsDir();

    const storage = createStorageService();
    const buffer = await makeImageBuffer();
    const uploads = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        storage.upload(`listings/user-1/${index}.webp`, buffer, "image/webp"),
      ),
    );

    expect(uploads).toHaveLength(count);
    expect(uploads.every((upload) => upload.url.startsWith("/api/upload/file?key="))).toBe(true);
  });

  it("processes large mobile camera-style images into usable WebP variants", async () => {
    const original = await makeImageBuffer(3200, 2400);
    const validation = await validateImage(original, "camera.jpg");
    const processed = await processImage(original);

    expect(validation.valid).toBe(true);
    expect(processed.mimeType).toBe("image/webp");
    expect(processed.thumbnail.length).toBeGreaterThan(0);
    expect(processed.medium.length).toBeGreaterThan(0);
    expect(processed.original.length).toBeGreaterThan(0);
  }, 20_000);

  it("rejects invalid upload payloads with an actionable validation error", async () => {
    const validation = await validateImage(Buffer.from("not an image"), "broken.jpg");

    expect(validation.valid).toBe(false);
    expect(validation.error).toMatch(/Unsupported file type|corrupted|valid image/i);
  });

  it("detects iPhone HEIC/HEIF payloads before server conversion", async () => {
    const header = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const validation = await validateImage(header, "iphone.heic");

    expect(validation.valid).toBe(false);
    expect(validation.mimeType).toBe("image/heic");
    if (!hasHeicRuntimeSupport()) {
      expect(validation.error).toMatch(/HEIC\/HEIF images are not supported/);
    }
  });

  it("reports whether the server runtime can decode HEIC/HEIF", () => {
    expect(typeof hasHeicRuntimeSupport()).toBe("boolean");
  });
});

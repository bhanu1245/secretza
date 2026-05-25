// ==========================================
// Secretza Storage Abstraction Layer
// ==========================================
// Supports Cloudflare R2 (preferred), AWS S3 (fallback), and local filesystem (development).
// Environment variables are read once via createStorageService() to produce a singleton.

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, readFile, unlink, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ==========================================
// Type Definitions
// ==========================================

export type StorageProvider = "r2" | "s3" | "local";

export interface StorageConfig {
  provider: StorageProvider;
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string; // CDN base URL for constructing public links
}

export interface UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface SignedUploadUrl {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

// ==========================================
// StorageService
// ==========================================

export class StorageService {
  private config: StorageConfig;
  private s3Client: S3Client | null = null;
  private localBasePath: string;

  constructor(config: StorageConfig) {
    this.config = config;
    this.localBasePath = path.resolve(process.cwd(), "uploads");

    // Initialise the S3-compatible client for R2 or S3 providers
    if (config.provider === "r2" || config.provider === "s3") {
      this.s3Client = new S3Client({
        region: config.region ?? "auto",
        endpoint: config.endpoint,
        credentials: config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
        // R2 requires path-style access disabled (virtual-hosted style)
        forcePathStyle: config.provider === "s3",
      });
    }
  }

  // ------------------------------------------
  // Provider info
  // ------------------------------------------

  /** Returns which storage backend is currently active. */
  getProvider(): StorageProvider {
    return this.config.provider;
  }

  // ------------------------------------------
  // Upload
  // ------------------------------------------

  /** Upload a buffer to storage under the given key. */
  async upload(key: string, body: Buffer, contentType: string): Promise<UploadResult> {
    return this.uploadFromBuffer(key, body, contentType);
  }

  /** Upload a buffer to storage under the given key (explicit naming). */
  async uploadFromBuffer(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    if (this.config.provider === "local") {
      return this.uploadLocal(key, buffer, contentType);
    }
    return this.uploadS3(key, buffer, contentType);
  }

  // ------------------------------------------
  // Presigned upload URL (for direct browser uploads)
  // ------------------------------------------

  /**
   * Generate a presigned URL that allows a client to PUT an object directly.
   * Only supported for R2 / S3 providers — throws for local.
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<SignedUploadUrl> {
    if (this.config.provider === "local") {
      throw new Error("Presigned upload URLs are not supported for local storage provider.");
    }

    if (!this.s3Client) {
      throw new Error("S3 client is not initialised.");
    }

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      uploadUrl,
      key,
      publicUrl: this.buildPublicUrl(key),
    };
  }

  // ------------------------------------------
  // Delete
  // ------------------------------------------

  /** Delete an object by key. */
  async delete(key: string): Promise<void> {
    if (this.config.provider === "local") {
      await this.deleteLocal(key);
      return;
    }

    if (!this.s3Client) {
      throw new Error("S3 client is not initialised.");
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }

  // ------------------------------------------
  // URLs
  // ------------------------------------------

  /**
   * Resolve a publicly-accessible URL for a stored key.
   * For R2/S3 this may generate a short-lived presigned GET URL.
   * For local it returns the API route path.
   */
  async getUrl(key: string): Promise<string> {
    if (this.config.provider === "local") {
      return this.buildPublicUrl(key);
    }

    if (!this.s3Client) {
      throw new Error("S3 client is not initialised.");
    }

    // If a CDN/public base URL is configured, return it directly
    if (this.config.publicUrl) {
      return this.buildPublicUrl(key);
    }

    // Otherwise fall back to a presigned GET URL (15 min TTL)
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 900 });
  }

  /**
   * Build a public URL for a key **without** making any network call.
   * Uses the configured publicUrl (CDN) or the local API route pattern.
   */
  getPublicUrl(key: string): string {
    return this.buildPublicUrl(key);
  }

  // ==========================================
  // Private helpers — S3 / R2
  // ==========================================

  private async uploadS3(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error("S3 client is not initialised.");
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      key,
      url: this.buildPublicUrl(key),
      sizeBytes: buffer.length,
    };
  }

  // ==========================================
  // Private helpers — Local filesystem
  // ==========================================

  private async uploadLocal(key: string, buffer: Buffer, _contentType: string): Promise<UploadResult> {
    // Prevent path traversal: resolved path must stay within localBasePath
    const resolved = path.resolve(this.localBasePath, key);
    const base = path.resolve(this.localBasePath);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error(`Path traversal detected: key "${key}" resolves outside uploads directory`);
    }

    // Ensure the parent directory tree exists
    const dir = path.dirname(resolved);
    await mkdir(dir, { recursive: true });

    await writeFile(resolved, buffer);

    return {
      key,
      url: this.buildPublicUrl(key),
      sizeBytes: buffer.length,
    };
  }

  private async deleteLocal(key: string): Promise<void> {
    const filePath = path.join(this.localBasePath, key);
    if (existsSync(filePath)) {
      await unlink(filePath);

      // Best-effort: remove empty parent directories up to localBasePath
      try {
        await this.cleanEmptyDirs(path.dirname(filePath));
      } catch {
        // Non-critical — ignore cleanup errors
      }
    }
  }

  /** Walk up the directory tree removing empty directories. */
  private async cleanEmptyDirs(dir: string): Promise<void> {
    const resolved = path.resolve(dir);
    const base = path.resolve(this.localBasePath);
    if (resolved === base || !resolved.startsWith(base)) return;

    const entries = await readdirSafe(resolved);
    if (entries.length === 0) {
      await rm(resolved, { recursive: false });
      await this.cleanEmptyDirs(path.dirname(resolved));
    }
  }

  // ==========================================
  // URL builder
  // ==========================================

  private buildPublicUrl(key: string): string {
    if (this.config.publicUrl) {
      // Normalise: remove trailing slash, then join
      const base = this.config.publicUrl.replace(/\/+$/, "");
      return `${base}/${key}`;
    }

    // Local fallback: served by a Next.js API route
    return `/api/upload/file?key=${encodeURIComponent(key)}`;
  }
}

// ==========================================
// Factory
// ==========================================

/**
 * Read storage configuration from environment variables and return a
 * ready-to-use StorageService singleton.
 *
 * Supported env vars (prefix depends on provider):
 *
 *   STORAGE_PROVIDER    — "r2" | "s3" | "local" (default: "local")
 *
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_BUCKET           — R2 bucket name
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY
 *   R2_PUBLIC_URL       — optional CDN / public base URL
 *
 *   S3_REGION           — AWS region (e.g. us-east-1)
 *   S3_BUCKET           — S3 bucket name
 *   S3_ACCESS_KEY_ID    — AWS IAM access key
 *   S3_SECRET_ACCESS_KEY
 *   S3_PUBLIC_URL       — optional CDN / public base URL
 */
export function createStorageService(): StorageService {
  const provider = (process.env.STORAGE_PROVIDER as StorageProvider) ?? "local";

  const config: StorageConfig = {
    provider,
    bucket: "",
  };

  switch (provider) {
    case "r2": {
      const accountId = process.env.R2_ACCOUNT_ID;
      if (!accountId) {
        throw new Error("R2_ACCOUNT_ID environment variable is required for R2 storage.");
      }
      config.bucket = process.env.R2_BUCKET ?? "";
      config.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
      config.region = "auto";
      config.accessKeyId = process.env.R2_ACCESS_KEY_ID;
      config.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      config.publicUrl = process.env.R2_PUBLIC_URL;
      break;
    }

    case "s3": {
      config.bucket = process.env.S3_BUCKET ?? "";
      config.region = process.env.S3_REGION ?? "us-east-1";
      config.accessKeyId = process.env.S3_ACCESS_KEY_ID;
      config.secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
      config.publicUrl = process.env.S3_PUBLIC_URL;
      break;
    }

    case "local": {
      config.bucket = "local";
      config.publicUrl = process.env.LOCAL_PUBLIC_URL;
      break;
    }

    default: {
      throw new Error(`Unknown storage provider: ${provider as string}`);
    }
  }

  return new StorageService(config);
}

// ==========================================
// Internal utilities
// ==========================================

/** Readdir that returns an empty array instead of throwing ENOENT. */
async function readdirSafe(dir: string): Promise<string[]> {
  try {
    const { readdir } = await import("fs/promises");
    return readdir(dir);
  } catch {
    return [];
  }
}

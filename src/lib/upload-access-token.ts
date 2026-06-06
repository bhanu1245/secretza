// ==========================================
// SecretZa Upload Preview Access Tokens
// ==========================================
// Freshly uploaded listing files have no ListingImage row yet (the listing is
// created in a later request), so DB-backed authorization in
// canAccessListingImageFile() cannot grant access. Image <img> subresource
// requests also cannot be guaranteed to carry a resolvable session.
//
// To make previews deterministic, the upload route mints a short-lived,
// HMAC-signed token bound to the exact storage key. The file-serving route
// accepts that token as proof that an authenticated owner just uploaded the
// file, independent of DB persistence or session resolution on the <img> GET.
//
// Tokens are only ever placed in preview URLs. Persisted DB URLs are normalized
// to a clean `/api/upload/file?key=...` (see resolveListingImageUrl), so tokens
// are never stored.

import { createHmac, timingSafeEqual } from "crypto";

/** Default preview window: long enough to fill in a listing and submit. */
const DEFAULT_TTL_SECONDS = 60 * 60;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign upload access tokens.");
  }
  return secret;
}

function sign(key: string, exp: number): string {
  return createHmac("sha256", getSecret()).update(`${key}:${exp}`).digest("hex");
}

export interface UploadAccessToken {
  token: string;
  exp: number;
}

/** Mint a signed, time-limited access token bound to a single storage key. */
export function createUploadAccessToken(
  key: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): UploadAccessToken {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { token: sign(key, exp), exp };
}

/** Verify a token/exp pair for a given storage key (constant-time). */
export function verifyUploadAccessToken(
  key: string,
  token: string | null,
  exp: number | null,
): boolean {
  if (!key || !token || exp === null || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;

  let expected: string;
  try {
    expected = sign(key, exp);
  } catch {
    return false;
  }

  const provided = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return false;
  return timingSafeEqual(provided, expectedBuffer);
}

/** Append a signed token to a local `/api/upload/file?key=...` URL. */
export function appendUploadAccessToken(
  url: string,
  token: string,
  exp: number,
): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}&exp=${exp}`;
}

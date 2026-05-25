const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token using Web Crypto API
 * (Edge Runtime compatible — no Node.js crypto dependency).
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  // Encode as hex string
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a CSRF cookie and token pair.
 * Returns { token, cookieHeader }.
 * The token must be returned to the client AND set as a cookie.
 * On subsequent requests, the client sends both — server validates they match.
 */
export function createCsrfPair(): { token: string; cookieHeader: string } {
  const token = generateCsrfToken();
  const isProduction = process.env.NODE_ENV === "production";
  const cookieHeader = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "Path=/",
    "SameSite=Lax",
    isProduction ? "Secure" : "",
    "HttpOnly",
    `Max-Age=${60 * 60}` // 1 hour
  ].filter(Boolean).join("; ");

  return { token, cookieHeader };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Works with hex-encoded strings of equal length.
 * Uses XOR to compare character by character.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate a CSRF request by comparing the token from the header
 * with the token from the cookie.
 */
export function validateCsrfToken(
  headerToken: string | null,
  cookieToken: string | null
): boolean {
  if (!headerToken || !cookieToken) return false;
  // Constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(headerToken, cookieToken);
  } catch {
    return false;
  }
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };

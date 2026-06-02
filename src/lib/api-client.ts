import { CSRF_HEADER_NAME } from "@/lib/csrf";

let cachedCsrfToken: string | null = null;

/** Fetch a fresh CSRF token (also sets the HttpOnly csrf_token cookie). */
export async function fetchCsrfToken(force = false): Promise<string> {
  if (cachedCsrfToken && !force) {
    return cachedCsrfToken;
  }

  const res = await fetch("/api/csrf", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch CSRF token");
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("CSRF token missing from response");
  }

  cachedCsrfToken = data.token;
  return data.token;
}

/** Clear cached CSRF token (e.g. after logout or validation failure). */
export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

/**
 * Same-origin fetch with session cookies and CSRF header on mutating requests.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const needsCsrf = method !== "GET" && method !== "HEAD";

  if (needsCsrf) {
    headers.set(CSRF_HEADER_NAME, await fetchCsrfToken());
  }

  if (
    options.body &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  if (
    needsCsrf &&
    response.status === 403 &&
    !options.signal?.aborted
  ) {
    let shouldRetry = false;
    try {
      const data = await response.clone().json();
      shouldRetry =
        data?.field === "csrf" ||
        String(data?.error || "").toLowerCase().includes("csrf");
    } catch {
      shouldRetry = false;
    }

    if (shouldRetry) {
      clearCsrfToken();
      headers.set(CSRF_HEADER_NAME, await fetchCsrfToken(true));
      return fetch(url, {
        ...options,
        method,
        headers,
        credentials: "include",
      });
    }
  }

  return response;
}

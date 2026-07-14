/**
 * Browser-safe fetch helpers for SEO Review Studio.
 * All client fetches should go through these utilities.
 */

export const REVIEW_FETCH_TIMEOUT_MS = 60_000;
export const REVIEW_LOADING_WATCHDOG_MS = 90_000;

const LOG_PREFIX = "ReviewStudio:";

export class ReviewStudioTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs / 1000}s (${label})`);
    this.name = "ReviewStudioTimeoutError";
  }
}

export async function reviewStudioFetch(
  url: string,
  init: RequestInit = {},
  options?: {
    label?: string;
    timeoutMs?: number;
    externalSignal?: AbortSignal;
  },
): Promise<Response> {
  const label = options?.label ?? url;
  const timeoutMs = options?.timeoutMs ?? REVIEW_FETCH_TIMEOUT_MS;

  console.log(`${LOG_PREFIX} Fetch started — ${label}`);

  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (options?.externalSignal) {
    if (options.externalSignal.aborted) controller.abort();
    else options.externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    console.log(`${LOG_PREFIX} Fetch completed — ${label} (status ${res.status})`);
    return res;
  } catch (err) {
    if (timedOut) {
      console.error(`${LOG_PREFIX} Fetch failed — ${label} (timeout ${timeoutMs}ms)`);
      throw new ReviewStudioTimeoutError(label, timeoutMs);
    }
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`${LOG_PREFIX} Fetch failed — ${label} (aborted)`);
      throw err;
    }
    console.error(`${LOG_PREFIX} Fetch failed — ${label}`, err);
    throw err;
  } finally {
    clearTimeout(timer);
    if (options?.externalSignal) {
      options.externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export async function reviewStudioPostJson<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  label: string,
  externalSignal?: AbortSignal,
): Promise<T> {
  const res = await reviewStudioFetch(
    "/api/admin/seo/generate-city-pack",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { label, externalSignal },
  );
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && data.error
        ? String(data.error)
        : `${label} failed`,
    );
  }
  return data;
}

export async function reviewStudioGetJson<T = Record<string, unknown>>(
  url: string,
  label: string,
  externalSignal?: AbortSignal,
): Promise<{ response: Response; data: T }> {
  const response = await reviewStudioFetch(url, {}, { label, externalSignal });
  const data = (await response.json()) as T;
  return { response, data };
}

export function logReviewLoadingStarted(operation: string) {
  console.log(`${LOG_PREFIX} Loading started — ${operation}`);
}

export function logReviewLoadingFinished(operation: string) {
  console.log(`${LOG_PREFIX} Loading finished — ${operation}`);
}

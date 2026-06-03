/**
 * SecretZa Rate Limiter — Production-grade in-memory rate limiting
 *
 * Features:
 *   • Sliding window counters (no fixed-window edge bursts)
 *   • Per-IP and per-user keys via identifier prefixing
 *   • Configurable thresholds with sensible defaults
 *   • Abuse detection: burst protection & repeated-failure tracking
 *   • Standard `RateLimit-*` response headers via `getRateLimitHeaders()`
 *   • Automatic Redis backend when REDIS_URL is set (transparent fallback to in-memory)
 *
 * REDIS AUTO-WIRING:
 * When REDIS_URL is set, all rate limit / abuse detection functions automatically
 * delegate to the Redis-backed implementation in redis-rate-limit.ts. This happens
 * transparently — no import changes needed by consumers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Max requests allowed in the window. */
  maxRequests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  /** Current count within the window (useful for debugging). */
  current: number;
  limit: number;
}

export interface AbuseCheckConfig {
  /** Number of recent failures to consider "abusive". Default: 10. */
  failureThreshold?: number;
  /** Window in seconds for failure tracking. Default: 300 (5 min). */
  failureWindowSeconds?: number;
  /** Max requests allowed within burst window. Default: 20. */
  burstThreshold?: number;
  /** Burst window in seconds. Default: 10. */
  burstWindowSeconds?: number;
}

export interface AbuseCheckResult {
  /** True if the identifier should be blocked / challenged. */
  isAbusive: boolean;
  /** Human-readable reason (empty string when not abusive). */
  reason: string;
  /** Current failure count in the failure window. */
  failureCount: number;
  /** Current request count in the burst window. */
  burstCount: number;
}

// ---------------------------------------------------------------------------
// Sliding-window store
// ---------------------------------------------------------------------------

interface SlidingWindowEntry {
  /** Array of request timestamps (ms). Oldest entries are pruned on access. */
  timestamps: number[];
  /** The window duration in ms — stored with the entry so cleanup is correct. */
  windowMs: number;
}

const store = new Map<string, SlidingWindowEntry>();

// ---------------------------------------------------------------------------
// Background cleanup — evict stale entries every 5 minutes
// ---------------------------------------------------------------------------

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        // Remove timestamps older than the window
        const cutoff = now - entry.windowMs;
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        // Delete the key entirely if empty
        if (entry.timestamps.length === 0) {
          store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
    // Allow the process to exit even if the timer is still running
    if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
      cleanupTimer.unref();
    }
  }
}

// ---------------------------------------------------------------------------
// Core: sliding window rate limiter
// ---------------------------------------------------------------------------

/**
 * In-memory sliding window rate limiter (synchronous).
 * Exported for use by redis-rate-limit.ts as a fallback.
 */
export function _memoryRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const cutoff = now - windowMs;

  let entry = store.get(identifier);

  if (entry) {
    // Prune expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  } else {
    entry = { timestamps: [], windowMs };
    store.set(identifier, entry);
  }

  const current = entry.timestamps.length;

  if (current >= config.maxRequests) {
    // Rate limited — compute the reset time (oldest timestamp + window)
    const oldest = entry.timestamps[0] ?? now;
    const resetAt = oldest + windowMs;

    return {
      success: false,
      remaining: 0,
      resetAt,
      current,
      limit: config.maxRequests,
    };
  }

  // Under limit — record this request
  entry.timestamps.push(now);

  return {
    success: true,
    remaining: config.maxRequests - (current + 1),
    resetAt: now + windowMs,
    current: current + 1,
    limit: config.maxRequests,
  };
}

/**
 * Check and increment rate limit for a given identifier.
 *
 * When REDIS_URL is set, delegates to the Redis-backed implementation.
 * Otherwise uses the synchronous in-memory sliding window algorithm.
 *
 * All consumers must `await` this call.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (process.env.REDIS_URL) {
    const { rateLimit: redisRateLimit } = await import("@/lib/redis-rate-limit");
    return redisRateLimit(identifier, config);
  }
  return _memoryRateLimit(identifier, config);
}

// ---------------------------------------------------------------------------
// Abuse detection
// ---------------------------------------------------------------------------

/**
 * In-memory abuse detection (synchronous).
 * Exported for use by redis-rate-limit.ts as a fallback.
 */
export function _memoryCheckAbuse(
  identifier: string,
  config?: AbuseCheckConfig
): AbuseCheckResult {
  const opts = {
    failureThreshold: config?.failureThreshold ?? 10,
    failureWindowSeconds: config?.failureWindowSeconds ?? 300,
    burstThreshold: config?.burstThreshold ?? 20,
    burstWindowSeconds: config?.burstWindowSeconds ?? 10,
  };

  const now = Date.now();
  const result: AbuseCheckResult = {
    isAbusive: false,
    reason: "",
    failureCount: 0,
    burstCount: 0,
  };

  // --- Burst check ---
  const burstKey = `abuse:burst:${identifier}`;
  const burstMs = opts.burstWindowSeconds * 1000;
  const burstCutoff = now - burstMs;
  let burstEntry = store.get(burstKey);

  if (burstEntry) {
    burstEntry.timestamps = burstEntry.timestamps.filter((t) => t > burstCutoff);
  } else {
    burstEntry = { timestamps: [], windowMs: burstMs };
    store.set(burstKey, burstEntry);
  }

  result.burstCount = burstEntry.timestamps.length;

  if (result.burstCount >= opts.burstThreshold) {
    result.isAbusive = true;
    result.reason = `Burst detected: ${result.burstCount} requests in ${opts.burstWindowSeconds}s`;
    return result; // Early exit — no need to check failures
  }

  // Record this check as a "request" in the burst window
  burstEntry.timestamps.push(now);

  // --- Failure check ---
  const failKey = `abuse:fail:${identifier}`;
  const failMs = opts.failureWindowSeconds * 1000;
  const failCutoff = now - failMs;
  let failEntry = store.get(failKey);

  if (failEntry) {
    failEntry.timestamps = failEntry.timestamps.filter((t) => t > failCutoff);
  } else {
    failEntry = { timestamps: [], windowMs: failMs };
    store.set(failKey, failEntry);
  }

  result.failureCount = failEntry.timestamps.length;

  if (result.failureCount >= opts.failureThreshold) {
    result.isAbusive = true;
    result.reason = `Repeated failures: ${result.failureCount} failures in ${opts.failureWindowSeconds}s`;
  }

  return result;
}

/**
 * Check whether a given identifier is exhibiting abusive behaviour.
 *
 * When REDIS_URL is set, delegates to the Redis-backed implementation.
 * Otherwise uses the synchronous in-memory implementation.
 *
 * All consumers must `await` this call.
 */
export async function checkAbuse(
  identifier: string,
  config?: AbuseCheckConfig
): Promise<AbuseCheckResult> {
  if (process.env.REDIS_URL) {
    const { checkAbuse: redisCheckAbuse } = await import("@/lib/redis-rate-limit");
    return redisCheckAbuse(identifier, config);
  }
  return _memoryCheckAbuse(identifier, config);
}

/**
 * Record a failed attempt (e.g. bad password, invalid token) for abuse tracking.
 */
export function recordFailure(identifier: string): void {
  // If Redis is configured, delegate asynchronously (fire-and-forget for sync API)
  if (process.env.REDIS_URL) {
    import("@/lib/redis-rate-limit").then((m) => m.recordFailure(identifier)).catch(() => {});
    return;
  }
  ensureCleanup();
  const key = `abuse:fail:${identifier}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], windowMs: 5 * 60 * 1000 }; // 5-minute window
    store.set(key, entry);
  }

  const cutoff = now - entry.windowMs;
  entry.timestamps.push(now);
  // Keep only recent entries
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

/**
 * Clear failure history — call after a successful attempt to reset the counter.
 */
export function clearFailures(identifier: string): void {
  if (process.env.REDIS_URL) {
    import("@/lib/redis-rate-limit").then((m) => m.clearFailures(identifier)).catch(() => {});
    return;
  }
  store.delete(`abuse:fail:${identifier}`);
}

// ---------------------------------------------------------------------------
// Response headers helper
// ---------------------------------------------------------------------------

/**
 * Build standard `RateLimit-*` headers for a rate-limit response.
 *
 * Usage in API routes:
 *   const rl = rateLimit(`login:${ip}`, RATE_LIMITS.login);
 *   return NextResponse.json(
 *     { error: "Too many attempts" },
 *     { status: 429, headers: getRateLimitHeaders(rl) }
 *   );
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfter = Math.max(
    0,
    Math.ceil((result.resetAt - Date.now()) / 1000)
  );

  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(retryAfter > 0 ? { "Retry-After": String(retryAfter) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Preset configs for different endpoints
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  // Login attempts: 10 per 15 minutes
  login: { maxRequests: 10, windowSeconds: 15 * 60 } satisfies RateLimitConfig,
  // Registration: 3 per hour
  register: { maxRequests: 3, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
  // Forgot password: 3 per hour
  forgotPassword: { maxRequests: 3, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
  // Reset password: 5 per hour
  resetPassword: { maxRequests: 5, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
  // Resend verification: 3 per hour
  resendVerification: { maxRequests: 3, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
  // General API: 100 per minute
  api: { maxRequests: 100, windowSeconds: 60 } satisfies RateLimitConfig,
  // Upload: 30 per hour per user
  upload: { maxRequests: 30, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
  // Manual payment submission: 5 per hour per user
  manualPayment: { maxRequests: 5, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
  // Review creation: 5 per hour per user
  reviewCreate: { maxRequests: 5, windowSeconds: 60 * 60 } satisfies RateLimitConfig,
} as const;

// ---------------------------------------------------------------------------
// Convenience: IP extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract client IP from a Next.js request (or any object with headers).
 * Handles `x-forwarded-for`, `x-real-ip`, and falls back to `"unknown"`.
 */
export function getClientIp(request: { headers: Headers | Record<string, string | string[] | undefined> }): string {
  const headers = request.headers;
  if (typeof headers.get === "function") {
    return (headers.get("x-forwarded-for")?.split(",")[0]?.trim()) ??
           (headers.get("x-real-ip")?.trim()) ??
           "unknown";
  }
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  if (typeof realIp === "string") return realIp.trim();
  return "unknown";
}

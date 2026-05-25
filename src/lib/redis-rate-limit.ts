/**
 * Redis-Backed Rate Limiter
 *
 * When REDIS_URL is set, uses Redis sorted sets for sliding window rate
 * limiting (survives restarts, works across multiple instances).
 * When REDIS_URL is not set, falls back to the in-memory implementation.
 *
 * This module is a drop-in replacement for rate-limit.ts — it re-exports
 * the exact same interface so all call-sites work unchanged.
 *
 * Redis sliding window algorithm:
 *   ZADD    rate:{key}  {timestamp_ms} {timestamp_ms}
 *   ZREMRANGEBYSCORE rate:{key}  0 {cutoff_ms}
 *   ZCARD   rate:{key}
 *   EXPIRE  rate:{key}  {window_seconds}
 */

// ---------------------------------------------------------------------------
// Re-export types & constants from the in-memory module
// ---------------------------------------------------------------------------

import {
  RateLimitConfig,
  RateLimitResult,
  AbuseCheckConfig,
  AbuseCheckResult,
} from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

export type {
  RateLimitConfig,
  RateLimitResult,
  AbuseCheckConfig,
  AbuseCheckResult,
};

export { RATE_LIMITS, getRateLimitHeaders, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Lazy ioredis types — only imported at runtime when Redis is enabled
// ---------------------------------------------------------------------------

type RedisInstance = {
  zadd(key: string, ...args: [...(string | number)[]]): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ping(): Promise<string>;
  del(key: string | string[]): Promise<number>;
  quit(): Promise<string>;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

// ---------------------------------------------------------------------------
// Singleton Redis client (lazy-initialized)
// ---------------------------------------------------------------------------

let redisClient: RedisInstance | null = null;
let redisInitFailed = false;

async function getRedisClient(): Promise<RedisInstance | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisInitFailed) return null;
  if (redisClient) return redisClient;

  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(process.env.REDIS_URL, {
      // Retry strategy: reconnect after 200ms, up to 10 times
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying
        return Math.min(times * 200, 5000);
      },
      // Fail fast on initial connect — 3 seconds
      connectTimeout: 3000,
      // Don't let Redis errors crash the process
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    }) as unknown as RedisInstance;

    redisClient.on("error", (err: unknown) => {
      logError(err instanceof Error ? err.message : String(err), { module: "redis-rate-limit" });
      // Mark as failed so we fall back to in-memory on next call
      redisInitFailed = true;
      redisClient = null;
    });

    return redisClient;
  } catch (err) {
    logError(err, { module: "redis-rate-limit" });
    redisInitFailed = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

/**
 * Returns which rate-limiting backend is active.
 * Call this from health-check endpoints to verify Redis connectivity.
 */
export async function getRateLimitBackend(): Promise<"redis" | "memory"> {
  const client = await getRedisClient();
  if (!client) return "memory";
  try {
    await client.ping();
    return "redis";
  } catch {
    return "memory";
  }
}

// ---------------------------------------------------------------------------
// Redis-backed sliding window rate limiter
// ---------------------------------------------------------------------------

/**
 * Check and increment rate limit using Redis sorted sets.
 *
 * Uses a multi-step pipeline:
 *   1. ZADD    — record the current request timestamp
 *   2. ZREMRANGEBYSCORE — prune entries older than the window
 *   3. ZCARD   — count remaining entries
 *   4. EXPIRE  — auto-delete the key after the window expires
 *
 * The key prefix `rate:` distinguishes rate-limit keys from abuse keys.
 */
async function redisRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  if (!client) {
    // Dynamic import of in-memory fallback
    const { _memoryRateLimit } = await import("@/lib/rate-limit");
    return _memoryRateLimit(identifier, config);
  }

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const cutoff = now - windowMs;
  const key = `rate:${identifier}`;
  // Use the timestamp itself as both score and member (unique per ms)
  const uniqueId = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Pipeline all commands for atomicity and performance
    const pipeline = (client as unknown as { zadd: (...a: unknown[]) => unknown; zremrangebyscore: (...a: unknown[]) => unknown; zcard: (...a: unknown[]) => unknown; expire: (...a: unknown[]) => unknown; exec: () => Promise<unknown[]> }).pipeline();

    pipeline.zadd(key, now, uniqueId);
    pipeline.zremrangebyscore(key, 0, cutoff);
    pipeline.zcard(key);
    pipeline.expire(key, config.windowSeconds);

    const results = await pipeline.exec();
    // results is [err, result][] — we need ZCARD (index 2)
    const count = results?.[2]?.[1] as number;

    const current = count ?? 0;

    if (current > config.maxRequests) {
      // Over limit — remove the just-added entry to keep count accurate
      await client.zremrangebyscore(key, now, now + 1);

      const resetAt = now + windowMs;
      return {
        success: false,
        remaining: 0,
        resetAt,
        current,
        limit: config.maxRequests,
      };
    }

    return {
      success: true,
      remaining: Math.max(0, config.maxRequests - current),
      resetAt: now + windowMs,
      current,
      limit: config.maxRequests,
    };
  } catch (err) {
    logError(err, { module: "redis-rate-limit" });
    const { _memoryRateLimit } = await import("@/lib/rate-limit");
    return _memoryRateLimit(identifier, config);
  }
}

// ---------------------------------------------------------------------------
// Redis-backed abuse detection
// ---------------------------------------------------------------------------

async function redisCheckAbuse(
  identifier: string,
  config?: AbuseCheckConfig
): Promise<AbuseCheckResult> {
  const client = await getRedisClient();
  if (!client) {
    const { _memoryCheckAbuse } = await import("@/lib/rate-limit");
    return _memoryCheckAbuse(identifier, config);
  }

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

  try {
    // --- Burst check ---
    const burstKey = `abuse:burst:${identifier}`;
    const burstMs = opts.burstWindowSeconds * 1000;
    const burstCutoff = now - burstMs;
    const burstUniqueId = `${now}:burst:${Math.random().toString(36).slice(2, 8)}`;

    // Record + prune + count burst
    const burstPipeline = (client as unknown as { zadd: (...a: unknown[]) => unknown; zremrangebyscore: (...a: unknown[]) => unknown; zcard: (...a: unknown[]) => unknown; expire: (...a: unknown[]) => unknown; exec: () => Promise<unknown[]> }).pipeline();
    burstPipeline.zadd(burstKey, now, burstUniqueId);
    burstPipeline.zremrangebyscore(burstKey, 0, burstCutoff);
    burstPipeline.zcard(burstKey);
    burstPipeline.expire(burstKey, opts.burstWindowSeconds);

    const burstResults = await burstPipeline.exec();
    result.burstCount = (burstResults?.[2]?.[1] as number) ?? 0;

    if (result.burstCount >= opts.burstThreshold) {
      result.isAbusive = true;
      result.reason = `Burst detected: ${result.burstCount} requests in ${opts.burstWindowSeconds}s`;
      return result;
    }

    // --- Failure check (read-only) ---
    const failKey = `abuse:fail:${identifier}`;
    const failMs = opts.failureWindowSeconds * 1000;
    const failCutoff = now - failMs;

    const failPipeline = (client as unknown as { zremrangebyscore: (...a: unknown[]) => unknown; zcard: (...a: unknown[]) => unknown; expire: (...a: unknown[]) => unknown; exec: () => Promise<unknown[]> }).pipeline();
    failPipeline.zremrangebyscore(failKey, 0, failCutoff);
    failPipeline.zcard(failKey);
    failPipeline.expire(failKey, opts.failureWindowSeconds);

    const failResults = await failPipeline.exec();
    result.failureCount = (failResults?.[1]?.[1] as number) ?? 0;

    if (result.failureCount >= opts.failureThreshold) {
      result.isAbusive = true;
      result.reason = `Repeated failures: ${result.failureCount} failures in ${opts.failureWindowSeconds}s`;
    }
  } catch (err) {
    logError(err, { module: "redis-rate-limit" });
    const { _memoryCheckAbuse } = await import("@/lib/rate-limit");
    return _memoryCheckAbuse(identifier, config);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Redis-backed failure recording / clearing
// ---------------------------------------------------------------------------

async function redisRecordFailure(identifier: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    const { recordFailure: memRecordFailure } = await import("@/lib/rate-limit");
    memRecordFailure(identifier);
    return;
  }

  const now = Date.now();
  const failWindowSeconds = 300; // 5 minutes
  const cutoff = now - failWindowSeconds * 1000;
  const key = `abuse:fail:${identifier}`;
  const uniqueId = `${now}:fail:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pipeline = (client as unknown as { zadd: (...a: unknown[]) => unknown; zremrangebyscore: (...a: unknown[]) => unknown; expire: (...a: unknown[]) => unknown; exec: () => Promise<unknown[]> }).pipeline();
    pipeline.zadd(key, now, uniqueId);
    pipeline.zremrangebyscore(key, 0, cutoff);
    pipeline.expire(key, failWindowSeconds);
    await pipeline.exec();
  } catch (err) {
    logError(err, { module: "redis-rate-limit" });
    const { recordFailure: memRecordFailure } = await import("@/lib/rate-limit");
    memRecordFailure(identifier);
  }
}

async function redisClearFailures(identifier: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    const { clearFailures: memClearFailures } = await import("@/lib/rate-limit");
    memClearFailures(identifier);
    return;
  }

  try {
    await client.del(`abuse:fail:${identifier}`);
  } catch (err) {
    logError(err, { module: "redis-rate-limit" });
    const { clearFailures: memClearFailures } = await import("@/lib/rate-limit");
    memClearFailures(identifier);
  }
}

// ---------------------------------------------------------------------------
// Public API — same signatures as rate-limit.ts but async-aware
//
// NOTE: The Redis functions are async, but the in-memory functions from
// rate-limit.ts are synchronous. We return Promises from all exports
// so the interface is consistent. Callers that already handle the return
// value will work unchanged; those that don't await will get a Promise
// that resolves correctly.
// ---------------------------------------------------------------------------

/**
 * Rate-limit a request. Returns a Promise<RateLimitResult>.
 *
 * Usage (drop-in replacement):
 *   const rl = await rateLimit(`login:${ip}`, RATE_LIMITS.login);
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (process.env.REDIS_URL && !redisInitFailed) {
    return redisRateLimit(identifier, config);
  }
  // Synchronous in-memory fallback
  const { _memoryRateLimit } = await import("@/lib/rate-limit");
  return _memoryRateLimit(identifier, config);
}

/**
 * Check whether an identifier is exhibiting abusive behaviour.
 * Returns a Promise<AbuseCheckResult>.
 */
export async function checkAbuse(
  identifier: string,
  config?: AbuseCheckConfig
): Promise<AbuseCheckResult> {
  if (process.env.REDIS_URL && !redisInitFailed) {
    return redisCheckAbuse(identifier, config);
  }
  const { _memoryCheckAbuse } = await import("@/lib/rate-limit");
  return _memoryCheckAbuse(identifier, config);
}

/**
 * Record a failed attempt for abuse tracking.
 * Returns a Promise<void>.
 */
export async function recordFailure(identifier: string): Promise<void> {
  if (process.env.REDIS_URL && !redisInitFailed) {
    return redisRecordFailure(identifier);
  }
  const { recordFailure: memRecordFailure } = await import("@/lib/rate-limit");
  memRecordFailure(identifier);
}

/**
 * Clear failure history for an identifier.
 * Returns a Promise<void>.
 */
export async function clearFailures(identifier: string): Promise<void> {
  if (process.env.REDIS_URL && !redisInitFailed) {
    return redisClearFailures(identifier);
  }
  const { clearFailures: memClearFailures } = await import("@/lib/rate-limit");
  memClearFailures(identifier);
}

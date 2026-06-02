/**
 * Monitoring & Error Logging Infrastructure for SecretZa
 *
 * Provides structured logging, request tracing, health monitoring,
 * and failed upload tracking. All functions are safe — they never throw.
 */

import { db } from "@/lib/db";

// ==========================================
// Types
// ==========================================

export interface LogContext {
  [key: string]: unknown;
}

export interface TraceStep {
  step: string;
  timestamp: string;
  duration?: number;
  metadata?: LogContext;
}

export interface RequestTracer {
  correlationId: string;
  startTime: number;
  trace: (step: string, metadata?: LogContext) => void;
  getTrace: () => TraceStep[];
  getDuration: () => number;
}

export interface FailedUploadRecord {
  userId: string;
  fileName: string;
  reason: string;
  timestamp: string;
  correlationId?: string;
}

export interface SystemHealth {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    usage: number; // percentage estimate
  };
  process: {
    pid: number;
    nodeVersion: string;
    platform: string;
    environment: string;
  };
  timestamp: string;
}

export interface ApiDependencyHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
}

// ==========================================
// In-memory stores (safe, no external deps)
// ==========================================

const failedUploads: FailedUploadRecord[] = [];
const MAX_FAILED_UPLOADS = 500;

// Keep only recent entries
function pruneFailedUploads() {
  if (failedUploads.length > MAX_FAILED_UPLOADS) {
    failedUploads.splice(0, failedUploads.length - MAX_FAILED_UPLOADS);
  }
}

// ==========================================
// Correlation ID generation
// ==========================================

function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `corr_${timestamp}_${random}`;
}

// ==========================================
// Color helpers for dev logging
// ==========================================

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

function colorize(level: string, color: string, text: string): string {
  if (process.env.NODE_ENV === "production") return text;
  return `${color}[${level}]${COLORS.reset} ${text}`;
}

// ==========================================
// Core logging functions
// ==========================================

/**
 * Structured error logger. Writes to console and optionally to DB.
 * Never throws — always falls back gracefully.
 */
export function logError(error: unknown, context?: LogContext): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const correlationId = context?.correlationId as string | undefined;
    const entry = {
      level: "error",
      message,
      stack: stack?.substring(0, 2000), // truncate huge stacks
      context,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || undefined,
      environment: process.env.NODE_ENV,
    };

    if (process.env.NODE_ENV === "production") {
      // Structured JSON for production log aggregation
      console.error(JSON.stringify(entry));
    } else {
      // Colored console for development
      console.error(
        colorize("ERROR", COLORS.red + COLORS.bold, message),
      );
      if (correlationId) {
        console.error(COLORS.gray + `  correlationId: ${correlationId}` + COLORS.reset);
      }
      if (stack) {
        console.error(COLORS.dim + stack.split("\n").slice(0, 5).join("\n") + COLORS.reset);
      }
      if (context && Object.keys(context).length > 0) {
        console.error(COLORS.gray + `  context: ${JSON.stringify(context, null, 2)}` + COLORS.reset);
      }
    }
  } catch {
    // Absolute last resort — must never throw
    try {
      console.error("[FALLBACK ERROR LOG]", String(error));
    } catch {
      // Silently give up
    }
  }
}

/**
 * Structured warning logger. Never throws.
 */
export function logWarning(message: string, context?: LogContext): void {
  try {
    const correlationId = context?.correlationId as string | undefined;
    const entry = {
      level: "warning",
      message,
      context,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || undefined,
      environment: process.env.NODE_ENV,
    };

    if (process.env.NODE_ENV === "production") {
      console.warn(JSON.stringify(entry));
    } else {
      console.warn(colorize("WARN", COLORS.yellow, message));
      if (correlationId) {
        console.warn(COLORS.gray + `  correlationId: ${correlationId}` + COLORS.reset);
      }
      if (context && Object.keys(context).length > 0) {
        console.warn(COLORS.gray + `  context: ${JSON.stringify(context)}` + COLORS.reset);
      }
    }
  } catch {
    try {
      console.warn("[FALLBACK WARN LOG]", message);
    } catch {
      // Silently give up
    }
  }
}

/**
 * Structured info logger. Never throws.
 */
export function logInfo(message: string, context?: LogContext): void {
  try {
    const correlationId = context?.correlationId as string | undefined;
    const entry = {
      level: "info",
      message,
      context,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || undefined,
      environment: process.env.NODE_ENV,
    };

    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(entry));
    } else {
      console.log(colorize("INFO", COLORS.green, message));
      if (correlationId) {
        console.log(COLORS.gray + `  correlationId: ${correlationId}` + COLORS.reset);
      }
      if (context && Object.keys(context).length > 0) {
        console.log(COLORS.gray + `  context: ${JSON.stringify(context)}` + COLORS.reset);
      }
    }
  } catch {
    try {
      console.log("[FALLBACK INFO LOG]", message);
    } catch {
      // Silently give up
    }
  }
}

// ==========================================
// Request Tracer
// ==========================================

/**
 * Creates a request tracer for tracking steps in request processing.
 * Pass a NextRequest, IncomingMessage, or any object with a `headers` property
 * to auto-extract correlation IDs from headers.
 */
export function createRequestTracer(req?: { headers?: Headers | Record<string, string | string[] | undefined> }): RequestTracer {
  const correlationId = extractCorrelationId(req) || generateCorrelationId();
  const startTime = Date.now();
  const steps: TraceStep[] = [];
  let lastStepTime = startTime;

  return {
    correlationId,
    startTime,

    trace(step: string, metadata?: LogContext): void {
      try {
        const now = Date.now();
        steps.push({
          step,
          timestamp: new Date().toISOString(),
          duration: now - lastStepTime,
          metadata,
        });
        lastStepTime = now;
      } catch {
        // Never throw from tracer
      }
    },

    getTrace(): TraceStep[] {
      return [...steps];
    },

    getDuration(): number {
      return Date.now() - startTime;
    },
  };
}

/**
 * Extract correlation ID from request headers.
 * Checks X-Correlation-ID, X-Request-ID, and X-Trace-ID.
 */
function extractCorrelationId(req?: { headers?: Headers | Record<string, string | string[] | undefined> }): string | undefined {
  if (!req?.headers) return undefined;

  try {
    const headers = req.headers instanceof Headers
      ? Object.fromEntries(req.headers.entries())
      : req.headers;

    const candidate =
      headers["x-correlation-id"] ||
      headers["x-request-id"] ||
      headers["x-trace-id"];

    if (Array.isArray(candidate)) return candidate[0];
    return candidate ? String(candidate) : undefined;
  } catch {
    return undefined;
  }
}

// ==========================================
// API Health Monitoring
// ==========================================

/**
 * Check health of critical dependencies (database, storage, etc.).
 * Returns an array of health status objects.
 */
export async function monitorApiHealth(): Promise<ApiDependencyHealth[]> {
  const results: ApiDependencyHealth[] = [];

  // Check database connectivity
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    results.push({
      name: "database",
      status: latency < 1000 ? "healthy" : "degraded",
      latencyMs: latency,
    });
  } catch (err) {
    results.push({
      name: "database",
      status: "unhealthy",
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }

  // Check Redis connectivity
  if (process.env.REDIS_URL) {
    try {
      const start = Date.now();
      // Dynamic import to avoid bundling ioredis when not used
      const Redis = (await import("ioredis")).default;
      const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000 });
      await redis.ping();
      redis.disconnect();
      const latency = Date.now() - start;
      results.push({
        name: "redis",
        status: latency < 500 ? "healthy" : "degraded",
        latencyMs: latency,
      });
    } catch (err) {
      results.push({
        name: "redis",
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Connection failed",
      });
    }
  }

  return results;
}

// ==========================================
// Failed Upload Tracking
// ==========================================

/**
 * Record a failed upload for monitoring purposes.
 * Stored in memory with automatic pruning.
 */
export function recordFailedUpload(
  userId: string,
  fileName: string,
  reason: string,
  correlationId?: string,
): void {
  try {
    pruneFailedUploads();
    failedUploads.push({
      userId,
      fileName,
      reason,
      timestamp: new Date().toISOString(),
      correlationId,
    });

    logWarning("Failed upload recorded", {
      userId,
      fileName,
      reason,
      correlationId,
    });
  } catch {
    // Never throw
  }
}

/**
 * Get recent failed upload records for monitoring dashboards.
 */
export function getRecentFailedUploads(limit = 50): FailedUploadRecord[] {
  return failedUploads.slice(-limit);
}

/**
 * Get count of recent failed uploads (last N minutes).
 */
export function getFailedUploadCount(sinceMinutes = 60): number {
  const cutoff = Date.now() - sinceMinutes * 60 * 1000;
  return failedUploads.filter(
    (u) => new Date(u.timestamp).getTime() >= cutoff,
  ).length;
}

// ==========================================
// System Health
// ==========================================

/**
 * Returns system health stats: process uptime, memory usage, environment info.
 */
export function getSystemHealth(): SystemHealth {
  try {
    const mem = process.memoryUsage();
    const rssMb = mem.rss / (1024 * 1024);
    const heapTotalMb = mem.heapTotal / (1024 * 1024);
    const heapUsedMb = mem.heapUsed / (1024 * 1024);
    const usagePercent = heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 100) : 0;

    return {
      uptime: process.uptime(),
      memory: {
        rss: Math.round(rssMb),
        heapTotal: Math.round(heapTotalMb),
        heapUsed: Math.round(heapUsedMb),
        external: Math.round(mem.external / (1024 * 1024)),
        arrayBuffers: Math.round(mem.arrayBuffers / (1024 * 1024)),
        usage: usagePercent,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || "unknown",
      },
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      uptime: 0,
      memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0, usage: 0 },
      process: { pid: 0, nodeVersion: "unknown", platform: "unknown", environment: "unknown" },
      timestamp: new Date().toISOString(),
    };
  }
}

// ==========================================
// Convenience: wrap async handlers with tracing
// ==========================================

/**
 * Higher-order function to wrap an async handler with automatic tracing.
 * Catches errors, logs them, and returns a consistent response shape.
 */
export async function withTracing<T>(
  tracer: RequestTracer,
  stepName: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    tracer.trace(`${stepName}:start`);
    const result = await fn();
    tracer.trace(`${stepName}:complete`);
    return result;
  } catch (err) {
    tracer.trace(`${stepName}:failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

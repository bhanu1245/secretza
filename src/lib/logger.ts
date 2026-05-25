/**
 * Client-safe structured logging for Secretza.
 *
 * This module contains ONLY pure logging functions that can safely be
 * imported by both client ("use client") and server code. It has ZERO
 * Node.js-specific dependencies (no Prisma, no ioredis, no process).
 *
 * For server-only monitoring (health checks, DB queries, Redis ping),
 * import from `@/lib/monitoring` instead.
 */

// ==========================================
// Types
// ==========================================

export interface LogContext {
  [key: string]: unknown;
}

// ==========================================
// Core logging functions (isomorphic-safe)
// ==========================================

/**
 * Structured error logger. Never throws.
 *
 * In production: emits a single JSON line to stderr.
 * In development: emits a colored, human-readable message.
 */
export function logError(error: unknown, context?: LogContext): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const entry = {
      level: "error",
      message,
      stack: stack?.substring(0, 2000),
      context,
      timestamp: new Date().toISOString(),
    };

    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      console.error(JSON.stringify(entry));
    } else {
      console.error("[ERROR]", message, context ? context : "");
      if (stack && typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
        console.error(stack.split("\n").slice(0, 5).join("\n"));
      }
    }
  } catch {
    try {
      console.error("[FALLBACK]", String(error));
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
    const entry = {
      level: "warning",
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      console.warn(JSON.stringify(entry));
    } else {
      console.warn("[WARN]", message, context ? context : "");
    }
  } catch {
    try {
      console.warn("[FALLBACK]", message);
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
    const entry = {
      level: "info",
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      console.log(JSON.stringify(entry));
    } else {
      console.log("[INFO]", message, context ? context : "");
    }
  } catch {
    try {
      console.log("[FALLBACK]", message);
    } catch {
      // Silently give up
    }
  }
}

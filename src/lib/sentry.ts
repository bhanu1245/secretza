/**
 * Sentry Error Tracking Integration
 *
 * Wraps @sentry/nextjs with a safe interface.
 * Sentry is only active when NEXT_PUBLIC_SENTRY_DSN is set.
 */

import { logError } from "@/lib/monitoring";

let sentryEnabled = false;

export function initSentry(): void {
  sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (sentryEnabled) {
    // dynamic import to avoid bundling when DSN is not set
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        ignoreErrors: [
          "NEXT_NOT_FOUND",
          "NEXT_REDIRECT",
        ],
      });
    }).catch(() => {
      sentryEnabled = false;
    });
  }
}

/**
 * Capture an exception. Safe to call even if Sentry is not configured.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled) {
    logError(error, { module: "sentry" });
    return;
  }
  // dynamic import
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureException(error, { extra: context });
  }).catch(() => {});
}

/**
 * Set a user context for Sentry.
 */
export function setSentryUser(user: { id: string; email: string; role: string } | null): void {
  if (!sentryEnabled) return;
  // dynamic import
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.setUser(user ? { id: user.id, email: user.email, role: user.role } : null);
  }).catch(() => {});
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

/**
 * Admin Audit Logger for Secretza
 *
 * Provides fire-and-forget audit logging for admin actions.
 * Writes to the existing AuditLog Prisma model.
 * Never blocks the caller — all DB writes are asynchronous and error-swallowed.
 */

import { db } from "@/lib/db";
import { logError, logWarning } from "@/lib/monitoring";

// ==========================================
// Types
// ==========================================

export type AdminActionType =
  | "user_suspend"
  | "user_verify"
  | "listing_approve"
  | "listing_reject"
  | "listing_feature"
  | "listing_delete"
  | "payment_review"
  | "seo_update"
  | "settings_change"
  | "login"
  | "export_data"
  | "review_approve"
  | "review_reject"
  | "review_flag"
  | "review_feature"
  | "review_unfeature"
  | "report_resolve"
  | "report_dismiss"
  | "category_create"
  | "category_update"
  | "category_delete";

interface AuditLogParams {
  userId: string;
  action: AdminActionType;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

// ==========================================
// Valid action types guard
// ==========================================

const VALID_ACTIONS: ReadonlySet<string> = new Set<AdminActionType>([
  "user_suspend",
  "user_verify",
  "listing_approve",
  "listing_reject",
  "listing_feature",
  "listing_delete",
  "payment_review",
  "seo_update",
  "settings_change",
  "login",
  "export_data",
  "review_approve",
  "review_reject",
  "review_flag",
  "review_feature",
  "review_unfeature",
  "report_resolve",
  "report_dismiss",
  "category_create",
  "category_update",
  "category_delete",
]);

function isValidAction(action: string): action is AdminActionType {
  return VALID_ACTIONS.has(action);
}

// ==========================================
// Core audit logger
// ==========================================

/**
 * Log an admin action to the AuditLog table.
 *
 * Fire-and-forget: this function never blocks the caller.
 * All errors are silently caught and logged via the monitoring module.
 *
 * @param userId    - The admin user performing the action
 * @param action    - The action type (e.g., 'user_suspend', 'listing_approve')
 * @param entityType - The type of entity being acted upon (e.g., 'User', 'Listing')
 * @param entityId  - (optional) The ID of the target entity
 * @param details   - (optional) Additional structured metadata about the action
 * @param ipAddress - (optional) IP address; if omitted, can be auto-detected from request headers
 */
export function logAdminAction(
  userId: string,
  action: AdminActionType,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
): void {
  // Fire-and-forget — do not await
  void writeAuditLog({ userId, action, entityType, entityId, details, ipAddress });
}

/**
 * Extract IP address from request headers.
 * Checks X-Forwarded-For, X-Real-IP, and falls back to the remote address.
 */
export function extractIpAddress(
  req?: { headers?: Headers | Record<string, string | string[] | undefined> },
  remoteAddress?: string,
): string {
  if (!req?.headers) {
    return remoteAddress || "unknown";
  }

  try {
    const headers =
      req.headers instanceof Headers
        ? Object.fromEntries(req.headers.entries())
        : req.headers;

    // X-Forwarded-For may contain comma-separated IPs (client, proxy1, proxy2, ...)
    const forwardedFor = headers["x-forwarded-for"];
    if (forwardedFor) {
      const firstIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }

    const realIp = headers["x-real-ip"];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return remoteAddress || "unknown";
  } catch {
    return remoteAddress || "unknown";
  }
}

/**
 * Convenience: log an admin action with IP auto-detection from a request object.
 */
export function logAdminActionFromRequest(
  userId: string,
  action: AdminActionType,
  entityType: string,
  req: { headers?: Headers | Record<string, string | string[] | undefined> },
  entityId?: string,
  details?: Record<string, unknown>,
): void {
  const ipAddress = extractIpAddress(req);
  logAdminAction(userId, action, entityType, entityId, details, ipAddress);
}

// ==========================================
// Internal async writer
// ==========================================

async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const { userId, action, entityType, entityId, details, ipAddress } = params;

    // Validate action type
    if (!isValidAction(action)) {
      logWarning(`Unknown audit action type: "${action}"`, {
        userId,
        entityType,
        entityId,
      });
      return;
    }

    // Sanitize details — ensure it's JSON-serializable and truncate if too large
    const detailsJson = details ? JSON.stringify(details) : null;
    const truncatedDetails =
      detailsJson && detailsJson.length > 4000
        ? detailsJson.substring(0, 4000) + "...[truncated]"
        : detailsJson;

    await db.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId || null,
        details: truncatedDetails,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    // Never throw — audit logging must not break the caller
    logError(err, {
      source: "audit-logger",
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  }
}

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";

export type PaymentAuditAction =
  | "created"
  | "status_changed"
  | "amount_updated"
  | "refunded"
  | "approved"
  | "rejected"
  | "expired";

/**
 * Record a payment state change in the audit log.
 */
export async function logPaymentAudit(params: {
  paymentId: string;
  action: PaymentAuditAction;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  // Try to get the current user from session (works in server context)
  let userId: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id;
  } catch {
    // Not in a server context — that's fine
  }

  await db.paymentAuditLog.create({
    data: {
      paymentId: params.paymentId,
      userId,
      action: params.action,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      ipAddress: params.ipAddress,
    },
  });
}

/**
 * Get the full audit trail for a payment.
 */
export async function getPaymentAuditTrail(paymentId: string) {
  return db.paymentAuditLog.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
    include: {
      actor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
}

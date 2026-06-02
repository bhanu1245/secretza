import { db } from "@/lib/db";

export type FraudEventType =
  | "rapid_signup"
  | "suspicious_payment"
  | "mass_upload"
  | "credential_stuffing"
  | "velocity_abuse"
  | "duplicate_content"
  | "suspicious_account";

export type FraudSeverity = "low" | "medium" | "high" | "critical";

interface FraudCheckResult {
  isSuspicious: boolean;
  score: number;
  reason: string;
  severity: FraudSeverity;
}

/**
 * Record a fraud event and optionally auto-action.
 */
export async function recordFraudEvent(params: {
  userId?: string;
  entityType: string;
  entityId?: string;
  eventType: FraudEventType;
  severity: FraudSeverity;
  riskScore: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db.fraudEvent.create({
    data: {
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      severity: params.severity,
      riskScore: params.riskScore,
      details: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

/**
 * Check if a user's recent activity indicates fraud.
 */
export async function checkUserFraudRisk(userId: string): Promise<FraudCheckResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentPayments, recentListings, recentUploads, existingEvents] = await Promise.all([
    db.payment.count({
      where: { userId, createdAt: { gte: oneHourAgo } },
    }),
    db.listing.count({
      where: { userId, createdAt: { gte: oneHourAgo } },
    }),
    db.listingImage.count({
      where: {
        listing: { userId },
        createdAt: { gte: oneHourAgo },
      },
    }),
    db.fraudEvent.count({
      where: { userId, createdAt: { gte: oneDayAgo }, isResolved: false },
    }),
  ]);

  let score = 0;
  const reasons: string[] = [];

  // Check rapid payment submissions (>5 payments in 1 hour)
  if (recentPayments > 5) {
    score += 30;
    reasons.push(`${recentPayments} payments in the last hour`);
  }

  // Check mass listing creation (>10 listings in 1 hour)
  if (recentListings > 10) {
    score += 25;
    reasons.push(`${recentListings} listings created in the last hour`);
  }

  // Check mass uploads (>30 uploads in 1 hour)
  if (recentUploads > 30) {
    score += 20;
    reasons.push(`${recentUploads} images uploaded in the last hour`);
  }

  // Existing unresolved fraud events increase score
  if (existingEvents > 0) {
    score += existingEvents * 10;
    reasons.push(`${existingEvents} unresolved fraud events`);
  }

  const severity: FraudSeverity = score >= 50 ? "critical" : score >= 30 ? "high" : score >= 15 ? "medium" : "low";

  return {
    isSuspicious: score >= 15,
    score,
    reason: reasons.join("; ") || "No suspicious activity detected",
    severity,
  };
}

/**
 * Check IP-based velocity: how many new accounts from this IP recently.
 */
export async function checkIpVelocity(ipAddress: string): Promise<FraudCheckResult> {
  if (ipAddress === "unknown") {
    return { isSuspicious: false, score: 0, reason: "Unknown IP", severity: "low" };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Count recent fraud events from this IP
  const ipEvents = await db.fraudEvent.count({
    where: { ipAddress, createdAt: { gte: oneHourAgo } },
  });

  if (ipEvents >= 5) {
    return {
      isSuspicious: true,
      score: ipEvents * 15,
      reason: `${ipEvents} fraud events from this IP in the last hour`,
      severity: ipEvents >= 10 ? "critical" : "high",
    };
  }

  return { isSuspicious: false, score: 0, reason: "IP velocity normal", severity: "low" };
}

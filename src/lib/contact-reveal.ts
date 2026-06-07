import { db } from "@/lib/db";

export const CONTACT_REVEAL_HOURLY_LIMIT = 20;
export const CONTACT_REVEAL_DAILY_LIMIT = 100;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ContactRevealCounts {
  hourCount: number;
  dayCount: number;
}

export interface LogContactRevealParams {
  listingId: string;
  userId: string;
  role?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function getRevealCounts(userId: string): Promise<ContactRevealCounts> {
  const now = Date.now();
  const oneHourAgo = new Date(now - HOUR_MS);
  const oneDayAgo = new Date(now - DAY_MS);

  const [hourCount, dayCount] = await Promise.all([
    db.contactReveal.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      },
    }),
    db.contactReveal.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    }),
  ]);

  return { hourCount, dayCount };
}

export function isRevealRateLimited(counts: ContactRevealCounts): boolean {
  return (
    counts.hourCount >= CONTACT_REVEAL_HOURLY_LIMIT ||
    counts.dayCount >= CONTACT_REVEAL_DAILY_LIMIT
  );
}

export async function logContactReveal(params: LogContactRevealParams): Promise<void> {
  await db.contactReveal.create({
    data: {
      listingId: params.listingId,
      userId: params.userId,
      role: params.role ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

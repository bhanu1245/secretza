import type { Prisma } from "@prisma/client";

const PAYMENT_TYPE_ALIASES: Record<string, string> = {
  boost: "boost",
  boosted: "boost",
  feature: "feature",
  featured: "feature",
  premium: "premium",
};

export function buildManualPaymentSearchOr(
  search: string,
  listingIds: string[],
): Prisma.ManualPaymentSubmissionWhereInput[] {
  const q = search.trim();
  const normalizedType = PAYMENT_TYPE_ALIASES[q.toLowerCase()];

  const conditions: Prisma.ManualPaymentSubmissionWhereInput[] = [
    { utrNumber: { contains: q } },
    { user: { email: { contains: q } } },
    { user: { name: { contains: q } } },
  ];

  if (normalizedType) {
    conditions.push({ paymentType: normalizedType });
  } else {
    conditions.push({ paymentType: { contains: q } });
  }

  if (listingIds.length > 0) {
    conditions.push({ listingId: { in: listingIds } });
  }

  return conditions;
}

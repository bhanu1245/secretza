// ==========================================
// SecretZa Listing Expiry
// ==========================================
// Centralizes listing time-to-live so creation and the cron job agree.
// Listings expire `LISTING_EXPIRY_DAYS` after creation; the refresh-ranking
// cron flips expired approved listings to status "expired" so they drop out of
// all public `status: "approved"` queries while remaining visible to the owner
// and admins (and selectable via the admin "expired" filter).

const DEFAULT_EXPIRY_DAYS = 60;

/** Resolve the configured listing lifetime in days (env override, clamped). */
export function getListingExpiryDays(): number {
  const raw = process.env.LISTING_EXPIRY_DAYS?.trim();
  if (!raw) return DEFAULT_EXPIRY_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_EXPIRY_DAYS;
  return Math.floor(parsed);
}

/** Compute the expiry timestamp for a listing created now (or at `from`). */
export function computeListingExpiry(from: Date = new Date()): Date {
  const days = getListingExpiryDays();
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

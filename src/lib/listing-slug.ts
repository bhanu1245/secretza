export const LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LISTING_SLUG_MAX_LENGTH = 140;

export type ListingSlugResolution =
  | { ok: true; slug: string }
  | { ok: false; error: string; field: "slug"; status: 400 | 409 };

/** Trim and lowercase a slug input. Returns null when missing or blank. */
export function normalizeListingSlugInput(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Validate listing slug format. Returns an error message or null when valid. */
export function validateListingSlugFormat(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (slug.length > LISTING_SLUG_MAX_LENGTH) {
    return `Slug must be at most ${LISTING_SLUG_MAX_LENGTH} characters`;
  }
  if (!LISTING_SLUG_PATTERN.test(slug)) {
    return "Slug must contain only lowercase letters, numbers, and hyphens";
  }
  return null;
}

/** Build a URL-safe slug base from a title without adding a timestamp suffix. */
export function slugifyListingTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "listing"
  );
}

/**
 * Resolve the slug for PUT /api/listings/[id].
 * - undefined body slug → keep existing slug
 * - provided slug → validate and persist (allow unchanged slug for same listing)
 * - empty slug → auto-generate from title when missing
 */
export async function resolveListingUpdateSlug(
  input: {
    listingId: string;
    bodySlug: unknown;
    existingSlug: string;
    title: string;
  },
  isSlugTaken: (slug: string, excludeListingId: string) => Promise<boolean>,
): Promise<ListingSlugResolution> {
  const { listingId, bodySlug, existingSlug, title } = input;

  if (bodySlug === undefined) {
    return { ok: true, slug: existingSlug };
  }

  const normalized = normalizeListingSlugInput(bodySlug);
  if (normalized !== null) {
    const formatError = validateListingSlugFormat(normalized);
    if (formatError) {
      return { ok: false, error: formatError, field: "slug", status: 400 };
    }

    if (normalized !== existingSlug && (await isSlugTaken(normalized, listingId))) {
      return { ok: false, error: "Slug is already in use", field: "slug", status: 409 };
    }

    return { ok: true, slug: normalized };
  }

  let candidate = slugifyListingTitle(title);
  const generatedFormatError = validateListingSlugFormat(candidate);
  if (generatedFormatError) {
    candidate = "listing";
  }

  if (candidate === existingSlug) {
    return { ok: true, slug: existingSlug };
  }

  if (!(await isSlugTaken(candidate, listingId))) {
    return { ok: true, slug: candidate };
  }

  for (let suffix = 2; suffix <= 999; suffix++) {
    const withSuffix = `${candidate}-${suffix}`;
    const suffixError = validateListingSlugFormat(withSuffix);
    if (suffixError) continue;
    if (!(await isSlugTaken(withSuffix, listingId))) {
      return { ok: true, slug: withSuffix };
    }
  }

  return {
    ok: false,
    error: "Unable to generate a unique slug",
    field: "slug",
    status: 409,
  };
}

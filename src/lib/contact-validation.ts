export interface ListingContactInput {
  phone?: string | null;
  contactPhone?: string | null;
  contactText?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  contactTelegram?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  contactWebsite?: string | null;
}

export interface ListingContactValidationResult {
  valid: boolean;
  errors: {
    phone?: string;
    whatsapp?: string;
    telegram?: string;
    email?: string;
    website?: string;
  };
}

const EMAIL_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,63})@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z]{2,})+$/;

const TELEGRAM_USERNAME_RE = /^@?[A-Za-z0-9_]{3,32}$/;

const WEBSITE_RE =
  /^(?:https?:\/\/[^\s]+|www\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})[^\s]*)$/i;

function hasValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePhoneDigits(value: string): string {
  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  if (digitsOnly.startsWith("+")) {
    return `+${digitsOnly.slice(1).replace(/\D/g, "")}`;
  }
  return digitsOnly.replace(/\D/g, "");
}

function isValidPhoneDigits(digits: string): boolean {
  if (/^[6-9]\d{9}$/.test(digits)) return true;
  if (/^\+91[6-9]\d{9}$/.test(digits)) return true;
  if (/^91[6-9]\d{9}$/.test(digits)) return true;
  return false;
}

/** Validate a phone number. Returns an error message or null when valid/empty. */
export function validatePhone(value: string | null | undefined): string | null {
  if (!hasValue(value)) return null;

  const trimmed = value.trim();
  if (!/\d/.test(trimmed)) return "Invalid phone number";
  if (/^[^\d+]+$/.test(trimmed) || /^\+{2,}$/.test(trimmed)) {
    return "Invalid phone number";
  }

  const normalized = normalizePhoneDigits(trimmed);
  if (!normalized || normalized === "+") return "Invalid phone number";
  if (!isValidPhoneDigits(normalized)) return "Invalid phone number";

  return null;
}

/** WhatsApp numbers follow the same rules as phone numbers. */
export function validateWhatsapp(value: string | null | undefined): string | null {
  if (!hasValue(value)) return null;
  return validatePhone(value) ? "Invalid WhatsApp number" : null;
}

/** Normalize Telegram username by removing @ prefix and t.me links. */
export function normalizeTelegramValue(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;

  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
}

/** Validate a Telegram username. Returns an error message or null when valid/empty. */
export function validateTelegram(value: string | null | undefined): string | null {
  if (!hasValue(value)) return null;

  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return "Invalid Telegram username";

  const normalized = normalizeTelegramValue(trimmed);
  if (!TELEGRAM_USERNAME_RE.test(`@${normalized}`)) {
    return "Invalid Telegram username";
  }

  return null;
}

/** Validate an email address. Returns an error message or null when valid/empty. */
export function validateEmail(value: string | null | undefined): string | null {
  if (!hasValue(value)) return null;

  const trimmed = value.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return "Invalid email address";

  return null;
}

/** Validate a website URL. Returns an error message or null when valid/empty. */
export function validateWebsite(value: string | null | undefined): string | null {
  if (!hasValue(value)) return null;

  const trimmed = value.trim();
  if (!WEBSITE_RE.test(trimmed)) return "Invalid website URL";

  return null;
}

function assignError(
  errors: ListingContactValidationResult["errors"],
  key: keyof ListingContactValidationResult["errors"],
  message: string | null,
) {
  if (message && !errors[key]) {
    errors[key] = message;
  }
}

/** Validate all dedicated listing contact fields, resolving known aliases. */
export function validateListingContact(
  input: ListingContactInput,
): ListingContactValidationResult {
  const errors: ListingContactValidationResult["errors"] = {};

  for (const value of [input.contactPhone, input.phone, input.contactText]) {
    if (hasValue(value)) {
      assignError(errors, "phone", validatePhone(value));
    }
  }

  if (hasValue(input.whatsapp)) {
    assignError(errors, "whatsapp", validateWhatsapp(input.whatsapp));
  }

  for (const value of [input.telegram, input.contactTelegram]) {
    if (hasValue(value)) {
      assignError(errors, "telegram", validateTelegram(value));
    }
  }

  for (const value of [input.contactEmail, input.email]) {
    if (hasValue(value)) {
      assignError(errors, "email", validateEmail(value));
    }
  }

  for (const value of [input.contactWebsite, input.website]) {
    if (hasValue(value)) {
      assignError(errors, "website", validateWebsite(value));
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

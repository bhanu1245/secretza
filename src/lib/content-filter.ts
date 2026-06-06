// ==========================================
// SecretZa Content Protection Filter
// ==========================================
// Prevents users from leaking contact details (phone, WhatsApp, Telegram,
// email, URLs) inside free-text fields (listing title/description, review
// text) to bypass the gated contact-reveal flow.
//
// This module is dependency-free and isomorphic: it runs identically on the
// client (form validation) and the server (API enforcement). The server check
// is authoritative — the client check is only for UX.

export type ProhibitedContentType = "phone" | "email" | "url" | "telegram";

export interface ContentViolation {
  type: ProhibitedContentType;
  match: string;
}

// Email: local@domain.tld
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// Explicit URLs (http(s):// or www.)
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/i;

// Bare domains using a curated TLD list (keeps false positives low while still
// blocking the common ways users paste contact links).
const BARE_DOMAIN_RE =
  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|io|in|me|co|xyz|info|biz|online|site|link|app|dev|us|uk|ru|tk|gg|to|cc|club|live|fun|vip|cam)\b/i;

// Telegram handles / links: @handle (4+), t.me/..., telegram.me/...
const TELEGRAM_RE = /(?:t\.me\/|telegram\.me\/|@)[A-Za-z0-9_]{4,}/i;

// Phone candidates: a run starting with an optional +, containing digits and
// common separators. We then count the bare digits to decide.
const PHONE_CANDIDATE_RE = /\+?\d(?:[\d\s().\-]{6,})\d/g;

/** Returns the matched phone-like substring, or null. */
function findPhone(text: string): string | null {
  const candidates = text.match(PHONE_CANDIDATE_RE);
  if (!candidates) return null;
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    // Real phone numbers are 9-15 digits. This threshold avoids flagging
    // prices, measurements, dates, and short numeric runs.
    if (digits.length >= 9 && digits.length <= 15) return candidate.trim();
  }
  return null;
}

/** Detect the first prohibited contact pattern in a string. */
export function detectProhibitedContent(value: string): ContentViolation | null {
  if (!value) return null;
  // Normalize fullwidth/obfuscated unicode to their ASCII equivalents.
  const text = value.normalize("NFKC");

  const email = text.match(EMAIL_RE);
  if (email) return { type: "email", match: email[0] };

  const url = text.match(URL_RE) || text.match(BARE_DOMAIN_RE);
  if (url) return { type: "url", match: url[0] };

  const telegram = text.match(TELEGRAM_RE);
  if (telegram) return { type: "telegram", match: telegram[0] };

  const phone = findPhone(text);
  if (phone) return { type: "phone", match: phone };

  return null;
}

/** True when text is free of phone/email/URL/Telegram contact patterns. */
export function isContentClean(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return true;
  return detectProhibitedContent(value) === null;
}

const TYPE_LABEL: Record<ProhibitedContentType, string> = {
  phone: "phone numbers",
  email: "email addresses",
  url: "links or website URLs",
  telegram: "Telegram usernames",
};

export interface ContentFieldCheck {
  /** Field id used for client-side error placement (e.g. "title"). */
  field?: string;
  /** Human label used in the error message (e.g. "Title"). */
  label: string;
  value: unknown;
}

export interface ContentValidationResult {
  field?: string;
  message: string;
  violation: ContentViolation;
}

/**
 * Validate a set of user-content fields. Returns the first violation, or null
 * when all fields are clean. Non-string/empty values are skipped.
 */
export function validateUserContent(
  fields: ContentFieldCheck[],
): ContentValidationResult | null {
  for (const f of fields) {
    if (typeof f.value !== "string" || !f.value.trim()) continue;
    const violation = detectProhibitedContent(f.value);
    if (violation) {
      return {
        field: f.field,
        message: `${f.label} cannot contain ${TYPE_LABEL[violation.type]}. Please remove contact details — buyers use the secure "Show Contact" button instead.`,
        violation,
      };
    }
  }
  return null;
}

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

export const CONTACT_CONTENT_BLOCKED_MESSAGE =
  "Contact information is not allowed in public content";

export type ProhibitedContentType =
  | "phone"
  | "whatsapp"
  | "email"
  | "url"
  | "telegram";

export interface ContentViolation {
  type: ProhibitedContentType;
  match: string;
}

export interface ContactContentDetection {
  hasPhone: boolean;
  hasWhatsapp: boolean;
  hasTelegram: boolean;
  hasEmail: boolean;
  hasUrl: boolean;
  blocked: boolean;
  reasons: string[];
}

const EMPTY_DETECTION: ContactContentDetection = {
  hasPhone: false,
  hasWhatsapp: false,
  hasTelegram: false,
  hasEmail: false,
  hasUrl: false,
  blocked: false,
  reasons: [],
};

// Email: local@domain.tld
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// Explicit URLs (http(s):// or www.)
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/i;

// Bare domains using a curated TLD list (keeps false positives low while still
// blocking the common ways users paste contact links).
const BARE_DOMAIN_RE =
  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|io|in|me|co|xyz|info|biz|online|site|link|app|dev|us|uk|ru|tk|gg|to|cc|club|live|fun|vip|cam)\b/i;

const INDIAN_PHONE_10_RE = /\b[6-9]\d{9}\b/;
const INDIAN_PHONE_PLUS91_RE = /\+91[\s\-().]*[6-9](?:[\s\-().]*\d){9}\b/;
const INDIAN_PHONE_FORMATTED_RE = /\b[6-9]\d{2}[\s\-]\d{3}[\s\-]\d{4}\b/;
const INDIAN_PHONE_DASHED_RE = /\b[6-9]\d{2}-\d{3}-\d{4}\b/;

const WHATSAPP_KEYWORD_RE = /\b(?:whatsapp|whats\s*app)\b/i;
const WHATSAPP_SHORT_RE = /\bwa\b/i;
const WHATSAPP_LINK_RE = /wa\.me\//i;

const TELEGRAM_KEYWORD_RE = /\btelegram\b/i;
const TELEGRAM_LINK_RE = /(?:t\.me\/|telegram\.me\/)/i;
const TELEGRAM_HANDLE_RE = /@[A-Za-z0-9_]{4,}/;

// Phone candidates: a run starting with an optional +, containing digits and
// common separators. We then count the bare digits to decide.
const PHONE_CANDIDATE_RE = /\+?\d(?:[\d\s().\-]{6,})\d/g;

function normalizeText(value: string): string {
  return value.normalize("NFKC");
}

/** Returns the matched phone-like substring, or null. */
function findPhone(text: string): string | null {
  const candidates = text.match(PHONE_CANDIDATE_RE);
  if (!candidates) return null;
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 15) return candidate.trim();
  }
  return null;
}

export function containsEmail(text: string): boolean {
  if (!text) return false;
  return EMAIL_RE.test(normalizeText(text));
}

export function containsUrl(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  return URL_RE.test(normalized) || BARE_DOMAIN_RE.test(normalized);
}

export function containsPhoneNumber(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);

  if (INDIAN_PHONE_10_RE.test(normalized)) return true;
  if (INDIAN_PHONE_PLUS91_RE.test(normalized)) return true;
  if (INDIAN_PHONE_FORMATTED_RE.test(normalized)) return true;
  if (INDIAN_PHONE_DASHED_RE.test(normalized)) return true;

  return findPhone(normalized) !== null;
}

export function containsWhatsappReference(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  return (
    WHATSAPP_KEYWORD_RE.test(normalized) ||
    WHATSAPP_LINK_RE.test(normalized) ||
    WHATSAPP_SHORT_RE.test(normalized)
  );
}

export function containsTelegramReference(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  return (
    TELEGRAM_KEYWORD_RE.test(normalized) ||
    TELEGRAM_LINK_RE.test(normalized) ||
    TELEGRAM_HANDLE_RE.test(normalized)
  );
}

export function detectContactContent(text: string): ContactContentDetection {
  if (!text || !text.trim()) return { ...EMPTY_DETECTION };

  const hasPhone = containsPhoneNumber(text);
  const hasWhatsapp = containsWhatsappReference(text);
  const hasTelegram = containsTelegramReference(text);
  const hasEmail = containsEmail(text);
  const hasUrl = containsUrl(text);

  const reasons: string[] = [];
  if (hasPhone) reasons.push("phone");
  if (hasWhatsapp) reasons.push("whatsapp");
  if (hasTelegram) reasons.push("telegram");
  if (hasEmail) reasons.push("email");
  if (hasUrl) reasons.push("url");

  return {
    hasPhone,
    hasWhatsapp,
    hasTelegram,
    hasEmail,
    hasUrl,
    blocked: reasons.length > 0,
    reasons,
  };
}

function firstMatch(text: string, type: ProhibitedContentType): string {
  const normalized = normalizeText(text);
  switch (type) {
    case "email":
      return normalized.match(EMAIL_RE)?.[0] ?? type;
    case "url":
      return normalized.match(URL_RE)?.[0] ?? normalized.match(BARE_DOMAIN_RE)?.[0] ?? type;
    case "whatsapp":
      return (
        normalized.match(WHATSAPP_LINK_RE)?.[0] ??
        normalized.match(WHATSAPP_KEYWORD_RE)?.[0] ??
        normalized.match(WHATSAPP_SHORT_RE)?.[0] ??
        type
      );
    case "telegram":
      return (
        normalized.match(TELEGRAM_LINK_RE)?.[0] ??
        normalized.match(TELEGRAM_HANDLE_RE)?.[0] ??
        normalized.match(TELEGRAM_KEYWORD_RE)?.[0] ??
        type
      );
    case "phone":
      return findPhone(normalized) ?? type;
    default:
      return type;
  }
}

/** Detect the first prohibited contact pattern in a string. */
export function detectProhibitedContent(value: string): ContentViolation | null {
  const detection = detectContactContent(value);
  if (!detection.blocked) return null;

  const order: ProhibitedContentType[] = [
    "email",
    "url",
    "whatsapp",
    "telegram",
    "phone",
  ];

  for (const type of order) {
    if (detection.reasons.includes(type)) {
      return { type, match: firstMatch(value, type) };
    }
  }

  return null;
}

/** True when text is free of phone/email/URL/Telegram contact patterns. */
export function isContentClean(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return true;
  return !detectContactContent(value).blocked;
}

const TYPE_LABEL: Record<ProhibitedContentType, string> = {
  phone: "phone numbers",
  whatsapp: "WhatsApp references",
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
  reasons: string[];
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
    const detection = detectContactContent(f.value);
    if (!detection.blocked) continue;

    const violationType = (detection.reasons[0] ?? "phone") as ProhibitedContentType;
    const violation: ContentViolation = {
      type: violationType,
      match: firstMatch(f.value, violationType),
    };

    console.warn("[content-filter] blocked contact in public field", {
      field: f.field,
      label: f.label,
      reasons: detection.reasons,
      types: detection.reasons.map((reason) => TYPE_LABEL[reason as ProhibitedContentType] ?? reason),
    });

    return {
      field: f.field,
      message: CONTACT_CONTENT_BLOCKED_MESSAGE,
      reasons: detection.reasons,
      violation,
    };
  }
  return null;
}

import type { ContactInfo } from "@/lib/types";

export type ListingContactSource = {
  whatsapp?: string | null;
  telegram?: string | null;
  contactTelegram?: string | null;
  contactEmail?: string | null;
  contactText?: string | null;
  contactInstagram?: string | null;
  contactWebsite?: string | null;
  contact?: Partial<ContactInfo> | null;
};

export function sanitizePhone(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+") ? `+${digits.slice(1).replace(/\D/g, "")}` : digits.replace(/\D/g, "");
  return normalized || undefined;
}

export function sanitizeTelegram(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^@+/, "").replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
  return trimmed || undefined;
}

export function sanitizeEmail(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed || undefined;
}

export function buildWhatsAppUrl(value: string) {
  const phone = sanitizePhone(value);
  if (!phone) return undefined;
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function buildTelegramUrl(value: string) {
  const username = sanitizeTelegram(value);
  if (!username) return undefined;
  return `https://t.me/${username}`;
}

export function normalizeListingContact(source: ListingContactSource): ContactInfo {
  const whatsapp = sanitizePhone(source.whatsapp ?? source.contact?.whatsapp);
  const telegram = sanitizeTelegram(
    source.contactTelegram ?? source.telegram ?? source.contact?.telegram
  );
  const email = sanitizeEmail(source.contactEmail ?? source.contact?.email);
  const phone = sanitizePhone(source.contactText ?? source.contact?.phone);
  const instagram = source.contactInstagram?.trim() || source.contact?.instagram?.trim() || undefined;
  const website = source.contactWebsite?.trim() || source.contact?.website?.trim() || undefined;
  const rawText = source.contactText?.trim();
  const customText =
    !phone && rawText && rawText !== source.contact?.phone ? rawText : source.contact?.customText?.trim() || undefined;

  return {
    ...(whatsapp ? { whatsapp } : {}),
    ...(telegram ? { telegram } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(instagram ? { instagram } : {}),
    ...(website ? { website } : {}),
    ...(customText && !phone ? { customText } : {}),
  };
}

export function hasContactInfo(contact: ContactInfo): boolean {
  return Boolean(
    contact.whatsapp ||
      contact.telegram ||
      contact.email ||
      contact.phone ||
      contact.instagram ||
      contact.website ||
      contact.customText
  );
}

export function hasListingContact(source: ListingContactSource): boolean {
  return hasContactInfo(normalizeListingContact(source));
}

export function redactListingContact() {
  return {
    contact: {} as ContactInfo,
    whatsapp: null,
    telegram: null,
    contactEmail: null,
    contactTelegram: null,
    contactText: null,
    contactInstagram: null,
    contactWebsite: null,
  };
}

export function serializeListingContact(source: ListingContactSource) {
  const contact = normalizeListingContact(source);
  return {
    contact,
    whatsapp: contact.whatsapp ?? null,
    telegram: contact.telegram ?? null,
    contactEmail: contact.email ?? null,
    contactTelegram: contact.telegram ?? null,
    contactText: contact.phone ?? contact.customText ?? null,
    contactInstagram: contact.instagram ?? null,
    contactWebsite: contact.website ?? null,
  };
}

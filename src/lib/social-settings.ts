import { db } from "@/lib/db";
import {
  DEFAULT_SOCIAL_URLS,
  SOCIAL_SETTING_KEYS,
} from "@/lib/footer-routes";

export type SocialLinks = {
  twitter: string;
  instagram: string;
  youtube: string;
  website: string;
};

export type SocialLinkKey = keyof SocialLinks;

const KEY_BY_FIELD: Record<SocialLinkKey, string> = {
  twitter: SOCIAL_SETTING_KEYS.twitter,
  instagram: SOCIAL_SETTING_KEYS.instagram,
  youtube: SOCIAL_SETTING_KEYS.youtube,
  website: SOCIAL_SETTING_KEYS.website,
};

function normalizeUrl(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function isValidHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Load all social URLs from SiteSettings (empty string if unset). */
export async function getSocialSettings(): Promise<SocialLinks> {
  const keys = Object.values(SOCIAL_SETTING_KEYS);
  const rows = await db.siteSettings.findMany({
    where: { key: { in: keys } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    twitter: normalizeUrl(map.get(SOCIAL_SETTING_KEYS.twitter)),
    instagram: normalizeUrl(map.get(SOCIAL_SETTING_KEYS.instagram)),
    youtube: normalizeUrl(map.get(SOCIAL_SETTING_KEYS.youtube)),
    website: normalizeUrl(map.get(SOCIAL_SETTING_KEYS.website)),
  };
}

/** Public-facing links — only non-empty, valid URLs. */
export async function getPublicSocialLinks(): Promise<Partial<SocialLinks>> {
  const all = await getSocialSettings();
  const out: Partial<SocialLinks> = {};
  for (const key of Object.keys(all) as SocialLinkKey[]) {
    const value = all[key];
    if (value && value !== "#" && isValidHttpUrl(value)) {
      out[key] = value;
    }
  }
  return out;
}

/** Seed defaults when no row exists (admin UI / migrations). */
export function defaultSocialLinks(): SocialLinks {
  return { ...DEFAULT_SOCIAL_URLS };
}

export function validateSocialLinks(input: Partial<SocialLinks>): string | null {
  for (const key of Object.keys(input) as SocialLinkKey[]) {
    const value = normalizeUrl(input[key]);
    if (value && !isValidHttpUrl(value)) {
      return `Invalid URL for ${key}`;
    }
  }
  return null;
}

export async function saveSocialSettings(input: Partial<SocialLinks>): Promise<SocialLinks> {
  const error = validateSocialLinks(input);
  if (error) throw new Error(error);

  for (const field of Object.keys(input) as SocialLinkKey[]) {
    if (input[field] === undefined) continue;
    const key = KEY_BY_FIELD[field];
    const value = normalizeUrl(input[field]);
    await db.siteSettings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return getSocialSettings();
}

/** Canonical public paths for footer navigation. */

export const FOOTER_COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Contact", href: "/contact" },
  { label: "DMCA", href: "/dmca" },
  { label: "Safety Tips", href: "/safety-tips" },
  { label: "FAQ", href: "/faq" },
  { label: "Advertise", href: "/advertise" },
] as const;

/** Browse slugs mapped to active category routes (see rewrites in next.config.ts). */
export const FOOTER_BROWSE_LINKS = [
  { name: "Escorts", href: "/escorts" },
  { name: "Massage", href: "/massage" },
  { name: "Dating", href: "/dating" },
  { name: "Trans", href: "/trans" },
  { name: "Male Escorts", href: "/male-escorts" },
  { name: "Couples", href: "/couples" },
] as const;

export const FOOTER_LOCATION_LINKS = [
  { name: "Mumbai", href: "/mumbai" },
  { name: "Delhi", href: "/delhi" },
  { name: "Bangalore", href: "/bangalore" },
  { name: "Hyderabad", href: "/hyderabad" },
  { name: "Chennai", href: "/chennai" },
  { name: "Kolkata", href: "/kolkata" },
] as const;

export const CMS_SLUG_ALIASES: Record<string, string> = {
  "privacy-policy": "privacy",
};

export const SOCIAL_SETTING_KEYS = {
  twitter: "social_twitter_url",
  instagram: "social_instagram_url",
  youtube: "social_youtube_url",
  website: "social_website_url",
} as const;

export const DEFAULT_SOCIAL_URLS = {
  twitter: "https://twitter.com/SecretZa",
  instagram: "https://instagram.com/SecretZa",
  youtube: "https://youtube.com/@SecretZa",
  website: "https://SecretZa.com",
};

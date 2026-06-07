import { slugify } from "@/lib/slugify";

export type SubcategoryDef = {
  name: string;
  slug: string;
  order: number;
};

export type ParentCategoryDef = {
  name: string;
  slug: string;
  order: number;
  icon?: string;
  color?: string;
  isFeatured?: boolean;
  subcategories: SubcategoryDef[];
};

/** Additional root categories required by the product taxonomy but absent from the original seed. */
export const EXTRA_ROOT_CATEGORIES: Omit<ParentCategoryDef, "subcategories">[] = [
  { name: "Adult Jobs", slug: "adult-jobs", order: 13, icon: "💼", color: "#A855F7", isFeatured: false },
  { name: "Couples", slug: "couples", order: 14, icon: "👫", color: "#E11D48", isFeatured: false },
  { name: "Models", slug: "models", order: 15, icon: "📸", color: "#14B8A6", isFeatured: false },
];

/**
 * Secretza adult-services taxonomy.
 * Parent slugs must match existing root categories — never change IDs/slugs of roots in use.
 */
export const CATEGORY_TAXONOMY: ParentCategoryDef[] = [
  {
    name: "Escorts",
    slug: "escorts",
    order: 1,
    subcategories: [
      { name: "Independent Escorts", slug: "independent-escorts", order: 1 },
      { name: "VIP Escorts", slug: "vip-escorts", order: 2 },
      { name: "Premium Escorts", slug: "premium-escorts", order: 3 },
      { name: "Verified Escorts", slug: "verified-escorts", order: 4 },
      { name: "Female Escorts", slug: "female-escorts", order: 5 },
      { name: "College Escorts", slug: "college-escorts", order: 6 },
      { name: "Mature Escorts", slug: "mature-escorts", order: 7 },
      { name: "International Escorts", slug: "international-escorts", order: 8 },
      { name: "Travel Escorts", slug: "travel-escorts", order: 9 },
      { name: "Outcall Escorts", slug: "outcall-escorts", order: 10 },
    ],
  },
  {
    name: "Massage",
    slug: "massage",
    order: 2,
    subcategories: [
      { name: "Abhyanga Massage", slug: "abhyanga-massage", order: 1 },
      { name: "Body Massage", slug: "body-massage", order: 2 },
      { name: "Ayurvedic Massage", slug: "ayurvedic-massage", order: 3 },
      { name: "Spa Massage", slug: "spa-massage", order: 4 },
      { name: "Sensual Massage", slug: "sensual-massage", order: 5 },
      { name: "Female to Male Massage", slug: "female-to-male-massage", order: 6 },
      { name: "Male to Female Massage", slug: "male-to-female-massage", order: 7 },
      { name: "Couple Massage", slug: "couple-massage", order: 8 },
      { name: "Outcall Massage", slug: "outcall-massage", order: 9 },
      { name: "Hotel Massage", slug: "hotel-massage", order: 10 },
    ],
  },
  {
    name: "Dating",
    slug: "dating",
    order: 3,
    subcategories: [
      { name: "Casual Dating", slug: "casual-dating", order: 1 },
      { name: "Friendship", slug: "friendship", order: 2 },
      { name: "Blind Date", slug: "blind-date", order: 3 },
      { name: "Dinner Date", slug: "dinner-date", order: 4 },
      { name: "Travel Date", slug: "travel-date", order: 5 },
      { name: "Elite Dating", slug: "elite-dating", order: 6 },
    ],
  },
  {
    name: "Companionship",
    slug: "companionship",
    order: 4,
    subcategories: [
      { name: "Travel Companion", slug: "travel-companion", order: 1 },
      { name: "Dinner Companion", slug: "dinner-companion", order: 2 },
      { name: "Business Companion", slug: "business-companion", order: 3 },
      { name: "Event Companion", slug: "event-companion", order: 4 },
      { name: "Social Companion", slug: "social-companion", order: 5 },
    ],
  },
  {
    name: "Adult Services",
    slug: "adult-services",
    order: 5,
    subcategories: [
      { name: "Adult Chat", slug: "adult-chat", order: 1 },
      { name: "Private Shows", slug: "private-shows", order: 2 },
      { name: "Fantasy Services", slug: "fantasy-services", order: 3 },
      { name: "Roleplay Services", slug: "roleplay-services", order: 4 },
      { name: "Adult Entertainment", slug: "adult-entertainment", order: 5 },
    ],
  },
  {
    name: "Adult Jobs",
    slug: "adult-jobs",
    order: 13,
    subcategories: [
      { name: "Escort Jobs", slug: "escort-jobs", order: 1 },
      { name: "Massage Jobs", slug: "massage-jobs", order: 2 },
      { name: "Model Jobs", slug: "model-jobs", order: 3 },
      { name: "Club Jobs", slug: "club-jobs", order: 4 },
      { name: "Promotional Jobs", slug: "promotional-jobs", order: 5 },
    ],
  },
  {
    name: "Couples",
    slug: "couples",
    order: 14,
    subcategories: [
      { name: "Couple Escorts", slug: "couple-escorts", order: 1 },
      { name: "Swinger Couples", slug: "swinger-couples", order: 2 },
      // Name differs from Massage child — Category.name is globally unique in schema.
      { name: "Couples Massage", slug: "couples-massage", order: 3 },
      { name: "Couple Dating", slug: "couple-dating", order: 4 },
    ],
  },
  {
    name: "Models",
    slug: "models",
    order: 15,
    subcategories: [
      { name: "Fashion Models", slug: "fashion-models", order: 1 },
      { name: "Glamour Models", slug: "glamour-models", order: 2 },
      { name: "Freelance Models", slug: "freelance-models", order: 3 },
      { name: "Event Models", slug: "event-models", order: 4 },
      { name: "Promotional Models", slug: "promotional-models", order: 5 },
    ],
  },
  {
    name: "Striptease",
    slug: "striptease",
    order: 6,
    subcategories: [
      { name: "Private Striptease", slug: "private-striptease", order: 1 },
      { name: "Club Performers", slug: "club-performers", order: 2 },
      { name: "Event Performers", slug: "event-performers", order: 3 },
      { name: "Bachelor Party Shows", slug: "bachelor-party-shows", order: 4 },
    ],
  },
  {
    name: "BDSM",
    slug: "bdsm",
    order: 7,
    subcategories: [
      { name: "Dominatrix", slug: "dominatrix", order: 1 },
      { name: "Submission", slug: "submission", order: 2 },
      { name: "Mistress Services", slug: "mistress-services", order: 3 },
      { name: "Fetish Training", slug: "fetish-training", order: 4 },
      { name: "BDSM Sessions", slug: "bdsm-sessions", order: 5 },
    ],
  },
  {
    name: "Fetish",
    slug: "fetish",
    order: 8,
    subcategories: [
      { name: "Foot Fetish", slug: "foot-fetish", order: 1 },
      { name: "Latex Fetish", slug: "latex-fetish", order: 2 },
      { name: "Roleplay Fetish", slug: "roleplay-fetish", order: 3 },
      { name: "Leather Fetish", slug: "leather-fetish", order: 4 },
      { name: "Fantasy Fetish", slug: "fantasy-fetish", order: 5 },
    ],
  },
  {
    name: "Webcam",
    slug: "webcam",
    order: 9,
    subcategories: [
      { name: "Live Webcam", slug: "live-webcam", order: 1 },
      { name: "Private Webcam", slug: "private-webcam", order: 2 },
      { name: "Video Calls", slug: "video-calls", order: 3 },
      { name: "Premium Webcam", slug: "premium-webcam", order: 4 },
    ],
  },
  {
    name: "Phone & Sexting",
    slug: "phone-sexting",
    order: 10,
    subcategories: [
      { name: "Phone Chat", slug: "phone-chat", order: 1 },
      { name: "Sexting", slug: "sexting", order: 2 },
      { name: "Voice Calls", slug: "voice-calls", order: 3 },
      { name: "Premium Calls", slug: "premium-calls", order: 4 },
    ],
  },
  {
    name: "Events & Parties",
    slug: "events-parties",
    order: 11,
    subcategories: [
      { name: "Bachelor Parties", slug: "bachelor-parties", order: 1 },
      { name: "VIP Parties", slug: "vip-parties", order: 2 },
      { name: "Private Events", slug: "private-events", order: 3 },
      { name: "Nightlife Events", slug: "nightlife-events", order: 4 },
    ],
  },
  {
    name: "Gigolo",
    slug: "gigolo",
    order: 12,
    subcategories: [
      { name: "Male Escorts", slug: "male-escorts", order: 1 },
      { name: "Premium Gigolos", slug: "premium-gigolos", order: 2 },
      { name: "Verified Gigolos", slug: "verified-gigolos", order: 3 },
      { name: "Travel Gigolos", slug: "travel-gigolos", order: 4 },
    ],
  },
];

export function buildSubcategorySeo(parentName: string, name: string) {
  return {
    seoTitle: `${name} - ${parentName} | Secretza`,
    seoDescription: `Browse ${name} listings in ${parentName} on Secretza. Find verified ${name.toLowerCase()} services and profiles.`,
  };
}

/** Validate taxonomy invariants used by the seeder. */
export function validateCategoryTaxonomy(taxonomy: ParentCategoryDef[] = CATEGORY_TAXONOMY) {
  const slugs = new Set<string>();
  const names = new Set<string>();
  const errors: string[] = [];

  for (const parent of taxonomy) {
    if (slugs.has(parent.slug)) errors.push(`Duplicate parent slug: ${parent.slug}`);
    if (names.has(parent.name)) errors.push(`Duplicate parent name: ${parent.name}`);
    if (slugify(parent.name) !== parent.slug && parent.slug !== "phone-sexting") {
      // phone-sexting is intentional (ampersand stripped)
    }
    slugs.add(parent.slug);
    names.add(parent.name);

    for (const child of parent.subcategories) {
      if (slugs.has(child.slug)) errors.push(`Duplicate subcategory slug: ${child.slug}`);
      if (names.has(child.name)) errors.push(`Duplicate subcategory name: ${child.name}`);
      if (slugify(child.name) !== child.slug) {
        errors.push(`Slug mismatch for "${child.name}": expected ${slugify(child.name)}, got ${child.slug}`);
      }
      slugs.add(child.slug);
      names.add(child.name);
    }
  }

  return errors;
}

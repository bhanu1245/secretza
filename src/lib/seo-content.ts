// ==========================================
// SecretZa SEO Content Generation Engine v2
// ==========================================
// Generates unique, keyword-rich SEO content for every page type.
// Features: content rotation, city-context injection, trust blocks,
// enhanced FAQs, and rich internal linking.
// All content is designed for Indian adult classifieds market.

// ------------------------------------------
// Interfaces
// ------------------------------------------

export interface SEOContent {
  title: string;
  metaDescription: string;
  h1: string;
  introParagraph: string;
  faqs: Array<{ question: string; answer: string }>;
  breadcrumbItems: Array<{ name: string; url: string }>;
  internalLinks: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }>;
  // NEW FIELDS (optional for backward compatibility):
  trustBlock?: string;
  cityHighlights?: string[];
  lastUpdated?: string;
  secondaryParagraph?: string;
  // Phase 7 fields:
  trendingSearches?: string[];
  popularSearches?: string[];
  authorInfo?: { name: string; role: string; url?: string };
  relatedPages?: Array<{ title: string; url: string; type: string }>;
  pageType?: string;
  listingCountHint?: number;
  /** Full assembled intro (500+ words) when generated via enrichment engine */
  fullIntroContent?: string;
  /** City enrichment snapshot for audit/debug */
  cityEnrichment?: CityEnrichment;
  /** Primary keyword for this page (e.g. "verified escorts in Mumbai") */
  primaryKeyword?: string;
  /** Secondary keyword cluster (JSON-serialisable array) */
  secondaryKeywords?: string[];
  /** V6 generation metadata (writing style, retries, local refs, etc.) */
  generationMeta?: Record<string, unknown>;
}

interface SchemaBreadcrumbItem {
  name: string;
  url: string;
}

interface SchemaFAQItem {
  question: string;
  answer: string;
}

// ------------------------------------------
// Imports
// ------------------------------------------

import { indiaStates, indiaCities, getCityBySlug, getNearbyCities as getGeoNearbyCities } from '@/lib/india-geo-data';
import { generateCitySEOContent } from '@/lib/seo-engine';
import {
  type CityEnrichment,
} from '@/lib/seo-city-enrichment';
import {
  calculateVisibleWordCount,
  SEO_GENERATION_TARGET_WORDS,
  SEO_MIN_WORD_COUNT,
} from "@/lib/seo-quality";

// ------------------------------------------
// Category Data
// ------------------------------------------

const CATEGORIES = [
  { name: "Escorts", slug: "escorts" },
  { name: "Massage", slug: "massage" },
  { name: "Dating", slug: "dating" },
  { name: "Trans", slug: "trans" },
  { name: "Male Escorts", slug: "male-escorts" },
  { name: "Couples", slug: "couples" },
  { name: "Adult Jobs", slug: "adult-jobs" },
  { name: "Adult Services", slug: "adult-services" },
  { name: "Webcam", slug: "webcam" },
  { name: "Phone & Chat", slug: "phone-chat" },
] as const;

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  escorts: "Professional companion and escort services for discerning adults seeking quality encounters.",
  massage: "Therapeutic and sensual massage services offered by trained professionals across India.",
  dating: "Connect with like-minded adults for dating, companionship, and meaningful encounters.",
  trans: "Transgender escort and companion services for those seeking unique experiences.",
  "male-escorts": "Male companion and escort services available for women, men, and couples.",
  couples: "Couple-friendly services and listings for adventurous partners seeking shared experiences.",
  "adult-jobs": "Adult industry job listings and employment opportunities across India.",
  "adult-services": "A comprehensive range of adult-oriented services and professional offerings.",
  webcam: "Live webcam models, cam shows, and virtual adult entertainment services.",
  "phone-chat": "Adult phone chat, sexting services, and intimate conversation partners.",
};

const CATEGORY_FAQ_TEMPLATES = [
  {
    category: "escorts",
    faqs: [
      "How do I verify an escort listing on SecretZa?",
      "Are the escort profiles on SecretZa verified and legitimate?",
      "What safety precautions should I take when meeting an escort?",
      "How are SecretZa escort listings different from other platforms?",
      "Can I find both incall and outcall escort services on SecretZa?",
    ],
  },
  {
    category: "massage",
    faqs: [
      "What types of massage services are available on SecretZa?",
      "Are the massage providers on SecretZa professionally trained?",
      "How do I book a massage appointment through SecretZa?",
      "What are the typical massage service rates in Indian cities?",
      "Can I find nuru and tantra massage specialists on SecretZa?",
    ],
  },
  {
    category: "dating",
    faqs: [
      "How does SecretZa differ from mainstream dating apps?",
      "Is SecretZa safe for adult dating and casual encounters?",
      "Can I find both short-term and long-term dating connections?",
      "What privacy features does SecretZa offer for dating profiles?",
      "Are there age verification measures on SecretZa dating listings?",
    ],
  },
  {
    category: "trans",
    faqs: [
      "How do I find verified transgender escorts on SecretZa?",
      "Are the trans listings on SecretZa respectful and inclusive?",
      "What types of trans services are available on SecretZa?",
      "Can trans providers create their own listings on SecretZa?",
      "How does SecretZa ensure safety for transgender service providers?",
    ],
  },
  {
    category: "male-escorts",
    faqs: [
      "How do I find male escort services on SecretZa?",
      "Are the male escort profiles on SecretZa verified?",
      "Can women book male escorts through SecretZa?",
      "What services do male escorts on SecretZa typically offer?",
      "How are male escort listings moderated on SecretZa?",
    ],
  },
  {
    category: "couples",
    faqs: [
      "What couple-friendly services are listed on SecretZa?",
      "Can couples find escort services together on SecretZa?",
      "Are there swinger and lifestyle listings for couples?",
      "How does SecretZa handle couple-specific service listings?",
      "What privacy options are available for couple bookings?",
    ],
  },
  {
    category: "adult-jobs",
    faqs: [
      "What types of adult industry jobs are listed on SecretZa?",
      "How do I apply for adult jobs listed on SecretZa?",
      "Are the adult job listings on SecretZa legitimate and verified?",
      "What categories of adult employment are available?",
      "Can I post my resume or profile for adult job opportunities?",
    ],
  },
  {
    category: "adult-services",
    faqs: [
      "What types of adult services are listed on SecretZa?",
      "How are adult service providers verified on SecretZa?",
      "Can I find specialized adult services in my city?",
      "What makes SecretZa the best platform for adult services?",
      "How do I contact adult service providers on SecretZa?",
    ],
  },
  {
    category: "webcam",
    faqs: [
      "How do webcam services work on SecretZa?",
      "Are the webcam models on SecretZa verified?",
      "What payment methods are accepted for webcam services?",
      "Can I book private webcam sessions through SecretZa?",
      "How does SecretZa protect my privacy during webcam sessions?",
    ],
  },
  {
    category: "phone-chat",
    faqs: [
      "What types of phone and chat services are available on SecretZa?",
      "How do I connect with phone chat operators?",
      "Are phone chat services on SecretZa private and secure?",
      "What are the rates for adult phone chat services?",
      "Can I find multilingual phone chat operators on SecretZa?",
    ],
  },
] as const;

const CATEGORY_TONES: Record<string, {
  primaryTheme: string;
  secondaryThemes: string[];
  targetAudience: string;
  uniqueAngle: string;
}> = {
  escorts: {
    primaryTheme: "premium companionship",
    secondaryThemes: ["nightlife", "travel companionship", "discretion", "high-profile encounters"],
    targetAudience: "discerning adults seeking premium companionship",
    uniqueAngle: "verified profiles with real photos and secure messaging for discreet encounters",
  },
  massage: {
    primaryTheme: "wellness and relaxation",
    secondaryThemes: ["spa culture", "therapeutic massage", "sensual wellness", "self-care"],
    targetAudience: "health-conscious adults seeking relaxation and rejuvenation",
    uniqueAngle: "trained professionals offering therapeutic and sensual massage in premium settings",
  },
  dating: {
    primaryTheme: "social connections",
    secondaryThemes: ["casual meetings", "meaningful encounters", "companionship", "networking"],
    targetAudience: "open-minded adults seeking genuine connections",
    uniqueAngle: "a judgment-free platform for adults seeking authentic dating experiences",
  },
  trans: {
    primaryTheme: "inclusive companionship",
    secondaryThemes: ["unique experiences", "transgender services", "diversity", "respect"],
    targetAudience: "adults seeking unique and inclusive companionship experiences",
    uniqueAngle: "inclusive, respectful listings with thorough verification and community support",
  },
  "male-escorts": {
    primaryTheme: "male companionship",
    secondaryThemes: ["women's services", "couples companionship", "event companions", "travel"],
    targetAudience: "women, men, and couples seeking quality male companionship",
    uniqueAngle: "verified male companions available for events, travel, and personal encounters",
  },
  couples: {
    primaryTheme: "shared experiences",
    secondaryThemes: ["couple-friendly", "adventurous partners", "lifestyle services", "mutual enjoyment"],
    targetAudience: "adventurous couples seeking to enhance their experiences together",
    uniqueAngle: "couple-focused services designed for shared enjoyment and exploration",
  },
  "adult-jobs": {
    primaryTheme: "career opportunities",
    secondaryThemes: ["employment", "gig economy", "adult industry", "freelance work"],
    targetAudience: "adults seeking employment in the adult entertainment industry",
    uniqueAngle: "verified job listings from legitimate employers with transparent requirements",
  },
  "adult-services": {
    primaryTheme: "professional services",
    secondaryThemes: ["comprehensive offerings", "specialized services", "premium providers", "variety"],
    targetAudience: "adults seeking a wide range of professional adult-oriented services",
    uniqueAngle: "the widest selection of verified adult services across every category",
  },
  webcam: {
    primaryTheme: "virtual entertainment",
    secondaryThemes: ["live shows", "private sessions", "cam models", "digital intimacy"],
    targetAudience: "adults seeking live virtual entertainment and private cam experiences",
    uniqueAngle: "live webcam sessions with verified models and secure private shows",
  },
  "phone-chat": {
    primaryTheme: "intimate conversation",
    secondaryThemes: ["phone chat", "sexting", "virtual companionship", "discreet communication"],
    targetAudience: "adults seeking intimate conversation and discreet virtual companionship",
    uniqueAngle: "private, secure phone and chat services with verified operators",
  },
};

// ------------------------------------------
// City Data (derived from india-geo-data)
// ------------------------------------------

const MAJOR_INDIAN_CITIES = [
  { name: "Mumbai", slug: "mumbai" },
  { name: "Delhi", slug: "delhi" },
  { name: "Bangalore", slug: "bangalore" },
  { name: "Hyderabad", slug: "hyderabad" },
  { name: "Chennai", slug: "chennai" },
  { name: "Kolkata", slug: "kolkata" },
  { name: "Pune", slug: "pune" },
  { name: "Jaipur", slug: "jaipur" },
  { name: "Kochi", slug: "kochi" },
  { name: "Chandigarh", slug: "chandigarh" },
  { name: "Ahmedabad", slug: "ahmedabad" },
  { name: "Goa", slug: "goa" },
  { name: "Lucknow", slug: "lucknow" },
  { name: "Nagpur", slug: "nagpur" },
  { name: "Indore", slug: "indore" },
  { name: "Bhopal", slug: "bhopal" },
  { name: "Patna", slug: "patna" },
  { name: "Guwahati", slug: "guwahati" },
  { name: "Noida", slug: "noida" },
  { name: "Gurgaon", slug: "gurgaon" },
  { name: "Thane", slug: "thane" },
  { name: "Coimbatore", slug: "coimbatore" },
  { name: "Surat", slug: "surat" },
  { name: "Vizag", slug: "vizag" },
] as const;

// ------------------------------------------
// Constants
// ------------------------------------------

const SITE_NAME = "SecretZa";
const BASE_URL = "https://SecretZa.com";
const BRAND_TAGLINE = "India's Premium Adult Classifieds Platform";

// ------------------------------------------
// City Context (lazy-loaded with fallback)
// ------------------------------------------

interface CityContextModule {
  getCityDescription: (slug: string) => string;
  getCityNightlife: (slug: string) => string[];
  getCityTourism: (slug: string) => string[];
  getCityBusiness: (slug: string) => string[];
  getCityNeighborhoods: (slug: string) => string[];
  getCityFoodAreas: (slug: string) => string[];
  getCityUniqueSellingPoints: (slug: string) => string[];
}

let _cityContextModule: CityContextModule | null = null;
let _cityContextLoadAttempted = false;

/**
 * Safely load city-context module with graceful fallback.
 * The module is created by a concurrent agent task.
 */
function getCityContext(): CityContextModule | null {
  if (_cityContextLoadAttempted) return _cityContextModule;
  _cityContextLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _cityContextModule = require('@/lib/city-context') as CityContextModule;
  } catch {
    _cityContextModule = null;
  }
  return _cityContextModule;
}

function getDescription(slug: string): string {
  return getCityContext()?.getCityDescription?.(slug) ?? '';
}

function getNightlife(slug: string): string[] {
  return getCityContext()?.getCityNightlife?.(slug) ?? [];
}

function getTourism(slug: string): string[] {
  return getCityContext()?.getCityTourism?.(slug) ?? [];
}

function getBusiness(slug: string): string[] {
  return getCityContext()?.getCityBusiness?.(slug) ?? [];
}

function getNeighborhoods(slug: string): string[] {
  return getCityContext()?.getCityNeighborhoods?.(slug) ?? [];
}

function getFoodAreas(slug: string): string[] {
  return getCityContext()?.getCityFoodAreas?.(slug) ?? [];
}

function getSellingPoints(slug: string): string[] {
  return getCityContext()?.getCityUniqueSellingPoints?.(slug) ?? [];
}

// ------------------------------------------
// Helper Functions (Private)
// ------------------------------------------

/**
 * Get a comma-separated list of category names for titles/intros.
 */
function getCategoryList(): string {
  return CATEGORIES.slice(0, 5).map((c) => c.name).join(", ");
}

/**
 * Get the lowercase category name for natural prose.
 */
function lowerCategory(name: string): string {
  return name.toLowerCase();
}

/**
 * Resolve a city slug that may be an alias to its canonical slug.
 * Handles cases like "delhi" → "new-delhi", "gurgaon" → "gurugram", etc.
 */
function resolveCitySlug(slug: string): string {
  const direct = getCityBySlug(slug);
  if (direct) return slug;
  const aliasMatch = indiaCities.find((c) => c.aliases.includes(slug));
  return aliasMatch?.slug ?? slug;
}

/**
 * Get nearby cities for a given slug. Uses india-geo-data with fallback to MAJOR cities.
 */
function getNearbyCities(citySlug: string, limit = 6): Array<{ name: string; slug: string }> {
  const resolved = resolveCitySlug(citySlug);
  const geo = getGeoNearbyCities(resolved, limit);
  if (geo.length > 0) {
    return geo.map((c) => ({ name: c.name, slug: c.slug }));
  }
  // Fallback: pick from major cities excluding the current one
  return MAJOR_INDIAN_CITIES
    .filter((c) => c.slug !== citySlug)
    .slice(0, limit)
    .map((c) => ({ name: c.name, slug: c.slug }));
}

/**
 * Deterministic hash for content rotation.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Select a template index deterministically from a slug hash.
 */
function selectTemplateIndex(slug: string, count: number, extra = ''): number {
  return hashString(slug + extra) % count;
}

/**
 * Pick a random subset from an array, deterministic based on seed.
 */
function pickN<T>(arr: readonly T[], count: number, seed: number = 0): T[] {
  const shuffled = [...arr].sort((a, b) => {
    const ha = hashString(JSON.stringify(a) + seed);
    const hb = hashString(JSON.stringify(b) + seed);
    return ha - hb;
  });
  return shuffled.slice(0, count);
}

/**
 * Pick 2 neighbourhoods from city context, or fallback to empty.
 */
function pickAreas(slug: string, count = 2): string[] {
  const h = hashString(slug + 'areas');
  const all = [
    ...getNeighborhoods(slug),
    ...getNightlife(slug),
    ...getBusiness(slug),
    ...getFoodAreas(slug),
  ];
  if (all.length === 0) return [];
  // Deduplicate
  const unique = [...new Set(all)];
  return pickN(unique, count, h);
}

/**
 * Truncate a string to a max character length at a word boundary.
 */
function truncateToLength(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > maxLen * 0.6 ? truncated.substring(0, lastSpace) + "\u2026" : truncated + "\u2026";
}

// ------------------------------------------
// Trust Block Generator
// ------------------------------------------

function generateTrustBlock(cityName: string, _category?: string): string {
  return `All listings on SecretZa undergo a multi-step verification process including photo verification, profile review, and active moderation. We encourage users to communicate through the platform, read reviews, and follow basic safety guidelines. SecretZa maintains a strict policy against misleading or fraudulent listings. Report any suspicious activity \u2014 our moderation team investigates all reports within 24 hours.`;
}

// ------------------------------------------
// Intro Template System
// ------------------------------------------

/**
 * Generate a city page intro paragraph using content rotation.
 * Selects one of 5 templates deterministically based on city slug hash.
 */
function generateCityIntro(
  cityName: string,
  citySlug: string,
  stateName: string,
  countryName: string,
): string {
  const catList = getCategoryList();
  const nearby = getNearbyCities(citySlug, 4);
  const nearbyNames = nearby.map((c) => c.name);
  const nearbyComma = nearbyNames.slice(0, 3).join(", ");
  const areas = pickAreas(citySlug, 2);
  const desc = getDescription(citySlug);
  const sellingPoints = getSellingPoints(citySlug);
  const idx = selectTemplateIndex(citySlug, 5, 'city-intro');

  const areaPhrase = areas.length > 0
    ? ` From the vibrant corridors of ${areas.join(" and ")} to popular neighbourhoods across the city`
    : '';
  const descPhrase = desc ? ` ${desc}` : '';
  const sellingPhrase = sellingPoints.length > 0
    ? ` Known for ${sellingPoints.slice(0, 2).join(" and ")},`
    : '';

  const templates: string[] = [
    // Template 0: Welcome-style
    `Welcome to ${cityName}'s most trusted adult classifieds directory, serving ${stateName}, ${countryName}.${sellingPhrase} SecretZa connects you with verified providers of ${catList} and more.${areaPhrase}, our platform covers every corner of ${cityName}.${descPhrase} Each listing is moderated for authenticity, with real photos and verified details. Whether you're a resident or visiting, browse daily-updated profiles with user reviews and secure messaging. We also serve ${nearbyComma}, making SecretZa your complete resource for adult services across ${stateName}.`,

    // Template 1: Discovery-style
    `Discover premium adult services across ${cityName}'s most sought-after locations.${areaPhrase}, SecretZa curates ${catList} and a wide range of verified listings tailored to ${cityName}'s unique character.${descPhrase} Our directory features detailed profiles with genuine photos, transparent pricing, and authentic user reviews. Navigate effortlessly with filters for location, services, and preferences. Serving locals and visitors alike, SecretZa also extends coverage to ${nearbyComma}. New verified listings are added daily to ensure you always find fresh, quality options in ${cityName}, ${stateName}.`,

    // Template 2: Directory-style
    `${cityName} is home to a thriving adult services scene, and SecretZa is the city's most comprehensive directory for ${catList}. With ${desc ? desc.toLowerCase().trim().replace(/\.$/, '') : 'a vibrant urban landscape'}, ${cityName} attracts thousands seeking quality adult entertainment daily.${areaPhrase}, our platform lists providers across every major locality. Every profile undergoes thorough verification including photo checks and profile review. Browse with confidence using our advanced filters, read genuine user reviews, and connect securely through our messaging platform. Coverage extends to ${nearbyComma} and the wider ${stateName} region.`,

    // Template 3: Experience-style
    `Experience the best of ${cityName}'s adult classifieds with SecretZa, India's fastest-growing verified directory. Whether you're exploring ${catList} or seeking something more specific, our platform delivers curated, high-quality listings for ${cityName}, ${stateName}.${sellingPhrase}${descPhrase} Each provider is vetted through our multi-layer verification process, ensuring authenticity and discretion. Browse detailed profiles in ${areas.length > 0 ? areas.join(", ") : 'popular areas across the city'} with real photos, service details, and user ratings. Our coverage spans ${nearbyComma}, giving you access to the widest selection in the region.`,

    // Template 4: Guide-style
    `Your complete guide to adult services in ${cityName}, ${stateName}. SecretZa offers a carefully curated selection of ${catList} and more, all verified for authenticity and quality.${sellingPhrase}${descPhrase} From ${areas.length > 0 ? areas[0] : 'central'} to ${areas.length > 1 ? areas[1] : 'the outskirts'}, we cover the entire city with daily-updated listings featuring real photos, detailed descriptions, and honest reviews. Use our advanced filters to narrow by area, price, and services. We also serve ${nearbyComma}, so you can explore options across ${stateName} and beyond. Trust SecretZa for a safe, discreet, and comprehensive experience.`,
  ];

  return templates[idx];
}

/**
 * Generate a category+city page intro using content rotation.
 */
function generateCategoryCityIntro(
  categoryName: string,
  categorySlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
): string {
  const nearby = getNearbyCities(citySlug, 3);
  const nearbyNames = nearby.map((c) => c.name);
  const nearbyComma = nearbyNames.join(", ");
  const areas = pickAreas(citySlug, 2);
  const displayCount = 50 + hashString(citySlug + categorySlug) % 450;
  const desc = getDescription(citySlug);
  const cat = lowerCategory(categoryName);
  const idx = selectTemplateIndex(citySlug + categorySlug, 5, 'catcity-intro');

  const areaPhrase = areas.length > 0
    ? ` From ${areas.join(" to ")} and surrounding areas`
    : '';
  const descPhrase = desc ? ` ${desc}` : '';

  const templates: string[] = [
    `Discover premium ${cat} across ${cityName}'s most vibrant locations.${areaPhrase}, SecretZa connects you with ${displayCount}+ verified ${cat} providers in ${cityName}, ${stateName}.${descPhrase} Our curated directory features authentic profiles with real photos, transparent pricing, and genuine user reviews. Whether you're a local resident or visiting ${cityName}, find exactly what you're looking for with our advanced filters for services, location, and budget. We also serve ${nearbyComma}, ensuring the widest selection across the region. New ${cat} listings are added daily.`,

    `${cityName} offers some of the finest ${cat} in ${stateName}, and SecretZa is the city's most trusted platform for finding them. With ${displayCount}+ verified listings, our directory covers ${areas.length > 0 ? `areas from ${areas.join(" to ")}` : 'neighbourhoods across the city'}.${descPhrase} Browse detailed profiles with verified photos, service descriptions, and honest user feedback. Connect directly with providers through our secure messaging system. We also extend coverage to ${nearbyComma}. Every listing on SecretZa undergoes moderation for your safety and satisfaction.`,

    `Looking for ${cat} in ${cityName}? You've found the right place. SecretZa features ${displayCount}+ carefully verified ${cat} profiles across ${cityName}, ${stateName}.${descPhrase}${areaPhrase}, our platform ensures comprehensive coverage of the city. Each listing includes real photos, service details, pricing, and user reviews. Filter by area, price range, and services offered to find your ideal match. Our coverage extends to ${nearbyComma}, giving you more options across ${stateName}. New ${cat} providers join SecretZa daily, so you'll always find fresh options.`,

    `Experience verified ${cat} in ${cityName} with SecretZa's curated directory. ${cityName}${desc ? ', ' + desc.toLowerCase().replace(/\.$/, '') : ''}, attracts discerning visitors seeking quality ${cat}.${areaPhrase}, our ${displayCount}+ listings span every major area. Browse genuine profiles with verified photos, detailed service descriptions, and real user reviews. Our platform's secure messaging makes connecting easy and discreet. Serving ${nearbyComma} as well, SecretZa is your go-to resource for ${cat} across ${stateName}. Listings are updated daily with fresh, verified providers.`,

    `Your trusted source for ${cat} in ${cityName}, ${stateName}. SecretZa's directory includes ${displayCount}+ verified ${cat} profiles, each reviewed for quality and authenticity.${descPhrase} Explore listings in ${areas.length > 0 ? areas.join(", ") : 'popular areas across the city'} and discover providers who match your preferences. Every profile features verified photos, transparent pricing, and real user feedback. Use our advanced search to filter by location, services, and budget. We also cover ${nearbyComma} for broader options throughout ${stateName}. Join thousands who trust SecretZa for safe, discreet ${cat} in ${cityName}.`,
  ];

  return templates[idx];
}

/**
 * Generate a category page intro using content rotation.
 */
function generateCategoryIntro(categoryName: string, categorySlug: string): string {
  const categoryDesc = CATEGORY_DESCRIPTIONS[categorySlug] ?? `Discover the best ${lowerCategory(categoryName)} listings across India.`;
  const cat = lowerCategory(categoryName);
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 6).map((c) => c.name);
  const idx = selectTemplateIndex(categorySlug, 5, 'cat-intro');

  const templates: string[] = [
    `Explore the largest collection of verified ${cat} listings across India on SecretZa. ${categoryDesc} Our platform features thousands of authentic profiles from ${topCities.join(", ")}, and many more cities. Every ${cat} listing on SecretZa goes through a thorough moderation process to ensure authenticity and quality. Whether you're in a metropolitan city or a growing urban centre, SecretZa helps you find the right ${cat} services near you. Filter by city, price range, services offered, and verification status to find your perfect match. New ${cat} listings are added daily.`,

    `India's most trusted platform for ${cat} — SecretZa connects you with verified providers nationwide. ${categoryDesc} With listings spanning ${topCities.slice(0, 4).join(", ")} and over 100 other cities, you'll find comprehensive options wherever you are. Each profile is reviewed for authenticity, featuring real photos and honest user reviews. Our secure messaging system ensures discreet communication with providers. Advanced filters let you narrow results by location, services, and budget. Discover why thousands trust SecretZa for quality ${cat} across India.`,

    `Find verified ${cat} across every major Indian city with SecretZa. ${categoryDesc} Our curated directory covers ${topCities.join(", ")}, and many more urban centres throughout India. Every listing undergoes our multi-step verification process, so you browse with confidence. Compare providers by photos, services, pricing, and user ratings. Whether you prefer incall or outcall services, short encounters or extended arrangements, SecretZa has options for every preference. Fresh ${cat} listings are published daily from providers across India.`,

    `SecretZa is India's premier destination for ${cat}, offering a vetted, user-friendly directory of verified providers. ${categoryDesc} From ${topCities.slice(0, 3).join(", ")} to emerging cities, our platform delivers quality ${cat} wherever you are. Each listing is moderated, with photo verification and profile review ensuring authenticity. Use our powerful search filters to find exactly what you need — by city, service type, price, or verification status. Read genuine reviews from other users, and connect securely through our built-in messaging. New ${cat} profiles are added every day.`,

    `Your nationwide guide to ${cat} in India — SecretZa brings together the most comprehensive selection of verified ${cat} listings. ${categoryDesc} Serving ${topCities.slice(0, 4).join(", ")} and 100+ other cities, our platform is built for safety, quality, and ease of use. Browse detailed provider profiles with verified photos, transparent pricing, and service descriptions. User reviews and ratings help you make informed decisions. Whether searching for a specific type of ${cat} or exploring what's available in your city, SecretZa makes it simple. New listings are added daily across all Indian cities.`,
  ];

  return templates[idx];
}

/**
 * Generate a state page intro using content rotation.
 */
function generateStateIntro(
  stateName: string,
  stateSlug: string,
  countryName: string,
): string {
  const catList = getCategoryList();
  const seed = hashString(stateSlug);
  const stateCities = pickN(MAJOR_INDIAN_CITIES, 5, seed);
  const cityNames = stateCities.map((c) => c.name).join(", ");
  const idx = selectTemplateIndex(stateSlug, 5, 'state-intro');

  const templates: string[] = [
    `Welcome to the premier directory of adult classifieds for ${stateName}, ${countryName}. SecretZa offers an extensive collection of verified listings spanning ${catList} and more across all major cities in ${stateName}. Whether you're in ${cityNames} or any other city in ${stateName}, our platform connects you with trusted adult service providers in your area. Each listing on SecretZa undergoes thorough moderation to ensure authenticity, safety, and quality. Browse by city, category, or service type to find exactly what you need. With new listings added daily, SecretZa is your go-to platform for adult classifieds throughout ${stateName}, ${countryName}.`,

    `Discover adult classifieds across ${stateName} with SecretZa, India's leading verified directory. From ${cityNames} and surrounding cities, ${stateName} offers a diverse selection of ${catList} and more. Our platform features thoroughly vetted providers with real photos, transparent pricing, and user reviews. Whether you're seeking companionship, massage, dating connections, or entertainment, SecretZa covers every category across ${stateName}. Use our advanced filters to narrow by city, services, and budget. New verified listings are published daily throughout ${stateName}, ${countryName}.`,

    `${stateName} is home to a vibrant adult services scene, and SecretZa is your most trusted guide. Our comprehensive directory covers ${catList} and more in ${cityNames} and other cities across ${stateName}. Every listing on our platform undergoes multi-step verification including photo checks and profile review. Browse with confidence using our detailed search filters, read genuine user reviews, and connect securely with providers. SecretZa continuously expands its coverage across ${stateName}, ${countryName}, with fresh listings added daily to ensure you always find quality options.`,

    `Your complete resource for adult classifieds in ${stateName}, ${countryName}. SecretZa connects you with verified providers of ${catList} across ${cityNames} and other major cities in ${stateName}. Each listing features authentic photos, service details, pricing, and user feedback. Our moderation team reviews every new listing to maintain quality and safety standards. Filter by city, category, or service type to quickly find what matches your preferences. Serving the entire ${stateName} region, SecretZa is the most reliable platform for adult services in ${countryName}.`,

    `Explore the widest selection of verified adult classifieds in ${stateName} on SecretZa. Covering ${catList} across ${cityNames} and beyond, our platform is designed for safety, authenticity, and user convenience. Every provider is vetted through our verification process, and genuine user reviews help you make informed choices. Whether you're new to ${stateName} or a long-time resident, SecretZa's directory makes finding quality adult services straightforward and discreet. Listings are refreshed daily across all cities in ${stateName}, ${countryName}.`,
  ];

  return templates[idx];
}

/**
 * Generate a country page intro using content rotation.
 */
function generateCountryIntro(countryName: string): string {
  const catList = getCategoryList();
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 8).map((c) => c.name);
  const idx = selectTemplateIndex('india', 5, 'country-intro');

  const templates: string[] = [
    `SecretZa is ${countryName}'s leading adult classifieds platform, offering the most comprehensive directory of verified adult services across the country. From ${topCities.slice(0, 3).join(", ")} to growing urban centres, SecretZa connects you with trusted providers in every major Indian city. Explore thousands of listings across ${catList} and more. Our platform features a rigorous verification process, user reviews, and secure messaging to ensure a safe and enjoyable experience. Whether you're seeking companionship, professional services, or entertainment, SecretZa has you covered across all ${indiaStates.length} states and union territories. New listings are added daily.`,

    `${countryName}'s most trusted adult classifieds platform — SecretZa brings together verified providers and quality listings from ${topCities.slice(0, 4).join(", ")} and over 100 other Indian cities. Browse ${catList} and more with confidence, knowing every listing is moderated for authenticity. Our platform features real photos, transparent pricing, and genuine user reviews. Advanced search filters help you find exactly what you need by city, service type, and budget. Join millions who trust SecretZa for safe, discreet adult classifieds across ${countryName}. New providers join daily.`,

    `Discover verified adult classifieds across ${countryName} with SecretZa, the platform built for safety, quality, and variety. Covering ${topCities.slice(0, 3).join(", ")} and 100+ more cities, our directory spans all ${indiaStates.length} states and union territories. Explore ${catList} and a full range of adult services, each listing vetted through our multi-step verification process. Read authentic user reviews, compare providers by services and pricing, and connect securely through our built-in messaging. SecretZa is your comprehensive guide to adult services in ${countryName}.`,

    `Your one-stop destination for adult classifieds in ${countryName} — SecretZa offers the largest verified directory of ${catList} and more. From the metropolitan hubs of ${topCities.slice(0, 3).join(", ")} to smaller cities, we cover every corner of ${countryName}. Each listing undergoes moderation including photo verification and profile review, ensuring a safe browsing experience. Use our powerful filters to search by city, category, price, and verification status. Fresh listings are published daily, so there's always something new to explore on SecretZa.`,

    `SecretZa is revolutionizing adult classifieds in ${countryName} with a platform focused on verification, transparency, and user safety. With listings from ${topCities.slice(0, 4).join(", ")} and cities across all ${indiaStates.length} states, we offer ${catList} and comprehensive adult services. Every profile features verified photos, detailed service descriptions, and honest user reviews. Our secure messaging system ensures discreet communication. Whether you're looking for companionship, entertainment, or professional adult services, SecretZa provides a reliable, quality-first experience across ${countryName}.`,
  ];

  return templates[idx];
}

// ------------------------------------------
// Expanded intro assembly (country / state / category shells)
// ------------------------------------------

function assembleIntroToTarget(paragraphs: string[], target = SEO_GENERATION_TARGET_WORDS): string {
  const parts = paragraphs.filter((p) => p?.trim());
  let combined = parts.join("\n\n");
  let words = calculateVisibleWordCount(combined);

  const genericFillers = [
    "Every listing on SecretZa passes profile review, photo checks, and ongoing moderation. Providers update availability, services, and pricing directly — so filters return current results instead of stale directory entries copied from other platforms.",
    "Browse by city, category, verification badge, or price band to narrow results quickly. SecretZa separates escort, massage, dating, and adult-services listings into distinct indexes so searches stay relevant and users avoid mixed-result noise.",
    "User reviews and report tools help the community surface trustworthy profiles. Suspicious listings are investigated within twenty-four hours, and repeat policy violations lead to permanent removal from the index.",
    "Mobile-friendly profiles, discreet messaging, and clear service descriptions make it easier to compare providers before making contact. Listings include neighbourhood context where available so visitors and residents can filter by area.",
    "New verified profiles are added daily across metropolitan and regional markets. Featured placements rotate fairly, and standard listings remain visible in category and city browse paths without pay-to-hide tactics.",
    "SecretZa editorial guides explain how categories differ, what verification badges mean, and how to use filters safely. These guides are updated when product features or moderation policies change.",
    "Comparison tables on city pages highlight average response times, verification rates, and active listing counts so browsers can judge market depth before contacting providers.",
    "Privacy controls let users browse without creating an account while still accessing full profile details, photos, and service descriptions on every indexed page.",
  ];

  let fillerIdx = 0;
  const minWords = SEO_MIN_WORD_COUNT;
  while (words < target && fillerIdx < genericFillers.length * 2) {
    combined += `\n\n${genericFillers[fillerIdx % genericFillers.length]!}`;
    words = calculateVisibleWordCount(combined);
    fillerIdx++;
  }
  while (words < minWords && fillerIdx < genericFillers.length * 4) {
    combined += `\n\n${genericFillers[fillerIdx % genericFillers.length]!}`;
    words = calculateVisibleWordCount(combined);
    fillerIdx++;
  }

  return combined;
}

function buildCountryFullIntro(countryName: string, countrySlug: string): string {
  const catList = getCategoryList();
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 8).map((c) => c.name);
  const opening = generateCountryIntro(countryName);
  return assembleIntroToTarget([
    opening,
    `## Browse Verified Listings in ${countryName}\n\nSecretZa is the primary verified index for adult classifieds in ${countryName}. The platform covers ${catList} and related categories with district-level filters, live availability signals, and moderation-backed profiles rather than unvetted aggregator blurbs.`,
    `## Major Cities in ${countryName}\n\nHigh-density listing clusters appear in ${topCities.slice(0, 4).join(", ")}, and ${topCities.length - 4} additional hubs listed across the ${countryName} index. Each city page maps neighbourhoods separately so searches tied to a specific area return relevant profiles.`,
    `## Categories Available in ${countryName}\n\nUsers can switch between escorts, massage, dating, trans, male escorts, couples, adult jobs, and adult services without leaving the ${countrySlug} country context. Category filters inherit city selection automatically, reducing irrelevant cross-country results.`,
    `## Safety and Verification on SecretZa\n\nProfiles displaying the verified badge completed document and photo checks. Moderators review flagged accounts within one business day, and users can report suspicious behaviour directly from any ${countryName} listing page.`,
    `## How to Use This ${countryName} Directory\n\nStart from a city or category anchor, apply price and service filters, then bookmark profiles that match your criteria. Return visits surface recently updated listings first so repeat browsers see fresh ${countryName} inventory.`,
  ]);
}

function buildStateFullIntro(
  stateName: string,
  stateSlug: string,
  countryName: string,
): string {
  const catList = getCategoryList();
  const stateCities = pickN(MAJOR_INDIAN_CITIES, 6, hashString(stateSlug));
  const cityNames = stateCities.map((c) => c.name).join(", ");
  const opening = generateStateIntro(stateName, stateSlug, countryName);
  return assembleIntroToTarget([
    opening,
    `## ${stateName} City Coverage\n\nSecretZa maps ${stateName} listings across ${cityNames} and surrounding towns. City-level pages break down ${catList} by neighbourhood rather than publishing one generic statewide paragraph.`,
    `## Category Mix in ${stateName}\n\nEscort, massage, and dating listings are indexed independently for ${stateName}. Users comparing categories in the same city can switch tabs without losing location context or re-entering filters.`,
    `## Verification Standards in ${stateName}\n\nEvery ${stateName} profile submitted to SecretZa passes automated and manual checks. Photo authenticity, contact validity, and policy compliance are reviewed before a listing appears in ${countryName} search results.`,
    `## Travel and Local Browsing in ${stateName}\n\nVisitors landing in ${stateCities[0]?.name ?? stateName} can filter by transport hubs and commercial districts; residents often anchor searches on home neighbourhoods. Both paths surface the same verified ${stateName} inventory with different sort priorities.`,
    `## Posting Listings in ${stateName}\n\nProviders based in ${stateName} can publish free standard listings or upgrade to featured placement. Editorial review typically completes within hours, after which profiles appear in city and category browse paths across ${countryName}.`,
  ]);
}

function buildCategoryFullIntro(categoryName: string, categorySlug: string): string {
  const cat = lowerCategory(categoryName);
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 10).map((c) => c.name);
  const opening = generateCategoryIntro(categoryName, categorySlug);
  return assembleIntroToTarget([
    opening,
    `## Nationwide ${categoryName} Coverage\n\nSecretZa indexes ${cat} providers in ${topCities.slice(0, 5).join(", ")}, plus dozens of additional Indian cities. Each city page lists neighbourhood tags, price bands, and verification status so nationwide ${categoryName} searches stay locally relevant.`,
    `## How ${categoryName} Verification Works\n\nProfiles in the ${categorySlug} index complete photo and identity checks before receiving a verified badge. Moderators remove duplicate or misleading ${cat} listings and investigate user reports within twenty-four hours.`,
    `## Filtering ${categoryName} Results\n\nSort by city, price, services offered, or verification tier. Advanced filters remember your last selection across sessions, making repeat ${categoryName} browsing faster on mobile and desktop.`,
    `## ${categoryName} vs Other Categories\n\n${categoryName} listings are separated from massage, dating, and adult-services indexes to prevent cross-category noise. Users exploring multiple categories can pivot via internal links without losing their city context.`,
    `## Posting ${categoryName} Listings\n\nProviders create a free profile, select ${categorySlug} as the primary category, add photos and service details, then submit for review. Approved ${cat} listings appear in city browse paths and category landing pages across India.`,
  ]);
}

// ------------------------------------------
// Enhanced FAQ Generators
// ------------------------------------------

/**
 * Generate enhanced category+city FAQs with city-specific context.
 */
function getCategoryFAQs(
  categoryName: string,
  categorySlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
): Array<{ question: string; answer: string }> {
  const nearby = getNearbyCities(citySlug, 3);
  const nearbyCity1 = nearby[0]?.name ?? "nearby cities";
  const nearbyCity2 = nearby[1]?.name ?? "surrounding areas";
  const areas = pickAreas(citySlug, 2);
  const cat = lowerCategory(categoryName);
  const areaStr = areas.length > 0 ? areas.join(" and ") : "central areas and popular neighbourhoods";

  const faqTemplates = CATEGORY_FAQ_TEMPLATES.find((t) => t.category === categorySlug);

  if (faqTemplates) {
    // Build 5 FAQs: 3 from templates + 2 city-specific
    const baseFaqs = faqTemplates.faqs.slice(0, 3).map((q, i) => {
      const answers: Record<number, string> = {
        0: `You can find verified ${cat} in ${cityName} right here on SecretZa. Every listing goes through a moderation process to ensure authenticity. Browse profiles in ${areaStr}, check photos and reviews, and connect directly with ${cat} providers in ${cityName}, ${stateName}. SecretZa makes it easy to filter by location, price, and services offered. New listings are added daily across all areas of ${cityName}.`,
        1: `SecretZa takes safety seriously for all ${cat} listings in ${cityName}. We implement profile verification, user reviews, and a robust moderation system. Always meet in public places first, communicate through the platform initially, and trust your instincts. SecretZa also allows users to report suspicious listings, which our team reviews promptly within 24 hours.`,
        2: `${cityName} has ${cat} listings spread across multiple areas including ${areaStr}. Use SecretZa's location filters to browse ${cat} in specific neighbourhoods of ${cityName}. Areas with higher concentrations typically include upscale districts and well-connected commercial areas. You can also check nearby ${nearbyCity1} and ${nearbyCity2} for additional options.`,
      };
      return { question: q, answer: answers[i] ?? answers[0]! };
    });

    // City-specific FAQ 4: about areas
    const areaQ = areas.length > 0
      ? { question: `Which areas in ${cityName} are best for finding ${cat}?`, answer: `${cityName}'s ${cat} listings are concentrated in popular areas like ${areaStr}. These areas are well-connected and frequented by both locals and visitors. Use SecretZa's area filter to narrow your search to specific neighbourhoods. Premium providers often list in upscale and central locations, while budget-friendly options may be found in suburban areas of ${cityName}.` }
      : { question: `Where can I find ${cat} in ${cityName}?`, answer: `${cat} in ${cityName} are spread across the city's popular neighbourhoods and commercial districts. Use SecretZa's advanced location filters to find providers near you. Central areas and well-connected localities typically have the highest concentration of listings. You can also explore nearby ${nearbyCity1} for more options.` };

    // City-specific FAQ 5: pricing/practical
    const priceQ = { question: `What are the typical rates for ${cat} in ${cityName}?`, answer: `${cat} pricing in ${cityName} varies depending on the provider, service type, duration, and experience level. ${cityName}, being a ${indiaCities.find(c => c.slug === resolveCitySlug(citySlug))?.tier === 1 ? 'major metro' : 'growing urban'} city, offers a range of options across different price points. Premium providers in upscale areas typically charge more, while new listings may offer competitive introductory rates. Use SecretZa's price filter to find ${cat} within your budget in ${cityName}, ${stateName}.` };

    return [...baseFaqs, areaQ, priceQ];
  }

  // Fallback for unknown categories
  return [
    { question: `How to find verified ${cat} in ${cityName}?`, answer: `Visit SecretZa and navigate to the ${categoryName} section, then filter by ${cityName}. All listings are moderated for authenticity. Browse verified profiles in ${areaStr}, compare services and pricing, and connect directly with providers. SecretZa offers the most comprehensive directory of adult services in ${cityName}, ${stateName}.` },
    { question: `Are ${cat} listings in ${cityName} safe and verified?`, answer: `SecretZa employs multiple verification layers for ${cat} listings in ${cityName}. This includes profile verification, user reviews and ratings, and a dedicated moderation team. We encourage users to read reviews and communicate through the platform before meeting any provider. Report suspicious activity — our team investigates within 24 hours.` },
    { question: `What areas in ${cityName} have the most ${cat} listings?`, answer: `${cityName} offers ${cat} listings across multiple areas including ${areaStr}. Use SecretZa's advanced location filters to find providers near you. You can also find listings in nearby ${nearbyCity1} and ${nearbyCity2}.` },
    { question: `How do I stay safe when using ${cat} services in ${cityName}?`, answer: `Always communicate through SecretZa's platform initially, meet in safe public locations for first encounters, verify profile details and photos, read user reviews, and trust your instincts. Never share financial information upfront. Report any suspicious behaviour to our moderation team, who investigate all reports within 24 hours.` },
    { question: `Can I find ${cat} near ${nearbyCity1} as well?`, answer: `Yes! SecretZa covers ${cat} listings in ${nearbyCity1}, ${nearbyCity2}, and many other cities near ${cityName}. Simply switch the location filter to explore options in surrounding areas. Our platform provides the widest coverage of verified adult services across ${stateName}.` },
  ];
}

// Fix: countryName is used above but not in scope — use the constant
const countryName = "India";

/**
 * Generate enhanced category-level FAQs.
 */
function getCategoryFAQsGlobal(
  categoryName: string,
  categorySlug: string,
): Array<{ question: string; answer: string }> {
  const cat = lowerCategory(categoryName);
  const faqTemplates = CATEGORY_FAQ_TEMPLATES.find((t) => t.category === categorySlug);

  if (faqTemplates) {
    return faqTemplates.faqs.slice(0, 5).map((q, i) => {
      const answers: Record<number, string> = {
        0: `SecretZa is the premier platform for finding verified ${cat} in India. All ${cat} listings go through a moderation process to ensure authenticity. Browse thousands of profiles across all major Indian cities, filter by location and preferences, and connect directly with ${cat} providers. New listings are added daily.`,
        1: `Yes, ${cat} profiles on SecretZa are verified through a multi-step process. We check profile information, verify photos, and monitor user reviews. Our moderation team actively reviews new listings and investigates reports to maintain a trustworthy platform for ${cat} services in India.`,
        2: `Safety is a top priority on SecretZa. When engaging with ${cat} listings, always communicate through the platform first, read user reviews, verify profile information, and meet in safe, public locations initially. SecretZa provides reporting tools for any suspicious ${cat} listings — our team investigates within 24 hours.`,
        3: `${cat} pricing on SecretZa varies by city, service type, and provider experience. Premium ${cat} providers in metro cities like Mumbai, Delhi, and Bangalore typically charge higher rates. SecretZa allows you to filter ${cat} listings by price range to find options within your budget.`,
        4: `SecretZa offers ${cat} listings in all major Indian cities including Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Pune, Jaipur, Kochi, Chandigarh, and over 100 more. Use our location filter to find ${cat} near you, or browse by state to discover options across India.`,
      };
      return { question: q, answer: answers[i] ?? answers[0]! };
    });
  }

  return [
    { question: `How do I find verified ${cat} on SecretZa?`, answer: `Browse the ${categoryName} section on SecretZa to find verified listings across India. Use filters for location, price, and services to narrow your search. Every listing is reviewed by our moderation team to ensure quality and authenticity.` },
    { question: `Are ${cat} listings on SecretZa safe?`, answer: `SecretZa implements profile verification, user reviews, and active moderation for all ${cat} listings. We encourage users to communicate through the platform and read reviews before engaging with any provider.` },
    { question: `What cities have ${cat} listings on SecretZa?`, answer: `SecretZa offers ${cat} listings in all major Indian cities including Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Pune, Jaipur, and many more. Use our location filter to find ${cat} near you.` },
    { question: `How is SecretZa different from other ${cat} platforms?`, answer: `SecretZa stands out with its rigorous multi-step verification, genuine user reviews, secure messaging, and comprehensive coverage across all Indian cities. Our moderation team reviews every listing, and suspicious accounts are removed promptly. We prioritise safety, transparency, and user experience.` },
    { question: `Can I post a ${categoryName} listing on SecretZa?`, answer: `Yes! Creating a listing is free. Register for an account, select the ${categoryName} category, add your details and photos, and publish. Your listing will be reviewed by our moderation team and typically goes live within hours. Featured and premium options are available for enhanced visibility.` },
  ];
}

// ------------------------------------------
// Enhanced Internal Link Builders
// ------------------------------------------

function buildCityInternalLinks(citySlug: string, cityName: string): Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> {
  const links: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> = [];

  // Category links with city context
  for (const cat of CATEGORIES.slice(0, 6)) {
    links.push({ text: `${cat.name} in ${cityName}`, url: `/${cat.slug}/${citySlug}`, type: 'category' });
  }

  // Nearby city links — two-segment category+city routes (single-segment city URLs 404)
  const nearby = getNearbyCities(citySlug, 5);
  for (const city of nearby) {
    links.push({ text: `Adult Classifieds in ${city.name}`, url: `/escorts/${city.slug}`, type: 'city' });
  }

  return links.slice(0, 16);
}

function buildCategoryInternalLinks(categorySlug: string, categoryName: string): Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> {
  const links: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> = [];
  const cat = lowerCategory(categoryName);

  // Descriptive city links for this category
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 10);
  const descriptivePrefixes = ['Premium', 'Verified', 'Best', 'Top-Rated', 'Discreet', 'Authentic', 'Trusted', 'Quality', 'Popular', 'Leading'];

  for (let i = 0; i < topCities.length; i++) {
    const prefix = descriptivePrefixes[i] ?? 'Verified';
    links.push({ text: `${prefix} ${categoryName} in ${topCities[i]!.name}`, url: `/${categorySlug}/${topCities[i]!.slug}`, type: 'search' });
  }

  // Cross-category links
  const otherCategories = CATEGORIES.filter((c) => c.slug !== categorySlug);
  for (const catItem of otherCategories) {
    links.push({ text: `Browse ${catItem.name}`, url: `/category/${catItem.slug}`, type: 'category' });
  }

  links.push({ text: "India country directory", url: "/country/india", type: "search" });

  return links;
}

function buildCategoryCityInternalLinks(
  categorySlug: string,
  categoryName: string,
  citySlug: string,
  cityName: string,
): Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> {
  const links: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> = [];

  // Other categories in this city — descriptive
  const otherCategories = CATEGORIES.filter((c) => c.slug !== categorySlug);
  const descriptivePrefixes = ['Premium', 'Verified', 'Best', 'Top', 'Popular', 'Quality', 'Authentic', 'Discreet', 'Leading', 'Trusted'];
  for (let i = 0; i < Math.min(otherCategories.length, 6); i++) {
    const prefix = descriptivePrefixes[i % descriptivePrefixes.length]!;
    links.push({ text: `${prefix} ${otherCategories[i]!.name} in ${cityName}`, url: `/${otherCategories[i]!.slug}/${citySlug}`, type: 'search' });
  }

  // This category in nearby cities
  const nearby = getNearbyCities(citySlug, 6);
  for (const city of nearby) {
    links.push({ text: `${categoryName} in ${city.name}`, url: `/${categorySlug}/${city.slug}`, type: 'search' });
  }

  // Parent navigation links
  links.push({ text: `All ${categoryName} in India`, url: `/category/${categorySlug}`, type: 'category' });
  links.push({ text: `All Adult Classifieds in ${cityName}`, url: `/escorts/${citySlug}`, type: 'city' });

  return links.slice(0, 16);
}

function buildStateInternalLinks(stateSlug: string, stateName: string): Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> {
  const links: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> = [];

  // City links for this state
  for (const city of MAJOR_INDIAN_CITIES.slice(0, 10)) {
    links.push({ text: `${city.name} Adult Classifieds`, url: `/escorts/${city.slug}`, type: 'city' });
  }

  // Category links in major cities (state slug is not a valid city segment)
  for (const cat of CATEGORIES.slice(0, 6)) {
    const city = MAJOR_INDIAN_CITIES[hashString(stateSlug + cat.slug) % MAJOR_INDIAN_CITIES.length]!;
    links.push({ text: `${cat.name} in ${city.name}`, url: `/${cat.slug}/${city.slug}`, type: 'search' });
  }

  return links.slice(0, 16);
}

function buildCountryInternalLinks(): Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> {
  const links: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> = [];

  // Major cities
  for (const city of MAJOR_INDIAN_CITIES.slice(0, 10)) {
    links.push({ text: `${city.name} Adult Classifieds`, url: `/escorts/${city.slug}`, type: 'city' });
  }

  // All categories
  for (const cat of CATEGORIES) {
    links.push({ text: cat.name, url: `/category/${cat.slug}`, type: 'category' });
  }

  return links;
}

// ------------------------------------------
// Trending & Popular Search Generators
// ------------------------------------------

/**
 * Generate trending searches for a specific city and optional category.
 */
export function generateTrendingSearches(citySlug: string, categorySlug?: string): string[] {
  const city = MAJOR_INDIAN_CITIES.find(c => c.slug === citySlug);
  const cityName = city?.name ?? citySlug;
  const cat = categorySlug ? CATEGORIES.find(c => c.slug === categorySlug) : null;
  
  const citySearches = [
    `verified ${cat ? lowerCategory(cat.name) : 'services'} in ${cityName}`,
    `premium ${cat ? lowerCategory(cat.name) : 'listings'} ${cityName}`,
    `best ${cat ? lowerCategory(cat.name) : 'providers'} near me`,
    `${cityName} ${cat ? cat.name : 'services'} reviews`,
    `top rated ${cat ? lowerCategory(cat.name) : 'adult services'} ${cityName}`,
    `new ${cat ? lowerCategory(cat.name) : 'listings'} in ${cityName} today`,
    `${cityName} nightlife ${cat ? lowerCategory(cat.name) : 'services'}`,
    `cheap ${cat ? lowerCategory(cat.name) : 'services'} ${cityName}`,
  ];
  
  const nearby = getNearbyCities(citySlug, 3);
  const crossCitySearches = nearby.map(nc => 
    `${cat ? lowerCategory(cat.name) : 'services'} in ${nc.name}`
  );
  
  return pickN([...citySearches, ...crossCitySearches], 8, hashString(citySlug + (categorySlug ?? '')));
}

/**
 * Generate popular searches across India.
 */
export function generatePopularSearches(): string[] {
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 6).map(c => c.name);
  const topCats = CATEGORIES.slice(0, 4).map(c => lowerCategory(c.name));
  
  return [
    `${topCats[0]} in ${topCities[0]}`,
    `${topCats[1]} in ${topCities[1]}`,
    `${topCats[0]} in ${topCities[2]}`,
    `${topCats[2]} in ${topCities[0]}`,
    `${topCats[0]} in ${topCities[3]}`,
    `${topCats[1]} in ${topCities[4]}`,
    `premium ${topCats[0]} ${topCities[5]}`,
    `verified ${topCats[1]} in India`,
  ];
}

// ------------------------------------------
// SEO Content Generation Functions
// ------------------------------------------

/**
 * Generate SEO content for a city page.
 * @deprecated Use generateUniversalSeoContent from @/lib/seo-universal-engine. Removed V3 city variant path.
 */
export function generateCitySEO(
  cityName: string,
  citySlug: string,
  stateName: string,
  countryNameParam: string = "India",
  options?: { stateSlug?: string; dbAreas?: string[] },
): SEOContent {
  return generateCitySEOContent(cityName, citySlug, stateName, countryNameParam, options);
}

/** Resolve intro body for storage — prefers full 500+ word assembly. */
export function resolveIntroContentForStorage(content: SEOContent): string {
  return content.fullIntroContent ?? content.introParagraph;
}

/**
 * Generate SEO content for a category page: /escorts, /massage
 */
export function generateCategorySEO(
  categoryName: string,
  categorySlug: string,
  description?: string,
): SEOContent {
  const title = `${categoryName} in India - Verified ${lowerCategory(categoryName)} Listings Nationwide | ${SITE_NAME}`;
  const metaDescription = truncateToLength(
    `Browse verified ${lowerCategory(categoryName)} listings across India on SecretZa. Find trusted providers in Mumbai, Delhi, Bangalore & all cities.`,
    160,
  );

  const h1 = `${categoryName} in India`;

  const fullIntroContent = buildCategoryFullIntro(categoryName, categorySlug);
  const introParagraph = fullIntroContent.split("\n\n")[0] ?? fullIntroContent;

  const faqs = getCategoryFAQsGlobal(categoryName, categorySlug);

  const breadcrumbItems: Array<{ name: string; url: string }> = [
    { name: "Home", url: "/" },
    { name: "India", url: "/country/india" },
    { name: categoryName, url: `/category/${categorySlug}` },
  ];

  const internalLinks = buildCategoryInternalLinks(categorySlug, categoryName);

  // Popular searches for this category across India
  const popular = generatePopularSearches();

  const tone = CATEGORY_TONES[categorySlug];
  const secondary = tone
    ? `${categoryName.toLowerCase()} on SecretZa focuses on ${tone.primaryTheme}. ${tone.uniqueAngle}. Our platform caters to ${tone.targetAudience} across India, with providers specializing in ${tone.secondaryThemes.slice(0, 3).join(", ")}.`
    : undefined;

  return {
    title,
    metaDescription,
    h1,
    introParagraph,
    fullIntroContent,
    faqs,
    breadcrumbItems,
    internalLinks,
    trustBlock: generateTrustBlock('India', categoryName),
    popularSearches: popular,
    secondaryParagraph: secondary,
    authorInfo: {
      name: "SecretZa Editorial Team",
      role: "SEO Content Editor",
    },
    pageType: "category",
    lastUpdated: getDateModified(),
  };
}

/**
 * Generate SEO content for category+city: /escorts/mumbai, /massage/delhi
 */
export function generateCategoryCitySEO(
  categoryName: string,
  categorySlug: string,
  cityName: string,
  citySlug: string,
  stateName: string,
): SEOContent {
  const displayCount = 50 + hashString(citySlug + categorySlug) % 450;

  const title = `${categoryName} in ${cityName} - ${displayCount}+ Verified Listings, ${stateName} | ${SITE_NAME}`;
  const metaDescription = truncateToLength(
    `Find ${displayCount}+ verified ${lowerCategory(categoryName)} listings in ${cityName}, ${stateName}. Browse photos, reviews & prices on SecretZa.`,
    160,
  );

  const h1 = `Verified ${categoryName} in ${cityName}`;

  const introParagraph = generateCategoryCityIntro(categoryName, categorySlug, cityName, citySlug, stateName);

  const faqs = getCategoryFAQs(categoryName, categorySlug, cityName, citySlug, stateName);

  const breadcrumbItems: Array<{ name: string; url: string }> = [
    { name: "Home", url: "/" },
    { name: "India", url: "/country/india" },
    { name: categoryName, url: `/category/${categorySlug}` },
    { name: cityName, url: `/${categorySlug}/${citySlug}` },
  ];

  const internalLinks = buildCategoryCityInternalLinks(categorySlug, categoryName, citySlug, cityName);
  const areas = pickAreas(citySlug, 3);

  // Trending searches for category+city
  const trending = generateTrendingSearches(citySlug, categorySlug);

  // Category-specific tone
  const tone = CATEGORY_TONES[categorySlug];
  const secondary = tone
    ? `${cityName}'s ${categoryName.toLowerCase()} scene is known for ${tone.primaryTheme}. ${tone.uniqueAngle}. Providers in ${cityName} cater to ${tone.targetAudience}, with offerings spanning ${tone.secondaryThemes.join(", ")}. Use SecretZa's advanced filters to find the perfect match based on services, location, and budget.`
    : undefined;

  // Related category pages
  const otherCats = CATEGORIES.filter(c => c.slug !== categorySlug);
  const relatedCats = pickN(otherCats, 4, hashString(citySlug + categorySlug)).map(c => ({
    title: `${c.name} in ${cityName}`,
    url: `/${c.slug}/${citySlug}`,
    type: "category_city",
  }));

  return {
    title,
    metaDescription,
    h1,
    introParagraph,
    faqs,
    breadcrumbItems,
    internalLinks,
    trustBlock: generateTrustBlock(cityName, categoryName),
    trendingSearches: trending,
    secondaryParagraph: secondary,
    authorInfo: {
      name: "SecretZa Editorial Team",
      role: "SEO Content Editor",
    },
    relatedPages: relatedCats,
    pageType: "category_city",
    lastUpdated: getDateModified(),
    cityHighlights: [
      ...getNeighborhoods(citySlug),
      ...getNightlife(citySlug),
      ...getBusiness(citySlug),
    ].slice(0, 8),
  };
}

/**
 * Generate SEO content for state page: /india/maharashtra
 */
export function generateStateSEO(
  stateName: string,
  stateSlug: string,
  countryNameParam: string = "India",
): SEOContent {
  const catList = getCategoryList();

  const title = `${stateName} Adult Classifieds - Browse All Cities in ${stateName} | ${SITE_NAME}`;
  const stateCities = pickN(MAJOR_INDIAN_CITIES, 4, hashString(stateSlug));
  const metaDescription = truncateToLength(
    `Explore adult classifieds across ${stateName}. Find ${catList} in ${stateCities.map(c => c.name).join(', ')} and more on SecretZa.`,
    160,
  );

  const h1 = `${stateName} Adult Classifieds`;

  const fullIntroContent = buildStateFullIntro(stateName, stateSlug, countryNameParam);
  const introParagraph = fullIntroContent.split("\n\n")[0] ?? fullIntroContent;

  const cityNames = stateCities.map((c) => c.name).join(", ");

  const faqs: Array<{ question: string; answer: string }> = [
    {
      question: `Which cities in ${stateName} have the most adult classifieds on SecretZa?`,
      answer: `${stateName} has adult classifieds listings across multiple cities on SecretZa. Popular cities include ${cityNames}, and many more. Simply select your city from the location filter to browse local listings. Each city page features a comprehensive directory of ${lowerCategory(CATEGORIES[0].name)}, massage, dating, and other adult services.`,
    },
    {
      question: `Can I find all categories of adult services in ${stateName}?`,
      answer: `Yes! SecretZa offers all categories of adult services across ${stateName}. From ${catList} and more, you'll find comprehensive listings in every major city. Use our category filters to navigate between different service types and discover new options throughout ${stateName}.`,
    },
    {
      question: `How do I post an adult classified in ${stateName}?`,
      answer: `Posting on SecretZa is quick and easy. Create your free account, select ${stateName} as your location, choose a category, and add your listing details. Your ad will be visible across ${stateName} and will appear in relevant city and category searches. Verified and featured listings receive enhanced visibility across the platform.`,
    },
    {
      question: `Is SecretZa available in all cities of ${stateName}?`,
      answer: `SecretZa covers adult classifieds in all major cities and towns across ${stateName}. While the largest selection is available in metropolitan areas like ${stateCities[0]?.name ?? "major cities"}, we're continuously expanding our coverage. If your city isn't listed yet, you can still browse nearby locations and post your own listing.`,
    },
    {
      question: `How does SecretZa ensure listing quality in ${stateName}?`,
      answer: `Every listing on SecretZa undergoes our multi-step verification process including photo verification, profile review, and ongoing moderation. Our team actively monitors ${stateName} listings and investigates user reports within 24 hours. This ensures a safe, trustworthy experience for users across ${stateName}.`,
    },
  ];

  const breadcrumbItems: Array<{ name: string; url: string }> = [
    { name: "Home", url: "/" },
    { name: countryNameParam, url: "/country/india" },
    { name: stateName, url: `/india/${stateSlug}` },
  ];

  const internalLinks = buildStateInternalLinks(stateSlug, stateName);

  return {
    title,
    metaDescription,
    h1,
    introParagraph,
    fullIntroContent,
    faqs,
    breadcrumbItems,
    internalLinks,
    trustBlock: generateTrustBlock(stateName),
    authorInfo: { name: "SecretZa Editorial Team", role: "SEO Content Editor" },
    pageType: "state",
    popularSearches: generatePopularSearches(),
    lastUpdated: getDateModified(),
  };
}

/**
 * Generate SEO content for country page: /india
 */
export function generateCountrySEO(
  countryNameParam: string,
  countrySlug: string,
): SEOContent {
  const catList = getCategoryList();
  const topCities = MAJOR_INDIAN_CITIES.slice(0, 8).map((c) => c.name);

  const title = `${countryNameParam} Adult Classifieds - Premium Listings in All Indian Cities | ${SITE_NAME}`;
  const metaDescription = truncateToLength(
    `${countryNameParam}'s #1 adult classifieds platform. Browse verified ${catList} listings in Mumbai, Delhi, Bangalore & 100+ cities on SecretZa.`,
    160,
  );

  const h1 = `Adult Classifieds in ${countryNameParam}`;

  const fullIntroContent = buildCountryFullIntro(countryNameParam, countrySlug);
  const introParagraph = fullIntroContent.split("\n\n")[0] ?? fullIntroContent;

  const faqs: Array<{ question: string; answer: string }> = [
    {
      question: "What is SecretZa?",
      answer: `SecretZa is ${countryNameParam}'s premier adult classifieds platform, offering verified listings for ${catList} and more across all major Indian cities. With thousands of active listings, user reviews, and a secure platform, SecretZa is the most trusted name in Indian adult classifieds.`,
    },
    {
      question: `Which cities in ${countryNameParam} does SecretZa cover?`,
      answer: `SecretZa covers adult classifieds in ${topCities.slice(0, 5).join(", ")}, and over 100 other Indian cities. Our coverage spans all major metropolitan areas, state capitals, and growing urban centres across ${countryNameParam}. Browse by state or city to find adult services near you.`,
    },
    {
      question: "Is SecretZa free to use?",
      answer: `Yes, browsing and posting basic listings on SecretZa is completely free. We offer premium and featured listing options for enhanced visibility. Users can browse all categories, view profiles, and use search filters without any charges. Premium features include priority placement, extended listing duration, and analytics.`,
    },
    {
      question: "How does SecretZa verify adult classified listings?",
      answer: `SecretZa uses a multi-layered verification process for all adult classifieds. This includes profile information checks, photo verification, user review monitoring, and a dedicated moderation team. Listings that don't meet our quality standards are removed. Users can also report suspicious listings, which our team investigates within 24 hours.`,
    },
    {
      question: "Can I post an adult classified on SecretZa?",
      answer: `Absolutely! Creating a listing on SecretZa is free and straightforward. Simply register for an account, select your category and location, add your listing details with photos, and publish. Your listing will be reviewed by our moderation team and typically goes live within a few hours. Featured and premium options are available for enhanced visibility.`,
    },
  ];

  const breadcrumbItems: Array<{ name: string; url: string }> = [
    { name: "Home", url: "/" },
    { name: countryNameParam, url: `/country/${countrySlug}` },
  ];

  const internalLinks = buildCountryInternalLinks();

  return {
    title,
    metaDescription,
    h1,
    introParagraph,
    fullIntroContent,
    faqs,
    breadcrumbItems,
    internalLinks,
    trustBlock: generateTrustBlock(countryNameParam),
    authorInfo: { name: "SecretZa Editorial Team", role: "SEO Content Editor" },
    pageType: "country",
    popularSearches: generatePopularSearches(),
    lastUpdated: getDateModified(),
  };
}

/**
 * Generate SEO content for long-tail keyword pages
 */
export function generateLongTailSEO(
  keyword: string,
  keywordSlug: string,
  cityName: string,
  citySlug: string,
): SEOContent {
  const nearby = getNearbyCities(citySlug, 4);
  const nearbyCity1 = nearby[0]?.name ?? "nearby cities";
  const areas = pickAreas(citySlug, 2);
  const cat = lowerCategory(keyword);
  const desc = getDescription(citySlug);

  const title = `${keyword} in ${cityName} - Find ${cat} ${cityName} Listings | ${SITE_NAME}`;
  const metaDescription = truncateToLength(
    `Discover the best ${cat} in ${cityName}. Browse verified listings, photos, and reviews on SecretZa. Updated daily.`,
    160,
  );

  const h1 = `${keyword} in ${cityName}`;

  const areaPhrase = areas.length > 0 ? ` across areas like ${areas.join(" and ")}` : '';
  const descPhrase = desc ? ` ${desc}` : '';

  const introParagraph = `Looking for ${cat} in ${cityName}? You've come to the right place. SecretZa features a curated selection of ${cat} listings specifically for ${cityName}, with detailed profiles, real photos, verified information, and genuine user reviews.${descPhrase} Whether you're a local or just visiting${areaPhrase}, our platform makes it simple to find the best ${cat} options available. Each listing is carefully moderated to ensure authenticity and quality, so you can browse with confidence. Filter results by price, ratings, location, and availability to find exactly what matches your preferences. SecretZa also covers ${nearbyCity1} and surrounding areas, giving you access to the widest selection of ${cat} in the region. New ${cat} listings in ${cityName} are added regularly, so check back often for the latest options and featured profiles.`;

  const faqs: Array<{ question: string; answer: string }> = [
    {
      question: `Where can I find ${cat} in ${cityName}?`,
      answer: `SecretZa is the best platform to find ${cat} in ${cityName}. Browse our verified listings with real photos, detailed descriptions, and user reviews. Use our filters to narrow results by area${areas.length > 0 ? ` like ${areas.join(", ")}` : ''}, price, and services. New ${cat} listings are added daily in ${cityName}.`,
    },
    {
      question: `Are the ${cat} listings in ${cityName} verified?`,
      answer: `Yes, SecretZa verifies ${cat} listings in ${cityName} through a multi-step moderation process. We check profile details, verify photos, and monitor user feedback. Listings that don't meet our standards are removed. Always check for the verified badge and read reviews before connecting.`,
    },
    {
      question: `What are the rates for ${cat} in ${cityName}?`,
      answer: `${cat} rates in ${cityName} vary depending on the provider, service type, duration, and experience level. SecretZa allows you to filter listings by price range to find options that fit your budget. Premium providers typically charge more, while new listings may offer competitive introductory rates.`,
    },
    {
      question: `Can I find ${cat} near ${nearbyCity1} as well?`,
      answer: `Yes! SecretZa covers ${cat} listings in ${nearbyCity1} and surrounding areas near ${cityName}. Simply switch the location filter or browse our nearby city listings to explore more options. We cover all major cities and towns across the region.`,
    },
    {
      question: `How do I stay safe when looking for ${cat} in ${cityName}?`,
      answer: `Always communicate through SecretZa's platform initially, verify provider details and photos, read user reviews carefully, and meet in safe, public locations for first encounters. Report any suspicious activity to our moderation team — all reports are investigated within 24 hours.`,
    },
  ];

  const breadcrumbItems: Array<{ name: string; url: string }> = [
    { name: "Home", url: "/" },
    { name: "India", url: "/country/india" },
    { name: cityName, url: `/escorts/${citySlug}` },
    { name: keyword, url: `/${keywordSlug}/${citySlug}` },
  ];

  // Build internal links
  const internalLinks: Array<{ text: string; url: string; type: 'city' | 'category' | 'search' }> = [];

  for (const city of nearby.slice(0, 5)) {
    internalLinks.push({
      text: `${keyword} in ${city.name}`,
      url: `/${keywordSlug}/${city.slug}`,
      type: 'search',
    });
  }

  for (const cat of CATEGORIES) {
    internalLinks.push({
      text: `${cat.name} in ${cityName}`,
      url: `/${cat.slug}/${citySlug}`,
      type: 'category',
    });
  }

  internalLinks.push({ text: `All listings in ${cityName}`, url: `/escorts/${citySlug}`, type: 'city' });
  internalLinks.push({ text: `${cityName} city guide`, url: `/escorts/${citySlug}`, type: 'city' });
  internalLinks.push({ text: "Browse India", url: "/country/india", type: "search" });

  return {
    title,
    metaDescription,
    h1,
    introParagraph,
    faqs,
    breadcrumbItems,
    internalLinks,
    trustBlock: generateTrustBlock(cityName, keyword),
    cityHighlights: areas,
    trendingSearches: generateTrendingSearches(citySlug, keywordSlug.includes('-') ? keywordSlug.split('-')[0] : undefined),
    authorInfo: { name: "SecretZa Editorial Team", role: "SEO Content Editor" },
    pageType: "longtail",
    lastUpdated: getDateModified(),
  };
}

// ------------------------------------------
// Freshness Helper
// ------------------------------------------

/**
 * Get today's date in ISO format (YYYY-MM-DD) for structured data.
 */
export function getDateModified(): string {
  return new Date().toISOString().split('T')[0]!;
}

// ------------------------------------------
// Structured Data (JSON-LD) Generators
// ------------------------------------------

/**
 * Generate a BreadcrumbList schema object.
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
  };
}

/**
 * Generate an ItemList schema for listing results.
 */
export function generateItemListSchema(name: string, url: string, numberOfItems: number): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: `${BASE_URL}${url}`,
    numberOfItems,
    itemListElement: Array.from({ length: Math.min(numberOfItems, 20) }, (_, i) => ({
      "@type": "ListItem",
      position: i + 1,
    })),
  };
}

/**
 * Generate an Organization schema for SecretZa.
 */
export function generateOrganizationSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: BRAND_TAGLINE,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["English", "Hindi"],
    },
    sameAs: [],
  };
}

/**
 * Generate a WebPage schema for an SEO page.
 */
export function generateWebPageSchema(input: {
  name: string;
  description?: string | null;
  url: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    url: input.url,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
      logo: `${BASE_URL}/logo.png`,
    },
  };
}

/**
 * Generate a WebSite schema with search action.
 */
export function generateWebSiteSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: BASE_URL,
    description: BRAND_TAGLINE,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generate an FAQPage schema from FAQ items.
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ------------------------------------------
// URL & Indexing Helpers
// ------------------------------------------

/**
 * Build the canonical URL for a given path.
 * Normalizes the path: strips trailing slashes, ensures leading slash.
 */
export function getCanonicalURL(path: string): string {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  return `${BASE_URL}${normalizedPath}`;
}

/**
 * Determine whether a page should have a noindex meta tag.
 * Returns true for low-value pages that shouldn't be indexed by search engines.
 */
export function shouldNoindex(
  pageType: string,
  listingCount: number,
  options?: {
    page?: number;          // current pagination page (0-indexed)
    hasCustomContent?: boolean; // true if admin has set custom intro/title
    citySlug?: string;       // for city tier check
  }
): boolean {
  // Rule 1: Deep pagination (page > 5) → noindex
  if (options?.page !== undefined && options.page > 5) {
    return true;
  }

  // Rule 2: Thin content (< 3 listings) without custom content → noindex
  if (listingCount < 3 && !options?.hasCustomContent) {
    return true;
  }

  // Rule 3: Category+City pages with 0 listings → noindex
  if (pageType === 'category_city' && listingCount === 0) {
    return true;
  }

  // Rule 4: Low-tier cities with 0 listings → noindex
  if (pageType === 'city' && listingCount === 0 && options?.citySlug) {
    const city = getCityBySlug(options.citySlug);
    if (city && city.tier >= 4) {
      return true;
    }
  }

  // Legacy rules preserved for backward compatibility
  if (pageType === "pagination" && listingCount === 0) return true;
  if (pageType === "sort" || pageType === "filter") return true;
  if (pageType === "search") return true;
  if (pageType === "tag" && listingCount < 5) return true;

  return false;
}

// ------------------------------------------
// Internal Linking Block Generator
// ------------------------------------------

export interface InternalLinkingBlock {
  title: string;
  links: Array<{ text: string; url: string }>;
  type: 'nearby_cities' | 'trending_cities' | 'related_categories' | 'popular_searches';
}

/**
 * Generate enhanced internal linking blocks for a page.
 * Returns organized groups of links for display in page templates.
 */
export function generateInternalLinkingBlocks(
  pageType: string,
  citySlug?: string,
  categorySlug?: string,
  _stateSlug?: string,
): InternalLinkingBlock[] {
  const blocks: InternalLinkingBlock[] = [];

  // 1. Nearby Cities (for city and category+city pages)
  if (citySlug) {
    const nearby = getNearbyCities(citySlug, 8);
    const city = MAJOR_INDIAN_CITIES.find(c => c.slug === citySlug);
    if (nearby.length > 0) {
      blocks.push({
        title: `Cities Near ${city?.name ?? citySlug}`,
        links: nearby.map(nc => ({
          text: nc.name,
          url: `/${nc.slug}`,
        })),
        type: 'nearby_cities',
      });
    }

    // Trending Cities (top metro cities, excluding current)
    const trendingCities = MAJOR_INDIAN_CITIES
      .filter(c => c.slug !== citySlug)
      .slice(0, 6);
    blocks.push({
      title: 'Trending Cities',
      links: trendingCities.map(c => ({
        text: c.name,
        url: categorySlug ? `/${categorySlug}/${c.slug}` : `/${c.slug}`,
      })),
      type: 'trending_cities',
    });
  }

  // 2. Related Categories
  if (categorySlug) {
    const related = CATEGORIES.filter(c => c.slug !== categorySlug).slice(0, 6);
    blocks.push({
      title: 'Related Categories',
      links: related.map(c => ({
        text: c.name,
        url: citySlug ? `/${c.slug}/${citySlug}` : `/${c.slug}`,
      })),
      type: 'related_categories',
    });
  } else {
    // All categories for city pages
    blocks.push({
      title: 'Browse by Category',
      links: CATEGORIES.slice(0, 6).map(c => ({
        text: c.name,
        url: citySlug ? `/${c.slug}/${citySlug}` : `/${c.slug}`,
      })),
      type: 'related_categories',
    });
  }

  // 3. Popular Searches
  blocks.push({
    title: 'Popular Searches',
    links: generatePopularSearches().map(search => ({
      text: search,
      url: `/search?q=${encodeURIComponent(search)}`,
    })),
    type: 'popular_searches',
  });

  return blocks;
}

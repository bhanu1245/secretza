/**
 * SEO Landing Page Generator for Secretza
 * Programmatically generates high-priority landing pages for SEO.
 * Server-side only — no 'use client'.
 */

import { indiaCities, indiaStates } from '@/lib/india-geo-data';
import { db } from '@/lib/db';

// ------------------------------------------
// Types
// ------------------------------------------

export interface GeneratedLandingPage {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  pageType: string;
  priority: number; // 0-100
  keywords: string[];
  seasonal?: string;
}

// ------------------------------------------
// Constants
// ------------------------------------------

const CATEGORIES = [
  { slug: 'escorts', label: 'Escorts', plural: 'Escorts' },
  { slug: 'massage', label: 'Massage', plural: 'Massage Services' },
  { slug: 'dating', label: 'Dating', plural: 'Dating Profiles' },
  { slug: 'trans', label: 'Trans', plural: 'Trans Escorts' },
  { slug: 'male-escorts', label: 'Male Escorts', plural: 'Male Escorts' },
  { slug: 'couples', label: 'Couples', plural: 'Couples Services' },
  { slug: 'adult-jobs', label: 'Adult Jobs', plural: 'Adult Job Listings' },
  { slug: 'adult-services', label: 'Adult Services', plural: 'Adult Services' },
  { slug: 'webcam', label: 'Webcam', plural: 'Webcam Models' },
  { slug: 'phone-chat', label: 'Phone Chat', plural: 'Phone Chat Services' },
] as const;

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;

// ------------------------------------------
// Helpers
// ------------------------------------------

function getCurrentMonth(): number {
  return new Date().getMonth(); // 0-indexed
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function titleCase(str: string): string {
  return str.replace(/(?:^|\s|-)\S/g, (match) => match.toUpperCase());
}

// ------------------------------------------
// City Landing Pages
// ------------------------------------------

/**
 * Generate landing pages for top cities combined with all categories.
 * Covers top 50 cities (tier 1–2) × 10 categories.
 */
export async function generateCityLandingPages(): Promise<GeneratedLandingPage[]> {
  const pages: GeneratedLandingPage[] = [];

  // Sort tier 1-2 cities by population (descending), take top 50
  const topCities = indiaCities
    .filter((c) => c.tier <= 2)
    .sort((a, b) => b.population - a.population)
    .slice(0, 50);

  // Fetch listing counts for each city in a single query group
  const cityListingCounts = await Promise.all(
    topCities.map(async (city) => {
      const count = await db.listing.count({
        where: { status: 'approved', citySlug: city.slug },
      });
      return { slug: city.slug, count };
    })
  );

  const countMap = new Map(cityListingCounts.map((c) => [c.slug, c.count]));

  for (const city of topCities) {
    const listingCount = countMap.get(city.slug) ?? 0;

    for (const cat of CATEGORIES) {
      const hasListings = listingCount > 0;
      const tierBonus = city.tier === 1 ? 15 : 0;
      const listingBonus = hasListings ? 10 : 0;
      const priority = Math.min(70, 45 + tierBonus + listingBonus);

      // Build unique title — vary the format to avoid duplicates
      const titleVariants = [
        `${capitalize(cat.plural)} in ${city.name} — Verified Listings ${getCurrentYear()}`,
        `${city.name} ${cat.plural} | Find ${cat.label} Near You`,
        `Best ${cat.plural} in ${city.name} — ${capitalize(cat.label)} Directory`,
        `Top ${cat.plural} in ${city.name} — Safe & Discreet ${getCurrentYear()}`,
        `${city.name} ${cat.label} Listings — Trusted ${cat.plural} ${getCurrentYear()}`,
      ];
      const titleIndex = CATEGORIES.indexOf(cat) % titleVariants.length;

      const h1Variants = [
        `${capitalize(cat.plural)} in ${city.name}`,
        `Find ${cat.plural} in ${city.name}`,
        `${city.name} ${cat.label} Directory`,
        `Verified ${cat.plural} in ${city.name}`,
      ];
      const h1Index = (topCities.indexOf(city) + CATEGORIES.indexOf(cat)) % h1Variants.length;

      pages.push({
        url: `/${cat.slug}/${city.slug}`,
        title: titleVariants[titleIndex],
        metaDescription: `Discover ${listingCount > 0 ? `${listingCount}+` : 'the best'} ${cat.plural.toLowerCase()} in ${city.name}. Browse verified ${cat.label.toLowerCase()} profiles with real photos, reviews, and direct contact options.`,
        h1: h1Variants[h1Index],
        pageType: 'category_city',
        priority,
        keywords: [
          `${cat.plural.toLowerCase()} in ${city.name.toLowerCase()}`,
          `${city.name.toLowerCase()} ${cat.label.toLowerCase()}`,
          `${cat.slug} ${city.slug}`,
          `best ${cat.label.toLowerCase()} ${city.name.toLowerCase()}`,
          `verified ${cat.slug} ${city.slug}`,
        ],
      });
    }
  }

  return pages;
}

// ------------------------------------------
// Trending Landing Pages
// ------------------------------------------

/**
 * Generate trending search landing pages based on current month.
 * These are time-aware pages that capture seasonal search intent.
 */
export function generateTrendingLandingPages(): GeneratedLandingPage[] {
  const pages: GeneratedLandingPage[] = [];
  const month = getCurrentMonth();
  const monthName = MONTH_NAMES[month];
  const monthLabel = capitalize(monthName);
  const year = getCurrentYear();

  // Top 15 cities for trending pages
  const trendingCities = indiaCities
    .filter((c) => c.tier === 1)
    .sort((a, b) => b.population - a.population)
    .slice(0, 15);

  // Trending keyword templates per category
  const trendingTemplates = [
    { prefix: 'New', suffix: `in ${monthLabel} ${year}` },
    { prefix: 'Latest', suffix: `— ${monthLabel} ${year} Update` },
    { prefix: `Top ${monthLabel}`, suffix: `Listings ${year}` },
    { prefix: 'Fresh', suffix: `Added This ${monthLabel}` },
  ];

  for (const city of trendingCities) {
    // Top 5 categories for trending
    const topTrendingCats = CATEGORIES.slice(0, 5);

    for (let i = 0; i < topTrendingCats.length; i++) {
      const cat = topTrendingCats[i];
      const template = trendingTemplates[i % trendingTemplates.length];
      const priority = 70 + (i < 3 ? 10 : 5); // 70-80 range

      pages.push({
        url: `/${cat.slug}/${city.slug}`,
        title: `${template.prefix} ${cat.plural} ${template.suffix} — ${city.name}`,
        metaDescription: `Browse ${template.prefix.toLowerCase()} ${cat.plural.toLowerCase()} in ${city.name} for ${monthLabel} ${year}. Updated listings with fresh profiles, real photos, and verified contacts.`,
        h1: `${template.prefix} ${cat.plural} ${template.suffix} in ${city.name}`,
        pageType: 'trending',
        priority,
        keywords: [
          `new ${cat.plural.toLowerCase()} ${city.name.toLowerCase()} ${monthName}`,
          `${cat.slug} ${city.slug} ${monthName} ${year}`,
          `latest ${cat.label.toLowerCase()} ${city.name.toLowerCase()}`,
          `${monthName} ${year} ${cat.plural.toLowerCase()} ${city.name.toLowerCase()}`,
          `fresh ${cat.slug} listings ${city.slug}`,
        ],
      });
    }
  }

  return pages;
}

// ------------------------------------------
// Seasonal Landing Pages
// ------------------------------------------

interface SeasonalEvent {
  name: string;
  slug: string;
  months: number[]; // 0-indexed
  keywords: string[];
  titleTemplates: string[];
  descriptionTemplate: string;
}

const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    name: "Valentine's Day",
    slug: 'valentines-day',
    months: [0, 1], // Jan-Feb (lead-up and event)
    keywords: ['valentine', 'romantic', 'valentines day', 'love', 'couple', 'date night'],
    titleTemplates: [
      "Valentine's Day {cat} — Romantic {catLabel} for Your Special Night",
      "Find the Perfect {catLabel} for Valentine's Day {year}",
      "Valentine's Day Special — Premium {cat} Near You",
    ],
    descriptionTemplate: "Make this Valentine's Day unforgettable. Browse our curated selection of {cat} perfect for a romantic evening. Verified profiles, real photos, and special Valentine's offers.",
  },
  {
    name: 'Summer',
    slug: 'summer',
    months: [2, 3, 4, 5], // Mar-Jun
    keywords: ['summer', 'vacation', 'holiday', 'getaway', 'summer fun'],
    titleTemplates: [
      'Summer {cat} — Hot {catLabel} for the Season',
      'Best Summer {cat} in {city} — {year} Edition',
      'Summer Special {cat} — Beat the Heat This Season',
    ],
    descriptionTemplate: 'Discover the hottest {cat} this summer. From beach getaways to city nights, find the perfect {catLabel} for your summer plans. Updated daily with fresh listings.',
  },
  {
    name: 'Monsoon',
    slug: 'monsoon',
    months: [5, 6, 7, 8], // Jun-Sep
    keywords: ['monsoon', 'rainy', 'indoor', 'cozy', 'monsoon special'],
    titleTemplates: [
      'Monsoon Special {cat} — Cozy Indoor {catLabel}',
      'Rainy Season {cat} — Stay Entertained This Monsoon',
      "Monsoon {cat} {year} — Perfect for Rainy Evenings",
    ],
    descriptionTemplate: 'Stay entertained this monsoon season with our curated {cat}. Perfect for cozy rainy evenings. Verified listings with real photos and direct contact options.',
  },
  {
    name: 'Diwali',
    slug: 'diwali',
    months: [9, 10], // Oct-Nov
    keywords: ['diwali', 'festival', 'diwali special', 'festive', 'celebration'],
    titleTemplates: [
      'Diwali Special {cat} — Celebrate the Festival of Lights',
      'Diwali {cat} — Premium {catLabel} for the Festive Season',
      "Diwali {year} {cat} — Make This Festival Extra Special",
    ],
    descriptionTemplate: 'Celebrate Diwali in style with our premium {cat}. Special festive listings, verified profiles, and exclusive Diwali offers. Make this festival unforgettable.',
  },
  {
    name: 'New Year',
    slug: 'new-year',
    months: [11, 0], // Dec-Jan
    keywords: ['new year', 'new years eve', ' nye', 'new year party', 'december', 'january'],
    titleTemplates: [
      "New Year's Eve {cat} — Ring in {year} Right",
      'New Year Special {cat} — Start {year} With a Bang',
      "NYE {cat} — Premium {catLabel} for New Year's Eve {year}",
    ],
    descriptionTemplate: "Ring in the new year with our exclusive {cat}. New Year's Eve specials, premium verified profiles, and unforgettable experiences for {year}.",
  },
];

/**
 * Generate seasonal landing pages based on the current date.
 * Produces pages for Valentine's, Summer, Monsoon, Diwali, and New Year.
 */
export function generateSeasonalLandingPages(): GeneratedLandingPage[] {
  const pages: GeneratedLandingPage[] = [];
  const month = getCurrentMonth();
  const year = getCurrentYear();

  // Top 10 cities for seasonal pages
  const seasonalCities = indiaCities
    .filter((c) => c.tier === 1)
    .sort((a, b) => b.population - a.population)
    .slice(0, 10);

  for (const event of SEASONAL_EVENTS) {
    // Check if the current month falls within this event's range
    if (!event.months.includes(month)) continue;

    const seasonalCats = CATEGORIES.slice(0, 6); // Top 6 categories for seasonal

    for (let i = 0; i < seasonalCats.length; i++) {
      const cat = seasonalCats[i];
      const template = event.titleTemplates[i % event.titleTemplates.length];

      // Priority: closer to the event date = higher priority
      const isPeakMonth = event.months.indexOf(month) === event.months.length - 1;
      const basePriority = isPeakMonth ? 72 : 62;
      const catBonus = i < 3 ? 8 : 0;
      const priority = basePriority + catBonus;

      const title = template
        .replace('{cat}', cat.plural)
        .replace('{catLabel}', cat.label)
        .replace('{year}', String(year));

      const description = event.descriptionTemplate
        .replace('{cat}', cat.plural.toLowerCase())
        .replace('{catLabel}', cat.label.toLowerCase());

      // Generate city-specific variants for top 3 categories
      if (i < 3) {
        for (const city of seasonalCities) {
          const cityTitle = template
            .replace('{cat}', cat.plural)
            .replace('{catLabel}', cat.label)
            .replace('{year}', String(year))
            + ` — ${city.name}`;

          pages.push({
            url: `/${cat.slug}/${city.slug}`,
            title: cityTitle,
            metaDescription: description.replace('.', ` in ${city.name}.`) + ` Browse verified ${cat.label.toLowerCase()} profiles in ${city.name}.`,
            h1: `${event.name} ${cat.plural} in ${city.name}`,
            pageType: 'seasonal',
            priority: Math.min(80, priority + 3),
            keywords: [
              ...event.keywords.map((kw) => `${kw} ${cat.slug} ${city.slug}`),
              `${event.slug} ${cat.plural.toLowerCase()} ${city.name.toLowerCase()}`,
              `${event.name.toLowerCase()} ${cat.label.toLowerCase()} ${city.name.toLowerCase()}`,
            ],
            seasonal: event.slug,
          });
        }
      }

      // Also generate a non-city-specific page
      pages.push({
        url: `/${cat.slug}/${event.slug}`,
        title,
        metaDescription: description,
        h1: `${event.name} ${cat.plural}`,
        pageType: 'seasonal',
        priority,
        keywords: [
          ...event.keywords.map((kw) => `${kw} ${cat.slug}`),
          `${event.slug} ${cat.plural.toLowerCase()}`,
          `${event.name.toLowerCase()} ${cat.label.toLowerCase()} ${year}`,
        ],
        seasonal: event.slug,
      });
    }
  }

  return pages;
}

// ------------------------------------------
// Premium Landing Pages
// ------------------------------------------

interface PremiumKeyword {
  slug: string;
  label: string;
  titleTemplate: string;
  h1Template: string;
  descriptionTemplate: string;
  keywords: string[];
  basePriority: number;
}

const PREMIUM_KEYWORDS: PremiumKeyword[] = [
  {
    slug: 'vip-escorts',
    label: 'VIP Escorts',
    titleTemplate: 'VIP Escorts in {city} — Premium Exclusive Companions {year}',
    h1Template: 'Exclusive VIP Escorts in {city}',
    descriptionTemplate: 'Browse premium VIP escorts in {city}. High-class companions with verified profiles, luxury service, and complete discretion. Exclusive listings updated daily.',
    keywords: ['vip escorts', 'premium escorts', 'elite companions', 'high class escorts', 'luxury escorts'],
    basePriority: 95,
  },
  {
    slug: 'premium-massage',
    label: 'Premium Massage',
    titleTemplate: 'Premium Massage Services in {city} — Luxury Spa & Bodywork {year}',
    h1Template: 'Premium Massage Services in {city}',
    descriptionTemplate: 'Discover premium massage services in {city}. From therapeutic to exotic bodywork, find verified luxury massage providers with real reviews and direct booking.',
    keywords: ['premium massage', 'luxury massage', 'high end massage', 'spa massage', 'elite massage services'],
    basePriority: 93,
  },
  {
    slug: 'verified-providers',
    label: 'Verified Providers',
    titleTemplate: 'Verified Providers in {city} — 100% Authentic Profiles {year}',
    h1Template: 'Verified & Authentic Providers in {city}',
    descriptionTemplate: 'Find 100% verified providers in {city}. Every profile is authenticated with ID verification and real photos. Safe, trusted, and discreet service guaranteed.',
    keywords: ['verified providers', 'authentic profiles', 'real photos', 'trusted providers', 'verified escorts'],
    basePriority: 92,
  },
  {
    slug: 'independent-escorts',
    label: 'Independent Escorts',
    titleTemplate: 'Independent Escorts in {city} — Direct Contact, No Agency {year}',
    h1Template: 'Independent Escorts in {city} — Direct Contact',
    descriptionTemplate: 'Connect directly with independent escorts in {city}. No agency fees, direct messaging, and verified profiles. Browse genuine independent companions available now.',
    keywords: ['independent escorts', 'direct contact escorts', 'no agency escorts', 'self employed escorts', 'private escorts'],
    basePriority: 91,
  },
  {
    slug: 'high-profile-escorts',
    label: 'High-Profile Escorts',
    titleTemplate: 'High-Profile Escorts in {city} — Elite Companionship {year}',
    h1Template: 'High-Profile Elite Escorts in {city}',
    descriptionTemplate: 'Explore high-profile escorts in {city}. Elite companions for discerning clients. Verified luxury profiles with complete privacy and premium service.',
    keywords: ['high profile escorts', 'elite escorts', 'sophisticated companions', 'premium dating', 'luxury companions'],
    basePriority: 90,
  },
  {
    slug: '247-escorts',
    label: '24/7 Available',
    titleTemplate: '24/7 Escorts in {city} — Available Right Now {year}',
    h1Template: 'Escorts Available 24/7 in {city}',
    descriptionTemplate: 'Find escorts available 24/7 in {city}. Late night, early morning — always available. Verified profiles with real-time availability and instant contact options.',
    keywords: ['24/7 escorts', 'escorts available now', 'late night escorts', 'overnight escorts', 'anytime escorts'],
    basePriority: 90,
  },
  {
    slug: 'incall-outcall',
    label: 'Incall & Outcall',
    titleTemplate: 'Incall & Outcall Services in {city} — Visit or Invite {year}',
    h1Template: 'Incall & Outcall Services in {city}',
    descriptionTemplate: 'Browse incall and outcall services in {city}. Choose to visit at their location or invite them to yours. Verified providers with flexible service options.',
    keywords: ['incall escorts', 'outcall escorts', 'home visit', 'hotel visit', 'visit or invite'],
    basePriority: 89,
  },
  {
    slug: 'budget-friendly',
    label: 'Budget Friendly',
    titleTemplate: 'Affordable Escorts in {city} — Quality on a Budget {year}',
    h1Template: 'Affordable Quality Escorts in {city}',
    descriptionTemplate: 'Discover budget-friendly escorts in {city} without compromising on quality. Verified profiles with transparent pricing, real photos, and honest reviews.',
    keywords: ['affordable escorts', 'budget escorts', 'cheap escorts', 'low cost escorts', 'value escorts'],
    basePriority: 88,
  },
];

/**
 * Generate premium keyword landing pages with high commercial intent.
 * Covers VIP escorts, premium massage, verified providers, etc.
 */
export function generatePremiumLandingPages(): GeneratedLandingPage[] {
  const pages: GeneratedLandingPage[] = [];
  const year = getCurrentYear();

  // Top 20 cities for premium pages
  const premiumCities = indiaCities
    .filter((c) => c.tier <= 2)
    .sort((a, b) => b.population - a.population)
    .slice(0, 20);

  for (const keyword of PREMIUM_KEYWORDS) {
    // Generate city-specific variants
    for (const city of premiumCities) {
      const tierBonus = city.tier === 1 ? 4 : 0;
      const metroBonus = city.isMetro ? 3 : 0;
      const priority = Math.min(100, keyword.basePriority + tierBonus + metroBonus);

      const title = keyword.titleTemplate
        .replace('{city}', city.name)
        .replace('{year}', String(year));

      const description = keyword.descriptionTemplate
        .replace('{city}', city.name);

      const h1 = keyword.h1Template.replace('{city}', city.name);

      pages.push({
        url: `/${keyword.slug}/${city.slug}`,
        title,
        metaDescription: description,
        h1,
        pageType: 'premium',
        priority,
        keywords: [
          ...keyword.keywords.map((kw) => `${kw} ${city.name.toLowerCase()}`),
          `${keyword.slug} ${city.slug}`,
          `best ${keyword.label.toLowerCase()} ${city.name.toLowerCase()}`,
        ],
      });
    }

    // Also generate a standalone page (without city)
    pages.push({
      url: `/${keyword.slug}`,
      title: keyword.titleTemplate.replace(' in {city}', ' in India').replace('{year}', String(year)),
      metaDescription: keyword.descriptionTemplate.replace('in {city}', 'across India'),
      h1: keyword.h1Template.replace('in {city}', 'in India'),
      pageType: 'premium',
      priority: keyword.basePriority,
      keywords: [
        ...keyword.keywords.map((kw) => `${kw} india`),
        `${keyword.slug} india`,
        `best ${keyword.label.toLowerCase()} india`,
      ],
    });
  }

  return pages;
}

// ------------------------------------------
// Master Function
// ------------------------------------------

/**
 * Master function that generates all types of landing pages,
 * deduplicates by URL, and sorts by priority (highest first).
 */
export async function generateAllLandingPages(): Promise<GeneratedLandingPage[]> {
  // Generate all page types in parallel
  const [cityPages, trendingPages, seasonalPages, premiumPages] = await Promise.all([
    generateCityLandingPages(),
    Promise.resolve(generateTrendingLandingPages()),
    Promise.resolve(generateSeasonalLandingPages()),
    Promise.resolve(generatePremiumLandingPages()),
  ]);

  // Combine all pages
  const allPages = [
    ...cityPages,
    ...trendingPages,
    ...seasonalPages,
    ...premiumPages,
  ];

  // Deduplicate by URL — keep the one with highest priority
  const urlMap = new Map<string, GeneratedLandingPage>();
  for (const page of allPages) {
    const existing = urlMap.get(page.url);
    if (!existing || page.priority > existing.priority) {
      urlMap.set(page.url, page);
    }
  }

  // Sort by priority (highest first), then by title for stable ordering
  const deduplicated = Array.from(urlMap.values());
  deduplicated.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.title.localeCompare(b.title);
  });

  return deduplicated;
}

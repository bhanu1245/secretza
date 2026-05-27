/**
 * Indexation Scoring Engine for Secretza
 * Evaluates pages for index-worthiness and recommends actions.
 * All rules are deterministic (same input = same output).
 */

import { db } from '@/lib/db';
import { indiaCities, indiaStates } from '@/lib/india-geo-data';

// ------------------------------------------
// Types
// ------------------------------------------

export interface IndexationScore {
  pageType: string;
  pageSlug: string;
  url: string;
  overallScore: number;       // 0-100
  recommendation: 'index' | 'noindex' | 'canonical' | 'consolidate';
  reasons: string[];
  signals: {
    listingCount: number;
    freshness: number;      // 0-100
    uniqueness: number;     // 0-100
    trafficPotential: number; // 0-100
    duplicateRisk: number;    // 0-100
    contentQuality: number;  // 0-100
  };
}

type Recommendation = 'index' | 'noindex' | 'canonical' | 'consolidate';

// ------------------------------------------
// Scoring Constants
// ------------------------------------------

const WEIGHTS = {
  listingCount: 30,      // Most important signal
  freshness: 25,           // Recent activity = better
  contentQuality: 20,      // Rich content = better
  trafficPotential: 15,     // Popular cities/categories = better
  uniqueness: 10,          // Unique content = better
  duplicateRisk: 25,       // Duplicate content = worse (subtracted, not added)
};

const THRESHOLDS = {
  noindex: 25,           // Below this → noindex
  lowConfidence: 40,     // Below this → review
  index: 60,             // Above this → index
};

// ------------------------------------------
// Data Loaders
// ------------------------------------------

interface PageData {
  pageType: string;
  listingCount: number;
  lastListingUpdate: Date | null;
  hasCustomTitle: boolean;
  hasCustomIntro: boolean;
  faqCount: number;
  internalLinkCount: number;
  categorySlug?: string;
  citySlug?: string;
  tier?: number;
}

function buildListingWhereClause(pageType: string, pageSlug: string) {
  const base: Record<string, string> = { status: 'approved' };
  switch (pageType) {
    case 'city':
      return { ...base, citySlug: pageSlug };
    case 'category':
      return { ...base, categorySlug: pageSlug };
    case 'category_city': {
      const [cat, city] = pageSlug.split('/');
      return { ...base, categorySlug: cat, citySlug: city };
    }
    case 'state':
      return { ...base, stateSlug: pageSlug };
    default:
      return base;
  }
}

async function loadPageData(pageType: string, pageSlug: string): Promise<PageData> {
  const whereClause = buildListingWhereClause(pageType, pageSlug);

  const [listingCount, seoOverride, faqCount] = await Promise.all([
    db.listing.count({ where: whereClause }),
    db.seoPage.findUnique({
      where: { pageType_pageSlug: { pageType, pageSlug } },
      select: { title: true, introContent: true, h1: true },
    }),
    db.seoFaq.count({
      where: {
        seoPage: { pageType, pageSlug },
        isActive: true,
      },
    }),
  ]);

  const lastListing = await db.listing.findFirst({
    where: whereClause,
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  const city = pageSlug ? indiaCities.find((c) => c.slug === pageSlug || c.aliases.includes(pageSlug)) : null;

  return {
    pageType,
    listingCount,
    lastListingUpdate: lastListing?.updatedAt ?? null,
    hasCustomTitle: !!seoOverride?.title && seoOverride.title !== seoOverride.h1,
    hasCustomIntro: !!seoOverride?.introContent,
    faqCount,
    internalLinkCount: faqCount + 5, // Approximate
    categorySlug: pageType === 'category' ? pageSlug : pageType === 'category_city' ? pageSlug.split('/')[0] : undefined,
    citySlug: pageType === 'city' ? pageSlug : pageType === 'category_city' ? pageSlug.split('/')[1] : undefined,
    tier: city?.tier,
  };
}

// ------------------------------------------
// Score Calculators
// ------------------------------------------

function scoreListingCount(data: PageData): number {
  if (data.listingCount === 0) return 0;
  if (data.listingCount >= 50) return 100;
  if (data.listingCount >= 20) return 80;
  if (data.listingCount >= 10) return 60;
  if (data.listingCount >= 5) return 40;
  if (data.listingCount >= 3) return 25;
  if (data.listingCount >= 1) return 10;
  return 5;
}

function scoreFreshness(data: PageData): number {
  if (!data.lastListingUpdate) return 0;
  const daysSinceUpdate = (Date.now() - data.lastListingUpdate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate <= 1) return 100;
  if (daysSinceUpdate <= 3) return 90;
  if (daysSinceUpdate <= 7) return 75;
  if (daysSinceUpdate <= 14) return 50;
  if (daysSinceUpdate <= 30) return 30;
  if (daysSinceUpdate <= 90) return 15;
  return 5;
}

function scoreUniqueness(data: PageData): number {
  let score = 30; // Base score for having a page
  if (data.hasCustomTitle && data.hasCustomIntro) score += 40;
  else if (data.hasCustomTitle || data.hasCustomIntro) score += 15;
  if (data.faqCount >= 5) score += 15;
  return Math.min(100, score);
}

function scoreTrafficPotential(data: PageData): number {
  // Tier-1 cities get highest traffic
  if (data.tier === 1) return 100;
  if (data.tier === 2) return 80;
  if (data.tier === 3) return 50;
  if (data.tier === 4) return 25;
  // Top categories get more traffic
  const topCategories = ['escorts', 'massage', 'dating', 'trans', 'webcam'];
  if (data.categorySlug && topCategories.includes(data.categorySlug)) return 85;
  if (data.categorySlug) return 50;
  // Country/state pages get broad traffic
  if (data.pageType === 'country') return 90;
  if (data.pageType === 'state') return 60;
  return 20;
}

function scoreDuplicateRisk(data: PageData): number {
  // Low content = high duplicate risk (higher score = worse)
  if (data.listingCount === 0 && !data.hasCustomIntro) return 80;
  if (data.listingCount === 0) return 60;
  if (data.listingCount === 1 && !data.hasCustomIntro) return 50;
  if (data.listingCount === 1) return 30;
  if (data.listingCount === 2 && !data.hasCustomIntro) return 20;
  if (!data.hasCustomTitle && !data.hasCustomIntro) return 40;
  return 10;
}

function scoreContentQuality(data: PageData): number {
  let score = 20;
  if (data.hasCustomIntro) score += 30;
  if (data.hasCustomTitle) score += 15;
  if (data.faqCount >= 5) score += 20;
  if (data.listingCount >= 10) score += 15;
  return Math.min(100, score);
}

// ------------------------------------------
// Recommendation Engine
// ------------------------------------------

function generateRecommendation(overallScore: number, reasons: string[]): { recommendation: Recommendation; reasons: string[] } {
  if (overallScore < THRESHOLDS.noindex) {
    return {
      recommendation: 'noindex',
      reasons: [...reasons, 'Low overall quality score — not enough content for indexing'],
    };
  }
  
  if (overallScore < THRESHOLDS.lowConfidence) {
    return {
      recommendation: 'noindex',
      reasons: [...reasons, 'Low confidence — needs more content or custom SEO data'],
    };
  }
  
  if (overallScore >= THRESHOLDS.index) {
    return {
      recommendation: 'index',
      reasons,
    };
  }
  
  return {
    recommendation: 'noindex',
    reasons: [...reasons, 'Below indexing threshold — needs improvement'],
  };
}

// ------------------------------------------
// Public API
// ------------------------------------------

/**
 * Score a single page for indexation.
 */
export async function scorePage(pageType: string, pageSlug: string): Promise<IndexationScore> {
  const data = await loadPageData(pageType, pageSlug);
  
  const scores = {
    listingCount: scoreListingCount(data),
    freshness: scoreFreshness(data),
    uniqueness: scoreUniqueness(data),
    trafficPotential: scoreTrafficPotential(data),
    duplicateRisk: scoreDuplicateRisk(data),
    contentQuality: scoreContentQuality(data),
  };
  
  const reasons: string[] = [];
  
  // Reason generation
  if (scores.listingCount === 0) reasons.push('No approved listings found');
  else if (data.listingCount < 3) reasons.push(`Only ${data.listingCount} listing(s) — thin content`);
  if (scores.freshness < 30) reasons.push('No recent activity (14+ days stale)');
  if (!data.hasCustomTitle && !data.hasCustomIntro) reasons.push('No custom SEO content');
  if (data.hasCustomTitle) reasons.push('Has custom title');
  if (data.hasCustomIntro) reasons.push('Has custom intro content');
  if (data.tier === 1) reasons.push('Tier-1 metro city — high traffic potential');
  if (data.tier === 4) reasons.push('Tier-4 city — low traffic potential');
  if (data.faqCount >= 5) reasons.push(`Rich FAQ content (${data.faqCount} FAQs)`);
  if (data.listingCount >= 50) reasons.push(`Substantial listings (${data.listingCount})`);
  
  // duplicateRisk is subtracted (higher risk → lower overall score)
  const overallScore = Math.max(0, Math.round(
    Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
      const value = scores[key as keyof typeof scores];
      if (key === 'duplicateRisk') return sum - value * weight;
      return sum + value * weight;
    }, 0)
  ));
  
  const { recommendation, reasons: recReasons } = generateRecommendation(overallScore, reasons);
  
  return {
    pageType,
    pageSlug,
    url: `https://secretza.com/${pageSlug}`,
    overallScore,
    recommendation,
    reasons: recReasons,
    signals: scores,
  };
}

/**
 * Score all pages and return a summary.
 */
export async function scoreAllPages(): Promise<{
  total: number;
  indexed: number;
  noindexed: number;
  lowConfidence: number;
  topIssues: IndexationScore[];
}> {
  const pages: Array<{ pageType: string; pageSlug: string }> = [];
  
  // Cities (tier ≤ 3 only)
  for (const city of indiaCities.filter((c) => c.tier <= 3)) {
    pages.push({ pageType: 'city', pageSlug: city.slug });
  }
  // Categories
  const categories = [
    'escorts', 'massage', 'dating', 'trans', 'male-escorts',
    'couples', 'adult-jobs', 'adult-services', 'webcam', 'phone-chat',
  ];
  for (const cat of categories) {
    pages.push({ pageType: 'category', pageSlug: cat });
  }
  // Country
  pages.push({ pageType: 'country', pageSlug: 'india' });

  // State pages — all 36 states and union territories
  for (const state of indiaStates) {
    pages.push({ pageType: 'state', pageSlug: state.slug });
  }

  // Category + City combo pages — top cities (tier 1-2) × all categories
  const topCities = indiaCities.filter((c) => c.tier <= 2);
  for (const city of topCities) {
    for (const cat of categories) {
      pages.push({ pageType: 'category_city', pageSlug: `${cat}/${city.slug}` });
    }
  }
  
  const scores: IndexationScore[] = [];
  for (const page of pages) {
    const score = await scorePage(page.pageType, page.pageSlug);
    scores.push(score);
  }
  
  const indexed = scores.filter((s) => s.recommendation === 'index').length;
  const noindexed = scores.filter((s) => s.recommendation === 'noindex').length;
  const lowConfidence = scores.filter((s) => s.overallScore >= THRESHOLDS.noindex && s.overallScore < THRESHOLDS.lowConfidence).length;
  const topIssues = [...scores]
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, 20);
  
  return {
    total: pages.length,
    indexed,
    noindexed,
    lowConfidence,
    topIssues,
  };
}

/**
 * Get the indexation score for a specific listing count.
 * Useful for quick evaluation without DB queries.
 */
export function scoreByListingCount(listingCount: number): { overallScore: number; recommendation: Recommendation } {
  const baseData: PageData = {
    pageType: 'city',
    listingCount,
    lastListingUpdate: null,
    hasCustomTitle: false,
    hasCustomIntro: false,
    faqCount: 0,
    internalLinkCount: 0,
  };
  
  const scores = {
    listingCount: scoreListingCount(baseData),
    freshness: scoreFreshness(baseData),
    uniqueness: scoreUniqueness(baseData),
    trafficPotential: scoreTrafficPotential(baseData),
    duplicateRisk: scoreDuplicateRisk(baseData),
    contentQuality: scoreContentQuality(baseData),
  };
  
  const overallScore = Math.max(0, Math.round(
    Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
      const value = scores[key as keyof typeof scores];
      if (key === 'duplicateRisk') return sum - value * weight;
      return sum + value * weight;
    }, 0)
  ));
  
  return generateRecommendation(overallScore, []) as any;
}

/**
 * Find pages that may be duplicated due to city aliases.
 * For each city with aliases, checks if both the primary slug page
 * and alias-based pages exist (have listings), and returns risk assessment.
 */
export async function getDuplicateRiskPages(): Promise<Array<{
  slug: string;
  type: string;
  duplicates: string[];
  risk: 'high' | 'medium' | 'low';
}>> {
  const results: Array<{
    slug: string;
    type: string;
    duplicates: string[];
    risk: 'high' | 'medium' | 'low';
  }> = [];

  // Find all cities that have aliases
  const citiesWithAliases = indiaCities.filter((c) => c.aliases.length > 0);

  for (const city of citiesWithAliases) {
    // Check listing counts for the primary slug and each alias
    const listingCounts = new Map<string, number>();

    const primaryCount = await db.listing.count({
      where: { status: 'approved', citySlug: city.slug },
    });
    listingCounts.set(city.slug, primaryCount);

    for (const alias of city.aliases) {
      const aliasCount = await db.listing.count({
        where: { status: 'approved', citySlug: alias },
      });
      listingCounts.set(alias, aliasCount);
    }

    // Determine which aliases actually have pages (listings > 0)
    const activeSlugs: string[] = [];
    if (primaryCount > 0) activeSlugs.push(city.slug);
    for (const alias of city.aliases) {
      if ((listingCounts.get(alias) ?? 0) > 0) activeSlugs.push(alias);
    }

    // Only report if there are 2+ active slugs (actual duplicates)
    if (activeSlugs.length < 2) continue;

    // Determine risk level based on listing overlap
    const primaryHasListings = primaryCount > 0;
    const aliasHasListings = activeSlugs.filter((s) => s !== city.slug).length > 0;

    let risk: 'high' | 'medium' | 'low';
    if (primaryHasListings && aliasHasListings) {
      // Both primary and alias pages have listings — high risk of content duplication
      risk = 'high';
    } else if (primaryHasListings || aliasHasListings) {
      // Only one side has listings — medium risk, should consolidate
      risk = 'medium';
    } else {
      // Neither has substantial listings — low risk for now
      risk = 'low';
    }

    results.push({
      slug: city.slug,
      type: 'city_alias',
      duplicates: activeSlugs.filter((s) => s !== city.slug),
      risk,
    });
  }

  return results;
}

/**
 * Get the recommended indexation action for a specific page.
 * Provides actionable recommendation with canonical URL when consolidation is needed.
 */
export async function getPageIndexationAction(
  pageType: string,
  pageSlug: string
): Promise<{
  action: 'index' | 'noindex' | 'canonical' | 'consolidate';
  canonicalUrl?: string;
  reasons: string[];
}> {
  const score = await scorePage(pageType, pageSlug);
  const reasons = [...score.reasons];

  // Low-scoring pages (< 40): recommend consolidation with canonical to parent
  if (score.overallScore < 40) {
    let canonicalUrl: string | undefined;

    // Determine the parent URL based on page type
    switch (pageType) {
      case 'category_city': {
        // Canonical to the city page (broader, more likely to have content)
        const citySlug = pageSlug.split('/')[1];
        const city = indiaCities.find((c) => c.slug === citySlug);
        canonicalUrl = `https://secretza.com/${city?.name ?? citySlug}`;
        reasons.push(`Low score (${score.overallScore}) — recommend consolidating to parent city page`);
        break;
      }
      case 'category': {
        canonicalUrl = 'https://secretza.com';
        reasons.push(`Low score (${score.overallScore}) — recommend consolidating to homepage`);
        break;
      }
      case 'city': {
        // Find the state this city belongs to
        const city = indiaCities.find((c) => c.slug === pageSlug);
        if (city) {
          canonicalUrl = `https://secretza.com/${city.stateSlug}`;
          reasons.push(`Low score (${score.overallScore}) — recommend consolidating to parent state page`);
        } else {
          canonicalUrl = 'https://secretza.com';
          reasons.push(`Low score (${score.overallScore}) — recommend consolidating to homepage`);
        }
        break;
      }
      case 'state': {
        canonicalUrl = 'https://secretza.com';
        reasons.push(`Low score (${score.overallScore}) — recommend consolidating to homepage`);
        break;
      }
      default: {
        canonicalUrl = 'https://secretza.com';
        reasons.push(`Low score (${score.overallScore}) — recommend consolidating to homepage`);
        break;
      }
    }

    // If the page has zero listings, just noindex it
    if (score.signals.listingCount === 0) {
      return {
        action: 'noindex',
        reasons: [...reasons, 'No listings — noindex until content is available'],
      };
    }

    return {
      action: 'consolidate',
      canonicalUrl,
      reasons,
    };
  }

  // Medium scores (40-60): recommend noindex until content improves
  if (score.overallScore < 60) {
    reasons.push(`Medium score (${score.overallScore}) — noindex until content quality improves`);
    return {
      action: 'noindex',
      reasons,
    };
  }

  // High scores (≥ 60): recommend index
  reasons.push(`High score (${score.overallScore}) — page is ready for indexing`);
  return {
    action: 'index',
    reasons,
  };
}

export { WEIGHTS, THRESHOLDS };

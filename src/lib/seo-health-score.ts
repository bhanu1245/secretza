/**
 * SEO Dashboard health score — issue-card pass rates + quality composite breakdown.
 */
import { SEO_MIN_WORD_COUNT } from "@/lib/seo-quality";
import { MIN_INTERNAL_LINKS_PER_PAGE } from "@/lib/seo-internal-links";

export type IssueCardInput = {
  totalPages: number;
  contentIssues: {
    missingMetaDescription: number;
    missingH1: number;
    missingCanonical: number;
    missingFeaturedImage: number;
    missingStructuredData: number;
    belowMinWords: number;
    missingInternalLinks: number;
    brokenInternalLinks: number;
    minWordCount: number;
    minInternalLinks: number;
  };
  duplicates: {
    pagesWithDuplicateTitle: number;
    pagesWithDuplicateMeta: number;
    pagesWithDuplicateH1: number;
    pagesWithDuplicateContent: number;
  };
};

export type IssueCardBreakdown = {
  id: string;
  name: string;
  affected: number;
  total: number;
  passRate: number;
  weight: number;
  contribution: number;
};

export type QualityComponentBreakdown = {
  id: string;
  name: string;
  maxPoints: number;
  earnedPoints: number;
  source: string;
};

export type HealthScoreBreakdown = {
  /** Primary dashboard health score — average issue-card pass rate. */
  healthScore: number;
  /** Average of per-page stored seoQualityScore (legacy composite). */
  storedAvgSeoQualityScore: number;
  /** Recomputed composite from DB aggregate metrics + issue pass rates. */
  recomputedQualityScore: number;
  issueCards: IssueCardBreakdown[];
  issueHealthScore: number;
  qualityComponents: QualityComponentBreakdown[];
  formula: {
    healthScore: string;
    perPageQualityScore: string;
  };
};

const ISSUE_CARD_WEIGHT = 1;

function passRate(total: number, affected: number): number {
  if (total <= 0) return 100;
  return Math.round(((total - affected) / total) * 1000) / 10;
}

export function buildIssueCards(input: IssueCardInput): IssueCardBreakdown[] {
  const { totalPages: total, contentIssues: issues, duplicates } = input;

  const specs: Array<{ id: string; name: string; affected: number }> = [
    { id: "duplicate_titles", name: "Meta Titles", affected: duplicates.pagesWithDuplicateTitle },
    {
      id: "meta_descriptions",
      name: "Meta Descriptions",
      affected: issues.missingMetaDescription + duplicates.pagesWithDuplicateMeta,
    },
    {
      id: "h1_tags",
      name: "H1 Tags",
      affected: issues.missingH1 + duplicates.pagesWithDuplicateH1,
    },
    { id: "canonical_urls", name: "Canonical URLs", affected: issues.missingCanonical },
    { id: "schema_markup", name: "Schema Markup", affected: issues.missingStructuredData },
    { id: "featured_images", name: "Featured Images", affected: issues.missingFeaturedImage },
    {
      id: "word_count",
      name: "Word Count",
      affected: issues.belowMinWords,
    },
    {
      id: "internal_links",
      name: "Internal Links",
      affected: issues.missingInternalLinks,
    },
    {
      id: "broken_internal_links",
      name: "Broken Internal Links",
      affected: issues.brokenInternalLinks ?? 0,
    },
    {
      id: "duplicate_content",
      name: "Duplicate Issues",
      affected: duplicates.pagesWithDuplicateContent,
    },
  ];

  return specs.map((spec) => {
    const rate = passRate(total, spec.affected);
    return {
      id: spec.id,
      name: spec.name,
      affected: spec.affected,
      total,
      passRate: rate,
      weight: ISSUE_CARD_WEIGHT,
      contribution: rate * ISSUE_CARD_WEIGHT,
    };
  });
}

export function computeIssueHealthScore(cards: IssueCardBreakdown[]): number {
  if (cards.length === 0) return 0;
  const totalWeight = cards.reduce((sum, c) => sum + c.weight, 0);
  const weighted = cards.reduce((sum, c) => sum + c.contribution, 0);
  return Math.round(weighted / totalWeight);
}

/** Recompute quality composite from aggregate DB metrics (matches computeSeoQualityScore weights). */
export function buildQualityComponents(input: {
  avgWordCount: number;
  avgUniqueness: number;
  avgInternalLinks: number;
  avgFaqCount: number;
  metadataPassRate: number;
  avgDuplicateFieldPenalties: number;
}): { components: QualityComponentBreakdown[]; score: number } {
  const wordRatio = Math.min(input.avgWordCount / SEO_MIN_WORD_COUNT, 1);
  const wordPts = wordRatio * 25;
  const uniqPts = (input.avgUniqueness / 100) * 25;
  const linkPts = Math.min(input.avgInternalLinks / 5, 1) * 15;
  const faqPts = Math.min(input.avgFaqCount / 5, 1) * 15;
  const metaPts = (input.metadataPassRate / 100) * 20;
  const penaltyPts = input.avgDuplicateFieldPenalties;

  const components: QualityComponentBreakdown[] = [
    {
      id: "word_count",
      name: "Content length",
      maxPoints: 25,
      earnedPoints: round1(wordPts),
      source: `avg wordCount ${round1(input.avgWordCount)} / ${SEO_MIN_WORD_COUNT}`,
    },
    {
      id: "uniqueness",
      name: "Uniqueness",
      maxPoints: 25,
      earnedPoints: round1(uniqPts),
      source: `avg uniquenessScore ${round1(input.avgUniqueness)}`,
    },
    {
      id: "internal_links",
      name: "Internal links",
      maxPoints: 15,
      earnedPoints: round1(linkPts),
      source: `avg internalLinksCount ${round1(input.avgInternalLinks)} (full at 5+)`,
    },
    {
      id: "faq_count",
      name: "FAQ count",
      maxPoints: 15,
      earnedPoints: round1(faqPts),
      source: `avg faqCount ${round1(input.avgFaqCount)} (full at 5+)`,
    },
    {
      id: "metadata",
      name: "Metadata completeness",
      maxPoints: 20,
      earnedPoints: round1(metaPts),
      source: `metadata pass rate ${round1(input.metadataPassRate)}%`,
    },
    {
      id: "duplicate_penalties",
      name: "Duplicate field penalties",
      maxPoints: 0,
      earnedPoints: round1(-penaltyPts),
      source: `avg penalty ${round1(penaltyPts)} pts (5 per flagged field at save)`,
    },
  ];

  const raw =
    wordPts + uniqPts + linkPts + faqPts + metaPts - penaltyPts;
  return {
    components,
    score: Math.max(0, Math.min(100, Math.round(raw))),
  };
}

export function buildHealthScoreBreakdown(input: {
  totalPages: number;
  contentIssues: IssueCardInput["contentIssues"];
  duplicates: IssueCardInput["duplicates"];
  aggregates: {
    avgSeoQualityScore: number;
    avgWordCount: number;
    avgUniqueness: number;
    avgInternalLinks: number;
    avgFaqCount: number;
  };
  /** Estimate avg duplicate-field penalty baked into stored per-page scores. */
  estimatedAvgDuplicatePenalty?: number;
}): HealthScoreBreakdown {
  const issueCards = buildIssueCards({
    totalPages: input.totalPages,
    contentIssues: input.contentIssues,
    duplicates: input.duplicates,
  });
  const issueHealthScore = computeIssueHealthScore(issueCards);

  const metaAffected =
    input.contentIssues.missingMetaDescription +
    input.contentIssues.missingH1 +
    input.contentIssues.missingCanonical +
    input.contentIssues.missingFeaturedImage +
    input.contentIssues.missingStructuredData;
  const metadataPassRate = passRate(input.totalPages, metaAffected);

  const quality = buildQualityComponents({
    avgWordCount: input.aggregates.avgWordCount,
    avgUniqueness: input.aggregates.avgUniqueness,
    avgInternalLinks: input.aggregates.avgInternalLinks,
    avgFaqCount: input.aggregates.avgFaqCount,
    metadataPassRate,
    avgDuplicateFieldPenalties: input.estimatedAvgDuplicatePenalty ?? 0,
  });

  return {
    healthScore: issueHealthScore,
    storedAvgSeoQualityScore: round1(input.aggregates.avgSeoQualityScore),
    recomputedQualityScore: quality.score,
    issueCards,
    issueHealthScore,
    qualityComponents: quality.components,
    formula: {
      healthScore:
        "round( Σ(issueCardPassRate × weight) / Σ(weight) ) — matches dashboard issue cards",
      perPageQualityScore:
        "per page: 25×wordRatio + 25×uniqueness/100 + 15×min(links/5,1) + 15×min(faqs/5,1) + 20×metadata − 5×duplicateFlags; healthScore uses issue cards, not this average",
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

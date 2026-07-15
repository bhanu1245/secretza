import { describe, it, expect } from "vitest";
import {
  KeywordQualityScorer,
  keywordQualityScorer,
  KEYWORD_QUALITY_MODULE_ID,
  scorePlacement,
  scoreKeywordDensity,
  scoreKeywordDistribution,
  scoreKeywordSpread,
  scoreSecondaryKeywords,
  scoreSemanticVariants,
} from "@/lib/seo-scorers/keyword-quality-scorer";
import type { ModuleContext, QualityMetrics, ScoringProfile } from "@/lib/seo-quality-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    // Content metrics (ContentMetricsProvider)
    wordCount: 600, wordCountIntro: 200, paragraphCount: 8,
    avgParagraphWords: 75, sentenceCount: 30, avgSentenceWords: 18,
    longSentenceRatio: 0.1, headingCount: 5, h2Count: 3, h3Count: 2,
    headingDensity: 2, listCount: 2, tableCount: 0, contentDensity: 0.85,

    // Keyword metrics (KeywordMetricsProvider) — defaults represent a well-targeted page
    primaryKeywordPresent: true,
    primaryKeywordOccurrences: 10,
    primaryKeywordDensity: 1.5,
    primaryKeywordFirstPosition: 5,
    primaryKeywordLastPosition: 280,
    primaryKeywordInTitle: true,
    primaryKeywordInH1: true,
    primaryKeywordInMeta: true,
    primaryKeywordInIntro: true,
    primaryKeywordInFaq: true,
    primaryKeywordInInternalLinks: true,
    primaryKeywordInSlug: true,
    primaryKeywordInCanonical: true,
    secondaryKeywordHits: 3,
    secondaryKeywordCount: 3,
    secondaryKeywordCoverage: 1.0,
    secondaryKeywordOccurrences: 6,
    secondaryKeywordDensity: 0.5,
    semanticVariantCount: 2,
    semanticVariantCoverage: 1.0,
    exactMatchCount: 10,
    partialMatchCount: 2,
    keywordDistributionScore: 0.8,
    keywordSpread: 0.7,
    sectionCoverage: 0.8,
    headingCoverage: 0.6,
    faqCoverage: 0.8,
    introCoverage: 1.0,

    // Legacy keyword fields (not consumed by this scorer)
    keywordDensity: 0.015,
    keywordStuffingRisk: false,

    // Readability (ReadabilityMetricsProvider)
    readabilityScore: 65, typeTokenRatio: 0.55, lexicalDiversity: 0.6,
    avgWordLength: 5.2, complexWordRatio: 0.12, syllableCount: 900,
    avgSyllablesPerWord: 1.5, fleschKincaidGrade: 9,

    // Uniqueness (UniquenessMetricsProvider)
    uniquenessScore: 85, duplicateFieldCount: 0,
    titleUniqueness: 95, metaUniqueness: 90, contentUniqueness: 80,

    // Internal links (InternalLinksMetricsProvider)
    internalLinkCount: 5, uniqueInternalLinkCount: 5, internalLinkDensity: 0.8,
    anchorTextVariety: 0.9, internalLinkDepth: 2, orphanRisk: false,
    anchorTextKeywordCoverage: 0.6,

    // FAQ (FAQMetricsProvider)
    faqCount: 5, faqWordCount: 200, avgFaqAnswerWords: 40,
    faqQuestionCount: 5, faqAnswerCount: 5, faqCoverageScore: 0.8,
    faqKeywordPresence: true, faqStructuredDataPresent: true,
    faqUniqueQuestionCount: 5, faqTemplateQuestionCount: 0,

    // Metadata (MetadataMetricsProvider)
    titleLength: 55, metaDescriptionLength: 145, h1Length: 45,
    canonicalExists: true, canonicalMatchesUrl: true,
    robotsNoindex: false, robotsNofollow: false,
    ogTitleExists: true, ogDescriptionExists: true, ogImageExists: true,
    twitterCardExists: true, twitterTitleExists: true,
    schemaMarkupExists: true, schemaTypes: ["LocalBusiness"],
    websiteSchemaExists: true, faqSchemaExists: true, articleSchemaExists: false,
    hreflangExists: false, hreflangCount: 0, alternateLinkCount: 0,
    viewportMetaExists: true, charsetMetaExists: true,
    faviconExists: true, manifestExists: false,

    // Heading quality
    h2UniqueCount: 3, h2TemplateCount: 0, headingKeywordCoverage: 0.6,

    // Duplicate content (DuplicateContentMetricsProvider)
    duplicateSentenceCount: 0, duplicateParagraphCount: 0,
    duplicateHeadingCount: 0, duplicateFaqQuestionCount: 0,
    duplicateFaqAnswerCount: 0, duplicateLeadInCount: 0,
    duplicateIntroSentenceCount: 0, repeatedPhraseCount: 2,

    // Semantic (SemanticMetricsProvider)
    semanticKeywordCoverage: 0.7, keywordVariantCoverage: 0.6,
    topicCoverage: 0.75, entityCoverage: 0.6, conceptCount: 12,
    uniqueConceptCount: 10, conceptDensity: 0.02, conceptDiversity: 0.8,
    conceptRedundancy: 0.15, semanticClusterCount: 3, semanticClusterCoverage: 0.7,
    headingSemanticCoverage: 0.6, introSemanticCoverage: 0.8,
    faqSemanticCoverage: 0.7, sectionSemanticCoverage: 0.65,
    entityDistribution: 0.6, topicDistribution: 0.7, phraseVariationScore: 0.65,
    coOccurrenceCount: 8, coOccurrenceDensity: 0.013, semanticConsistency: 0.8,
    semanticTransitionScore: 0.7, entityReuseRatio: 0.3, variantReuseRatio: 0.25,
    semanticGapCount: 2, semanticOverlapRatio: 0.1,

    // AI pattern (AIPatternMetricsProvider)
    aiPhraseCount: 2, aiPhraseRatio: 0.003, aiPhraseDensity: 0.003,
    aiTransitionPhraseCount: 1, aiHedgingPhraseCount: 0,
    aiMarketingPhraseCount: 1, templatePhraseCount: 0, stockPhraseCount: 1,
    genericClaimCount: 0, repetitiveOpeningCount: 0, repetitiveClosingCount: 0,
    sentenceLengthUniformity: 0.7, paragraphLengthUniformity: 0.65,
    headingLengthUniformity: 0.6, lexicalBurstiness: 0.3,
    paragraphBurstiness: 0.4, vocabularyRepetition: 0.25,
    templateSentenceCount: 0, templateSentenceRatio: 0,
    templateParagraphCount: 0, passiveVoiceProxy: 0.1,
    listHeavyRatio: 0.1, conclusionPatternCount: 1,
    callToActionPatternCount: 1, exclamationDensity: 0.005,
    questionDensity: 0.03, repetitionRisk: 0.15, humanVariationScore: 0.85,
    transitionOveruseScore: 0.1, openingVariationScore: 0.8,
    closingVariationScore: 0.75, averageSentenceVariance: 0.6,
    averageParagraphVariance: 0.55,

    // Local authenticity (LocalAuthenticityMetricsProvider)
    localReferenceCount: 12, uniqueLocalReferenceCount: 10,
    duplicateLocalReferenceCount: 2, districtMentionCount: 3,
    landmarkMentionCount: 4, transportMentionCount: 2, airportMentionCount: 1,
    railwayStationMentionCount: 1, busStandMentionCount: 0,
    shoppingMallMentionCount: 2, marketMentionCount: 1,
    businessDistrictMentionCount: 1, techParkMentionCount: 0,
    touristAreaMentionCount: 1, festivalMentionCount: 0,
    localCuisineMentionCount: 0, hotelAreaMentionCount: 1,
    luxuryAreaMentionCount: 0, neighborhoodCoverage: 0.6,
    geographicSpread: 0.5, introLocalReferenceCount: 3,
    faqLocalReferenceCount: 2, headingLocalReferenceCount: 2,
    sectionLocalReferenceCoverage: 0.6, curatedReferenceCount: 8,
    generatedReferenceCount: 4, localEntityDensity: 2.5,
    locationMentionFrequency: 0.02, referenceDistributionScore: 0.7,
    referenceEntropy: 0.65, referenceRedundancy: 0.15,
    cityNameOccurrences: 8, primaryLocationCoverage: 0.8,
    secondaryLocationCoverage: 0.5,

    ...overrides,
  } as QualityMetrics;
}

function makeContext(metricsOverrides: Partial<QualityMetrics> = {}): ModuleContext {
  return {
    metrics: makeMetrics(metricsOverrides),
    profile: { id: "test-profile", modules: [], pageTypes: ["city"] } as unknown as ScoringProfile,
    pageContext: { pageType: "city", pageSlug: "test-city", primaryKeyword: "test keyword", secondaryKeywords: [], attempt: 1 },
    ruleResults: [],
    priorModuleScores: [],
  };
}

// ─── Identity ──────────────────────────────────────────────────────────────────

describe("KeywordQualityScorer — identity", () => {
  const scorer = new KeywordQualityScorer();

  it("has correct module ID", () => {
    expect(scorer.id).toBe("keyword-quality");
    expect(scorer.id).toBe(KEYWORD_QUALITY_MODULE_ID);
  });

  it("singleton has same ID as class", () => {
    expect(keywordQualityScorer.id).toBe(KEYWORD_QUALITY_MODULE_ID);
  });

  it("has required fields", () => {
    expect(typeof scorer.name).toBe("string");
    expect(typeof scorer.description).toBe("string");
    expect(scorer.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof scorer.priority).toBe("number");
    expect(Array.isArray(scorer.requiredMetrics)).toBe(true);
    expect(Array.isArray(scorer.dependsOnModules)).toBe(true);
  });

  it("lists all consumed KMP metric keys", () => {
    const keys = scorer.requiredMetrics as readonly string[];
    expect(keys).toContain("primaryKeywordPresent");
    expect(keys).toContain("primaryKeywordDensity");
    expect(keys).toContain("primaryKeywordInTitle");
    expect(keys).toContain("primaryKeywordInH1");
    expect(keys).toContain("primaryKeywordInMeta");
    expect(keys).toContain("primaryKeywordInIntro");
    expect(keys).toContain("primaryKeywordInFaq");
    expect(keys).toContain("primaryKeywordInSlug");
    expect(keys).toContain("secondaryKeywordCount");
    expect(keys).toContain("secondaryKeywordCoverage");
    expect(keys).toContain("semanticVariantCount");
    expect(keys).toContain("semanticVariantCoverage");
    expect(keys).toContain("keywordDistributionScore");
    expect(keys).toContain("keywordSpread");
  });

  it("does not depend on other modules", () => {
    expect(scorer.dependsOnModules).toHaveLength(0);
  });
});

// ─── scorePlacement ───────────────────────────────────────────────────────────

describe("scorePlacement", () => {
  it("all zones present → 100", () => {
    expect(scorePlacement(true, true, true, true, true, true)).toBe(100);
  });

  it("all zones absent → 0", () => {
    expect(scorePlacement(false, false, false, false, false, false)).toBe(0);
  });

  it("title only → 30 (weight 30/100)", () => {
    expect(scorePlacement(true, false, false, false, false, false)).toBe(30);
  });

  it("h1 only → 20", () => {
    expect(scorePlacement(false, true, false, false, false, false)).toBe(20);
  });

  it("meta only → 20", () => {
    expect(scorePlacement(false, false, true, false, false, false)).toBe(20);
  });

  it("intro only → 15", () => {
    expect(scorePlacement(false, false, false, true, false, false)).toBe(15);
  });

  it("faq only → 10", () => {
    expect(scorePlacement(false, false, false, false, true, false)).toBe(10);
  });

  it("slug only → 5", () => {
    expect(scorePlacement(false, false, false, false, false, true)).toBe(5);
  });

  it("title + H1 → 50", () => {
    expect(scorePlacement(true, true, false, false, false, false)).toBe(50);
  });

  it("title + H1 + meta → 70", () => {
    expect(scorePlacement(true, true, true, false, false, false)).toBe(70);
  });

  it("title + H1 + meta + intro → 85", () => {
    expect(scorePlacement(true, true, true, true, false, false)).toBe(85);
  });
});

// ─── scoreKeywordDensity ──────────────────────────────────────────────────────

describe("scoreKeywordDensity", () => {
  it("0% → 0 (left-clamp)", () => {
    expect(scoreKeywordDensity(0)).toBe(0);
  });

  it("1.5% → 100 (breakpoint)", () => {
    expect(scoreKeywordDensity(1.5)).toBe(100);
  });

  it("2.5% → 100 (plateau)", () => {
    expect(scoreKeywordDensity(2.5)).toBe(100);
  });

  it("5.0% → 0 (right-clamp)", () => {
    expect(scoreKeywordDensity(5.0)).toBe(0);
  });

  it("5.5% → 0 (beyond right-clamp)", () => {
    expect(scoreKeywordDensity(5.5)).toBe(0);
  });

  it("1.0% → 80 (breakpoint)", () => {
    expect(scoreKeywordDensity(1.0)).toBe(80);
  });

  it("4.0% → 30 (approaching stuffing, breakpoint)", () => {
    expect(scoreKeywordDensity(4.0)).toBe(30);
  });

  it("strictly degrades from 3.0 to 5.0", () => {
    const at3 = scoreKeywordDensity(3.0);
    const at4 = scoreKeywordDensity(4.0);
    const at5 = scoreKeywordDensity(5.0);
    expect(at3).toBeGreaterThan(at4);
    expect(at4).toBeGreaterThan(at5);
  });

  it("monotonically increases from 0 to 1.5", () => {
    const values = [0, 0.3, 0.5, 1.0, 1.5].map(scoreKeywordDensity);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });
});

// ─── scoreKeywordDistribution ─────────────────────────────────────────────────

describe("scoreKeywordDistribution", () => {
  it("0.0 → 0 (left-clamp)", () => {
    expect(scoreKeywordDistribution(0)).toBe(0);
  });

  it("1.0 → 100 (right-clamp)", () => {
    expect(scoreKeywordDistribution(1.0)).toBe(100);
  });

  it("0.6 → 85 (breakpoint)", () => {
    expect(scoreKeywordDistribution(0.6)).toBe(85);
  });

  it("0.2 → 30 (breakpoint)", () => {
    expect(scoreKeywordDistribution(0.2)).toBe(30);
  });

  it("monotonically non-decreasing over [0, 1]", () => {
    const values = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0].map(scoreKeywordDistribution);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });
});

// ─── scoreKeywordSpread ───────────────────────────────────────────────────────

describe("scoreKeywordSpread", () => {
  it("0.0 → 0 (left-clamp)", () => {
    expect(scoreKeywordSpread(0)).toBe(0);
  });

  it("0.8 → 100 (right-clamp breakpoint)", () => {
    expect(scoreKeywordSpread(0.8)).toBe(100);
  });

  it("1.0 → 100 (beyond right-clamp)", () => {
    expect(scoreKeywordSpread(1.0)).toBe(100);
  });

  it("0.2 → 40 (breakpoint)", () => {
    expect(scoreKeywordSpread(0.2)).toBe(40);
  });

  it("0.5 → 80 (breakpoint)", () => {
    expect(scoreKeywordSpread(0.5)).toBe(80);
  });

  it("monotonically non-decreasing over [0, 1]", () => {
    const values = [0, 0.2, 0.5, 0.8, 1.0].map(scoreKeywordSpread);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });
});

// ─── scoreSecondaryKeywords ───────────────────────────────────────────────────

describe("scoreSecondaryKeywords", () => {
  it("count=0 → 100 (no secondaries supplied)", () => {
    expect(scoreSecondaryKeywords(0, 0)).toBe(100);
  });

  it("count=0, coverage=0 → 100", () => {
    expect(scoreSecondaryKeywords(0, 0)).toBe(100);
  });

  it("full coverage → 100", () => {
    expect(scoreSecondaryKeywords(1.0, 3)).toBe(100);
  });

  it("zero coverage with count>0 → 0", () => {
    expect(scoreSecondaryKeywords(0, 3)).toBe(0);
  });

  it("0.5 coverage, count=4 → 70 (breakpoint)", () => {
    expect(scoreSecondaryKeywords(0.5, 4)).toBe(70);
  });

  it("0.25 coverage → 40 (breakpoint)", () => {
    expect(scoreSecondaryKeywords(0.25, 2)).toBe(40);
  });

  it("monotonically non-decreasing over [0, 1] when count>0", () => {
    const values = [0, 0.25, 0.5, 0.75, 1.0].map(v => scoreSecondaryKeywords(v, 4));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });
});

// ─── scoreSemanticVariants ────────────────────────────────────────────────────

describe("scoreSemanticVariants", () => {
  it("count=0 → 100 (no variants supplied)", () => {
    expect(scoreSemanticVariants(0, 0)).toBe(100);
  });

  it("full coverage → 100", () => {
    expect(scoreSemanticVariants(1.0, 2)).toBe(100);
  });

  it("zero coverage with count>0 → 0", () => {
    expect(scoreSemanticVariants(0, 2)).toBe(0);
  });

  it("0.5 coverage → 75 (breakpoint)", () => {
    expect(scoreSemanticVariants(0.5, 3)).toBe(75);
  });

  it("monotonically non-decreasing when count>0", () => {
    const values = [0, 0.25, 0.5, 1.0].map(v => scoreSemanticVariants(v, 3));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });
});

// ─── Output structure ─────────────────────────────────────────────────────────

describe("KeywordQualityScorer — output structure", () => {
  const scorer = new KeywordQualityScorer();

  it("returns required ModuleResult fields", () => {
    const result = scorer.score(makeContext());
    expect(result.moduleId).toBe(KEYWORD_QUALITY_MODULE_ID);
    expect(typeof result.score).toBe("number");
    expect(typeof result.maxScore).toBe("number");
    expect(typeof result.normalizedScore).toBe("number");
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.breakdown).toBe("object");
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.executionMs).toBe("number");
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("score is in [0, 100]", () => {
    const result = scorer.score(makeContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("maxScore is 100", () => {
    expect(scorer.score(makeContext()).maxScore).toBe(100);
  });

  it("normalizedScore is in [0, 1]", () => {
    const result = scorer.score(makeContext());
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(result.normalizedScore).toBeLessThanOrEqual(1);
  });

  it("breakdown includes all component keys and accounting keys", () => {
    const result = scorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("placement");
    expect(result.breakdown).toHaveProperty("density");
    expect(result.breakdown).toHaveProperty("distribution");
    expect(result.breakdown).toHaveProperty("spread");
    expect(result.breakdown).toHaveProperty("secondary");
    expect(result.breakdown).toHaveProperty("semantic");
    expect(result.breakdown).toHaveProperty("_rawScore");
    expect(result.breakdown).toHaveProperty("_penaltyTotal");
    expect(result.breakdown).toHaveProperty("_cappedScore");
    expect(result.breakdown).toHaveProperty("_finalScore");
  });

  it("executionMs is non-negative", () => {
    expect(scorer.score(makeContext()).executionMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe("KeywordQualityScorer — determinism", () => {
  const scorer = new KeywordQualityScorer();

  it("same inputs → identical outputs across 5 calls", () => {
    const ctx = makeContext();
    const results = Array.from({ length: 5 }, () => scorer.score(ctx));
    const first = results[0]!;
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.score).toBe(first.score);
      expect(results[i]!.normalizedScore).toBe(first.normalizedScore);
      expect(results[i]!.breakdown).toEqual(first.breakdown);
    }
  });

  it("different inputs → different scores", () => {
    const high = scorer.score(makeContext({ primaryKeywordInTitle: true, primaryKeywordDensity: 2.0 }));
    const low  = scorer.score(makeContext({ primaryKeywordInTitle: false, primaryKeywordDensity: 0.1 }));
    expect(high.score).toBeGreaterThan(low.score);
  });
});

// ─── Absent primary keyword ────────────────────────────────────────────────────

describe("KeywordQualityScorer — absent primary keyword", () => {
  const scorer = new KeywordQualityScorer();

  it("primaryKeywordPresent=false → score capped at 10", () => {
    const result = scorer.score(makeContext({
      primaryKeywordPresent: false,
      primaryKeywordDensity: 0,
      primaryKeywordInTitle: false, primaryKeywordInH1: false,
      primaryKeywordInMeta: false, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      keywordDistributionScore: 0, keywordSpread: 0,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
    }));
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("primaryKeywordPresent=false → KQ_PRIMARY_ABSENT recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordPresent: false, primaryKeywordDensity: 0 }));
    const codes = result.recommendations.map(r => r.code);
    expect(codes).toContain("KQ_PRIMARY_ABSENT");
  });

  it("primaryKeywordPresent=false with non-zero secondary/semantic → still capped at 10", () => {
    const result = scorer.score(makeContext({
      primaryKeywordPresent: false,
      primaryKeywordDensity: 0,
      secondaryKeywordCoverage: 1.0, secondaryKeywordCount: 3,
      semanticVariantCoverage: 1.0, semanticVariantCount: 2,
    }));
    expect(result.score).toBeLessThanOrEqual(10);
  });
});

// ─── Placement zones ──────────────────────────────────────────────────────────

describe("KeywordQualityScorer — placement zones", () => {
  const scorer = new KeywordQualityScorer();

  it("title present contributes most to placement", () => {
    const withTitle    = scorer.score(makeContext({ primaryKeywordInTitle: true,  primaryKeywordInH1: false, primaryKeywordInMeta: false, primaryKeywordInIntro: false, primaryKeywordInFaq: false, primaryKeywordInSlug: false }));
    const withoutTitle = scorer.score(makeContext({ primaryKeywordInTitle: false, primaryKeywordInH1: true,  primaryKeywordInMeta: false, primaryKeywordInIntro: false, primaryKeywordInFaq: false, primaryKeywordInSlug: false }));
    expect(withTitle.breakdown["placement"] as number).toBeGreaterThan(withoutTitle.breakdown["placement"] as number);
  });

  it("missing title → KQ_MISSING_TITLE recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordInTitle: false }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_MISSING_TITLE");
  });

  it("title present → no KQ_MISSING_TITLE", () => {
    const result = scorer.score(makeContext({ primaryKeywordInTitle: true }));
    expect(result.recommendations.map(r => r.code)).not.toContain("KQ_MISSING_TITLE");
  });

  it("missing H1 → KQ_MISSING_H1 recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordInH1: false }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_MISSING_H1");
  });

  it("missing meta → KQ_MISSING_META recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordInMeta: false }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_MISSING_META");
  });

  it("missing intro → KQ_MISSING_INTRO recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordInIntro: false }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_MISSING_INTRO");
  });

  it("missing FAQ → KQ_MISSING_FAQ recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordInFaq: false }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_MISSING_FAQ");
  });

  it("missing slug → KQ_MISSING_SLUG recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordInSlug: false }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_MISSING_SLUG");
  });
});

// ─── Density scoring ──────────────────────────────────────────────────────────

describe("KeywordQualityScorer — density scoring", () => {
  const scorer = new KeywordQualityScorer();

  it("optimal density (1.5%) → no density recommendation", () => {
    const result = scorer.score(makeContext({ primaryKeywordDensity: 1.5 }));
    const codes = result.recommendations.map(r => r.code);
    expect(codes).not.toContain("KQ_DENSITY_LOW");
    expect(codes).not.toContain("KQ_DENSITY_HIGH");
  });

  it("low density (0.3%) → KQ_DENSITY_LOW", () => {
    const result = scorer.score(makeContext({ primaryKeywordDensity: 0.3 }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_DENSITY_LOW");
  });

  it("stuffing density (5.0%) → KQ_DENSITY_HIGH", () => {
    const result = scorer.score(makeContext({ primaryKeywordDensity: 5.0 }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_DENSITY_HIGH");
  });

  it("stuffing (>4%) applies penalty → lower score than borderline (4%)", () => {
    const borderline = scorer.score(makeContext({ primaryKeywordDensity: 4.0 }));
    const stuffing   = scorer.score(makeContext({ primaryKeywordDensity: 5.0 }));
    expect(borderline.score).toBeGreaterThan(stuffing.score);
  });

  it("stuffing penalty reflected in _penaltyTotal", () => {
    const result = scorer.score(makeContext({ primaryKeywordDensity: 5.0 }));
    expect(result.breakdown["_penaltyTotal"] as number).toBeGreaterThan(0);
  });

  it("higher density (1.5 vs 0.5) → higher density contribution", () => {
    const high = scorer.score(makeContext({ primaryKeywordDensity: 1.5 }));
    const low  = scorer.score(makeContext({ primaryKeywordDensity: 0.5 }));
    expect(high.breakdown["density"] as number).toBeGreaterThan(low.breakdown["density"] as number);
  });
});

// ─── Distribution scoring ─────────────────────────────────────────────────────

describe("KeywordQualityScorer — distribution and spread", () => {
  const scorer = new KeywordQualityScorer();

  it("distributionScore=1.0 → distribution contribution=100", () => {
    const result = scorer.score(makeContext({ keywordDistributionScore: 1.0 }));
    expect(result.breakdown["distribution"]).toBe(100);
  });

  it("distributionScore=0.0 → distribution contribution=0", () => {
    const result = scorer.score(makeContext({ keywordDistributionScore: 0 }));
    expect(result.breakdown["distribution"]).toBe(0);
  });

  it("keywordSpread=0.8 → spread contribution=100", () => {
    const result = scorer.score(makeContext({ keywordSpread: 0.8 }));
    expect(result.breakdown["spread"]).toBe(100);
  });

  it("low distribution (<0.4) → KQ_POOR_DISTRIBUTION recommendation", () => {
    const result = scorer.score(makeContext({
      primaryKeywordPresent: true,
      keywordDistributionScore: 0.2,
    }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_POOR_DISTRIBUTION");
  });

  it("adequate distribution (≥0.4) → no KQ_POOR_DISTRIBUTION", () => {
    const result = scorer.score(makeContext({ keywordDistributionScore: 0.6 }));
    expect(result.recommendations.map(r => r.code)).not.toContain("KQ_POOR_DISTRIBUTION");
  });

  it("monotonic: higher distribution → higher overall score (all else equal)", () => {
    const low  = scorer.score(makeContext({ keywordDistributionScore: 0.0 }));
    const mid  = scorer.score(makeContext({ keywordDistributionScore: 0.4 }));
    const high = scorer.score(makeContext({ keywordDistributionScore: 1.0 }));
    expect(mid.score).toBeGreaterThan(low.score);
    expect(high.score).toBeGreaterThan(mid.score);
  });
});

// ─── Secondary keywords ───────────────────────────────────────────────────────

describe("KeywordQualityScorer — secondary keywords", () => {
  const scorer = new KeywordQualityScorer();

  it("no secondaries supplied → secondary contribution=100", () => {
    const result = scorer.score(makeContext({ secondaryKeywordCount: 0, secondaryKeywordCoverage: 0 }));
    expect(result.breakdown["secondary"]).toBe(100);
  });

  it("full secondary coverage → contribution=100", () => {
    const result = scorer.score(makeContext({ secondaryKeywordCount: 4, secondaryKeywordCoverage: 1.0 }));
    expect(result.breakdown["secondary"]).toBe(100);
  });

  it("low coverage with secondaries → KQ_SECONDARY_GAPS", () => {
    const result = scorer.score(makeContext({ secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.25 }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_SECONDARY_GAPS");
  });

  it("good coverage (≥0.5) → no KQ_SECONDARY_GAPS", () => {
    const result = scorer.score(makeContext({ secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.75 }));
    expect(result.recommendations.map(r => r.code)).not.toContain("KQ_SECONDARY_GAPS");
  });
});

// ─── Semantic variants ────────────────────────────────────────────────────────

describe("KeywordQualityScorer — semantic variants", () => {
  const scorer = new KeywordQualityScorer();

  it("no variants supplied → semantic contribution=100", () => {
    const result = scorer.score(makeContext({ semanticVariantCount: 0, semanticVariantCoverage: 0 }));
    expect(result.breakdown["semantic"]).toBe(100);
  });

  it("full variant coverage → contribution=100", () => {
    const result = scorer.score(makeContext({ semanticVariantCount: 3, semanticVariantCoverage: 1.0 }));
    expect(result.breakdown["semantic"]).toBe(100);
  });

  it("low variant coverage → KQ_VARIANT_GAPS", () => {
    const result = scorer.score(makeContext({ semanticVariantCount: 4, semanticVariantCoverage: 0.25 }));
    expect(result.recommendations.map(r => r.code)).toContain("KQ_VARIANT_GAPS");
  });

  it("good variant coverage (≥0.5) → no KQ_VARIANT_GAPS", () => {
    const result = scorer.score(makeContext({ semanticVariantCount: 4, semanticVariantCoverage: 0.75 }));
    expect(result.recommendations.map(r => r.code)).not.toContain("KQ_VARIANT_GAPS");
  });
});

// ─── Recommendations deduplication ───────────────────────────────────────────

describe("KeywordQualityScorer — recommendation deduplication", () => {
  const scorer = new KeywordQualityScorer();

  it("each recommendation code appears at most once", () => {
    const result = scorer.score(makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 0.3,
      primaryKeywordInTitle: false, primaryKeywordInH1: false,
      primaryKeywordInMeta: false, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      keywordDistributionScore: 0.1,
      secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.1,
      semanticVariantCount: 4, semanticVariantCoverage: 0.1,
    }));
    const codes = result.recommendations.map(r => r.code);
    const unique = new Set(codes);
    expect(codes.length).toBe(unique.size);
  });
});

// ─── Monotonicity ─────────────────────────────────────────────────────────────

describe("KeywordQualityScorer — monotonicity", () => {
  const scorer = new KeywordQualityScorer();

  it("more placement zones covered → higher score", () => {
    const none = scorer.score(makeContext({ primaryKeywordInTitle: false, primaryKeywordInH1: false, primaryKeywordInMeta: false, primaryKeywordInIntro: false, primaryKeywordInFaq: false, primaryKeywordInSlug: false }));
    const some = scorer.score(makeContext({ primaryKeywordInTitle: true,  primaryKeywordInH1: true,  primaryKeywordInMeta: false, primaryKeywordInIntro: false, primaryKeywordInFaq: false, primaryKeywordInSlug: false }));
    const all  = scorer.score(makeContext({ primaryKeywordInTitle: true,  primaryKeywordInH1: true,  primaryKeywordInMeta: true,  primaryKeywordInIntro: true,  primaryKeywordInFaq: true,  primaryKeywordInSlug: true  }));
    expect(some.score).toBeGreaterThan(none.score);
    expect(all.score).toBeGreaterThan(some.score);
  });

  it("better distribution → higher score (all else equal)", () => {
    const low  = scorer.score(makeContext({ keywordDistributionScore: 0.0 }));
    const high = scorer.score(makeContext({ keywordDistributionScore: 1.0 }));
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("better secondary coverage → higher score", () => {
    const low  = scorer.score(makeContext({ secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.0 }));
    const high = scorer.score(makeContext({ secondaryKeywordCount: 4, secondaryKeywordCoverage: 1.0 }));
    expect(high.score).toBeGreaterThan(low.score);
  });
});

// ─── Realistic fixtures ───────────────────────────────────────────────────────

describe("KeywordQualityScorer — realistic fixtures", () => {
  const scorer = new KeywordQualityScorer();

  it("fixture A: no keyword configured → score ≤ 10", () => {
    const ctx = makeContext({
      primaryKeywordPresent: false,
      primaryKeywordDensity: 0,
      primaryKeywordInTitle: false, primaryKeywordInH1: false,
      primaryKeywordInMeta: false, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
      keywordDistributionScore: 0, keywordSpread: 0,
    });
    expect(scorer.score(ctx).score).toBeLessThanOrEqual(10);
  });

  it("fixture B: keyword in title only, low density → score in [20, 45]", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 0.4,
      primaryKeywordInTitle: true, primaryKeywordInH1: false,
      primaryKeywordInMeta: false, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
      keywordDistributionScore: 0.2, keywordSpread: 0.1,
    });
    const { score } = scorer.score(ctx);
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThanOrEqual(45);
  });

  it("fixture C: keyword in title+H1+meta, good density → score in [60, 85]", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 1.5,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: true, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
      keywordDistributionScore: 0.6, keywordSpread: 0.5,
    });
    const { score } = scorer.score(ctx);
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThanOrEqual(85);
  });

  it("fixture D: stuffing (density>4) → score < 75 regardless of placement", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 6.0,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: true, primaryKeywordInIntro: true,
      primaryKeywordInFaq: true, primaryKeywordInSlug: true,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
      keywordDistributionScore: 1.0, keywordSpread: 1.0,
    });
    expect(scorer.score(ctx).score).toBeLessThan(75);
  });

  it("fixture E: great placement, good density, poor distribution → score in [55, 80]", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 1.5,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: true, primaryKeywordInIntro: true,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.5,
      semanticVariantCount: 0,
      keywordDistributionScore: 0.2, keywordSpread: 0.1,
    });
    const { score } = scorer.score(ctx);
    expect(score).toBeGreaterThanOrEqual(55);
    expect(score).toBeLessThanOrEqual(80);
  });

  it("fixture F: perfect targeting, partial secondary → score in [85, 100]", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 2.0,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: true, primaryKeywordInIntro: true,
      primaryKeywordInFaq: true, primaryKeywordInSlug: true,
      secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.75,
      semanticVariantCount: 2, semanticVariantCoverage: 1.0,
      keywordDistributionScore: 1.0, keywordSpread: 1.0,
    });
    const { score } = scorer.score(ctx);
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── Golden vectors ───────────────────────────────────────────────────────────

describe("KeywordQualityScorer — golden vectors", () => {
  const scorer = new KeywordQualityScorer();

  /**
   * GV-1: Primary keyword completely absent.
   *
   * placement:    (0×30+0×20+0×20+0×15+0×10+0×5)/100 = 0
   * density:      piecewise(0) = 0
   * distribution: piecewise(0) = 0
   * spread:       piecewise(0) = 0
   * secondary:    100 (no secondaries)
   * semantic:     100 (no variants)
   * rawScore:     (0×35+0×20+0×20+0×10+100×10+100×5)/100 = 15
   * penalties:    0
   * cap:          10 (primaryKeywordPresent=false)
   * finalScore:   min(15, 10) = 10
   */
  it("GV-1: absent keyword → score=10", () => {
    const ctx = makeContext({
      primaryKeywordPresent: false,
      primaryKeywordDensity: 0,
      primaryKeywordInTitle: false, primaryKeywordInH1: false,
      primaryKeywordInMeta: false, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
      keywordDistributionScore: 0, keywordSpread: 0,
    });
    expect(scorer.score(ctx).score).toBe(10);
  });

  /**
   * GV-2: Perfect keyword targeting.
   *
   * placement:    (100×30+100×20+100×20+100×15+100×10+100×5)/100 = 100
   * density:      piecewise(2.0) = 100  (plateau [1.5,100]–[2.5,100])
   * distribution: piecewise(1.0) = 100
   * spread:       piecewise(1.0) = 100
   * secondary:    100 (coverage=1.0, count=3)
   * semantic:     100 (coverage=1.0, count=2)
   * rawScore:     (100×35+100×20+100×20+100×10+100×10+100×5)/100 = 100
   * penalties:    0
   * cap:          none
   * finalScore:   100
   */
  it("GV-2: perfect targeting → score=100", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 2.0,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: true, primaryKeywordInIntro: true,
      primaryKeywordInFaq: true, primaryKeywordInSlug: true,
      secondaryKeywordCount: 3, secondaryKeywordCoverage: 1.0,
      semanticVariantCount: 2, semanticVariantCoverage: 1.0,
      keywordDistributionScore: 1.0, keywordSpread: 1.0,
    });
    expect(scorer.score(ctx).score).toBe(100);
  });

  /**
   * GV-3: Good targeting with some gaps.
   *
   * placement:    (100×30+100×20+100×20+100×15+0×10+0×5)/100 = 85
   * density:      piecewise(1.5) = 100  (breakpoint [1.5,100])
   * distribution: piecewise(0.6) = 85   (breakpoint [0.6,85])
   * spread:       piecewise(0.7) = 80+(2/3)×20 = 93.3333...
   * secondary:    piecewise(0.5, count=4) = 70  (breakpoint [0.5,70])
   * semantic:     100 (semanticVariantCount=0)
   * rawScore:     (85×35+100×20+85×20+93.3333×10+70×10+100×5)/100
   *               = (2975+2000+1700+933.333+700+500)/100
   *               = 8808.333/100 = 88.08333...
   * penalties:    0
   * cap:          none
   * finalScore:   roundScore(88.08333) = 88.08
   */
  it("GV-3: good targeting, some gaps → score=88.08", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 1.5,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: true, primaryKeywordInIntro: true,
      primaryKeywordInFaq: false, primaryKeywordInSlug: false,
      secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.5,
      semanticVariantCount: 0, semanticVariantCoverage: 0,
      keywordDistributionScore: 0.6, keywordSpread: 0.7,
    });
    expect(scorer.score(ctx).score).toBe(88.08);
  });

  /**
   * GV-4: Keyword stuffing scenario.
   *
   * placement:    (100×30+100×20+0×20+100×15+0×10+100×5)/100 = 70
   * density:      piecewise(5.5) = 0   (right-clamp at [5.0,0])
   * distribution: piecewise(1.0) = 100
   * spread:       piecewise(1.0) = 100
   * secondary:    100 (count=0)
   * semantic:     100 (count=0)
   * rawScore:     (70×35+0×20+100×20+100×10+100×10+100×5)/100
   *               = (2450+0+2000+1000+1000+500)/100 = 6950/100 = 69.5
   * penalties:    10  (density 5.5% > 4.0% threshold)
   * postPenalty:  59.5
   * cap:          none
   * finalScore:   59.5
   */
  it("GV-4: keyword stuffing (density=5.5%) → score=59.5", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 5.5,
      primaryKeywordInTitle: true, primaryKeywordInH1: true,
      primaryKeywordInMeta: false, primaryKeywordInIntro: true,
      primaryKeywordInFaq: false, primaryKeywordInSlug: true,
      secondaryKeywordCount: 0, semanticVariantCount: 0,
      keywordDistributionScore: 1.0, keywordSpread: 1.0,
    });
    expect(scorer.score(ctx).score).toBe(59.5);
  });

  /**
   * GV-5: Moderate targeting with poor distribution.
   *
   * placement:    (100×30+0×20+100×20+0×15+0×10+100×5)/100 = 55
   * density:      piecewise(1.0) = 80   (breakpoint [1.0,80])
   * distribution: piecewise(0.2) = 30   (breakpoint [0.2,30])
   * spread:       piecewise(0.2) = 40   (breakpoint [0.2,40])
   * secondary:    piecewise(0.25, count=4) = 40  (breakpoint [0.25,40])
   * semantic:     100 (semanticVariantCount=0)
   * rawScore:     (55×35+80×20+30×20+40×10+40×10+100×5)/100
   *               = (1925+1600+600+400+400+500)/100 = 5425/100 = 54.25
   * penalties:    0
   * cap:          none
   * finalScore:   54.25
   */
  it("GV-5: moderate targeting, poor distribution → score=54.25", () => {
    const ctx = makeContext({
      primaryKeywordPresent: true,
      primaryKeywordDensity: 1.0,
      primaryKeywordInTitle: true, primaryKeywordInH1: false,
      primaryKeywordInMeta: true, primaryKeywordInIntro: false,
      primaryKeywordInFaq: false, primaryKeywordInSlug: true,
      secondaryKeywordCount: 4, secondaryKeywordCoverage: 0.25,
      semanticVariantCount: 0, semanticVariantCoverage: 0,
      keywordDistributionScore: 0.2, keywordSpread: 0.2,
    });
    expect(scorer.score(ctx).score).toBe(54.25);
  });
});

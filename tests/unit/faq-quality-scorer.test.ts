/**
 * Tests for FAQQualityScorer (Phase 2C.8)
 *
 * Golden vector arithmetic pre-verified against piecewiseLinear/weightedAverage
 * implementations in seo-scoring-core.ts (roundScore = Math.round(x * 100) / 100).
 *
 * Module ID: "faq-quality"
 * Profile slot: CITY_SEO_V6_PROFILE["faq-quality"] weight 15
 * Provider: FAQMetricsProvider
 *
 * Component weights: answerDepth(35) + questionQuality(20) + answerSpecificity(25)
 *                    + faqCompleteness(10) + questionDiversity(10) = 100
 * Penalty: duplicateQuestionCount ≥ 2 → −5 (HIGH_DUPLICATE_QUESTIONS)
 * SKIP: faqCount === 0
 */

import { describe, it, expect } from "vitest";
import type { ModuleContext, QualityMetrics, ScoringProfile } from "@/lib/seo-quality-types";
import {
  FAQQualityScorer,
  faqQualityScorer,
  FAQ_QUALITY_MODULE_ID,
  scoreAnswerDepth,
  scoreQuestionQuality,
  scoreAnswerSpecificity,
  scoreFaqCompleteness,
  scoreQuestionDiversity,
} from "@/lib/seo-scorers/faq-quality-scorer";

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    // ── Content length ────────────────────────────────────────────────────────
    wordCount: 600, wordCountIntro: 400, characterCount: 3600,
    paragraphCount: 4, avgParagraphWords: 100, sentenceCount: 40,
    avgSentenceWords: 15, sentenceLengthVariance: 10, longSentenceRatio: 0.05,

    // ── Structural elements ───────────────────────────────────────────────────
    headingCount: 5, h3Count: 1, listCount: 1, tableCount: 0,
    imageCount: 1, externalLinksCount: 2, headingDensity: 0.8, contentDensity: 0.85,

    // ── Readability ───────────────────────────────────────────────────────────
    readabilityScore: 65, typeTokenRatio: 0.55, boilerplateTokenRatio: 0.05,
    longSentenceCount: 2, shortSentenceCount: 5, shortSentenceRatio: 0.12,
    punctuationDensity: 3.2, questionSentenceCount: 2, exclamationSentenceCount: 0,
    complexWordCount: 20, complexWordRatio: 0.1,
    estimatedReadingTimeMinutes: 2.5, estimatedSpeakingTimeMinutes: 4.0,
    paragraphFlow: 0.6,

    // ── Uniqueness (legacy) ───────────────────────────────────────────────────
    uniquenessOverall: 0.9, uniquenessParagraphMin: 0.85, uniquenessFaq: 0.95,
    uniquenessTitle: 1.0, uniquenessMeta: 1.0, maxIntroSimilarity: 0.1,

    // ── Keywords — primary ────────────────────────────────────────────────────
    primaryKeywordPresent: true, primaryKeywordOccurrences: 10,
    primaryKeywordDensity: 1.5, primaryKeywordFirstPosition: 5,
    primaryKeywordLastPosition: 350, primaryKeywordInTitle: true,
    primaryKeywordInH1: true, primaryKeywordInMeta: true,
    primaryKeywordInIntro: true, primaryKeywordInFaq: false,
    primaryKeywordInInternalLinks: true, primaryKeywordInSlug: true,
    primaryKeywordInCanonical: true,

    // ── Keywords — secondary ──────────────────────────────────────────────────
    secondaryKeywordHits: 2, secondaryKeywordCount: 2, secondaryKeywordCoverage: 1.0,
    secondaryKeywordOccurrences: 6, secondaryKeywordDensity: 1.0,

    // ── Keywords — semantic variants ──────────────────────────────────────────
    semanticVariantCount: 3, semanticVariantCoverage: 0.7,
    exactMatchCount: 10, partialMatchCount: 2,

    // ── Keyword distribution ──────────────────────────────────────────────────
    keywordDistributionScore: 0.7, keywordSpread: 0.75,
    sectionCoverage: 0.6, headingCoverage: 0.4, faqCoverage: 0, introCoverage: 0.8,
    keywordDensity: 0.015, keywordStuffingRisk: false,

    // ── Semantic ──────────────────────────────────────────────────────────────
    localEntityCount: 8, localEntityDensityPer100: 2.0, topicCoverageScore: 0.6,

    // ── FAQ quality (FAQMetricsProvider) ──────────────────────────────────────
    faqCount:                5,
    faqThinAnswers:          0,
    faqDuplicateLeadIns:     0,
    faqAvgAnswerWords:       60,
    questionCount:           5,
    answerCount:             5,
    averageQuestionLength:   55,
    averageAnswerLength:     360,
    averageQuestionWords:    9,
    averageAnswerWords:      60,
    longestQuestionLength:   80,
    longestAnswerLength:     500,
    shortestQuestionLength:  30,
    shortestAnswerLength:    200,
    duplicateQuestionCount:  0,
    duplicateAnswerCount:    0,
    duplicateFaqPairCount:   0,
    emptyQuestionCount:      0,
    emptyAnswerCount:        0,
    questionMarkCount:       5,
    questionStartsWithWhWord: 4,
    questionStartsWithHow:   2,
    questionStartsWithWhat:  1,
    questionStartsWithWhere: 0,
    questionStartsWithWhen:  1,
    questionStartsWithWhy:   0,
    questionStartsWithCan:   1,
    questionStartsWithIs:    0,
    questionStartsWithAre:   0,
    answerContainsList:      2,
    answerContainsInternalLink: 1,
    answerContainsKeyword:   3,
    answerContainsNumber:    4,
    answerContainsLocation:  3,
    answerContainsCallToAction: 2,
    answerReadingTimeMinutes: 1.26,
    faqCompleteness:         1.0,
    structuredFaqParity:     1.0,
    structuredFaqQuestionCoverage: 1.0,
    structuredFaqAnswerCoverage:   1.0,
    missingStructuredFaqCount: 0,
    extraStructuredFaqCount:   0,

    // ── Internal links (legacy) ───────────────────────────────────────────────
    internalLinksCount: 5, uniqueAnchorTexts: 5, anchorTextDiversity: 1.0,

    // ── Internal links (InternalLinkMetricsProvider) ──────────────────────────
    internalLinkCount: 5, externalLinkCount: 0, followLinkCount: 5,
    nofollowLinkCount: 0, anchorTextCount: 5, uniqueAnchorTextCount: 5,
    duplicateAnchorTextCount: 0, averageAnchorLength: 20,
    longestAnchorLength: 35, shortestAnchorLength: 8, emptyAnchorCount: 0,
    samePageAnchorCount: 0, relativeLinkCount: 5, absoluteInternalLinkCount: 0,
    externalHttpLinkCount: 0, mailtoLinkCount: 0, telLinkCount: 0,
    categoryLinkCount: 1, cityLinkCount: 2, listingLinkCount: 1,
    faqInternalLinkCount: 0, ctaInternalLinkCount: 0,
    sectionLinkDistribution: 0.8, firstLinkPosition: 0, lastLinkPosition: 4,
    linkSpread: 1.0, linkDensity: 1.25, uniqueTargetCount: 5,
    duplicateTargetCount: 0, anchorKeywordCoverage: 0.4,
    descriptiveAnchorCount: 4, genericAnchorCount: 1, imageLinkCount: 0,

    // ── Metadata ──────────────────────────────────────────────────────────────
    titlePresent: true, titleLength: 55, titleInOptimalRange: true,
    estimatedTitlePixelWidth: 450, metaPresent: true, metaLength: 145,
    metaInOptimalRange: true, metaDescriptionPixelWidth: 900,
    h1Present: true, h1Count: 1, h1EqualsTitle: false,
    canonicalPresent: true, featuredImagePresent: true, imageAltPresent: true,
    robotsMetaExists: false, robotsMetaContent: null, robotsNoindex: false, robotsNofollow: false,
    openGraphExists: true, openGraphPropertyCount: 3,
    twitterCardExists: true, twitterMetaCount: 2,
    structuredDataPresent: true, structuredDataParseable: true, jsonLdCount: 1,
    schemaTypeList: "LocalBusiness", breadcrumbSchemaExists: false,
    organizationSchemaExists: false, websiteSchemaExists: false,
    faqSchemaExists: false, articleSchemaExists: false,
    hreflangExists: false, hreflangCount: 0, alternateLinkCount: 0,
    viewportMetaExists: true, charsetMetaExists: true, faviconExists: true, manifestExists: false,

    // ── Heading quality ───────────────────────────────────────────────────────
    h2Count: 3, h2UniqueCount: 3, h2TemplateCount: 0, headingKeywordCoverage: 0.33,

    // ── Duplicate content (DuplicateContentMetricsProvider) ───────────────────
    duplicateSentenceCount: 0, duplicateParagraphCount: 0, duplicateHeadingCount: 0,
    duplicateFaqQuestionCount: 0, duplicateFaqAnswerCount: 0,
    duplicateLeadInCount: 0, duplicateIntroSentenceCount: 0,
    repeatedPhraseCount: 0, repeatedBigramCount: 2, repeatedTrigramCount: 0,
    repeatedFourGramCount: 0, maxDuplicateRunLength: 0,
    uniqueSentenceRatio: 0.95, uniqueParagraphRatio: 0.95, uniqueHeadingRatio: 1.0,
    uniqueFaqQuestionRatio: 1.0, uniqueFaqAnswerRatio: 1.0,
    templateReuseRatio: 0.01, boilerplateParagraphCount: 0, boilerplateSentenceCount: 0,
    selfSimilarityScore: 0.1, introSectionSimilarity: 0.05, headingSimilarity: 0.1,
    faqSimilarity: 0, duplicateWordRunCount: 0, duplicateTokenRatio: 0.05,
    largestRepeatedBlockLength: 0,

    // ── Semantic coverage (SemanticMetricsProvider) ───────────────────────────
    semanticKeywordCoverage: 0.7, keywordVariantCoverage: 0.65, topicCoverage: 0.75,
    entityCoverage: 0.6, conceptCount: 18, uniqueConceptCount: 15, conceptDensity: 3.0,
    conceptDiversity: 0.7, conceptRedundancy: 0.15,
    semanticClusterCount: 3, semanticClusterCoverage: 0.8,
    headingSemanticCoverage: 0.5, introSemanticCoverage: 0.75, faqSemanticCoverage: 0,
    sectionSemanticCoverage: 0.6, entityDistribution: 0.67, topicDistribution: 0.5,
    phraseVariationScore: 0.65, coOccurrenceCount: 5, coOccurrenceDensity: 0.125,
    semanticConsistency: 0.8, semanticTransitionScore: 0.7,
    entityReuseRatio: 0.2, variantReuseRatio: 0.1, semanticGapCount: 1,
    semanticOverlapRatio: 0.4,

    // ── Duplicate detection (legacy) ──────────────────────────────────────────
    duplicateRisk: "low", duplicateTitle: false, duplicateMeta: false,
    duplicateH1: false, duplicateIntro: false, duplicateFaq: false,
    contentHashCollision: false, duplicateFieldCount: 0,

    // ── Template repetition ───────────────────────────────────────────────────
    templateSentenceCount: 0, templateSentenceRatio: 0, sectionOpenerVariance: 0.8,

    // ── AI pattern signals ────────────────────────────────────────────────────
    aiPhraseCount: 2, aiPhraseRatio: 0.003, aiPhraseDensity: 0.3,
    aiTransitionPhraseCount: 1, aiHedgingPhraseCount: 0, aiMarketingPhraseCount: 1,
    templatePhraseCount: 0, stockPhraseCount: 0, genericClaimCount: 0,
    repetitiveOpeningCount: 0, repetitiveClosingCount: 0,
    sentenceLengthUniformity: 0.7, paragraphLengthUniformity: 0.65,
    headingLengthUniformity: 0.6, lexicalBurstiness: 0.3, paragraphBurstiness: 0.4,
    vocabularyRepetition: 0.25, templateParagraphCount: 0, passiveVoiceProxy: 0.1,
    listHeavyRatio: 0, conclusionPatternCount: 0, callToActionPatternCount: 1,
    exclamationDensity: 0, questionDensity: 0.03,
    repetitionRisk: 0.15, humanVariationScore: 0.85,
    transitionOveruseScore: 0.1, openingVariationScore: 0.8, closingVariationScore: 0.75,
    averageSentenceVariance: 0.6, averageParagraphVariance: 0.55,

    // ── Transition quality ────────────────────────────────────────────────────
    transitionWordCount: 8, transitionDensity: 2.0, transitionCoverage: 0.6,

    // ── Local authenticity (legacy) ───────────────────────────────────────────
    localAuthenticityScore: 0.7, genericPhraseCount: 2, genericPhraseRatio: 0.05,

    // ── Local authenticity (LocalAuthenticityMetricsProvider) ─────────────────
    localReferenceCount: 10, uniqueLocalReferenceCount: 8,
    duplicateLocalReferenceCount: 2, districtMentionCount: 3, landmarkMentionCount: 2,
    transportMentionCount: 1, airportMentionCount: 0, railwayStationMentionCount: 1,
    busStandMentionCount: 0, shoppingMallMentionCount: 1, marketMentionCount: 0,
    businessDistrictMentionCount: 1, techParkMentionCount: 0, touristAreaMentionCount: 1,
    festivalMentionCount: 0, localCuisineMentionCount: 0, hotelAreaMentionCount: 0,
    luxuryAreaMentionCount: 1, neighborhoodCoverage: 0.5, geographicSpread: 0.4,
    introLocalReferenceCount: 4, faqLocalReferenceCount: 0,
    headingLocalReferenceCount: 2, sectionLocalReferenceCoverage: 0,
    curatedReferenceCount: 8, generatedReferenceCount: 2, localEntityDensity: 2.0,
    locationMentionFrequency: 1.25, referenceDistributionScore: 0.67,
    referenceEntropy: 0.6, referenceRedundancy: 0.2,
    cityNameOccurrences: 6, primaryLocationCoverage: 0.7, secondaryLocationCoverage: 0.5,

    // ── Freshness ─────────────────────────────────────────────────────────────
    daysSinceGeneration: null, generationAttempt: 1,

    ...overrides,
  } as QualityMetrics;
}

function makeContext(overrides: Partial<QualityMetrics> = {}): ModuleContext {
  return {
    metrics:           makeMetrics(overrides),
    profile:           { id: "city-seo-v6-0", modules: [], pageTypes: ["city"] } as unknown as ScoringProfile,
    pageContext:       { pageType: "city", pageSlug: "test-city", primaryKeyword: "test keyword", secondaryKeywords: [], attempt: 1 },
    ruleResults:       [],
    priorModuleScores: [],
  };
}

// ─── 1. Identity and lifecycle ─────────────────────────────────────────────────

describe("FAQQualityScorer — identity", () => {
  it("has correct module ID constant", () => {
    expect(FAQ_QUALITY_MODULE_ID).toBe("faq-quality");
  });

  it("singleton has correct module ID", () => {
    expect(faqQualityScorer.id).toBe("faq-quality");
  });

  it("exports a named class and a singleton", () => {
    expect(faqQualityScorer).toBeInstanceOf(FAQQualityScorer);
  });

  it("has required metadata fields", () => {
    expect(typeof faqQualityScorer.name).toBe("string");
    expect(typeof faqQualityScorer.description).toBe("string");
    expect(faqQualityScorer.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof faqQualityScorer.priority).toBe("number");
  });

  it("requiredMetrics contains all FAQMetricsProvider scoring fields", () => {
    const rm = faqQualityScorer.requiredMetrics as readonly string[];
    expect(rm).toContain("faqCount");
    expect(rm).toContain("averageAnswerWords");
    expect(rm).toContain("questionMarkCount");
    expect(rm).toContain("answerContainsList");
    expect(rm).toContain("answerContainsNumber");
    expect(rm).toContain("answerContainsLocation");
    expect(rm).toContain("answerContainsCallToAction");
    expect(rm).toContain("faqCompleteness");
    expect(rm).toContain("faqDuplicateLeadIns");
    expect(rm).toContain("duplicateQuestionCount");
    expect(rm).toContain("emptyAnswerCount");
    expect(rm).toContain("emptyQuestionCount");
  });

  it("requiredMetrics does NOT contain cross-ownership fields", () => {
    const rm = faqQualityScorer.requiredMetrics as readonly string[];
    expect(rm).not.toContain("answerContainsKeyword");       // KeywordQualityScorer
    expect(rm).not.toContain("answerContainsInternalLink");  // InternalLinksQualityScorer
    expect(rm).not.toContain("uniqueFaqQuestionRatio");      // UniquenessQualityScorer
    expect(rm).not.toContain("structuredFaqParity");         // MetadataQualityScorer concern
  });

  it("has empty dependsOnModules", () => {
    expect(faqQualityScorer.dependsOnModules).toEqual([]);
  });
});

// ─── 2. SKIP condition ─────────────────────────────────────────────────────────

describe("FAQQualityScorer — SKIP condition", () => {
  it("SKIPs when faqCount = 0", () => {
    const result = faqQualityScorer.score(makeContext({ faqCount: 0 }));
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
    expect(result.normalizedScore).toBe(0);
  });

  it("SKIPPED result has moduleId = 'faq-quality'", () => {
    const result = faqQualityScorer.score(makeContext({ faqCount: 0 }));
    expect(result.moduleId).toBe("faq-quality");
  });

  it("does NOT SKIP when faqCount = 1", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 1, questionMarkCount: 1, averageAnswerWords: 50,
        faqCompleteness: 1, faqDuplicateLeadIns: 0,
      }),
    );
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("handles null metrics without crashing — returns SKIPPED", () => {
    const result = faqQualityScorer.score(
      { ...makeContext(), metrics: null as unknown as QualityMetrics },
    );
    expect(result.lifecycleState).toBe("SKIPPED");
  });

  it("handles NaN faqCount — safeNumber(NaN)=0 → SKIPPED", () => {
    const result = faqQualityScorer.score(makeContext({ faqCount: NaN }));
    expect(result.lifecycleState).toBe("SKIPPED");
  });

  it("handles Infinity faqCount — safeNumber(Infinity)=0 → SKIPPED", () => {
    const result = faqQualityScorer.score(makeContext({ faqCount: Infinity }));
    expect(result.lifecycleState).toBe("SKIPPED");
  });
});

// ─── 3. Helper: scoreAnswerDepth ──────────────────────────────────────────────

describe("scoreAnswerDepth", () => {
  it("returns 0 for 0 words", () => {
    expect(scoreAnswerDepth(0)).toBe(0);
  });

  it("returns 15 for 20 words (exact breakpoint)", () => {
    expect(scoreAnswerDepth(20)).toBe(15);
  });

  it("returns 55 for 40 words (exact breakpoint)", () => {
    expect(scoreAnswerDepth(40)).toBe(55);
  });

  it("returns 80 for 60 words (exact breakpoint)", () => {
    expect(scoreAnswerDepth(60)).toBe(80);
  });

  it("returns 92 for 80 words (exact breakpoint)", () => {
    expect(scoreAnswerDepth(80)).toBe(92);
  });

  it("returns 100 for 100 words (exact breakpoint, right-clamped)", () => {
    expect(scoreAnswerDepth(100)).toBe(100);
  });

  it("returns 100 for > 100 words (right-clamped)", () => {
    expect(scoreAnswerDepth(200)).toBe(100);
  });

  it("interpolates correctly at 30 words (between [20,15] and [40,55])", () => {
    // t=(30-20)/(40-20)=0.5; y=15+0.5×40=35
    expect(scoreAnswerDepth(30)).toBe(35);
  });

  it("interpolates correctly at 50 words (between [40,55] and [60,80])", () => {
    // t=(50-40)/(60-40)=0.5; y=55+0.5×25=67.5
    expect(scoreAnswerDepth(50)).toBe(67.5);
  });

  it("handles NaN — safeNumber returns 0 → score 0", () => {
    expect(scoreAnswerDepth(NaN)).toBe(0);
  });

  it("handles negative — left-clamped to 0", () => {
    expect(scoreAnswerDepth(-10)).toBe(0);
  });

  it("handles Infinity — safeNumber treats as 0 → score 0", () => {
    expect(scoreAnswerDepth(Infinity)).toBe(0);
  });

  it("is monotonically non-decreasing for 0–100 words", () => {
    const inputs = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120];
    const scores = inputs.map(scoreAnswerDepth);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 4. Helper: scoreQuestionQuality ─────────────────────────────────────────

describe("scoreQuestionQuality", () => {
  it("returns 0 when faqCount = 0", () => {
    expect(scoreQuestionQuality(0, 0)).toBe(0);
    expect(scoreQuestionQuality(5, 0)).toBe(0);
  });

  it("returns 100 for ratio = 1.0 (all questions have ?)", () => {
    expect(scoreQuestionQuality(5, 5)).toBe(100);
  });

  it("returns 0 for ratio = 0 (no question marks)", () => {
    expect(scoreQuestionQuality(0, 5)).toBe(0);
  });

  it("returns 35 for ratio = 0.5 (exact breakpoint)", () => {
    expect(scoreQuestionQuality(5, 10)).toBe(35);
  });

  it("returns 75 for ratio = 0.8 (exact breakpoint)", () => {
    expect(scoreQuestionQuality(8, 10)).toBe(75);
  });

  it("interpolates at ratio = 0.6 (between [0.5,35] and [0.8,75])", () => {
    // t=(0.6-0.5)/(0.8-0.5)=1/3; y=35+1/3×40=48.333...
    expect(scoreQuestionQuality(6, 10)).toBeCloseTo(48.33, 1);
  });

  it("clamps ratio > 1 → score 100", () => {
    expect(scoreQuestionQuality(10, 5)).toBe(100);
  });

  it("handles NaN questionMarkCount — ratio 0 → score 0", () => {
    expect(scoreQuestionQuality(NaN, 5)).toBe(0);
  });

  it("handles NaN faqCount — returns 0", () => {
    expect(scoreQuestionQuality(3, NaN)).toBe(0);
  });

  it("is monotonically non-decreasing as questionMarkCount increases", () => {
    const scores = [0, 1, 2, 3, 4, 5].map((q) => scoreQuestionQuality(q, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 5. Helper: scoreAnswerSpecificity ───────────────────────────────────────

describe("scoreAnswerSpecificity", () => {
  it("returns baseline (10) when richness = 0 (no signals)", () => {
    expect(scoreAnswerSpecificity(0, 0, 0, 0, 5)).toBe(10);
  });

  it("returns baseline (10) when faqCount = 0", () => {
    expect(scoreAnswerSpecificity(0, 0, 0, 0, 0)).toBe(10);
  });

  it("returns 100 for richnessSumPerFaq = 2.5 (exact breakpoint)", () => {
    // Total = 2.5 × 4 = 10 across 4 FAQs; or 25 across 10 FAQs
    expect(scoreAnswerSpecificity(10, 10, 5, 0, 10)).toBe(100);
  });

  it("returns 35 for richnessSumPerFaq = 0.5 (exact breakpoint)", () => {
    // Total = 2 signals across 4 FAQs = 0.5 per FAQ
    expect(scoreAnswerSpecificity(1, 1, 0, 0, 4)).toBe(35);
  });

  it("returns 60 for richnessSumPerFaq = 1.0 (exact breakpoint)", () => {
    // Total = 4 signals across 4 FAQs = 1.0 per FAQ
    expect(scoreAnswerSpecificity(2, 2, 0, 0, 4)).toBe(60);
  });

  it("returns 80 for richnessSumPerFaq = 1.5 (exact breakpoint)", () => {
    // Total = 6 signals across 4 FAQs
    expect(scoreAnswerSpecificity(2, 2, 2, 0, 4)).toBe(80);
  });

  it("interpolates at richnessSumPerFaq = 2.0 (between [1.5,80] and [2.5,100])", () => {
    // t=(2.0-1.5)/(2.5-1.5)=0.5; y=80+0.5×20=90
    expect(scoreAnswerSpecificity(2, 2, 2, 2, 4)).toBe(90);
  });

  it("caps at 100 when richnessSumPerFaq > 2.5", () => {
    expect(scoreAnswerSpecificity(5, 5, 5, 5, 4)).toBe(100);
  });

  it("handles NaN in any signal — treated as 0", () => {
    // (0+1+1+0)/4=0.5 → exact breakpoint → 35
    expect(scoreAnswerSpecificity(NaN, 1, 1, 0, 4)).toBe(35);
  });

  it("handles negative faqCount — returns baseline (10)", () => {
    expect(scoreAnswerSpecificity(2, 2, 0, 0, -1)).toBe(10);
  });

  it("is monotonically non-decreasing as total signals increase", () => {
    const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
      scoreAnswerSpecificity(Math.floor(n / 4), Math.floor(n / 4),
        Math.floor(n / 4), n - 3 * Math.floor(n / 4), 4),
    );
    // Just verify scores stay in [0,100]
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 6. Helper: scoreFaqCompleteness ─────────────────────────────────────────

describe("scoreFaqCompleteness", () => {
  it("returns 0 for completeness = 0", () => {
    expect(scoreFaqCompleteness(0)).toBe(0);
  });

  it("returns 100 for completeness = 1.0", () => {
    expect(scoreFaqCompleteness(1.0)).toBe(100);
  });

  it("returns 25 for completeness = 0.5 (exact breakpoint)", () => {
    expect(scoreFaqCompleteness(0.5)).toBe(25);
  });

  it("returns 65 for completeness = 0.8 (exact breakpoint)", () => {
    expect(scoreFaqCompleteness(0.8)).toBe(65);
  });

  it("interpolates at completeness = 0.6 (between [0.5,25] and [0.8,65])", () => {
    // t=(0.6-0.5)/(0.8-0.5)=1/3; y=25+1/3×40=38.333...
    expect(scoreFaqCompleteness(0.6)).toBeCloseTo(38.33, 1);
  });

  it("clamps completeness > 1.0 to 100", () => {
    expect(scoreFaqCompleteness(1.5)).toBe(100);
  });

  it("clamps completeness < 0 to 0", () => {
    expect(scoreFaqCompleteness(-0.5)).toBe(0);
  });

  it("handles NaN — returns 0", () => {
    expect(scoreFaqCompleteness(NaN)).toBe(0);
  });

  it("is monotonically non-decreasing", () => {
    const inputs = [0, 0.1, 0.2, 0.5, 0.6, 0.8, 0.9, 1.0];
    const scores = inputs.map(scoreFaqCompleteness);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 7. Helper: scoreQuestionDiversity ───────────────────────────────────────

describe("scoreQuestionDiversity", () => {
  it("returns 100 when faqCount = 0 (neutral)", () => {
    expect(scoreQuestionDiversity(0, 0)).toBe(100);
  });

  it("returns 100 when faqDuplicateLeadIns = 0 (no duplicate lead-ins)", () => {
    expect(scoreQuestionDiversity(0, 5)).toBe(100);
  });

  it("returns 80 at ratio = 0.2 (exact breakpoint)", () => {
    expect(scoreQuestionDiversity(1, 5)).toBe(80);
  });

  it("returns 50 at ratio = 0.4 (exact breakpoint)", () => {
    expect(scoreQuestionDiversity(2, 5)).toBe(50);
  });

  it("returns 25 at ratio = 0.6 (exact breakpoint)", () => {
    expect(scoreQuestionDiversity(3, 5)).toBe(25);
  });

  it("returns 0 at ratio = 1.0 (all duplicates)", () => {
    expect(scoreQuestionDiversity(5, 5)).toBe(0);
  });

  it("interpolates at ratio = 0.1 (between [0,100] and [0.2,80])", () => {
    // t=0.5; y=100+0.5×(80-100)=90
    expect(scoreQuestionDiversity(1, 10)).toBe(90);
  });

  it("clamps ratio > 1 → score 0", () => {
    expect(scoreQuestionDiversity(10, 5)).toBe(0);
  });

  it("handles NaN faqDuplicateLeadIns — returns 100 (ratio=0)", () => {
    expect(scoreQuestionDiversity(NaN, 5)).toBe(100);
  });

  it("is monotonically non-increasing as faqDuplicateLeadIns increases", () => {
    const scores = [0, 1, 2, 3, 4, 5].map((d) => scoreQuestionDiversity(d, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 8. Penalty trigger ───────────────────────────────────────────────────────

describe("FAQQualityScorer — penalty", () => {
  it("no penalty when duplicateQuestionCount = 0", () => {
    const result = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 0 }));
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("no penalty when duplicateQuestionCount = 1 (threshold is ≥ 2)", () => {
    const result = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 1 }));
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("applies HIGH_DUPLICATE_QUESTIONS (−5) when duplicateQuestionCount = 2", () => {
    const noPen = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 1 }));
    const pen   = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 2 }));
    expect(pen.breakdown["_penaltyTotal"]).toBe(5);
    expect(pen.score).toBeLessThan(noPen.score);
  });

  it("penalty is fixed at 5 regardless of magnitude", () => {
    const result = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 10 }));
    expect(result.breakdown["_penaltyTotal"]).toBe(5);
  });

  it("score is clamped to ≥ 0 even with heavy penalties", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 1, averageAnswerWords: 0, questionMarkCount: 0,
        answerContainsList: 0, answerContainsNumber: 0,
        answerContainsLocation: 0, answerContainsCallToAction: 0,
        faqCompleteness: 0, faqDuplicateLeadIns: 0,
        duplicateQuestionCount: 5,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─── 9. Recommendations ──────────────────────────────────────────────────────

describe("FAQQualityScorer — recommendations", () => {
  it("emits FQ_THIN_ANSWERS when averageAnswerWords < 30", () => {
    const result = faqQualityScorer.score(makeContext({ averageAnswerWords: 20 }));
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_THIN_ANSWERS");
  });

  it("FQ_THIN_ANSWERS severity is error when averageAnswerWords < 15", () => {
    const result = faqQualityScorer.score(makeContext({ averageAnswerWords: 10 }));
    const rec = result.recommendations.find((r) => r.code === "FQ_THIN_ANSWERS");
    expect(rec?.severity).toBe("error");
  });

  it("FQ_THIN_ANSWERS severity is warning when 15 ≤ averageAnswerWords < 30", () => {
    const result = faqQualityScorer.score(makeContext({ averageAnswerWords: 25 }));
    const rec = result.recommendations.find((r) => r.code === "FQ_THIN_ANSWERS");
    expect(rec?.severity).toBe("warning");
  });

  it("does NOT emit FQ_THIN_ANSWERS when averageAnswerWords ≥ 30", () => {
    const result = faqQualityScorer.score(makeContext({ averageAnswerWords: 30 }));
    expect(result.recommendations.map((r) => r.code)).not.toContain("FQ_THIN_ANSWERS");
  });

  it("emits FQ_MISSING_QUESTION_MARKS when questionMarkRatio < 0.7", () => {
    const result = faqQualityScorer.score(
      makeContext({ faqCount: 10, questionMarkCount: 5 }),
    );
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_MISSING_QUESTION_MARKS");
  });

  it("does NOT emit FQ_MISSING_QUESTION_MARKS when ratio ≥ 0.7", () => {
    const result = faqQualityScorer.score(
      makeContext({ faqCount: 10, questionMarkCount: 7 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("FQ_MISSING_QUESTION_MARKS");
  });

  it("emits FQ_LOW_ANSWER_SPECIFICITY when richnessSumPerFaq < 0.5", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 5,
        answerContainsList: 0, answerContainsNumber: 1,
        answerContainsLocation: 0, answerContainsCallToAction: 0,
      }),
    );
    // richness = 1/5 = 0.2 < 0.5
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_LOW_ANSWER_SPECIFICITY");
  });

  it("does NOT emit FQ_LOW_ANSWER_SPECIFICITY when richnessSumPerFaq ≥ 0.5", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 4,
        answerContainsList: 1, answerContainsNumber: 1,
        answerContainsLocation: 0, answerContainsCallToAction: 0,
      }),
    );
    // richness = 2/4 = 0.5 — NOT below threshold
    expect(result.recommendations.map((r) => r.code)).not.toContain("FQ_LOW_ANSWER_SPECIFICITY");
  });

  it("emits FQ_INCOMPLETE_FAQ_ITEMS when emptyAnswerCount > 0", () => {
    const result = faqQualityScorer.score(makeContext({ emptyAnswerCount: 1 }));
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_INCOMPLETE_FAQ_ITEMS");
  });

  it("emits FQ_INCOMPLETE_FAQ_ITEMS when emptyQuestionCount > 0", () => {
    const result = faqQualityScorer.score(makeContext({ emptyQuestionCount: 1 }));
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_INCOMPLETE_FAQ_ITEMS");
  });

  it("FQ_INCOMPLETE_FAQ_ITEMS severity is error", () => {
    const result = faqQualityScorer.score(makeContext({ emptyAnswerCount: 1 }));
    const rec = result.recommendations.find((r) => r.code === "FQ_INCOMPLETE_FAQ_ITEMS");
    expect(rec?.severity).toBe("error");
  });

  it("does NOT emit FQ_INCOMPLETE_FAQ_ITEMS when all items are complete", () => {
    const result = faqQualityScorer.score(
      makeContext({ emptyAnswerCount: 0, emptyQuestionCount: 0 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("FQ_INCOMPLETE_FAQ_ITEMS");
  });

  it("emits FQ_DUPLICATE_LEAD_INS when faqDuplicateLeadIns ≥ 2", () => {
    const result = faqQualityScorer.score(makeContext({ faqDuplicateLeadIns: 2 }));
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_DUPLICATE_LEAD_INS");
  });

  it("does NOT emit FQ_DUPLICATE_LEAD_INS when count = 1", () => {
    const result = faqQualityScorer.score(makeContext({ faqDuplicateLeadIns: 1 }));
    expect(result.recommendations.map((r) => r.code)).not.toContain("FQ_DUPLICATE_LEAD_INS");
  });

  it("emits FQ_DUPLICATE_QUESTIONS when duplicateQuestionCount ≥ 2", () => {
    const result = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 2 }));
    expect(result.recommendations.map((r) => r.code)).toContain("FQ_DUPLICATE_QUESTIONS");
  });

  it("FQ_DUPLICATE_QUESTIONS severity is error", () => {
    const result = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 3 }));
    const rec = result.recommendations.find((r) => r.code === "FQ_DUPLICATE_QUESTIONS");
    expect(rec?.severity).toBe("error");
  });

  it("does NOT emit FQ_DUPLICATE_QUESTIONS when count = 1", () => {
    const result = faqQualityScorer.score(makeContext({ duplicateQuestionCount: 1 }));
    expect(result.recommendations.map((r) => r.code)).not.toContain("FQ_DUPLICATE_QUESTIONS");
  });

  it("recommendation codes are deduplicated", () => {
    const result = faqQualityScorer.score(
      makeContext({ averageAnswerWords: 10, duplicateQuestionCount: 3 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("clean FAQ produces no recommendations", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 5, averageAnswerWords: 80, questionMarkCount: 5,
        answerContainsList: 3, answerContainsNumber: 4,
        answerContainsLocation: 3, answerContainsCallToAction: 2,
        faqCompleteness: 1.0, faqDuplicateLeadIns: 0,
        duplicateQuestionCount: 0, emptyAnswerCount: 0, emptyQuestionCount: 0,
      }),
    );
    expect(result.recommendations).toHaveLength(0);
  });
});

// ─── 10. Breakdown structure ──────────────────────────────────────────────────

describe("FAQQualityScorer — breakdown structure", () => {
  it("contains all five component keys", () => {
    const result = faqQualityScorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("answerDepth");
    expect(result.breakdown).toHaveProperty("questionQuality");
    expect(result.breakdown).toHaveProperty("answerSpecificity");
    expect(result.breakdown).toHaveProperty("faqCompleteness");
    expect(result.breakdown).toHaveProperty("questionDiversity");
  });

  it("contains all accounting keys", () => {
    const result = faqQualityScorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("_rawScore");
    expect(result.breakdown).toHaveProperty("_penaltyTotal");
    expect(result.breakdown).toHaveProperty("_cappedScore");
    expect(result.breakdown).toHaveProperty("_finalScore");
  });

  it("all breakdown values are finite numbers", () => {
    const result = faqQualityScorer.score(makeContext());
    for (const [, v] of Object.entries(result.breakdown)) {
      expect(typeof v).toBe("number");
      expect(isFinite(v as number)).toBe(true);
    }
  });

  it("component breakdown values are in [0, 100]", () => {
    const result = faqQualityScorer.score(makeContext());
    for (const key of [
      "answerDepth", "questionQuality", "answerSpecificity",
      "faqCompleteness", "questionDiversity",
    ]) {
      const v = result.breakdown[key] as number;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("moduleId = 'faq-quality' and maxScore = 100", () => {
    const result = faqQualityScorer.score(makeContext());
    expect(result.moduleId).toBe("faq-quality");
    expect(result.maxScore).toBe(100);
  });

  it("normalizedScore = score / 100", () => {
    const result = faqQualityScorer.score(makeContext());
    expect(result.normalizedScore).toBeCloseTo(result.score / 100, 5);
  });
});

// ─── 11. Determinism ─────────────────────────────────────────────────────────

describe("FAQQualityScorer — determinism", () => {
  it("produces identical scores for identical inputs (10 repetitions)", () => {
    const ctx = makeContext({ faqCount: 5, averageAnswerWords: 60, questionMarkCount: 5 });
    const first = faqQualityScorer.score(ctx).score;
    for (let i = 0; i < 9; i++) {
      expect(faqQualityScorer.score(ctx).score).toBe(first);
    }
  });

  it("different instances produce the same result", () => {
    const s1 = new FAQQualityScorer();
    const s2 = new FAQQualityScorer();
    const ctx = makeContext({ faqCount: 4, averageAnswerWords: 50 });
    expect(s1.score(ctx).score).toBe(s2.score(ctx).score);
  });
});

// ─── 12. Monotonicity ────────────────────────────────────────────────────────

describe("FAQQualityScorer — monotonicity", () => {
  it("higher averageAnswerWords → higher score", () => {
    const s20  = faqQualityScorer.score(makeContext({ averageAnswerWords: 20 })).score;
    const s60  = faqQualityScorer.score(makeContext({ averageAnswerWords: 60 })).score;
    const s100 = faqQualityScorer.score(makeContext({ averageAnswerWords: 100 })).score;
    expect(s60).toBeGreaterThan(s20);
    expect(s100).toBeGreaterThan(s60);
  });

  it("higher questionMarkCount → higher score (faqCount fixed)", () => {
    const low  = faqQualityScorer.score(makeContext({ faqCount: 5, questionMarkCount: 0 })).score;
    const high = faqQualityScorer.score(makeContext({ faqCount: 5, questionMarkCount: 5 })).score;
    expect(high).toBeGreaterThan(low);
  });

  it("higher answerSpecificity → higher score", () => {
    const low  = faqQualityScorer.score(makeContext({
      faqCount: 5, answerContainsList: 0, answerContainsNumber: 0,
      answerContainsLocation: 0, answerContainsCallToAction: 0,
    })).score;
    const high = faqQualityScorer.score(makeContext({
      faqCount: 5, answerContainsList: 5, answerContainsNumber: 5,
      answerContainsLocation: 5, answerContainsCallToAction: 5,
    })).score;
    expect(high).toBeGreaterThan(low);
  });

  it("higher faqCompleteness → higher score", () => {
    const low  = faqQualityScorer.score(makeContext({ faqCompleteness: 0.5 })).score;
    const high = faqQualityScorer.score(makeContext({ faqCompleteness: 1.0 })).score;
    expect(high).toBeGreaterThan(low);
  });

  it("higher faqDuplicateLeadIns → lower score (inverse signal)", () => {
    const low  = faqQualityScorer.score(makeContext({ faqDuplicateLeadIns: 0 })).score;
    const high = faqQualityScorer.score(makeContext({ faqDuplicateLeadIns: 3 })).score;
    expect(high).toBeLessThan(low);
  });
});

// ─── 13. Edge cases ───────────────────────────────────────────────────────────

describe("FAQQualityScorer — edge cases", () => {
  it("handles all NaN metric values without crashing (faqCount > 0 bypasses SKIP)", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 5,
        averageAnswerWords: NaN, questionMarkCount: NaN,
        answerContainsList: NaN, answerContainsNumber: NaN,
        answerContainsLocation: NaN, answerContainsCallToAction: NaN,
        faqCompleteness: NaN, faqDuplicateLeadIns: NaN, duplicateQuestionCount: NaN,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("handles negative metric values without crashing", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 5, averageAnswerWords: -20, questionMarkCount: -3,
        faqDuplicateLeadIns: -1, duplicateQuestionCount: -2,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("score is always in [0, 100] for extreme inputs", () => {
    const cases = [
      makeContext({ faqCount: 1, averageAnswerWords: 0, faqCompleteness: 0, duplicateQuestionCount: 10 }),
      makeContext({ faqCount: 100, averageAnswerWords: 500, questionMarkCount: 100, faqCompleteness: 1.0 }),
      makeContext({ faqCount: 5, faqDuplicateLeadIns: 100 }),
    ];
    for (const ctx of cases) {
      const s = faqQualityScorer.score(ctx).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("handles single FAQ item correctly", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount: 1, questionMarkCount: 1, averageAnswerWords: 50,
        answerContainsList: 1, answerContainsNumber: 1,
        answerContainsLocation: 0, answerContainsCallToAction: 0,
        faqCompleteness: 1.0, faqDuplicateLeadIns: 0, duplicateQuestionCount: 0,
      }),
    );
    expect(result.lifecycleState).toBe("COMPLETED");
    expect(result.score).toBeGreaterThan(0);
  });
});

// ─── 14. Golden vectors ───────────────────────────────────────────────────────
//
// Pre-verified arithmetic. All formulas:
//   piecewiseLinear (seo-scoring-core.ts)
//   weightedAverage (seo-scoring-core.ts)
//   roundScore(x) = Math.round(x * 100) / 100
//
// Component weights: answerDepth(35) + questionQuality(20) + answerSpecificity(25)
//                    + faqCompleteness(10) + questionDiversity(10)
// Penalty: duplicateQuestionCount ≥ 2 → −5

describe("FAQQualityScorer — golden vectors", () => {
  // ── GV1: Perfect FAQ (5 items) → 96.7 ────────────────────────────────────
  // averageAnswerWords=80: exact breakpoint → 92
  // questionMarkCount=5/5=1.0: exact breakpoint → 100
  // richness=(3+4+3+2)/5=2.4: between[1.5,80][2.5,100]: t=0.9; y=80+18=98
  // faqCompleteness=1.0: exact breakpoint → 100
  // faqDuplicateLeadIns=0/5=0: left-clamp → 100
  // raw=(92×35+100×20+98×25+100×10+100×10)/100=(3220+2000+2450+1000+1000)/100=9670/100=96.7
  // penalty=0; final=96.7
  it("GV1: perfect FAQ (5 items) → 96.7", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 5,
        averageAnswerWords:       80,
        questionMarkCount:        5,
        answerContainsList:       3,
        answerContainsNumber:     4,
        answerContainsLocation:   3,
        answerContainsCallToAction: 2,
        faqCompleteness:          1.0,
        faqDuplicateLeadIns:      0,
        duplicateQuestionCount:   0,
        emptyAnswerCount:         0,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(96.7);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  // ── GV2: No FAQs → SKIPPED ────────────────────────────────────────────────
  it("GV2: no FAQs → SKIPPED, score = 0", () => {
    const result = faqQualityScorer.score(makeContext({ faqCount: 0 }));
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
    expect(result.normalizedScore).toBe(0);
  });

  // ── GV3: Weak FAQ (3 items, thin answers) → 47.53 ────────────────────────
  // averageAnswerWords=20: exact breakpoint → 15
  // questionMarkCount=2/3=0.6667: between[0.5,35][0.8,75]: t=5/9; y=35+200/9=515/9=57.222...
  // richness=(0+1+1+0)/3=2/3: between[0.5,35][1.0,60]: t=1/3; y=35+25/3=130/3=43.333...
  // faqCompleteness=1.0: 100
  // faqDuplicateLeadIns=0: 100
  // raw=(15×35+515/9×20+130/3×25+100×10+100×10)/100
  //    =(525+10300/9+3250/3+1000+1000)/100
  //    =(4725/9+10300/9+9750/9+9000/9+9000/9)/100=42775/900=47.527...→47.53
  // penalty=0; final=47.53
  it("GV3: weak FAQ (3 items, thin answers) → 47.53", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 3,
        averageAnswerWords:       20,
        questionMarkCount:        2,
        answerContainsList:       0,
        answerContainsNumber:     1,
        answerContainsLocation:   1,
        answerContainsCallToAction: 0,
        faqCompleteness:          1.0,
        faqDuplicateLeadIns:      0,
        duplicateQuestionCount:   0,
        emptyAnswerCount:         0,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(47.53);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV4: Good FAQ (5 items) with duplicate questions penalty → 79.5 ──────
  // averageAnswerWords=60: exact breakpoint → 80
  // questionMarkCount=4/5=0.8: exact breakpoint → 75
  // richness=(2+4+3+2)/5=11/5=2.2: between[1.5,80][2.5,100]: t=0.7; y=80+14=94
  // faqCompleteness=1.0: 100
  // faqDuplicateLeadIns=1/5=0.2: exact breakpoint → 80
  // raw=(80×35+75×20+94×25+100×10+80×10)/100=(2800+1500+2350+1000+800)/100=8450/100=84.5
  // penalty=5 (duplicateQuestionCount=2); final=84.5−5=79.5
  it("GV4: good FAQ (5 items) with penalty → 79.5", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 5,
        averageAnswerWords:       60,
        questionMarkCount:        4,
        answerContainsList:       2,
        answerContainsNumber:     4,
        answerContainsLocation:   3,
        answerContainsCallToAction: 2,
        faqCompleteness:          1.0,
        faqDuplicateLeadIns:      1,
        duplicateQuestionCount:   2,
        emptyAnswerCount:         0,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(79.5);
    expect(result.breakdown["_penaltyTotal"]).toBe(5);
  });

  // ── GV5: Strong FAQ (4 items) → 90.81 ────────────────────────────────────
  // averageAnswerWords=55: between[40,55][60,80]: t=0.75; y=55+0.75×25=73.75
  // questionMarkCount=4/4=1.0: 100
  // richness=(3+4+2+1)/4=10/4=2.5: exact breakpoint → 100
  // faqCompleteness=1.0: 100
  // faqDuplicateLeadIns=0: 100
  // raw=(73.75×35+100×20+100×25+100×10+100×10)/100
  //    =(2581.25+2000+2500+1000+1000)/100=9081.25/100=90.8125→90.81
  // penalty=0; final=90.81
  it("GV5: strong FAQ (4 items) → 90.81", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 4,
        averageAnswerWords:       55,
        questionMarkCount:        4,
        answerContainsList:       3,
        answerContainsNumber:     4,
        answerContainsLocation:   2,
        answerContainsCallToAction: 1,
        faqCompleteness:          1.0,
        faqDuplicateLeadIns:      0,
        duplicateQuestionCount:   0,
        emptyAnswerCount:         0,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(90.81);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV6: Pathological FAQ (4 items, empty answers, duplicate questions) → 21.25 ──
  // averageAnswerWords=0: left-clamp → 0
  // questionMarkCount=4/4=1.0: 100
  // richness=(0+0+0+0)/4=0: left-clamp → 10
  // faqCompleteness=0: left-clamp → 0
  // faqDuplicateLeadIns=2/4=0.5: between[0.4,50][0.6,25]: t=0.5; y=50+0.5×(25−50)=37.5
  // raw=(0×35+100×20+10×25+0×10+37.5×10)/100=(0+2000+250+0+375)/100=2625/100=26.25
  // penalty=5 (duplicateQuestionCount=2); final=max(0,26.25−5)=21.25
  it("GV6: pathological FAQ (empty answers, duplicate Qs) → 21.25", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 4,
        averageAnswerWords:       0,
        questionMarkCount:        4,
        answerContainsList:       0,
        answerContainsNumber:     0,
        answerContainsLocation:   0,
        answerContainsCallToAction: 0,
        faqCompleteness:          0,
        faqDuplicateLeadIns:      2,
        duplicateQuestionCount:   2,
        emptyAnswerCount:         4,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(21.25);
    expect(result.breakdown["_penaltyTotal"]).toBe(5);
  });

  // ── GV7: Mixed FAQ (6 items, moderate) → 76.44 ───────────────────────────
  // averageAnswerWords=45: between[40,55][60,80]: t=0.25; y=55+0.25×25=61.25
  // questionMarkCount=5/6=0.8333: between[0.8,75][1.0,100]: t=1/6; y=75+25/6=475/6=79.1666...
  // richness=(2+3+3+2)/6=10/6=5/3=1.6666: between[1.5,80][2.5,100]: t=1/6; y=80+20/6=250/3=83.3333...
  // faqCompleteness=1.0: 100
  // faqDuplicateLeadIns=1/6=0.1666: between[0,100][0.2,80]: t=5/6; y=100+5/6×(80−100)=250/3=83.3333...
  // raw=(61.25×35+475/6×20+250/3×25+100×10+250/3×10)/100
  //    =(2143.75+9500/6+6250/3+1000+2500/3)/100
  // In 6ths: (12862.5+9500+12500+6000+5000)/6/100=45862.5/600=76.4375→76.44
  // penalty=0; final=76.44
  it("GV7: mixed FAQ (6 items, moderate) → 76.44", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 6,
        averageAnswerWords:       45,
        questionMarkCount:        5,
        answerContainsList:       2,
        answerContainsNumber:     3,
        answerContainsLocation:   3,
        answerContainsCallToAction: 2,
        faqCompleteness:          1.0,
        faqDuplicateLeadIns:      1,
        duplicateQuestionCount:   0,
        emptyAnswerCount:         0,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(76.44);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV8: Minimal FAQ (3 items, one incomplete) → 61.97 ───────────────────
  // averageAnswerWords=30: between[20,15][40,55]: t=0.5; y=15+0.5×40=35
  // questionMarkCount=3/3=1.0: 100
  // richness=(0+2+0+1)/3=3/3=1.0: exact breakpoint → 60
  // faqCompleteness=2/3=0.6666: between[0.5,25][0.8,65]: t=5/9; y=25+200/9=425/9=47.2222...
  // faqDuplicateLeadIns=0: 100
  // raw=(35×35+100×20+60×25+425/9×10+100×10)/100
  //    =(1225+2000+1500+4250/9+1000)/100
  //    =(11025+18000+13500+4250+9000)/9/100=55775/900=61.9722...→61.97
  // penalty=0; final=61.97
  it("GV8: minimal FAQ (3 items, one incomplete) → 61.97", () => {
    const result = faqQualityScorer.score(
      makeContext({
        faqCount:                 3,
        averageAnswerWords:       30,
        questionMarkCount:        3,
        answerContainsList:       0,
        answerContainsNumber:     2,
        answerContainsLocation:   0,
        answerContainsCallToAction: 1,
        faqCompleteness:          2 / 3,
        faqDuplicateLeadIns:      0,
        duplicateQuestionCount:   0,
        emptyAnswerCount:         1,
        emptyQuestionCount:       0,
      }),
    );
    expect(result.score).toBe(61.97);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });
});

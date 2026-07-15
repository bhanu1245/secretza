/**
 * Tests for InternalLinksQualityScorer (Phase 2C.7)
 *
 * Golden vector arithmetic pre-verified against piecewiseLinear/weightedAverage
 * implementations in seo-scoring-core.ts (roundScore = Math.round(x * 100) / 100).
 *
 * Module ID: "internal-links"
 * Profile slot: CITY_SEO_V6_PROFILE["internal-links"] weight 15
 * Provider: InternalLinkMetricsProvider
 *
 * Component weights: linkVolume(25) + anchorQuality(30) + anchorDiversity(20)
 *                    + linkDistribution(15) + targetDiversity(10) = 100
 * Penalty: duplicateTargetCount ≥ 2 → −5 (HIGH_DUPLICATE_TARGETS)
 * SKIP: internalLinkCount === 0
 */

import { describe, it, expect } from "vitest";
import type { ModuleContext, QualityMetrics, ScoringProfile } from "@/lib/seo-quality-types";
import {
  InternalLinksQualityScorer,
  internalLinksQualityScorer,
  INTERNAL_LINKS_QUALITY_MODULE_ID,
  scoreLinkVolume,
  scoreAnchorQuality,
  scoreAnchorDiversity,
  scoreLinkDistribution,
  scoreTargetDiversity,
} from "@/lib/seo-scorers/internal-links-quality-scorer";

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    // ── Content length (ContentMetricsProvider) ───────────────────────────────
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

    // ── FAQ quality ───────────────────────────────────────────────────────────
    faqCount: 0, faqThinAnswers: 0, faqDuplicateLeadIns: 0, faqAvgAnswerWords: 0,
    questionCount: 0, answerCount: 0,
    averageQuestionLength: 0, averageAnswerLength: 0,
    averageQuestionWords: 0, averageAnswerWords: 0,
    longestQuestionLength: 0, longestAnswerLength: 0,
    shortestQuestionLength: 0, shortestAnswerLength: 0,
    duplicateQuestionCount: 0, duplicateAnswerCount: 0, duplicateFaqPairCount: 0,
    emptyQuestionCount: 0, emptyAnswerCount: 0,
    questionMarkCount: 0,
    questionStartsWithWhWord: 0, questionStartsWithHow: 0, questionStartsWithWhat: 0,
    questionStartsWithWhere: 0, questionStartsWithWhen: 0, questionStartsWithWhy: 0,
    questionStartsWithCan: 0, questionStartsWithIs: 0, questionStartsWithAre: 0,
    answerContainsList: 0, answerContainsInternalLink: 0, answerContainsKeyword: 0,
    answerContainsNumber: 0, answerContainsLocation: 0, answerContainsCallToAction: 0,
    answerReadingTimeMinutes: 0, faqCompleteness: 0,
    structuredFaqParity: 1, structuredFaqQuestionCoverage: 1, structuredFaqAnswerCoverage: 1,
    missingStructuredFaqCount: 0, extraStructuredFaqCount: 0,

    // ── Internal links (legacy) ───────────────────────────────────────────────
    internalLinksCount: 5, uniqueAnchorTexts: 5, anchorTextDiversity: 1.0,

    // ── Internal links (InternalLinkMetricsProvider) ──────────────────────────
    internalLinkCount:          5,
    externalLinkCount:          0,
    followLinkCount:            5,
    nofollowLinkCount:          0,
    anchorTextCount:            5,
    uniqueAnchorTextCount:      5,
    duplicateAnchorTextCount:   0,
    averageAnchorLength:        20,
    longestAnchorLength:        35,
    shortestAnchorLength:       8,
    emptyAnchorCount:           0,
    samePageAnchorCount:        0,
    relativeLinkCount:          5,
    absoluteInternalLinkCount:  0,
    externalHttpLinkCount:      0,
    mailtoLinkCount:            0,
    telLinkCount:               0,
    categoryLinkCount:          1,
    cityLinkCount:              2,
    listingLinkCount:           1,
    faqInternalLinkCount:       0,
    ctaInternalLinkCount:       0,
    sectionLinkDistribution:    0.8,
    firstLinkPosition:          0,
    lastLinkPosition:           4,
    linkSpread:                 1.0,
    linkDensity:                1.25,
    uniqueTargetCount:          5,
    duplicateTargetCount:       0,
    anchorKeywordCoverage:      0.4,
    descriptiveAnchorCount:     4,
    genericAnchorCount:         1,
    imageLinkCount:             0,

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
    metrics:          makeMetrics(overrides),
    profile:          { id: "city-seo-v6-0", modules: [], pageTypes: ["city"] } as unknown as ScoringProfile,
    pageContext:      { pageType: "city", pageSlug: "test-city", primaryKeyword: "test keyword", secondaryKeywords: [], attempt: 1 },
    ruleResults:      [],
    priorModuleScores: [],
  };
}

// ─── 1. Identity and lifecycle ─────────────────────────────────────────────────

describe("InternalLinksQualityScorer — identity", () => {
  it("has correct module ID constant", () => {
    expect(INTERNAL_LINKS_QUALITY_MODULE_ID).toBe("internal-links");
  });

  it("singleton has correct module ID", () => {
    expect(internalLinksQualityScorer.id).toBe("internal-links");
  });

  it("exports a named class and a singleton", () => {
    expect(internalLinksQualityScorer).toBeInstanceOf(InternalLinksQualityScorer);
  });

  it("has required metadata fields", () => {
    expect(typeof internalLinksQualityScorer.name).toBe("string");
    expect(typeof internalLinksQualityScorer.description).toBe("string");
    expect(internalLinksQualityScorer.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof internalLinksQualityScorer.priority).toBe("number");
  });

  it("requiredMetrics contains all InternalLinkMetricsProvider scoring fields", () => {
    const rm = internalLinksQualityScorer.requiredMetrics as readonly string[];
    expect(rm).toContain("internalLinkCount");
    expect(rm).toContain("anchorTextCount");
    expect(rm).toContain("descriptiveAnchorCount");
    expect(rm).toContain("genericAnchorCount");
    expect(rm).toContain("uniqueAnchorTextCount");
    expect(rm).toContain("duplicateAnchorTextCount");
    expect(rm).toContain("sectionLinkDistribution");
    expect(rm).toContain("uniqueTargetCount");
    expect(rm).toContain("duplicateTargetCount");
    expect(rm).toContain("anchorKeywordCoverage");
    expect(rm).toContain("emptyAnchorCount");
  });

  it("has empty dependsOnModules", () => {
    expect(internalLinksQualityScorer.dependsOnModules).toEqual([]);
  });
});

// ─── 2. SKIP condition ─────────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — SKIP condition", () => {
  it("SKIPs when internalLinkCount = 0", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 0 }),
    );
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
    expect(result.normalizedScore).toBe(0);
  });

  it("SKIPPED result has moduleId = 'internal-links'", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 0 }),
    );
    expect(result.moduleId).toBe("internal-links");
  });

  it("does NOT SKIP when internalLinkCount = 1", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 1, anchorTextCount: 1, descriptiveAnchorCount: 1,
        uniqueAnchorTextCount: 1, duplicateAnchorTextCount: 0,
        sectionLinkDistribution: 0.2, uniqueTargetCount: 1, duplicateTargetCount: 0 }),
    );
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("handles null metrics without crashing — returns SKIPPED", () => {
    const result = internalLinksQualityScorer.score(
      { ...makeContext(), metrics: null as unknown as QualityMetrics },
    );
    expect(result.lifecycleState).toBe("SKIPPED");
  });

  it("handles NaN internalLinkCount — safeNumber(NaN)=0 → SKIPPED", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: NaN }),
    );
    expect(result.lifecycleState).toBe("SKIPPED");
  });
});

// ─── 3. Helper: scoreLinkVolume ────────────────────────────────────────────────

describe("scoreLinkVolume", () => {
  it("returns 0 for count = 0", () => {
    expect(scoreLinkVolume(0)).toBe(0);
  });

  it("returns 10 for count = 1 (exact breakpoint)", () => {
    expect(scoreLinkVolume(1)).toBe(10);
  });

  it("returns 40 for count = 3 (exact breakpoint)", () => {
    expect(scoreLinkVolume(3)).toBe(40);
  });

  it("returns 70 for count = 5 (exact breakpoint — production threshold)", () => {
    expect(scoreLinkVolume(5)).toBe(70);
  });

  it("returns 88 for count = 8 (exact breakpoint)", () => {
    expect(scoreLinkVolume(8)).toBe(88);
  });

  it("returns 100 for count = 12 (exact breakpoint, right-clamped)", () => {
    expect(scoreLinkVolume(12)).toBe(100);
  });

  it("returns 100 for count > 12 (right-clamped)", () => {
    expect(scoreLinkVolume(50)).toBe(100);
  });

  it("interpolates correctly between [1,10] and [3,40] at count = 2", () => {
    // t = (2-1)/(3-1) = 0.5; y = 10 + 0.5×30 = 25
    expect(scoreLinkVolume(2)).toBe(25);
  });

  it("handles NaN — safeNumber returns 0 → score 0", () => {
    expect(scoreLinkVolume(NaN)).toBe(0);
  });

  it("handles negative count — left-clamped to 0", () => {
    expect(scoreLinkVolume(-5)).toBe(0);
  });

  it("handles Infinity — safeNumber treats as 0 → score 0", () => {
    expect(scoreLinkVolume(Infinity)).toBe(0);
  });

  it("is monotonically non-decreasing", () => {
    const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
    const scores = counts.map(scoreLinkVolume);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 4. Helper: scoreAnchorQuality ────────────────────────────────────────────

describe("scoreAnchorQuality", () => {
  it("returns 100 when anchorTextCount = 0 (neutral — no text anchors)", () => {
    expect(scoreAnchorQuality(0, 0)).toBe(100);
    expect(scoreAnchorQuality(5, 0)).toBe(100); // denominator wins
  });

  it("returns 100 for ratio = 1.0 (all descriptive)", () => {
    expect(scoreAnchorQuality(5, 5)).toBe(100);
  });

  it("returns 0 for ratio = 0 (all generic)", () => {
    expect(scoreAnchorQuality(0, 5)).toBe(0);
  });

  it("returns 20 for ratio = 0.3 (exact breakpoint)", () => {
    expect(scoreAnchorQuality(3, 10)).toBe(20);
  });

  it("returns 45 for ratio = 0.5 (exact breakpoint)", () => {
    expect(scoreAnchorQuality(5, 10)).toBe(45);
  });

  it("returns 70 for ratio = 0.7 (exact breakpoint)", () => {
    expect(scoreAnchorQuality(7, 10)).toBe(70);
  });

  it("returns 90 for ratio = 0.85 (exact breakpoint)", () => {
    expect(scoreAnchorQuality(17, 20)).toBe(90);
  });

  it("clamps ratio > 1 (descriptiveAnchorCount > anchorTextCount) to 100", () => {
    expect(scoreAnchorQuality(10, 5)).toBe(100);
  });

  it("handles NaN — safeNumber(NaN) = 0 → ratio 0 → score 0 (when total > 0)", () => {
    expect(scoreAnchorQuality(NaN, 5)).toBe(0);
  });

  it("handles NaN total — returns 100 (neutral)", () => {
    expect(scoreAnchorQuality(3, NaN)).toBe(100);
  });

  it("is monotonically non-decreasing as descriptiveAnchorCount increases", () => {
    const scores = [0, 1, 2, 3, 4, 5].map((d) => scoreAnchorQuality(d, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 5. Helper: scoreAnchorDiversity ──────────────────────────────────────────

describe("scoreAnchorDiversity", () => {
  it("returns 100 when anchorTextCount = 0 (neutral)", () => {
    expect(scoreAnchorDiversity(0, 0)).toBe(100);
  });

  it("returns 100 for ratio = 1.0 (all unique anchors)", () => {
    expect(scoreAnchorDiversity(8, 8)).toBe(100);
  });

  it("returns 0 for ratio = 0 (no unique anchor texts)", () => {
    expect(scoreAnchorDiversity(0, 8)).toBe(0);
  });

  it("returns 30 for ratio = 0.5 (exact breakpoint)", () => {
    expect(scoreAnchorDiversity(5, 10)).toBe(30);
  });

  it("returns 60 for ratio = 0.75 (exact breakpoint)", () => {
    expect(scoreAnchorDiversity(3, 4)).toBe(60);
  });

  it("returns 85 for ratio = 0.9 (exact breakpoint)", () => {
    expect(scoreAnchorDiversity(9, 10)).toBe(85);
  });

  it("handles NaN — returns 100 (neutral)", () => {
    expect(scoreAnchorDiversity(NaN, NaN)).toBe(100);
  });

  it("is monotonically non-decreasing as uniqueAnchorTextCount increases", () => {
    const scores = [0, 2, 4, 6, 8, 10].map((u) => scoreAnchorDiversity(u, 10));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });

  it("result always in [0, 100]", () => {
    const pairs: [number, number][] = [[0,0],[0,5],[5,5],[3,4],[9,10],[15,10]];
    for (const [u, t] of pairs) {
      const s = scoreAnchorDiversity(u, t);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 6. Helper: scoreLinkDistribution ─────────────────────────────────────────

describe("scoreLinkDistribution", () => {
  it("returns 0 for distribution = 0", () => {
    expect(scoreLinkDistribution(0)).toBe(0);
  });

  it("returns 100 for distribution = 1.0", () => {
    expect(scoreLinkDistribution(1.0)).toBe(100);
  });

  it("returns 20 for distribution = 0.2 (exact breakpoint)", () => {
    expect(scoreLinkDistribution(0.2)).toBe(20);
  });

  it("returns 50 for distribution = 0.4 (exact breakpoint)", () => {
    expect(scoreLinkDistribution(0.4)).toBe(50);
  });

  it("returns 75 for distribution = 0.6 (exact breakpoint)", () => {
    expect(scoreLinkDistribution(0.6)).toBe(75);
  });

  it("returns 90 for distribution = 0.8 (exact breakpoint)", () => {
    expect(scoreLinkDistribution(0.8)).toBe(90);
  });

  it("interpolates at distribution = 0.5", () => {
    // between [0.4,50] and [0.6,75]: t=0.5, y=50+0.5×25=62.5
    expect(scoreLinkDistribution(0.5)).toBe(62.5);
  });

  it("handles NaN — returns 0", () => {
    expect(scoreLinkDistribution(NaN)).toBe(0);
  });

  it("clamps below 0 → 0", () => {
    expect(scoreLinkDistribution(-0.5)).toBe(0);
  });

  it("clamps above 1 → 100", () => {
    expect(scoreLinkDistribution(1.5)).toBe(100);
  });

  it("is monotonically non-decreasing", () => {
    const inputs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0];
    const scores = inputs.map(scoreLinkDistribution);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 7. Helper: scoreTargetDiversity ──────────────────────────────────────────

describe("scoreTargetDiversity", () => {
  it("returns 0 when internalLinkCount = 0", () => {
    expect(scoreTargetDiversity(0, 0)).toBe(0);
    expect(scoreTargetDiversity(5, 0)).toBe(0);
  });

  it("returns 100 for ratio = 1.0 (all unique targets)", () => {
    expect(scoreTargetDiversity(10, 10)).toBe(100);
  });

  it("returns 0 for ratio = 0 (no unique targets)", () => {
    expect(scoreTargetDiversity(0, 10)).toBe(0);
  });

  it("returns 30 for ratio = 0.5 (exact breakpoint)", () => {
    expect(scoreTargetDiversity(5, 10)).toBe(30);
  });

  it("returns 65 for ratio = 0.75 (exact breakpoint)", () => {
    expect(scoreTargetDiversity(3, 4)).toBe(65);
  });

  it("clamps ratio > 1 → 100", () => {
    expect(scoreTargetDiversity(15, 10)).toBe(100);
  });

  it("handles NaN — returns 0", () => {
    expect(scoreTargetDiversity(NaN, 5)).toBe(0);
  });

  it("is monotonically non-decreasing as uniqueTargetCount increases", () => {
    const scores = [0, 2, 4, 6, 8, 10].map((u) => scoreTargetDiversity(u, 10));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 8. Neutrality guards ─────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — neutrality guards", () => {
  it("anchorQuality = 100 when all links are image links (anchorTextCount = 0)", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount: 5, anchorTextCount: 0,
        descriptiveAnchorCount: 0, genericAnchorCount: 0, emptyAnchorCount: 5,
      }),
    );
    expect(result.breakdown["anchorQuality"]).toBe(100);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("anchorDiversity = 100 when all links are image links (anchorTextCount = 0)", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount: 5, anchorTextCount: 0,
        uniqueAnchorTextCount: 0, emptyAnchorCount: 5,
      }),
    );
    expect(result.breakdown["anchorDiversity"]).toBe(100);
  });

  it("lower anchorQuality when some anchors are generic (anchorTextCount > 0)", () => {
    const imageOnly = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 5, anchorTextCount: 0, emptyAnchorCount: 5 }),
    );
    const withGeneric = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 5, anchorTextCount: 5, descriptiveAnchorCount: 0,
        genericAnchorCount: 5, emptyAnchorCount: 0 }),
    );
    // Image-only is neutral (100), all-generic is 0
    expect(imageOnly.breakdown["anchorQuality"]).toBe(100);
    expect(withGeneric.breakdown["anchorQuality"]).toBe(0);
    expect(imageOnly.score).toBeGreaterThan(withGeneric.score);
  });
});

// ─── 9. Penalty trigger ───────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — penalty", () => {
  it("no penalty when duplicateTargetCount = 0", () => {
    const result = internalLinksQualityScorer.score(makeContext({ duplicateTargetCount: 0 }));
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("no penalty when duplicateTargetCount = 1 (threshold is ≥ 2)", () => {
    const result = internalLinksQualityScorer.score(makeContext({ duplicateTargetCount: 1 }));
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("applies HIGH_DUPLICATE_TARGETS (−5) when duplicateTargetCount = 2", () => {
    const noPen = internalLinksQualityScorer.score(makeContext({ duplicateTargetCount: 1 }));
    const pen   = internalLinksQualityScorer.score(makeContext({ duplicateTargetCount: 2 }));
    expect(pen.breakdown["_penaltyTotal"]).toBe(5);
    expect(pen.score).toBeLessThan(noPen.score);
  });

  it("penalty is fixed at 5 regardless of duplicateTargetCount magnitude", () => {
    const result = internalLinksQualityScorer.score(makeContext({ duplicateTargetCount: 10 }));
    expect(result.breakdown["_penaltyTotal"]).toBe(5);
  });

  it("score is clamped to 0 even with heavy penalties on a bad page", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount: 1,
        anchorTextCount: 1, descriptiveAnchorCount: 0, genericAnchorCount: 1,
        uniqueAnchorTextCount: 1, duplicateAnchorTextCount: 0,
        sectionLinkDistribution: 0, uniqueTargetCount: 0, duplicateTargetCount: 5,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─── 10. Recommendations ──────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — recommendations", () => {
  it("emits IL_LOW_INTERNAL_LINKS when internalLinkCount < 3", () => {
    const result = internalLinksQualityScorer.score(makeContext({ internalLinkCount: 2 }));
    expect(result.recommendations.map((r) => r.code)).toContain("IL_LOW_INTERNAL_LINKS");
  });

  it("does NOT emit IL_LOW_INTERNAL_LINKS when internalLinkCount ≥ 3", () => {
    const result = internalLinksQualityScorer.score(makeContext({ internalLinkCount: 3 }));
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_LOW_INTERNAL_LINKS");
  });

  it("emits IL_GENERIC_ANCHOR_TEXT when anchorQualityRatio < 0.5 and anchorTextCount > 0", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 10, descriptiveAnchorCount: 4, genericAnchorCount: 6 }),
    );
    expect(result.recommendations.map((r) => r.code)).toContain("IL_GENERIC_ANCHOR_TEXT");
  });

  it("IL_GENERIC_ANCHOR_TEXT severity is error when ratio < 0.3", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 10, descriptiveAnchorCount: 2, genericAnchorCount: 8 }),
    );
    const rec = result.recommendations.find((r) => r.code === "IL_GENERIC_ANCHOR_TEXT");
    expect(rec?.severity).toBe("error");
  });

  it("IL_GENERIC_ANCHOR_TEXT severity is warning when 0.3 ≤ ratio < 0.5", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 10, descriptiveAnchorCount: 4, genericAnchorCount: 6 }),
    );
    const rec = result.recommendations.find((r) => r.code === "IL_GENERIC_ANCHOR_TEXT");
    expect(rec?.severity).toBe("warning");
  });

  it("does NOT emit IL_GENERIC_ANCHOR_TEXT when anchorTextCount = 0 (neutral)", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 0, descriptiveAnchorCount: 0, emptyAnchorCount: 5 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_GENERIC_ANCHOR_TEXT");
  });

  it("does NOT emit IL_GENERIC_ANCHOR_TEXT when ratio ≥ 0.5", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 10, descriptiveAnchorCount: 5, genericAnchorCount: 5 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_GENERIC_ANCHOR_TEXT");
  });

  it("emits IL_DUPLICATE_ANCHOR_TEXTS when duplicateAnchorTextCount ≥ 3", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ duplicateAnchorTextCount: 3 }),
    );
    expect(result.recommendations.map((r) => r.code)).toContain("IL_DUPLICATE_ANCHOR_TEXTS");
  });

  it("does NOT emit IL_DUPLICATE_ANCHOR_TEXTS when count = 2", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ duplicateAnchorTextCount: 2 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_DUPLICATE_ANCHOR_TEXTS");
  });

  it("emits IL_POOR_LINK_DISTRIBUTION when sectionLinkDistribution < 0.4", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ sectionLinkDistribution: 0.2 }),
    );
    expect(result.recommendations.map((r) => r.code)).toContain("IL_POOR_LINK_DISTRIBUTION");
  });

  it("does NOT emit IL_POOR_LINK_DISTRIBUTION when sectionLinkDistribution = 0.4", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ sectionLinkDistribution: 0.4 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_POOR_LINK_DISTRIBUTION");
  });

  it("emits IL_DUPLICATE_TARGETS when duplicateTargetCount ≥ 2", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ duplicateTargetCount: 2 }),
    );
    expect(result.recommendations.map((r) => r.code)).toContain("IL_DUPLICATE_TARGETS");
  });

  it("IL_DUPLICATE_TARGETS severity is warning", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ duplicateTargetCount: 3 }),
    );
    const rec = result.recommendations.find((r) => r.code === "IL_DUPLICATE_TARGETS");
    expect(rec?.severity).toBe("warning");
  });

  it("does NOT emit IL_DUPLICATE_TARGETS when count = 1", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ duplicateTargetCount: 1 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_DUPLICATE_TARGETS");
  });

  it("emits IL_NO_KEYWORD_IN_ANCHORS when coverage = 0 and anchorTextCount ≥ 3", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorKeywordCoverage: 0, anchorTextCount: 5 }),
    );
    expect(result.recommendations.map((r) => r.code)).toContain("IL_NO_KEYWORD_IN_ANCHORS");
  });

  it("does NOT emit IL_NO_KEYWORD_IN_ANCHORS when anchorTextCount < 3", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorKeywordCoverage: 0, anchorTextCount: 2 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_NO_KEYWORD_IN_ANCHORS");
  });

  it("does NOT emit IL_NO_KEYWORD_IN_ANCHORS when coverage > 0", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ anchorKeywordCoverage: 0.2, anchorTextCount: 5 }),
    );
    expect(result.recommendations.map((r) => r.code)).not.toContain("IL_NO_KEYWORD_IN_ANCHORS");
  });

  it("recommendation codes are deduplicated", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 2, duplicateTargetCount: 3 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ─── 11. Breakdown structure ───────────────────────────────────────────────────

describe("InternalLinksQualityScorer — breakdown structure", () => {
  it("contains all five component keys", () => {
    const result = internalLinksQualityScorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("linkVolume");
    expect(result.breakdown).toHaveProperty("anchorQuality");
    expect(result.breakdown).toHaveProperty("anchorDiversity");
    expect(result.breakdown).toHaveProperty("linkDistribution");
    expect(result.breakdown).toHaveProperty("targetDiversity");
  });

  it("contains all accounting keys", () => {
    const result = internalLinksQualityScorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("_rawScore");
    expect(result.breakdown).toHaveProperty("_penaltyTotal");
    expect(result.breakdown).toHaveProperty("_cappedScore");
    expect(result.breakdown).toHaveProperty("_finalScore");
  });

  it("all breakdown values are finite numbers", () => {
    const result = internalLinksQualityScorer.score(makeContext());
    for (const [, v] of Object.entries(result.breakdown)) {
      expect(typeof v).toBe("number");
      expect(isFinite(v as number)).toBe(true);
    }
  });

  it("component breakdown values are in [0, 100]", () => {
    const result = internalLinksQualityScorer.score(makeContext());
    for (const key of ["linkVolume", "anchorQuality", "anchorDiversity",
      "linkDistribution", "targetDiversity"]) {
      const v = result.breakdown[key] as number;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("moduleId = 'internal-links' and maxScore = 100", () => {
    const result = internalLinksQualityScorer.score(makeContext());
    expect(result.moduleId).toBe("internal-links");
    expect(result.maxScore).toBe(100);
  });

  it("normalizedScore = score / 100", () => {
    const result = internalLinksQualityScorer.score(makeContext());
    expect(result.normalizedScore).toBeCloseTo(result.score / 100, 5);
  });
});

// ─── 12. Determinism ──────────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — determinism", () => {
  it("produces identical scores for identical inputs (10 repetitions)", () => {
    const ctx = makeContext({
      internalLinkCount: 6, anchorTextCount: 6,
      descriptiveAnchorCount: 4, uniqueAnchorTextCount: 5,
      sectionLinkDistribution: 0.6, uniqueTargetCount: 4,
    });
    const first = internalLinksQualityScorer.score(ctx).score;
    for (let i = 0; i < 9; i++) {
      expect(internalLinksQualityScorer.score(ctx).score).toBe(first);
    }
  });

  it("different instances produce the same result", () => {
    const s1 = new InternalLinksQualityScorer();
    const s2 = new InternalLinksQualityScorer();
    const ctx = makeContext({ internalLinkCount: 7 });
    expect(s1.score(ctx).score).toBe(s2.score(ctx).score);
  });
});

// ─── 13. Monotonicity ─────────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — monotonicity", () => {
  it("higher internalLinkCount (≤ 12) → higher score", () => {
    const s1 = internalLinksQualityScorer.score(makeContext({ internalLinkCount: 1 })).score;
    const s5 = internalLinksQualityScorer.score(makeContext({ internalLinkCount: 5 })).score;
    const s12 = internalLinksQualityScorer.score(makeContext({ internalLinkCount: 12 })).score;
    expect(s5).toBeGreaterThanOrEqual(s1);
    expect(s12).toBeGreaterThanOrEqual(s5);
  });

  it("higher descriptiveAnchorCount → higher score (anchorTextCount fixed)", () => {
    const low  = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 10, descriptiveAnchorCount: 2 }),
    ).score;
    const high = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 10, descriptiveAnchorCount: 8 }),
    ).score;
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it("higher uniqueAnchorTextCount → higher score (anchorTextCount fixed)", () => {
    const low  = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 8, uniqueAnchorTextCount: 2 }),
    ).score;
    const high = internalLinksQualityScorer.score(
      makeContext({ anchorTextCount: 8, uniqueAnchorTextCount: 8 }),
    ).score;
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it("higher sectionLinkDistribution → higher score", () => {
    const low  = internalLinksQualityScorer.score(makeContext({ sectionLinkDistribution: 0.2 })).score;
    const high = internalLinksQualityScorer.score(makeContext({ sectionLinkDistribution: 0.8 })).score;
    expect(high).toBeGreaterThan(low);
  });

  it("higher uniqueTargetCount → higher score (internalLinkCount fixed)", () => {
    const low  = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 8, uniqueTargetCount: 2 }),
    ).score;
    const high = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 8, uniqueTargetCount: 8 }),
    ).score;
    expect(high).toBeGreaterThanOrEqual(low);
  });
});

// ─── 14. Edge cases ────────────────────────────────────────────────────────────

describe("InternalLinksQualityScorer — edge cases", () => {
  it("handles all NaN metric values without crashing", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount: 5, // must be > 0 to avoid SKIP
        anchorTextCount: NaN, descriptiveAnchorCount: NaN,
        uniqueAnchorTextCount: NaN, duplicateAnchorTextCount: NaN,
        sectionLinkDistribution: NaN, uniqueTargetCount: NaN,
        duplicateTargetCount: NaN,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("handles Infinity anchorTextCount — treated as 0 → neutral", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 5, anchorTextCount: Infinity }),
    );
    expect(isFinite(result.score)).toBe(true);
  });

  it("handles negative values without crashing", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount: 5,
        anchorTextCount: -2, descriptiveAnchorCount: -1,
        sectionLinkDistribution: -0.5, duplicateTargetCount: -1,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("score is always in [0, 100] for extreme inputs", () => {
    const cases = [
      makeContext({ internalLinkCount: 1, anchorTextCount: 0, uniqueTargetCount: 0 }),
      makeContext({ internalLinkCount: 100, anchorTextCount: 100, descriptiveAnchorCount: 100,
        uniqueAnchorTextCount: 100, sectionLinkDistribution: 1.0, uniqueTargetCount: 100 }),
      makeContext({ internalLinkCount: 5, duplicateTargetCount: 10 }),
    ];
    for (const ctx of cases) {
      const s = internalLinksQualityScorer.score(ctx).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 15. Golden vectors ────────────────────────────────────────────────────────
//
// Pre-verified arithmetic. All formulas:
//   piecewiseLinear (seo-scoring-core.ts)
//   weightedAverage (seo-scoring-core.ts)
//   roundScore(x) = Math.round(x * 100) / 100
//
// Component weights: linkVolume(25) + anchorQuality(30) + anchorDiversity(20)
//                    + linkDistribution(15) + targetDiversity(10)
// Penalty: duplicateTargetCount ≥ 2 → −5

describe("InternalLinksQualityScorer — golden vectors", () => {
  // ── GV1: Perfect page → 100 ───────────────────────────────────────────────
  // internalLinkCount=15 → linkVolume=100 (right-clamp at 12)
  // ratio 15/15=1 → anchorQuality=100; ratio 15/15=1 → anchorDiversity=100
  // sectionLinkDistribution=1.0 → linkDistribution=100
  // 15/15=1 → targetDiversity=100
  // rawScore=(100×25+100×30+100×20+100×15+100×10)/100=100; penalty=0
  it("GV1: perfect page → 100", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:         15,
        anchorTextCount:           15,
        descriptiveAnchorCount:    15,
        genericAnchorCount:         0,
        uniqueAnchorTextCount:     15,
        duplicateAnchorTextCount:   0,
        sectionLinkDistribution:   1.0,
        uniqueTargetCount:         15,
        duplicateTargetCount:       0,
        anchorKeywordCoverage:      0.5,
      }),
    );
    expect(result.score).toBe(100);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  // ── GV2: No links → SKIP ──────────────────────────────────────────────────
  it("GV2: no links → SKIPPED, score = 0", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({ internalLinkCount: 0 }),
    );
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
    expect(result.normalizedScore).toBe(0);
  });

  // ── GV3: Minimal links, all generic anchors, poor distribution → 39.25 ───
  // linkVolume(2): t=(2-1)/(3-1)=0.5; y=10+0.5×30=25
  // anchorQuality(0/2=0): 0
  // anchorDiversity(2/2=1.0): 100
  // linkDistribution(0.2): exact→20
  // targetDiversity(2/2=1.0): 100
  // raw=(25×25+0×30+100×20+20×15+100×10)/100=(625+0+2000+300+1000)/100=39.25
  // penalty=0; finalScore=39.25
  it("GV3: minimal links, all generic, poor distribution → 39.25", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:          2,
        anchorTextCount:            2,
        descriptiveAnchorCount:     0,
        genericAnchorCount:         2,
        uniqueAnchorTextCount:      2,
        duplicateAnchorTextCount:   0,
        sectionLinkDistribution:    0.2,
        uniqueTargetCount:          2,
        duplicateTargetCount:       0,
        anchorKeywordCoverage:      0,
      }),
    );
    expect(result.score).toBe(39.25);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV4: Good page with duplicate targets penalty → 65.11 ─────────────────
  // linkVolume(6): t=(6-5)/(8-5)=1/3; y=70+6=76
  // anchorQuality(4/6=2/3): between[0.5,45][0.7,70]; t=(2/3−1/2)/(7/10−1/2)=5/6;
  //   y=45+5/6×25=395/6=65.8333...
  // anchorDiversity(5/6): between[0.75,60][0.9,85]; t=5/9; y=60+5/9×25=665/9=73.8888...
  // linkDistribution(0.6): exact→75
  // targetDiversity(4/6=2/3): between[0.5,30][0.75,65]; t=2/3; y=30+2/3×35=160/3=53.3333...
  // raw=(76×25+1975+13300/9+1125+1600/3)/100=63100/900=70.1111...
  // penalty=5 (duplicateTargetCount=2); postPenalty=65.1111...; finalScore=65.11
  it("GV4: good page with duplicate targets penalty → 65.11", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:          6,
        anchorTextCount:            6,
        descriptiveAnchorCount:     4,
        genericAnchorCount:         2,
        uniqueAnchorTextCount:      5,
        duplicateAnchorTextCount:   1,
        sectionLinkDistribution:    0.6,
        uniqueTargetCount:          4,
        duplicateTargetCount:       2,
        anchorKeywordCoverage:      0.2,
      }),
    );
    expect(result.score).toBe(65.11);
    expect(result.breakdown["_penaltyTotal"]).toBe(5);
  });

  // ── GV5: Strong page, mostly descriptive anchors → 93 ────────────────────
  // linkVolume(8): exact→88
  // anchorQuality(7/8=0.875): between[0.85,90][1.0,100]; t=1/6; y=90+10/6=550/6=91.6666...
  // anchorDiversity(8/8=1.0): 100
  // linkDistribution(0.8): exact→90
  // targetDiversity(8/8=1.0): 100
  // raw=(88×25+2750+2000+1350+1000)/100=(2200+2750+2000+1350+1000)/100=9300/100=93
  // penalty=0; finalScore=93
  it("GV5: strong page, mostly descriptive anchors → 93", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:          8,
        anchorTextCount:            8,
        descriptiveAnchorCount:     7,
        genericAnchorCount:         1,
        uniqueAnchorTextCount:      8,
        duplicateAnchorTextCount:   0,
        sectionLinkDistribution:    0.8,
        uniqueTargetCount:          8,
        duplicateTargetCount:       0,
        anchorKeywordCoverage:      0.25,
      }),
    );
    expect(result.score).toBe(93);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV6: All image links (no anchor text), good volume → 90.25 ────────────
  // linkVolume(6): t=1/3; y=76
  // anchorQuality: anchorTextCount=0 → neutral=100
  // anchorDiversity: anchorTextCount=0 → neutral=100
  // linkDistribution(0.6): exact→75
  // targetDiversity(6/6=1.0): 100
  // raw=(76×25+100×30+100×20+75×15+100×10)/100=(1900+3000+2000+1125+1000)/100=90.25
  // penalty=0; finalScore=90.25
  it("GV6: all image links, no anchor text, good volume → 90.25", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:          6,
        anchorTextCount:            0,
        descriptiveAnchorCount:     0,
        genericAnchorCount:         0,
        emptyAnchorCount:           6,
        imageLinkCount:             6,
        uniqueAnchorTextCount:      0,
        duplicateAnchorTextCount:   0,
        sectionLinkDistribution:    0.6,
        uniqueTargetCount:          6,
        duplicateTargetCount:       0,
        anchorKeywordCoverage:      0,
      }),
    );
    expect(result.score).toBe(90.25);
    expect(result.breakdown["anchorQuality"]).toBe(100);
    expect(result.breakdown["anchorDiversity"]).toBe(100);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV7: Excellent volume, poor distribution → 79.11 ─────────────────────
  // linkVolume(12): exact→100
  // anchorQuality(10/12=5/6): between[0.7,70][0.85,90]; t=8/9; y=70+8/9×20=790/9=87.7777...
  // anchorDiversity(10/12=5/6): between[0.75,60][0.9,85]; t=5/9; y=665/9=73.8888...
  // linkDistribution(0.2): exact→20
  // targetDiversity(12/12=1.0): 100
  // raw=(100×25+790/9×30+665/9×20+20×15+100×10)/100
  //    =(2500+23700/9+13300/9+300+1000)/100
  //    =(3800+37000/9)/100=(34200/9+37000/9)/100=71200/900=79.1111...
  // penalty=0; finalScore=79.11
  it("GV7: excellent volume, poor distribution → 79.11", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:          12,
        anchorTextCount:            12,
        descriptiveAnchorCount:     10,
        genericAnchorCount:          2,
        uniqueAnchorTextCount:      10,
        duplicateAnchorTextCount:    2,
        sectionLinkDistribution:     0.2,
        uniqueTargetCount:          12,
        duplicateTargetCount:        0,
        anchorKeywordCoverage:       0.1,
      }),
    );
    expect(result.score).toBe(79.11);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV8: Medium quality, no penalty → 65.92 ──────────────────────────────
  // linkVolume(5): exact→70
  // anchorQuality(3/5=0.6): between[0.5,45][0.7,70]; t=0.5; y=45+0.5×25=57.5
  // anchorDiversity(4/5=0.8): between[0.75,60][0.9,85]; t=1/3; y=60+1/3×25=205/3=68.3333...
  // linkDistribution(0.4): exact→50
  // targetDiversity(5/5=1.0): 100
  // raw=(70×25+57.5×30+205/3×20+50×15+100×10)/100
  //    =(1750+1725+4100/3+750+1000)/100
  //    =(5225+4100/3)/100=(15675/3+4100/3)/100=19775/300=65.9166...
  // penalty=0; finalScore=roundScore(65.9166...)=65.92
  it("GV8: medium quality, no penalty → 65.92", () => {
    const result = internalLinksQualityScorer.score(
      makeContext({
        internalLinkCount:          5,
        anchorTextCount:            5,
        descriptiveAnchorCount:     3,
        genericAnchorCount:         2,
        uniqueAnchorTextCount:      4,
        duplicateAnchorTextCount:   1,
        sectionLinkDistribution:    0.4,
        uniqueTargetCount:          5,
        duplicateTargetCount:       0,
        anchorKeywordCoverage:      0.2,
      }),
    );
    expect(result.score).toBe(65.92);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });
});

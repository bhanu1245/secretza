/**
 * Tests for UniquenessQualityScorer (Phase 2C.6)
 *
 * Golden vector arithmetic was pre-verified against piecewiseLinear/weightedAverage
 * implementations in seo-scoring-core.ts (roundScore = Math.round(x * 100) / 100).
 *
 * Module ID: "uniqueness"
 * Profile slot: CITY_SEO_V6_PROFILE["uniqueness"] weight 25
 * Provider: DuplicateContentMetricsProvider
 */

import { describe, it, expect } from "vitest";
import type { ModuleContext, QualityMetrics, ScoringProfile } from "@/lib/seo-quality-types";
import {
  UniquenessQualityScorer,
  uniquenessQualityScorer,
  UNIQUENESS_QUALITY_MODULE_ID,
  scoreSentenceOriginality,
  scoreTemplateResistance,
  scoreStructuralDiversity,
  scoreFaqOriginality,
  scoreBoilerplateGuard,
} from "@/lib/seo-scorers/uniqueness-quality-scorer";

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    // ── ContentMetricsProvider ───────────────────────────────────────────────
    wordCount: 600, wordCountIntro: 400, wordCountFaq: 200,
    paragraphCount: 4, sentenceCount: 40, headingCount: 5,
    h1Count: 1, h2Count: 3, h3Count: 1,
    avgParagraphWords: 100, avgSentenceWords: 15, avgWordLength: 5,
    longSentenceCount: 2, longSentenceRatio: 0.05,
    listItemCount: 0, imageCount: 1, faqCount: 0,

    // ── ReadabilityMetricsProvider ────────────────────────────────────────────
    readabilityScore: 65, typeTokenRatio: 0.55,
    shortSentenceCount: 5, shortSentenceRatio: 0.12,
    punctuationDensity: 3.2, questionSentenceCount: 2,
    exclamationSentenceCount: 0, complexWordCount: 20, complexWordRatio: 0.1,
    estimatedReadingTimeMinutes: 2.5, estimatedSpeakingTimeMinutes: 4.0,
    paragraphFlow: 0.6, transitionWordCount: 8,
    transitionDensity: 2.0, transitionCoverage: 0.6,

    // ── MetadataMetricsProvider ───────────────────────────────────────────────
    titleLength: 55, titleCharCount: 55, titleWordCount: 8,
    metaDescriptionLength: 145, metaDescriptionCharCount: 145, metaDescriptionWordCount: 20,
    h1Length: 45, h1CharCount: 45, h1WordCount: 6,
    canonicalPresent: true, canonicalMatchesUrl: true, canonicalIsAbsolute: true,
    robotsNoindex: false, robotsNofollow: false,
    ogTitlePresent: true, ogDescriptionPresent: true, ogImagePresent: true,
    twitterCardPresent: true, twitterTitlePresent: true, twitterDescriptionPresent: true,
    schemaMarkupPresent: true, schemaTypes: ["LocalBusiness"],
    faqSchemaPresent: true, localBusinessSchemaPresent: true,
    viewportMetaPresent: true, charsetMetaPresent: true,

    // ── KeywordMetricsProvider ────────────────────────────────────────────────
    primaryKeywordPresent: true, primaryKeywordOccurrences: 10,
    primaryKeywordDensity: 1.5, primaryKeywordFirstPosition: 5,
    primaryKeywordLastPosition: 350, primaryKeywordInTitle: true,
    primaryKeywordInH1: true, primaryKeywordInMeta: true,
    primaryKeywordInIntro: true, primaryKeywordInFaq: false,
    primaryKeywordInSlug: true, primaryKeywordInHeadings: true,
    secondaryKeywordCount: 2, secondaryKeywordCoverage: 0.8,
    semanticVariantCount: 3, semanticVariantCoverage: 0.7,
    keywordDistributionScore: 0.7, keywordSpread: 0.75,
    keywordDensity: 0.015, keywordStuffingRisk: false,

    // ── FAQMetricsProvider ────────────────────────────────────────────────────
    faqAvgAnswerWords: 50, faqCompleteness: 0.9,
    faqDuplicateLeadIns: 0, faqQuestionMarkCount: 5,
    duplicateQuestionCount: 0, duplicateAnswerCount: 0,
    duplicateFaqPairCount: 0, emptyQuestionCount: 0, emptyAnswerCount: 0,
    questionStartsWithWhat: 2, questionStartsWithHow: 1, questionStartsWithWhy: 1,
    questionStartsWithWhere: 0, questionStartsWithWhen: 0, questionStartsWithAre: 1,
    questionStartsWithIs: 0, questionStartsWithCan: 0, questionStartsWithDo: 0,
    answerContainsNumber: 2, answerContainsList: 1, answerContainsExample: 0,
    answerContainsLink: 0, answerContainsQuestion: 0,
    structuredFaqParity: true, structuredFaqQuestionCoverage: 1.0,
    structuredFaqAnswerCoverage: 1.0, missingStructuredFaqCount: 0,
    extraStructuredFaqCount: 0,

    // ── InternalLinkMetricsProvider ───────────────────────────────────────────
    internalLinkCount: 5, externalLinkCount: 2,
    followLinkCount: 5, nofollowLinkCount: 0,
    anchorTextCount: 5, uniqueAnchorTextCount: 5, duplicateAnchorTextCount: 0,
    averageAnchorLength: 20, longestAnchorLength: 35, shortestAnchorLength: 8,
    emptyAnchorCount: 0, samePageAnchorCount: 0, relativeLinkCount: 5,
    absoluteInternalLinkCount: 0, externalHttpLinkCount: 2,
    mailtoLinkCount: 0, telLinkCount: 0, categoryLinkCount: 1,
    cityLinkCount: 2, listingLinkCount: 1, faqInternalLinkCount: 0,
    ctaInternalLinkCount: 1, sectionLinkDistribution: 0.6,
    firstLinkPosition: 0, lastLinkPosition: 4, linkSpread: 1.0,
    linkDensity: 1.25, uniqueTargetCount: 5, duplicateTargetCount: 0,
    anchorKeywordCoverage: 0.4, descriptiveAnchorCount: 4, genericAnchorCount: 1,
    imageLinkCount: 0,

    // ── LocalAuthenticityMetricsProvider ─────────────────────────────────────
    localReferenceCount: 10, uniqueLocalReferenceCount: 8,
    duplicateLocalReferenceCount: 2, districtMentionCount: 3,
    landmarkMentionCount: 2, transportMentionCount: 1, airportMentionCount: 0,
    railwayStationMentionCount: 1, busStandMentionCount: 0,
    shoppingMallMentionCount: 1, marketMentionCount: 0,
    businessDistrictMentionCount: 1, techParkMentionCount: 0,
    touristAreaMentionCount: 1, festivalMentionCount: 0,
    localCuisineMentionCount: 0, hotelAreaMentionCount: 0,
    luxuryAreaMentionCount: 1, neighborhoodCoverage: 0.5,
    geographicSpread: 0.4, introLocalReferenceCount: 4,
    faqLocalReferenceCount: 2, headingLocalReferenceCount: 2,
    sectionLocalReferenceCoverage: 0.5, curatedReferenceCount: 8,
    generatedReferenceCount: 2, localEntityDensity: 2.0,
    locationMentionFrequency: 1.25, referenceDistributionScore: 0.67,
    referenceEntropy: 0.6, referenceRedundancy: 0.2,
    cityNameOccurrences: 6, primaryLocationCoverage: 0.7,
    secondaryLocationCoverage: 0.5,

    // ── DuplicateContentMetricsProvider ──────────────────────────────────────
    duplicateSentenceCount: 0, duplicateParagraphCount: 0,
    duplicateHeadingCount: 0, duplicateFaqQuestionCount: 0,
    duplicateFaqAnswerCount: 0, duplicateLeadInCount: 0,
    duplicateIntroSentenceCount: 0, repeatedPhraseCount: 0,
    repeatedBigramCount: 2, repeatedTrigramCount: 0, repeatedFourGramCount: 0,
    maxDuplicateRunLength: 0, uniqueSentenceRatio: 0.95, uniqueParagraphRatio: 0.95,
    uniqueHeadingRatio: 1.0, uniqueFaqQuestionRatio: 1, uniqueFaqAnswerRatio: 1,
    templateReuseRatio: 0.01, boilerplateParagraphCount: 0,
    boilerplateSentenceCount: 0, selfSimilarityScore: 0.1,
    introSectionSimilarity: 0.05, headingSimilarity: 0.1,
    faqSimilarity: 0, duplicateWordRunCount: 0,
    duplicateTokenRatio: 0.05, largestRepeatedBlockLength: 0,

    // ── SemanticMetricsProvider ───────────────────────────────────────────────
    semanticClusterCount: 3, conceptCoverage: 0.7,
    semanticClusterCoverage: 0.7, conceptRedundancy: 0.1,
    phraseVariationScore: 0.65, coOccurrenceCount: 5,
    semanticConsistency: 0.8, semanticTransitionScore: 0.7,

    // ── AIPatternMetricsProvider ──────────────────────────────────────────────
    aiPhraseCount: 2, aiPhraseRatio: 0.003, aiPhraseDensity: 0.3,
    aiTransitionPhraseCount: 1, aiHedgingPhraseCount: 0,
    aiMarketingPhraseCount: 1, templatePhraseCount: 0, stockPhraseCount: 0,
    genericClaimCount: 0, repetitiveOpeningCount: 0, repetitiveClosingCount: 0,
    sentenceLengthUniformity: 0.7, paragraphLengthUniformity: 0.65,
    headingLengthUniformity: 0.6, lexicalBurstiness: 0.3,
    paragraphBurstiness: 0.4, vocabularyRepetition: 0.25,
    templateSentenceCount: 0, templateSentenceRatio: 0,
    templateParagraphCount: 0, passiveVoiceProxy: 0.1,
    listHeavyRatio: 0, conclusionPatternCount: 0,
    callToActionPatternCount: 1, exclamationDensity: 0,
    questionDensity: 0.03, repetitionRisk: 0.15, humanVariationScore: 0.85,
    transitionOveruseScore: 0.1, openingVariationScore: 0.8,
    closingVariationScore: 0.75, averageSentenceVariance: 0.6,
    averageParagraphVariance: 0.55,

    ...overrides,
  } as QualityMetrics;
}

function makeContext(metricsOverrides: Partial<QualityMetrics> = {}): ModuleContext {
  return {
    metrics:          makeMetrics(metricsOverrides),
    profile:          { id: "city-seo-v6", modules: [], pageTypes: ["city"] } as unknown as ScoringProfile,
    pageContext:      { pageType: "city", pageSlug: "test-city", primaryKeyword: "test keyword", secondaryKeywords: [], attempt: 1 },
    ruleResults:      [],
    priorModuleScores: [],
  };
}

// ─── 1. Identity and lifecycle ─────────────────────────────────────────────────

describe("UniquenessQualityScorer — identity", () => {
  it("has correct module ID constant", () => {
    expect(UNIQUENESS_QUALITY_MODULE_ID).toBe("uniqueness");
  });

  it("singleton has correct module ID", () => {
    expect(uniquenessQualityScorer.id).toBe("uniqueness");
  });

  it("exports a named class and a singleton", () => {
    expect(uniquenessQualityScorer).toBeInstanceOf(UniquenessQualityScorer);
  });

  it("has required metadata fields", () => {
    expect(typeof uniquenessQualityScorer.name).toBe("string");
    expect(typeof uniquenessQualityScorer.description).toBe("string");
    expect(uniquenessQualityScorer.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof uniquenessQualityScorer.priority).toBe("number");
  });

  it("has correct requiredMetrics list — DuplicateContentMetricsProvider fields", () => {
    const rm = uniquenessQualityScorer.requiredMetrics as readonly string[];
    expect(rm).toContain("uniqueSentenceRatio");
    expect(rm).toContain("templateReuseRatio");
    expect(rm).toContain("uniqueParagraphRatio");
    expect(rm).toContain("introSectionSimilarity");
    expect(rm).toContain("uniqueFaqQuestionRatio");
    expect(rm).toContain("uniqueFaqAnswerRatio");
    expect(rm).toContain("faqSimilarity");
    expect(rm).toContain("boilerplateParagraphCount");
  });

  it("has correct requiredMetrics list — ContentMetricsProvider context guards", () => {
    const rm = uniquenessQualityScorer.requiredMetrics as readonly string[];
    expect(rm).toContain("wordCountIntro");
    expect(rm).toContain("faqCount");
    expect(rm).toContain("paragraphCount");
  });

  it("has empty dependsOnModules", () => {
    expect(uniquenessQualityScorer.dependsOnModules).toEqual([]);
  });
});

// ─── 2. SKIP conditions ────────────────────────────────────────────────────────

describe("UniquenessQualityScorer — SKIP conditions", () => {
  it("SKIPs when wordCountIntro=0 and faqCount=0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ wordCountIntro: 0, faqCount: 0 }),
    );
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
  });

  it("SKIPPED result has moduleId = 'uniqueness'", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ wordCountIntro: 0, faqCount: 0 }),
    );
    expect(result.moduleId).toBe("uniqueness");
  });

  it("does NOT SKIP when wordCountIntro=0 but faqCount>0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ wordCountIntro: 0, faqCount: 5 }),
    );
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("does NOT SKIP when faqCount=0 but wordCountIntro>0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 0, wordCountIntro: 200 }),
    );
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("does NOT SKIP for a normal page", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    expect(result.lifecycleState).toBe("COMPLETED");
  });
});

// ─── 3. Helper: scoreSentenceOriginality ──────────────────────────────────────

describe("scoreSentenceOriginality", () => {
  it("returns 100 for ratio = 1.0", () => {
    expect(scoreSentenceOriginality(1.0)).toBe(100);
  });

  it("returns 0 for ratio = 0.0", () => {
    expect(scoreSentenceOriginality(0.0)).toBe(0);
  });

  it("returns 20 at ratio = 0.5 (exact breakpoint)", () => {
    expect(scoreSentenceOriginality(0.5)).toBe(20);
  });

  it("returns 55 at ratio = 0.7 (exact breakpoint)", () => {
    expect(scoreSentenceOriginality(0.7)).toBe(55);
  });

  it("returns 80 at ratio = 0.85 (exact breakpoint)", () => {
    expect(scoreSentenceOriginality(0.85)).toBe(80);
  });

  it("returns ≈87.5 at ratio = 0.9 (midpoint between 0.85→80 and 0.95→95)", () => {
    // t = (0.9-0.85)/(0.95-0.85) = 0.5; y = 80 + 0.5*15 = 87.5
    expect(scoreSentenceOriginality(0.9)).toBeCloseTo(87.5, 5);
  });

  it("returns 95 at ratio = 0.95 (exact breakpoint)", () => {
    expect(scoreSentenceOriginality(0.95)).toBe(95);
  });

  it("left-clamps: returns 0 for ratio below 0", () => {
    expect(scoreSentenceOriginality(-0.5)).toBe(0);
  });

  it("right-clamps: returns 100 for ratio above 1", () => {
    expect(scoreSentenceOriginality(1.5)).toBe(100);
  });

  it("handles NaN by treating it as 0", () => {
    expect(scoreSentenceOriginality(NaN)).toBe(0);
  });

  it("handles Infinity — safeNumber treats non-finite as 0 → scores 0", () => {
    expect(scoreSentenceOriginality(Infinity)).toBe(0);
  });

  it("is monotonically non-decreasing across the valid range", () => {
    const inputs = [0, 0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0];
    const scores = inputs.map(scoreSentenceOriginality);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 4. Helper: scoreTemplateResistance ───────────────────────────────────────

describe("scoreTemplateResistance", () => {
  it("returns 100 for ratio = 0.0 (no reuse — full resistance)", () => {
    expect(scoreTemplateResistance(0.0)).toBe(100);
  });

  it("returns 0 for ratio = 1.0 (fully reused — no resistance)", () => {
    expect(scoreTemplateResistance(1.0)).toBe(0);
  });

  it("returns 85 for ratio = 0.15 (resistance = 0.85, exact breakpoint)", () => {
    // 1 - 0.15 = 0.85 → TEMPLATE_RESISTANCE_CURVE → 85
    expect(scoreTemplateResistance(0.15)).toBe(85);
  });

  it("returns 60 for ratio = 0.30 (resistance = 0.70, exact breakpoint)", () => {
    expect(scoreTemplateResistance(0.30)).toBe(60);
  });

  it("returns 20 for ratio = 0.50 (resistance = 0.50, exact breakpoint)", () => {
    expect(scoreTemplateResistance(0.5)).toBe(20);
  });

  it("handles NaN — treats as 0 ratio → returns 100", () => {
    expect(scoreTemplateResistance(NaN)).toBe(100);
  });

  it("clamps negative ratio → treated as 0 → 100", () => {
    expect(scoreTemplateResistance(-0.5)).toBe(100);
  });

  it("clamps ratio > 1 → resistance ≤ 0 → 0", () => {
    expect(scoreTemplateResistance(1.5)).toBe(0);
  });

  it("is monotonically non-increasing as ratio increases", () => {
    const inputs = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 0.85, 1.0];
    const scores = inputs.map(scoreTemplateResistance);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── 5. Helper: scoreStructuralDiversity ──────────────────────────────────────

describe("scoreStructuralDiversity", () => {
  it("returns 100 for perfect uniqueness and zero similarity", () => {
    expect(scoreStructuralDiversity(1.0, 0.0)).toBe(100);
  });

  it("returns 0 for zero uniqueness and maximum similarity", () => {
    expect(scoreStructuralDiversity(0.0, 1.0)).toBe(0);
  });

  it("is reduced when introSectionSimilarity increases", () => {
    const lowSim  = scoreStructuralDiversity(0.9, 0.1);
    const highSim = scoreStructuralDiversity(0.9, 0.8);
    expect(lowSim).toBeGreaterThan(highSim);
  });

  it("increases as uniqueParagraphRatio increases", () => {
    const low  = scoreStructuralDiversity(0.3, 0.2);
    const high = scoreStructuralDiversity(0.9, 0.2);
    expect(high).toBeGreaterThan(low);
  });

  it("handles NaN inputs without crashing, returning a finite number", () => {
    const result = scoreStructuralDiversity(NaN, NaN);
    expect(typeof result).toBe("number");
    expect(isFinite(result)).toBe(true);
  });

  it("always returns a value in [0, 100]", () => {
    const pairs: [number, number][] = [
      [0, 0], [0.5, 0.5], [1.0, 1.0], [0.75, 0.25], [0.25, 0.75],
    ];
    for (const [pr, sim] of pairs) {
      const s = scoreStructuralDiversity(pr, sim);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 6. Helper: scoreFaqOriginality ───────────────────────────────────────────

describe("scoreFaqOriginality", () => {
  it("returns 100 for all ratios 1 and similarity 0", () => {
    expect(scoreFaqOriginality(1.0, 1.0, 0.0)).toBe(100);
  });

  it("returns 0 for all ratios 0 and similarity 1", () => {
    expect(scoreFaqOriginality(0.0, 0.0, 1.0)).toBe(0);
  });

  it("is reduced when faqSimilarity is high", () => {
    const lowSim  = scoreFaqOriginality(0.9, 0.9, 0.1);
    const highSim = scoreFaqOriginality(0.9, 0.9, 0.9);
    expect(lowSim).toBeGreaterThan(highSim);
  });

  it("answer ratio has higher sub-weight than question ratio", () => {
    // q=1, a=0 vs q=0, a=1 — answer sub-weight (50) > question sub-weight (30)
    const questionPerfect = scoreFaqOriginality(1.0, 0.0, 0.5);
    const answerPerfect   = scoreFaqOriginality(0.0, 1.0, 0.5);
    expect(answerPerfect).toBeGreaterThan(questionPerfect);
  });

  it("always returns a value in [0, 100]", () => {
    const cases: [number, number, number][] = [
      [0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1], [0.75, 0.5, 0.3],
    ];
    for (const [q, a, sim] of cases) {
      const s = scoreFaqOriginality(q, a, sim);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("handles NaN inputs without crashing", () => {
    const result = scoreFaqOriginality(NaN, NaN, NaN);
    expect(typeof result).toBe("number");
    expect(isFinite(result)).toBe(true);
  });
});

// ─── 7. Helper: scoreBoilerplateGuard ─────────────────────────────────────────

describe("scoreBoilerplateGuard", () => {
  it("returns 100 when paragraphCount = 0", () => {
    expect(scoreBoilerplateGuard(0, 0)).toBe(100);
    expect(scoreBoilerplateGuard(5, 0)).toBe(100);
  });

  it("returns 100 when boilerplateParagraphCount = 0", () => {
    expect(scoreBoilerplateGuard(0, 5)).toBe(100);
  });

  it("returns 0 when all paragraphs are boilerplate", () => {
    expect(scoreBoilerplateGuard(5, 5)).toBe(0);
    expect(scoreBoilerplateGuard(10, 10)).toBe(0);
  });

  it("returns 70 when boilerplateRate = 0.25 (bpFree = 0.75, exact breakpoint)", () => {
    // boilerplateParagraphCount=1, paragraphCount=4 → bpFreeRate = 0.75 → 70
    expect(scoreBoilerplateGuard(1, 4)).toBe(70);
  });

  it("returns 40 when boilerplateRate = 0.50 (bpFree = 0.50, exact breakpoint)", () => {
    expect(scoreBoilerplateGuard(2, 4)).toBe(40);
  });

  it("decreases as boilerplateParagraphCount increases", () => {
    const scores = [0, 1, 2, 3, 4, 5].map((bp) => scoreBoilerplateGuard(bp, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });

  it("clamps excessive boilerplate count (bpFreeRate ≤ 0 → score 0)", () => {
    expect(scoreBoilerplateGuard(10, 3)).toBe(0);
  });

  it("handles NaN inputs without crashing", () => {
    const result = scoreBoilerplateGuard(NaN, NaN);
    expect(typeof result).toBe("number");
    expect(isFinite(result)).toBe(true);
  });
});

// ─── 8. Neutrality guards ─────────────────────────────────────────────────────

describe("UniquenessQualityScorer — neutrality guards", () => {
  it("structural diversity component = 100 when paragraphCount = 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 0 }),
    );
    expect(result.breakdown["structuralDiversity"]).toBe(100);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("structural diversity component = 100 when paragraphCount = 1", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        paragraphCount: 1,
        uniqueParagraphRatio: 0.0,
        introSectionSimilarity: 1.0,
      }),
    );
    expect(result.breakdown["structuralDiversity"]).toBe(100);
  });

  it("bad structural diversity hurts score when paragraphCount ≥ 2", () => {
    const with1Para = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 1, uniqueParagraphRatio: 0.0, introSectionSimilarity: 1.0 }),
    );
    const with4Para = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 4, uniqueParagraphRatio: 0.0, introSectionSimilarity: 1.0 }),
    );
    expect(with1Para.score).toBeGreaterThan(with4Para.score);
  });

  it("FAQ originality component = 100 when faqCount = 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 0, uniqueFaqQuestionRatio: 0, uniqueFaqAnswerRatio: 0, faqSimilarity: 1 }),
    );
    expect(result.breakdown["faqOriginality"]).toBe(100);
  });

  it("FAQ originality component = 0 when faqCount > 0 and all ratios are 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 4, uniqueFaqQuestionRatio: 0, uniqueFaqAnswerRatio: 0, faqSimilarity: 1 }),
    );
    expect(result.breakdown["faqOriginality"]).toBe(0);
  });

  it("boilerplate guard = 100 when paragraphCount = 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 0, boilerplateParagraphCount: 99 }),
    );
    expect(result.breakdown["boilerplateGuard"]).toBe(100);
  });
});

// ─── 9. Penalty triggers ──────────────────────────────────────────────────────

describe("UniquenessQualityScorer — penalties", () => {
  it("no penalty when templateReuseRatio ≤ 0.30", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ templateReuseRatio: 0.3 }),
    );
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("applies HIGH_TEMPLATE_REUSE (−10) when templateReuseRatio > 0.30", () => {
    const noPenalty  = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.29 }));
    const penalised  = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.31 }));
    expect(penalised.score).toBeLessThan(noPenalty.score);
    expect(penalised.breakdown["_penaltyTotal"] as number).toBeGreaterThanOrEqual(10);
  });

  it("no HIGH_BOILERPLATE penalty when bpRate = 0.50 exactly (threshold is strictly >)", () => {
    // boilerplateParagraphCount=2, paragraphCount=4 → bpRate=0.5, NOT > 0.5
    const result = uniquenessQualityScorer.score(
      makeContext({ boilerplateParagraphCount: 2, paragraphCount: 4 }),
    );
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("applies HIGH_BOILERPLATE (−5) when bpRate > 0.50", () => {
    // boilerplateParagraphCount=3, paragraphCount=4 → bpRate=0.75 > 0.5
    const noPenalty = uniquenessQualityScorer.score(
      makeContext({ boilerplateParagraphCount: 2, paragraphCount: 4, templateReuseRatio: 0.1 }),
    );
    const penalised = uniquenessQualityScorer.score(
      makeContext({ boilerplateParagraphCount: 3, paragraphCount: 4, templateReuseRatio: 0.1 }),
    );
    expect(penalised.score).toBeLessThan(noPenalty.score);
    expect(penalised.breakdown["_penaltyTotal"] as number).toBeGreaterThanOrEqual(5);
  });

  it("applies both penalties, totalling 15 pts", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        templateReuseRatio:        0.5,    // > 0.30 → −10
        boilerplateParagraphCount: 4,      // rate=4/5=0.8 > 0.50 → −5
        paragraphCount:            5,
      }),
    );
    expect(result.breakdown["_penaltyTotal"]).toBe(15);
  });

  it("score is clamped to 0 even with heavy penalties", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        uniqueSentenceRatio:       0,
        templateReuseRatio:        1,
        uniqueParagraphRatio:      0,
        introSectionSimilarity:    1,
        uniqueFaqQuestionRatio:    0,
        uniqueFaqAnswerRatio:      0,
        faqSimilarity:             1,
        boilerplateParagraphCount: 5,
        paragraphCount:            5,
        faqCount:                  5,
      }),
    );
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ─── 10. Recommendations ──────────────────────────────────────────────────────

describe("UniquenessQualityScorer — recommendations", () => {
  it("emits UQ_DUPLICATE_SENTENCES when uniqueSentenceRatio < 0.8", () => {
    const result = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.6 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_DUPLICATE_SENTENCES");
  });

  it("UQ_DUPLICATE_SENTENCES severity is 'error' when ratio < 0.6", () => {
    const result = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.4 }));
    const rec = result.recommendations.find((r) => r.code === "UQ_DUPLICATE_SENTENCES");
    expect(rec?.severity).toBe("error");
  });

  it("UQ_DUPLICATE_SENTENCES severity is 'warning' when 0.6 ≤ ratio < 0.8", () => {
    const result = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.7 }));
    const rec = result.recommendations.find((r) => r.code === "UQ_DUPLICATE_SENTENCES");
    expect(rec?.severity).toBe("warning");
  });

  it("no UQ_DUPLICATE_SENTENCES when uniqueSentenceRatio ≥ 0.8", () => {
    const result = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.9 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_DUPLICATE_SENTENCES");
  });

  it("emits UQ_HIGH_TEMPLATE_REUSE when templateReuseRatio > 0.30", () => {
    const result = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.4 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_HIGH_TEMPLATE_REUSE");
  });

  it("no UQ_HIGH_TEMPLATE_REUSE when templateReuseRatio ≤ 0.30", () => {
    const result = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.3 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_HIGH_TEMPLATE_REUSE");
  });

  it("emits UQ_INTRO_SECTIONS_SIMILAR when paragraphCount ≥ 2 and similarity > 0.6", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 3, introSectionSimilarity: 0.7 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_INTRO_SECTIONS_SIMILAR");
  });

  it("no UQ_INTRO_SECTIONS_SIMILAR when paragraphCount < 2", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 1, introSectionSimilarity: 0.9 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_INTRO_SECTIONS_SIMILAR");
  });

  it("no UQ_INTRO_SECTIONS_SIMILAR when similarity ≤ 0.6", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ paragraphCount: 4, introSectionSimilarity: 0.6 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_INTRO_SECTIONS_SIMILAR");
  });

  it("emits UQ_FAQ_ANSWERS_SIMILAR when faqCount > 0 and faqSimilarity > 0.5", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 5, faqSimilarity: 0.7 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_FAQ_ANSWERS_SIMILAR");
  });

  it("no UQ_FAQ_ANSWERS_SIMILAR when faqCount = 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 0, faqSimilarity: 0.9 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_FAQ_ANSWERS_SIMILAR");
  });

  it("emits UQ_DUPLICATE_FAQ_ANSWERS when faqCount > 0 and uniqueFaqAnswerRatio < 0.8", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 4, uniqueFaqAnswerRatio: 0.5 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_DUPLICATE_FAQ_ANSWERS");
  });

  it("no UQ_DUPLICATE_FAQ_ANSWERS when faqCount = 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 0, uniqueFaqAnswerRatio: 0.5 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_DUPLICATE_FAQ_ANSWERS");
  });

  it("emits UQ_DUPLICATE_FAQ_QUESTIONS when faqCount > 0 and uniqueFaqQuestionRatio < 0.9", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ faqCount: 4, uniqueFaqQuestionRatio: 0.7 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_DUPLICATE_FAQ_QUESTIONS");
  });

  it("emits UQ_BOILERPLATE_DETECTED when boilerplateParagraphCount > 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ boilerplateParagraphCount: 1 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("UQ_BOILERPLATE_DETECTED");
  });

  it("UQ_BOILERPLATE_DETECTED severity is 'error' when count ≥ 3", () => {
    const result = uniquenessQualityScorer.score(makeContext({ boilerplateParagraphCount: 3 }));
    const rec = result.recommendations.find((r) => r.code === "UQ_BOILERPLATE_DETECTED");
    expect(rec?.severity).toBe("error");
  });

  it("UQ_BOILERPLATE_DETECTED severity is 'info' when count < 3", () => {
    const result = uniquenessQualityScorer.score(makeContext({ boilerplateParagraphCount: 2 }));
    const rec = result.recommendations.find((r) => r.code === "UQ_BOILERPLATE_DETECTED");
    expect(rec?.severity).toBe("info");
  });

  it("no UQ_BOILERPLATE_DETECTED when boilerplateParagraphCount = 0", () => {
    const result = uniquenessQualityScorer.score(makeContext({ boilerplateParagraphCount: 0 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("UQ_BOILERPLATE_DETECTED");
  });

  it("recommendation codes are deduplicated", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ uniqueSentenceRatio: 0.4, templateReuseRatio: 0.5 }),
    );
    const codes = result.recommendations.map((r) => r.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});

// ─── 11. Breakdown structure ───────────────────────────────────────────────────

describe("UniquenessQualityScorer — breakdown structure", () => {
  it("contains all five component keys", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("sentenceOriginality");
    expect(result.breakdown).toHaveProperty("templateResistance");
    expect(result.breakdown).toHaveProperty("structuralDiversity");
    expect(result.breakdown).toHaveProperty("faqOriginality");
    expect(result.breakdown).toHaveProperty("boilerplateGuard");
  });

  it("contains all accounting keys", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    expect(result.breakdown).toHaveProperty("_rawScore");
    expect(result.breakdown).toHaveProperty("_penaltyTotal");
    expect(result.breakdown).toHaveProperty("_cappedScore");
    expect(result.breakdown).toHaveProperty("_finalScore");
  });

  it("all breakdown values are finite numbers", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    for (const [, v] of Object.entries(result.breakdown)) {
      expect(typeof v).toBe("number");
      expect(isFinite(v as number)).toBe(true);
    }
  });

  it("component breakdown values are in [0, 100]", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    for (const key of ["sentenceOriginality", "templateResistance", "structuralDiversity",
      "faqOriginality", "boilerplateGuard"]) {
      const v = result.breakdown[key] as number;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("moduleId = 'uniqueness' and maxScore = 100", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    expect(result.moduleId).toBe("uniqueness");
    expect(result.maxScore).toBe(100);
  });

  it("normalizedScore = score / 100", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    expect(result.normalizedScore).toBeCloseTo(result.score / 100, 4);
  });

  it("lifecycleState is COMPLETED for valid input", () => {
    const result = uniquenessQualityScorer.score(makeContext());
    expect(result.lifecycleState).toBe("COMPLETED");
  });
});

// ─── 12. Determinism ──────────────────────────────────────────────────────────

describe("UniquenessQualityScorer — determinism", () => {
  it("produces identical scores for identical inputs (10 repetitions)", () => {
    const ctx = makeContext({
      uniqueSentenceRatio: 0.82,
      templateReuseRatio: 0.15,
      faqCount: 5,
      uniqueFaqAnswerRatio: 0.8,
      faqSimilarity: 0.3,
    });
    const first = uniquenessQualityScorer.score(ctx).score;
    for (let i = 0; i < 9; i++) {
      expect(uniquenessQualityScorer.score(ctx).score).toBe(first);
    }
  });

  it("helper functions are deterministic", () => {
    expect(scoreSentenceOriginality(0.72)).toBe(scoreSentenceOriginality(0.72));
    expect(scoreTemplateResistance(0.18)).toBe(scoreTemplateResistance(0.18));
    expect(scoreStructuralDiversity(0.8, 0.3)).toBe(scoreStructuralDiversity(0.8, 0.3));
    expect(scoreFaqOriginality(0.9, 0.8, 0.2)).toBe(scoreFaqOriginality(0.9, 0.8, 0.2));
    expect(scoreBoilerplateGuard(2, 8)).toBe(scoreBoilerplateGuard(2, 8));
  });

  it("different scorer instances produce the same result", () => {
    const scorer1 = new UniquenessQualityScorer();
    const scorer2 = new UniquenessQualityScorer();
    const ctx = makeContext({ uniqueSentenceRatio: 0.78 });
    expect(scorer1.score(ctx).score).toBe(scorer2.score(ctx).score);
  });
});

// ─── 13. Monotonicity ─────────────────────────────────────────────────────────

describe("UniquenessQualityScorer — monotonicity", () => {
  it("higher uniqueSentenceRatio → higher score", () => {
    const low  = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.5 })).score;
    const mid  = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.75 })).score;
    const high = uniquenessQualityScorer.score(makeContext({ uniqueSentenceRatio: 0.95 })).score;
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it("lower templateReuseRatio → higher score", () => {
    const low  = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.5 })).score;
    const mid  = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.2 })).score;
    const high = uniquenessQualityScorer.score(makeContext({ templateReuseRatio: 0.0 })).score;
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it("higher uniqueParagraphRatio → higher score (paragraphCount ≥ 2)", () => {
    const low  = uniquenessQualityScorer.score(makeContext({ paragraphCount: 4, uniqueParagraphRatio: 0.25 })).score;
    const high = uniquenessQualityScorer.score(makeContext({ paragraphCount: 4, uniqueParagraphRatio: 0.9 })).score;
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it("lower introSectionSimilarity → higher score (paragraphCount ≥ 2)", () => {
    const worse  = uniquenessQualityScorer.score(makeContext({ paragraphCount: 4, introSectionSimilarity: 0.9 })).score;
    const better = uniquenessQualityScorer.score(makeContext({ paragraphCount: 4, introSectionSimilarity: 0.1 })).score;
    expect(better).toBeGreaterThanOrEqual(worse);
  });

  it("lower faqSimilarity → higher score (faqCount > 0)", () => {
    const worse  = uniquenessQualityScorer.score(makeContext({ faqCount: 5, faqSimilarity: 0.8 })).score;
    const better = uniquenessQualityScorer.score(makeContext({ faqCount: 5, faqSimilarity: 0.1 })).score;
    expect(better).toBeGreaterThanOrEqual(worse);
  });

  it("lower boilerplateParagraphCount → higher score", () => {
    const worse  = uniquenessQualityScorer.score(makeContext({ boilerplateParagraphCount: 4, paragraphCount: 5 })).score;
    const better = uniquenessQualityScorer.score(makeContext({ boilerplateParagraphCount: 0, paragraphCount: 5 })).score;
    expect(better).toBeGreaterThanOrEqual(worse);
  });
});

// ─── 14. Edge cases and malformed inputs ──────────────────────────────────────

describe("UniquenessQualityScorer — edge cases", () => {
  it("handles NaN metrics without crashing or returning NaN", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        uniqueSentenceRatio:       NaN,
        templateReuseRatio:        NaN,
        uniqueParagraphRatio:      NaN,
        introSectionSimilarity:    NaN,
        boilerplateParagraphCount: NaN,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("handles Infinity metrics without crashing", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        uniqueSentenceRatio: Infinity,
        templateReuseRatio:  Infinity,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
  });

  it("handles negative metrics (treated as 0 / clamped)", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        uniqueSentenceRatio:       -0.5,
        templateReuseRatio:        -0.2,
        boilerplateParagraphCount: -3,
      }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.lifecycleState).toBe("COMPLETED");
  });

  it("handles ratio > 1 (right-clamped by piecewiseLinear)", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ uniqueSentenceRatio: 2.5, uniqueParagraphRatio: 1.5 }),
    );
    expect(isFinite(result.score)).toBe(true);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("score is always in [0, 100]", () => {
    const contexts = [
      makeContext(),
      makeContext({ uniqueSentenceRatio: 0, templateReuseRatio: 1 }),
      makeContext({ uniqueSentenceRatio: 1, templateReuseRatio: 0 }),
      makeContext({ wordCountIntro: 0, faqCount: 3 }),
      makeContext({ boilerplateParagraphCount: 10, paragraphCount: 3 }),
    ];
    for (const ctx of contexts) {
      const s = uniquenessQualityScorer.score(ctx).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 15. Golden vectors ────────────────────────────────────────────────────────
//
// Pre-verified arithmetic (IEEE 754 double precision). All calculations use:
//   piecewiseLinear (seo-scoring-core.ts)
//   weightedAverage (seo-scoring-core.ts)
//   roundScore = Math.round(x * 100) / 100
//
// Component weights: sentenceOriginality(35) + templateResistance(25)
//                    + structuralDiversity(20) + faqOriginality(15) + boilerplateGuard(5)
// Structural sub-weights: paraUniqueness(65) + sectionFreshness(35)
// FAQ sub-weights:        question(30) + answer(50) + diversity(20)
// Penalties: HIGH_TEMPLATE_REUSE (−10) when templateReuseRatio > 0.30
//            HIGH_BOILERPLATE    (−5)  when bpRate > 0.50

describe("UniquenessQualityScorer — golden vectors", () => {
  // ── GV1: Perfect uniqueness (score = 100) ─────────────────────────────────
  // All uniqueness ratios = 1.0, all similarities = 0, no boilerplate.
  // Every component scores 100 → weightedAverage = 100. No penalties.
  it("GV1: perfect uniqueness → 100", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            500,
        faqCount:                  5,
        paragraphCount:            5,
        uniqueSentenceRatio:       1.0,
        templateReuseRatio:        0,
        uniqueParagraphRatio:      1.0,
        introSectionSimilarity:    0,
        uniqueFaqQuestionRatio:    1.0,
        uniqueFaqAnswerRatio:      1.0,
        faqSimilarity:             0,
        boilerplateParagraphCount: 0,
      }),
    );
    expect(result.score).toBe(100);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV2: All duplicated (score = 0) ───────────────────────────────────────
  // All ratios = 0, all similarities = 1, all paragraphs boilerplate.
  // Every component scores 0 → raw = 0. Penalties applied → clamped to 0.
  it("GV2: all duplicated → 0", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            300,
        faqCount:                  5,
        paragraphCount:            5,
        uniqueSentenceRatio:       0,
        templateReuseRatio:        1,
        uniqueParagraphRatio:      0,
        introSectionSimilarity:    1,
        uniqueFaqQuestionRatio:    0,
        uniqueFaqAnswerRatio:      0,
        faqSimilarity:             1,
        boilerplateParagraphCount: 5,
      }),
    );
    expect(result.score).toBe(0);
  });

  // ── GV3: Good page, no FAQ, one boilerplate paragraph (score = 90.21) ─────
  // sentenceOriginality: piecewiseLinear(0.9) = 80 + 0.5×15 = 87.5
  // templateResistance:  piecewiseLinear(0.95) = 85 + (2/3)×15 = 95   [resistance=0.95]
  // structuralDiversity: para(0.85)=65+(2/3)×25=81.6667; fresh(0.9)=90+0.6×10=96
  //                      blend = (81.6667×65 + 96×35)/100 = 86.683355
  // faqOriginality:      neutral = 100  [faqCount=0]
  // boilerplateGuard:    bpFreeRate = 0.75 → 70  [exactly at breakpoint]
  // rawScore = (87.5×35 + 95×25 + 86.683355×20 + 100×15 + 70×5) / 100 = 90.21
  // Penalties: none (templateReuseRatio 0.05 < 0.30; bpRate 0.25 < 0.50)
  it("GV3: good page, no FAQ, 1 boilerplate paragraph → 90.21", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            500,
        faqCount:                  0,
        paragraphCount:            4,
        uniqueSentenceRatio:       0.9,
        templateReuseRatio:        0.05,
        uniqueParagraphRatio:      0.85,
        introSectionSimilarity:    0.1,
        uniqueFaqQuestionRatio:    1,
        uniqueFaqAnswerRatio:      1,
        faqSimilarity:             0,
        boilerplateParagraphCount: 1,
      }),
    );
    expect(result.score).toBe(90.21);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV4: Template-heavy page, single HIGH_TEMPLATE_REUSE penalty (score = 49.29) ──
  // sentenceOriginality: piecewiseLinear(0.7) = 55   [exact breakpoint]
  // templateResistance:  piecewiseLinear(0.6) = 20 + 0.5×40 = 40   [resistance=0.6]
  // structuralDiversity: para(0.67)=25+0.68×40=52.2; fresh(0.6)=65+0.4×25=75
  //                      blend = (52.2×65 + 75×35)/100 = 60.18
  // faqOriginality:      neutral = 100  [faqCount=0]
  // boilerplateGuard:    bpFreeRate = 2/3 → 40 + (2/3)×30 = 60
  // rawScore = (55×35 + 40×25 + 60.18×20 + 100×15 + 60×5) / 100 = 59.286
  // Penalty: HIGH_TEMPLATE_REUSE (−10); bpRate = 1/3 < 0.50 → no HIGH_BOILERPLATE
  // finalScore = roundScore(49.286) = 49.29
  it("GV4: template-heavy page, single penalty → 49.29", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            300,
        faqCount:                  0,
        paragraphCount:            3,
        uniqueSentenceRatio:       0.7,
        templateReuseRatio:        0.4,
        uniqueParagraphRatio:      0.67,
        introSectionSimilarity:    0.4,
        uniqueFaqQuestionRatio:    1,
        uniqueFaqAnswerRatio:      1,
        faqSimilarity:             0,
        boilerplateParagraphCount: 1,
      }),
    );
    expect(result.score).toBe(49.29);
    expect(result.breakdown["_penaltyTotal"]).toBe(10);
  });

  // ── GV5: Empty content (SKIP) ─────────────────────────────────────────────
  it("GV5: empty content → SKIP", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({ wordCountIntro: 0, faqCount: 0 }),
    );
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
    expect(result.normalizedScore).toBe(0);
  });

  // ── GV6: Good page with rich FAQ (score = 89.24) ──────────────────────────
  // sentenceOriginality: piecewiseLinear(0.88) = 80 + 0.3×15 = 84.5
  // templateResistance:  piecewiseLinear(0.98) = 85 + (13/15)×15 = 98   [resistance=0.98]
  // structuralDiversity: para(0.8)=65+(1/3)×25=73.3333; fresh(0.85)=90+0.4×10=94
  //                      blend = (73.3333×65 + 94×35)/100 = 80.5666
  // faqOriginality:      q(0.875)=65+(5/6)×23=84.1667; a(1.0)=100; div(0.8)=90+0.2×10=92
  //                      blend = (84.1667×30 + 100×50 + 92×20)/100 = 93.65
  // boilerplateGuard:    bpFreeRate=1.0 → 100
  // rawScore = (84.5×35 + 98×25 + 80.5666×20 + 93.65×15 + 100×5)/100 = 89.24
  // Penalties: none
  it("GV6: good page with rich FAQ → 89.24", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            400,
        faqCount:                  8,
        paragraphCount:            5,
        uniqueSentenceRatio:       0.88,
        templateReuseRatio:        0.02,
        uniqueParagraphRatio:      0.8,
        introSectionSimilarity:    0.15,
        uniqueFaqQuestionRatio:    0.875,
        uniqueFaqAnswerRatio:      1.0,
        faqSimilarity:             0.2,
        boilerplateParagraphCount: 0,
      }),
    );
    expect(result.score).toBe(89.24);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV7: Borderline quality, no penalties (score = 43.45) ─────────────────
  // sentenceOriginality: piecewiseLinear(0.5) = 20   [exact breakpoint]
  // templateResistance:  piecewiseLinear(0.8) = 60+(2/3)×25 = 76.6667   [resistance=0.8]
  // structuralDiversity: para(0.5)=25; fresh(0.4)=40+0.5×25=52.5
  //                      blend = (25×65 + 52.5×35)/100 = 34.625
  // faqOriginality:      q(0.667)=30+0.668×35=53.38; a(0.667)=53.38; div(0.5)=65
  //                      blend = (53.38×30 + 53.38×50 + 65×20)/100 = 55.704
  // boilerplateGuard:    bpFreeRate=0.5 → 40  [exact breakpoint]
  // rawScore = (20×35 + 76.6667×25 + 34.625×20 + 55.704×15 + 40×5)/100 = 43.45
  // Penalties: templateReuseRatio 0.2 < 0.3 → none; bpRate 0.5 NOT > 0.5 → none
  it("GV7: borderline quality, no penalties → 43.45", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            200,
        faqCount:                  3,
        paragraphCount:            2,
        uniqueSentenceRatio:       0.5,
        templateReuseRatio:        0.2,
        uniqueParagraphRatio:      0.5,
        introSectionSimilarity:    0.6,
        uniqueFaqQuestionRatio:    0.667,
        uniqueFaqAnswerRatio:      0.667,
        faqSimilarity:             0.5,
        boilerplateParagraphCount: 1,
      }),
    );
    expect(result.score).toBe(43.45);
    expect(result.breakdown["_penaltyTotal"]).toBe(0);
  });

  // ── GV8: Moderate quality, BOTH penalties (score = 26.51) ─────────────────
  // sentenceOriginality: piecewiseLinear(0.6) = 20 + 0.5×35 = 37.5
  // templateResistance:  piecewiseLinear(0.65) = 20 + 0.75×40 = 50   [resistance=0.65]
  // structuralDiversity: para(0.5)=25; fresh(0.5)=65  [exact at [0.5,65]]
  //                      blend = (25×65 + 65×35)/100 = 39
  // faqOriginality:      q(0.75)=65 [exact]; a(0.5)=30 [exact]; div(0.4)=40+0.5×25=52.5
  //                      blend = (65×30 + 30×50 + 52.5×20)/100 = 45
  // boilerplateGuard:    bpFreeRate=1/3 → 0+(2/3×0.5/0.5)×40 = (1/3)/0.5×40 = 26.667
  //                      bpFreeRate=1-4/6=1/3; [0,0]→[0.5,40]: t=0.6667→26.667
  // rawScore = (37.5×35 + 50×25 + 39×20 + 45×15 + 26.667×5)/100 = 41.51
  // Penalty: HIGH_TEMPLATE_REUSE (−10): 0.35 > 0.30
  // Penalty: HIGH_BOILERPLATE    (−5): 4/6=0.667 > 0.50
  // postPenalty = max(0, 41.51 − 15) = 26.51
  it("GV8: moderate quality, both penalties → 26.51", () => {
    const result = uniquenessQualityScorer.score(
      makeContext({
        wordCountIntro:            350,
        faqCount:                  4,
        paragraphCount:            6,
        uniqueSentenceRatio:       0.6,
        templateReuseRatio:        0.35,
        uniqueParagraphRatio:      0.5,
        introSectionSimilarity:    0.5,
        uniqueFaqQuestionRatio:    0.75,
        uniqueFaqAnswerRatio:      0.5,
        faqSimilarity:             0.6,
        boilerplateParagraphCount: 4,
      }),
    );
    expect(result.score).toBe(26.51);
    expect(result.breakdown["_penaltyTotal"]).toBe(15);
  });
});

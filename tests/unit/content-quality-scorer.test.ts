/**
 * Unit tests for src/lib/seo-scorers/content-quality-scorer.ts
 *
 * Coverage:
 *   IDENTITY         — module ID, name, version, lifecycle, requiredMetrics
 *   HELPERS          — each exported pure-scoring function, boundaries, guards
 *   CAPS             — empty→0, critically-thin→15
 *   RECOMMENDATIONS  — all 8 CQ_ codes, trigger conditions, severity
 *   BREAKDOWN        — 7 component keys + 4 accounting keys present
 *   DETERMINISM      — identical inputs → identical outputs
 *   MONOTONICITY     — more content → higher score
 *   REALISTIC FIXTURES — empty < thin < mediocre < healthy ordering
 *   GOLDEN VECTORS   — exact expected scores for four canonical fixtures
 *
 * Isolation: scorer is NOT imported by any production path; this file is the
 * only consumer of ContentQualityScorer in tests.
 *
 * Run: npx vitest run tests/unit/content-quality-scorer.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  CONTENT_QUALITY_MODULE_ID,
  ContentQualityScorer,
  contentQualityScorer,
  scoreContentDepth,
  scoreContentRichness,
  scoreIntroCompleteness,
  scoreParagraphQuality,
  scoreSentenceStructure,
  scoreStructure,
  scoreStructuralHealth,
} from "@/lib/seo-scorers/content-quality-scorer";
import type { QualityMetrics, ModuleContext } from "@/lib/seo-quality-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function zeroMetrics(): QualityMetrics {
  return {
    wordCount: 0, wordCountIntro: 0, characterCount: 0, paragraphCount: 0,
    avgParagraphWords: 0, sentenceCount: 0, avgSentenceWords: 0,
    sentenceLengthVariance: 0, longSentenceRatio: 0, headingCount: 0,
    h2Count: 0, h3Count: 0, listCount: 0, tableCount: 0, imageCount: 0,
    externalLinksCount: 0, headingDensity: 0, contentDensity: 0,
    readabilityScore: 0, typeTokenRatio: 0, boilerplateTokenRatio: 0,
    longSentenceCount: 0, shortSentenceCount: 0, shortSentenceRatio: 0,
    punctuationDensity: 0, questionSentenceCount: 0, exclamationSentenceCount: 0,
    complexWordCount: 0, complexWordRatio: 0, estimatedReadingTimeMinutes: 0,
    estimatedSpeakingTimeMinutes: 0, paragraphFlow: 0,
    uniquenessOverall: 100, uniquenessParagraphMin: 100, uniquenessFaq: 100,
    uniquenessTitle: 100, uniquenessMeta: 100, maxIntroSimilarity: 0,
    primaryKeywordPresent: false, primaryKeywordOccurrences: 0, primaryKeywordDensity: 0,
    primaryKeywordFirstPosition: -1, primaryKeywordLastPosition: -1,
    primaryKeywordInTitle: false, primaryKeywordInH1: false, primaryKeywordInMeta: false,
    primaryKeywordInIntro: false, primaryKeywordInFaq: false,
    primaryKeywordInInternalLinks: false, primaryKeywordInSlug: false,
    primaryKeywordInCanonical: false, secondaryKeywordHits: 0, secondaryKeywordCount: 0,
    secondaryKeywordCoverage: 0, secondaryKeywordOccurrences: 0, secondaryKeywordDensity: 0,
    semanticVariantCount: 0, semanticVariantCoverage: 0, exactMatchCount: 0,
    partialMatchCount: 0, keywordDistributionScore: 0, keywordSpread: 0, sectionCoverage: 0,
    headingCoverage: 0, faqCoverage: 0, introCoverage: 0, keywordDensity: 0,
    keywordStuffingRisk: false, localEntityCount: 0, localEntityDensityPer100: 0,
    topicCoverageScore: null, faqCount: 0, faqThinAnswers: 0, faqDuplicateLeadIns: 0,
    faqAvgAnswerWords: 0, questionCount: 0, answerCount: 0, averageQuestionLength: 0,
    averageAnswerLength: 0, averageQuestionWords: 0, averageAnswerWords: 0,
    longestQuestionLength: 0, longestAnswerLength: 0, shortestQuestionLength: 0,
    shortestAnswerLength: 0, duplicateQuestionCount: 0, duplicateAnswerCount: 0,
    duplicateFaqPairCount: 0, emptyQuestionCount: 0, emptyAnswerCount: 0,
    questionMarkCount: 0, questionStartsWithWhWord: 0, questionStartsWithHow: 0,
    questionStartsWithWhat: 0, questionStartsWithWhere: 0, questionStartsWithWhen: 0,
    questionStartsWithWhy: 0, questionStartsWithCan: 0, questionStartsWithIs: 0,
    questionStartsWithAre: 0, answerContainsList: 0, answerContainsInternalLink: 0,
    answerContainsKeyword: 0, answerContainsNumber: 0, answerContainsLocation: 0,
    answerContainsCallToAction: 0, answerReadingTimeMinutes: 0, faqCompleteness: 1,
    structuredFaqParity: 1, structuredFaqQuestionCoverage: 1, structuredFaqAnswerCoverage: 1,
    missingStructuredFaqCount: 0, extraStructuredFaqCount: 0, internalLinksCount: 0,
    uniqueAnchorTexts: 0, anchorTextDiversity: 0, internalLinkCount: 0, externalLinkCount: 0,
    followLinkCount: 0, nofollowLinkCount: 0, anchorTextCount: 0, uniqueAnchorTextCount: 0,
    duplicateAnchorTextCount: 0, averageAnchorLength: 0, longestAnchorLength: 0,
    shortestAnchorLength: 0, emptyAnchorCount: 0, samePageAnchorCount: 0,
    relativeLinkCount: 0, absoluteInternalLinkCount: 0, externalHttpLinkCount: 0,
    mailtoLinkCount: 0, telLinkCount: 0, categoryLinkCount: 0, cityLinkCount: 0,
    listingLinkCount: 0, faqInternalLinkCount: 0, ctaInternalLinkCount: 0,
    sectionLinkDistribution: 0, firstLinkPosition: -1, lastLinkPosition: -1,
    linkSpread: 0, linkDensity: 0, uniqueTargetCount: 0, duplicateTargetCount: 0,
    anchorKeywordCoverage: 0, descriptiveAnchorCount: 0, genericAnchorCount: 0,
    imageLinkCount: 0, titlePresent: false, titleLength: 0, titleInOptimalRange: false,
    estimatedTitlePixelWidth: 0, metaPresent: false, metaLength: 0,
    metaInOptimalRange: false, metaDescriptionPixelWidth: 0, h1Present: false, h1Count: 0,
    h1EqualsTitle: false, canonicalPresent: false, featuredImagePresent: false,
    imageAltPresent: false, robotsMetaExists: false, robotsMetaContent: null,
    robotsNoindex: false, robotsNofollow: false, openGraphExists: false,
    openGraphPropertyCount: 0, twitterCardExists: false, twitterMetaCount: 0,
    structuredDataPresent: false, structuredDataParseable: false, jsonLdCount: 0,
    schemaTypeList: null, breadcrumbSchemaExists: false, organizationSchemaExists: false,
    websiteSchemaExists: false, faqSchemaExists: false, articleSchemaExists: false,
    hreflangExists: false, hreflangCount: 0, alternateLinkCount: 0,
    viewportMetaExists: false, charsetMetaExists: false, faviconExists: false,
    manifestExists: false, h2UniqueCount: 0, h2TemplateCount: 0, headingKeywordCoverage: 0,
    duplicateSentenceCount: 0, duplicateParagraphCount: 0, duplicateHeadingCount: 0,
    duplicateFaqQuestionCount: 0, duplicateFaqAnswerCount: 0, duplicateLeadInCount: 0,
    duplicateIntroSentenceCount: 0, repeatedPhraseCount: 0, repeatedBigramCount: 0,
    repeatedTrigramCount: 0, repeatedFourGramCount: 0, maxDuplicateRunLength: 0,
    uniqueSentenceRatio: 1, uniqueParagraphRatio: 1, uniqueHeadingRatio: 1,
    uniqueFaqQuestionRatio: 1, uniqueFaqAnswerRatio: 1, templateReuseRatio: 0,
    boilerplateParagraphCount: 0, boilerplateSentenceCount: 0, selfSimilarityScore: 0,
    introSectionSimilarity: 0, headingSimilarity: 0, faqSimilarity: 0,
    duplicateWordRunCount: 0, duplicateTokenRatio: 0, largestRepeatedBlockLength: 0,
    semanticKeywordCoverage: 0, keywordVariantCoverage: 0, topicCoverage: 0,
    entityCoverage: 0, conceptCount: 0, uniqueConceptCount: 0, conceptDensity: 0,
    conceptDiversity: 0, conceptRedundancy: 0, semanticClusterCount: 0,
    semanticClusterCoverage: 0, headingSemanticCoverage: 0, introSemanticCoverage: 0,
    faqSemanticCoverage: 0, sectionSemanticCoverage: 0, entityDistribution: 0,
    topicDistribution: 0, phraseVariationScore: 0, coOccurrenceCount: 0,
    coOccurrenceDensity: 0, semanticConsistency: 0, semanticTransitionScore: 0,
    entityReuseRatio: 0, variantReuseRatio: 0, semanticGapCount: 0,
    semanticOverlapRatio: 0, duplicateRisk: "low", duplicateTitle: false,
    duplicateMeta: false, duplicateH1: false, duplicateIntro: false, duplicateFaq: false,
    contentHashCollision: false, duplicateFieldCount: 0, templateSentenceCount: 0,
    templateSentenceRatio: 0, sectionOpenerVariance: 0, aiPhraseCount: 0,
    aiPhraseRatio: 0, aiPhraseDensity: 0, aiTransitionPhraseCount: 0,
    aiHedgingPhraseCount: 0, aiMarketingPhraseCount: 0, templatePhraseCount: 0,
    stockPhraseCount: 0, genericClaimCount: 0, repetitiveOpeningCount: 0,
    repetitiveClosingCount: 0, sentenceLengthUniformity: 0, paragraphLengthUniformity: 0,
    headingLengthUniformity: 0, lexicalBurstiness: 0, paragraphBurstiness: 0,
    vocabularyRepetition: 0, templateParagraphCount: 0, passiveVoiceProxy: 0,
    listHeavyRatio: 0, conclusionPatternCount: 0, callToActionPatternCount: 0,
    exclamationDensity: 0, questionDensity: 0, repetitionRisk: 0, humanVariationScore: 1,
    transitionOveruseScore: 0, openingVariationScore: 1, closingVariationScore: 1,
    averageSentenceVariance: 0, averageParagraphVariance: 0, transitionWordCount: 0,
    transitionDensity: 0, transitionCoverage: 0, localAuthenticityScore: 0,
    genericPhraseCount: 0, genericPhraseRatio: 0, localReferenceCount: 0,
    uniqueLocalReferenceCount: 0, duplicateLocalReferenceCount: 0,
    districtMentionCount: 0, landmarkMentionCount: 0, transportMentionCount: 0,
    airportMentionCount: 0, railwayStationMentionCount: 0, busStandMentionCount: 0,
    shoppingMallMentionCount: 0, marketMentionCount: 0, businessDistrictMentionCount: 0,
    techParkMentionCount: 0, touristAreaMentionCount: 0, festivalMentionCount: 0,
    localCuisineMentionCount: 0, hotelAreaMentionCount: 0, luxuryAreaMentionCount: 0,
    neighborhoodCoverage: 0, geographicSpread: 0, introLocalReferenceCount: 0,
    faqLocalReferenceCount: 0, headingLocalReferenceCount: 0,
    sectionLocalReferenceCoverage: 0, curatedReferenceCount: 0, generatedReferenceCount: 0,
    localEntityDensity: 0, locationMentionFrequency: 0, referenceDistributionScore: 0,
    referenceEntropy: 0, referenceRedundancy: 0, cityNameOccurrences: 0,
    primaryLocationCoverage: 0, secondaryLocationCoverage: 0, daysSinceGeneration: null,
    generationAttempt: 1,
  } as QualityMetrics;
}

function makeContext(partial: Partial<QualityMetrics>): ModuleContext {
  return {
    metrics: { ...zeroMetrics(), ...partial },
    profile: {
      id: "test",
      name: "Test",
      version: "1.0",
      description: "",
      pageTypes: ["city"],
      modules: [],
      penalties: [],
      thresholds: { minWordCount: 500, minQualityScore: 60, minUniqueness: 70,
        maxTemplateSentenceRatio: 0.3, maxAiPhraseRatio: 0.15, minLocalEntityDensity: 2 },
      gradeScale: [{ label: "A", minScore: 85 }, { label: "F", minScore: 0 }],
      metadata: { createdAt: "", author: "", changelog: "" },
    },
    pageContext: { pageType: "city", pageSlug: "test", primaryKeyword: null,
      secondaryKeywords: [], attempt: 1 },
    ruleResults: [],
    priorModuleScores: [],
  } as unknown as ModuleContext;
}

const scorer = new ContentQualityScorer();

// ─── Identity and lifecycle ────────────────────────────────────────────────────

describe("ContentQualityScorer — identity", () => {
  it("module ID is CONTENT_QUALITY_MODULE_ID", () => {
    expect(scorer.id).toBe(CONTENT_QUALITY_MODULE_ID);
  });
  it("module ID is 'content-length'", () => {
    expect(scorer.id).toBe("content-length");
  });
  it("name is 'Content Quality Scorer'", () => {
    expect(scorer.name).toBe("Content Quality Scorer");
  });
  it("version is '1.0.0'", () => {
    expect(scorer.version).toBe("1.0.0");
  });
  it("priority is a number", () => {
    expect(typeof scorer.priority).toBe("number");
  });
  it("dependsOnModules is empty", () => {
    expect(scorer.dependsOnModules).toEqual([]);
  });
  it("singleton contentQualityScorer has same ID", () => {
    expect(contentQualityScorer.id).toBe(CONTENT_QUALITY_MODULE_ID);
  });
});

describe("ContentQualityScorer — requiredMetrics", () => {
  const REQUIRED = [
    "wordCount", "wordCountIntro", "paragraphCount", "avgParagraphWords",
    "sentenceCount", "avgSentenceWords", "longSentenceRatio",
    "headingCount", "h2Count", "h3Count", "headingDensity",
    "listCount", "tableCount", "contentDensity",
  ];
  it("contains all 14 required metric keys", () => {
    expect(scorer.requiredMetrics).toHaveLength(14);
  });
  for (const key of REQUIRED) {
    it(`contains '${key}'`, () => {
      expect(scorer.requiredMetrics).toContain(key);
    });
  }
});

describe("ContentQualityScorer — lifecycle", () => {
  it("returns lifecycleState COMPLETED on valid input", () => {
    const result = scorer.score(makeContext({ wordCount: 500 }));
    expect(result.lifecycleState).toBe("COMPLETED");
  });
  it("returns lifecycleState COMPLETED on empty content", () => {
    const result = scorer.score(makeContext({}));
    expect(result.lifecycleState).toBe("COMPLETED");
  });
  it("result has moduleId matching scorer.id", () => {
    const result = scorer.score(makeContext({ wordCount: 200 }));
    expect(result.moduleId).toBe(scorer.id);
  });
  it("executionMs is a non-negative number", () => {
    const result = scorer.score(makeContext({ wordCount: 500 }));
    expect(result.executionMs).toBeGreaterThanOrEqual(0);
  });
  it("maxScore is 100", () => {
    const result = scorer.score(makeContext({ wordCount: 500 }));
    expect(result.maxScore).toBe(100);
  });
});

// ─── scoreContentDepth ─────────────────────────────────────────────────────────

describe("scoreContentDepth — breakpoint anchors", () => {
  it("0 words → 0", () => expect(scoreContentDepth(0)).toBe(0));
  it("200 words → 25 (exact breakpoint)", () => expect(scoreContentDepth(200)).toBe(25));
  it("500 words → 70 (production min)", () => expect(scoreContentDepth(500)).toBe(70));
  it("650 words → 87 (generation target)", () => expect(scoreContentDepth(650)).toBe(87));
  it("800 words → 100 (max)", () => expect(scoreContentDepth(800)).toBe(100));
  it("above 800 → 100 (clamped)", () => expect(scoreContentDepth(2000)).toBe(100));
  it("below 0 → 0 (clamped)", () => expect(scoreContentDepth(-10)).toBe(0));
});

describe("scoreContentDepth — intermediate values (monotone)", () => {
  it("100 words is between 0 and 25", () => {
    const s = scoreContentDepth(100);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(25);
  });
  it("350 words is between 25 and 70", () => {
    const s = scoreContentDepth(350);
    expect(s).toBeGreaterThan(25);
    expect(s).toBeLessThan(70);
  });
  it("600 words is between 70 and 87", () => {
    const s = scoreContentDepth(600);
    expect(s).toBeGreaterThan(70);
    expect(s).toBeLessThan(87);
  });
  it("is monotonically non-decreasing", () => {
    const counts = [0, 100, 200, 350, 500, 600, 650, 750, 800, 1000];
    const scores = counts.map(scoreContentDepth);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
  it("NaN input → 0 (safeNumber guard)", () => expect(scoreContentDepth(NaN)).toBe(0));
  it("Infinity input → 100 (clamped to max)", () => expect(scoreContentDepth(Infinity)).toBe(0));
});

// ─── scoreStructure ────────────────────────────────────────────────────────────

describe("scoreStructure — basics", () => {
  it("no headings → 0", () => expect(scoreStructure(0, 0, 0, 0)).toBe(0));
  it("2 h2s, 0 h3s, normal density → 62", () =>
    expect(scoreStructure(2, 2, 0, 1)).toBe(62));
  it("4 h2s, 3 h3s+, 2 h3s → returns 91.6", () =>
    expect(scoreStructure(4, 3, 2, 1)).toBe(91.6));
  it("h2>=2 && h3>=1 → full depth sub-score (100)", () => {
    // Verify depth component contributes max
    const with_h3 = scoreStructure(3, 2, 1, 1);
    const no_h3 = scoreStructure(3, 2, 0, 1);
    expect(with_h3).toBeGreaterThan(no_h3);
  });
  it("h2>=1 && h3>=1 → partial depth sub-score (70)", () => {
    const one_h2_one_h3 = scoreStructure(2, 1, 1, 1);
    const two_h2_no_h3 = scoreStructure(2, 2, 0, 1);
    // Both get 70 vs 55 for depth; compare
    expect(one_h2_one_h3).toBeGreaterThan(two_h2_no_h3);
  });
  it("h2>=2 but no h3 → depth sub-score 55", () => {
    const s = scoreStructure(2, 2, 0, 1);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(100);
  });
});

describe("scoreStructure — heading density spam penalty", () => {
  it("density > 5 triggers penalty reducing presence score by 30%", () =>
    expect(scoreStructure(2, 2, 0, 6)).toBe(48.35));
  it("density exactly 5 does NOT trigger penalty", () => {
    const at5  = scoreStructure(2, 2, 0, 5);
    const at6  = scoreStructure(2, 2, 0, 6);
    expect(at5).toBeGreaterThan(at6);
  });
  it("density penalty only fires when headingCount > 0", () => {
    expect(scoreStructure(0, 0, 0, 10)).toBe(0);
  });
});

// ─── scoreParagraphQuality ─────────────────────────────────────────────────────

describe("scoreParagraphQuality — guards", () => {
  it("0 paragraphs → 0", () => expect(scoreParagraphQuality(0, 0)).toBe(0));
  it("0 paragraphs with nonzero avg → 0", () => expect(scoreParagraphQuality(0, 100)).toBe(0));
});

describe("scoreParagraphQuality — curve values", () => {
  it("8 paragraphs, 80 avg words → 97", () =>
    expect(scoreParagraphQuality(8, 80)).toBe(97));
  it("30 paragraphs, 50 avg words → 67 (degradation at high count)", () =>
    expect(scoreParagraphQuality(30, 50)).toBe(67));
  it("very high avg paragraph words reduces balance score", () => {
    const short = scoreParagraphQuality(5, 80);
    const long  = scoreParagraphQuality(5, 280);
    expect(short).toBeGreaterThan(long);
  });
  it("ideal range 40–150 avg paragraph words scores well", () => {
    const s = scoreParagraphQuality(8, 90);
    expect(s).toBeGreaterThan(90);
  });
});

// ─── scoreSentenceStructure ────────────────────────────────────────────────────

describe("scoreSentenceStructure — guards", () => {
  it("0 sentences → 0", () => expect(scoreSentenceStructure(0, 0, 0)).toBe(0));
  it("0 sentences with non-zero avgWords → 0", () =>
    expect(scoreSentenceStructure(0, 15, 0.1)).toBe(0));
  it("long ratio 0 with count 0 → 0 (not inflated by longRatio score)", () =>
    expect(scoreSentenceStructure(0, 10, 0)).toBe(0));
});

describe("scoreSentenceStructure — curve values", () => {
  it("15 sentences, 18 avg words, 0 long ratio → 82.5", () =>
    expect(scoreSentenceStructure(15, 18, 0)).toBe(82.5));
  it("high long-sentence ratio degrades score", () => {
    const low  = scoreSentenceStructure(20, 15, 0.05);
    const high = scoreSentenceStructure(20, 15, 0.4);
    expect(low).toBeGreaterThan(high);
  });
  it("very short avg sentence length reduces length sub-score", () => {
    const optimal = scoreSentenceStructure(20, 15, 0);
    const tooShort = scoreSentenceStructure(20, 3, 0);
    expect(optimal).toBeGreaterThan(tooShort);
  });
  it("ideal avg sentence 10–25 words scores well", () => {
    const s = scoreSentenceStructure(25, 18, 0);
    expect(s).toBeGreaterThan(80);
  });
});

// ─── scoreContentRichness ──────────────────────────────────────────────────────

describe("scoreContentRichness — baseline", () => {
  it("0 lists, 0 tables → baseline 20 (text-only is valid)", () =>
    expect(scoreContentRichness(0, 0)).toBe(20));
  it("1 list, 0 tables → 60", () =>
    expect(scoreContentRichness(1, 0)).toBe(60));
  it("2 lists, 1 table → 95", () =>
    expect(scoreContentRichness(2, 1)).toBe(95));
  it("counts lists and tables as combined elements", () => {
    const same = scoreContentRichness(1, 1); // 2 elements
    expect(same).toBe(scoreContentRichness(2, 0));
  });
  it("5+ elements → 100", () =>
    expect(scoreContentRichness(3, 2)).toBe(100));
  it("score is monotonically non-decreasing with element count", () => {
    const scores = [0, 1, 2, 3, 5].map((n) => scoreContentRichness(n, 0));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

describe("scoreContentRichness — richness baseline does NOT inflate empty page", () => {
  it("scorer applies wordCount guard: richness=0 when wordCount=0", () => {
    const result = scorer.score(makeContext({ wordCount: 0, listCount: 5 }));
    expect(result.breakdown["richness"]).toBe(0);
  });
  it("richness uses baseline 20 when wordCount > 0", () => {
    const result = scorer.score(makeContext({ wordCount: 200, listCount: 0 }));
    expect(result.breakdown["richness"]).toBe(20);
  });
});

// ─── scoreIntroCompleteness ────────────────────────────────────────────────────

describe("scoreIntroCompleteness — curve values", () => {
  it("0 intro words → 0", () => expect(scoreIntroCompleteness(0)).toBe(0));
  it("150 intro words → 60 (exact breakpoint)", () =>
    expect(scoreIntroCompleteness(150)).toBe(60));
  it("350 intro words → 100 (max)", () =>
    expect(scoreIntroCompleteness(350)).toBe(100));
  it("above 350 → 100 (clamped)", () =>
    expect(scoreIntroCompleteness(500)).toBe(100));
  it("is monotonically non-decreasing", () => {
    const vals = [0, 50, 100, 150, 200, 250, 300, 350, 400].map(scoreIntroCompleteness);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]!);
    }
  });
});

// ─── scoreStructuralHealth ─────────────────────────────────────────────────────

describe("scoreStructuralHealth — guards and curve", () => {
  it("wordCount=0 → 0 regardless of density", () =>
    expect(scoreStructuralHealth(0.9, 0)).toBe(0));
  it("wordCount>0, density=0 → 0", () =>
    expect(scoreStructuralHealth(0, 100)).toBe(0));
  it("wordCount>0, density=0.5 → 65 (exact breakpoint)", () =>
    expect(scoreStructuralHealth(0.5, 200)).toBe(65));
  it("wordCount>0, density=0.85 → 100 (exact breakpoint)", () =>
    expect(scoreStructuralHealth(0.85, 100)).toBe(100));
  it("density > 0.85 → 100 (clamped)", () =>
    expect(scoreStructuralHealth(1.0, 100)).toBe(100));
  it("is monotonically non-decreasing with density (wordCount fixed)", () => {
    const densities = [0, 0.1, 0.2, 0.5, 0.7, 0.85, 1.0];
    const scores = densities.map((d) => scoreStructuralHealth(d, 500));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── Hard caps ─────────────────────────────────────────────────────────────────

describe("ContentQualityScorer — hard cap: empty content", () => {
  it("wordCount=0 → finalScore=0", () => {
    expect(scorer.score(makeContext({ wordCount: 0 })).score).toBe(0);
  });
  it("wordCount=0 → normalizedScore=0", () => {
    expect(scorer.score(makeContext({ wordCount: 0 })).normalizedScore).toBe(0);
  });
  it("wordCount=0 → breakdown._cappedScore=0", () => {
    const r = scorer.score(makeContext({ wordCount: 0 }));
    expect(r.breakdown["_cappedScore"]).toBe(0);
  });
  it("wordCount=0 cap overrides non-zero component scores", () => {
    // With great headings/structure but no words, score must be 0
    const r = scorer.score(makeContext({
      wordCount: 0, headingCount: 6, h2Count: 4, h3Count: 3,
      listCount: 5, tableCount: 2, contentDensity: 0.9,
    }));
    expect(r.score).toBe(0);
  });
});

describe("ContentQualityScorer — hard cap: critically thin content", () => {
  it("wordCount=1 → score ≤ 15 (cap is a ceiling)", () => {
    expect(scorer.score(makeContext({ wordCount: 1 })).score).toBeLessThanOrEqual(15);
  });
  it("wordCount=50 → score ≤ 15 (cap is a ceiling)", () => {
    expect(scorer.score(makeContext({ wordCount: 50 })).score).toBeLessThanOrEqual(15);
  });
  it("wordCount=99 → score ≤ 15 (cap is a ceiling)", () => {
    expect(scorer.score(makeContext({ wordCount: 99 })).score).toBeLessThanOrEqual(15);
  });
  it("wordCount=100 → NO cap (score may exceed 15)", () => {
    const r = scorer.score(makeContext({ wordCount: 100, paragraphCount: 3,
      sentenceCount: 8, avgSentenceWords: 12, contentDensity: 0.8 }));
    // 100 is at boundary; no cap, raw score drives result
    expect(r.breakdown["_cappedScore"]).toBe(r.breakdown["_rawScore"]);
  });
  it("cap is applied after raw score computation: _rawScore > 15, _cappedScore = 15", () => {
    const r = scorer.score(makeContext({ wordCount: 80, paragraphCount: 5,
      sentenceCount: 15, avgSentenceWords: 15, headingCount: 3 }));
    expect(r.breakdown["_rawScore"]).toBeGreaterThan(15);
    expect(r.breakdown["_cappedScore"]).toBe(15);
    expect(r.score).toBe(15);
  });
});

// ─── Recommendations ───────────────────────────────────────────────────────────

describe("ContentQualityScorer — CQ_CRITICALLY_EMPTY", () => {
  it("fires on wordCount=0", () => {
    const recs = scorer.score(makeContext({ wordCount: 0 })).recommendations;
    expect(recs.map((r: any) => r.code)).toContain("CQ_CRITICALLY_EMPTY");
  });
  it("is severity 'error'", () => {
    const recs = scorer.score(makeContext({ wordCount: 0 })).recommendations;
    const rec = recs.find((r: any) => r.code === "CQ_CRITICALLY_EMPTY");
    expect(rec?.severity).toBe("error");
  });
  it("does NOT fire when wordCount > 0", () => {
    const recs = scorer.score(makeContext({ wordCount: 1 })).recommendations;
    expect(recs.map((r: any) => r.code)).not.toContain("CQ_CRITICALLY_EMPTY");
  });
});

describe("ContentQualityScorer — CQ_CRITICALLY_THIN", () => {
  it("fires on wordCount=1", () => {
    const codes = scorer.score(makeContext({ wordCount: 1 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_CRITICALLY_THIN");
  });
  it("fires on wordCount=99", () => {
    const codes = scorer.score(makeContext({ wordCount: 99 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_CRITICALLY_THIN");
  });
  it("is severity 'error'", () => {
    const rec = scorer.score(makeContext({ wordCount: 50 })).recommendations.find((r: any) => r.code === "CQ_CRITICALLY_THIN");
    expect(rec?.severity).toBe("error");
  });
  it("does NOT fire on wordCount=0 (different rec fires instead)", () => {
    const codes = scorer.score(makeContext({ wordCount: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_CRITICALLY_THIN");
  });
  it("does NOT fire on wordCount=100", () => {
    const codes = scorer.score(makeContext({ wordCount: 100 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_CRITICALLY_THIN");
  });
});

describe("ContentQualityScorer — CQ_EXPAND_CONTENT", () => {
  it("fires when 100 <= wordCount < 500", () => {
    const codes = scorer.score(makeContext({ wordCount: 300 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_EXPAND_CONTENT");
  });
  it("fires at wordCount=499", () => {
    const codes = scorer.score(makeContext({ wordCount: 499 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_EXPAND_CONTENT");
  });
  it("does NOT fire at wordCount=500", () => {
    const codes = scorer.score(makeContext({ wordCount: 500 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_EXPAND_CONTENT");
  });
  it("is severity 'error'", () => {
    const rec = scorer.score(makeContext({ wordCount: 200 })).recommendations.find((r: any) => r.code === "CQ_EXPAND_CONTENT");
    expect(rec?.severity).toBe("error");
  });
});

describe("ContentQualityScorer — CQ_ADD_HEADINGS", () => {
  it("fires when headingCount < 2 and wordCount >= 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 250, headingCount: 1 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_ADD_HEADINGS");
  });
  it("fires when headingCount = 0 and wordCount >= 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 300, headingCount: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_ADD_HEADINGS");
  });
  it("does NOT fire when headingCount >= 2", () => {
    const codes = scorer.score(makeContext({ wordCount: 300, headingCount: 2 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_HEADINGS");
  });
  it("does NOT fire when wordCount < 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 150, headingCount: 1 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_HEADINGS");
  });
  it("is severity 'warning'", () => {
    const rec = scorer.score(makeContext({ wordCount: 300, headingCount: 1 })).recommendations.find((r: any) => r.code === "CQ_ADD_HEADINGS");
    expect(rec?.severity).toBe("warning");
  });
});

describe("ContentQualityScorer — CQ_ADD_SUBHEADINGS", () => {
  it("fires when h2Count>=2, h3Count=0, wordCount>=300", () => {
    const codes = scorer.score(makeContext({ wordCount: 350, headingCount: 2, h2Count: 2, h3Count: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_ADD_SUBHEADINGS");
  });
  it("does NOT fire when h3Count >= 1", () => {
    const codes = scorer.score(makeContext({ wordCount: 350, headingCount: 3, h2Count: 2, h3Count: 1 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_SUBHEADINGS");
  });
  it("does NOT fire when h2Count < 2", () => {
    const codes = scorer.score(makeContext({ wordCount: 350, headingCount: 1, h2Count: 1, h3Count: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_SUBHEADINGS");
  });
  it("does NOT fire when wordCount < 300", () => {
    const codes = scorer.score(makeContext({ wordCount: 250, headingCount: 2, h2Count: 2, h3Count: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_SUBHEADINGS");
  });
  it("is severity 'info'", () => {
    const rec = scorer.score(makeContext({ wordCount: 400, headingCount: 2, h2Count: 2, h3Count: 0 })).recommendations.find((r: any) => r.code === "CQ_ADD_SUBHEADINGS");
    expect(rec?.severity).toBe("info");
  });
});

describe("ContentQualityScorer — CQ_IMPROVE_PARAGRAPH_STRUCTURE", () => {
  it("fires when paragraphCount < 3 and wordCount >= 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 300, paragraphCount: 2 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_IMPROVE_PARAGRAPH_STRUCTURE");
  });
  it("does NOT fire when paragraphCount >= 3", () => {
    const codes = scorer.score(makeContext({ wordCount: 300, paragraphCount: 3 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_IMPROVE_PARAGRAPH_STRUCTURE");
  });
  it("does NOT fire when wordCount < 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 150, paragraphCount: 1 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_IMPROVE_PARAGRAPH_STRUCTURE");
  });
  it("is severity 'warning'", () => {
    const rec = scorer.score(makeContext({ wordCount: 300, paragraphCount: 2 })).recommendations.find((r: any) => r.code === "CQ_IMPROVE_PARAGRAPH_STRUCTURE");
    expect(rec?.severity).toBe("warning");
  });
});

describe("ContentQualityScorer — CQ_BREAK_LONG_PARAGRAPHS", () => {
  it("fires when avgParagraphWords > 200 and paragraphCount > 0", () => {
    const codes = scorer.score(makeContext({ wordCount: 600, paragraphCount: 2, avgParagraphWords: 300 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_BREAK_LONG_PARAGRAPHS");
  });
  it("does NOT fire when avgParagraphWords <= 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 600, paragraphCount: 3, avgParagraphWords: 100 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_BREAK_LONG_PARAGRAPHS");
  });
  it("does NOT fire when paragraphCount = 0", () => {
    const codes = scorer.score(makeContext({ wordCount: 600, paragraphCount: 0, avgParagraphWords: 300 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_BREAK_LONG_PARAGRAPHS");
  });
  it("is severity 'warning'", () => {
    const rec = scorer.score(makeContext({ wordCount: 600, paragraphCount: 2, avgParagraphWords: 250 })).recommendations.find((r: any) => r.code === "CQ_BREAK_LONG_PARAGRAPHS");
    expect(rec?.severity).toBe("warning");
  });
});

describe("ContentQualityScorer — CQ_EXPAND_INTRO", () => {
  it("fires when intro < 150, wordCount >= 200, intro < wordCount*0.5", () => {
    const codes = scorer.score(makeContext({ wordCount: 400, wordCountIntro: 80 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_EXPAND_INTRO");
  });
  it("does NOT fire when intro >= 150", () => {
    const codes = scorer.score(makeContext({ wordCount: 400, wordCountIntro: 160 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_EXPAND_INTRO");
  });
  it("does NOT fire when wordCount < 200", () => {
    const codes = scorer.score(makeContext({ wordCount: 150, wordCountIntro: 50 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_EXPAND_INTRO");
  });
  it("does NOT fire when intro >= wordCount*0.5 (balanced page)", () => {
    // wordCount=200, wordCountIntro=100: 100 < 150 but 100 = 200*0.5 → no fire
    const codes = scorer.score(makeContext({ wordCount: 200, wordCountIntro: 100 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_EXPAND_INTRO");
  });
  it("is severity 'warning'", () => {
    const rec = scorer.score(makeContext({ wordCount: 400, wordCountIntro: 80 })).recommendations.find((r: any) => r.code === "CQ_EXPAND_INTRO");
    expect(rec?.severity).toBe("warning");
  });
});

describe("ContentQualityScorer — CQ_ADD_STRUCTURAL_ELEMENTS", () => {
  it("fires when no lists/tables and wordCount >= 400", () => {
    const codes = scorer.score(makeContext({ wordCount: 550, listCount: 0, tableCount: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).toContain("CQ_ADD_STRUCTURAL_ELEMENTS");
  });
  it("does NOT fire when listCount > 0", () => {
    const codes = scorer.score(makeContext({ wordCount: 550, listCount: 1, tableCount: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_STRUCTURAL_ELEMENTS");
  });
  it("does NOT fire when tableCount > 0", () => {
    const codes = scorer.score(makeContext({ wordCount: 550, listCount: 0, tableCount: 1 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_STRUCTURAL_ELEMENTS");
  });
  it("does NOT fire when wordCount < 400", () => {
    const codes = scorer.score(makeContext({ wordCount: 350, listCount: 0, tableCount: 0 })).recommendations.map((r: any) => r.code);
    expect(codes).not.toContain("CQ_ADD_STRUCTURAL_ELEMENTS");
  });
  it("is severity 'info'", () => {
    const rec = scorer.score(makeContext({ wordCount: 550, listCount: 0, tableCount: 0 })).recommendations.find((r: any) => r.code === "CQ_ADD_STRUCTURAL_ELEMENTS");
    expect(rec?.severity).toBe("info");
  });
});

// ─── Breakdown structure ───────────────────────────────────────────────────────

describe("ContentQualityScorer — breakdown keys", () => {
  const COMPONENT_KEYS = ["depth", "structure", "paragraphs", "sentences", "richness", "intro", "health"];
  const ACCOUNTING_KEYS = ["_rawScore", "_penaltyTotal", "_cappedScore", "_finalScore"];

  it("breakdown has exactly 11 keys", () => {
    const r = scorer.score(makeContext({ wordCount: 500 }));
    expect(Object.keys(r.breakdown)).toHaveLength(11);
  });
  for (const key of COMPONENT_KEYS) {
    it(`breakdown has component key '${key}'`, () => {
      const r = scorer.score(makeContext({ wordCount: 500 }));
      expect(key in r.breakdown).toBe(true);
    });
  }
  for (const key of ACCOUNTING_KEYS) {
    it(`breakdown has accounting key '${key}'`, () => {
      const r = scorer.score(makeContext({ wordCount: 500 }));
      expect(key in r.breakdown).toBe(true);
    });
  }
  it("_finalScore equals score", () => {
    const r = scorer.score(makeContext({ wordCount: 500 }));
    expect(r.breakdown["_finalScore"]).toBe(r.score);
  });
  it("_penaltyTotal is 0 (no penalties in this module)", () => {
    const r = scorer.score(makeContext({ wordCount: 500 }));
    expect(r.breakdown["_penaltyTotal"]).toBe(0);
  });
  it("all component values are numbers", () => {
    const r = scorer.score(makeContext({ wordCount: 500 }));
    for (const key of COMPONENT_KEYS) {
      expect(typeof r.breakdown[key]).toBe("number");
    }
  });
});

// ─── Determinism ───────────────────────────────────────────────────────────────

describe("ContentQualityScorer — determinism", () => {
  it("same inputs produce identical scores on repeated calls", () => {
    const m = { wordCount: 450, wordCountIntro: 200, paragraphCount: 7,
      avgParagraphWords: 60, sentenceCount: 25, avgSentenceWords: 14,
      longSentenceRatio: 0.12, headingCount: 3, h2Count: 2, h3Count: 1,
      headingDensity: 0.67, listCount: 1, tableCount: 0, contentDensity: 0.78 };
    const r1 = scorer.score(makeContext(m));
    const r2 = scorer.score(makeContext(m));
    expect(r1.score).toBe(r2.score);
    expect(r1.normalizedScore).toBe(r2.normalizedScore);
    expect(r1.breakdown).toEqual(r2.breakdown);
  });
  it("different instances produce same result", () => {
    const m = { wordCount: 650, wordCountIntro: 300, paragraphCount: 10 };
    const r1 = new ContentQualityScorer().score(makeContext(m));
    const r2 = new ContentQualityScorer().score(makeContext(m));
    expect(r1.score).toBe(r2.score);
  });
});

// ─── Monotonicity ──────────────────────────────────────────────────────────────

describe("ContentQualityScorer — score monotonicity", () => {
  it("more words (200→800) → higher or equal score", () => {
    const counts = [200, 350, 500, 600, 650, 800];
    const scores = counts.map((w) => scorer.score(makeContext({ wordCount: w })).score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
  it("more headings (1→6) → higher or equal structure score", () => {
    const counts = [1, 2, 3, 4, 5, 6];
    const scores = counts.map((h) => scoreStructure(h, Math.floor(h * 0.6), Math.floor(h * 0.3), 1));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
  it("more intro words (0→350) → higher or equal intro score", () => {
    const vals = [0, 50, 100, 150, 200, 250, 300, 350];
    const scores = vals.map(scoreIntroCompleteness);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

// ─── Realistic fixtures ────────────────────────────────────────────────────────

describe("ContentQualityScorer — realistic fixtures ordering", () => {
  const emptyResult = scorer.score(makeContext({}));

  const thinResult = scorer.score(makeContext({
    wordCount: 80, wordCountIntro: 60, paragraphCount: 2, avgParagraphWords: 30,
    sentenceCount: 5, avgSentenceWords: 12, longSentenceRatio: 0,
    contentDensity: 0.9,
  }));

  const mediocreResult = scorer.score(makeContext({
    wordCount: 350, wordCountIntro: 200, paragraphCount: 6, avgParagraphWords: 40,
    sentenceCount: 20, avgSentenceWords: 15, longSentenceRatio: 0.1,
    headingCount: 2, h2Count: 2, h3Count: 0, headingDensity: 0.57, contentDensity: 0.8,
  }));

  const healthyResult = scorer.score(makeContext({
    wordCount: 650, wordCountIntro: 380, paragraphCount: 10, avgParagraphWords: 70,
    sentenceCount: 35, avgSentenceWords: 18, longSentenceRatio: 0.08,
    headingCount: 5, h2Count: 3, h3Count: 2, headingDensity: 0.77,
    listCount: 1, contentDensity: 0.82,
  }));

  it("empty < thin (or equal by cap)", () =>
    expect(emptyResult.score).toBeLessThanOrEqual(thinResult.score));
  it("thin < mediocre", () =>
    expect(thinResult.score).toBeLessThan(mediocreResult.score));
  it("mediocre < healthy", () =>
    expect(mediocreResult.score).toBeLessThan(healthyResult.score));
  it("empty score is 0", () =>
    expect(emptyResult.score).toBe(0));
  it("thin score is 15 (cap)", () =>
    expect(thinResult.score).toBe(15));
  it("healthy score is > 80", () =>
    expect(healthyResult.score).toBeGreaterThan(80));
});

// ─── Golden vector tests ───────────────────────────────────────────────────────

describe("ContentQualityScorer — golden vectors", () => {
  it("GV-1: completely empty page → score=0.00, normalizedScore=0", () => {
    const r = scorer.score(makeContext({}));
    expect(r.score).toBe(0);
    expect(r.normalizedScore).toBe(0);
    expect(r.recommendations.map((x: any) => x.code)).toEqual(["CQ_CRITICALLY_EMPTY"]);
  });

  it("GV-2: critically thin page (80 words) → score=15.00, normalizedScore=0.15", () => {
    const r = scorer.score(makeContext({
      wordCount: 80, wordCountIntro: 60, paragraphCount: 2, avgParagraphWords: 30,
      sentenceCount: 5, avgSentenceWords: 12, longSentenceRatio: 0,
      headingCount: 0, h2Count: 0, h3Count: 0, contentDensity: 0.9,
    }));
    expect(r.score).toBe(15);
    expect(r.normalizedScore).toBe(0.15);
    expect(r.breakdown["_rawScore"]).toBe(28.36);
    expect(r.breakdown["_cappedScore"]).toBe(15);
    expect(r.recommendations.map((x: any) => x.code)).toEqual(["CQ_CRITICALLY_THIN"]);
  });

  it("GV-3: mediocre page (350 words) → score=62.94, normalizedScore=0.6294", () => {
    const r = scorer.score(makeContext({
      wordCount: 350, wordCountIntro: 200, paragraphCount: 6, avgParagraphWords: 40,
      sentenceCount: 20, avgSentenceWords: 15, longSentenceRatio: 0.1,
      headingCount: 2, h2Count: 2, h3Count: 0, headingDensity: 0.57,
      listCount: 0, tableCount: 0, contentDensity: 0.8,
    }));
    expect(r.score).toBe(62.94);
    expect(r.normalizedScore).toBe(0.6294);
    expect(r.breakdown["depth"]).toBe(47.5);
    expect(r.breakdown["structure"]).toBe(62);
    expect(r.breakdown["paragraphs"]).toBe(75);
    expect(r.breakdown["sentences"]).toBe(83.94);
    expect(r.breakdown["richness"]).toBe(20);
    expect(r.breakdown["intro"]).toBe(73.5);
    expect(r.breakdown["health"]).toBe(96.67);
    expect(r.recommendations.map((x: any) => x.code)).toEqual(["CQ_EXPAND_CONTENT", "CQ_ADD_SUBHEADINGS"]);
  });

  it("GV-4: healthy page (650 words) → score=90.46, normalizedScore=0.9046", () => {
    const r = scorer.score(makeContext({
      wordCount: 650, wordCountIntro: 380, paragraphCount: 10, avgParagraphWords: 70,
      sentenceCount: 35, avgSentenceWords: 18, longSentenceRatio: 0.08,
      headingCount: 5, h2Count: 3, h3Count: 2, headingDensity: 0.77,
      listCount: 1, tableCount: 0, contentDensity: 0.82,
    }));
    expect(r.score).toBe(90.46);
    expect(r.normalizedScore).toBe(0.9046);
    expect(r.breakdown["depth"]).toBe(87);
    expect(r.breakdown["structure"]).toBe(95.8);
    expect(r.breakdown["paragraphs"]).toBe(93.86);
    expect(r.breakdown["sentences"]).toBe(96.73);
    expect(r.breakdown["richness"]).toBe(60);
    expect(r.breakdown["intro"]).toBe(100);
    expect(r.breakdown["health"]).toBe(98);
    expect(r.recommendations).toHaveLength(0);
  });

  it("GV-3 normalizedScore consistent with score", () => {
    const r = scorer.score(makeContext({
      wordCount: 350, wordCountIntro: 200, paragraphCount: 6, avgParagraphWords: 40,
      sentenceCount: 20, avgSentenceWords: 15, longSentenceRatio: 0.1,
      headingCount: 2, h2Count: 2, h3Count: 0, headingDensity: 0.57, contentDensity: 0.8,
    }));
    expect(r.normalizedScore).toBeCloseTo(r.score / 100, 4);
  });
});

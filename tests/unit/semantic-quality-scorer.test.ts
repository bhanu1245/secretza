import { describe, it, expect } from "vitest";
import {
  SemanticQualityScorer,
  semanticQualityScorer,
  SEMANTIC_QUALITY_MODULE_ID,
  scoreCoverage,
  scoreSectionDistribution,
  scoreDiversity,
  scoreRelationships,
  scoreCoherence,
} from "@/lib/seo-scorers/semantic-quality-scorer";
import type { ModuleContext, QualityMetrics, ScoringProfile } from "@/lib/seo-quality-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    // Content metrics (ContentMetricsProvider)
    wordCount: 700, wordCountIntro: 250, paragraphCount: 8,
    avgParagraphWords: 80, sentenceCount: 35, avgSentenceWords: 18,
    longSentenceRatio: 0.1, headingCount: 5, h2Count: 3, h3Count: 2,
    headingDensity: 2, listCount: 2, tableCount: 0, contentDensity: 0.85,

    // Keyword metrics (KeywordMetricsProvider)
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

    // Legacy keyword fields
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

    // Duplicate content
    duplicateSentenceCount: 0, duplicateParagraphCount: 0,
    duplicateHeadingCount: 0, duplicateFaqQuestionCount: 0,
    duplicateFaqAnswerCount: 0, duplicateLeadInCount: 0,
    duplicateIntroSentenceCount: 0, repeatedPhraseCount: 2,

    // Semantic (SemanticMetricsProvider) — moderate defaults
    semanticKeywordCoverage: 0.7, keywordVariantCoverage: 0.6,
    topicCoverage: 0.75, entityCoverage: 0.6,
    conceptCount: 15, uniqueConceptCount: 12,
    conceptDensity: 0.02, conceptDiversity: 0.7,
    conceptRedundancy: 0.2,
    semanticClusterCount: 3, semanticClusterCoverage: 0.75,
    headingSemanticCoverage: 0.7, introSemanticCoverage: 0.75,
    faqSemanticCoverage: 0.6, sectionSemanticCoverage: 0.7,
    entityDistribution: 0.6, topicDistribution: 0.5,
    phraseVariationScore: 0.6, coOccurrenceCount: 8,
    coOccurrenceDensity: 0.8, semanticConsistency: 0.75,
    semanticTransitionScore: 0.6, entityReuseRatio: 0.3,
    variantReuseRatio: 0.25, semanticGapCount: 1,
    semanticOverlapRatio: 0.5,

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

    // Duplicate risk
    duplicateRisk: "low",

    ...overrides,
  } as QualityMetrics;
}

function makeContext(metricsOverrides: Partial<QualityMetrics> = {}): ModuleContext {
  return {
    metrics: makeMetrics(metricsOverrides),
    profile: { id: "test-profile", modules: [], pageTypes: ["city"] } as unknown as ScoringProfile,
    pageContext: {
      pageType: "city",
      pageSlug: "test-city",
      primaryKeyword: "test keyword",
      secondaryKeywords: [],
      attempt: 1,
    },
    ruleResults: [],
    priorModuleScores: [],
  };
}

// ─── 1. Identity ──────────────────────────────────────────────────────────────

describe("SemanticQualityScorer — identity", () => {
  const scorer = new SemanticQualityScorer();

  it("has correct module ID", () => {
    expect(scorer.id).toBe("semantic-quality");
    expect(scorer.id).toBe(SEMANTIC_QUALITY_MODULE_ID);
  });

  it("singleton has same ID as class", () => {
    expect(semanticQualityScorer.id).toBe(SEMANTIC_QUALITY_MODULE_ID);
  });

  it("has required string fields", () => {
    expect(typeof scorer.name).toBe("string");
    expect(typeof scorer.description).toBe("string");
    expect(scorer.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("priority is a positive number", () => {
    expect(typeof scorer.priority).toBe("number");
    expect(scorer.priority).toBeGreaterThan(0);
  });

  it("requiredMetrics includes all SMP-owned fields", () => {
    const r = scorer.requiredMetrics as readonly string[];
    expect(r).toContain("semanticClusterCount");
    expect(r).toContain("semanticClusterCoverage");
    expect(r).toContain("sectionSemanticCoverage");
    expect(r).toContain("introSemanticCoverage");
    expect(r).toContain("headingSemanticCoverage");
    expect(r).toContain("faqSemanticCoverage");
    expect(r).toContain("conceptDiversity");
    expect(r).toContain("conceptRedundancy");
    expect(r).toContain("phraseVariationScore");
    expect(r).toContain("coOccurrenceDensity");
    expect(r).toContain("semanticConsistency");
    expect(r).toContain("semanticTransitionScore");
    expect(r).toContain("topicDistribution");
    expect(r).toContain("semanticGapCount");
  });

  it("requiredMetrics includes context guard fields from other providers", () => {
    const r = scorer.requiredMetrics as readonly string[];
    expect(r).toContain("wordCountIntro");
    expect(r).toContain("headingCount");
    expect(r).toContain("faqCount");
    expect(r).toContain("paragraphCount");
    expect(r).toContain("primaryKeywordPresent");
  });

  it("dependsOnModules is empty (no module dependencies)", () => {
    expect(scorer.dependsOnModules).toEqual([]);
  });
});

// ─── 2. Skip conditions ───────────────────────────────────────────────────────

describe("SemanticQualityScorer — skip conditions", () => {
  const scorer = new SemanticQualityScorer();

  it("returns SKIPPED when metrics is null", () => {
    const ctx: ModuleContext = {
      metrics: null as unknown as QualityMetrics,
      profile: { id: "test", modules: [], pageTypes: [] } as unknown as ScoringProfile,
      pageContext: { pageType: "city", pageSlug: "s", primaryKeyword: null, secondaryKeywords: [], attempt: 1 },
      ruleResults: [],
      priorModuleScores: [],
    };
    const result = scorer.score(ctx);
    expect(result.lifecycleState).toBe("SKIPPED");
  });

  it("returns SKIPPED when semanticClusterCount === 0", () => {
    const result = scorer.score(makeContext({ semanticClusterCount: 0 }));
    expect(result.lifecycleState).toBe("SKIPPED");
  });

  it("SKIPPED result has score of 0", () => {
    const result = scorer.score(makeContext({ semanticClusterCount: 0 }));
    expect(result.score).toBe(0);
  });

  it("SKIPPED result has moduleId matching the scorer", () => {
    const result = scorer.score(makeContext({ semanticClusterCount: 0 }));
    expect(result.moduleId).toBe(SEMANTIC_QUALITY_MODULE_ID);
  });

  it("scores normally when semanticClusterCount === 1", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 1,
      semanticClusterCoverage: 1.0,
    }));
    expect(result.lifecycleState).not.toBe("SKIPPED");
    expect(result.score).toBeGreaterThan(0);
  });
});

// ─── 3. scoreCoverage ─────────────────────────────────────────────────────────

describe("scoreCoverage", () => {
  it("returns 0 when both inputs are 0", () => {
    expect(scoreCoverage(0, 0)).toBe(0);
  });

  it("returns 100 when both inputs are 1.0", () => {
    expect(scoreCoverage(1.0, 1.0)).toBe(100);
  });

  it("reflects cluster weight 60%: cluster=1.0, section=0 → 60", () => {
    // clusterScore=100, sectionScore=0 → (100*60+0*40)/100 = 60
    expect(scoreCoverage(1.0, 0)).toBe(60);
  });

  it("reflects section weight 40%: cluster=0, section=1.0 → 40", () => {
    // clusterScore=0, sectionScore=100 → (0*60+100*40)/100 = 40
    expect(scoreCoverage(0, 1.0)).toBe(40);
  });

  it("interpolates cluster coverage correctly at 0.5", () => {
    // clusterScore=70 (at breakpoint [0.5,70]), sectionScore=60 (at breakpoint [0.5,60])
    // → (70*60+60*40)/100 = 66
    expect(scoreCoverage(0.5, 0.5)).toBe(66);
  });

  it("interpolates linearly: cluster=0.375 (midpoint between 0.25 and 0.5)", () => {
    // piecewise(0.375, [[0,0],[0.25,40],[0.5,70],...]) → t=(0.375-0.25)/0.25=0.5 → 40+0.5*30=55
    // clusterScore=55, sectionScore=60 (at [0.5,60]) → but we use cluster=0.375, section=0.5
    // Actually: sectionScore=piecewise(0.5,[[0,0],[0.25,30],[0.5,60],...])=60
    // clusterScore=55, sectionScore=60 → (55*60+60*40)/100 = (3300+2400)/100 = 57
    expect(scoreCoverage(0.375, 0.5)).toBe(57);
  });

  it("left-clamps negative inputs to 0", () => {
    expect(scoreCoverage(-1, -1)).toBe(0);
  });

  it("right-clamps values above 1.0 to 100", () => {
    expect(scoreCoverage(2.0, 2.0)).toBe(100);
  });
});

// ─── 4. scoreSectionDistribution ─────────────────────────────────────────────

describe("scoreSectionDistribution", () => {
  it("returns 100 when all three zones are absent (no content in any zone)", () => {
    expect(scoreSectionDistribution(0, 0, 0, false, false, false)).toBe(100);
  });

  it("returns 100 when all present and fully covered", () => {
    expect(scoreSectionDistribution(1.0, 1.0, 1.0, true, true, true)).toBe(100);
  });

  it("returns 0 when all present but zero coverage", () => {
    expect(scoreSectionDistribution(0, 0, 0, true, true, true)).toBe(0);
  });

  it("absent FAQ zone scores as neutral (100), not 0", () => {
    // intro=0 (hasIntro=true→0), headings=0 (hasHeadings=true→0), faq absent (→100)
    // = (0*40 + 0*30 + 100*30)/100 = 30
    expect(scoreSectionDistribution(0, 0, 0, true, true, false)).toBe(30);
  });

  it("absent headings zone scores as neutral (100)", () => {
    // intro=0 (→0), headings absent (→100), faq=0 (→0)
    // = (0*40 + 100*30 + 0*30)/100 = 30
    expect(scoreSectionDistribution(0, 0, 0, true, false, true)).toBe(30);
  });

  it("absent intro zone scores as neutral (100)", () => {
    // intro absent (→100), headings=0 (→0), faq=0 (→0)
    // = (100*40 + 0*30 + 0*30)/100 = 40
    expect(scoreSectionDistribution(0, 0, 0, false, true, true)).toBe(40);
  });

  it("computes weighted average across three zones at breakpoints", () => {
    // intro=0.5→65, headings=0.75→90, faq=0.25→30
    // = (65*40 + 90*30 + 30*30)/100 = (2600+2700+900)/100 = 62
    expect(scoreSectionDistribution(0.5, 0.75, 0.25, true, true, true)).toBe(62);
  });

  it("only intro zone present: intro=0.5 → (65*40+100*30+100*30)/100 = 86", () => {
    expect(scoreSectionDistribution(0.5, 0, 0, true, false, false)).toBe(86);
  });
});

// ─── 5. scoreDiversity ────────────────────────────────────────────────────────

describe("scoreDiversity", () => {
  it("returns 0 when diversity=0 and redundancy=0", () => {
    expect(scoreDiversity(0, 0)).toBe(0);
  });

  it("returns 100 when diversity=1.0 and redundancy=0", () => {
    expect(scoreDiversity(1.0, 0)).toBe(100);
  });

  it("diversity=0.6, redundancy=0 → 75 (at breakpoint)", () => {
    expect(scoreDiversity(0.6, 0)).toBe(75);
  });

  it("diversity=0.6, redundancy=0.6 → 75−25=50", () => {
    // diversityScore=75 (breakpoint), redundancyFactor=25 (breakpoint) → 50
    expect(scoreDiversity(0.6, 0.6)).toBe(50);
  });

  it("diversity=0.3, redundancy=0.3 → 40−10=30", () => {
    expect(scoreDiversity(0.3, 0.3)).toBe(30);
  });

  it("clamps to 0 when redundancy exceeds diversity score", () => {
    // diversity=0.1 → ~13.3, redundancy=0.9 → ~36.25 → max(0, 13.3-36.25)=0
    expect(scoreDiversity(0.1, 0.9)).toBe(0);
  });

  it("never returns a negative value", () => {
    expect(scoreDiversity(0, 1.0)).toBeGreaterThanOrEqual(0);
    expect(scoreDiversity(0.1, 0.8)).toBeGreaterThanOrEqual(0);
  });

  it("diversity=0.8, redundancy=0 → 95 (at breakpoint)", () => {
    expect(scoreDiversity(0.8, 0)).toBe(95);
  });
});

// ─── 6. scoreRelationships ────────────────────────────────────────────────────

describe("scoreRelationships", () => {
  it("returns 100 (neutral) when hasMultipleClusters is false", () => {
    expect(scoreRelationships(0, 0, false)).toBe(100);
    expect(scoreRelationships(0.5, 0.5, false)).toBe(100);
    expect(scoreRelationships(1.0, 2.0, false)).toBe(100);
  });

  it("returns 100 when all inputs are at max (hasMultipleClusters=true)", () => {
    // phraseScore=100, coOccurrenceScore=100
    expect(scoreRelationships(1.0, 2.0, true)).toBe(100);
  });

  it("returns 0 when phraseVariation=0 and coOccurrence=0 (hasMultipleClusters=true)", () => {
    expect(scoreRelationships(0, 0, true)).toBe(0);
  });

  it("phraseVariation=0.5, coOccurrence=1.0 → (70*60+80*40)/100 = 74", () => {
    // phraseScore=70 (at [0.5,70]), coOccurrenceScore=80 (at [1.0,80])
    expect(scoreRelationships(0.5, 1.0, true)).toBe(74);
  });

  it("phraseVariation=0.75, coOccurrence=0.5 → (90*60+50*40)/100 = 74", () => {
    // phraseScore=90 (at [0.75,90]), coOccurrenceScore=50 (at [0.5,50])
    expect(scoreRelationships(0.75, 0.5, true)).toBe(74);
  });

  it("phrase weight 60% dominates over coOccurrence weight 40%", () => {
    // Full phrase, zero co-occurrence: (100*60+0*40)/100 = 60
    expect(scoreRelationships(1.0, 0, true)).toBe(60);
    // Zero phrase, full co-occurrence: (0*60+100*40)/100 = 40
    expect(scoreRelationships(0, 2.0, true)).toBe(40);
  });

  it("co-occurrence score plateaus at 2.0 pairs per sentence", () => {
    expect(scoreRelationships(0, 2.0, true)).toBe(40); // co-occurrence at 100 → 40
    expect(scoreRelationships(0, 5.0, true)).toBe(40); // right-clamped, same result
  });
});

// ─── 7. scoreCoherence ────────────────────────────────────────────────────────

describe("scoreCoherence", () => {
  it("returns 100 when primaryKeywordPresent=false and no semantic content", () => {
    // Both guards fire → consistency=100, transition=100
    expect(scoreCoherence(0, 0, false, false, false)).toBe(100);
    expect(scoreCoherence(0, 0, false, false, true)).toBe(100);
  });

  it("consistency is neutral (100) when primaryKeywordPresent=false", () => {
    // consistency=100 (neutral), transition=100 (no semantic content)
    expect(scoreCoherence(0, 0, false, false, true)).toBe(100);
  });

  it("transition is neutral (100) when hasSemanticContent=false", () => {
    // consistency scored from value, transition=100
    // consistency=0 → 0; transition=100 → (0*60+100*40)/100 = 40
    expect(scoreCoherence(0, 0, true, false, true)).toBe(40);
  });

  it("transition is neutral (100) when paragraphCount<2 (single paragraph)", () => {
    // consistency scored from value, transition=100
    // consistency=0 → 0; transition=100 → 40
    expect(scoreCoherence(0, 0, true, true, false)).toBe(40);
  });

  it("returns 100 when both inputs are 1.0 and all guards pass", () => {
    expect(scoreCoherence(1.0, 1.0, true, true, true)).toBe(100);
  });

  it("returns 0 when consistency=0 and transition=0 with all guards passing", () => {
    expect(scoreCoherence(0, 0, true, true, true)).toBe(0);
  });

  it("consistency=0.75, transition=0.5 → (90*60+70*40)/100 = 82", () => {
    // consistencyScore=90 (at [0.75,90]), transitionScore=70 (at [0.5,70])
    expect(scoreCoherence(0.75, 0.5, true, true, true)).toBe(82);
  });

  it("consistency=0.5, transition=neutral → (65*60+100*40)/100 = 79", () => {
    // consistencyScore=65 (at [0.5,65]), transitionScore=100 (neutral, no semantic)
    expect(scoreCoherence(0.5, 0, true, false, true)).toBe(79);
  });

  it("consistency weight 60% dominates over transition weight 40%", () => {
    // Full consistency, zero transition: (100*60+0*40)/100 = 60
    expect(scoreCoherence(1.0, 0, true, true, true)).toBe(60);
    // Zero consistency, full transition: (0*60+100*40)/100 = 40
    expect(scoreCoherence(0, 1.0, true, true, true)).toBe(40);
  });
});

// ─── 8. Recommendations ───────────────────────────────────────────────────────

describe("SemanticQualityScorer — recommendations", () => {
  const scorer = new SemanticQualityScorer();

  it("SQ_LOW_CLUSTER_COVERAGE fires when clusterCoverage < 0.5", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 2,
      semanticClusterCoverage: 0.25,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_CLUSTER_COVERAGE");
  });

  it("SQ_LOW_CLUSTER_COVERAGE does not fire when clusterCoverage >= 0.5", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 2,
      semanticClusterCoverage: 0.5,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_LOW_CLUSTER_COVERAGE");
  });

  it("SQ_SEMANTIC_GAPS fires when semanticGapCount >= 2", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 3,
      semanticClusterCoverage: 0.33,
      semanticGapCount: 2,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_SEMANTIC_GAPS");
  });

  it("SQ_SEMANTIC_GAPS does not fire when semanticGapCount < 2", () => {
    const result = scorer.score(makeContext({ semanticGapCount: 1 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_SEMANTIC_GAPS");
  });

  it("SQ_LOW_SECTION_COVERAGE fires when sectionSemanticCoverage < 0.5", () => {
    const result = scorer.score(makeContext({ sectionSemanticCoverage: 0.3 }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_SECTION_COVERAGE");
  });

  it("SQ_LOW_INTRO_COVERAGE fires when intro < 0.5 and intro content exists", () => {
    const result = scorer.score(makeContext({
      introSemanticCoverage: 0.25,
      wordCountIntro: 200,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_INTRO_COVERAGE");
  });

  it("SQ_LOW_INTRO_COVERAGE does not fire when intro zone is absent", () => {
    const result = scorer.score(makeContext({
      introSemanticCoverage: 0.0,
      wordCountIntro: 0,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_LOW_INTRO_COVERAGE");
  });

  it("SQ_LOW_HEADING_COVERAGE fires when heading coverage < 0.5 and headings exist", () => {
    const result = scorer.score(makeContext({
      headingSemanticCoverage: 0.2,
      headingCount: 5,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_HEADING_COVERAGE");
  });

  it("SQ_LOW_HEADING_COVERAGE does not fire when no headings exist", () => {
    const result = scorer.score(makeContext({
      headingSemanticCoverage: 0.0,
      headingCount: 0,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_LOW_HEADING_COVERAGE");
  });

  it("SQ_LOW_FAQ_COVERAGE fires when faq coverage < 0.5 and FAQ exists", () => {
    const result = scorer.score(makeContext({
      faqSemanticCoverage: 0.2,
      faqCount: 5,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_FAQ_COVERAGE");
  });

  it("SQ_LOW_FAQ_COVERAGE does not fire when no FAQs exist", () => {
    const result = scorer.score(makeContext({
      faqSemanticCoverage: 0.0,
      faqCount: 0,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_LOW_FAQ_COVERAGE");
  });

  it("SQ_LOW_CONCEPT_DIVERSITY fires when diversity < 0.4 and semantic content exists", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.5,
      conceptDiversity: 0.2,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_CONCEPT_DIVERSITY");
  });

  it("SQ_LOW_CONCEPT_DIVERSITY does not fire when no semantic content", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.0,
      conceptDiversity: 0.1,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_LOW_CONCEPT_DIVERSITY");
  });

  it("SQ_HIGH_CONCEPT_REDUNDANCY fires when redundancy > 0.6 and semantic content exists", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.5,
      conceptRedundancy: 0.75,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_HIGH_CONCEPT_REDUNDANCY");
  });

  it("SQ_MISSING_TOPIC_DISTRIBUTION fires when topicDistribution < 0.25 and multiple clusters", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 3,
      topicDistribution: 0.1,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_MISSING_TOPIC_DISTRIBUTION");
  });

  it("SQ_MISSING_TOPIC_DISTRIBUTION does not fire when only one cluster", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 1,
      topicDistribution: 0.0,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_MISSING_TOPIC_DISTRIBUTION");
  });

  it("SQ_WEAK_RELATIONSHIPS fires when phraseVariation < 0.25 and multiple clusters", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 2,
      phraseVariationScore: 0.1,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_WEAK_RELATIONSHIPS");
  });

  it("SQ_WEAK_RELATIONSHIPS does not fire with single cluster", () => {
    const result = scorer.score(makeContext({
      semanticClusterCount: 1,
      phraseVariationScore: 0.0,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_WEAK_RELATIONSHIPS");
  });

  it("SQ_LOW_COHERENCE fires when semanticConsistency < 0.5 and primary keyword present", () => {
    const result = scorer.score(makeContext({
      semanticConsistency: 0.3,
      primaryKeywordPresent: true,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_LOW_COHERENCE");
  });

  it("SQ_LOW_COHERENCE does not fire when primary keyword absent", () => {
    const result = scorer.score(makeContext({
      semanticConsistency: 0.0,
      primaryKeywordPresent: false,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_LOW_COHERENCE");
  });

  it("SQ_WEAK_TRANSITIONS fires when transition < 0.33 with semantic content and multiple paragraphs", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.5,
      semanticTransitionScore: 0.1,
      paragraphCount: 4,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).toContain("SQ_WEAK_TRANSITIONS");
  });

  it("SQ_WEAK_TRANSITIONS does not fire with fewer than 2 paragraphs", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.5,
      semanticTransitionScore: 0.0,
      paragraphCount: 1,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_WEAK_TRANSITIONS");
  });

  it("SQ_WEAK_TRANSITIONS does not fire without semantic content", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.0,
      semanticTransitionScore: 0.0,
      paragraphCount: 5,
    }));
    const codes = result.recommendations.map((r) => r.code);
    expect(codes).not.toContain("SQ_WEAK_TRANSITIONS");
  });

  it("recommendations have required fields (code, severity, message)", () => {
    const result = scorer.score(makeContext({
      semanticClusterCoverage: 0.0,
      sectionSemanticCoverage: 0.0,
    }));
    for (const rec of result.recommendations) {
      expect(typeof rec.code).toBe("string");
      expect(["error", "warning", "info"]).toContain(rec.severity);
      expect(typeof rec.message).toBe("string");
      expect(rec.message.length).toBeGreaterThan(0);
    }
  });
});

// ─── 9. Result structure ──────────────────────────────────────────────────────

describe("SemanticQualityScorer — result structure", () => {
  const scorer = new SemanticQualityScorer();

  it("result has moduleId matching SEMANTIC_QUALITY_MODULE_ID", () => {
    const result = scorer.score(makeContext());
    expect(result.moduleId).toBe(SEMANTIC_QUALITY_MODULE_ID);
  });

  it("result score is in [0, 100]", () => {
    const result = scorer.score(makeContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("result has a breakdown object with entries", () => {
    const result = scorer.score(makeContext());
    expect(result.breakdown).toBeDefined();
    expect(typeof result.breakdown).toBe("object");
    expect(Object.keys(result.breakdown).length).toBeGreaterThan(0);
  });

  it("normalizedScore equals score / 100", () => {
    const result = scorer.score(makeContext());
    expect(result.normalizedScore).toBeCloseTo(result.score / 100, 5);
  });

  it("executionMs is a non-negative number", () => {
    const result = scorer.score(makeContext());
    expect(typeof result.executionMs).toBe("number");
    expect(result.executionMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── 10. Golden vectors ───────────────────────────────────────────────────────
//
// Each vector is a fully specified metric set. Expected scores are derived by
// applying the published formula exactly:
//
//   rawScore = (coverage×30 + section×25 + diversity×20 + relationships×15 + coherence×10) / 100
//   finalScore = roundScore(clampScore(rawScore), 2)
//
// Curves used:
//   CLUSTER_COVERAGE_CURVE = [[0,0],[0.25,40],[0.5,70],[0.75,90],[1.0,100]]
//   SECTION_COVERAGE_CURVE = [[0,0],[0.25,30],[0.5,60],[0.75,85],[1.0,100]]
//   SECTION_DIST_CURVE     = [[0,0],[0.25,30],[0.5,65],[0.75,90],[1.0,100]]
//   DIVERSITY_CURVE        = [[0,0],[0.3,40],[0.6,75],[0.8,95],[1.0,100]]
//   REDUNDANCY_FACTOR      = [[0,0],[0.3,10],[0.6,25],[1.0,40]]
//   PHRASE_VARIATION_CURVE = [[0,0],[0.25,40],[0.5,70],[0.75,90],[1.0,100]]
//   COOCCURRENCE_CURVE     = [[0,0],[0.5,50],[1.0,80],[2.0,100]]
//   CONSISTENCY_CURVE      = [[0,0],[0.25,30],[0.5,65],[0.75,90],[1.0,100]]
//   TRANSITION_CURVE       = [[0,0],[0.25,40],[0.5,70],[1.0,100]]

describe("SemanticQualityScorer — golden vectors", () => {
  const scorer = new SemanticQualityScorer();

  it("GV-1: no concept data (semanticClusterCount=0) → SKIPPED with score=0", () => {
    const result = scorer.score(makeContext({ semanticClusterCount: 0 }));
    expect(result.lifecycleState).toBe("SKIPPED");
    expect(result.score).toBe(0);
  });

  it("GV-2: primary keyword defined but not found in content → score = 25.0", () => {
    // clusterCount=1, clusterCoverage=0 → no concepts found anywhere
    // hasMultipleClusters=false → relationships=100 (neutral)
    // primaryKeywordPresent=false → consistency=100 (neutral)
    // hasSemanticContent=false → transition=100 (neutral)
    // coverage=0, section=0, diversity=0, relationships=100, coherence=100
    // rawScore = (0×30 + 0×25 + 0×20 + 100×15 + 100×10) / 100 = 25.0
    const result = scorer.score(makeContext({
      semanticClusterCount: 1,
      semanticClusterCoverage: 0.0,
      sectionSemanticCoverage: 0.0,
      introSemanticCoverage: 0.0,
      headingSemanticCoverage: 0.0,
      faqSemanticCoverage: 0.0,
      conceptDiversity: 0.0,
      conceptRedundancy: 0.0,
      phraseVariationScore: 0.0,
      coOccurrenceDensity: 0.0,
      semanticConsistency: 0.0,
      semanticTransitionScore: 0.0,
      topicDistribution: 0.0,
      semanticGapCount: 0,
      wordCountIntro: 200,
      headingCount: 4,
      faqCount: 5,
      paragraphCount: 5,
      primaryKeywordPresent: false,
    }));
    expect(result.lifecycleState).not.toBe("SKIPPED");
    expect(result.score).toBe(25.0);
  });

  it("GV-3: sparse — primary keyword found, limited coverage → score = 69.01", () => {
    // clusterCount=1 (primary only) → hasMultipleClusters=false → relationships=100 (neutral)
    //
    // coverage = scoreCoverage(1.0, 0.3):
    //   clusterScore = piecewise(1.0) = 100
    //   sectionScore = piecewise(0.3, [[0,0],[0.25,30],[0.5,60]]) → t=0.2 → 36
    //   = (100×60+36×40)/100 = 74.4
    //
    // section = scoreSectionDistribution(0.5, 0.0, 0.25, true, true, true):
    //   intro=65 (at [0.5,65]), headings=0, faq=30 (at [0.25,30])
    //   = (65×40+0×30+30×30)/100 = 35
    //
    // diversity = scoreDiversity(1.0, 0.5):
    //   diversity=100, redundancy=20 (t=2/3 between [0.3,10] and [0.6,25]) → 80
    //
    // relationships = 100 (single cluster, neutral)
    //
    // coherence = scoreCoherence(0.5, 0.6, true, true, true):
    //   consistency=65 (at [0.5,65]), transition=76 (t=0.2 between [0.5,70] and [1.0,100])
    //   = (65×60+76×40)/100 = 69.4
    //
    // rawScore = (74.4×30 + 35×25 + 80×20 + 100×15 + 69.4×10)/100
    //          = (2232 + 875 + 1600 + 1500 + 694)/100 = 6901/100 = 69.01
    const result = scorer.score(makeContext({
      semanticClusterCount: 1,
      semanticClusterCoverage: 1.0,
      sectionSemanticCoverage: 0.3,
      introSemanticCoverage: 0.5,
      headingSemanticCoverage: 0.0,
      faqSemanticCoverage: 0.25,
      conceptDiversity: 1.0,
      conceptRedundancy: 0.5,
      phraseVariationScore: 0.0,
      coOccurrenceDensity: 0.0,
      semanticConsistency: 0.5,
      semanticTransitionScore: 0.6,
      topicDistribution: 0.0,
      semanticGapCount: 0,
      wordCountIntro: 300,
      headingCount: 5,
      faqCount: 5,
      paragraphCount: 6,
      primaryKeywordPresent: true,
    }));
    expect(result.score).toBe(69.01);
  });

  it("GV-4: moderate — 3 clusters, solid coverage and relationships → score = 83.0", () => {
    // coverage = scoreCoverage(1.0, 0.75):
    //   clusterScore=100, sectionScore=85 (at [0.75,85])
    //   = (100×60+85×40)/100 = 94
    //
    // section = scoreSectionDistribution(0.75, 0.75, 0.75, true, true, true):
    //   intro=headings=faq=90 (at [0.75,90])
    //   = (90×40+90×30+90×30)/100 = 90
    //
    // diversity = scoreDiversity(0.6, 0.3):
    //   diversity=75 (at [0.6,75]), redundancy=10 (at [0.3,10]) → 65
    //
    // relationships = scoreRelationships(0.5, 1.0, true):
    //   phraseScore=70 (at [0.5,70]), coOccurrenceScore=80 (at [1.0,80])
    //   = (70×60+80×40)/100 = 74
    //
    // coherence = scoreCoherence(0.75, 0.5, true, true, true):
    //   consistency=90 (at [0.75,90]), transition=70 (at [0.5,70])
    //   = (90×60+70×40)/100 = 82
    //
    // rawScore = (94×30+90×25+65×20+74×15+82×10)/100
    //          = (2820+2250+1300+1110+820)/100 = 8300/100 = 83.0
    const result = scorer.score(makeContext({
      semanticClusterCount: 3,
      semanticClusterCoverage: 1.0,
      sectionSemanticCoverage: 0.75,
      introSemanticCoverage: 0.75,
      headingSemanticCoverage: 0.75,
      faqSemanticCoverage: 0.75,
      conceptDiversity: 0.6,
      conceptRedundancy: 0.3,
      phraseVariationScore: 0.5,
      coOccurrenceDensity: 1.0,
      semanticConsistency: 0.75,
      semanticTransitionScore: 0.5,
      topicDistribution: 0.5,
      semanticGapCount: 0,
      wordCountIntro: 300,
      headingCount: 5,
      faqCount: 5,
      paragraphCount: 8,
      primaryKeywordPresent: true,
    }));
    expect(result.score).toBe(83.0);
  });

  it("GV-5: strong — all 4 clusters, excellent coverage, near-perfect score → 99.33", () => {
    // coverage = 100, section = 100
    //
    // diversity = scoreDiversity(1.0, 0.1):
    //   diversity=100, redundancy = t=1/3 between [0,0] and [0.3,10] → 10/3 ≈ 3.333
    //   → max(0, 100−3.333) = 96.666...
    //
    // relationships = 100 (phraseVariation=1.0, coOccurrence=2.0)
    // coherence = 100 (consistency=1.0, transition=1.0)
    //
    // rawScore = (100×30+100×25+96.666...×20+100×15+100×10)/100
    //          = (3000+2500+1933.33...+1500+1000)/100 = 9933.33.../100 = 99.33 (rounded)
    const result = scorer.score(makeContext({
      semanticClusterCount: 4,
      semanticClusterCoverage: 1.0,
      sectionSemanticCoverage: 1.0,
      introSemanticCoverage: 1.0,
      headingSemanticCoverage: 1.0,
      faqSemanticCoverage: 1.0,
      conceptDiversity: 1.0,
      conceptRedundancy: 0.1,
      phraseVariationScore: 1.0,
      coOccurrenceDensity: 2.0,
      semanticConsistency: 1.0,
      semanticTransitionScore: 1.0,
      topicDistribution: 1.0,
      semanticGapCount: 0,
      wordCountIntro: 400,
      headingCount: 5,
      faqCount: 5,
      paragraphCount: 8,
      primaryKeywordPresent: true,
    }));
    expect(result.score).toBe(99.33);
  });

  it("GV-6: high redundancy + low diversity → score = 36.44", () => {
    // coverage = scoreCoverage(0.5, 0.4):
    //   clusterScore=70 (at [0.5,70])
    //   sectionScore: t=(0.4-0.25)/0.25=0.6 between [0.25,30] and [0.5,60] → 30+0.6×30=48
    //   = (70×60+48×40)/100 = 61.2
    //
    // section = scoreSectionDistribution(0.5, 0.5, 0.0, true, true, true):
    //   intro=65, headings=65, faq=0
    //   = (65×40+65×30+0×30)/100 = 45.5
    //
    // diversity = scoreDiversity(0.2, 0.8):
    //   diversity: t=2/3 between [0,0] and [0.3,40] → 26.666...
    //   redundancy: t=0.5 between [0.6,25] and [1.0,40] → 25+0.5×15=32.5
    //   → max(0, 26.666...−32.5) = 0
    //
    // relationships = scoreRelationships(0.0, 0.3, true):
    //   phraseScore=0, coOccurrenceScore: t=0.6 between [0,0] and [0.5,50] → 30
    //   = (0×60+30×40)/100 = 12
    //
    // coherence = scoreCoherence(0.4, 0.3, true, true, true):
    //   consistency: t=0.6 between [0.25,30] and [0.5,65] → 30+0.6×35=51
    //   transition: t=0.2 between [0.25,40] and [0.5,70] → 40+0.2×30=46
    //   = (51×60+46×40)/100 = 49
    //
    // rawScore = (61.2×30+45.5×25+0×20+12×15+49×10)/100
    //          = (1836+1137.5+0+180+490)/100 = 3643.5/100 = 36.44 (rounded)
    const result = scorer.score(makeContext({
      semanticClusterCount: 2,
      semanticClusterCoverage: 0.5,
      sectionSemanticCoverage: 0.4,
      introSemanticCoverage: 0.5,
      headingSemanticCoverage: 0.5,
      faqSemanticCoverage: 0.0,
      conceptDiversity: 0.2,
      conceptRedundancy: 0.8,
      phraseVariationScore: 0.0,
      coOccurrenceDensity: 0.3,
      semanticConsistency: 0.4,
      semanticTransitionScore: 0.3,
      topicDistribution: 0.0,
      semanticGapCount: 1,
      wordCountIntro: 200,
      headingCount: 4,
      faqCount: 5,
      paragraphCount: 6,
      primaryKeywordPresent: true,
    }));
    expect(result.score).toBe(36.44);
  });

  it("GV-7: broad coverage but weak coherence (poor consistency + no transitions) → score = 83.67", () => {
    // coverage = scoreCoverage(1.0, 0.75) = 94 (same as GV-4)
    // section = 90 (all zones 0.75, same as GV-4)
    //
    // diversity = scoreDiversity(0.8, 0.2):
    //   diversity=95 (at [0.8,95])
    //   redundancy: t=2/3 between [0,0] and [0.3,10] → 6.666...
    //   → max(0, 95−6.666...) = 88.333...
    //
    // relationships = scoreRelationships(0.75, 1.5, true):
    //   phraseScore=90 (at [0.75,90])
    //   coOccurrenceScore: t=0.5 between [1.0,80] and [2.0,100] → 80+0.5×20=90
    //   = (90×60+90×40)/100 = 90
    //
    // coherence = scoreCoherence(0.25, 0.0, true, true, true):
    //   consistency=30 (at [0.25,30])
    //   transition=0 (left-clamp; paragraphs>=2 + hasSemanticContent, so scored)
    //   = (30×60+0×40)/100 = 18
    //
    // rawScore = (94×30+90×25+88.333...×20+90×15+18×10)/100
    //          = (2820+2250+1766.666...+1350+180)/100 = 8366.666.../100 = 83.67 (rounded)
    const result = scorer.score(makeContext({
      semanticClusterCount: 4,
      semanticClusterCoverage: 1.0,
      sectionSemanticCoverage: 0.75,
      introSemanticCoverage: 0.75,
      headingSemanticCoverage: 0.75,
      faqSemanticCoverage: 0.75,
      conceptDiversity: 0.8,
      conceptRedundancy: 0.2,
      phraseVariationScore: 0.75,
      coOccurrenceDensity: 1.5,
      semanticConsistency: 0.25,
      semanticTransitionScore: 0.0,
      topicDistribution: 1.0,
      semanticGapCount: 0,
      wordCountIntro: 400,
      headingCount: 5,
      faqCount: 5,
      paragraphCount: 8,
      primaryKeywordPresent: true,
    }));
    expect(result.score).toBe(83.67);
  });
});

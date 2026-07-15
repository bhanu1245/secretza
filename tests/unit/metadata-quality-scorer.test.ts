/**
 * Tests for MetadataQualityScorer (Phase 2C.3)
 *
 * Golden vectors were computed analytically from the scoring curves and
 * verified against the piecewiseLinear/weightedAverage math in seo-scoring-core.ts.
 * Any curve change that shifts a golden vector value requires explicit approval.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { QualityMetrics, ModuleContext } from "@/lib/seo-quality-types";
import {
  MetadataQualityScorer,
  metadataQualityScorer,
  METADATA_QUALITY_MODULE_ID,
  scoreTitleQuality,
  scoreMetaQuality,
  scoreCanonicalQuality,
  scorePageCompleteness,
  scoreIndexability,
  scoreSocialMetadata,
} from "@/lib/seo-scorers/metadata-quality-scorer";

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function zeroMetrics(): Partial<QualityMetrics> {
  return {
    titlePresent: false,
    titleLength: 0,
    metaPresent: false,
    metaLength: 0,
    canonicalPresent: false,
    h1Present: false,
    featuredImagePresent: false,
    imageAltPresent: false,
    robotsNoindex: false,
    robotsNofollow: false,
    openGraphExists: false,
    openGraphPropertyCount: 0,
    twitterCardExists: false,
    twitterMetaCount: 0,
  };
}

function makeContext(partial: Partial<QualityMetrics> = {}): ModuleContext {
  return {
    metrics: { ...zeroMetrics(), ...partial } as unknown as QualityMetrics,
    profile: {
      id: "test-profile",
      name: "Test Profile",
      modules: [],
      gradeThresholds: [],
    } as unknown as import("@/lib/seo-quality-types").ScoringProfile,
    pageContext: {
      pageType: "city",
      pageSlug: "test-slug",
      primaryKeyword: null,
      secondaryKeywords: [],
      attempt: 1,
    } as unknown as import("@/lib/seo-quality-types").PageContext,
    ruleResults: [],
    priorModuleScores: [],
  };
}

// ─── Identity ─────────────────────────────────────────────────────────────────────

describe("MetadataQualityScorer — identity", () => {
  const scorer = new MetadataQualityScorer();

  it("has the correct module ID", () => {
    expect(scorer.id).toBe("metadata");
  });

  it("METADATA_QUALITY_MODULE_ID constant matches scorer id", () => {
    expect(METADATA_QUALITY_MODULE_ID).toBe(scorer.id);
  });

  it("has a non-empty name", () => {
    expect(scorer.name.length).toBeGreaterThan(0);
  });

  it("has version 1.0.0", () => {
    expect(scorer.version).toBe("1.0.0");
  });

  it("has no module dependencies", () => {
    expect(scorer.dependsOnModules).toEqual([]);
  });

  it("declares 14 required metrics", () => {
    expect(scorer.requiredMetrics).toHaveLength(14);
  });

  it("requiredMetrics includes titlePresent and titleLength", () => {
    expect(scorer.requiredMetrics).toContain("titlePresent");
    expect(scorer.requiredMetrics).toContain("titleLength");
  });

  it("requiredMetrics includes metaPresent and metaLength", () => {
    expect(scorer.requiredMetrics).toContain("metaPresent");
    expect(scorer.requiredMetrics).toContain("metaLength");
  });

  it("requiredMetrics includes h1Present, canonicalPresent, featuredImagePresent, imageAltPresent", () => {
    expect(scorer.requiredMetrics).toContain("h1Present");
    expect(scorer.requiredMetrics).toContain("canonicalPresent");
    expect(scorer.requiredMetrics).toContain("featuredImagePresent");
    expect(scorer.requiredMetrics).toContain("imageAltPresent");
  });

  it("requiredMetrics includes robotsNoindex and robotsNofollow", () => {
    expect(scorer.requiredMetrics).toContain("robotsNoindex");
    expect(scorer.requiredMetrics).toContain("robotsNofollow");
  });

  it("requiredMetrics includes social metadata fields", () => {
    expect(scorer.requiredMetrics).toContain("openGraphExists");
    expect(scorer.requiredMetrics).toContain("openGraphPropertyCount");
    expect(scorer.requiredMetrics).toContain("twitterCardExists");
    expect(scorer.requiredMetrics).toContain("twitterMetaCount");
  });

  it("singleton instance has the same id", () => {
    expect(metadataQualityScorer.id).toBe(METADATA_QUALITY_MODULE_ID);
  });
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────────

describe("MetadataQualityScorer — lifecycle", () => {
  const scorer = new MetadataQualityScorer();

  it("score() returns a ModuleResult with the correct moduleId", () => {
    const r = scorer.score(makeContext());
    expect(r.moduleId).toBe("metadata");
  });

  it("score() returns lifecycleState COMPLETED on success", () => {
    const r = scorer.score(makeContext());
    expect(r.lifecycleState).toBe("COMPLETED");
  });

  it("score() returns maxScore of 100", () => {
    const r = scorer.score(makeContext());
    expect(r.maxScore).toBe(100);
  });

  it("score() always returns a finite score in [0, 100]", () => {
    const r = scorer.score(makeContext());
    expect(isFinite(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("score() always returns a finite normalizedScore in [0, 1]", () => {
    const r = scorer.score(makeContext());
    expect(isFinite(r.normalizedScore)).toBe(true);
    expect(r.normalizedScore).toBeGreaterThanOrEqual(0);
    expect(r.normalizedScore).toBeLessThanOrEqual(1);
  });

  it("score() normalizedScore equals score / 100 (to 4 decimal places)", () => {
    const r = scorer.score(makeContext({ titlePresent: true, titleLength: 55 }));
    expect(r.normalizedScore).toBeCloseTo(r.score / 100, 4);
  });

  it("score() returns an executionMs >= 0", () => {
    const r = scorer.score(makeContext());
    expect(r.executionMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── scoreTitleQuality ────────────────────────────────────────────────────────────

describe("scoreTitleQuality", () => {
  it("returns 0 when title is not present", () => {
    expect(scoreTitleQuality(false, 0)).toBe(0);
  });

  it("returns 0 when title is not present even with non-zero length", () => {
    expect(scoreTitleQuality(false, 55)).toBe(0);
  });

  it("returns 20 for title length 15 (exact breakpoint)", () => {
    expect(scoreTitleQuality(true, 15)).toBe(20);
  });

  it("returns 70 for title length 30 (lower bound of optimal, exact breakpoint)", () => {
    expect(scoreTitleQuality(true, 30)).toBe(70);
  });

  it("returns 100 for title length 55 (deep in optimal range, exact breakpoint)", () => {
    expect(scoreTitleQuality(true, 55)).toBe(100);
  });

  it("returns 100 for title length 65 (upper bound of optimal, exact breakpoint)", () => {
    expect(scoreTitleQuality(true, 65)).toBe(100);
  });

  it("returns 75 for title length 80 (severe truncation boundary, exact breakpoint)", () => {
    expect(scoreTitleQuality(true, 80)).toBe(75);
  });

  it("returns a score between 70 and 100 for length in 30–65 range", () => {
    for (const len of [35, 40, 45, 50, 60]) {
      const s = scoreTitleQuality(true, len);
      expect(s).toBeGreaterThanOrEqual(70);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("returns a lower score for length 25 than for length 45", () => {
    expect(scoreTitleQuality(true, 25)).toBeLessThan(scoreTitleQuality(true, 45));
  });

  it("returns a lower score for length 100 than for length 60", () => {
    expect(scoreTitleQuality(true, 100)).toBeLessThan(scoreTitleQuality(true, 60));
  });

  it("interpolates between 30 and 45 for length 35 (expected ~78.33)", () => {
    expect(scoreTitleQuality(true, 35)).toBeCloseTo(78.33, 1);
  });

  it("handles safeNumber guard — NaN length → clamped to curve minimum", () => {
    const s = scoreTitleQuality(true, NaN);
    expect(isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

// ─── scoreMetaQuality ─────────────────────────────────────────────────────────────

describe("scoreMetaQuality", () => {
  it("returns 0 when meta is not present", () => {
    expect(scoreMetaQuality(false, 0)).toBe(0);
  });

  it("returns 0 when meta is not present even with non-zero length", () => {
    expect(scoreMetaQuality(false, 150)).toBe(0);
  });

  it("returns 20 for meta length 50 (exact breakpoint)", () => {
    expect(scoreMetaQuality(true, 50)).toBe(20);
  });

  it("returns 75 for meta length 100 (lower bound of optimal, exact breakpoint)", () => {
    expect(scoreMetaQuality(true, 100)).toBe(75);
  });

  it("returns 95 for meta length 120 (exact breakpoint)", () => {
    expect(scoreMetaQuality(true, 120)).toBe(95);
  });

  it("returns 100 for meta length 165 (upper bound of optimal, exact breakpoint)", () => {
    expect(scoreMetaQuality(true, 165)).toBe(100);
  });

  it("returns 80 for meta length 200 (exact breakpoint, truncation zone)", () => {
    expect(scoreMetaQuality(true, 200)).toBe(80);
  });

  it("returns a score between 75 and 100 for length in 100–165 range", () => {
    for (const len of [105, 120, 140, 150, 160]) {
      const s = scoreMetaQuality(true, len);
      expect(s).toBeGreaterThanOrEqual(75);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("returns a lower score for length 60 than for length 140", () => {
    expect(scoreMetaQuality(true, 60)).toBeLessThan(scoreMetaQuality(true, 140));
  });

  it("returns a lower score for length 250 than for length 140", () => {
    expect(scoreMetaQuality(true, 250)).toBeLessThan(scoreMetaQuality(true, 140));
  });

  it("interpolates for length 80 (expected 53)", () => {
    expect(scoreMetaQuality(true, 80)).toBeCloseTo(53, 1);
  });

  it("interpolates for length 145 (expected ~97.78)", () => {
    expect(scoreMetaQuality(true, 145)).toBeCloseTo(97.78, 1);
  });
});

// ─── scoreCanonicalQuality ────────────────────────────────────────────────────────

describe("scoreCanonicalQuality", () => {
  it("returns 100 when canonical is present", () => {
    expect(scoreCanonicalQuality(true)).toBe(100);
  });

  it("returns 0 when canonical is absent", () => {
    expect(scoreCanonicalQuality(false)).toBe(0);
  });
});

// ─── scorePageCompleteness ────────────────────────────────────────────────────────

describe("scorePageCompleteness", () => {
  it("returns 0 when all absent", () => {
    expect(scorePageCompleteness(false, false, false)).toBe(0);
  });

  it("returns 60 when only H1 is present (H1 weight = 60%)", () => {
    expect(scorePageCompleteness(true, false, false)).toBe(60);
  });

  it("returns 30 when only featured image is present (image weight = 30%)", () => {
    expect(scorePageCompleteness(false, true, false)).toBe(30);
  });

  it("returns 10 when only image alt is present (alt weight = 10%)", () => {
    expect(scorePageCompleteness(false, false, true)).toBe(10);
  });

  it("returns 90 when H1 + featured image are present (60+30=90%)", () => {
    expect(scorePageCompleteness(true, true, false)).toBe(90);
  });

  it("returns 70 when H1 + image alt are present (60+10=70%)", () => {
    expect(scorePageCompleteness(true, false, true)).toBe(70);
  });

  it("returns 40 when featured image + image alt are present (30+10=40%)", () => {
    expect(scorePageCompleteness(false, true, true)).toBe(40);
  });

  it("returns 100 when all are present", () => {
    expect(scorePageCompleteness(true, true, true)).toBe(100);
  });
});

// ─── scoreIndexability ────────────────────────────────────────────────────────────

describe("scoreIndexability", () => {
  it("returns 100 when page is indexable (not noindex)", () => {
    expect(scoreIndexability(false)).toBe(100);
  });

  it("returns 0 when page is noindexed", () => {
    expect(scoreIndexability(true)).toBe(0);
  });
});

// ─── scoreSocialMetadata ──────────────────────────────────────────────────────────

describe("scoreSocialMetadata", () => {
  it("returns 0 when neither OG nor Twitter is present", () => {
    expect(scoreSocialMetadata(false, 0, false, 0)).toBe(0);
  });

  it("returns 0 for OG but ogPropertyCount=0 (absent)", () => {
    // exists=false → 0 regardless of count
    expect(scoreSocialMetadata(false, 5, false, 0)).toBe(0);
  });

  it("OG with 1 property → ogScore=40, socialScore=40*0.6=24", () => {
    const s = scoreSocialMetadata(true, 1, false, 0);
    expect(s).toBeCloseTo(24, 1);
  });

  it("OG with 5 properties → ogScore=90, socialScore=90*0.6=54", () => {
    const s = scoreSocialMetadata(true, 5, false, 0);
    expect(s).toBeCloseTo(54, 1);
  });

  it("Twitter with 3 meta → twitterScore=70, socialScore=70*0.4=28", () => {
    const s = scoreSocialMetadata(false, 0, true, 3);
    expect(s).toBeCloseTo(28, 1);
  });

  it("OG(7 props) + Twitter(5 meta) → ogScore=100, twitterScore=100, socialScore=100", () => {
    const s = scoreSocialMetadata(true, 7, true, 5);
    expect(s).toBeCloseTo(100, 1);
  });

  it("OG(2 props) + no Twitter → ogScore=55, socialScore=55*0.6=33", () => {
    const s = scoreSocialMetadata(true, 2, false, 0);
    expect(s).toBeCloseTo(33, 1);
  });

  it("OG(6 props) + Twitter(4 meta) → socialScore=91", () => {
    const s = scoreSocialMetadata(true, 6, true, 4);
    expect(s).toBeCloseTo(91, 1);
  });
});

// ─── Hard cap — noindex ───────────────────────────────────────────────────────────

describe("MetadataQualityScorer — hard cap (noindex)", () => {
  const scorer = new MetadataQualityScorer();

  it("perfect metadata but noindex → score capped at 10", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      robotsNoindex: true,
      openGraphExists: true, openGraphPropertyCount: 6,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(r.score).toBe(10);
  });

  it("broken metadata with noindex → score remains at or below 10", () => {
    const r = scorer.score(makeContext({ robotsNoindex: true }));
    expect(r.score).toBeLessThanOrEqual(10);
  });

  it("noindex cap does not raise score above actual computed value when score < 10", () => {
    // All zero metrics except robotsNoindex — indexability component gives 0
    const r = scorer.score(makeContext({ robotsNoindex: true }));
    // Raw score would be 0 (all components 0) — cap at 10 does not raise it
    expect(r.score).toBe(0);
  });

  it("page without noindex has no cap applied", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
    }));
    expect(r.score).toBeGreaterThan(10);
  });

  it("breakdown._cappedScore is 10 for noindexed page with high raw score", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true, canonicalPresent: true,
      robotsNoindex: true,
    }));
    expect(r.breakdown["_cappedScore"]).toBe(10);
  });
});

// ─── Recommendations ─────────────────────────────────────────────────────────────

describe("MetadataQualityScorer — recommendations", () => {
  const scorer = new MetadataQualityScorer();

  it("MQ_MISSING_TITLE fires when title is absent", () => {
    const r = scorer.score(makeContext({ titlePresent: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_TITLE")).toBe(true);
  });

  it("MQ_MISSING_TITLE does NOT fire when title is present", () => {
    const r = scorer.score(makeContext({ titlePresent: true, titleLength: 55 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_TITLE")).toBe(false);
  });

  it("MQ_TITLE_TOO_SHORT fires when title is present but length < 30", () => {
    const r = scorer.score(makeContext({ titlePresent: true, titleLength: 20 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_TITLE_TOO_SHORT")).toBe(true);
  });

  it("MQ_TITLE_TOO_SHORT does NOT fire when title is absent (MQ_MISSING_TITLE takes priority)", () => {
    const r = scorer.score(makeContext({ titlePresent: false, titleLength: 10 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_TITLE_TOO_SHORT")).toBe(false);
  });

  it("MQ_TITLE_TOO_LONG fires when title is present and length > 80", () => {
    const r = scorer.score(makeContext({ titlePresent: true, titleLength: 90 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_TITLE_TOO_LONG")).toBe(true);
  });

  it("MQ_TITLE_TOO_LONG does NOT fire for length 65 (still in optimal range)", () => {
    const r = scorer.score(makeContext({ titlePresent: true, titleLength: 65 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_TITLE_TOO_LONG")).toBe(false);
  });

  it("MQ_MISSING_META_DESCRIPTION fires when meta is absent", () => {
    const r = scorer.score(makeContext({ metaPresent: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_META_DESCRIPTION")).toBe(true);
  });

  it("MQ_META_TOO_SHORT fires when meta is present but length < 100", () => {
    const r = scorer.score(makeContext({ metaPresent: true, metaLength: 80 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_META_TOO_SHORT")).toBe(true);
  });

  it("MQ_META_TOO_LONG fires when meta is present and length > 165", () => {
    const r = scorer.score(makeContext({ metaPresent: true, metaLength: 200 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_META_TOO_LONG")).toBe(true);
  });

  it("MQ_META_TOO_LONG does NOT fire for length 165 (upper bound of optimal)", () => {
    const r = scorer.score(makeContext({ metaPresent: true, metaLength: 165 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_META_TOO_LONG")).toBe(false);
  });

  it("MQ_MISSING_CANONICAL fires when canonical is absent", () => {
    const r = scorer.score(makeContext({ canonicalPresent: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_CANONICAL")).toBe(true);
  });

  it("MQ_MISSING_CANONICAL does NOT fire when canonical is present", () => {
    const r = scorer.score(makeContext({ canonicalPresent: true }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_CANONICAL")).toBe(false);
  });

  it("MQ_MISSING_H1 fires when H1 is absent", () => {
    const r = scorer.score(makeContext({ h1Present: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_H1")).toBe(true);
  });

  it("MQ_MISSING_H1 does NOT fire when H1 is present", () => {
    const r = scorer.score(makeContext({ h1Present: true }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_H1")).toBe(false);
  });

  it("MQ_NOINDEX_DETECTED fires when robotsNoindex is true", () => {
    const r = scorer.score(makeContext({ robotsNoindex: true }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_NOINDEX_DETECTED")).toBe(true);
  });

  it("MQ_NOINDEX_DETECTED has severity error", () => {
    const r = scorer.score(makeContext({ robotsNoindex: true }));
    const rec = r.recommendations.find((rec) => rec.code === "MQ_NOINDEX_DETECTED");
    expect(rec?.severity).toBe("error");
  });

  it("MQ_NOINDEX_DETECTED does NOT fire when robotsNoindex is false", () => {
    const r = scorer.score(makeContext({ robotsNoindex: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_NOINDEX_DETECTED")).toBe(false);
  });

  it("MQ_NOFOLLOW_DETECTED fires when robotsNofollow is true", () => {
    const r = scorer.score(makeContext({ robotsNofollow: true }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_NOFOLLOW_DETECTED")).toBe(true);
  });

  it("MQ_NOFOLLOW_DETECTED does NOT fire when robotsNofollow is false", () => {
    const r = scorer.score(makeContext({ robotsNofollow: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_NOFOLLOW_DETECTED")).toBe(false);
  });

  it("MQ_MISSING_FEATURED_IMAGE fires when featured image is absent", () => {
    const r = scorer.score(makeContext({ featuredImagePresent: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_MISSING_FEATURED_IMAGE")).toBe(true);
  });

  it("MQ_MISSING_FEATURED_IMAGE has severity info", () => {
    const r = scorer.score(makeContext({ featuredImagePresent: false }));
    const rec = r.recommendations.find((rec) => rec.code === "MQ_MISSING_FEATURED_IMAGE");
    expect(rec?.severity).toBe("info");
  });

  it("MQ_ADD_OPEN_GRAPH fires when OG is absent", () => {
    const r = scorer.score(makeContext({ openGraphExists: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_ADD_OPEN_GRAPH")).toBe(true);
  });

  it("MQ_ADD_OPEN_GRAPH does NOT fire when OG is present", () => {
    const r = scorer.score(makeContext({ openGraphExists: true, openGraphPropertyCount: 5 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_ADD_OPEN_GRAPH")).toBe(false);
  });

  it("MQ_ADD_TWITTER_CARD fires when Twitter card is absent", () => {
    const r = scorer.score(makeContext({ twitterCardExists: false }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_ADD_TWITTER_CARD")).toBe(true);
  });

  it("MQ_ADD_TWITTER_CARD does NOT fire when Twitter card is present", () => {
    const r = scorer.score(makeContext({ twitterCardExists: true, twitterMetaCount: 4 }));
    expect(r.recommendations.some((rec) => rec.code === "MQ_ADD_TWITTER_CARD")).toBe(false);
  });

  it("no duplicate recommendation codes in output", () => {
    const r = scorer.score(makeContext());
    const codes = r.recommendations.map((rec) => rec.code);
    expect(codes.length).toBe(new Set(codes).size);
  });

  it("perfect-signal page produces zero recommendations", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      robotsNoindex: false, robotsNofollow: false,
      openGraphExists: true, openGraphPropertyCount: 7,
      twitterCardExists: true, twitterMetaCount: 5,
    }));
    expect(r.recommendations).toHaveLength(0);
  });
});

// ─── Breakdown structure ─────────────────────────────────────────────────────────

describe("MetadataQualityScorer — breakdown", () => {
  const scorer = new MetadataQualityScorer();

  it("breakdown contains the 'title' key", () => {
    const r = scorer.score(makeContext());
    expect("title" in r.breakdown).toBe(true);
  });

  it("breakdown contains the 'meta' key", () => {
    const r = scorer.score(makeContext());
    expect("meta" in r.breakdown).toBe(true);
  });

  it("breakdown contains the 'canonical' key", () => {
    const r = scorer.score(makeContext());
    expect("canonical" in r.breakdown).toBe(true);
  });

  it("breakdown contains the 'completeness' key", () => {
    const r = scorer.score(makeContext());
    expect("completeness" in r.breakdown).toBe(true);
  });

  it("breakdown contains the 'indexability' key", () => {
    const r = scorer.score(makeContext());
    expect("indexability" in r.breakdown).toBe(true);
  });

  it("breakdown contains the 'social' key", () => {
    const r = scorer.score(makeContext());
    expect("social" in r.breakdown).toBe(true);
  });

  it("breakdown contains _rawScore, _penaltyTotal, _cappedScore, _finalScore", () => {
    const r = scorer.score(makeContext());
    expect("_rawScore" in r.breakdown).toBe(true);
    expect("_penaltyTotal" in r.breakdown).toBe(true);
    expect("_cappedScore" in r.breakdown).toBe(true);
    expect("_finalScore" in r.breakdown).toBe(true);
  });

  it("breakdown._penaltyTotal is always 0 (no penalties in this scorer)", () => {
    const r = scorer.score(makeContext());
    expect(r.breakdown["_penaltyTotal"]).toBe(0);
  });

  it("breakdown._finalScore equals r.score", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 50,
      metaPresent: true, metaLength: 130,
    }));
    expect(r.breakdown["_finalScore"]).toBe(r.score);
  });

  it("breakdown.indexability is 100 when page is indexable", () => {
    const r = scorer.score(makeContext({ robotsNoindex: false }));
    expect(r.breakdown["indexability"]).toBe(100);
  });

  it("breakdown.indexability is 0 when page is noindexed", () => {
    const r = scorer.score(makeContext({ robotsNoindex: true }));
    expect(r.breakdown["indexability"]).toBe(0);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────────

describe("MetadataQualityScorer — determinism", () => {
  const scorer = new MetadataQualityScorer();

  it("same inputs always produce identical scores", () => {
    const ctx = makeContext({ titlePresent: true, titleLength: 45, metaPresent: true, metaLength: 140 });
    const r1 = scorer.score(ctx);
    const r2 = scorer.score(ctx);
    expect(r1.score).toBe(r2.score);
  });

  it("same inputs always produce identical breakdowns", () => {
    const ctx = makeContext({ canonicalPresent: true, h1Present: true });
    const r1 = scorer.score(ctx);
    const r2 = scorer.score(ctx);
    expect(r1.breakdown).toEqual(r2.breakdown);
  });
});

// ─── Monotonicity ────────────────────────────────────────────────────────────────

describe("MetadataQualityScorer — monotonicity", () => {
  const scorer = new MetadataQualityScorer();

  it("longer title in optimal range scores >= shorter title outside optimal range", () => {
    const short = scorer.score(makeContext({ titlePresent: true, titleLength: 15 }));
    const optimal = scorer.score(makeContext({ titlePresent: true, titleLength: 55 }));
    expect(optimal.score).toBeGreaterThan(short.score);
  });

  it("longer meta in optimal range scores >= shorter meta", () => {
    const thin = scorer.score(makeContext({ metaPresent: true, metaLength: 40 }));
    const good = scorer.score(makeContext({ metaPresent: true, metaLength: 140 }));
    expect(good.score).toBeGreaterThan(thin.score);
  });

  it("adding H1 + canonical + featured image improves score monotonically", () => {
    const base = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 140,
    }));
    const better = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 140,
      h1Present: true, canonicalPresent: true, featuredImagePresent: true,
    }));
    expect(better.score).toBeGreaterThan(base.score);
  });

  it("a page with social metadata scores higher than one without (all else equal)", () => {
    const noSocial = scorer.score(makeContext({
      titlePresent: true, titleLength: 55, metaPresent: true, metaLength: 140,
    }));
    const withSocial = scorer.score(makeContext({
      titlePresent: true, titleLength: 55, metaPresent: true, metaLength: 140,
      openGraphExists: true, openGraphPropertyCount: 5,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(withSocial.score).toBeGreaterThan(noSocial.score);
  });
});

// ─── Realistic fixtures ───────────────────────────────────────────────────────────

describe("MetadataQualityScorer — realistic fixtures", () => {
  const scorer = new MetadataQualityScorer();

  it("completely broken page scores lower than poor page", () => {
    const broken = scorer.score(makeContext());
    const poor = scorer.score(makeContext({
      titlePresent: true, titleLength: 15,
      metaPresent: true, metaLength: 40,
    }));
    expect(broken.score).toBeLessThan(poor.score);
  });

  it("poor page scores lower than mediocre page", () => {
    const poor = scorer.score(makeContext({
      titlePresent: true, titleLength: 15,
      metaPresent: true, metaLength: 40,
    }));
    const mediocre = scorer.score(makeContext({
      titlePresent: true, titleLength: 35,
      metaPresent: true, metaLength: 80,
      h1Present: true,
      canonicalPresent: true,
      openGraphExists: true, openGraphPropertyCount: 2,
    }));
    expect(poor.score).toBeLessThan(mediocre.score);
  });

  it("mediocre page scores lower than healthy page", () => {
    const mediocre = scorer.score(makeContext({
      titlePresent: true, titleLength: 35,
      metaPresent: true, metaLength: 80,
      h1Present: true,
      canonicalPresent: true,
    }));
    const healthy = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      openGraphExists: true, openGraphPropertyCount: 6,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(mediocre.score).toBeLessThan(healthy.score);
  });

  it("noindex page scores at most 10 regardless of other signals", () => {
    const noindex = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      robotsNoindex: true,
      openGraphExists: true, openGraphPropertyCount: 6,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(noindex.score).toBeLessThanOrEqual(10);
  });

  it("healthy page scores above 90", () => {
    const healthy = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      openGraphExists: true, openGraphPropertyCount: 6,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(healthy.score).toBeGreaterThan(90);
  });
});

// ─── Golden vectors ───────────────────────────────────────────────────────────────
//
// GV-1: All metadata absent, page is indexable.
//   Components: title=0, meta=0, canonical=0, completeness=0, indexability=100, social=0
//   rawScore = (0*30 + 0*25 + 0*15 + 0*15 + 100*10 + 0*5) / 100 = 10
//   finalScore = 10
//
// GV-2: Title present (15 chars), meta present (40 chars), all else absent.
//   titleScore = piecewiseLinear(15, curve) = 20 (exact breakpoint)
//   metaScore  = piecewiseLinear(40, curve) = 16  (0..50 segment: t=0.8, 0+0.8*20=16)
//   rawScore = (20*30 + 16*25 + 0 + 0 + 100*10 + 0) / 100 = 2000/100 = 20
//   finalScore = 20
//
// GV-3: Mediocre metadata.
//   titleScore = piecewiseLinear(35, curve) → [30,70][45,95]: t=5/15, y=70+25/3 ≈ 78.33 → bd=78.33
//   metaScore  = piecewiseLinear(80, curve) → [50,20][100,75]: t=0.6, y=20+33=53
//   canonicalScore=100, completeness=weightedAvg(100*0.6)=60, indexability=100
//   socialScore = ogScore(2)=55 via [1,40][3,70]: t=0.5,y=55 → 55*0.6=33
//   rawScore = (78.33*30 + 53*25 + 100*15 + 60*15 + 100*10 + 33*5) / 100
//            = (2350 + 1325 + 1500 + 900 + 1000 + 165) / 100 = 7240/100 = 72.4
//   finalScore = 72.4
//
// GV-4: Healthy metadata.
//   titleScore = 100 (exact at 55), metaScore = 880/9 ≈ 97.78 (bd rounded)
//   [120,95][165,100]: t=25/45, y=95+25/9
//   canonicalScore=100, completeness=100
//   socialScore: ogScore(6)=[5,90][7,100]:t=0.5→95; twitterScore(4)=[3,70][5,100]:t=0.5→85
//   socialScore = (95*60+85*40)/100=91
//   rawScore = (100*30 + (880/9)*25 + 100*15 + 100*15 + 100*10 + 91*5) / 100
//            = (3000 + 22000/9 + 1500 + 1500 + 1000 + 455) / 100 = 9899.44../100 ≈ 98.99
//   finalScore = 98.99
//
// GV-5: Perfect metadata but noindex — cap at 10.
//   Same as GV-4 but robotsNoindex=true: indexability=0
//   rawScore ≈ 8899.44../100 ≈ 88.99; cap=10 → finalScore=10

describe("MetadataQualityScorer — golden vectors", () => {
  const scorer = new MetadataQualityScorer();

  it("GV-1: all absent, indexable → score=10, normalizedScore=0.1", () => {
    const r = scorer.score(makeContext());
    expect(r.score).toBe(10);
    expect(r.normalizedScore).toBe(0.1);
    expect(r.breakdown["indexability"]).toBe(100);
    expect(r.breakdown["title"]).toBe(0);
    expect(r.breakdown["meta"]).toBe(0);
    expect(r.breakdown["canonical"]).toBe(0);
    expect(r.breakdown["completeness"]).toBe(0);
    expect(r.breakdown["social"]).toBe(0);
    expect(r.breakdown["_rawScore"]).toBe(10);
    expect(r.breakdown["_penaltyTotal"]).toBe(0);
    expect(r.breakdown["_finalScore"]).toBe(10);
  });

  it("GV-2: title=15 chars, meta=40 chars, all else absent → score=20, normalizedScore=0.2", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 15,
      metaPresent: true, metaLength: 40,
    }));
    expect(r.score).toBe(20);
    expect(r.normalizedScore).toBe(0.2);
    expect(r.breakdown["title"]).toBe(20);
    expect(r.breakdown["meta"]).toBe(16);
    expect(r.breakdown["_rawScore"]).toBe(20);
  });

  it("GV-3: mediocre → score=72.4, normalizedScore=0.724", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 35,
      metaPresent: true, metaLength: 80,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: false, imageAltPresent: false,
      robotsNoindex: false,
      openGraphExists: true, openGraphPropertyCount: 2,
      twitterCardExists: false,
    }));
    expect(r.score).toBe(72.4);
    expect(r.normalizedScore).toBe(0.724);
    expect(r.breakdown["title"]).toBe(78.33);
    expect(r.breakdown["meta"]).toBe(53);
    expect(r.breakdown["canonical"]).toBe(100);
    expect(r.breakdown["completeness"]).toBe(60);
    expect(r.breakdown["indexability"]).toBe(100);
    expect(r.breakdown["social"]).toBe(33);
    expect(r.breakdown["_rawScore"]).toBe(72.4);
  });

  it("GV-4: healthy → score=98.99, normalizedScore=0.9899", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      robotsNoindex: false,
      openGraphExists: true, openGraphPropertyCount: 6,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(r.score).toBe(98.99);
    expect(r.normalizedScore).toBe(0.9899);
    expect(r.breakdown["title"]).toBe(100);
    expect(r.breakdown["meta"]).toBe(97.78);
    expect(r.breakdown["canonical"]).toBe(100);
    expect(r.breakdown["completeness"]).toBe(100);
    expect(r.breakdown["indexability"]).toBe(100);
    expect(r.breakdown["social"]).toBe(91);
    expect(r.breakdown["_rawScore"]).toBe(98.99);
    expect(r.recommendations).toHaveLength(0);
  });

  it("GV-5: perfect metadata but noindex → score=10, rawScore=88.99 in breakdown", () => {
    const r = scorer.score(makeContext({
      titlePresent: true, titleLength: 55,
      metaPresent: true, metaLength: 145,
      h1Present: true,
      canonicalPresent: true,
      featuredImagePresent: true, imageAltPresent: true,
      robotsNoindex: true,
      openGraphExists: true, openGraphPropertyCount: 6,
      twitterCardExists: true, twitterMetaCount: 4,
    }));
    expect(r.score).toBe(10);
    expect(r.normalizedScore).toBe(0.1);
    expect(r.breakdown["_rawScore"]).toBe(88.99);
    expect(r.breakdown["_cappedScore"]).toBe(10);
    expect(r.breakdown["_finalScore"]).toBe(10);
    expect(r.breakdown["indexability"]).toBe(0);
    const noindexRec = r.recommendations.find((rec) => rec.code === "MQ_NOINDEX_DETECTED");
    expect(noindexRec).toBeDefined();
    expect(noindexRec?.severity).toBe("error");
  });
});

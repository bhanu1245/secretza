import { describe, it, expect } from "vitest";
import {
  measure,
  normalise,
  countPhraseOccurrences,
  splitSentences,
  splitParagraphs,
  countWords,
  isListHeavy,
  hasPassiveConstruction,
  AI_TRANSITION_PHRASES,
  AI_HEDGING_PHRASES,
  AI_MARKETING_PHRASES,
  GENERIC_CLAIM_PHRASES,
  STOCK_AI_PHRASES,
  CONCLUSION_PHRASES,
  CTA_PHRASES,
  ALL_AI_PHRASES,
} from "@/lib/seo-providers/ai-pattern-metrics-provider";
import type { MetricsCollectorInput } from "@/lib/seo-quality-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<MetricsCollectorInput> = {}): MetricsCollectorInput {
  return {
    introContent:      "",
    faqItems:          [],
    title:             null,
    metaDescription:   null,
    h1:                null,
    canonicalUrl:      null,
    featuredImage:     null,
    imageAlt:          null,
    structuredData:    null,
    internalLinks:     [],
    primaryKeyword:    null,
    secondaryKeywords: [],
    peerPages:         [],
    cityIntel:         null,
    pageContext: {
      pageType:          "city",
      pageSlug:          "test",
      primaryKeyword:    null,
      secondaryKeywords: [],
      attempt:           1,
    },
    ...overrides,
  };
}

// ─── normalise ────────────────────────────────────────────────────────────────

describe("normalise", () => {
  it("lowercases text", () => {
    expect(normalise("Furthermore, This Is Great")).toBe("furthermore, this is great");
  });

  it("collapses repeated whitespace", () => {
    expect(normalise("hello   world")).toBe("hello world");
  });

  it("trims", () => {
    expect(normalise("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(normalise("")).toBe("");
  });
});

// ─── countPhraseOccurrences ───────────────────────────────────────────────────

describe("countPhraseOccurrences", () => {
  it("counts single occurrence", () => {
    expect(countPhraseOccurrences("however we should note", "however")).toBe(1);
  });

  it("counts multiple occurrences", () => {
    expect(countPhraseOccurrences("furthermore we find. furthermore it shows.", "furthermore")).toBe(2);
  });

  it("returns 0 when phrase absent", () => {
    expect(countPhraseOccurrences("nothing special here", "additionally")).toBe(0);
  });

  it("does not match phrase inside longer word (boundary check)", () => {
    expect(countPhraseOccurrences("additionally2 items", "additionally")).toBe(0);
  });

  it("returns 0 for empty phrase", () => {
    expect(countPhraseOccurrences("some text", "")).toBe(0);
  });
});

// ─── splitSentences ───────────────────────────────────────────────────────────

describe("splitSentences", () => {
  it("splits on period-space", () => {
    expect(splitSentences("first. second.")).toHaveLength(2);
  });

  it("splits on question mark", () => {
    expect(splitSentences("why? because.")).toHaveLength(2);
  });

  it("returns empty array for empty string", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

// ─── splitParagraphs ──────────────────────────────────────────────────────────

describe("splitParagraphs", () => {
  it("splits on blank line", () => {
    expect(splitParagraphs("para one.\n\npara two.")).toHaveLength(2);
  });

  it("normalises paragraph text", () => {
    expect(splitParagraphs("Hello  World.")).toEqual(["hello world."]);
  });

  it("returns empty for empty string", () => {
    expect(splitParagraphs("")).toEqual([]);
  });
});

// ─── countWords ───────────────────────────────────────────────────────────────

describe("countWords", () => {
  it("counts ASCII words", () => {
    expect(countWords("hello world foo")).toBe(3);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("counts Unicode words", () => {
    expect(countWords("हैदराबाद escorts")).toBe(2);
  });
});

// ─── isListHeavy ─────────────────────────────────────────────────────────────

describe("isListHeavy", () => {
  it("detects HTML list tag", () => {
    expect(isListHeavy("<ul><li>Item one</li><li>Item two</li></ul>")).toBe(true);
  });

  it("detects markdown bullets (≥2 lines)", () => {
    expect(isListHeavy("- item one\n- item two")).toBe(true);
  });

  it("detects numbered markdown list", () => {
    expect(isListHeavy("1. first\n2. second")).toBe(true);
  });

  it("returns false for prose paragraph", () => {
    expect(isListHeavy("This is a normal paragraph with no list items.")).toBe(false);
  });

  it("returns false for single markdown bullet (below threshold)", () => {
    expect(isListHeavy("- only one item")).toBe(false);
  });
});

// ─── hasPassiveConstruction ───────────────────────────────────────────────────

describe("hasPassiveConstruction", () => {
  it("detects 'was completed' (regular -ed)", () => {
    expect(hasPassiveConstruction("the task was completed yesterday")).toBe(true);
  });

  it("detects 'is generated' (regular -ed)", () => {
    expect(hasPassiveConstruction("the report is generated daily")).toBe(true);
  });

  it("detects 'has been produced' (irregular phrase list)", () => {
    expect(hasPassiveConstruction("the content has been produced by our team")).toBe(true);
  });

  it("detects 'were made' (irregular phrase list)", () => {
    expect(hasPassiveConstruction("changes were made to the system")).toBe(true);
  });

  it("returns false for active-voice sentence", () => {
    expect(hasPassiveConstruction("our team creates content every day")).toBe(false);
  });

  it("detects 'can be done'", () => {
    expect(hasPassiveConstruction("this can be done easily")).toBe(true);
  });
});

// ─── Dictionary exports ───────────────────────────────────────────────────────

describe("phrase dictionaries", () => {
  it("ALL_AI_PHRASES contains phrases from every category", () => {
    expect(ALL_AI_PHRASES).toContain("furthermore");
    expect(ALL_AI_PHRASES).toContain("it is important to note");
    expect(ALL_AI_PHRASES).toContain("best choice");
    expect(ALL_AI_PHRASES).toContain("easy to use");
    expect(ALL_AI_PHRASES).toContain("in a nutshell");
    expect(ALL_AI_PHRASES).toContain("in conclusion");
    expect(ALL_AI_PHRASES).toContain("contact us");
  });

  it("ALL_AI_PHRASES has no duplicates", () => {
    const set = new Set(ALL_AI_PHRASES);
    expect(set.size).toBe(ALL_AI_PHRASES.length);
  });

  it("AI_TRANSITION_PHRASES contains 'furthermore'", () => {
    expect(AI_TRANSITION_PHRASES).toContain("furthermore");
  });

  it("AI_HEDGING_PHRASES contains 'it is important to note'", () => {
    expect(AI_HEDGING_PHRASES).toContain("it is important to note");
  });

  it("AI_MARKETING_PHRASES contains 'best choice'", () => {
    expect(AI_MARKETING_PHRASES).toContain("best choice");
  });

  it("GENERIC_CLAIM_PHRASES contains 'easy to use'", () => {
    expect(GENERIC_CLAIM_PHRASES).toContain("easy to use");
  });

  it("STOCK_AI_PHRASES contains 'in a nutshell'", () => {
    expect(STOCK_AI_PHRASES).toContain("in a nutshell");
  });

  it("CONCLUSION_PHRASES contains 'in conclusion'", () => {
    expect(CONCLUSION_PHRASES).toContain("in conclusion");
  });

  it("CTA_PHRASES contains 'contact us'", () => {
    expect(CTA_PHRASES).toContain("contact us");
  });
});

// ─── measure — empty content ──────────────────────────────────────────────────

describe("measure — empty content", () => {
  it("returns 0 for all count metrics", () => {
    const r = measure(makeInput());
    expect(r.aiPhraseCount).toBe(0);
    expect(r.aiTransitionPhraseCount).toBe(0);
    expect(r.aiHedgingPhraseCount).toBe(0);
    expect(r.aiMarketingPhraseCount).toBe(0);
    expect(r.genericClaimCount).toBe(0);
    expect(r.stockPhraseCount).toBe(0);
    expect(r.conclusionPatternCount).toBe(0);
    expect(r.callToActionPatternCount).toBe(0);
    expect(r.templateSentenceCount).toBe(0);
    expect(r.templateParagraphCount).toBe(0);
    expect(r.repetitiveOpeningCount).toBe(0);
    expect(r.repetitiveClosingCount).toBe(0);
  });

  it("returns 0 for all density metrics", () => {
    const r = measure(makeInput());
    expect(r.aiPhraseDensity).toBe(0);
    expect(r.aiPhraseRatio).toBe(0);
    expect(r.exclamationDensity).toBe(0);
    expect(r.questionDensity).toBe(0);
    expect(r.vocabularyRepetition).toBe(0);
  });

  it("returns 0 for uniformity metrics (no data)", () => {
    const r = measure(makeInput());
    expect(r.sentenceLengthUniformity).toBe(0);
    expect(r.paragraphLengthUniformity).toBe(0);
    expect(r.headingLengthUniformity).toBe(0);
  });

  it("returns 0 for all ratio metrics", () => {
    const r = measure(makeInput());
    expect(r.passiveVoiceProxy).toBe(0);
    expect(r.listHeavyRatio).toBe(0);
    expect(r.transitionOveruseScore).toBe(0);
  });
});

// ─── measure — transition phrases ────────────────────────────────────────────

describe("measure — transition phrases", () => {
  it("counts 'furthermore' as an AI transition phrase", () => {
    const r = measure(makeInput({
      introContent: "Furthermore, our services are top quality.",
    }));
    expect(r.aiTransitionPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("counts 'additionally' as an AI transition phrase", () => {
    const r = measure(makeInput({
      introContent: "additionally, we offer discreet services.",
    }));
    expect(r.aiTransitionPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("counts multiple distinct transition phrases", () => {
    const r = measure(makeInput({
      introContent: "Furthermore, we offer services. Moreover, we are trusted. Additionally, contact us.",
    }));
    expect(r.aiTransitionPhraseCount).toBe(3);
  });

  it("aiPhraseCount includes transition phrase count", () => {
    const r = measure(makeInput({
      introContent: "Furthermore, our service is great.",
    }));
    expect(r.aiPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("transitionOveruseScore = 1 when every sentence has a transition phrase", () => {
    const r = measure(makeInput({
      introContent: "Furthermore, we help. Moreover, we care. Additionally, we deliver.",
    }));
    expect(r.transitionOveruseScore).toBe(1);
  });

  it("transitionOveruseScore = 0 when no sentence has a transition phrase", () => {
    const r = measure(makeInput({
      introContent: "We help our clients. We care for them. We deliver results.",
    }));
    expect(r.transitionOveruseScore).toBe(0);
  });
});

// ─── measure — marketing phrases ─────────────────────────────────────────────

describe("measure — marketing phrases", () => {
  it("counts 'best choice' as marketing phrase", () => {
    const r = measure(makeInput({ introContent: "We are the best choice for you." }));
    expect(r.aiMarketingPhraseCount).toBe(1);
  });

  it("counts 'world class' as marketing phrase", () => {
    const r = measure(makeInput({ introContent: "Our world class escorts are available." }));
    expect(r.aiMarketingPhraseCount).toBe(1);
  });

  it("counts 'cutting edge' as marketing phrase", () => {
    const r = measure(makeInput({ introContent: "We offer cutting edge services." }));
    expect(r.aiMarketingPhraseCount).toBe(1);
  });

  it("marketing phrase count is 0 for plain text", () => {
    const r = measure(makeInput({ introContent: "Our escorts are available in Hyderabad." }));
    expect(r.aiMarketingPhraseCount).toBe(0);
  });
});

// ─── measure — stock AI phrases ───────────────────────────────────────────────

describe("measure — stock AI phrases", () => {
  it("counts 'it is important to note' as a stock phrase", () => {
    const r = measure(makeInput({
      introContent: "It is important to note that our services are discreet.",
    }));
    expect(r.stockPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("counts 'in a nutshell' as a stock phrase", () => {
    const r = measure(makeInput({
      introContent: "In a nutshell, we are the best.",
    }));
    expect(r.stockPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("counts 'rest assured' as a stock phrase", () => {
    const r = measure(makeInput({ introContent: "Rest assured, you are in good hands." }));
    expect(r.stockPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("stockPhraseCount is 0 for phrase-free text", () => {
    const r = measure(makeInput({ introContent: "Hyderabad escorts are available 24 hours." }));
    expect(r.stockPhraseCount).toBe(0);
  });

  it("stockPhraseCount contributes to aiPhraseCount", () => {
    const r = measure(makeInput({ introContent: "In a nutshell, contact us today." }));
    expect(r.aiPhraseCount).toBeGreaterThan(r.stockPhraseCount! - 1);
  });
});

// ─── measure — generic claims ─────────────────────────────────────────────────

describe("measure — generic claims", () => {
  it("counts 'easy to use' as a generic claim", () => {
    const r = measure(makeInput({ introContent: "Our platform is easy to use." }));
    expect(r.genericClaimCount).toBe(1);
  });

  it("counts 'high quality' as a generic claim", () => {
    const r = measure(makeInput({ introContent: "We provide high quality escorts." }));
    expect(r.genericClaimCount).toBe(1);
  });

  it("counts 'excellent service' as a generic claim", () => {
    const r = measure(makeInput({ introContent: "Expect excellent service from us." }));
    expect(r.genericClaimCount).toBe(1);
  });
});

// ─── measure — passive voice proxy ───────────────────────────────────────────

describe("measure — passive voice proxy", () => {
  it("passiveVoiceProxy > 0 for sentence with 'was completed'", () => {
    const r = measure(makeInput({ introContent: "The booking was completed successfully." }));
    expect(r.passiveVoiceProxy).toBeGreaterThan(0);
  });

  it("passiveVoiceProxy = 0 for fully active content", () => {
    const r = measure(makeInput({
      introContent: "We create top escorts in Hyderabad. Our team delivers results. Clients love us.",
    }));
    expect(r.passiveVoiceProxy).toBe(0);
  });

  it("passiveVoiceProxy is a fraction between 0 and 1", () => {
    const r = measure(makeInput({
      introContent:
        "Our services were created with care. We deliver quality. The profile was updated daily.",
    }));
    expect(r.passiveVoiceProxy).toBeGreaterThan(0);
    expect(r.passiveVoiceProxy).toBeLessThanOrEqual(1);
  });

  it("passiveVoiceProxy = 1 when all sentences are passive", () => {
    const r = measure(makeInput({
      introContent: "Results were produced by our team. Services were created for you.",
    }));
    expect(r.passiveVoiceProxy).toBe(1);
  });
});

// ─── measure — repetitive openings ───────────────────────────────────────────

describe("measure — repetitive openings", () => {
  it("repetitiveOpeningCount = 0 when all sentence openings are unique", () => {
    const r = measure(makeInput({
      introContent:
        "We offer escorts. Our services are premium. Book today for great results.",
    }));
    expect(r.repetitiveOpeningCount).toBe(0);
  });

  it("repetitiveOpeningCount > 0 when sentences share the same opening", () => {
    const r = measure(makeInput({
      introContent:
        "Our escorts are available. Our escorts are premium. Our escorts are discreet.",
    }));
    expect(r.repetitiveOpeningCount).toBeGreaterThan(0);
  });

  it("openingVariationScore = 1 when all openings are unique", () => {
    const r = measure(makeInput({
      introContent: "First sentence here. Second one here. Third comes now.",
    }));
    // 3 sentences, 3 unique openings → 3/3 = 1
    expect(r.openingVariationScore).toBe(1);
  });

  it("openingVariationScore < 1 when openings repeat", () => {
    const r = measure(makeInput({
      introContent:
        "Our escorts are available. Our escorts are premium. Different sentence here.",
    }));
    expect(r.openingVariationScore).toBeLessThan(1);
  });
});

// ─── measure — repetitive closings ───────────────────────────────────────────

describe("measure — repetitive closings", () => {
  it("repetitiveClosingCount = 0 when all closings are unique", () => {
    const r = measure(makeInput({
      introContent: "Book our escorts now. They are available 24 hours. Call us today.",
    }));
    expect(r.repetitiveClosingCount).toBe(0);
  });

  it("repetitiveClosingCount > 0 when sentences share the same closing", () => {
    const r = measure(makeInput({
      introContent:
        "We are available today. Our escorts are available today. Contact us today.",
    }));
    // "available today" appears at the end of multiple sentences
    expect(r.repetitiveClosingCount).toBeGreaterThan(0);
  });

  it("closingVariationScore = 1 when all closings are unique", () => {
    const r = measure(makeInput({
      introContent: "Call us now. Book escorts here. Get results fast.",
    }));
    expect(r.closingVariationScore).toBe(1);
  });
});

// ─── measure — sentence uniformity ───────────────────────────────────────────

describe("measure — sentence uniformity", () => {
  it("sentenceLengthUniformity = 0 for empty content", () => {
    expect(measure(makeInput()).sentenceLengthUniformity).toBe(0);
  });

  it("sentenceLengthUniformity = 1 when all sentences are the same length", () => {
    // 3 sentences each with exactly 5 words → CV = 0 → uniformity = 1
    const r = measure(makeInput({
      introContent: "escorts are here for you. escorts are here for you. escorts are here for you.",
    }));
    expect(r.sentenceLengthUniformity).toBe(1);
  });

  it("sentenceLengthUniformity < 1 when sentence lengths vary", () => {
    const r = measure(makeInput({
      introContent: "Short sentence. This sentence is significantly longer than the first one and has many words. Ok.",
    }));
    expect(r.sentenceLengthUniformity).toBeGreaterThan(0);
    expect(r.sentenceLengthUniformity).toBeLessThan(1);
  });

  it("averageSentenceVariance = 0 when all sentences are the same length", () => {
    const r = measure(makeInput({
      introContent: "one two three. one two three. one two three.",
    }));
    expect(r.averageSentenceVariance).toBe(0);
  });

  it("averageSentenceVariance > 0 when sentence lengths differ", () => {
    const r = measure(makeInput({
      introContent: "Short. This is a much longer sentence with many words indeed.",
    }));
    expect(r.averageSentenceVariance).toBeGreaterThan(0);
  });
});

// ─── measure — paragraph uniformity ──────────────────────────────────────────

describe("measure — paragraph uniformity", () => {
  it("paragraphLengthUniformity = 0 for empty content", () => {
    expect(measure(makeInput()).paragraphLengthUniformity).toBe(0);
  });

  it("paragraphLengthUniformity = 1 when all paragraphs have the same length", () => {
    const r = measure(makeInput({
      introContent: "escorts here now.\n\nescorts here now.\n\nescorts here now.",
    }));
    expect(r.paragraphLengthUniformity).toBe(1);
  });

  it("paragraphBurstiness = 0 when all paragraphs have the same length", () => {
    const r = measure(makeInput({
      introContent: "escorts here now.\n\nescorts here now.",
    }));
    expect(r.paragraphBurstiness).toBe(0);
  });

  it("paragraphBurstiness > 0 when paragraph lengths differ", () => {
    const r = measure(makeInput({
      introContent:
        "Short paragraph.\n\nThis paragraph is much much much much much much much much much much longer than the first one.",
    }));
    expect(r.paragraphBurstiness).toBeGreaterThan(0);
  });

  it("averageParagraphVariance = 0 for single paragraph", () => {
    const r = measure(makeInput({ introContent: "Just one paragraph here." }));
    expect(r.averageParagraphVariance).toBe(0);
  });
});

// ─── measure — burstiness ────────────────────────────────────────────────────

describe("measure — burstiness", () => {
  it("lexicalBurstiness = 0 for empty content", () => {
    expect(measure(makeInput()).lexicalBurstiness).toBe(0);
  });

  it("lexicalBurstiness > 0 when some words appear much more than others", () => {
    // "escorts" appears 5 times, all others once → high frequency variance
    const r = measure(makeInput({
      introContent:
        "escorts escorts escorts escorts escorts in hyderabad are available.",
    }));
    expect(r.lexicalBurstiness).toBeGreaterThan(0);
  });

  it("lexicalBurstiness is bounded (positive)", () => {
    const r = measure(makeInput({ introContent: "escorts are available." }));
    expect(r.lexicalBurstiness).toBeGreaterThanOrEqual(0);
  });
});

// ─── measure — repeated vocabulary ───────────────────────────────────────────

describe("measure — repeated vocabulary", () => {
  it("vocabularyRepetition = 0 when all tokens are unique", () => {
    const r = measure(makeInput({ introContent: "alpha beta gamma delta epsilon." }));
    expect(r.vocabularyRepetition).toBe(0);
  });

  it("vocabularyRepetition > 0 when words repeat", () => {
    const r = measure(makeInput({
      introContent: "escorts in delhi and escorts in mumbai and escorts in hyderabad.",
    }));
    expect(r.vocabularyRepetition).toBeGreaterThan(0);
  });

  it("vocabularyRepetition = 1 when every token type is repeated", () => {
    // "a a b b" → both "a" and "b" are repeated types, all 4 tokens belong to repeated types
    const r = measure(makeInput({ introContent: "a a b b." }));
    // tokens: ["a","a","b","b"] → a×2, b×2 → all 4 tokens are from repeated types → ratio = 1
    expect(r.vocabularyRepetition).toBe(1);
  });

  it("vocabularyRepetition is bounded between 0 and 1", () => {
    const r = measure(makeInput({ introContent: "escorts in hyderabad are great escorts." }));
    expect(r.vocabularyRepetition).toBeGreaterThan(0);
    expect(r.vocabularyRepetition).toBeLessThanOrEqual(1);
  });
});

// ─── measure — lists ─────────────────────────────────────────────────────────

describe("measure — lists", () => {
  it("listHeavyRatio = 0 when no list paragraphs", () => {
    const r = measure(makeInput({ introContent: "Escorts are available. Contact us." }));
    expect(r.listHeavyRatio).toBe(0);
  });

  it("listHeavyRatio > 0 when intro has list paragraph", () => {
    // splitParagraphs collapses intra-paragraph newlines; HTML list tags survive normalisation
    const r = measure(makeInput({
      introContent: "Our services:\n\n<ul><li>Premium escorts</li><li>Discreet services</li><li>24h availability</li></ul>",
    }));
    expect(r.listHeavyRatio).toBeGreaterThan(0);
  });

  it("listHeavyRatio = 1 when all paragraphs are list-heavy", () => {
    const r = measure(makeInput({
      introContent: "<ul><li>Item one</li><li>Item two</li></ul>",
    }));
    expect(r.listHeavyRatio).toBe(1);
  });
});

// ─── measure — CTA patterns ───────────────────────────────────────────────────

describe("measure — CTA patterns", () => {
  it("callToActionPatternCount = 0 for CTA-free content", () => {
    const r = measure(makeInput({ introContent: "Our escorts are premium quality." }));
    expect(r.callToActionPatternCount).toBe(0);
  });

  it("counts 'contact us' as CTA", () => {
    const r = measure(makeInput({ introContent: "Please contact us for a booking." }));
    expect(r.callToActionPatternCount).toBeGreaterThanOrEqual(1);
  });

  it("counts 'book now' as CTA", () => {
    const r = measure(makeInput({ introContent: "Book now and get the best escorts." }));
    expect(r.callToActionPatternCount).toBeGreaterThanOrEqual(1);
  });

  it("counts multiple CTAs", () => {
    const r = measure(makeInput({
      introContent: "Contact us today. Book now for our services. Get started immediately.",
    }));
    expect(r.callToActionPatternCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── measure — conclusions ────────────────────────────────────────────────────

describe("measure — conclusion patterns", () => {
  it("conclusionPatternCount = 0 for content without conclusion phrases", () => {
    const r = measure(makeInput({ introContent: "Escorts are available in Hyderabad." }));
    expect(r.conclusionPatternCount).toBe(0);
  });

  it("counts 'in conclusion' as a conclusion pattern", () => {
    const r = measure(makeInput({
      introContent: "In conclusion, our escorts are the best available.",
    }));
    expect(r.conclusionPatternCount).toBeGreaterThanOrEqual(1);
  });

  it("counts 'to summarize' as a conclusion pattern", () => {
    const r = measure(makeInput({
      introContent: "To summarize, book our premium services now.",
    }));
    expect(r.conclusionPatternCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — Unicode text ───────────────────────────────────────────────────

describe("measure — Unicode text", () => {
  it("does not throw on Unicode introContent", () => {
    expect(() =>
      measure(makeInput({ introContent: "हैदराबाद एस्कॉर्ट सेवाएं उपलब्ध हैं." }))
    ).not.toThrow();
  });

  it("does not throw on mixed Unicode and ASCII", () => {
    expect(() =>
      measure(makeInput({
        introContent: "Furthermore, हैदराबाद escorts are available. Additionally, they are premium.",
      }))
    ).not.toThrow();
  });

  it("still counts transition phrases in mixed Unicode content", () => {
    const r = measure(makeInput({
      introContent: "Furthermore, हैदराबाद escorts are top quality.",
    }));
    expect(r.aiTransitionPhraseCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — malformed input ────────────────────────────────────────────────

describe("measure — malformed input", () => {
  it("does not throw when introContent is undefined", () => {
    const input = makeInput({ introContent: undefined as unknown as string });
    expect(() => measure(input)).not.toThrow();
  });

  it("does not throw when faqItems contain empty strings", () => {
    expect(() =>
      measure(makeInput({ faqItems: [{ question: "", answer: "" }] }))
    ).not.toThrow();
  });

  it("does not throw when headings is empty array", () => {
    expect(() => measure(makeInput({ headings: [] }))).not.toThrow();
  });

  it("does not throw on very long repeated content", () => {
    const long = "Furthermore, our escorts are outstanding. ".repeat(200);
    expect(() => measure(makeInput({ introContent: long }))).not.toThrow();
  });

  it("handles null h1 without throwing", () => {
    expect(() => measure(makeInput({ h1: null }))).not.toThrow();
  });
});

// ─── measure — mixed case ────────────────────────────────────────────────────

describe("measure — mixed case", () => {
  it("detects 'FURTHERMORE' as a transition phrase", () => {
    const r = measure(makeInput({ introContent: "FURTHERMORE, our services are great." }));
    expect(r.aiTransitionPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("detects 'IT IS IMPORTANT TO NOTE' as a hedging phrase", () => {
    const r = measure(makeInput({
      introContent: "IT IS IMPORTANT TO NOTE that we are discreet.",
    }));
    expect(r.aiHedgingPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("detects 'CONTACT US' as CTA phrase", () => {
    const r = measure(makeInput({ introContent: "CONTACT US for a booking." }));
    expect(r.callToActionPatternCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — whitespace normalization ───────────────────────────────────────

describe("measure — whitespace normalization", () => {
  it("detects transition phrase with extra whitespace", () => {
    const r = measure(makeInput({
      introContent: "Furthermore,  our services are top.",
    }));
    expect(r.aiTransitionPhraseCount).toBeGreaterThanOrEqual(1);
  });

  it("countWords handles extra whitespace correctly", () => {
    expect(countWords("hello   world   foo")).toBe(3);
  });
});

// ─── measure — punctuation normalization ─────────────────────────────────────

describe("measure — punctuation normalization", () => {
  it("detects phrase adjacent to punctuation", () => {
    // "contact us," — comma immediately after, boundary before 'c'
    const r = measure(makeInput({ introContent: "Please contact us, for bookings." }));
    expect(r.callToActionPatternCount).toBeGreaterThanOrEqual(1);
  });

  it("exclamationDensity counts '!' in content", () => {
    const r = measure(makeInput({ introContent: "Escorts are available! Book now! Call us!" }));
    expect(r.exclamationDensity).toBeGreaterThan(0);
  });

  it("questionDensity counts '?' in content", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "What are the rates?", answer: "Rates vary." },
        { question: "Where are you located?", answer: "Hyderabad." },
      ],
    }));
    expect(r.questionDensity).toBeGreaterThan(0);
  });
});

// ─── measure — concept density ───────────────────────────────────────────────

describe("measure — aiPhraseDensity", () => {
  it("aiPhraseDensity = 0 when no AI phrases present", () => {
    const r = measure(makeInput({ introContent: "escorts in hyderabad." }));
    expect(r.aiPhraseDensity).toBe(0);
  });

  it("aiPhraseDensity > 0 when AI phrases present", () => {
    const r = measure(makeInput({
      introContent: "Furthermore, our escorts are available. Additionally, contact us.",
    }));
    expect(r.aiPhraseDensity).toBeGreaterThan(0);
  });

  it("aiPhraseDensity is bounded (per 100 words, can exceed 100 theoretically)", () => {
    const r = measure(makeInput({ introContent: "Furthermore." }));
    expect(r.aiPhraseDensity).toBeGreaterThanOrEqual(0);
  });
});

// ─── measure — heading uniformity ────────────────────────────────────────────

describe("measure — heading uniformity", () => {
  it("headingLengthUniformity = 0 for no headings", () => {
    expect(measure(makeInput()).headingLengthUniformity).toBe(0);
  });

  it("headingLengthUniformity = 1 when all headings are the same length", () => {
    const r = measure(makeInput({
      headings: ["escorts in delhi", "escorts in mumbai"],
      // Both 3 words → CV = 0 → uniformity = 1
    }));
    expect(r.headingLengthUniformity).toBe(1);
  });

  it("headingLengthUniformity < 1 when heading lengths vary", () => {
    const r = measure(makeInput({
      headings: ["Services", "Our Premium Escort Services in Hyderabad"],
    }));
    expect(r.headingLengthUniformity).toBeGreaterThan(0);
    expect(r.headingLengthUniformity).toBeLessThan(1);
  });
});

// ─── measure — repetitionRisk & humanVariationScore ──────────────────────────

describe("measure — repetitionRisk and humanVariationScore", () => {
  it("repetitionRisk + humanVariationScore = 1", () => {
    const r = measure(makeInput({ introContent: "escorts in hyderabad." }));
    expect(r.repetitionRisk! + r.humanVariationScore!).toBeCloseTo(1, 4);
  });

  it("repetitionRisk = 0 for empty content", () => {
    // Empty → all sub-signals 0 → risk = 0
    expect(measure(makeInput()).repetitionRisk).toBe(0);
  });

  it("repetitionRisk > 0 for AI-pattern-heavy content", () => {
    const r = measure(makeInput({
      introContent:
        "Furthermore, our escorts are available. Moreover, our escorts are premium. " +
        "Additionally, our escorts are discreet. In conclusion, contact us today.",
    }));
    expect(r.repetitionRisk).toBeGreaterThan(0);
  });

  it("humanVariationScore is bounded between 0 and 1", () => {
    const r = measure(makeInput({ introContent: "We offer escorts in Hyderabad." }));
    expect(r.humanVariationScore).toBeGreaterThanOrEqual(0);
    expect(r.humanVariationScore).toBeLessThanOrEqual(1);
  });
});

// ─── measure — templateSentenceCount ─────────────────────────────────────────

describe("measure — templateSentenceCount", () => {
  it("templateSentenceCount = 0 for phrase-free content", () => {
    const r = measure(makeInput({
      introContent: "Escorts in Hyderabad are available. Book your appointment.",
    }));
    expect(r.templateSentenceCount).toBe(0);
  });

  it("templateSentenceCount counts sentences with ≥1 AI phrase", () => {
    const r = measure(makeInput({
      introContent:
        "Furthermore, our escorts are available. Escorts are in Hyderabad. Contact us today.",
    }));
    // sentence 1 has "furthermore", sentence 3 has "contact us" → 2
    expect(r.templateSentenceCount).toBe(2);
  });

  it("templateSentenceRatio = templateSentenceCount / totalSentences", () => {
    const r = measure(makeInput({
      introContent:
        "Furthermore, book now. Regular sentence here. Additionally, call us.",
    }));
    // 3 sentences: 1 with "furthermore" + "book now", 1 plain, 1 with "additionally" + "call us"
    // → 2 template sentences → ratio = 2/3
    expect(r.templateSentenceRatio).toBeCloseTo(2 / 3, 3);
  });
});

// ─── measure — FAQ content counted ───────────────────────────────────────────

describe("measure — FAQ content included in metrics", () => {
  it("FAQ content contributes to aiPhraseCount", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "What do you offer?", answer: "Furthermore, we offer premium quality escorts." },
      ],
    }));
    expect(r.aiPhraseCount).toBeGreaterThan(0);
  });

  it("FAQ transition phrases count toward transitionOveruseScore", () => {
    const r = measure(makeInput({
      faqItems: [
        {
          question: "How do you work?",
          answer: "Furthermore, we operate 24 hours.",
        },
      ],
    }));
    expect(r.aiTransitionPhraseCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — headings contribute to heading metrics only ───────────────────

describe("measure — headings", () => {
  it("h1 contributes to headingLengthUniformity", () => {
    const r = measure(makeInput({ h1: "Premium Escorts in Hyderabad" }));
    expect(r.headingLengthUniformity).toBe(1); // single heading → trivially uniform
  });

  it("supplied headings contribute to headingLengthUniformity", () => {
    const r = measure(makeInput({
      headings: ["Our Services", "About Us"],
    }));
    // "Our Services" = 2 words, "About Us" = 2 words → CV = 0 → uniformity = 1
    expect(r.headingLengthUniformity).toBe(1);
  });
});

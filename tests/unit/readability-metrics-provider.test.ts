import { describe, it, expect } from "vitest";
import {
  measure,
  countSyllables,
  DEFAULT_TRANSITION_WORDS,
} from "@/lib/seo-providers/readability-metrics-provider";
import type { MetricsCollectorInput } from "@/lib/seo-quality-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
      pageType:           "city",
      pageSlug:           "test-city",
      primaryKeyword:     null,
      secondaryKeywords:  [],
      attempt:            1,
    },
    ...overrides,
  };
}

// ─── countSyllables unit tests ────────────────────────────────────────────────

describe("countSyllables", () => {
  it("counts single-vowel words correctly", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("dog")).toBe(1);
    expect(countSyllables("the")).toBe(1);
  });

  it("counts two-syllable words", () => {
    expect(countSyllables("garden")).toBe(2);
    expect(countSyllables("table")).toBe(2);
  });

  it("counts three-syllable words", () => {
    expect(countSyllables("beautiful")).toBe(3); // beau-ti-ful → 3 vowel clusters
    expect(countSyllables("however")).toBe(3);
  });

  it("handles empty string", () => {
    expect(countSyllables("")).toBe(0);
  });

  it("clamps to minimum 1 for real words", () => {
    expect(countSyllables("by")).toBeGreaterThanOrEqual(1);
  });

  it("handles punctuation in token", () => {
    expect(countSyllables("cat,")).toBe(1);
    expect(countSyllables("however.")).toBe(3);
  });
});

// ─── Empty content ────────────────────────────────────────────────────────────

describe("measure — empty content", () => {
  it("returns all-zero metrics for empty intro", () => {
    const result = measure(makeInput({ introContent: "" }));

    expect(result.readabilityScore).toBe(0);
    expect(result.typeTokenRatio).toBe(0);
    expect(result.longSentenceCount).toBe(0);
    expect(result.shortSentenceCount).toBe(0);
    expect(result.shortSentenceRatio).toBe(0);
    expect(result.questionSentenceCount).toBe(0);
    expect(result.exclamationSentenceCount).toBe(0);
    expect(result.complexWordCount).toBe(0);
    expect(result.complexWordRatio).toBe(0);
    expect(result.estimatedReadingTimeMinutes).toBe(0);
    expect(result.estimatedSpeakingTimeMinutes).toBe(0);
    expect(result.transitionWordCount).toBe(0);
    expect(result.transitionDensity).toBe(0);
    expect(result.transitionCoverage).toBe(0);
    expect(result.punctuationDensity).toBe(0);
    expect(result.paragraphFlow).toBe(0);
  });
});

// ─── One sentence ─────────────────────────────────────────────────────────────

describe("measure — one sentence", () => {
  const intro = "The cat sat on the mat.";

  it("detects exactly one sentence", () => {
    const r = measure(makeInput({ introContent: intro }));
    // sentence count is owned by ContentMetricsProvider, but we can verify
    // that readabilityScore is computed (non-zero since we have sentences)
    expect(r.readabilityScore).toBeGreaterThan(0);
  });

  it("produces a positive reading ease for simple text", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.readabilityScore).toBeGreaterThan(60);
  });

  it("no long sentences for a 6-word sentence", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.longSentenceCount).toBe(0);
  });

  it("sentence is short (< 8 words)", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.shortSentenceCount).toBeGreaterThanOrEqual(1);
  });

  it("no transition words", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionWordCount).toBe(0);
  });
});

// ─── Many sentences ───────────────────────────────────────────────────────────

describe("measure — many sentences", () => {
  // 5 sentences, moderate complexity
  const intro = [
    "Hyderabad is one of the most vibrant cities in southern India.",
    "The city blends ancient history with modern technology.",
    "However, finding quality escorts remains a private matter for many residents.",
    "Furthermore, the local culture values discretion and professionalism.",
    "This guide helps you navigate your options safely.",
  ].join(" ");

  it("detects transition words (however, furthermore)", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionWordCount).toBeGreaterThanOrEqual(2);
  });

  it("transition density is positive", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionDensity).toBeGreaterThan(0);
  });

  it("readability score is in valid range [0, 100]", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.readabilityScore).toBeGreaterThanOrEqual(0);
    expect(r.readabilityScore).toBeLessThanOrEqual(100);
  });

  it("typeTokenRatio is in (0, 1]", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.typeTokenRatio).toBeGreaterThan(0);
    expect(r.typeTokenRatio).toBeLessThanOrEqual(1);
  });
});

// ─── Long paragraphs ──────────────────────────────────────────────────────────

describe("measure — long paragraph with a long sentence", () => {
  // Deliberately long sentence (> 35 words)
  const longSentence =
    "Hyderabad is a sprawling metropolis in Telangana, India, that has grown rapidly over the past two decades due to significant investments in technology infrastructure and a booming software industry that attracts talent from across the country and the world.";

  it("classifies the sentence as long", () => {
    const r = measure(makeInput({ introContent: longSentence }));
    expect(r.longSentenceCount).toBeGreaterThanOrEqual(1);
  });

  it("readability score is lower for complex long text", () => {
    const simple = "The cat sat. The dog ran. It was fun.";
    const rSimple = measure(makeInput({ introContent: simple }));
    const rComplex = measure(makeInput({ introContent: longSentence }));
    expect(rSimple.readabilityScore).toBeGreaterThan(rComplex.readabilityScore!);
  });
});

// ─── Short paragraphs ─────────────────────────────────────────────────────────

describe("measure — many short sentences", () => {
  // Each sentence is 2-4 words — well below the 8-word short threshold,
  // and long enough to pass the 2-token minimum filter.
  const intro = "Go now. Run fast. Stop here. Wait please. Look around. Yes indeed. No thanks.";

  it("all sentences are classified as short (< 8 words)", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.shortSentenceCount).toBeGreaterThan(0);
  });

  it("short sentence ratio approaches 1", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.shortSentenceRatio).toBeGreaterThan(0.5);
  });

  it("no long sentences", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.longSentenceCount).toBe(0);
  });
});

// ─── Many transition words ────────────────────────────────────────────────────

describe("measure — many transition words", () => {
  const intro = [
    "However, the situation changed rapidly.",
    "Furthermore, new regulations were introduced.",
    "Therefore, businesses had to adapt quickly.",
    "Meanwhile, consumers remained uncertain.",
    "Finally, stability returned to the market.",
  ].join(" ");

  it("detects all five transition words", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionWordCount).toBeGreaterThanOrEqual(5);
  });

  it("transition density is elevated", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionDensity).toBeGreaterThan(5); // > 5 per 100 words
  });
});

// ─── Zero transition words ────────────────────────────────────────────────────

describe("measure — zero transition words", () => {
  const intro = "Cats eat fish. Dogs run fast. Birds fly high. Fish swim deep.";

  it("transitionWordCount is zero", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionWordCount).toBe(0);
  });

  it("transitionDensity is zero", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionDensity).toBe(0);
  });

  it("transitionCoverage is zero", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionCoverage).toBe(0);
  });
});

// ─── Punctuation-heavy content ────────────────────────────────────────────────

describe("measure — punctuation-heavy content", () => {
  const intro =
    "The city (known for its heritage) has many landmarks; " +
    "it includes the Charminar, Golconda Fort, and various mosques — all iconic. " +
    "Visitors often say: 'it's breathtaking.'";

  it("punctuationDensity is elevated", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.punctuationDensity).toBeGreaterThan(5);
  });

  it("punctuationDensity is per 100 words", () => {
    const r = measure(makeInput({ introContent: intro }));
    // should be a reasonable fraction of words, not > 200
    expect(r.punctuationDensity).toBeLessThan(200);
  });
});

// ─── Question sentences ───────────────────────────────────────────────────────

describe("measure — question sentences", () => {
  const intro =
    "Are you looking for companionship in Hyderabad? " +
    "Do you want someone professional and discreet? " +
    "This guide answers your questions.";

  it("detects two question sentences", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.questionSentenceCount).toBe(2);
  });

  it("no exclamation sentences", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.exclamationSentenceCount).toBe(0);
  });
});

// ─── Exclamation sentences ────────────────────────────────────────────────────

describe("measure — exclamation sentences", () => {
  const intro =
    "Welcome to Hyderabad! " +
    "This is an amazing city! " +
    "You will love it here.";

  it("detects two exclamation sentences", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.exclamationSentenceCount).toBe(2);
  });

  it("no question sentences", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.questionSentenceCount).toBe(0);
  });
});

// ─── Mixed paragraph sizes ────────────────────────────────────────────────────

describe("measure — mixed paragraph sizes", () => {
  // Two paragraphs: one with transition, one without
  const intro =
    "Hyderabad has a rich cultural heritage spanning several centuries.\n\n" +
    "However, modern infrastructure has transformed the city dramatically over recent decades.";

  it("transitionCoverage reflects one paragraph with transition out of two", () => {
    const r = measure(makeInput({ introContent: intro }));
    // One of two paragraphs opens with "However"
    expect(r.transitionCoverage).toBeCloseTo(0.5, 1);
  });

  it("paragraphFlow equals transitionCoverage", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.paragraphFlow).toBe(r.transitionCoverage);
  });
});

// ─── Reading / speaking time ──────────────────────────────────────────────────

describe("measure — reading and speaking time", () => {
  // Approximately 238 words → ~1 min reading time
  const words238 = Array(238).fill("word").join(" ") + ".";

  it("estimatedReadingTimeMinutes is approximately 1 for 238 words", () => {
    const r = measure(makeInput({ introContent: words238 }));
    expect(r.estimatedReadingTimeMinutes).toBeCloseTo(1, 0);
  });

  it("estimatedSpeakingTimeMinutes is greater than reading time", () => {
    const r = measure(makeInput({ introContent: words238 }));
    expect(r.estimatedSpeakingTimeMinutes!).toBeGreaterThan(r.estimatedReadingTimeMinutes!);
  });

  it("includes FAQ words in time estimates", () => {
    const rNoFaq = measure(makeInput({ introContent: "Short intro." }));
    const rWithFaq = measure(makeInput({
      introContent: "Short intro.",
      faqItems: [{ question: "What is this?", answer: Array(100).fill("word").join(" ") + "." }],
    }));
    expect(rWithFaq.estimatedReadingTimeMinutes!).toBeGreaterThan(rNoFaq.estimatedReadingTimeMinutes!);
  });
});

// ─── Markdown content ─────────────────────────────────────────────────────────

describe("measure — markdown content", () => {
  const intro = `
## Hyderabad Escorts Guide

Welcome to our comprehensive guide.

**Hyderabad** is a city of contrasts. However, finding *reliable* companions requires research.

### What to expect

You should know the following facts about the city before proceeding with your search.
  `.trim();

  it("produces a non-zero readability score for markdown", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.readabilityScore).toBeGreaterThan(0);
  });

  it("detects transition word in markdown paragraphs", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.transitionWordCount).toBeGreaterThanOrEqual(1);
  });

  it("all numeric metrics are finite", () => {
    const r = measure(makeInput({ introContent: intro }));
    const numericFields = [
      r.readabilityScore,
      r.typeTokenRatio,
      r.longSentenceCount,
      r.shortSentenceCount,
      r.shortSentenceRatio,
      r.punctuationDensity,
      r.complexWordCount,
      r.complexWordRatio,
      r.estimatedReadingTimeMinutes,
      r.estimatedSpeakingTimeMinutes,
      r.transitionWordCount,
      r.transitionDensity,
      r.transitionCoverage,
    ];
    for (const val of numericFields) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});

// ─── Custom transition dictionary ─────────────────────────────────────────────

describe("measure — custom transition dictionary", () => {
  const customWords = new Set(["banana"]);
  const intro = "Banana, this city is special. The culture is rich and diverse.";

  it("uses custom transition words instead of defaults", () => {
    const r = measure(makeInput({ introContent: intro }), customWords);
    expect(r.transitionWordCount).toBeGreaterThanOrEqual(1);
  });

  it("default dictionary would find zero transitions in this text", () => {
    const r = measure(makeInput({ introContent: intro }), DEFAULT_TRANSITION_WORDS);
    expect(r.transitionWordCount).toBe(0);
  });
});

// ─── Complex word detection ───────────────────────────────────────────────────

describe("measure — complex word detection", () => {
  // "infrastructure" (4 syl), "collaboration" (5 syl), "sophisticated" (4 syl)
  const intro =
    "Infrastructure collaboration requires sophisticated understanding of interconnected systems.";

  it("detects complex words (3+ syllables)", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.complexWordCount).toBeGreaterThanOrEqual(3);
  });

  it("complexWordRatio is in (0, 1]", () => {
    const r = measure(makeInput({ introContent: intro }));
    expect(r.complexWordRatio).toBeGreaterThan(0);
    expect(r.complexWordRatio).toBeLessThanOrEqual(1);
  });

  it("simple text has lower complex word ratio than complex text", () => {
    const simple = "The cat sat on the mat in the sun all day long.";
    const rSimple  = measure(makeInput({ introContent: simple }));
    const rComplex = measure(makeInput({ introContent: intro }));
    expect(rComplex.complexWordRatio!).toBeGreaterThan(rSimple.complexWordRatio!);
  });
});

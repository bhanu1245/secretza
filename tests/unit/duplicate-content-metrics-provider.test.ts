import { describe, it, expect } from "vitest";
import {
  measure,
  normaliseUnit,
  tokenise,
  splitSentences,
  splitParagraphs,
  extractHeadingsFromContent,
  getNgrams,
  countRepeatedNgrams,
  largestRepeatedNgramSize,
  jaccardSimilarity,
  averagePairwiseJaccard,
  isBoilerplate,
  findDuplicateRuns,
  computeDuplicateTokenRatio,
} from "@/lib/seo-providers/duplicate-content-metrics-provider";
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

// ─── normaliseUnit ────────────────────────────────────────────────────────────

describe("normaliseUnit", () => {
  it("lowercases text", () => {
    expect(normaliseUnit("Hello World")).toBe("hello world");
  });

  it("collapses whitespace", () => {
    expect(normaliseUnit("hello   world")).toBe("hello world");
  });

  it("collapses repeated punctuation", () => {
    expect(normaliseUnit("wait...")).toBe("wait.");
    expect(normaliseUnit("yes!!")).toBe("yes!");
  });

  it("trims", () => {
    expect(normaliseUnit("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(normaliseUnit("")).toBe("");
  });
});

// ─── tokenise ─────────────────────────────────────────────────────────────────

describe("tokenise", () => {
  it("splits on non-word chars", () => {
    expect(tokenise("hello, world!")).toEqual(["hello", "world"]);
  });

  it("lowercases", () => {
    expect(tokenise("Hello World")).toEqual(["hello", "world"]);
  });

  it("handles Unicode text", () => {
    const tokens = tokenise("हैदराबाद एस्कॉर्ट");
    expect(tokens.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for empty string", () => {
    expect(tokenise("")).toEqual([]);
  });
});

// ─── splitSentences ───────────────────────────────────────────────────────────

describe("splitSentences", () => {
  it("splits on period-space", () => {
    const s = splitSentences("First sentence. Second sentence.");
    expect(s.length).toBe(2);
  });

  it("splits on question mark", () => {
    const s = splitSentences("Who are you? I am here.");
    expect(s.length).toBe(2);
  });

  it("splits on exclamation", () => {
    const s = splitSentences("Great! Excellent service.");
    expect(s.length).toBe(2);
  });

  it("returns empty array for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });

  it("returns normalised sentences", () => {
    const s = splitSentences("Hello  World.");
    expect(s[0]).toBe("hello world.");
  });
});

// ─── splitParagraphs ──────────────────────────────────────────────────────────

describe("splitParagraphs", () => {
  it("splits on double newline", () => {
    const p = splitParagraphs("Para one.\n\nPara two.");
    expect(p.length).toBe(2);
  });

  it("normalises paragraph text", () => {
    const p = splitParagraphs("Hello   World.\n\nSecond.");
    expect(p[0]).toBe("hello world.");
  });

  it("handles single paragraph", () => {
    expect(splitParagraphs("Just one paragraph.")).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(splitParagraphs("")).toEqual([]);
  });
});

// ─── extractHeadingsFromContent ───────────────────────────────────────────────

describe("extractHeadingsFromContent", () => {
  it("extracts h2 HTML heading", () => {
    const h = extractHeadingsFromContent("<h2>Our Services</h2>");
    expect(h).toContain("our services");
  });

  it("extracts multiple HTML headings", () => {
    const h = extractHeadingsFromContent("<h2>Section One</h2><h3>Sub Section</h3>");
    expect(h).toHaveLength(2);
  });

  it("extracts markdown headings", () => {
    const h = extractHeadingsFromContent("## Our Services\n### Sub-heading");
    expect(h).toContain("our services");
    expect(h).toContain("sub-heading");
  });

  it("returns empty for content with no headings", () => {
    expect(extractHeadingsFromContent("Just plain text.")).toHaveLength(0);
  });

  it("strips inner HTML tags from heading text", () => {
    const h = extractHeadingsFromContent("<h2><strong>Bold Heading</strong></h2>");
    expect(h).toContain("bold heading");
  });
});

// ─── getNgrams ────────────────────────────────────────────────────────────────

describe("getNgrams", () => {
  it("returns bigrams", () => {
    expect(getNgrams(["a", "b", "c"], 2)).toEqual(["a b", "b c"]);
  });

  it("returns trigrams", () => {
    expect(getNgrams(["a", "b", "c", "d"], 3)).toEqual(["a b c", "b c d"]);
  });

  it("returns empty for n > token length", () => {
    expect(getNgrams(["a", "b"], 3)).toEqual([]);
  });

  it("returns empty for empty token array", () => {
    expect(getNgrams([], 2)).toEqual([]);
  });
});

// ─── countRepeatedNgrams ─────────────────────────────────────────────────────

describe("countRepeatedNgrams", () => {
  it("counts distinct bigrams appearing more than once", () => {
    // "a b" appears twice
    const tokens = ["a", "b", "c", "a", "b"];
    expect(countRepeatedNgrams(tokens, 2)).toBe(1);
  });

  it("returns 0 when no bigrams repeat", () => {
    expect(countRepeatedNgrams(["a", "b", "c", "d"], 2)).toBe(0);
  });

  it("handles trigrams", () => {
    const tokens = ["a", "b", "c", "d", "a", "b", "c"];
    expect(countRepeatedNgrams(tokens, 3)).toBe(1);
  });
});

// ─── largestRepeatedNgramSize ─────────────────────────────────────────────────

describe("largestRepeatedNgramSize", () => {
  it("returns 3 for text with repeated trigram but no repeated 4-gram", () => {
    // "the escort in" appears twice; no 4-gram repeats
    const tokens = ["the", "escort", "in", "delhi", "the", "escort", "in", "mumbai"];
    expect(largestRepeatedNgramSize(tokens, 10)).toBe(3);
  });

  it("returns 0 when no bigrams repeat", () => {
    expect(largestRepeatedNgramSize(["a", "b", "c", "d"], 5)).toBe(0);
  });

  it("returns 2 for a single repeated bigram", () => {
    expect(largestRepeatedNgramSize(["a", "b", "c", "a", "b"], 5)).toBe(2);
  });
});

// ─── jaccardSimilarity ────────────────────────────────────────────────────────

describe("jaccardSimilarity", () => {
  it("returns 1 for identical arrays", () => {
    expect(jaccardSimilarity(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
  });

  it("returns 0 for completely disjoint arrays", () => {
    expect(jaccardSimilarity(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("returns 0.5 for 50% overlap", () => {
    expect(jaccardSimilarity(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(0.5, 3);
  });

  it("returns 1 for two empty arrays", () => {
    expect(jaccardSimilarity([], [])).toBe(1);
  });

  it("returns 0 when one array is empty", () => {
    expect(jaccardSimilarity(["a"], [])).toBe(0);
  });

  it("is not sensitive to token frequency (type-set comparison)", () => {
    // "a" repeated 3 times vs "a" once — both have type set {"a"}
    expect(jaccardSimilarity(["a", "a", "a"], ["a"])).toBe(1);
  });
});

// ─── averagePairwiseJaccard ───────────────────────────────────────────────────

describe("averagePairwiseJaccard", () => {
  it("returns 0 for fewer than 2 arrays", () => {
    expect(averagePairwiseJaccard([["a", "b"]])).toBe(0);
    expect(averagePairwiseJaccard([])).toBe(0);
  });

  it("returns the single pairwise Jaccard for exactly 2 arrays", () => {
    const result = averagePairwiseJaccard([["a", "b"], ["a", "c"]]);
    expect(result).toBeCloseTo(1 / 3, 3); // intersection={a}, union={a,b,c}
  });

  it("returns 1 when all arrays are identical", () => {
    expect(averagePairwiseJaccard([["a", "b"], ["a", "b"], ["a", "b"]])).toBe(1);
  });
});

// ─── isBoilerplate ────────────────────────────────────────────────────────────

describe("isBoilerplate", () => {
  it("detects 'contact us today'", () => {
    expect(isBoilerplate("please contact us today for more information")).toBe(true);
  });

  it("detects 'satisfaction guaranteed'", () => {
    expect(isBoilerplate("your satisfaction guaranteed always")).toBe(true);
  });

  it("returns false for non-boilerplate text", () => {
    expect(isBoilerplate("our hyderabad escorts are professional")).toBe(false);
  });
});

// ─── findDuplicateRuns ────────────────────────────────────────────────────────

describe("findDuplicateRuns", () => {
  it("detects a run of 3 identical tokens", () => {
    const r = findDuplicateRuns(["escort", "escort", "escort", "delhi"]);
    expect(r.count).toBe(1);
    expect(r.maxLength).toBe(3);
  });

  it("detects multiple runs", () => {
    const r = findDuplicateRuns(["a", "a", "b", "c", "c"]);
    expect(r.count).toBe(2);
    expect(r.maxLength).toBe(2);
  });

  it("returns zero counts for no consecutive duplicates", () => {
    const r = findDuplicateRuns(["a", "b", "c"]);
    expect(r.count).toBe(0);
    expect(r.maxLength).toBe(0);
  });

  it("returns zero for single token", () => {
    const r = findDuplicateRuns(["a"]);
    expect(r.count).toBe(0);
    expect(r.maxLength).toBe(0);
  });
});

// ─── computeDuplicateTokenRatio ───────────────────────────────────────────────

describe("computeDuplicateTokenRatio", () => {
  it("returns 0 for empty token array", () => {
    expect(computeDuplicateTokenRatio([])).toBe(0);
  });

  it("returns 0 when all tokens are unique", () => {
    expect(computeDuplicateTokenRatio(["a", "b", "c"])).toBe(0);
  });

  it("returns 1 when all tokens are duplicated", () => {
    expect(computeDuplicateTokenRatio(["a", "a", "b", "b"])).toBe(1);
  });

  it("returns 0.5 when half of tokens are duplicate types", () => {
    // "a" appears twice (repeated), "b" once (unique) → 2/3 not 0.5...
    // Let me use: ["a", "a", "b", "c"] → "a" appears 2×, b and c once → 2/4 = 0.5
    expect(computeDuplicateTokenRatio(["a", "a", "b", "c"])).toBe(0.5);
  });
});

// ─── measure — empty content ──────────────────────────────────────────────────

describe("measure — empty content", () => {
  it("returns zero duplicate counts", () => {
    const r = measure(makeInput());
    expect(r.duplicateSentenceCount).toBe(0);
    expect(r.duplicateParagraphCount).toBe(0);
    expect(r.duplicateHeadingCount).toBe(0);
    expect(r.repeatedBigramCount).toBe(0);
    // Two empty token sets are vacuously identical per Jaccard definition
    expect(r.selfSimilarityScore).toBe(1);
  });

  it("returns ratio=1 for unique ratios when content is empty", () => {
    const r = measure(makeInput());
    expect(r.uniqueSentenceRatio).toBe(1);
    expect(r.uniqueParagraphRatio).toBe(1);
    expect(r.uniqueHeadingRatio).toBe(1);
  });
});

// ─── measure — duplicate sentences ───────────────────────────────────────────

describe("measure — duplicate sentences", () => {
  it("counts a sentence that appears twice", () => {
    const intro =
      "We offer premium escorts in Hyderabad. " +
      "Our services are discreet and professional. " +
      "We offer premium escorts in Hyderabad.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateSentenceCount).toBe(1);
    expect(r.duplicateIntroSentenceCount).toBe(1);
  });

  it("uniqueSentenceRatio < 1 when sentences are duplicated", () => {
    const intro = "Escorts in Delhi. Escorts in Delhi. Escorts in Mumbai.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.uniqueSentenceRatio).toBeLessThan(1);
  });

  it("uniqueSentenceRatio = 1 when all sentences are unique", () => {
    const intro = "Sentence one. Sentence two. Sentence three.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.uniqueSentenceRatio).toBe(1);
  });
});

// ─── measure — duplicate paragraphs ──────────────────────────────────────────

describe("measure — duplicate paragraphs", () => {
  it("counts duplicate paragraphs", () => {
    const intro =
      "First paragraph about escorts.\n\n" +
      "Second unique paragraph.\n\n" +
      "First paragraph about escorts.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateParagraphCount).toBe(1);
  });

  it("uniqueParagraphRatio = 1 for unique paragraphs", () => {
    const intro = "Para one.\n\nPara two.\n\nPara three.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.uniqueParagraphRatio).toBe(1);
  });
});

// ─── measure — duplicate headings ────────────────────────────────────────────

describe("measure — duplicate headings", () => {
  it("detects duplicate headings in supplied headings array", () => {
    const r = measure(makeInput({
      headings: ["Our Services", "About Us", "Our Services"],
    }));
    expect(r.duplicateHeadingCount).toBe(1);
  });

  it("detects duplicate headings extracted from introContent", () => {
    const intro = "<h2>Our Services</h2><p>Text.</p><h2>Our Services</h2>";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateHeadingCount).toBe(1);
  });

  it("uniqueHeadingRatio = 1 for all-unique headings", () => {
    const r = measure(makeInput({
      headings: ["Section One", "Section Two", "Section Three"],
    }));
    expect(r.uniqueHeadingRatio).toBe(1);
  });
});

// ─── measure — duplicate FAQ questions ───────────────────────────────────────

describe("measure — duplicate FAQ questions", () => {
  it("counts FAQ questions that appear more than once", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "How do I book?",   answer: "Call us." },
        { question: "What is the rate?", answer: "Varies." },
        { question: "How do I book?",   answer: "Via the form." },
      ],
    }));
    expect(r.duplicateFaqQuestionCount).toBe(1);
  });

  it("uniqueFaqQuestionRatio < 1 when questions are duplicated", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Same question?", answer: "A1." },
        { question: "Same question?", answer: "A2." },
      ],
    }));
    expect(r.uniqueFaqQuestionRatio).toBeLessThan(1);
  });
});

// ─── measure — duplicate FAQ answers ─────────────────────────────────────────

describe("measure — duplicate FAQ answers", () => {
  it("counts FAQ answers that appear more than once", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Q1?", answer: "Contact us for details." },
        { question: "Q2?", answer: "Unique answer." },
        { question: "Q3?", answer: "Contact us for details." },
      ],
    }));
    expect(r.duplicateFaqAnswerCount).toBe(1);
  });

  it("uniqueFaqAnswerRatio = 1 when all answers are unique", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Q1?", answer: "First answer." },
        { question: "Q2?", answer: "Second answer." },
      ],
    }));
    expect(r.uniqueFaqAnswerRatio).toBe(1);
  });
});

// ─── measure — duplicate lead-ins ────────────────────────────────────────────

describe("measure — duplicate lead-ins", () => {
  it("counts shared 3-word lead-ins across sentences", () => {
    const intro =
      "We offer premium escorts in Hyderabad. " +
      "We offer affordable services in Delhi. " +
      "Call us for bookings.";
    const r = measure(makeInput({ introContent: intro }));
    // "we offer premium" and "we offer affordable" share "we offer ..." (first 3 words = "we offer premium" vs "we offer affordable" → NOT shared)
    // Actually "we offer" in 3-word lead-in: "we offer premium" ≠ "we offer affordable"
    // So no shared lead-in here → duplicateLeadInCount = 0
    expect(r.duplicateLeadInCount).toBe(0);
  });

  it("counts shared 3-word lead-ins when they match exactly", () => {
    const intro =
      "How can I book a companion. " +
      "How can I cancel my booking. " +
      "What is the price.";
    const r = measure(makeInput({ introContent: intro }));
    // "how can i" appears twice → duplicateLeadInCount = 1
    expect(r.duplicateLeadInCount).toBe(1);
  });
});

// ─── measure — repeated bigrams ───────────────────────────────────────────────

describe("measure — repeated bigrams", () => {
  it("counts bigrams that appear more than once", () => {
    // "escorts in" appears twice → at least 1 repeated bigram
    const intro = "escorts in delhi and escorts in mumbai are available.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.repeatedBigramCount).toBeGreaterThan(0);
  });

  it("repeatedBigramCount is 0 for fully unique text", () => {
    const intro = "one two three four five six seven.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.repeatedBigramCount).toBe(0);
  });
});

// ─── measure — repeated trigrams ──────────────────────────────────────────────

describe("measure — repeated trigrams", () => {
  it("detects repeated trigrams", () => {
    const intro =
      "escorts in hyderabad are available. Top escorts in hyderabad serve clients.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.repeatedTrigramCount).toBeGreaterThan(0);
  });
});

// ─── measure — repeated four-grams ───────────────────────────────────────────

describe("measure — repeated four-grams", () => {
  it("detects repeated 4-grams", () => {
    const intro =
      "book escorts in hyderabad today. Easy to book escorts in hyderabad online.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.repeatedFourGramCount).toBeGreaterThan(0);
  });
});

// ─── measure — repeated boilerplate ──────────────────────────────────────────

describe("measure — repeated boilerplate", () => {
  it("boilerplateSentenceCount detects sentences with boilerplate phrases", () => {
    const intro =
      "Please contact us today for an appointment. " +
      "Our services are top quality. " +
      "Your satisfaction guaranteed always.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.boilerplateSentenceCount).toBeGreaterThanOrEqual(1);
  });

  it("boilerplateParagraphCount detects paragraphs with boilerplate phrases", () => {
    const intro =
      "Contact us today for more details.\n\n" +
      "Unique paragraph about Hyderabad escorts.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.boilerplateParagraphCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — repeated intro ─────────────────────────────────────────────────

describe("measure — repeated intro sentence", () => {
  it("duplicateIntroSentenceCount is 0 for unique intro sentences", () => {
    const intro = "First sentence. Second sentence. Third sentence.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateIntroSentenceCount).toBe(0);
  });

  it("duplicateIntroSentenceCount counts repeated sentences within intro", () => {
    const intro = "This is a repeated sentence. Different sentence. This is a repeated sentence.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateIntroSentenceCount).toBe(1);
  });
});

// ─── measure — repeated punctuation normalisation ─────────────────────────────

describe("measure — repeated punctuation normalisation", () => {
  it("treats 'hello...' and 'hello.' as the same sentence", () => {
    const intro = "hello world. hello world...";
    const r = measure(makeInput({ introContent: intro }));
    // Both normalise to "hello world." → one duplicate
    expect(r.duplicateSentenceCount).toBe(1);
  });
});

// ─── measure — whitespace normalisation ───────────────────────────────────────

describe("measure — whitespace normalisation", () => {
  it("treats sentences with different whitespace as identical", () => {
    const intro = "hello   world. hello world.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateSentenceCount).toBe(1);
  });
});

// ─── measure — Unicode content ───────────────────────────────────────────────

describe("measure — Unicode content", () => {
  it("does not throw on Unicode text", () => {
    const intro = "हैदराबाद में एस्कॉर्ट सेवाएं। हैदराबाद में एस्कॉर्ट सेवाएं।";
    expect(() => measure(makeInput({ introContent: intro }))).not.toThrow();
  });

  it("tokenises Unicode correctly", () => {
    const tokens = tokenise("दिल्ली मुंबई");
    expect(tokens.length).toBeGreaterThanOrEqual(2);
  });

  it("detects duplicate Unicode sentences", () => {
    // Use Latin period as sentence separator (Devanagari danda not in splitter)
    const intro = "हैदराबाद में सेवाएं उपलब्ध हैं. हैदराबाद में सेवाएं उपलब्ध हैं.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateSentenceCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — mixed case ─────────────────────────────────────────────────────

describe("measure — mixed case", () => {
  it("treats 'Hello World.' and 'hello world.' as identical after normalisation", () => {
    const intro = "Hello World. hello world.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.duplicateSentenceCount).toBe(1);
  });
});

// ─── measure — self similarity ───────────────────────────────────────────────

describe("measure — selfSimilarityScore", () => {
  it("is 0 when intro and FAQ share no tokens", () => {
    const r = measure(makeInput({
      introContent: "alpha beta gamma delta.",
      faqItems:     [{ question: "What?", answer: "epsilon zeta eta theta." }],
    }));
    expect(r.selfSimilarityScore).toBe(0);
  });

  it("is 1 when intro and FAQ have identical token sets", () => {
    const text = "escorts in hyderabad are available.";
    // FAQ question must not introduce tokens absent from intro; use a matching word
    const r = measure(makeInput({
      introContent: text,
      faqItems:     [{ question: "escorts?", answer: text }],
    }));
    expect(r.selfSimilarityScore).toBe(1);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const r = measure(makeInput({
      introContent: "escorts in hyderabad are premium.",
      faqItems:     [{ question: "Q?", answer: "hyderabad escorts are affordable." }],
    }));
    expect(r.selfSimilarityScore).toBeGreaterThan(0);
    expect(r.selfSimilarityScore).toBeLessThan(1);
  });
});

// ─── measure — template reuse ─────────────────────────────────────────────────

describe("measure — templateReuseRatio", () => {
  it("is 0 when no sentences are duplicated", () => {
    const r = measure(makeInput({ introContent: "Sentence one. Sentence two." }));
    expect(r.templateReuseRatio).toBe(0);
  });

  it("is > 0 when sentences are duplicated", () => {
    const intro = "Repeated sentence here. Repeated sentence here. Unique sentence.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.templateReuseRatio).toBeGreaterThan(0);
  });
});

// ─── measure — malformed input ────────────────────────────────────────────────

describe("measure — malformed input", () => {
  it("does not throw on null introContent (empty string fallback)", () => {
    const input = makeInput({ introContent: undefined as unknown as string });
    expect(() => measure(input)).not.toThrow();
  });

  it("does not throw on FAQ items with empty question/answer", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "", answer: "" },
        { question: "Q?", answer: "" },
      ],
    }));
    expect(r.duplicateFaqAnswerCount).toBeDefined();
  });

  it("handles very long repeated token run", () => {
    const intro = "escort ".repeat(50).trim() + ".";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.maxDuplicateRunLength).toBeGreaterThan(2);
    expect(r.duplicateWordRunCount).toBeGreaterThan(0);
  });
});

// ─── measure — introSectionSimilarity ────────────────────────────────────────

describe("measure — introSectionSimilarity", () => {
  it("is 0 for single paragraph (no pairs)", () => {
    const r = measure(makeInput({ introContent: "Just one paragraph here." }));
    expect(r.introSectionSimilarity).toBe(0);
  });

  it("is 1 for two identical paragraphs", () => {
    const intro = "escorts in hyderabad.\n\nescorts in hyderabad.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.introSectionSimilarity).toBe(1);
  });

  it("is between 0 and 1 for partially similar paragraphs", () => {
    const intro =
      "escorts in hyderabad are premium.\n\n" +
      "escorts in mumbai are affordable.";
    const r = measure(makeInput({ introContent: intro }));
    expect(r.introSectionSimilarity).toBeGreaterThan(0);
    expect(r.introSectionSimilarity).toBeLessThan(1);
  });
});

// ─── measure — headingSimilarity ─────────────────────────────────────────────

describe("measure — headingSimilarity", () => {
  it("is 0 for no headings", () => {
    expect(measure(makeInput()).headingSimilarity).toBe(0);
  });

  it("is 0 for a single heading (no pairs)", () => {
    const r = measure(makeInput({ headings: ["Our Services"] }));
    expect(r.headingSimilarity).toBe(0);
  });

  it("is 1 for two identical headings", () => {
    const r = measure(makeInput({ headings: ["Our Services", "Our Services"] }));
    expect(r.headingSimilarity).toBe(1);
  });
});

// ─── measure — faqSimilarity ──────────────────────────────────────────────────

describe("measure — faqSimilarity", () => {
  it("is 0 for no FAQ items", () => {
    expect(measure(makeInput()).faqSimilarity).toBe(0);
  });

  it("is 1 for two identical FAQ answers", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Q1?", answer: "Contact us today for details." },
        { question: "Q2?", answer: "Contact us today for details." },
      ],
    }));
    expect(r.faqSimilarity).toBe(1);
  });

  it("is between 0 and 1 for partially similar FAQ answers", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Q1?", answer: "Our hyderabad escorts are premium and affordable." },
        { question: "Q2?", answer: "Our mumbai escorts are premium and luxurious." },
      ],
    }));
    expect(r.faqSimilarity).toBeGreaterThan(0);
    expect(r.faqSimilarity).toBeLessThan(1);
  });
});

// ─── measure — largestRepeatedBlockLength ────────────────────────────────────

describe("measure — largestRepeatedBlockLength", () => {
  it("is 0 for fully unique content", () => {
    const r = measure(makeInput({ introContent: "alpha beta gamma delta epsilon." }));
    expect(r.largestRepeatedBlockLength).toBe(0);
  });

  it("is ≥ 2 when bigrams repeat", () => {
    const r = measure(makeInput({
      introContent: "escorts in hyderabad. top escorts in hyderabad.",
    }));
    expect(r.largestRepeatedBlockLength).toBeGreaterThanOrEqual(2);
  });

  it("is ≥ 4 when 4-grams repeat", () => {
    const r = measure(makeInput({
      introContent: "book escorts in hyderabad today. easy to book escorts in hyderabad online.",
    }));
    expect(r.largestRepeatedBlockLength).toBeGreaterThanOrEqual(4);
  });
});

// ─── measure — duplicateWordRunCount & maxDuplicateRunLength ─────────────────

describe("measure — word run metrics", () => {
  it("maxDuplicateRunLength is 0 for no consecutive duplicate tokens", () => {
    const r = measure(makeInput({ introContent: "one two three four." }));
    expect(r.maxDuplicateRunLength).toBe(0);
  });

  it("detects a run of 3 identical tokens", () => {
    // "escort escort escort" forms a run of 3
    const r = measure(makeInput({ introContent: "an escort escort escort is available." }));
    expect(r.maxDuplicateRunLength).toBe(3);
    expect(r.duplicateWordRunCount).toBe(1);
  });

  it("duplicateWordRunCount = 2 for two separate runs", () => {
    const r = measure(makeInput({
      introContent: "escort escort in delhi delhi.",
    }));
    expect(r.duplicateWordRunCount).toBe(2);
  });
});

// ─── measure — duplicateTokenRatio ───────────────────────────────────────────

describe("measure — duplicateTokenRatio", () => {
  it("is 0 for content with all unique tokens", () => {
    const r = measure(makeInput({ introContent: "alpha beta gamma delta." }));
    expect(r.duplicateTokenRatio).toBe(0);
  });

  it("is > 0 for content with repeated tokens", () => {
    const r = measure(makeInput({
      introContent: "escorts in hyderabad and escorts in delhi.",
    }));
    expect(r.duplicateTokenRatio).toBeGreaterThan(0);
  });

  it("is bounded between 0 and 1", () => {
    const r = measure(makeInput({
      introContent: "the the the the.",
    }));
    expect(r.duplicateTokenRatio).toBeGreaterThan(0);
    expect(r.duplicateTokenRatio).toBeLessThanOrEqual(1);
  });
});

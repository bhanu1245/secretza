import { describe, it, expect } from "vitest";
import {
  measure,
  normalise,
  countPhraseOccurrences,
  splitSentences,
  splitParagraphs,
  countWords,
  buildEntityList,
} from "@/lib/seo-providers/semantic-metrics-provider";
import type { MetricsCollectorInput, LocalIntelSnapshot } from "@/lib/seo-quality-types";

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
    expect(normalise("Hyderabad Escorts")).toBe("hyderabad escorts");
  });

  it("collapses repeated whitespace to one space", () => {
    expect(normalise("hello   world")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalise("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(normalise("")).toBe("");
  });
});

// ─── countPhraseOccurrences ───────────────────────────────────────────────────

describe("countPhraseOccurrences", () => {
  it("counts a single occurrence", () => {
    expect(countPhraseOccurrences("hyderabad escorts available", "hyderabad escorts")).toBe(1);
  });

  it("counts multiple occurrences", () => {
    expect(countPhraseOccurrences(
      "book hyderabad escorts today. top hyderabad escorts in india.",
      "hyderabad escorts"
    )).toBe(2);
  });

  it("returns 0 when phrase is absent", () => {
    expect(countPhraseOccurrences("mumbai escorts available", "hyderabad escorts")).toBe(0);
  });

  it("does not count partial matches (boundary check)", () => {
    // "escorts" should not match inside "escortsplus"
    expect(countPhraseOccurrences("escortsplus available", "escorts")).toBe(0);
  });

  it("returns 0 for empty phrase", () => {
    expect(countPhraseOccurrences("some text", "")).toBe(0);
  });

  it("returns 0 for empty text", () => {
    expect(countPhraseOccurrences("", "escorts")).toBe(0);
  });

  it("handles phrase at start of text", () => {
    expect(countPhraseOccurrences("escorts in delhi", "escorts")).toBe(1);
  });

  it("handles phrase at end of text", () => {
    expect(countPhraseOccurrences("book delhi escorts", "escorts")).toBe(1);
  });

  it("is case-sensitive on normalised input (caller normalises first)", () => {
    // Provider normalises before calling; raw capitals would not match
    expect(countPhraseOccurrences("hyderabad escorts", "Hyderabad")).toBe(0);
  });
});

// ─── splitSentences ───────────────────────────────────────────────────────────

describe("splitSentences", () => {
  it("splits on period-space", () => {
    const s = splitSentences("first sentence. second sentence.");
    expect(s.length).toBe(2);
  });

  it("splits on question mark", () => {
    const s = splitSentences("who are you? i am here.");
    expect(s.length).toBe(2);
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

  it("returns empty array for empty string", () => {
    expect(splitParagraphs("")).toEqual([]);
  });

  it("normalises paragraphs", () => {
    expect(splitParagraphs("Hello  World.")).toEqual(["hello world."]);
  });
});

// ─── countWords ───────────────────────────────────────────────────────────────

describe("countWords", () => {
  it("counts words in ASCII text", () => {
    expect(countWords("hello world foo")).toBe(3);
  });

  it("counts Unicode words", () => {
    expect(countWords("हैदराबाद escorts")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
});

// ─── buildEntityList ──────────────────────────────────────────────────────────

describe("buildEntityList", () => {
  it("returns empty array for null intel", () => {
    expect(buildEntityList(null)).toEqual([]);
  });

  it("returns empty array for intel with no arrays", () => {
    const intel: LocalIntelSnapshot = { city: "Hyderabad" };
    expect(buildEntityList(intel)).toEqual([]);
  });

  it("deduplicates entities that appear in multiple arrays", () => {
    const intel: LocalIntelSnapshot = {
      city: "Hyderabad",
      landmarks:         ["Charminar"],
      touristAttractions: ["Charminar"],
    };
    const list = buildEntityList(intel);
    expect(list.filter((e) => e === "charminar")).toHaveLength(1);
  });

  it("normalises entity names to lowercase", () => {
    const intel: LocalIntelSnapshot = { city: "Hyderabad", landmarks: ["Golconda Fort"] };
    expect(buildEntityList(intel)).toContain("golconda fort");
  });

  it("includes nearby city names", () => {
    const intel: LocalIntelSnapshot = {
      city: "Hyderabad",
      nearbyCities: [{ name: "Secunderabad", slug: "secunderabad" }],
    };
    expect(buildEntityList(intel)).toContain("secunderabad");
  });

  it("filters empty strings", () => {
    const intel: LocalIntelSnapshot = { city: "Hyderabad", landmarks: ["", "Charminar"] };
    expect(buildEntityList(intel)).not.toContain("");
  });
});

// ─── measure — empty content ──────────────────────────────────────────────────

describe("measure — empty content", () => {
  it("returns 0 for all count metrics", () => {
    const r = measure(makeInput());
    expect(r.conceptCount).toBe(0);
    expect(r.uniqueConceptCount).toBe(0);
    expect(r.coOccurrenceCount).toBe(0);
    expect(r.semanticGapCount).toBe(0);
    expect(r.semanticClusterCount).toBe(0);
  });

  it("returns 0 for all ratio metrics", () => {
    const r = measure(makeInput());
    expect(r.semanticKeywordCoverage).toBe(0);
    expect(r.keywordVariantCoverage).toBe(0);
    expect(r.entityCoverage).toBe(0);
    expect(r.topicCoverage).toBe(0);
    expect(r.semanticClusterCoverage).toBe(0);
    expect(r.conceptDiversity).toBe(0);
    expect(r.entityReuseRatio).toBe(0);
    expect(r.variantReuseRatio).toBe(0);
  });

  it("returns 0 coverage for headings/intro/faq", () => {
    const r = measure(makeInput());
    expect(r.headingSemanticCoverage).toBe(0);
    expect(r.introSemanticCoverage).toBe(0);
    expect(r.faqSemanticCoverage).toBe(0);
    expect(r.sectionSemanticCoverage).toBe(0);
  });
});

// ─── measure — primary keyword only ──────────────────────────────────────────

describe("measure — primary keyword only", () => {
  it("semanticKeywordCoverage = 1 when primary keyword found", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "We offer hyderabad escorts of the highest quality.",
    }));
    expect(r.semanticKeywordCoverage).toBe(1);
  });

  it("semanticKeywordCoverage = 0 when primary keyword absent", () => {
    const r = measure(makeInput({
      primaryKeyword: "delhi escorts",
      introContent:   "We serve Hyderabad clients with premium services.",
    }));
    expect(r.semanticKeywordCoverage).toBe(0);
  });

  it("conceptCount > 0 when primary keyword found", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad. escorts in delhi.",
    }));
    expect(r.conceptCount).toBeGreaterThan(0);
  });

  it("topicCoverage = 0.25 when only primary cluster has mention (of 4 clusters)", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts are available.",
    }));
    expect(r.topicCoverage).toBe(0.25);
  });
});

// ─── measure — primary + secondary keywords ───────────────────────────────────

describe("measure — primary + secondary keywords", () => {
  it("semanticKeywordCoverage = 1 when all keywords found", () => {
    const r = measure(makeInput({
      primaryKeyword:    "hyderabad escorts",
      secondaryKeywords: ["premium escorts", "independent escorts"],
      introContent:
        "Find hyderabad escorts, premium escorts, and independent escorts here.",
    }));
    expect(r.semanticKeywordCoverage).toBe(1);
  });

  it("semanticKeywordCoverage = 0.5 when half of keywords found", () => {
    const r = measure(makeInput({
      primaryKeyword:    "hyderabad escorts",
      secondaryKeywords: ["premium escorts"],
      introContent:      "Book premium escorts in your city.",
    }));
    // "hyderabad escorts" absent, "premium escorts" present → 1/2
    expect(r.semanticKeywordCoverage).toBe(0.5);
  });

  it("uniqueConceptCount equals number of distinct concepts found", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions", "models"],
      introContent:      "Our escorts and companions are available.",
    }));
    // "escorts" and "companions" found, "models" absent → 2
    expect(r.uniqueConceptCount).toBe(2);
  });

  it("semanticClusterCount = 2 when primary and secondary provided", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
    }));
    expect(r.semanticClusterCount).toBe(2);
  });

  it("conceptDensity > 0 when concepts appear in content", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad escorts in delhi.",
    }));
    expect(r.conceptDensity).toBeGreaterThan(0);
  });
});

// ─── measure — semantic variants ─────────────────────────────────────────────

describe("measure — semantic variants", () => {
  it("keywordVariantCoverage = 1 when all variants found", () => {
    const r = measure(makeInput({
      semanticVariants: ["call girls", "vip escorts"],
      introContent:     "Find call girls and vip escorts near you.",
    }));
    expect(r.keywordVariantCoverage).toBe(1);
  });

  it("keywordVariantCoverage = 0 when no variants found", () => {
    const r = measure(makeInput({
      semanticVariants: ["call girls", "vip escorts"],
      introContent:     "Find premium companions near you.",
    }));
    expect(r.keywordVariantCoverage).toBe(0);
  });

  it("keywordVariantCoverage = 0 when semanticVariants is null", () => {
    const r = measure(makeInput({
      semanticVariants: null,
      introContent:     "escorts in hyderabad.",
    }));
    expect(r.keywordVariantCoverage).toBe(0);
  });

  it("semanticClusterCount includes variants cluster", () => {
    const r = measure(makeInput({
      semanticVariants: ["vip escorts"],
    }));
    expect(r.semanticClusterCount).toBeGreaterThanOrEqual(1);
  });

  it("variantReuseRatio > 0 when a variant appears more than once", () => {
    const r = measure(makeInput({
      semanticVariants: ["vip escorts"],
      introContent:     "book vip escorts today. vip escorts are available.",
    }));
    // 1 unique variant found, 2 total occurrences → (2-1)/2 = 0.5
    expect(r.variantReuseRatio).toBe(0.5);
  });

  it("variantReuseRatio = 0 when each variant found exactly once", () => {
    const r = measure(makeInput({
      semanticVariants: ["vip escorts", "premium models"],
      introContent:     "find vip escorts and premium models here.",
    }));
    // 2 unique found, 2 total → (2-2)/2 = 0
    expect(r.variantReuseRatio).toBe(0);
  });
});

// ─── measure — LocalIntelligence entities ─────────────────────────────────────

describe("measure — LocalIntelligence entities", () => {
  const intel: LocalIntelSnapshot = {
    city:      "Hyderabad",
    landmarks: ["Charminar", "Golconda Fort"],
    airports:  ["Rajiv Gandhi International Airport"],
  };

  it("entityCoverage = 1 when all entities found", () => {
    const r = measure(makeInput({
      localIntel:  intel,
      introContent:
        "Visit Charminar, Golconda Fort, and fly via Rajiv Gandhi International Airport.",
    }));
    expect(r.entityCoverage).toBe(1);
  });

  it("entityCoverage = 0 when no entities found", () => {
    const r = measure(makeInput({
      localIntel:   intel,
      introContent: "Generic content with no local references.",
    }));
    expect(r.entityCoverage).toBe(0);
  });

  it("entityCoverage = 0.5 when half of entities found", () => {
    const r = measure(makeInput({
      localIntel:   intel,
      introContent: "Visit charminar for a great experience.",
    }));
    expect(r.entityCoverage).toBeCloseTo(1 / 3, 3);
  });

  it("entityReuseRatio = 0 when each entity mentioned exactly once", () => {
    const r = measure(makeInput({
      localIntel:   intel,
      introContent: "visit charminar and golconda fort in hyderabad.",
    }));
    // charminar: 1, golconda fort: 1 → total=2, unique=2 → (2-2)/2 = 0
    expect(r.entityReuseRatio).toBe(0);
  });

  it("entityReuseRatio > 0 when an entity is mentioned multiple times", () => {
    const r = measure(makeInput({
      localIntel:   { city: "Hyderabad", landmarks: ["Charminar"] },
      introContent: "charminar is beautiful. visit charminar today.",
    }));
    // charminar: 2 total, 1 unique → (2-1)/2 = 0.5
    expect(r.entityReuseRatio).toBe(0.5);
  });
});

// ─── measure — headings ───────────────────────────────────────────────────────

describe("measure — headings", () => {
  it("headingSemanticCoverage = 1 when all headings contain a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      headings:       ["escorts in hyderabad", "premium escorts available"],
    }));
    expect(r.headingSemanticCoverage).toBe(1);
  });

  it("headingSemanticCoverage = 0 when no headings contain any concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      headings:       ["about us", "contact page"],
    }));
    expect(r.headingSemanticCoverage).toBe(0);
  });

  it("headingSemanticCoverage = 0.5 when half of headings contain a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      headings:       ["escorts in delhi", "about us"],
    }));
    expect(r.headingSemanticCoverage).toBe(0.5);
  });

  it("headingSemanticCoverage = 0 when headings array is empty", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      headings:       [],
    }));
    expect(r.headingSemanticCoverage).toBe(0);
  });

  it("h1 contributes to headings even without supplied headings array", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      h1:             "Premium Escorts in Hyderabad",
    }));
    expect(r.headingSemanticCoverage).toBe(1);
  });
});

// ─── measure — intro ──────────────────────────────────────────────────────────

describe("measure — intro", () => {
  it("introSemanticCoverage = 1 when all intro paragraphs contain a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:
        "We offer escorts in hyderabad.\n\nOur escorts are premium.",
    }));
    expect(r.introSemanticCoverage).toBe(1);
  });

  it("introSemanticCoverage = 0.5 when half of intro paragraphs contain a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "Our escorts are premium.\n\nContact us for pricing.",
    }));
    expect(r.introSemanticCoverage).toBe(0.5);
  });

  it("introSemanticCoverage = 0 when no intro paragraph contains a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "We serve clients with discretion.",
    }));
    expect(r.introSemanticCoverage).toBe(0);
  });
});

// ─── measure — FAQs ───────────────────────────────────────────────────────────

describe("measure — FAQs", () => {
  it("faqSemanticCoverage = 1 when all FAQ items contain a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      faqItems: [
        { question: "How do I book escorts?", answer: "Call us." },
        { question: "Are your escorts safe?", answer: "Yes, all escorts are verified." },
      ],
    }));
    expect(r.faqSemanticCoverage).toBe(1);
  });

  it("faqSemanticCoverage = 0.5 when half of FAQ items contain a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      faqItems: [
        { question: "How do I book escorts?", answer: "Call us." },
        { question: "What is your policy?", answer: "We are discreet." },
      ],
    }));
    expect(r.faqSemanticCoverage).toBe(0.5);
  });

  it("faqSemanticCoverage = 0 when faqItems is empty", () => {
    const r = measure(makeInput({ primaryKeyword: "escorts", faqItems: [] }));
    expect(r.faqSemanticCoverage).toBe(0);
  });
});

// ─── measure — duplicate concepts ────────────────────────────────────────────

describe("measure — duplicate concepts", () => {
  it("uniqueConceptCount does not double-count deduped phrases", () => {
    // "escorts" appears in both primary and secondary; should be counted once
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["escorts"],
      introContent:      "escorts are available in hyderabad.",
    }));
    expect(r.uniqueConceptCount).toBe(1);
  });

  it("conceptRedundancy > 0 when a concept appears multiple times", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in delhi. escorts in mumbai. escorts in hyderabad.",
    }));
    expect(r.conceptRedundancy).toBeGreaterThan(0);
  });

  it("conceptRedundancy = 0 when each concept appears exactly once", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      introContent:      "find escorts and companions here.",
    }));
    // escorts: 1, companions: 1 → total=2, unique=2 → 1 - 2/2 = 0
    expect(r.conceptRedundancy).toBe(0);
  });
});

// ─── measure — repeated variants ─────────────────────────────────────────────

describe("measure — repeated variants", () => {
  it("keywordVariantCoverage counts each variant once even if repeated", () => {
    const r = measure(makeInput({
      semanticVariants: ["vip escorts", "call girls"],
      introContent:     "book vip escorts today. vip escorts available now. call girls here.",
    }));
    // Both variants found → coverage = 1
    expect(r.keywordVariantCoverage).toBe(1);
  });
});

// ─── measure — mixed case ─────────────────────────────────────────────────────

describe("measure — mixed case", () => {
  it("matches concepts case-insensitively", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "Find HYDERABAD ESCORTS of the finest quality.",
    }));
    expect(r.semanticKeywordCoverage).toBe(1);
  });

  it("normalises headings before matching", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      headings:       ["ESCORTS IN HYDERABAD"],
    }));
    expect(r.headingSemanticCoverage).toBe(1);
  });
});

// ─── measure — Unicode concepts ───────────────────────────────────────────────

describe("measure — Unicode concepts", () => {
  it("does not throw on Unicode primary keyword", () => {
    expect(() =>
      measure(makeInput({
        primaryKeyword: "हैदराबाद एस्कॉर्ट",
        introContent:   "हैदराबाद एस्कॉर्ट सेवाएं उपलब्ध हैं.",
      }))
    ).not.toThrow();
  });

  it("detects Unicode keyword in content", () => {
    const r = measure(makeInput({
      primaryKeyword: "हैदराबाद",
      introContent:   "हैदराबाद में बेहतरीन सेवाएं.",
    }));
    expect(r.semanticKeywordCoverage).toBe(1);
  });

  it("matches Unicode entities from localIntel", () => {
    const intel: LocalIntelSnapshot = {
      city:      "Delhi",
      landmarks: ["कुतुब मीनार"],
    };
    const r = measure(makeInput({
      localIntel:   intel,
      introContent: "कुतुब मीनार दिल्ली में है.",
    }));
    expect(r.entityCoverage).toBe(1);
  });
});

// ─── measure — overlapping phrases ───────────────────────────────────────────

describe("measure — overlapping phrases", () => {
  it("does not count partial matches from overlapping phrases", () => {
    // "escorts" should not match inside "escortsplus"
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escortsplus service available.",
    }));
    expect(r.semanticKeywordCoverage).toBe(0);
    expect(r.conceptCount).toBe(0);
  });

  it("correctly counts when shorter phrase is a substring of longer phrase", () => {
    // "escorts" and "hyderabad escorts" are both concepts
    // In "hyderabad escorts available": "hyderabad escorts" = 1, "escorts" = also 1 (word-boundary OK)
    const r = measure(makeInput({
      primaryKeyword:    "hyderabad escorts",
      secondaryKeywords: ["escorts"],
      introContent:      "hyderabad escorts available.",
    }));
    expect(r.uniqueConceptCount).toBe(2);
  });
});

// ─── measure — missing semanticVariants ──────────────────────────────────────

describe("measure — missing semanticVariants", () => {
  it("keywordVariantCoverage = 0 when semanticVariants is undefined", () => {
    const r = measure(makeInput({ introContent: "escorts available." }));
    expect(r.keywordVariantCoverage).toBe(0);
  });

  it("semanticClusterCount = 0 when only semanticVariants is provided as empty", () => {
    const r = measure(makeInput({ semanticVariants: [] }));
    expect(r.semanticClusterCount).toBe(0);
  });
});

// ─── measure — missing secondary keywords ────────────────────────────────────

describe("measure — missing secondary keywords", () => {
  it("semanticKeywordCoverage based only on primary when secondaryKeywords is empty", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: [],
      introContent:      "escorts available.",
    }));
    expect(r.semanticKeywordCoverage).toBe(1);
  });
});

// ─── measure — whitespace normalization ───────────────────────────────────────

describe("measure — whitespace normalization", () => {
  it("matches keyword with collapsed whitespace in content", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "book hyderabad   escorts today.",
    }));
    // After normalise, "hyderabad   escorts" → "hyderabad escorts" → match
    expect(r.semanticKeywordCoverage).toBe(1);
  });
});

// ─── measure — punctuation normalization ──────────────────────────────────────

describe("measure — punctuation normalization", () => {
  it("matches keyword even when adjacent to punctuation", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "book escorts, today.",
    }));
    // comma is not a word-boundary-breaking char for indexOf but it's not alphanumeric
    expect(r.conceptCount).toBeGreaterThan(0);
  });
});

// ─── measure — concept density ────────────────────────────────────────────────

describe("measure — concept density", () => {
  it("conceptDensity is 0 when content is empty", () => {
    const r = measure(makeInput({ primaryKeyword: "escorts" }));
    expect(r.conceptDensity).toBe(0);
  });

  it("conceptDensity > 0 when concept appears in content", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad escorts in delhi.",
    }));
    expect(r.conceptDensity).toBeGreaterThan(0);
  });

  it("conceptDensity is bounded (not > 100 per 100 words)", () => {
    const r = measure(makeInput({
      primaryKeyword: "a",
      introContent:   "a a a a a.",
    }));
    expect(r.conceptDensity).toBeLessThanOrEqual(100);
  });
});

// ─── measure — concept diversity ─────────────────────────────────────────────

describe("measure — concept diversity", () => {
  it("conceptDiversity = 0 when no concepts available", () => {
    expect(measure(makeInput()).conceptDiversity).toBe(0);
  });

  it("conceptDiversity = 1 when all available concepts are found", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      introContent:      "escorts and companions available.",
    }));
    expect(r.conceptDiversity).toBe(1);
  });

  it("conceptDiversity is between 0 and 1 for partial coverage", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions", "models"],
      introContent:      "escorts and companions available.",
    }));
    expect(r.conceptDiversity).toBeGreaterThan(0);
    expect(r.conceptDiversity).toBeLessThan(1);
  });
});

// ─── measure — co-occurrence ──────────────────────────────────────────────────

describe("measure — co-occurrence", () => {
  it("coOccurrenceCount = 0 when content is empty", () => {
    expect(measure(makeInput()).coOccurrenceCount).toBe(0);
  });

  it("coOccurrenceCount > 0 when two concepts appear in the same sentence", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["hyderabad"],
      introContent:      "book escorts in hyderabad today.",
    }));
    expect(r.coOccurrenceCount).toBeGreaterThan(0);
  });

  it("coOccurrenceCount = 0 when two concepts appear in different sentences", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["hyderabad"],
      introContent:      "book escorts today. hyderabad is a great city.",
    }));
    // "escorts" in sentence 1, "hyderabad" in sentence 2 → no co-occurrence
    expect(r.coOccurrenceCount).toBe(0);
  });

  it("coOccurrenceDensity = coOccurrenceCount / sentenceCount", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["hyderabad"],
      introContent:      "book escorts in hyderabad. book escorts in delhi.",
    }));
    // Both sentences have "escorts" but "hyderabad" is only in sentence 1
    // sentence 1: escorts + hyderabad → 1 pair → coOccurrenceCount = 1
    // sentenceCount = 2 → density = 0.5
    expect(r.coOccurrenceDensity).toBe(0.5);
  });

  it("coOccurrenceCount counts C(k,2) pairs for k concepts in same sentence", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["hyderabad", "premium"],
      introContent:      "book premium escorts in hyderabad today.",
    }));
    // 3 concepts in same sentence → C(3,2) = 3 pairs
    expect(r.coOccurrenceCount).toBe(3);
  });
});

// ─── measure — semantic clusters ──────────────────────────────────────────────

describe("measure — semantic clusters", () => {
  it("semanticClusterCount = 0 when all inputs are empty", () => {
    expect(measure(makeInput()).semanticClusterCount).toBe(0);
  });

  it("semanticClusterCount = 4 when all cluster types have terms", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      semanticVariants:  ["vip escorts"],
      localIntel:        { city: "Hyderabad", landmarks: ["Charminar"] },
    }));
    expect(r.semanticClusterCount).toBe(4);
  });

  it("semanticClusterCoverage = 1 when all non-empty clusters have mentions", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      introContent:      "find escorts and companions here.",
    }));
    expect(r.semanticClusterCoverage).toBe(1);
  });

  it("semanticClusterCoverage = 0.5 when half of non-empty clusters have mentions", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      introContent:      "find escorts here.",
    }));
    // primary found, secondary not found → 1/2
    expect(r.semanticClusterCoverage).toBe(0.5);
  });

  it("semanticGapCount = number of non-empty clusters with no mentions", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      introContent:      "find escorts here.",
    }));
    expect(r.semanticGapCount).toBe(1); // companions cluster has no mention
  });

  it("topicCoverage counts out of 4 total cluster slots", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts available.",
    }));
    // Only primary cluster (1 of 4) has a mention
    expect(r.topicCoverage).toBe(0.25);
  });
});

// ─── measure — sectionSemanticCoverage ───────────────────────────────────────

describe("measure — sectionSemanticCoverage", () => {
  it("covers intro paras + headings + faq items", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
      headings:       ["about us"],      // no concept
      faqItems:       [{ question: "Q?", answer: "A." }],  // no concept
    }));
    // 1 intro para (has concept) + 1 heading (no concept) + 1 faq item (no concept) = 1/3
    expect(r.sectionSemanticCoverage).toBeCloseTo(1 / 3, 3);
  });
});

// ─── measure — entityDistribution ────────────────────────────────────────────

describe("measure — entityDistribution", () => {
  const intel: LocalIntelSnapshot = { city: "Hyderabad", landmarks: ["Charminar"] };

  it("entityDistribution = 0 when no entities found in any zone", () => {
    const r = measure(makeInput({ localIntel: intel, introContent: "generic text." }));
    expect(r.entityDistribution).toBe(0);
  });

  it("entityDistribution = 1/3 when entity found in intro only", () => {
    const r = measure(makeInput({
      localIntel:   intel,
      introContent: "charminar is beautiful.",
    }));
    expect(r.entityDistribution).toBeCloseTo(1 / 3, 3);
  });

  it("entityDistribution = 1 when entity found in all 3 zones", () => {
    const r = measure(makeInput({
      localIntel:   intel,
      introContent: "charminar in hyderabad.",
      headings:     ["charminar area"],
      faqItems:     [{ question: "charminar?", answer: "yes charminar." }],
    }));
    expect(r.entityDistribution).toBe(1);
  });
});

// ─── measure — topicDistribution ─────────────────────────────────────────────

describe("measure — topicDistribution", () => {
  it("topicDistribution = 0 when no cluster appears in ≥2 zones", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
      // escorts only in intro zone
    }));
    expect(r.topicDistribution).toBe(0);
  });

  it("topicDistribution > 0 when a cluster appears in ≥2 zones", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
      faqItems:       [{ question: "How?", answer: "escorts are available." }],
    }));
    // primary cluster appears in intro AND faq zones
    expect(r.topicDistribution).toBeGreaterThan(0);
  });
});

// ─── measure — phraseVariationScore ──────────────────────────────────────────

describe("measure — phraseVariationScore", () => {
  it("phraseVariationScore = 0 when no primary keyword", () => {
    const r = measure(makeInput({
      secondaryKeywords: ["escorts"],
      introContent:      "escorts available.",
    }));
    expect(r.phraseVariationScore).toBe(0);
  });

  it("phraseVariationScore = 0 when no secondary or variant terms", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts available.",
    }));
    expect(r.phraseVariationScore).toBe(0);
  });

  it("phraseVariationScore = 1 when all secondary terms co-occur with primary", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["premium"],
      introContent:      "find premium escorts today.",
    }));
    expect(r.phraseVariationScore).toBe(1);
  });

  it("phraseVariationScore = 0.5 when half of secondary terms co-occur with primary", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["premium", "hyderabad"],
      introContent:
        "find premium escorts today. hyderabad is a great city.",
      // "premium escorts" co-occur in sentence 1 → phraseCoOccurrences = 1
      // "hyderabad" is in sentence 2 without escorts → 0
    }));
    expect(r.phraseVariationScore).toBe(0.5);
  });
});

// ─── measure — semanticConsistency ───────────────────────────────────────────

describe("measure — semanticConsistency", () => {
  it("semanticConsistency = 0 when no primary keyword", () => {
    const r = measure(makeInput({ introContent: "some content." }));
    expect(r.semanticConsistency).toBe(0);
  });

  it("semanticConsistency = 1 when all sections reference primary keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
      faqItems:       [{ question: "escorts?", answer: "yes escorts." }],
    }));
    expect(r.semanticConsistency).toBe(1);
  });

  it("semanticConsistency < 1 when some sections lack primary keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.\n\nGeneral info about services.",
      faqItems:       [{ question: "What?", answer: "Contact us." }],
    }));
    expect(r.semanticConsistency).toBeGreaterThan(0);
    expect(r.semanticConsistency).toBeLessThan(1);
  });
});

// ─── measure — semanticTransitionScore ───────────────────────────────────────

describe("measure — semanticTransitionScore", () => {
  it("semanticTransitionScore = 0 for 0 or 1 intro paragraphs", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
    }));
    expect(r.semanticTransitionScore).toBe(0);
  });

  it("semanticTransitionScore = 1 when all consecutive para pairs share a concept", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in delhi.\n\nescorts in mumbai.\n\nescorts in hyderabad.",
    }));
    // 3 paras → 2 pairs, both share "escorts" → 1
    expect(r.semanticTransitionScore).toBe(1);
  });

  it("semanticTransitionScore = 0 when no consecutive paras share a concept", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["companions"],
      introContent:
        "escorts in delhi.\n\ncompanions in mumbai.",
    }));
    // para 1 has "escorts", para 2 has "companions" → no shared concept between pairs
    expect(r.semanticTransitionScore).toBe(0);
  });
});

// ─── measure — semanticOverlapRatio ──────────────────────────────────────────

describe("measure — semanticOverlapRatio", () => {
  it("semanticOverlapRatio = 0 when no concepts found", () => {
    expect(measure(makeInput()).semanticOverlapRatio).toBe(0);
  });

  it("semanticOverlapRatio = 0 when all found concepts appear in only 1 zone", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
      // escorts only in intro
    }));
    expect(r.semanticOverlapRatio).toBe(0);
  });

  it("semanticOverlapRatio = 1 when all found concepts appear in ≥2 zones", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts in hyderabad.",
      faqItems:       [{ question: "escorts?", answer: "book escorts." }],
    }));
    // escorts found in intro and faq → 2 zones → overlap
    expect(r.semanticOverlapRatio).toBe(1);
  });
});

// ─── measure — malformed input ────────────────────────────────────────────────

describe("measure — malformed input", () => {
  it("does not throw when introContent is undefined", () => {
    const input = makeInput({ introContent: undefined as unknown as string });
    expect(() => measure(input)).not.toThrow();
  });

  it("does not throw when secondaryKeywords contains empty strings", () => {
    const r = measure(makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["", "  "],
      introContent:      "escorts available.",
    }));
    expect(r.semanticKeywordCoverage).toBe(1);
  });

  it("does not throw on FAQ items with empty question and answer", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      faqItems:       [{ question: "", answer: "" }],
    }));
    expect(r.faqSemanticCoverage).toBeDefined();
  });

  it("handles very long introContent without throwing", () => {
    const long = "escorts in hyderabad. ".repeat(200);
    expect(() => measure(makeInput({ primaryKeyword: "escorts", introContent: long }))).not.toThrow();
  });

  it("handles localIntel with all optional arrays absent", () => {
    const r = measure(makeInput({ localIntel: { city: "Hyderabad" } }));
    expect(r.entityCoverage).toBe(0);
    expect(r.entityDistribution).toBe(0);
  });
});

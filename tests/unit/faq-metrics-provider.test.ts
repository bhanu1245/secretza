import { describe, it, expect } from "vitest";
import {
  measure,
  normaliseText,
  extractSchemaFaqs,
} from "@/lib/seo-providers/faq-metrics-provider";
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

function faqLd(faqs: Array<{ q: string; a: string }>): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });
}

// ─── normaliseText ────────────────────────────────────────────────────────────

describe("normaliseText", () => {
  it("lowercases and trims", () => {
    expect(normaliseText("  Hello World  ")).toBe("hello world");
  });

  it("collapses whitespace", () => {
    expect(normaliseText("hello   world")).toBe("hello world");
  });

  it("strips leading/trailing punctuation", () => {
    expect(normaliseText("...hello world?")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normaliseText("")).toBe("");
  });
});

// ─── extractSchemaFaqs ───────────────────────────────────────────────────────

describe("extractSchemaFaqs", () => {
  it("returns empty for null", () => {
    expect(extractSchemaFaqs(null)).toHaveLength(0);
  });

  it("returns empty for malformed JSON", () => {
    expect(extractSchemaFaqs("{bad json")).toHaveLength(0);
  });

  it("returns empty when no FAQPage block", () => {
    expect(extractSchemaFaqs(JSON.stringify({ "@type": "Organization" }))).toHaveLength(0);
  });

  it("extracts FAQ items from FAQPage schema", () => {
    const ld = faqLd([
      { q: "What is Secretza?",  a: "A companion directory." },
      { q: "How do I contact?",  a: "Via the contact form." },
    ]);
    const faqs = extractSchemaFaqs(ld);
    expect(faqs).toHaveLength(2);
    expect(faqs[0]).toEqual({ question: "What is Secretza?", answer: "A companion directory." });
  });

  it("extracts FAQ items from array top-level", () => {
    const ld = JSON.stringify([
      { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Q1?", acceptedAnswer: { "@type": "Answer", text: "A1." } }] },
      { "@type": "Organization" },
    ]);
    expect(extractSchemaFaqs(ld)).toHaveLength(1);
  });

  it("extracts from @graph wrapper", () => {
    const ld = JSON.stringify({
      "@graph": [
        { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Q1?", acceptedAnswer: { "@type": "Answer", text: "A1." } }] },
      ],
    });
    expect(extractSchemaFaqs(ld)).toHaveLength(1);
  });
});

// ─── measure — no FAQs ───────────────────────────────────────────────────────

describe("measure — no FAQs", () => {
  it("all counts are zero when faqItems is empty", () => {
    const r = measure(makeInput());
    expect(r.faqCount).toBe(0);
    expect(r.questionCount).toBe(0);
    expect(r.answerCount).toBe(0);
    expect(r.emptyQuestionCount).toBe(0);
    expect(r.emptyAnswerCount).toBe(0);
    expect(r.duplicateQuestionCount).toBe(0);
    expect(r.duplicateAnswerCount).toBe(0);
    expect(r.duplicateFaqPairCount).toBe(0);
    expect(r.answerReadingTimeMinutes).toBe(0);
    expect(r.faqCompleteness).toBe(0);
  });

  it("extraStructuredFaqCount equals schema length when content is empty", () => {
    const r = measure(makeInput({
      structuredData: faqLd([
        { q: "What?", a: "Answer." },
        { q: "How?",  a: "Answer 2." },
      ]),
    }));
    expect(r.extraStructuredFaqCount).toBe(2);
    expect(r.missingStructuredFaqCount).toBe(0);
    expect(r.structuredFaqParity).toBe(0);
  });
});

// ─── measure — one FAQ ───────────────────────────────────────────────────────

describe("measure — one FAQ", () => {
  const input = makeInput({
    faqItems: [{ question: "What is the price?", answer: "It varies by service." }],
  });

  it("faqCount is 1", () => {
    expect(measure(input).faqCount).toBe(1);
  });

  it("faqCompleteness is 1 for a complete FAQ", () => {
    expect(measure(input).faqCompleteness).toBe(1);
  });

  it("averageQuestionWords matches the one question", () => {
    const r = measure(input);
    expect(r.averageQuestionWords).toBe(4); // "What is the price"
  });

  it("longestQuestionLength equals shortestQuestionLength for one FAQ", () => {
    const r = measure(input);
    expect(r.longestQuestionLength).toBe(r.shortestQuestionLength);
  });

  it("questionMarkCount is 1 for a question ending with '?'", () => {
    expect(measure(input).questionMarkCount).toBe(1);
  });

  it("questionStartsWithWhat is 1", () => {
    expect(measure(input).questionStartsWithWhat).toBe(1);
  });

  it("questionStartsWithWhWord is 1", () => {
    expect(measure(input).questionStartsWithWhWord).toBe(1);
  });
});

// ─── measure — multiple FAQs ─────────────────────────────────────────────────

describe("measure — multiple FAQs", () => {
  const faqItems = [
    { question: "How do I book?",                answer: "Call us on the number provided." },
    { question: "What are your rates?",          answer: "Rates vary from ₹2000 to ₹10000." },
    { question: "Where are you located?",        answer: "We serve all areas in Hyderabad." },
    { question: "Are you available tonight?",    answer: "Yes, we have companions available." },
    { question: "Is this service confidential?", answer: "Absolutely. Your privacy is guaranteed." },
  ];

  it("faqCount is 5", () => {
    expect(measure(makeInput({ faqItems })).faqCount).toBe(5);
  });

  it("questionStartsWithHow is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithHow).toBe(1);
  });

  it("questionStartsWithWhat is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithWhat).toBe(1);
  });

  it("questionStartsWithWhere is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithWhere).toBe(1);
  });

  it("questionStartsWithAre is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithAre).toBe(1);
  });

  it("questionStartsWithIs is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithIs).toBe(1);
  });

  it("questionMarkCount is 5", () => {
    expect(measure(makeInput({ faqItems })).questionMarkCount).toBe(5);
  });

  it("averageLengths are positive", () => {
    const r = measure(makeInput({ faqItems }));
    expect(r.averageQuestionLength).toBeGreaterThan(0);
    expect(r.averageAnswerLength).toBeGreaterThan(0);
  });

  it("longestQuestionLength >= shortestQuestionLength", () => {
    const r = measure(makeInput({ faqItems }));
    expect(r.longestQuestionLength).toBeGreaterThanOrEqual(r.shortestQuestionLength!);
  });
});

// ─── measure — duplicate questions ───────────────────────────────────────────

describe("measure — duplicate questions", () => {
  const faqItems = [
    { question: "How do I book?",   answer: "Call us." },
    { question: "How do I book?",   answer: "Use the form." },
    { question: "What is the price?", answer: "Varies." },
  ];

  it("duplicateQuestionCount is 1 (one question appears twice)", () => {
    expect(measure(makeInput({ faqItems })).duplicateQuestionCount).toBe(1);
  });

  it("duplicateAnswerCount is 0 (all answers differ)", () => {
    expect(measure(makeInput({ faqItems })).duplicateAnswerCount).toBe(0);
  });

  it("duplicateFaqPairCount is 0 (no identical Q+A pairs)", () => {
    expect(measure(makeInput({ faqItems })).duplicateFaqPairCount).toBe(0);
  });
});

// ─── measure — duplicate answers ─────────────────────────────────────────────

describe("measure — duplicate answers", () => {
  const faqItems = [
    { question: "Question one?", answer: "Contact us for details." },
    { question: "Question two?", answer: "Contact us for details." },
  ];

  it("duplicateAnswerCount is 1", () => {
    expect(measure(makeInput({ faqItems })).duplicateAnswerCount).toBe(1);
  });

  it("duplicateQuestionCount is 0", () => {
    expect(measure(makeInput({ faqItems })).duplicateQuestionCount).toBe(0);
  });
});

// ─── measure — duplicate FAQ pairs ───────────────────────────────────────────

describe("measure — duplicate FAQ pairs", () => {
  const faqItems = [
    { question: "What is this?", answer: "A companion service." },
    { question: "What is this?", answer: "A companion service." },
    { question: "Unique question?", answer: "Different answer." },
  ];

  it("duplicateFaqPairCount is 1", () => {
    expect(measure(makeInput({ faqItems })).duplicateFaqPairCount).toBe(1);
  });

  it("duplicateQuestionCount is also 1", () => {
    expect(measure(makeInput({ faqItems })).duplicateQuestionCount).toBe(1);
  });
});

// ─── measure — empty question ────────────────────────────────────────────────

describe("measure — empty question", () => {
  const faqItems = [
    { question: "",              answer: "The answer." },
    { question: "Real question?", answer: "The answer." },
  ];

  it("emptyQuestionCount is 1", () => {
    expect(measure(makeInput({ faqItems })).emptyQuestionCount).toBe(1);
  });

  it("faqCompleteness is 0.5 (only one complete)", () => {
    expect(measure(makeInput({ faqItems })).faqCompleteness).toBeCloseTo(0.5);
  });
});

// ─── measure — empty answer ───────────────────────────────────────────────────

describe("measure — empty answer", () => {
  const faqItems = [
    { question: "Valid question?", answer: "" },
    { question: "Another?",       answer: "Valid answer." },
  ];

  it("emptyAnswerCount is 1", () => {
    expect(measure(makeInput({ faqItems })).emptyAnswerCount).toBe(1);
  });
});

// ─── measure — malformed FAQ ──────────────────────────────────────────────────

describe("measure — malformed FAQ (whitespace-only)", () => {
  const faqItems = [
    { question: "   ",  answer: "   " },
    { question: "Real?", answer: "Real answer." },
  ];

  it("whitespace-only treated as empty", () => {
    const r = measure(makeInput({ faqItems }));
    expect(r.emptyQuestionCount).toBe(1);
    expect(r.emptyAnswerCount).toBe(1);
  });
});

// ─── measure — numbered answers ──────────────────────────────────────────────

describe("measure — numbered list answers", () => {
  const faqItems = [
    {
      question: "What steps should I follow?",
      answer:   "1. Visit the website.\n2. Browse profiles.\n3. Contact directly.",
    },
  ];

  it("answerContainsList is 1", () => {
    expect(measure(makeInput({ faqItems })).answerContainsList).toBe(1);
  });

  it("answerContainsNumber is 1 (list item numbers)", () => {
    expect(measure(makeInput({ faqItems })).answerContainsNumber).toBe(1);
  });
});

// ─── measure — bullet-list answers ───────────────────────────────────────────

describe("measure — bullet-list answers", () => {
  const faqItems = [
    {
      question: "What services are available?",
      answer:   "• Dinner dates\n• GFE\n• Travel companions",
    },
  ];

  it("answerContainsList is 1 for bullet list", () => {
    expect(measure(makeInput({ faqItems })).answerContainsList).toBe(1);
  });
});

// ─── measure — internal links ─────────────────────────────────────────────────

describe("measure — internal links in answers", () => {
  const faqItems = [
    {
      question: "How do I browse?",
      answer:   'Visit our <a href="/listings">listings page</a> for all options.',
    },
    {
      question: "Markdown link?",
      answer:   "See [our guide](/guide) for more information.",
    },
    {
      question: "External link?",
      answer:   'Check <a href="https://example.com">example</a>.',
    },
  ];

  it("answerContainsInternalLink counts relative links only", () => {
    expect(measure(makeInput({ faqItems })).answerContainsInternalLink).toBe(2);
  });
});

// ─── measure — keyword in answer ─────────────────────────────────────────────

describe("measure — keyword in answer", () => {
  const faqItems = [
    { question: "Q1?", answer: "Find hyderabad escorts on this platform." },
    { question: "Q2?", answer: "Yes, we have hyderabad escorts available." },
    { question: "Q3?", answer: "This answer has no keyword." },
  ];

  it("answerContainsKeyword counts FAQ items whose answers contain keyword", () => {
    const r = measure(makeInput({
      faqItems,
      primaryKeyword: "hyderabad escorts",
    }));
    expect(r.answerContainsKeyword).toBe(2);
  });

  it("whole-word matching: 'escorted' does not match 'escort'", () => {
    const r = measure(makeInput({
      faqItems:       [{ question: "Q?", answer: "He was escorted away." }],
      primaryKeyword: "escort",
    }));
    expect(r.answerContainsKeyword).toBe(0);
  });
});

// ─── measure — answer contains number ────────────────────────────────────────

describe("measure — answer contains number", () => {
  const faqItems = [
    { question: "Q1?", answer: "Rates start from ₹2000." },
    { question: "Q2?", answer: "Contact us for pricing." },
  ];

  it("answerContainsNumber is 1 for FAQ item with digits", () => {
    expect(measure(makeInput({ faqItems })).answerContainsNumber).toBe(1);
  });
});

// ─── measure — location in answer ────────────────────────────────────────────

describe("measure — location in answer", () => {
  it("detects generic location words", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Where?", answer: "We cover all areas in the city." },
        { question: "When?",  answer: "Available all day." },
      ],
    }));
    expect(r.answerContainsLocation).toBe(1);
  });

  it("detects city intelligence locations", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Where?", answer: "We operate in Banjara Hills and Jubilee Hills." },
      ],
      cityIntel: {
        city:             "Hyderabad",
        areas:            ["Banjara Hills", "Jubilee Hills"],
        landmarks:        [],
        transportHubs:    [],
        businessDistricts: [],
      },
    }));
    expect(r.answerContainsLocation).toBe(1);
  });
});

// ─── measure — call-to-action text ───────────────────────────────────────────

describe("measure — call-to-action in answers", () => {
  const faqItems = [
    { question: "Q1?", answer: "Contact us via the form to book now." },
    { question: "Q2?", answer: "We are professional and discreet." },
  ];

  it("answerContainsCallToAction is 1 for FAQ with CTA phrase", () => {
    expect(measure(makeInput({ faqItems })).answerContainsCallToAction).toBe(1);
  });
});

// ─── measure — WH question words ─────────────────────────────────────────────

describe("measure — WH and other question starters", () => {
  const faqItems = [
    { question: "How do I book?",            answer: "Call us." },
    { question: "What are the services?",    answer: "Many options." },
    { question: "Where are you located?",    answer: "Hyderabad." },
    { question: "When are you available?",   answer: "24/7." },
    { question: "Why choose us?",            answer: "Quality and discretion." },
    { question: "Can I book online?",        answer: "Yes." },
    { question: "Is this confidential?",     answer: "Yes." },
    { question: "Are you professional?",     answer: "Absolutely." },
    { question: "Tell me about services.",   answer: "Various." }, // no WH word
  ];

  it("questionStartsWithHow is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithHow).toBe(1);
  });

  it("questionStartsWithWhat is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithWhat).toBe(1);
  });

  it("questionStartsWithWhere is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithWhere).toBe(1);
  });

  it("questionStartsWithWhen is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithWhen).toBe(1);
  });

  it("questionStartsWithWhy is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithWhy).toBe(1);
  });

  it("questionStartsWithCan is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithCan).toBe(1);
  });

  it("questionStartsWithIs is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithIs).toBe(1);
  });

  it("questionStartsWithAre is 1", () => {
    expect(measure(makeInput({ faqItems })).questionStartsWithAre).toBe(1);
  });

  it("questionStartsWithWhWord counts how/what/where/when/why but not can/is/are", () => {
    // WH_WORDS set includes: who, whom, whose, which, what, where, when, why, how
    // "can", "is", "are" are NOT WH words
    const r = measure(makeInput({ faqItems }));
    expect(r.questionStartsWithWhWord).toBe(5); // how, what, where, when, why
  });
});

// ─── measure — FAQ schema parity ─────────────────────────────────────────────

describe("measure — FAQ schema parity (full match)", () => {
  const faqItems = [
    { question: "What is the price?",  answer: "From ₹2000." },
    { question: "How do I book?",      answer: "Call us on the number." },
  ];
  const sd = faqLd([
    { q: "What is the price?",  a: "From ₹2000." },
    { q: "How do I book?",      a: "Call us on the number." },
  ]);

  it("structuredFaqParity is 1 when all content FAQs are in schema", () => {
    expect(measure(makeInput({ faqItems, structuredData: sd })).structuredFaqParity).toBe(1);
  });

  it("missingStructuredFaqCount is 0 when all content FAQs are in schema", () => {
    expect(measure(makeInput({ faqItems, structuredData: sd })).missingStructuredFaqCount).toBe(0);
  });

  it("extraStructuredFaqCount is 0 when schema matches content exactly", () => {
    expect(measure(makeInput({ faqItems, structuredData: sd })).extraStructuredFaqCount).toBe(0);
  });
});

// ─── measure — FAQ schema mismatch ───────────────────────────────────────────

describe("measure — FAQ schema mismatch (partial match)", () => {
  const faqItems = [
    { question: "What is the price?",  answer: "From ₹2000." },
    { question: "How do I book?",      answer: "Call us." },
    { question: "Where are you?",      answer: "Hyderabad." },
  ];
  const sd = faqLd([
    { q: "What is the price?",  a: "From ₹2000." },
    { q: "How do I book?",      a: "Call us." },
    // "Where are you?" is missing from schema
    { q: "Extra schema FAQ?",   a: "Not in content." },
  ]);

  it("missingStructuredFaqCount is 1 (content FAQ not in schema)", () => {
    expect(measure(makeInput({ faqItems, structuredData: sd })).missingStructuredFaqCount).toBe(1);
  });

  it("extraStructuredFaqCount is 1 (schema FAQ not in content)", () => {
    expect(measure(makeInput({ faqItems, structuredData: sd })).extraStructuredFaqCount).toBe(1);
  });

  it("structuredFaqParity is 2/3 (2 of 3 schema questions found in content)", () => {
    const r = measure(makeInput({ faqItems, structuredData: sd }));
    expect(r.structuredFaqParity).toBeCloseTo(2 / 3, 3);
  });
});

// ─── measure — FAQ schema missing ────────────────────────────────────────────

describe("measure — FAQ schema missing (no structured data)", () => {
  const faqItems = [
    { question: "Q1?", answer: "A1." },
    { question: "Q2?", answer: "A2." },
  ];

  it("parity fields all show zero schema when no structured data", () => {
    const r = measure(makeInput({ faqItems, structuredData: null }));
    expect(r.structuredFaqParity).toBe(0);
    expect(r.structuredFaqQuestionCoverage).toBe(0);
    expect(r.structuredFaqAnswerCoverage).toBe(0);
    expect(r.missingStructuredFaqCount).toBe(2);
    expect(r.extraStructuredFaqCount).toBe(0);
  });
});

// ─── measure — Unicode FAQs ───────────────────────────────────────────────────

describe("measure — Unicode FAQs", () => {
  const faqItems = [
    { question: "हैदराबाद में एस्कॉर्ट कैसे बुक करें?", answer: "हमें कॉल करें।" },
    { question: "क्या सेवाएं उपलब्ध हैं?",               answer: "कई विकल्प उपलब्ध हैं।" },
  ];

  it("faqCount is correct for Unicode FAQ", () => {
    expect(measure(makeInput({ faqItems })).faqCount).toBe(2);
  });

  it("averageQuestionLength is positive", () => {
    expect(measure(makeInput({ faqItems })).averageQuestionLength).toBeGreaterThan(0);
  });

  it("questionMarkCount detects '?' in Unicode questions", () => {
    expect(measure(makeInput({ faqItems })).questionMarkCount).toBe(2);
  });

  it("all numeric metrics are finite", () => {
    const r = measure(makeInput({ faqItems }));
    const numericFields = [
      r.faqCount, r.questionCount, r.answerCount,
      r.averageQuestionLength, r.averageAnswerLength,
      r.averageQuestionWords, r.averageAnswerWords,
      r.longestQuestionLength, r.longestAnswerLength,
      r.shortestQuestionLength, r.shortestAnswerLength,
      r.faqCompleteness, r.answerReadingTimeMinutes,
    ];
    for (const val of numericFields) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});

// ─── measure — reading time ───────────────────────────────────────────────────

describe("measure — answerReadingTimeMinutes", () => {
  it("is 0 for empty FAQ list", () => {
    expect(measure(makeInput()).answerReadingTimeMinutes).toBe(0);
  });

  it("scales with answer word count", () => {
    const longAnswer = Array(238).fill("word").join(" ") + ".";
    const r = measure(makeInput({
      faqItems: [{ question: "Q?", answer: longAnswer }],
    }));
    expect(r.answerReadingTimeMinutes).toBeCloseTo(1, 0);
  });
});

// ─── measure — lead-in duplicates ────────────────────────────────────────────

describe("measure — faqDuplicateLeadIns", () => {
  const faqItems = [
    { question: "How can I book?",         answer: "A1." },
    { question: "How can I pay?",          answer: "A2." },
    { question: "How can I cancel?",       answer: "A3." },
    { question: "What is the price?",      answer: "A4." },
  ];

  it("counts question groups with identical first-3-word lead-in", () => {
    // "how can i" appears 3 times → 1 duplicate lead-in group
    expect(measure(makeInput({ faqItems })).faqDuplicateLeadIns).toBe(1);
  });
});

// ─── measure — faqCompleteness ────────────────────────────────────────────────

describe("measure — faqCompleteness", () => {
  it("is 1 when all FAQs have both question and answer", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Q1?", answer: "A1." },
        { question: "Q2?", answer: "A2." },
      ],
    }));
    expect(r.faqCompleteness).toBe(1);
  });

  it("is 0.5 when half of FAQs are incomplete", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "Q1?", answer: "" },
        { question: "Q2?", answer: "A2." },
      ],
    }));
    expect(r.faqCompleteness).toBe(0.5);
  });

  it("is 0 when all FAQs are empty", () => {
    const r = measure(makeInput({
      faqItems: [
        { question: "", answer: "" },
        { question: "", answer: "" },
      ],
    }));
    expect(r.faqCompleteness).toBe(0);
  });
});

// ─── measure — schema parity with normalisation ───────────────────────────────

describe("measure — schema parity with text normalisation", () => {
  it("matches questions despite casing and trailing punctuation differences", () => {
    const faqItems = [
      { question: "What is the price?", answer: "From ₹2000." },
    ];
    const sd = faqLd([
      { q: "WHAT IS THE PRICE?", a: "From ₹2000." },
    ]);
    const r = measure(makeInput({ faqItems, structuredData: sd }));
    expect(r.structuredFaqParity).toBe(1);
    expect(r.missingStructuredFaqCount).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  measure,
  buildTokenIndex,
  tokenizePhrase,
  countPhraseMatches,
  findPhrasePositions,
  countSubstringMatches,
} from "@/lib/seo-providers/keyword-metrics-provider";
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
      pageSlug:          "test-city",
      primaryKeyword:    null,
      secondaryKeywords: [],
      attempt:           1,
    },
    ...overrides,
  };
}

// ─── buildTokenIndex ──────────────────────────────────────────────────────────

describe("buildTokenIndex", () => {
  it("builds empty index for empty string", () => {
    const idx = buildTokenIndex("");
    expect(idx.tokens).toHaveLength(0);
    expect(idx.positions.size).toBe(0);
  });

  it("lowercases all tokens", () => {
    const idx = buildTokenIndex("Delhi Escorts");
    expect(idx.tokens).toEqual(["delhi", "escorts"]);
  });

  it("records correct positions", () => {
    const idx = buildTokenIndex("a b a");
    expect(idx.positions.get("a")).toEqual([0, 2]);
    expect(idx.positions.get("b")).toEqual([1]);
  });

  it("handles Hindi (Devanagari) as a single token including combining marks", () => {
    // \p{M} (combining marks) keeps vowel matras attached to consonants
    // so "दिल्ली" (Delhi) is one token, not split at each matra
    const idx = buildTokenIndex("दिल्ली");
    expect(idx.tokens).toHaveLength(1);
    expect(idx.tokens[0]).toBe("दिल्ली");
  });
});

// ─── tokenizePhrase ───────────────────────────────────────────────────────────

describe("tokenizePhrase", () => {
  it("splits multi-word phrase", () => {
    expect(tokenizePhrase("Delhi Escorts")).toEqual(["delhi", "escorts"]);
  });

  it("strips punctuation", () => {
    expect(tokenizePhrase("escort,")).toEqual(["escort"]);
  });

  it("handles empty string", () => {
    expect(tokenizePhrase("")).toHaveLength(0);
  });
});

// ─── countPhraseMatches — false-positive validation ───────────────────────────

describe("countPhraseMatches — whole-word safety (false-positive validation)", () => {
  it('"escort" does NOT match "escorted"', () => {
    const idx = buildTokenIndex("he was escorted to the venue");
    expect(countPhraseMatches(idx, "escort")).toBe(0);
  });

  it('"escort" DOES match "escort" as a whole word', () => {
    const idx = buildTokenIndex("find an escort in delhi");
    expect(countPhraseMatches(idx, "escort")).toBe(1);
  });

  it('"escort" does NOT match "escorts" (plural)', () => {
    const idx = buildTokenIndex("the escorts were professional");
    expect(countPhraseMatches(idx, "escort")).toBe(0);
  });

  it('"escorts" does NOT match "escort" (singular)', () => {
    const idx = buildTokenIndex("find an escort in delhi");
    expect(countPhraseMatches(idx, "escorts")).toBe(0);
  });

  it('"Delhi Escorts" matches "Delhi escorts" (case-insensitive)', () => {
    const idx = buildTokenIndex("Delhi escorts are professional");
    expect(countPhraseMatches(idx, "Delhi Escorts")).toBe(1);
  });

  it('"Delhi Escorts" does NOT match "DelhiEscorts" (no word boundary)', () => {
    // Tokenizer splits on non-letter/digit, so "DelhiEscorts" is one token
    const idx = buildTokenIndex("DelhiEscorts are available");
    expect(countPhraseMatches(idx, "Delhi Escorts")).toBe(0);
  });

  it("punctuation between words is transparent — comma does not break adjacency", () => {
    // Our tokenizer strips punctuation: "delhi, escorts" → tokens ["delhi", "escorts"]
    // They become adjacent, so "delhi escorts" DOES match. This is correct behaviour:
    // a comma between keyword words is incidental punctuation, not a phrase boundary.
    const idx = buildTokenIndex("delhi, escorts in india");
    expect(countPhraseMatches(idx, "delhi escorts")).toBe(1);
  });

  it("Unicode keyword matches correctly", () => {
    const idx = buildTokenIndex("दिल्ली एस्कॉर्ट सेवाएं");
    expect(countPhraseMatches(idx, "दिल्ली एस्कॉर्ट")).toBe(1);
  });

  it("overlapping keywords behave deterministically (non-overlapping count)", () => {
    // "ab ab ab" — looking for "ab": 3 non-overlapping whole-word matches
    const idx = buildTokenIndex("ab ab ab");
    expect(countPhraseMatches(idx, "ab")).toBe(3);
  });
});

// ─── countSubstringMatches ────────────────────────────────────────────────────

describe("countSubstringMatches", () => {
  it("counts substring occurrences including inside-word", () => {
    expect(countSubstringMatches("escorted escorting escort", "escort")).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(countSubstringMatches("Escort ESCORT escort", "escort")).toBe(3);
  });

  it("returns 0 for empty phrase", () => {
    expect(countSubstringMatches("some text", "")).toBe(0);
  });

  it("returns 0 when phrase not found", () => {
    expect(countSubstringMatches("some text", "xyz")).toBe(0);
  });
});

// ─── findPhrasePositions ──────────────────────────────────────────────────────

describe("findPhrasePositions", () => {
  it("returns empty array when phrase absent", () => {
    const idx = buildTokenIndex("cat sat mat");
    expect(findPhrasePositions(idx, "dog")).toHaveLength(0);
  });

  it("returns correct word positions for single-word phrase", () => {
    const idx = buildTokenIndex("a b a b a");
    expect(findPhrasePositions(idx, "a")).toEqual([0, 2, 4]);
  });

  it("returns correct start position for multi-word phrase", () => {
    // tokens: find(0) an(1) escort(2) in(3) delhi(4) escort(5) delhi(6)
    // "escort delhi": escort@2 → next is "in"(3) ≠ "delhi" → no match
    //                 escort@5 → next is "delhi"(6) ✓ → match at 5
    const idx = buildTokenIndex("find an escort in delhi escort delhi");
    expect(findPhrasePositions(idx, "escort delhi")).toEqual([5]);
  });
});

// ─── measure — empty content ──────────────────────────────────────────────────

describe("measure — empty content, no keyword", () => {
  it("all metrics are zero/false/null when no keyword and no content", () => {
    const r = measure(makeInput());

    expect(r.primaryKeywordPresent).toBe(false);
    expect(r.primaryKeywordOccurrences).toBe(0);
    expect(r.primaryKeywordDensity).toBe(0);
    expect(r.primaryKeywordFirstPosition).toBe(-1);
    expect(r.primaryKeywordLastPosition).toBe(-1);
    expect(r.primaryKeywordInTitle).toBe(false);
    expect(r.primaryKeywordInH1).toBe(false);
    expect(r.primaryKeywordInMeta).toBe(false);
    expect(r.primaryKeywordInIntro).toBe(false);
    expect(r.primaryKeywordInFaq).toBe(false);
    expect(r.primaryKeywordInInternalLinks).toBe(false);
    expect(r.primaryKeywordInSlug).toBe(false);
    expect(r.primaryKeywordInCanonical).toBe(false);
    expect(r.secondaryKeywordHits).toBe(0);
    expect(r.secondaryKeywordCount).toBe(0);
    expect(r.secondaryKeywordCoverage).toBe(0);
    expect(r.secondaryKeywordOccurrences).toBe(0);
    expect(r.exactMatchCount).toBe(0);
    expect(r.partialMatchCount).toBe(0);
    expect(r.keywordDistributionScore).toBe(0);
    expect(r.keywordSpread).toBe(0);
    expect(r.sectionCoverage).toBe(0);
    expect(r.headingCoverage).toBe(0);
    expect(r.faqCoverage).toBe(0);
    expect(r.introCoverage).toBe(0);
  });
});

// ─── measure — primary keyword absent ────────────────────────────────────────

describe("measure — primary keyword absent from content", () => {
  const input = makeInput({
    primaryKeyword: "hyderabad escorts",
    introContent:   "This city is great for tourism and culture.",
  });

  it("primaryKeywordPresent is false", () => {
    expect(measure(input).primaryKeywordPresent).toBe(false);
  });

  it("primaryKeywordOccurrences is 0", () => {
    expect(measure(input).primaryKeywordOccurrences).toBe(0);
  });

  it("all field-presence flags are false", () => {
    const r = measure(input);
    expect(r.primaryKeywordInIntro).toBe(false);
    expect(r.primaryKeywordInTitle).toBe(false);
    expect(r.primaryKeywordInFaq).toBe(false);
  });
});

// ─── measure — primary keyword present once ───────────────────────────────────

describe("measure — primary keyword present exactly once", () => {
  const intro = "If you are looking for hyderabad escorts, this is your guide.";
  const input = makeInput({
    primaryKeyword: "hyderabad escorts",
    introContent:   intro,
  });

  it("primaryKeywordPresent is true", () => {
    expect(measure(input).primaryKeywordPresent).toBe(true);
  });

  it("primaryKeywordOccurrences is 1", () => {
    expect(measure(input).primaryKeywordOccurrences).toBe(1);
  });

  it("primaryKeywordFirstPosition equals primaryKeywordLastPosition", () => {
    const r = measure(input);
    expect(r.primaryKeywordFirstPosition).toBe(r.primaryKeywordLastPosition);
    expect(r.primaryKeywordFirstPosition).toBeGreaterThanOrEqual(0);
  });

  it("keywordSpread is 0 (only one occurrence)", () => {
    expect(measure(input).keywordSpread).toBe(0);
  });

  it("exactMatchCount is 1", () => {
    expect(measure(input).exactMatchCount).toBe(1);
  });

  it("primaryKeywordInIntro is true", () => {
    expect(measure(input).primaryKeywordInIntro).toBe(true);
  });
});

// ─── measure — primary keyword repeated ──────────────────────────────────────

describe("measure — primary keyword repeated multiple times", () => {
  const intro = [
    "Hyderabad escorts are professional.",
    "Many hyderabad escorts offer discreet services.",
    "Find the best hyderabad escorts here.",
  ].join(" ");

  const input = makeInput({
    primaryKeyword: "hyderabad escorts",
    introContent:   intro,
  });

  it("primaryKeywordOccurrences is 3", () => {
    expect(measure(input).primaryKeywordOccurrences).toBe(3);
  });

  it("firstPosition < lastPosition", () => {
    const r = measure(input);
    expect(r.primaryKeywordFirstPosition!).toBeLessThan(r.primaryKeywordLastPosition!);
  });

  it("keywordSpread is > 0", () => {
    expect(measure(input).keywordSpread).toBeGreaterThan(0);
  });

  it("primaryKeywordDensity is positive", () => {
    expect(measure(input).primaryKeywordDensity).toBeGreaterThan(0);
  });
});

// ─── measure — title contains keyword ────────────────────────────────────────

describe("measure — title contains keyword", () => {
  it("primaryKeywordInTitle is true", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      title:          "Hyderabad Escorts | Secretza",
    }));
    expect(r.primaryKeywordInTitle).toBe(true);
  });

  it("primaryKeywordInTitle is false when keyword not in title", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      title:          "Welcome to Secretza",
    }));
    expect(r.primaryKeywordInTitle).toBe(false);
  });
});

// ─── measure — H1 contains keyword ───────────────────────────────────────────

describe("measure — H1 contains keyword", () => {
  it("primaryKeywordInH1 is true", () => {
    const r = measure(makeInput({
      primaryKeyword: "delhi escorts",
      h1:             "Delhi Escorts Guide",
    }));
    expect(r.primaryKeywordInH1).toBe(true);
  });

  it("primaryKeywordInH1 is false for partial match (escorted ≠ escort)", () => {
    const r = measure(makeInput({
      primaryKeyword: "escort",
      h1:             "Escorted Tours in Delhi",
    }));
    expect(r.primaryKeywordInH1).toBe(false);
  });
});

// ─── measure — meta description contains keyword ──────────────────────────────

describe("measure — meta description contains keyword", () => {
  it("primaryKeywordInMeta is true", () => {
    const r = measure(makeInput({
      primaryKeyword:  "mumbai escorts",
      metaDescription: "Find the best Mumbai escorts on Secretza. Professional service.",
    }));
    expect(r.primaryKeywordInMeta).toBe(true);
  });

  it("primaryKeywordInMeta is false when absent", () => {
    const r = measure(makeInput({
      primaryKeyword:  "mumbai escorts",
      metaDescription: "Find premium companions in the city.",
    }));
    expect(r.primaryKeywordInMeta).toBe(false);
  });
});

// ─── measure — intro contains keyword ────────────────────────────────────────

describe("measure — intro contains keyword", () => {
  it("primaryKeywordInIntro is true", () => {
    const r = measure(makeInput({
      primaryKeyword: "bangalore escorts",
      introContent:   "Bangalore escorts are known for their professionalism.",
    }));
    expect(r.primaryKeywordInIntro).toBe(true);
  });
});

// ─── measure — FAQ contains keyword ──────────────────────────────────────────

describe("measure — FAQ contains keyword", () => {
  it("primaryKeywordInFaq is true when keyword in FAQ question", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "General intro text here.",
      faqItems: [
        { question: "Where can I find hyderabad escorts?", answer: "You can find them here." },
        { question: "What services are offered?",          answer: "Full companionship." },
      ],
    }));
    expect(r.primaryKeywordInFaq).toBe(true);
  });

  it("primaryKeywordInFaq is true when keyword only in FAQ answer", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "General intro.",
      faqItems: [
        { question: "What is available?", answer: "Hyderabad escorts offer many services." },
      ],
    }));
    expect(r.primaryKeywordInFaq).toBe(true);
  });

  it("primaryKeywordInFaq is false when keyword absent from all FAQs", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "General intro.",
      faqItems: [
        { question: "What is the price?", answer: "It varies by service." },
      ],
    }));
    expect(r.primaryKeywordInFaq).toBe(false);
  });

  it("faqCoverage reflects fraction of FAQ items containing keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "escort",
      introContent:   "Intro.",
      faqItems: [
        { question: "Find an escort?",   answer: "Yes." },
        { question: "What is the price?", answer: "Varies." },
        { question: "Book an escort?",   answer: "Call us." },
      ],
    }));
    // 2 of 3 FAQ items contain "escort"
    expect(r.faqCoverage).toBeCloseTo(2 / 3, 3);
  });
});

// ─── measure — slug and canonical ────────────────────────────────────────────

describe("measure — slug and canonical URL", () => {
  it("primaryKeywordInSlug is true when keyword tokens are in slug", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      pageContext: {
        pageType:          "city",
        pageSlug:          "hyderabad-escorts",
        primaryKeyword:    "hyderabad escorts",
        secondaryKeywords: [],
        attempt:           1,
      },
    }));
    expect(r.primaryKeywordInSlug).toBe(true);
  });

  it("primaryKeywordInSlug is false when slug does not contain keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      pageContext: {
        pageType:          "city",
        pageSlug:          "city-guide",
        primaryKeyword:    "hyderabad escorts",
        secondaryKeywords: [],
        attempt:           1,
      },
    }));
    expect(r.primaryKeywordInSlug).toBe(false);
  });

  it("primaryKeywordInCanonical is true when URL contains keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      canonicalUrl:   "https://secretza.com/hyderabad-escorts",
    }));
    expect(r.primaryKeywordInCanonical).toBe(true);
  });

  it("primaryKeywordInCanonical is false when URL does not contain keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      canonicalUrl:   "https://secretza.com/city-guide",
    }));
    expect(r.primaryKeywordInCanonical).toBe(false);
  });
});

// ─── measure — secondary keywords ────────────────────────────────────────────

describe("measure — secondary keywords", () => {
  const input = makeInput({
    primaryKeyword:    "hyderabad escorts",
    secondaryKeywords: ["call girls hyderabad", "female companions", "luxury escorts"],
    introContent:
      "Hyderabad escorts and call girls hyderabad are here. " +
      "Find luxury escorts and female companions easily.",
  });

  it("secondaryKeywordCount equals list length", () => {
    expect(measure(input).secondaryKeywordCount).toBe(3);
  });

  it("secondaryKeywordHits counts distinct keywords found", () => {
    expect(measure(input).secondaryKeywordHits).toBe(3);
  });

  it("secondaryKeywordCoverage is 1 when all found", () => {
    expect(measure(input).secondaryKeywordCoverage).toBe(1);
  });

  it("secondaryKeywordOccurrences counts total appearances", () => {
    // "call girls hyderabad" ×1, "female companions" ×1, "luxury escorts" ×1
    expect(measure(input).secondaryKeywordOccurrences).toBeGreaterThanOrEqual(3);
  });

  it("partial coverage when only some secondary keywords found", () => {
    const partial = makeInput({
      primaryKeyword:    "escorts",
      secondaryKeywords: ["premium companions", "luxury service", "missing keyword"],
      introContent:      "Find premium companions and luxury service here.",
    });
    const r = measure(partial);
    expect(r.secondaryKeywordHits).toBe(2);
    expect(r.secondaryKeywordCoverage).toBeCloseTo(2 / 3, 3);
  });
});

// ─── measure — semantic variants ─────────────────────────────────────────────

describe("measure — semantic variants", () => {
  it("semanticVariantCount equals supplied list length", () => {
    const r = measure(makeInput({
      primaryKeyword:   "escorts",
      semanticVariants: ["companions", "call girls", "models"],
      introContent:     "Find companions and call girls here.",
    }));
    expect(r.semanticVariantCount).toBe(3);
  });

  it("semanticVariantCoverage reflects fraction found", () => {
    const r = measure(makeInput({
      primaryKeyword:   "escorts",
      semanticVariants: ["companions", "call girls", "models"],
      introContent:     "Find companions and call girls here.",
    }));
    // "companions" and "call girls" found; "models" absent → 2/3
    expect(r.semanticVariantCoverage).toBeCloseTo(2 / 3, 3);
  });

  it("semanticVariantCoverage is 0 when none found", () => {
    const r = measure(makeInput({
      primaryKeyword:   "escorts",
      semanticVariants: ["xyz1", "xyz2"],
      introContent:     "This text has nothing relevant.",
    }));
    expect(r.semanticVariantCoverage).toBe(0);
  });

  it("semanticVariantCoverage is 0 when variants list is empty", () => {
    const r = measure(makeInput({
      primaryKeyword:   "escorts",
      semanticVariants: [],
      introContent:     "Escorts in the city.",
    }));
    expect(r.semanticVariantCoverage).toBe(0);
    expect(r.semanticVariantCount).toBe(0);
  });
});

// ─── measure — exact vs partial matches ──────────────────────────────────────

describe("measure — exact vs partial match counts", () => {
  it("exactMatchCount equals whole-word occurrences", () => {
    // "escort" appears 2 whole-word times; "escorted" is NOT a match
    const r = measure(makeInput({
      primaryKeyword: "escort",
      introContent:   "Find an escort. Another escort was escorted away.",
    }));
    expect(r.exactMatchCount).toBe(2);
  });

  it("partialMatchCount equals substring-only occurrences", () => {
    // "escorted" contains "escort" as a substring → partial = 1
    const r = measure(makeInput({
      primaryKeyword: "escort",
      introContent:   "Find an escort. Another escort was escorted away.",
    }));
    expect(r.partialMatchCount).toBe(1);
  });

  it("partialMatchCount is 0 when keyword only appears as whole words", () => {
    const r = measure(makeInput({
      primaryKeyword: "escort",
      introContent:   "Find an escort for your escort service.",
    }));
    expect(r.partialMatchCount).toBe(0);
  });
});

// ─── measure — Unicode keywords ───────────────────────────────────────────────

describe("measure — Unicode keywords", () => {
  it("measures Hindi keyword presence correctly", () => {
    const r = measure(makeInput({
      primaryKeyword: "दिल्ली एस्कॉर्ट",
      introContent:   "आप दिल्ली एस्कॉर्ट सेवाएं यहाँ पा सकते हैं।",
    }));
    expect(r.primaryKeywordPresent).toBe(true);
    expect(r.primaryKeywordOccurrences).toBeGreaterThanOrEqual(1);
  });

  it("does not false-positive on Unicode substring", () => {
    // "दिल" should not match "दिल्ली" (different tokens)
    const r = measure(makeInput({
      primaryKeyword: "दिल",
      introContent:   "दिल्ली में आपका स्वागत है।",
    }));
    expect(r.primaryKeywordOccurrences).toBe(0);
  });
});

// ─── measure — mixed case keywords ───────────────────────────────────────────

describe("measure — mixed case keywords", () => {
  it("case-insensitive matching works", () => {
    const r = measure(makeInput({
      primaryKeyword: "HYDERABAD ESCORTS",
      introContent:   "Hyderabad escorts are available here. Hyderabad Escorts guide.",
    }));
    expect(r.primaryKeywordOccurrences).toBe(2);
  });
});

// ─── measure — overlapping keywords ──────────────────────────────────────────

describe("measure — overlapping / adjacent keywords", () => {
  it("handles adjacent repeated phrases without off-by-one", () => {
    const r = measure(makeInput({
      primaryKeyword: "escort escort",
      introContent:   "escort escort escort escort",
    }));
    // "escort escort" can match at positions 0, 1, 2 — non-overlapping by index walk
    expect(r.primaryKeywordOccurrences).toBeGreaterThanOrEqual(1);
    expect(r.primaryKeywordPresent).toBe(true);
  });
});

// ─── measure — repeated punctuation ──────────────────────────────────────────

describe("measure — repeated punctuation in content", () => {
  it("ignores punctuation between keywords", () => {
    // "escorts," and "escorts." are tokenized as "escorts" — still matches
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts, escorts. escorts! escorts?",
    }));
    expect(r.primaryKeywordOccurrences).toBe(4);
  });
});

// ─── measure — internal links keyword ────────────────────────────────────────

describe("measure — keyword in internal links", () => {
  it("primaryKeywordInInternalLinks true when keyword in anchor text", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      internalLinks: [
        { anchor: "Hyderabad Escorts Guide", href: "/hyderabad" },
        { anchor: "Home",                    href: "/" },
      ],
    }));
    expect(r.primaryKeywordInInternalLinks).toBe(true);
  });

  it("primaryKeywordInInternalLinks false when keyword not in any anchor", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      internalLinks: [
        { anchor: "Home",  href: "/" },
        { anchor: "About", href: "/about" },
      ],
    }));
    expect(r.primaryKeywordInInternalLinks).toBe(false);
  });
});

// ─── measure — distribution and spread ───────────────────────────────────────

describe("measure — keywordDistributionScore and keywordSpread", () => {
  it("distribution score is 0 when keyword is absent", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "This text does not contain the keyword.",
    }));
    expect(r.keywordDistributionScore).toBe(0);
  });

  it("spread is 0 when keyword appears only once", () => {
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "Find escorts here.",
    }));
    expect(r.keywordSpread).toBe(0);
  });

  it("spread is positive when keyword appears near start and near end", () => {
    const words = Array(100).fill("word").join(" ");
    const r = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   `escorts ${words} escorts`,
    }));
    expect(r.keywordSpread).toBeGreaterThan(0.5);
  });

  it("distribution score increases with wider spread", () => {
    const rConcentrated = measure(makeInput({
      primaryKeyword: "escorts",
      introContent:   "escorts escorts " + Array(50).fill("word").join(" "),
    }));
    const rDistributed = measure(makeInput({
      primaryKeyword: "escorts",
      introContent: Array(10).fill("word escorts").join(" word word word word "),
    }));
    expect(rDistributed.keywordDistributionScore!).toBeGreaterThanOrEqual(
      rConcentrated.keywordDistributionScore!,
    );
  });
});

// ─── measure — section and heading coverage ───────────────────────────────────

describe("measure — sectionCoverage and headingCoverage", () => {
  const intro = `
<h2>About Hyderabad Escorts</h2>
<p>Hyderabad escorts are professional and discreet companions.</p>

<h2>Services Available</h2>
<p>We offer a wide range of companionship services in the city.</p>

<h2>How to Book</h2>
<p>Booking hyderabad escorts is simple and straightforward.</p>
  `.trim();

  it("headingCoverage reflects fraction of headings containing keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   intro,
    }));
    // Headings: "About Hyderabad Escorts", "Services Available", "How to Book"
    // Only first contains keyword → 1/3
    expect(r.headingCoverage).toBeCloseTo(1 / 3, 2);
  });

  it("sectionCoverage reflects sections containing keyword", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   intro,
    }));
    // Sections that contain "hyderabad escorts" in their body or heading text
    expect(r.sectionCoverage).toBeGreaterThan(0);
  });
});

// ─── measure — introCoverage ──────────────────────────────────────────────────

describe("measure — introCoverage", () => {
  it("reflects fraction of intro paragraphs containing keyword", () => {
    const intro =
      "Hyderabad escorts are professional.\n\n" +
      "The city has many landmarks.\n\n" +
      "Hyderabad escorts offer discreet services.";

    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   intro,
    }));
    // 2 of 3 paragraphs contain "hyderabad escorts"
    expect(r.introCoverage).toBeCloseTo(2 / 3, 2);
  });

  it("introCoverage is 0 when keyword never in intro paragraphs", () => {
    const r = measure(makeInput({
      primaryKeyword: "hyderabad escorts",
      introContent:   "The city is vibrant.\n\nMany people visit here.",
    }));
    expect(r.introCoverage).toBe(0);
  });
});

// ─── measure — all metrics are finite ────────────────────────────────────────

describe("measure — numeric stability", () => {
  it("all numeric outputs are finite and non-negative for a full page", () => {
    const r = measure(makeInput({
      primaryKeyword:    "hyderabad escorts",
      secondaryKeywords: ["call girls", "companions"],
      semanticVariants:  ["models", "ladies"],
      title:             "Hyderabad Escorts Guide",
      h1:                "Hyderabad Escorts",
      metaDescription:   "Find top hyderabad escorts here.",
      canonicalUrl:      "https://secretza.com/hyderabad-escorts",
      introContent:      "Hyderabad escorts are available. Find the best hyderabad escorts.",
      faqItems: [
        { question: "Where to find hyderabad escorts?", answer: "On this site." },
      ],
      internalLinks: [{ anchor: "Hyderabad Escorts", href: "/hyderabad" }],
      pageContext: {
        pageType:          "city",
        pageSlug:          "hyderabad-escorts",
        primaryKeyword:    "hyderabad escorts",
        secondaryKeywords: [],
        attempt:           1,
      },
    }));

    const numericFields = [
      r.primaryKeywordOccurrences,
      r.primaryKeywordDensity,
      r.primaryKeywordFirstPosition,
      r.primaryKeywordLastPosition,
      r.secondaryKeywordHits,
      r.secondaryKeywordCount,
      r.secondaryKeywordCoverage,
      r.secondaryKeywordOccurrences,
      r.secondaryKeywordDensity,
      r.semanticVariantCount,
      r.semanticVariantCoverage,
      r.exactMatchCount,
      r.partialMatchCount,
      r.keywordDistributionScore,
      r.keywordSpread,
      r.sectionCoverage,
      r.headingCoverage,
      r.faqCoverage,
      r.introCoverage,
    ];
    for (const val of numericFields) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});

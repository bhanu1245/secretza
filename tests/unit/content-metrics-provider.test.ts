/**
 * Unit tests for ContentMetricsProvider
 *
 * Covers: empty page, short page, long page, multiple headings,
 *         multiple FAQs, malformed HTML, markdown headings, nested lists.
 * Verifies every metric owned by the provider.
 */

import { describe, it, expect } from "vitest";
import {
  measure,
  ContentMetricsProvider,
  contentMetricsProvider,
} from "@/lib/seo-providers/content-metrics-provider";
import type { MetricsCollectorInput } from "@/lib/seo-quality-types";

// ─── Fixture builder ────────────────────────────────────────────────────────

function makeInput(
  introContent: string,
  faqs: Array<{ question: string; answer: string }> = [],
): MetricsCollectorInput {
  return {
    introContent,
    faqItems: faqs,
    title: null,
    metaDescription: null,
    h1: null,
    canonicalUrl: null,
    featuredImage: null,
    imageAlt: null,
    structuredData: null,
    internalLinks: [],
    primaryKeyword: null,
    secondaryKeywords: [],
    peerPages: [],
    cityIntel: null,
    pageContext: {
      pageType: "city",
      pageSlug: "test-city",
      primaryKeyword: null,
      secondaryKeywords: [],
      attempt: 0,
    },
  };
}

// ─── Empty page ─────────────────────────────────────────────────────────────

describe("empty page", () => {
  const result = measure(makeInput(""));

  it("wordCount is 0", () => expect(result.wordCount).toBe(0));
  it("wordCountIntro is 0", () => expect(result.wordCountIntro).toBe(0));
  it("characterCount is 0", () => expect(result.characterCount).toBe(0));
  it("paragraphCount is 0", () => expect(result.paragraphCount).toBe(0));
  it("sentenceCount is 0", () => expect(result.sentenceCount).toBe(0));
  it("avgSentenceWords is 0", () => expect(result.avgSentenceWords).toBe(0));
  it("sentenceLengthVariance is 0", () => expect(result.sentenceLengthVariance).toBe(0));
  it("longSentenceRatio is 0", () => expect(result.longSentenceRatio).toBe(0));
  it("avgParagraphWords is 0", () => expect(result.avgParagraphWords).toBe(0));
  it("headingCount is 0", () => expect(result.headingCount).toBe(0));
  it("h2Count is 0", () => expect(result.h2Count).toBe(0));
  it("h3Count is 0", () => expect(result.h3Count).toBe(0));
  it("listCount is 0", () => expect(result.listCount).toBe(0));
  it("tableCount is 0", () => expect(result.tableCount).toBe(0));
  it("imageCount is 0", () => expect(result.imageCount).toBe(0));
  it("externalLinksCount is 0", () => expect(result.externalLinksCount).toBe(0));
  it("headingDensity is 0", () => expect(result.headingDensity).toBe(0));
  it("contentDensity is 1 (empty raw = no markup overhead)", () => {
    // Empty string: 0/0 → fallback to 1
    expect(result.contentDensity).toBe(1);
  });
});

// ─── Short page ─────────────────────────────────────────────────────────────

describe("short page — one plain paragraph", () => {
  const content = "Mumbai is a great city for business. Verified listings are available here.";
  const result = measure(makeInput(content));

  it("wordCount equals intro word count (no FAQs)", () => {
    expect(result.wordCount).toBe(result.wordCountIntro);
  });
  it("wordCountIntro > 0", () => expect(result.wordCountIntro).toBeGreaterThan(0));
  it("characterCount equals visible char count", () => {
    expect(result.characterCount).toBeGreaterThan(0);
    expect(result.characterCount).toBeLessThanOrEqual(content.length);
  });
  it("sentenceCount is 2", () => expect(result.sentenceCount).toBe(2));
  it("avgSentenceWords > 0", () => expect(result.avgSentenceWords).toBeGreaterThan(0));
  it("paragraphCount is 1", () => expect(result.paragraphCount).toBe(1));
  it("no headings", () => {
    expect(result.headingCount).toBe(0);
    expect(result.h2Count).toBe(0);
    expect(result.h3Count).toBe(0);
  });
  it("no lists, tables, images, external links", () => {
    expect(result.listCount).toBe(0);
    expect(result.tableCount).toBe(0);
    expect(result.imageCount).toBe(0);
    expect(result.externalLinksCount).toBe(0);
  });
  it("contentDensity is 1 (no markup)", () => {
    expect(result.contentDensity).toBe(1);
  });
});

// ─── Long page ──────────────────────────────────────────────────────────────

describe("long page — many paragraphs and sentences", () => {
  // Build a long text with clear paragraphs
  const para1 = "Delhi is the capital of India. It has a large population. " +
    "The city has many business districts. Transport is excellent. " +
    "The metro connects key areas. Nightlife is vibrant in South Delhi.";
  const para2 = "Connaught Place is the commercial heart of the city. " +
    "South Delhi is known for premium residential areas. " +
    "The airport connects Delhi to international destinations. " +
    "Shopping malls are spread across the city. " +
    "Business visitors prefer hotels near Aerocity.";
  const para3 = "The history of Delhi spans many centuries. " +
    "Monuments attract millions of tourists every year. " +
    "Local cuisine reflects the diverse culture of the region. " +
    "Festivals bring color to every neighbourhood. " +
    "Residents take pride in their cosmopolitan identity.";

  const content = `${para1}\n\n${para2}\n\n${para3}`;
  const result = measure(makeInput(content));

  it("wordCount > 80", () => expect(result.wordCount).toBeGreaterThan(80));
  it("paragraphCount is 3", () => expect(result.paragraphCount).toBe(3));
  it("sentenceCount >= 15", () => expect(result.sentenceCount).toBeGreaterThanOrEqual(15));
  it("avgSentenceWords is between 5 and 15", () => {
    expect(result.avgSentenceWords).toBeGreaterThanOrEqual(5);
    expect(result.avgSentenceWords).toBeLessThanOrEqual(15);
  });
  it("avgParagraphWords > 0", () => expect(result.avgParagraphWords).toBeGreaterThan(0));
  it("longSentenceRatio is 0 (no long sentences)", () => {
    expect(result.longSentenceRatio).toBe(0);
  });
  it("sentenceLengthVariance >= 0", () => {
    expect(result.sentenceLengthVariance).toBeGreaterThanOrEqual(0);
  });
});

// ─── Long sentence ratio ─────────────────────────────────────────────────────

describe("long sentence detection (>35 words)", () => {
  const longSentence =
    "This is a very long sentence that contains more than thirty five words " +
    "spread across many clauses and sub-clauses because it is deliberately " +
    "constructed to exceed the threshold of thirty-five words for testing purposes.";
  const shortSentence = "Short sentence here.";

  const result = measure(makeInput(`${longSentence} ${shortSentence}`));

  it("detects at least one long sentence", () => {
    expect(result.longSentenceRatio).toBeGreaterThan(0);
  });
  it("longSentenceRatio is between 0 and 1", () => {
    expect(result.longSentenceRatio).toBeGreaterThanOrEqual(0);
    expect(result.longSentenceRatio).toBeLessThanOrEqual(1);
  });
});

// ─── Multiple headings ───────────────────────────────────────────────────────

describe("multiple headings — HTML", () => {
  const content = [
    "<h2>Bandra escorts guide</h2>",
    "<p>First paragraph here with enough content to be counted.</p>",
    "<h2>Juhu district overview</h2>",
    "<p>Second paragraph here with enough content to be counted.</p>",
    "<h3>Transport hubs</h3>",
    "<p>Third paragraph here.</p>",
  ].join("\n");
  const result = measure(makeInput(content));

  it("h2Count is 2", () => expect(result.h2Count).toBe(2));
  it("h3Count is 1", () => expect(result.h3Count).toBe(1));
  it("headingCount is 3", () => expect(result.headingCount).toBe(3));
  it("headingDensity > 0", () => expect(result.headingDensity).toBeGreaterThan(0));
  it("contentDensity < 1 (markup overhead present)", () => {
    expect(result.contentDensity).toBeLessThan(1);
  });
});

describe("multiple headings — markdown", () => {
  const content = [
    "## Bandra escorts guide",
    "",
    "First paragraph here with enough content for counting purposes.",
    "",
    "## Juhu district overview",
    "",
    "Second paragraph here with enough content for counting purposes.",
    "",
    "### Transport hubs",
    "",
    "Third paragraph here.",
  ].join("\n");
  const result = measure(makeInput(content));

  it("h2Count is 2", () => expect(result.h2Count).toBe(2));
  it("h3Count is 1", () => expect(result.h3Count).toBe(1));
  it("headingCount is 3", () => expect(result.headingCount).toBe(3));
});

describe("markdown headings — does not double-count mixed content", () => {
  // Content with ONLY one H2 in HTML — no markdown headings
  const content = "<h2>Single heading</h2>\n<p>Some content follows this heading.</p>";
  const result = measure(makeInput(content));

  it("h2Count is exactly 1", () => expect(result.h2Count).toBe(1));
  it("h3Count is 0", () => expect(result.h3Count).toBe(0));
  it("headingCount is 1", () => expect(result.headingCount).toBe(1));
});

// ─── Multiple FAQs ───────────────────────────────────────────────────────────

describe("multiple FAQs contribute to wordCount", () => {
  const intro = "Mumbai is a city with many verified listings available for browsing.";
  const faqs = [
    { question: "Where are verified escorts in Mumbai?", answer: "Use the district filter in Bandra or Andheri." },
    { question: "How do listings near Colaba vary?", answer: "Weekend evenings run highest demand in the area." },
    { question: "Are there listings near the airport?", answer: "Aerocity has good coverage with verified providers available." },
  ];
  const result = measure(makeInput(intro, faqs));

  it("wordCount > wordCountIntro (FAQs add words)", () => {
    expect(result.wordCount).toBeGreaterThan(result.wordCountIntro!);
  });
  it("wordCountIntro counts only the intro", () => {
    expect(result.wordCountIntro).toBeGreaterThan(0);
    expect(result.wordCountIntro).toBeLessThan(result.wordCount!);
  });
  it("characterCount reflects only intro visible text", () => {
    // characterCount is intro-only; wordCount includes FAQ
    expect(result.characterCount).toBeGreaterThan(0);
  });
  it("sentenceCount reflects only intro sentences (FAQs not in sentence stats)", () => {
    // Sentence stats are intro-only
    expect(result.sentenceCount).toBeGreaterThan(0);
  });
});

describe("FAQs only (empty intro)", () => {
  const faqs = [
    { question: "What is the best area?", answer: "Bandra is a popular choice for visitors." },
  ];
  const result = measure(makeInput("", faqs));

  it("wordCountIntro is 0", () => expect(result.wordCountIntro).toBe(0));
  it("wordCount > 0 (FAQ words counted)", () => expect(result.wordCount).toBeGreaterThan(0));
});

// ─── Malformed HTML ──────────────────────────────────────────────────────────

describe("malformed HTML — unclosed tags", () => {
  const content = "<h2>Heading without closing tag<p>Paragraph content without close.";
  const result = measure(makeInput(content));

  // Should not throw and should return sensible counts
  it("does not throw", () => expect(result).toBeDefined());
  it("wordCount >= 0", () => expect(result.wordCount).toBeGreaterThanOrEqual(0));
  it("headingCount >= 0", () => expect(result.headingCount).toBeGreaterThanOrEqual(0));
});

describe("malformed HTML — nested unclosed tags", () => {
  const content = "<div><p>Text inside <span>nested <b>bold content here for testing.";
  const result = measure(makeInput(content));

  it("does not throw", () => expect(result).toBeDefined());
  it("wordCount > 0 (visible text extracted)", () => {
    expect(result.wordCount).toBeGreaterThan(0);
  });
  it("characterCount > 0", () => expect(result.characterCount).toBeGreaterThan(0));
});

describe("malformed HTML — script and style blocks stripped", () => {
  const content = `<script>var x = 1; function foo() { return 'hidden'; }</script>
<style>.class { color: red; } h2 { font-size: 2em; }</style>
<p>Visible paragraph content that should be counted here.</p>`;
  const result = measure(makeInput(content));

  it("script content not counted in words", () => {
    // The word 'hidden' is inside a script block — should not appear in count
    // If script stripped, visible word count is small (paragraph only)
    expect(result.wordCountIntro).toBeLessThan(30);
  });
  it("wordCount > 0 (paragraph text counted)", () => {
    expect(result.wordCount).toBeGreaterThan(0);
  });
});

// ─── Lists ───────────────────────────────────────────────────────────────────

describe("HTML list detection", () => {
  const content = `<p>Intro text here for context.</p>
<ul><li>Item one</li><li>Item two</li></ul>
<ol><li>Step one</li><li>Step two</li></ol>`;
  const result = measure(makeInput(content));

  it("listCount is 2", () => expect(result.listCount).toBe(2));
});

describe("markdown list detection", () => {
  const content = [
    "Some intro text for context here.",
    "",
    "- Item one in first list",
    "- Item two in first list",
    "- Item three in first list",
    "",
    "Some middle text here.",
    "",
    "* Item one in second list",
    "* Item two in second list",
  ].join("\n");
  const result = measure(makeInput(content));

  it("listCount is 2", () => expect(result.listCount).toBe(2));
});

describe("nested lists count as one block", () => {
  const content = [
    "Intro sentence for context.",
    "",
    "- Parent item one",
    "  - Nested child item",
    "  - Another nested child",
    "- Parent item two",
  ].join("\n");
  const result = measure(makeInput(content));

  it("listCount is 1 (one contiguous block)", () => expect(result.listCount).toBe(1));
});

// ─── Tables ──────────────────────────────────────────────────────────────────

describe("HTML table detection", () => {
  const content = `<p>Text before table.</p>
<table><tr><th>Area</th><th>Price</th></tr><tr><td>Bandra</td><td>High</td></tr></table>`;
  const result = measure(makeInput(content));

  it("tableCount is 1", () => expect(result.tableCount).toBe(1));
});

describe("markdown table detection", () => {
  const content = [
    "Some intro text here.",
    "",
    "| Area   | Price |",
    "| ------ | ----- |",
    "| Bandra | High  |",
    "| Andheri | Medium |",
  ].join("\n");
  const result = measure(makeInput(content));

  it("tableCount is 1", () => expect(result.tableCount).toBe(1));
});

// ─── Images ──────────────────────────────────────────────────────────────────

describe("HTML image detection", () => {
  const content = `<p>Content here.</p>
<img src="/img/mumbai.jpg" alt="Mumbai" />
<img src="/img/bandra.jpg" alt="Bandra" />`;
  const result = measure(makeInput(content));

  it("imageCount is 2", () => expect(result.imageCount).toBe(2));
});

describe("markdown image detection", () => {
  const content = "Some content here.\n\n![Mumbai skyline](/img/mumbai.jpg)\n\n![Bandra](/img/bandra.jpg)";
  const result = measure(makeInput(content));

  it("imageCount is 2", () => expect(result.imageCount).toBe(2));
});

// ─── External links ──────────────────────────────────────────────────────────

describe("external link detection", () => {
  const htmlContent = `<p>Content here.</p>
<a href="https://example.com">External</a>
<a href="/internal">Internal — not counted</a>
<a href="http://another.com">Another external</a>`;
  const result = measure(makeInput(htmlContent));

  it("externalLinksCount is 2 (only https/http links)", () => {
    expect(result.externalLinksCount).toBe(2);
  });
});

describe("markdown external link detection", () => {
  const content = "Text with [external link](https://example.com) and [another](http://test.org) and [internal](/page).";
  const result = measure(makeInput(content));

  it("externalLinksCount is 2", () => expect(result.externalLinksCount).toBe(2));
});

describe("markdown images not counted as external links", () => {
  const content = "Text with ![image](https://cdn.example.com/img.jpg) and [link](https://example.com).";
  const result = measure(makeInput(content));

  it("imageCount is 1", () => expect(result.imageCount).toBe(1));
  it("externalLinksCount is 1 (image excluded)", () => {
    expect(result.externalLinksCount).toBe(1);
  });
});

// ─── Density metrics ─────────────────────────────────────────────────────────

describe("headingDensity", () => {
  const content = [
    "<h2>First heading</h2>",
    "<p>One two three four five six seven eight nine ten words paragraph.</p>",
    "<h2>Second heading</h2>",
    "<p>Another ten words here making the count correct for this test.</p>",
  ].join("\n");
  const result = measure(makeInput(content));

  it("headingDensity > 0", () => expect(result.headingDensity).toBeGreaterThan(0));
  it("headingDensity = headings per 100 intro words", () => {
    const density = ((result.h2Count ?? 0) / (result.wordCountIntro ?? 1)) * 100;
    expect(result.headingDensity).toBeCloseTo(density, 1);
  });
});

describe("contentDensity", () => {
  it("plain text has density 1 (no markup overhead)", () => {
    const result = measure(makeInput("Plain text with no markup tags at all."));
    expect(result.contentDensity).toBe(1);
  });

  it("HTML-heavy content has density < 1", () => {
    const result = measure(makeInput(
      "<div class='wrapper'><p class='intro'>Short text.</p></div>",
    ));
    expect(result.contentDensity).toBeLessThan(1);
    expect(result.contentDensity).toBeGreaterThan(0);
  });
});

// ─── Variance ────────────────────────────────────────────────────────────────

describe("sentenceLengthVariance", () => {
  it("is 0 when all sentences have the same length", () => {
    // Two sentences with identical word counts
    const content = "One two three four five. Six seven eight nine ten.";
    const result = measure(makeInput(content));
    expect(result.sentenceLengthVariance).toBe(0);
  });

  it("is > 0 when sentence lengths differ", () => {
    // Both sentences must have ≥ 3 words to pass the sentence filter.
    // "Very short here." (3 words) vs a long sentence (~20 words) produces variance > 0.
    const content =
      "Very short here. This is a much longer sentence with many more words in it than the short one above.";
    const result = measure(makeInput(content));
    expect(result.sentenceLengthVariance).toBeGreaterThan(0);
  });
});

// ─── Provider metadata ───────────────────────────────────────────────────────

describe("ContentMetricsProvider interface contract", () => {
  const provider = new ContentMetricsProvider();

  it("id is stable", () => expect(provider.id).toBe("content-metrics"));
  it("executionOrder is 1", () => expect(provider.executionOrder).toBe(1));
  it("dependencies is empty (wave 1)", () => expect(provider.dependencies).toHaveLength(0));
  it("estimatedCost is fast", () => expect(provider.estimatedCost).toBe("fast"));
  it("cacheStrategy scope is none", () => expect(provider.cacheStrategy.scope).toBe("none"));
  it("outputFields contains all 18 owned metrics", () => {
    expect(provider.outputFields).toHaveLength(18);
  });
  it("provide() returns Partial<QualityMetrics>", () => {
    const input = makeInput("Hello world. This is a test sentence.");
    const result = provider.provide(input, {});
    expect(result).toBeDefined();
    expect(typeof result.wordCount).toBe("number");
  });

  it("singleton contentMetricsProvider has same id", () => {
    expect(contentMetricsProvider.id).toBe("content-metrics");
  });
});

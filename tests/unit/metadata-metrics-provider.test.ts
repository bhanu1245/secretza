import { describe, it, expect } from "vitest";
import {
  measure,
  estimatePixelWidth,
  parseJsonLd,
  extractSchemaTypes,
  parseRobotsDirectives,
} from "@/lib/seo-providers/metadata-metrics-provider";
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

// ─── estimatePixelWidth ───────────────────────────────────────────────────────

describe("estimatePixelWidth", () => {
  it("returns 0 for empty string", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });

  it("is larger for wide characters", () => {
    expect(estimatePixelWidth("MMMM")).toBeGreaterThan(estimatePixelWidth("iiii"));
  });

  it("scales with font size (doubles, within rounding)", () => {
    const at16 = estimatePixelWidth("Hello", 16);
    const at32 = estimatePixelWidth("Hello", 32);
    // Math.round introduces ±1 at each size; allow ±2 total
    expect(Math.abs(at32 - at16 * 2)).toBeLessThanOrEqual(2);
  });

  it("produces a reasonable range for a typical title", () => {
    // 60-char title should fall around 360–510 px at 16px
    const px = estimatePixelWidth("Escorts in Hyderabad | Find Premium Companions Today");
    expect(px).toBeGreaterThan(300);
    expect(px).toBeLessThan(700);
  });
});

// ─── parseJsonLd ─────────────────────────────────────────────────────────────

describe("parseJsonLd", () => {
  it("returns empty + parseable=false for null", () => {
    const r = parseJsonLd(null);
    expect(r.blocks).toHaveLength(0);
    expect(r.parseable).toBe(false);
  });

  it("returns empty + parseable=false for malformed JSON", () => {
    const r = parseJsonLd("{not valid json");
    expect(r.blocks).toHaveLength(0);
    expect(r.parseable).toBe(false);
  });

  it("parses a single object into one block", () => {
    const r = parseJsonLd(JSON.stringify({ "@type": "FAQPage", "name": "FAQ" }));
    expect(r.blocks).toHaveLength(1);
    expect(r.parseable).toBe(true);
  });

  it("parses a top-level array into multiple blocks", () => {
    const r = parseJsonLd(JSON.stringify([
      { "@type": "Organization" },
      { "@type": "WebSite" },
    ]));
    expect(r.blocks).toHaveLength(2);
    expect(r.parseable).toBe(true);
  });

  it("unwraps @graph wrapper", () => {
    const r = parseJsonLd(JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization" },
        { "@type": "BreadcrumbList" },
      ],
    }));
    expect(r.blocks).toHaveLength(2);
    expect(r.parseable).toBe(true);
  });
});

// ─── extractSchemaTypes ───────────────────────────────────────────────────────

describe("extractSchemaTypes", () => {
  it("returns empty for empty blocks", () => {
    expect(extractSchemaTypes([])).toHaveLength(0);
  });

  it("extracts string @type", () => {
    expect(extractSchemaTypes([{ "@type": "FAQPage" }])).toContain("FAQPage");
  });

  it("extracts array @type entries", () => {
    const types = extractSchemaTypes([{ "@type": ["Article", "NewsArticle"] }]);
    expect(types).toContain("Article");
    expect(types).toContain("NewsArticle");
  });

  it("skips blocks without @type", () => {
    expect(extractSchemaTypes([{ name: "test" }])).toHaveLength(0);
  });
});

// ─── parseRobotsDirectives ────────────────────────────────────────────────────

describe("parseRobotsDirectives", () => {
  it("returns false/false for null", () => {
    const r = parseRobotsDirectives(null);
    expect(r.noindex).toBe(false);
    expect(r.nofollow).toBe(false);
  });

  it("detects noindex", () => {
    expect(parseRobotsDirectives("noindex").noindex).toBe(true);
    expect(parseRobotsDirectives("noindex").nofollow).toBe(false);
  });

  it("detects nofollow", () => {
    expect(parseRobotsDirectives("nofollow").nofollow).toBe(true);
  });

  it("detects both in comma-separated value", () => {
    const r = parseRobotsDirectives("noindex, nofollow");
    expect(r.noindex).toBe(true);
    expect(r.nofollow).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(parseRobotsDirectives("NOINDEX, NOFOLLOW").noindex).toBe(true);
  });
});

// ─── measure — empty metadata ─────────────────────────────────────────────────

describe("measure — empty metadata", () => {
  it("returns all absent/zero for empty input", () => {
    const r = measure(makeInput());

    expect(r.titlePresent).toBe(false);
    expect(r.titleLength).toBe(0);
    expect(r.estimatedTitlePixelWidth).toBe(0);
    expect(r.metaPresent).toBe(false);
    expect(r.metaLength).toBe(0);
    expect(r.metaDescriptionPixelWidth).toBe(0);
    expect(r.h1Present).toBe(false);
    expect(r.h1Count).toBe(0);
    expect(r.h1EqualsTitle).toBe(false);
    expect(r.canonicalPresent).toBe(false);
    expect(r.featuredImagePresent).toBe(false);
    expect(r.imageAltPresent).toBe(false);
    expect(r.robotsMetaExists).toBe(false);
    expect(r.robotsMetaContent).toBeNull();
    expect(r.robotsNoindex).toBe(false);
    expect(r.robotsNofollow).toBe(false);
    expect(r.openGraphExists).toBe(false);
    expect(r.openGraphPropertyCount).toBe(0);
    expect(r.twitterCardExists).toBe(false);
    expect(r.twitterMetaCount).toBe(0);
    expect(r.structuredDataPresent).toBe(false);
    expect(r.structuredDataParseable).toBe(false);
    expect(r.jsonLdCount).toBe(0);
    expect(r.schemaTypeList).toBeNull();
    expect(r.breadcrumbSchemaExists).toBe(false);
    expect(r.organizationSchemaExists).toBe(false);
    expect(r.websiteSchemaExists).toBe(false);
    expect(r.faqSchemaExists).toBe(false);
    expect(r.articleSchemaExists).toBe(false);
    expect(r.hreflangExists).toBe(false);
    expect(r.hreflangCount).toBe(0);
    expect(r.alternateLinkCount).toBe(0);
    expect(r.viewportMetaExists).toBe(false);
    expect(r.charsetMetaExists).toBe(false);
    expect(r.faviconExists).toBe(false);
    expect(r.manifestExists).toBe(false);
  });
});

// ─── measure — title only ─────────────────────────────────────────────────────

describe("measure — title only", () => {
  const title = "Escorts in Hyderabad | Premium Companions";

  it("marks title as present", () => {
    const r = measure(makeInput({ title }));
    expect(r.titlePresent).toBe(true);
  });

  it("measures title length accurately", () => {
    const r = measure(makeInput({ title }));
    expect(r.titleLength).toBe(title.length);
  });

  it("produces a positive pixel width", () => {
    const r = measure(makeInput({ title }));
    expect(r.estimatedTitlePixelWidth).toBeGreaterThan(0);
  });

  it("h1EqualsTitle is false when h1 is absent", () => {
    const r = measure(makeInput({ title }));
    expect(r.h1EqualsTitle).toBe(false);
  });
});

// ─── measure — title + description ───────────────────────────────────────────

describe("measure — title + meta description", () => {
  const title = "Escorts in Hyderabad";
  const meta  = "Find top-rated companions in Hyderabad. Professional and discreet.";

  it("reports both as present", () => {
    const r = measure(makeInput({ title, metaDescription: meta }));
    expect(r.titlePresent).toBe(true);
    expect(r.metaPresent).toBe(true);
  });

  it("reports correct meta length", () => {
    const r = measure(makeInput({ title, metaDescription: meta }));
    expect(r.metaLength).toBe(meta.length);
  });

  it("meta pixel width is positive", () => {
    const r = measure(makeInput({ title, metaDescription: meta }));
    expect(r.metaDescriptionPixelWidth).toBeGreaterThan(0);
  });

  it("meta pixel width is greater for longer text", () => {
    const rShort = measure(makeInput({ metaDescription: "Short." }));
    const rLong  = measure(makeInput({ metaDescription: meta }));
    expect(rLong.metaDescriptionPixelWidth!).toBeGreaterThan(rShort.metaDescriptionPixelWidth!);
  });
});

// ─── measure — H1 ────────────────────────────────────────────────────────────

describe("measure — H1", () => {
  it("reports h1Present and h1Count=1 when h1 exists", () => {
    const r = measure(makeInput({ h1: "Escorts in Hyderabad" }));
    expect(r.h1Present).toBe(true);
    expect(r.h1Count).toBe(1);
  });

  it("h1EqualsTitle true when h1 matches title (case-insensitive, trimmed)", () => {
    const r = measure(makeInput({
      title: "Escorts in Hyderabad",
      h1:    "escorts in hyderabad",
    }));
    expect(r.h1EqualsTitle).toBe(true);
  });

  it("h1EqualsTitle false when h1 differs from title", () => {
    const r = measure(makeInput({
      title: "Escorts in Hyderabad",
      h1:    "Hyderabad Escorts Guide",
    }));
    expect(r.h1EqualsTitle).toBe(false);
  });
});

// ─── measure — canonical ──────────────────────────────────────────────────────

describe("measure — canonical", () => {
  it("canonicalPresent true when URL is provided", () => {
    const r = measure(makeInput({ canonicalUrl: "https://secretza.com/escorts/hyderabad" }));
    expect(r.canonicalPresent).toBe(true);
  });

  it("canonicalPresent false when null", () => {
    const r = measure(makeInput({ canonicalUrl: null }));
    expect(r.canonicalPresent).toBe(false);
  });

  it("canonicalPresent false for empty string", () => {
    const r = measure(makeInput({ canonicalUrl: "" }));
    expect(r.canonicalPresent).toBe(false);
  });
});

// ─── measure — robots directives ──────────────────────────────────────────────

describe("measure — robots meta", () => {
  it("detects robotsMetaExists for any content string", () => {
    const r = measure(makeInput({ robots: "index, follow" }));
    expect(r.robotsMetaExists).toBe(true);
    expect(r.robotsMetaContent).toBe("index, follow");
  });

  it("robotsNoindex true for noindex directive", () => {
    const r = measure(makeInput({ robots: "noindex" }));
    expect(r.robotsNoindex).toBe(true);
    expect(r.robotsNofollow).toBe(false);
  });

  it("robotsNofollow true for nofollow directive", () => {
    const r = measure(makeInput({ robots: "nofollow" }));
    expect(r.robotsNofollow).toBe(true);
  });

  it("both flags for noindex, nofollow", () => {
    const r = measure(makeInput({ robots: "noindex, nofollow" }));
    expect(r.robotsNoindex).toBe(true);
    expect(r.robotsNofollow).toBe(true);
  });

  it("robots meta absent when not provided", () => {
    const r = measure(makeInput());
    expect(r.robotsMetaExists).toBe(false);
    expect(r.robotsMetaContent).toBeNull();
  });
});

// ─── measure — Open Graph ────────────────────────────────────────────────────

describe("measure — Open Graph tags", () => {
  const ogTags = {
    "og:title":       "Escorts in Hyderabad",
    "og:description": "Premium companions.",
    "og:image":       "https://cdn.example.com/og.jpg",
    "og:url":         "https://secretza.com/escorts/hyderabad",
  };

  it("openGraphExists true when tags are provided", () => {
    const r = measure(makeInput({ openGraphTags: ogTags }));
    expect(r.openGraphExists).toBe(true);
  });

  it("openGraphPropertyCount equals number of og tags", () => {
    const r = measure(makeInput({ openGraphTags: ogTags }));
    expect(r.openGraphPropertyCount).toBe(4);
  });

  it("openGraphExists false when not provided", () => {
    const r = measure(makeInput());
    expect(r.openGraphExists).toBe(false);
    expect(r.openGraphPropertyCount).toBe(0);
  });

  it("openGraphExists false for empty object", () => {
    const r = measure(makeInput({ openGraphTags: {} }));
    expect(r.openGraphExists).toBe(false);
  });
});

// ─── measure — Twitter card ───────────────────────────────────────────────────

describe("measure — Twitter tags", () => {
  const twTags = {
    "twitter:card":        "summary_large_image",
    "twitter:title":       "Escorts in Hyderabad",
    "twitter:description": "Premium companions.",
  };

  it("twitterCardExists true when tags are provided", () => {
    const r = measure(makeInput({ twitterTags: twTags }));
    expect(r.twitterCardExists).toBe(true);
  });

  it("twitterMetaCount equals number of twitter tags", () => {
    const r = measure(makeInput({ twitterTags: twTags }));
    expect(r.twitterMetaCount).toBe(3);
  });

  it("twitterCardExists false when not provided", () => {
    const r = measure(makeInput());
    expect(r.twitterCardExists).toBe(false);
    expect(r.twitterMetaCount).toBe(0);
  });
});

// ─── measure — JSON-LD: FAQ schema ───────────────────────────────────────────

describe("measure — JSON-LD FAQ schema", () => {
  const faqLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [],
  });

  it("structuredDataPresent and parseable", () => {
    const r = measure(makeInput({ structuredData: faqLd }));
    expect(r.structuredDataPresent).toBe(true);
    expect(r.structuredDataParseable).toBe(true);
  });

  it("faqSchemaExists true", () => {
    const r = measure(makeInput({ structuredData: faqLd }));
    expect(r.faqSchemaExists).toBe(true);
  });

  it("jsonLdCount is 1", () => {
    const r = measure(makeInput({ structuredData: faqLd }));
    expect(r.jsonLdCount).toBe(1);
  });

  it("schemaTypeList contains FAQPage", () => {
    const r = measure(makeInput({ structuredData: faqLd }));
    expect(r.schemaTypeList).toContain("FAQPage");
  });
});

// ─── measure — JSON-LD: Breadcrumb schema ────────────────────────────────────

describe("measure — JSON-LD Breadcrumb schema", () => {
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [],
  });

  it("breadcrumbSchemaExists true", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.breadcrumbSchemaExists).toBe(true);
  });

  it("other schema flags remain false", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.organizationSchemaExists).toBe(false);
    expect(r.faqSchemaExists).toBe(false);
  });
});

// ─── measure — JSON-LD: Organization schema ──────────────────────────────────

describe("measure — JSON-LD Organization schema", () => {
  const ld = JSON.stringify({ "@type": "Organization", "name": "Secretza" });

  it("organizationSchemaExists true", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.organizationSchemaExists).toBe(true);
  });
});

// ─── measure — JSON-LD: Website schema ───────────────────────────────────────

describe("measure — JSON-LD Website schema", () => {
  const ld = JSON.stringify({ "@type": "WebSite", "url": "https://secretza.com" });

  it("websiteSchemaExists true", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.websiteSchemaExists).toBe(true);
  });
});

// ─── measure — JSON-LD: Article schema ───────────────────────────────────────

describe("measure — JSON-LD Article schema variants", () => {
  it("articleSchemaExists true for Article", () => {
    const r = measure(makeInput({ structuredData: JSON.stringify({ "@type": "Article" }) }));
    expect(r.articleSchemaExists).toBe(true);
  });

  it("articleSchemaExists true for NewsArticle", () => {
    const r = measure(makeInput({ structuredData: JSON.stringify({ "@type": "NewsArticle" }) }));
    expect(r.articleSchemaExists).toBe(true);
  });

  it("articleSchemaExists true for BlogPosting", () => {
    const r = measure(makeInput({ structuredData: JSON.stringify({ "@type": "BlogPosting" }) }));
    expect(r.articleSchemaExists).toBe(true);
  });
});

// ─── measure — JSON-LD: multiple schema types ────────────────────────────────

describe("measure — JSON-LD multiple schema types", () => {
  const ld = JSON.stringify([
    { "@type": "Organization", "name": "Secretza" },
    { "@type": "WebSite",      "url":  "https://secretza.com" },
    { "@type": "FAQPage",      "mainEntity": [] },
    { "@type": "BreadcrumbList", "itemListElement": [] },
  ]);

  it("jsonLdCount is 4", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.jsonLdCount).toBe(4);
  });

  it("all schema flags true", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.organizationSchemaExists).toBe(true);
    expect(r.websiteSchemaExists).toBe(true);
    expect(r.faqSchemaExists).toBe(true);
    expect(r.breadcrumbSchemaExists).toBe(true);
  });

  it("schemaTypeList contains all types", () => {
    const r = measure(makeInput({ structuredData: ld }));
    expect(r.schemaTypeList).toContain("Organization");
    expect(r.schemaTypeList).toContain("WebSite");
    expect(r.schemaTypeList).toContain("FAQPage");
    expect(r.schemaTypeList).toContain("BreadcrumbList");
  });
});

// ─── measure — malformed metadata ────────────────────────────────────────────

describe("measure — malformed JSON-LD", () => {
  it("structuredDataPresent true but parseable false for malformed JSON", () => {
    const r = measure(makeInput({ structuredData: "{invalid json" }));
    expect(r.structuredDataPresent).toBe(true);
    expect(r.structuredDataParseable).toBe(false);
    expect(r.jsonLdCount).toBe(0);
    expect(r.schemaTypeList).toBeNull();
  });

  it("all schema flags false when JSON-LD is malformed", () => {
    const r = measure(makeInput({ structuredData: "{bad" }));
    expect(r.faqSchemaExists).toBe(false);
    expect(r.breadcrumbSchemaExists).toBe(false);
    expect(r.organizationSchemaExists).toBe(false);
  });
});

// ─── measure — hreflang entries ───────────────────────────────────────────────

describe("measure — hreflang entries", () => {
  const hreflangEntries = [
    { lang: "en", href: "https://secretza.com/en/escorts/hyderabad" },
    { lang: "hi", href: "https://secretza.com/hi/escorts/hyderabad" },
    { lang: "x-default", href: "https://secretza.com/escorts/hyderabad" },
  ];

  it("hreflangExists true when entries provided", () => {
    const r = measure(makeInput({ hreflangEntries }));
    expect(r.hreflangExists).toBe(true);
  });

  it("hreflangCount equals entry count", () => {
    const r = measure(makeInput({ hreflangEntries }));
    expect(r.hreflangCount).toBe(3);
  });

  it("hreflangExists false when not provided", () => {
    const r = measure(makeInput());
    expect(r.hreflangExists).toBe(false);
    expect(r.hreflangCount).toBe(0);
  });
});

// ─── measure — alternate links ────────────────────────────────────────────────

describe("measure — alternate links", () => {
  it("alternateLinkCount reflects provided links", () => {
    const r = measure(makeInput({
      alternateLinks: [
        { rel: "alternate", href: "https://secretza.com/amp/escorts/hyderabad" },
      ],
    }));
    expect(r.alternateLinkCount).toBe(1);
  });

  it("alternateLinkCount is 0 when not provided", () => {
    const r = measure(makeInput());
    expect(r.alternateLinkCount).toBe(0);
  });
});

// ─── measure — technical page signals ────────────────────────────────────────

describe("measure — technical page signals", () => {
  const fullTech: Partial<MetricsCollectorInput> = {
    viewportMeta: "width=device-width, initial-scale=1",
    charsetMeta:  "UTF-8",
    faviconHref:  "/favicon.ico",
    manifestHref: "/manifest.webmanifest",
  };

  it("all technical signals detected when present", () => {
    const r = measure(makeInput(fullTech));
    expect(r.viewportMetaExists).toBe(true);
    expect(r.charsetMetaExists).toBe(true);
    expect(r.faviconExists).toBe(true);
    expect(r.manifestExists).toBe(true);
  });

  it("all false when not provided", () => {
    const r = measure(makeInput());
    expect(r.viewportMetaExists).toBe(false);
    expect(r.charsetMetaExists).toBe(false);
    expect(r.faviconExists).toBe(false);
    expect(r.manifestExists).toBe(false);
  });

  it("false for empty-string values", () => {
    const r = measure(makeInput({
      viewportMeta: "",
      charsetMeta:  "",
      faviconHref:  "",
      manifestHref: "",
    }));
    expect(r.viewportMetaExists).toBe(false);
    expect(r.charsetMetaExists).toBe(false);
    expect(r.faviconExists).toBe(false);
    expect(r.manifestExists).toBe(false);
  });
});

// ─── measure — fully populated page ──────────────────────────────────────────

describe("measure — fully populated page", () => {
  const input = makeInput({
    title:           "Escorts in Hyderabad | Secretza",
    metaDescription: "Find top-rated escorts in Hyderabad. Professional, discreet service.",
    h1:              "Escorts in Hyderabad | Secretza",
    canonicalUrl:    "https://secretza.com/escorts/hyderabad",
    featuredImage:   "https://cdn.secretza.com/hyderabad.jpg",
    imageAlt:        "Escorts in Hyderabad",
    structuredData:  JSON.stringify([
      { "@type": "FAQPage",        "mainEntity": [] },
      { "@type": "BreadcrumbList", "itemListElement": [] },
    ]),
    robots:          "index, follow",
    openGraphTags: {
      "og:title":       "Escorts in Hyderabad",
      "og:description": "Premium companions.",
      "og:image":       "https://cdn.secretza.com/og.jpg",
    },
    twitterTags: {
      "twitter:card":  "summary_large_image",
      "twitter:title": "Escorts in Hyderabad",
    },
    hreflangEntries: [{ lang: "en", href: "https://secretza.com/en/escorts/hyderabad" }],
    alternateLinks:  [{ rel: "alternate", href: "https://secretza.com/amp/escorts/hyderabad" }],
    viewportMeta:    "width=device-width, initial-scale=1",
    charsetMeta:     "UTF-8",
    faviconHref:     "/favicon.ico",
    manifestHref:    "/manifest.webmanifest",
  });

  it("all presence flags are true", () => {
    const r = measure(input);
    expect(r.titlePresent).toBe(true);
    expect(r.metaPresent).toBe(true);
    expect(r.h1Present).toBe(true);
    expect(r.canonicalPresent).toBe(true);
    expect(r.featuredImagePresent).toBe(true);
    expect(r.imageAltPresent).toBe(true);
    expect(r.robotsMetaExists).toBe(true);
    expect(r.openGraphExists).toBe(true);
    expect(r.twitterCardExists).toBe(true);
    expect(r.structuredDataPresent).toBe(true);
    expect(r.structuredDataParseable).toBe(true);
    expect(r.hreflangExists).toBe(true);
    expect(r.viewportMetaExists).toBe(true);
    expect(r.charsetMetaExists).toBe(true);
    expect(r.faviconExists).toBe(true);
    expect(r.manifestExists).toBe(true);
  });

  it("h1EqualsTitle true for identical title and H1", () => {
    const r = measure(input);
    expect(r.h1EqualsTitle).toBe(true);
  });

  it("schema flags reflect JSON-LD content", () => {
    const r = measure(input);
    expect(r.faqSchemaExists).toBe(true);
    expect(r.breadcrumbSchemaExists).toBe(true);
    expect(r.organizationSchemaExists).toBe(false);
  });

  it("counts are accurate", () => {
    const r = measure(input);
    expect(r.openGraphPropertyCount).toBe(3);
    expect(r.twitterMetaCount).toBe(2);
    expect(r.jsonLdCount).toBe(2);
    expect(r.hreflangCount).toBe(1);
    expect(r.alternateLinkCount).toBe(1);
  });

  it("all numeric metrics are finite and non-negative", () => {
    const r = measure(input);
    const numericFields = [
      r.titleLength,
      r.estimatedTitlePixelWidth,
      r.metaLength,
      r.metaDescriptionPixelWidth,
      r.h1Count,
      r.openGraphPropertyCount,
      r.twitterMetaCount,
      r.jsonLdCount,
      r.hreflangCount,
      r.alternateLinkCount,
    ];
    for (const val of numericFields) {
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});

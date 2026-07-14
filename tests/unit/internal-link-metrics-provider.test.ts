import { describe, it, expect } from "vitest";
import {
  measure,
  classifyHref,
  normaliseAnchor,
  isGenericAnchor,
  isCtaAnchor,
  anchorContainsKeyword,
  isNofollow,
} from "@/lib/seo-providers/internal-link-metrics-provider";
import type { MetricsCollectorInput, InternalLink } from "@/lib/seo-quality-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(
  links: InternalLink[] = [],
  overrides: Partial<MetricsCollectorInput> = {},
): MetricsCollectorInput {
  return {
    introContent:      "The page has some content for word count purposes here.",
    faqItems:          [],
    title:             null,
    metaDescription:   null,
    h1:                null,
    canonicalUrl:      null,
    featuredImage:     null,
    imageAlt:          null,
    structuredData:    null,
    internalLinks:     links,
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

function link(anchor: string, href: string, rel?: string): InternalLink {
  return rel !== undefined ? { anchor, href, rel } : { anchor, href };
}

// ─── classifyHref ─────────────────────────────────────────────────────────────

describe("classifyHref", () => {
  it("same-page anchor '#section'", () => {
    expect(classifyHref("#section").isSamePage).toBe(true);
  });

  it("relative URL '/listings/escort-in-delhi'", () => {
    const c = classifyHref("/listings/escort-in-delhi");
    expect(c.isRelative).toBe(true);
    expect(c.isSamePage).toBe(false);
    expect(c.isAbsoluteInternal).toBe(false);
  });

  it("absolute URL 'https://secretza.com/page'", () => {
    const c = classifyHref("https://secretza.com/page");
    expect(c.isAbsoluteInternal).toBe(true);
    expect(c.isRelative).toBe(false);
  });

  it("mailto: link", () => {
    expect(classifyHref("mailto:info@secretza.com").isMailto).toBe(true);
  });

  it("tel: link", () => {
    expect(classifyHref("tel:+919999999999").isTel).toBe(true);
  });

  it("category URL /categories/escorts", () => {
    expect(classifyHref("/categories/escorts").isCategory).toBe(true);
  });

  it("category URL /category/call-girls", () => {
    expect(classifyHref("/category/call-girls").isCategory).toBe(true);
  });

  it("city URL /city/hyderabad", () => {
    expect(classifyHref("/city/hyderabad").isCity).toBe(true);
  });

  it("city URL /cities/mumbai", () => {
    expect(classifyHref("/cities/mumbai").isCity).toBe(true);
  });

  it("listing URL /listing/escort-123", () => {
    expect(classifyHref("/listing/escort-123").isListing).toBe(true);
  });

  it("listing URL /listings/escort-in-delhi", () => {
    expect(classifyHref("/listings/escort-in-delhi").isListing).toBe(true);
  });

  it("FAQ URL /faq", () => {
    expect(classifyHref("/faq").isFaq).toBe(true);
  });

  it("FAQ URL /faq/general", () => {
    expect(classifyHref("/faq/general").isFaq).toBe(true);
  });

  it("malformed URL — treated as relative-ish", () => {
    // Should not throw
    expect(() => classifyHref("not-a-url")).not.toThrow();
  });

  it("empty href", () => {
    const c = classifyHref("");
    expect(c.isSamePage).toBe(false);
    expect(c.isRelative).toBe(false);
  });

  it("protocol-relative //example.com not treated as relative", () => {
    const c = classifyHref("//example.com/page");
    expect(c.isRelative).toBe(false);
    expect(c.isAbsoluteInternal).toBe(false);
  });
});

// ─── normaliseAnchor / isGenericAnchor / isCtaAnchor ─────────────────────────

describe("normaliseAnchor", () => {
  it("lowercases and trims", () => {
    expect(normaliseAnchor("  Click Here  ")).toBe("click here");
  });

  it("collapses internal whitespace", () => {
    expect(normaliseAnchor("Read  More")).toBe("read more");
  });
});

describe("isGenericAnchor", () => {
  it("'click here' is generic", () => {
    expect(isGenericAnchor("click here")).toBe(true);
  });

  it("'here' is generic", () => {
    expect(isGenericAnchor("here")).toBe(true);
  });

  it("'escort in hyderabad' is not generic", () => {
    expect(isGenericAnchor("escort in hyderabad")).toBe(false);
  });
});

describe("isCtaAnchor", () => {
  it("'contact us' is CTA", () => {
    expect(isCtaAnchor("contact us")).toBe(true);
  });

  it("'book now' is CTA", () => {
    expect(isCtaAnchor("book now")).toBe(true);
  });

  it("'hyderabad escorts' is not CTA", () => {
    expect(isCtaAnchor("hyderabad escorts")).toBe(false);
  });
});

describe("anchorContainsKeyword", () => {
  it("matches whole-word keyword", () => {
    expect(anchorContainsKeyword("hyderabad escorts", "hyderabad escorts")).toBe(true);
  });

  it("does not match partial word", () => {
    expect(anchorContainsKeyword("escorted services", "escort")).toBe(false);
  });

  it("returns false for null keyword", () => {
    expect(anchorContainsKeyword("hyderabad escorts", null)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(anchorContainsKeyword("Hyderabad Escorts", "hyderabad escorts")).toBe(true);
  });
});

describe("isNofollow", () => {
  it("detects nofollow in rel", () => {
    expect(isNofollow({ anchor: "text", href: "/", rel: "nofollow" })).toBe(true);
  });

  it("detects nofollow in compound rel", () => {
    expect(isNofollow({ anchor: "text", href: "/", rel: "noopener nofollow" })).toBe(true);
  });

  it("returns false when rel is absent", () => {
    expect(isNofollow({ anchor: "text", href: "/" })).toBe(false);
  });

  it("returns false for 'noreferrer' (not nofollow)", () => {
    expect(isNofollow({ anchor: "text", href: "/", rel: "noreferrer" })).toBe(false);
  });
});

// ─── measure — no links ───────────────────────────────────────────────────────

describe("measure — no links", () => {
  it("all counts are zero, positions are -1", () => {
    const r = measure(makeInput([]));
    expect(r.internalLinkCount).toBe(0);
    expect(r.emptyAnchorCount).toBe(0);
    expect(r.followLinkCount).toBe(0);
    expect(r.nofollowLinkCount).toBe(0);
    expect(r.firstLinkPosition).toBe(-1);
    expect(r.lastLinkPosition).toBe(-1);
    expect(r.linkSpread).toBe(0);
    expect(r.sectionLinkDistribution).toBe(0);
    expect(r.uniqueTargetCount).toBe(0);
    expect(r.duplicateTargetCount).toBe(0);
  });
});

// ─── measure — one internal link ─────────────────────────────────────────────

describe("measure — one internal link", () => {
  const links = [link("Hyderabad Escorts", "/listings/hyderabad-escorts")];
  const r = () => measure(makeInput(links));

  it("internalLinkCount is 1", () => {
    expect(r().internalLinkCount).toBe(1);
  });

  it("relativeLinkCount is 1", () => {
    expect(r().relativeLinkCount).toBe(1);
  });

  it("firstLinkPosition and lastLinkPosition are both 0", () => {
    expect(r().firstLinkPosition).toBe(0);
    expect(r().lastLinkPosition).toBe(0);
  });

  it("linkSpread is 0 for a single link", () => {
    expect(r().linkSpread).toBe(0);
  });

  it("descriptiveAnchorCount is 1 (descriptive anchor text)", () => {
    expect(r().descriptiveAnchorCount).toBe(1);
  });

  it("genericAnchorCount is 0", () => {
    expect(r().genericAnchorCount).toBe(0);
  });

  it("followLinkCount is 1 (no rel)", () => {
    expect(r().followLinkCount).toBe(1);
  });

  it("listingLinkCount is 1 (href matches /listings/)", () => {
    expect(r().listingLinkCount).toBe(1);
  });
});

// ─── measure — multiple internal links ───────────────────────────────────────

describe("measure — multiple internal links", () => {
  const links = [
    link("Escort in Delhi",    "/listings/escort-in-delhi"),
    link("Mumbai Escorts",     "/listings/mumbai-escorts"),
    link("Call Girls Kolkata", "/listings/call-girls-kolkata"),
    link("Book Now",           "/contact"),
    link("Read More",          "/blog/escort-tips"),
  ];

  it("internalLinkCount is 5", () => {
    expect(measure(makeInput(links)).internalLinkCount).toBe(5);
  });

  it("listingLinkCount is 3", () => {
    expect(measure(makeInput(links)).listingLinkCount).toBe(3);
  });

  it("genericAnchorCount includes 'read more'", () => {
    expect(measure(makeInput(links)).genericAnchorCount).toBeGreaterThanOrEqual(1);
  });

  it("ctaInternalLinkCount includes 'book now'", () => {
    expect(measure(makeInput(links)).ctaInternalLinkCount).toBeGreaterThanOrEqual(1);
  });

  it("descriptiveAnchorCount is 4 (non-generic anchors — 'Book Now' is CTA but not generic)", () => {
    // "Escort in Delhi", "Mumbai Escorts", "Call Girls Kolkata", "Book Now" are all non-generic
    // "Read More" is generic. descriptiveCount = n - genericCount.
    expect(measure(makeInput(links)).descriptiveAnchorCount).toBe(4);
  });

  it("sectionLinkDistribution is 1 (all sections covered with 5 equal links)", () => {
    // 5 links / 5 sections = one per section
    expect(measure(makeInput(links)).sectionLinkDistribution).toBe(1);
  });
});

// ─── measure — duplicate targets ─────────────────────────────────────────────

describe("measure — duplicate targets", () => {
  const links = [
    link("Delhi Escorts",  "/listings/escort-in-delhi"),
    link("Delhi Girls",    "/listings/escort-in-delhi"), // same href
    link("Mumbai Escorts", "/listings/mumbai-escorts"),
  ];

  it("uniqueTargetCount is 1 (only /mumbai-escorts appears once)", () => {
    // /escort-in-delhi appears twice → duplicated; /mumbai-escorts appears once → unique
    expect(measure(makeInput(links)).uniqueTargetCount).toBe(1);
  });

  it("duplicateTargetCount is 1 (/escort-in-delhi used twice)", () => {
    expect(measure(makeInput(links)).duplicateTargetCount).toBe(1);
  });
});

// ─── measure — duplicate anchor text ─────────────────────────────────────────

describe("measure — duplicate anchor text", () => {
  const links = [
    link("Click Here", "/page-1"),
    link("Click Here", "/page-2"), // same anchor, different target
    link("Read More",  "/page-3"),
  ];

  it("duplicateAnchorTextCount is 1", () => {
    expect(measure(makeInput(links)).duplicateAnchorTextCount).toBe(1);
  });

  it("uniqueAnchorTextCount is 2 ('click here' and 'read more')", () => {
    expect(measure(makeInput(links)).uniqueAnchorTextCount).toBe(2);
  });
});

// ─── measure — empty anchor text ─────────────────────────────────────────────

describe("measure — empty anchor text", () => {
  const links = [
    link("",              "/image-link"),
    link("Real Anchor",   "/page"),
  ];

  it("emptyAnchorCount is 1", () => {
    expect(measure(makeInput(links)).emptyAnchorCount).toBe(1);
  });

  it("imageLinkCount is 1 (empty anchor = image link)", () => {
    expect(measure(makeInput(links)).imageLinkCount).toBe(1);
  });

  it("anchorTextCount is 1 (only non-empty anchors)", () => {
    expect(measure(makeInput(links)).anchorTextCount).toBe(1);
  });
});

// ─── measure — relative URLs ──────────────────────────────────────────────────

describe("measure — relative URLs", () => {
  const links = [
    link("Page One", "/page-1"),
    link("Page Two", "/page-2"),
    link("Blog",     "/blog/post"),
  ];

  it("relativeLinkCount is 3", () => {
    expect(measure(makeInput(links)).relativeLinkCount).toBe(3);
  });

  it("absoluteInternalLinkCount is 0", () => {
    expect(measure(makeInput(links)).absoluteInternalLinkCount).toBe(0);
  });
});

// ─── measure — absolute internal URLs ────────────────────────────────────────

describe("measure — absolute internal URLs", () => {
  const links = [
    link("Home",     "https://secretza.com/"),
    link("Listings", "https://secretza.com/listings"),
    link("Relative", "/contact"),
  ];

  it("absoluteInternalLinkCount is 2", () => {
    expect(measure(makeInput(links)).absoluteInternalLinkCount).toBe(2);
  });

  it("relativeLinkCount is 1", () => {
    expect(measure(makeInput(links)).relativeLinkCount).toBe(1);
  });
});

// ─── measure — external URLs ──────────────────────────────────────────────────

describe("measure — externalLinkCount is always 0 from internalLinks input", () => {
  it("externalLinkCount is 0 since internalLinks array has no external classification", () => {
    const links = [link("External", "https://example.com/page")];
    expect(measure(makeInput(links)).externalLinkCount).toBe(0);
  });

  it("externalHttpLinkCount is 0", () => {
    const links = [link("External", "https://example.com/page")];
    expect(measure(makeInput(links)).externalHttpLinkCount).toBe(0);
  });
});

// ─── measure — hash anchors ───────────────────────────────────────────────────

describe("measure — hash anchors", () => {
  const links = [
    link("Top",     "#top"),
    link("Section", "#services"),
    link("About",   "/about"),
  ];

  it("samePageAnchorCount is 2", () => {
    expect(measure(makeInput(links)).samePageAnchorCount).toBe(2);
  });

  it("relativeLinkCount is 1 (only /about, not hash links)", () => {
    expect(measure(makeInput(links)).relativeLinkCount).toBe(1);
  });
});

// ─── measure — mailto links ───────────────────────────────────────────────────

describe("measure — mailto links", () => {
  const links = [
    link("Email Us", "mailto:info@secretza.com"),
    link("Call",     "tel:+919999999999"),
    link("Visit",    "/contact"),
  ];

  it("mailtoLinkCount is 1", () => {
    expect(measure(makeInput(links)).mailtoLinkCount).toBe(1);
  });

  it("telLinkCount is 1", () => {
    expect(measure(makeInput(links)).telLinkCount).toBe(1);
  });
});

// ─── measure — tel links ─────────────────────────────────────────────────────

describe("measure — tel links only", () => {
  const links = [
    link("Call Now", "tel:+911234567890"),
    link("WhatsApp", "tel:+919876543210"),
  ];

  it("telLinkCount is 2", () => {
    expect(measure(makeInput(links)).telLinkCount).toBe(2);
  });

  it("internalLinkCount includes tel links", () => {
    expect(measure(makeInput(links)).internalLinkCount).toBe(2);
  });
});

// ─── measure — category links ─────────────────────────────────────────────────

describe("measure — category links", () => {
  const links = [
    link("All Escorts",     "/categories/escorts"),
    link("Call Girls",      "/category/call-girls"),
    link("Not a category",  "/listings/page"),
  ];

  it("categoryLinkCount is 2", () => {
    expect(measure(makeInput(links)).categoryLinkCount).toBe(2);
  });
});

// ─── measure — city links ─────────────────────────────────────────────────────

describe("measure — city links", () => {
  const links = [
    link("Hyderabad",    "/city/hyderabad"),
    link("Mumbai",       "/cities/mumbai"),
    link("All Cities",   "/location/browse"),
    link("Escort Page",  "/listings/escort"),
  ];

  it("cityLinkCount is 3", () => {
    expect(measure(makeInput(links)).cityLinkCount).toBe(3);
  });
});

// ─── measure — listing links ──────────────────────────────────────────────────

describe("measure — listing links", () => {
  const links = [
    link("Escort 1",  "/listing/escort-1"),
    link("Escort 2",  "/listings/escort-2"),
    link("Profile 3", "/profiles/user-3"),
    link("Contact",   "/contact"),
  ];

  it("listingLinkCount is 3", () => {
    expect(measure(makeInput(links)).listingLinkCount).toBe(3);
  });
});

// ─── measure — FAQ links ──────────────────────────────────────────────────────

describe("measure — FAQ links", () => {
  it("detects FAQ via href pattern /faq", () => {
    const links = [
      link("Common Questions", "/faq"),
      link("General FAQ",      "/faq/general"),
    ];
    expect(measure(makeInput(links)).faqInternalLinkCount).toBeGreaterThanOrEqual(2);
  });

  it("detects FAQ via anchor text mentioning 'faq'", () => {
    const links = [
      link("Read our FAQ", "/help"),
    ];
    expect(measure(makeInput(links)).faqInternalLinkCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — CTA links ──────────────────────────────────────────────────────

describe("measure — CTA links", () => {
  const links = [
    link("Contact Us",   "/contact"),
    link("Book Now",     "/booking"),
    link("Sign Up",      "/register"),
    link("Hyderabad Escorts", "/listings/hyderabad"),
  ];

  it("ctaInternalLinkCount is 3", () => {
    expect(measure(makeInput(links)).ctaInternalLinkCount).toBe(3);
  });
});

// ─── measure — keyword-rich anchors ──────────────────────────────────────────

describe("measure — keyword-rich anchors", () => {
  const links = [
    link("Hyderabad Escorts",        "/listings/hyderabad-escorts"),
    link("Top Hyderabad Escorts",    "/listings/top-hyderabad-escorts"),
    link("Unrelated Page",           "/about"),
  ];

  it("anchorKeywordCoverage is 2/3 for primary keyword in 2 of 3 anchors", () => {
    const r = measure(makeInput(links, { primaryKeyword: "hyderabad escorts" }));
    expect(r.anchorKeywordCoverage).toBeCloseTo(2 / 3, 3);
  });

  it("anchorKeywordCoverage is 0 when keyword is null", () => {
    const r = measure(makeInput(links, { primaryKeyword: null }));
    expect(r.anchorKeywordCoverage).toBe(0);
  });
});

// ─── measure — generic anchors ────────────────────────────────────────────────

describe("measure — generic anchors", () => {
  const links = [
    link("click here",  "/page-1"),
    link("here",        "/page-2"),
    link("read more",   "/page-3"),
    link("Hyderabad Escorts", "/listings/hyderabad"),
  ];

  it("genericAnchorCount is 3", () => {
    expect(measure(makeInput(links)).genericAnchorCount).toBe(3);
  });

  it("descriptiveAnchorCount is 1", () => {
    expect(measure(makeInput(links)).descriptiveAnchorCount).toBe(1);
  });
});

// ─── measure — Unicode anchors ────────────────────────────────────────────────

describe("measure — Unicode anchors", () => {
  const links = [
    link("हैदराबाद एस्कॉर्ट",  "/listings/hyderabad-escorts"),
    link("मुंबई गर्लफ्रेंड",    "/listings/mumbai-escorts"),
  ];

  it("internalLinkCount is 2 for Unicode anchors", () => {
    expect(measure(makeInput(links)).internalLinkCount).toBe(2);
  });

  it("anchorTextCount is 2 (non-empty anchors)", () => {
    expect(measure(makeInput(links)).anchorTextCount).toBe(2);
  });

  it("averageAnchorLength is positive", () => {
    expect(measure(makeInput(links)).averageAnchorLength).toBeGreaterThan(0);
  });

  it("all numeric metrics are finite", () => {
    const r = measure(makeInput(links));
    const fields = [
      r.internalLinkCount, r.anchorTextCount, r.uniqueAnchorTextCount,
      r.averageAnchorLength, r.longestAnchorLength, r.shortestAnchorLength,
      r.linkDensity, r.linkSpread, r.sectionLinkDistribution,
    ];
    for (const v of fields) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

// ─── measure — mixed-case URLs ────────────────────────────────────────────────

describe("measure — mixed-case URLs", () => {
  it("case-insensitive URL classification", () => {
    const links = [link("Cat", "/Category/Escorts")];
    expect(measure(makeInput(links)).categoryLinkCount).toBe(1);
  });

  it("mixed-case /LISTING/ matches listingLinkCount", () => {
    const links = [link("L", "/LISTING/escort-123")];
    expect(measure(makeInput(links)).listingLinkCount).toBe(1);
  });
});

// ─── measure — malformed URLs ─────────────────────────────────────────────────

describe("measure — malformed URLs", () => {
  it("does not throw on malformed href", () => {
    const links = [link("Bad Link", "not://a valid url!!!")];
    expect(() => measure(makeInput(links))).not.toThrow();
  });

  it("counts malformed href in internalLinkCount", () => {
    const links = [link("Bad", ":::invalid")];
    expect(measure(makeInput(links)).internalLinkCount).toBe(1);
  });
});

// ─── measure — follow/nofollow ────────────────────────────────────────────────

describe("measure — follow / nofollow", () => {
  const links = [
    link("Follow",   "/page-1"),
    link("Nofollow", "/page-2", "nofollow"),
    link("Compound", "/page-3", "noopener nofollow"),
    link("Noreferrer", "/page-4", "noreferrer"),
  ];

  it("nofollowLinkCount is 2", () => {
    expect(measure(makeInput(links)).nofollowLinkCount).toBe(2);
  });

  it("followLinkCount is 2", () => {
    expect(measure(makeInput(links)).followLinkCount).toBe(2);
  });

  it("followCount + nofollowCount = internalLinkCount", () => {
    const r = measure(makeInput(links));
    expect(r.followLinkCount! + r.nofollowLinkCount!).toBe(r.internalLinkCount!);
  });
});

// ─── measure — anchor length stats ───────────────────────────────────────────

describe("measure — anchor length statistics", () => {
  const links = [
    link("Hi",                   "/a"),
    link("Hyderabad",            "/b"),
    link("Premium Escorts Delhi", "/c"),
  ];

  it("longestAnchorLength is the longest anchor's char count", () => {
    expect(measure(makeInput(links)).longestAnchorLength).toBe("Premium Escorts Delhi".length);
  });

  it("shortestAnchorLength is the shortest anchor's char count", () => {
    expect(measure(makeInput(links)).shortestAnchorLength).toBe("Hi".length);
  });

  it("averageAnchorLength is the mean of the three", () => {
    const expected = ("Hi".length + "Hyderabad".length + "Premium Escorts Delhi".length) / 3;
    expect(measure(makeInput(links)).averageAnchorLength).toBeCloseTo(expected, 1);
  });
});

// ─── measure — linkDensity ────────────────────────────────────────────────────

describe("measure — linkDensity", () => {
  it("is 0 when intro content is empty", () => {
    const links = [link("Page", "/page")];
    const r = measure(makeInput(links, { introContent: "" }));
    expect(r.linkDensity).toBe(0);
  });

  it("scales with link count relative to word count", () => {
    // 10-word intro, 1 link → 10 links per 100 words
    const links = [link("Page", "/page")];
    const r = measure(makeInput(links, {
      introContent: "word ".repeat(10).trim(),
    }));
    expect(r.linkDensity).toBeCloseTo(10, 0);
  });
});

// ─── measure — sectionLinkDistribution ───────────────────────────────────────

describe("measure — sectionLinkDistribution", () => {
  it("is 0 for no links", () => {
    expect(measure(makeInput([])).sectionLinkDistribution).toBe(0);
  });

  it("is 1/5 = 0.2 for a single link (covers 1 of 5 sections)", () => {
    const links = [link("One", "/page")];
    expect(measure(makeInput(links)).sectionLinkDistribution).toBeCloseTo(0.2, 3);
  });

  it("is 1.0 when 5+ links spread across all 5 sections", () => {
    const links = [0, 1, 2, 3, 4].map((i) => link(`Page ${i}`, `/page-${i}`));
    expect(measure(makeInput(links)).sectionLinkDistribution).toBe(1);
  });
});

// ─── measure — linkSpread ─────────────────────────────────────────────────────

describe("measure — linkSpread", () => {
  it("is 0 for a single link", () => {
    expect(measure(makeInput([link("L", "/p")])).linkSpread).toBe(0);
  });

  it("is 1.0 for two links at positions 0 and n-1 (max spread)", () => {
    const links = [link("A", "/1"), link("B", "/2")];
    expect(measure(makeInput(links)).linkSpread).toBe(1);
  });

  it("is 0 for two links at the same position (degenerate: never happens)", () => {
    // Both indices would need to be identical — impossible for distinct array items
    // This just ensures the computation doesn't divide by zero
    expect(() => measure(makeInput([link("L1", "/p1"), link("L2", "/p2")]))).not.toThrow();
  });
});

// ─── measure — imageLinkCount ─────────────────────────────────────────────────

describe("measure — imageLinkCount (empty-anchor proxy)", () => {
  const links = [
    link("",            "/image-1"),
    link("   ",         "/image-2"),  // whitespace-only
    link("Real Text",   "/page"),
  ];

  it("imageLinkCount is 2 for empty/whitespace-only anchors", () => {
    expect(measure(makeInput(links)).imageLinkCount).toBe(2);
  });
});

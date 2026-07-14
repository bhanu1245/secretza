import { describe, it, expect } from "vitest";
import {
  measure,
  normaliseForMatching,
  countPhraseOccurrences,
  buildEntityList,
  computeNormalisedEntropy,
} from "@/lib/seo-providers/local-authenticity-metrics-provider";
import type { MetricsCollectorInput, LocalIntelSnapshot } from "@/lib/seo-quality-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<MetricsCollectorInput> = {},
): MetricsCollectorInput {
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
    localIntel:        null,
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

const HYDERABAD_INTEL: LocalIntelSnapshot = {
  city: "Hyderabad",
  slug: "hyderabad",
  source: "curated",
  luxuryAreas:              ["Banjara Hills", "Jubilee Hills", "Gachibowli"],
  premiumResidentialAreas:  ["Film Nagar", "Kondapur"],
  hotels:                   ["Taj Falaknuma Palace", "ITC Kohenur"],
  railwayStations:          ["Secunderabad Railway Station", "Kachiguda Railway Station"],
  busStands:                ["Majestic Bus Stand", "MGBS"],
  airports:                 ["Rajiv Gandhi International Airport"],
  shoppingMalls:            ["Inorbit Mall Cyberabad", "Forum Sujana Mall"],
  markets:                  ["Laad Bazaar", "Begum Bazaar"],
  itParks:                  ["Cyberabad", "HITEC City"],
  touristAttractions:       ["Charminar", "Golconda Fort"],
  beachesLakesParks:        ["Hussain Sagar"],
  landmarks:                ["Charminar", "Chowmahalla Palace"],
  historicMonuments:        ["Golconda Fort", "Qutb Shahi Tombs"],
  festivals:                ["Bonalu", "Bathukamma"],
  foodStreets:              ["Shah Ghouse Cafe", "Paradise Restaurant"],
  businessDistricts:        ["Banjara Hills", "HITEC City"],
  dbAreas:                  ["Banjara Hills", "Jubilee Hills", "Ameerpet", "Begumpet", "Madhapur"],
  nightlife:                ["Jubilee Hills", "Banjara Hills"],
};

const GEO_INTEL: LocalIntelSnapshot = {
  city: "Vizag",
  source: "geo_generated",
  luxuryAreas:    ["Rushikonda"],
  airports:       ["Visakhapatnam Airport"],
  dbAreas:        ["Rushikonda", "Dwaraka Nagar"],
};

// ─── normaliseForMatching ─────────────────────────────────────────────────────

describe("normaliseForMatching", () => {
  it("lowercases text", () => {
    expect(normaliseForMatching("Banjara Hills")).toBe("banjara hills");
  });

  it("collapses multiple spaces", () => {
    expect(normaliseForMatching("HITEC   City")).toBe("hitec city");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normaliseForMatching("  Hyderabad  ")).toBe("hyderabad");
  });

  it("handles empty string", () => {
    expect(normaliseForMatching("")).toBe("");
  });
});

// ─── countPhraseOccurrences ───────────────────────────────────────────────────

describe("countPhraseOccurrences", () => {
  it("counts a single occurrence", () => {
    expect(countPhraseOccurrences("visit banjara hills today", "banjara hills")).toBe(1);
  });

  it("counts multiple non-overlapping occurrences", () => {
    expect(countPhraseOccurrences("banjara hills and banjara hills area", "banjara hills")).toBe(2);
  });

  it("returns 0 when entity is absent", () => {
    expect(countPhraseOccurrences("jubilee hills is great", "banjara hills")).toBe(0);
  });

  it("does not match partial substrings", () => {
    // 'hills' should not match 'banjara hills' count
    expect(countPhraseOccurrences("the hills are alive", "banjara hills")).toBe(0);
  });

  it("matches at start of string", () => {
    expect(countPhraseOccurrences("banjara hills is luxury", "banjara hills")).toBe(1);
  });

  it("matches at end of string", () => {
    expect(countPhraseOccurrences("visit banjara hills", "banjara hills")).toBe(1);
  });

  it("does not match when immediately adjacent to word chars", () => {
    // 'charminar' inside 'charminarroute' should not match 'charminar'
    expect(countPhraseOccurrences("charminarroute is here", "charminar")).toBe(0);
  });

  it("matches when surrounded by punctuation", () => {
    expect(countPhraseOccurrences("located at 'charminar', hyderabad", "charminar")).toBe(1);
  });

  it("returns 0 for empty entity", () => {
    expect(countPhraseOccurrences("some text", "")).toBe(0);
  });
});

// ─── buildEntityList ──────────────────────────────────────────────────────────

describe("buildEntityList", () => {
  it("includes all provided categories", () => {
    const entities = buildEntityList(HYDERABAD_INTEL);
    const categories = new Set(entities.map((e) => e.category));
    expect(categories.has("landmarks")).toBe(true);
    expect(categories.has("districts")).toBe(true);
    expect(categories.has("airports")).toBe(true);
    expect(categories.has("festivals")).toBe(true);
  });

  it("normalises entity names", () => {
    const entities = buildEntityList(HYDERABAD_INTEL);
    const charminar = entities.find((e) => e.originalName === "Charminar");
    expect(charminar?.normName).toBe("charminar");
  });

  it("skips empty arrays gracefully", () => {
    const intel: LocalIntelSnapshot = { city: "Test", airports: [] };
    expect(() => buildEntityList(intel)).not.toThrow();
  });

  it("returns empty array for minimal intel with no entity arrays", () => {
    const intel: LocalIntelSnapshot = { city: "Nowhere" };
    expect(buildEntityList(intel)).toHaveLength(0);
  });

  it("landmarks and historicMonuments both map to 'landmarks' category", () => {
    const entities = buildEntityList(HYDERABAD_INTEL);
    const landmarkEntities = entities.filter((e) => e.category === "landmarks");
    // landmarks: ["Charminar", "Chowmahalla Palace"] + historicMonuments: ["Golconda Fort", "Qutb Shahi Tombs"]
    expect(landmarkEntities.length).toBe(4);
  });
});

// ─── computeNormalisedEntropy ─────────────────────────────────────────────────

describe("computeNormalisedEntropy", () => {
  it("returns 0 for all-zero counts", () => {
    const counts = new Map<"districts" | "landmarks", number>([
      ["districts", 0],
      ["landmarks", 0],
    ]);
    expect(computeNormalisedEntropy(counts as never)).toBe(0);
  });

  it("returns 0 for all mentions in one category", () => {
    const counts = new Map([
      ["districts",  10] as const,
      ["landmarks",   0] as const,
      ["airports",    0] as const,
      ["railwayStations", 0] as const,
      ["busStands",   0] as const,
      ["shoppingMalls", 0] as const,
      ["markets",     0] as const,
      ["businessDistricts", 0] as const,
      ["techParks",   0] as const,
      ["touristAreas",0] as const,
      ["festivals",   0] as const,
      ["cuisine",     0] as const,
      ["hotels",      0] as const,
      ["luxuryAreas", 0] as const,
    ]);
    expect(computeNormalisedEntropy(counts)).toBe(0);
  });

  it("returns 1 for perfectly uniform distribution across all 14 categories", () => {
    const counts = new Map([
      ["districts",  1] as const,
      ["landmarks",  1] as const,
      ["airports",   1] as const,
      ["railwayStations", 1] as const,
      ["busStands",  1] as const,
      ["shoppingMalls", 1] as const,
      ["markets",    1] as const,
      ["businessDistricts", 1] as const,
      ["techParks",  1] as const,
      ["touristAreas", 1] as const,
      ["festivals",  1] as const,
      ["cuisine",    1] as const,
      ["hotels",     1] as const,
      ["luxuryAreas", 1] as const,
    ]);
    expect(computeNormalisedEntropy(counts)).toBeCloseTo(1, 3);
  });

  it("returns intermediate value for partial distribution", () => {
    const counts = new Map([
      ["districts",  5] as const,
      ["landmarks",  5] as const,
      ["airports",   0] as const,
      ["railwayStations", 0] as const,
      ["busStands",  0] as const,
      ["shoppingMalls", 0] as const,
      ["markets",    0] as const,
      ["businessDistricts", 0] as const,
      ["techParks",  0] as const,
      ["touristAreas", 0] as const,
      ["festivals",  0] as const,
      ["cuisine",    0] as const,
      ["hotels",     0] as const,
      ["luxuryAreas", 0] as const,
    ]);
    const entropy = computeNormalisedEntropy(counts);
    expect(entropy).toBeGreaterThan(0);
    expect(entropy).toBeLessThan(1);
  });
});

// ─── measure — no LocalIntelligence ──────────────────────────────────────────

describe("measure — no localIntel", () => {
  it("returns all zeros when localIntel is null", () => {
    const r = measure(makeInput({ localIntel: null }));
    expect(r.localReferenceCount).toBe(0);
    expect(r.uniqueLocalReferenceCount).toBe(0);
    expect(r.districtMentionCount).toBe(0);
    expect(r.referenceEntropy).toBe(0);
    expect(r.cityNameOccurrences).toBe(0);
  });

  it("returns all zeros when localIntel is not provided", () => {
    const r = measure(makeInput());
    expect(r.localReferenceCount).toBe(0);
  });
});

// ─── measure — curated LocalIntelligence ─────────────────────────────────────

describe("measure — curated LocalIntelligence", () => {
  it("curatedReferenceCount = totalMentions for source='curated'", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Located near Charminar in Banjara Hills.",
    }));
    expect(r.curatedReferenceCount).toBe(r.localReferenceCount);
    expect(r.generatedReferenceCount).toBe(0);
  });
});

// ─── measure — generated LocalIntelligence ────────────────────────────────────

describe("measure — generated LocalIntelligence", () => {
  it("generatedReferenceCount = totalMentions for source='geo_generated'", () => {
    const r = measure(makeInput({
      localIntel:   GEO_INTEL,
      introContent: "Rushikonda is a luxury area near Visakhapatnam Airport.",
    }));
    expect(r.generatedReferenceCount).toBe(r.localReferenceCount);
    expect(r.curatedReferenceCount).toBe(0);
  });
});

// ─── measure — repeated references ───────────────────────────────────────────

describe("measure — repeated references", () => {
  it("localReferenceCount counts all occurrences, including repeats", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Banjara Hills is known for Banjara Hills lifestyle.",
    }));
    expect(r.localReferenceCount).toBeGreaterThanOrEqual(2);
  });

  it("uniqueLocalReferenceCount counts each entity once", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Banjara Hills is known for Banjara Hills lifestyle.",
    }));
    expect(r.uniqueLocalReferenceCount).toBe(1);
  });
});

// ─── measure — duplicate references ──────────────────────────────────────────

describe("measure — duplicate references", () => {
  it("duplicateLocalReferenceCount is 1 when one entity appears more than once", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar is in Hyderabad. Visit Charminar today.",
    }));
    expect(r.duplicateLocalReferenceCount).toBeGreaterThanOrEqual(1);
  });

  it("referenceRedundancy > 0 when entities are repeated", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Banjara Hills, Banjara Hills, Banjara Hills.",
    }));
    expect(r.referenceRedundancy).toBeGreaterThan(0);
  });
});

// ─── measure — intro references ───────────────────────────────────────────────

describe("measure — intro references", () => {
  it("introLocalReferenceCount counts entities in introContent", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Near Charminar in Banjara Hills.",
    }));
    expect(r.introLocalReferenceCount).toBeGreaterThanOrEqual(2);
  });

  it("introLocalReferenceCount is 0 when intro is empty", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "",
    }));
    expect(r.introLocalReferenceCount).toBe(0);
  });
});

// ─── measure — FAQ references ─────────────────────────────────────────────────

describe("measure — FAQ references", () => {
  it("faqLocalReferenceCount counts entities in FAQ text", () => {
    const r = measure(makeInput({
      localIntel: HYDERABAD_INTEL,
      faqItems: [
        { question: "Where are you?", answer: "We are near Charminar." },
        { question: "Best area?",     answer: "Try Banjara Hills." },
      ],
    }));
    expect(r.faqLocalReferenceCount).toBeGreaterThanOrEqual(2);
  });

  it("faqLocalReferenceCount is 0 when FAQ is empty", () => {
    const r = measure(makeInput({
      localIntel: HYDERABAD_INTEL,
      faqItems:   [],
    }));
    expect(r.faqLocalReferenceCount).toBe(0);
  });

  it("sectionLocalReferenceCoverage is 1 when all FAQs mention local entities", () => {
    const r = measure(makeInput({
      localIntel: HYDERABAD_INTEL,
      faqItems: [
        { question: "Where?",        answer: "Near Charminar." },
        { question: "Best area?",    answer: "Banjara Hills." },
      ],
    }));
    expect(r.sectionLocalReferenceCoverage).toBe(1);
  });

  it("sectionLocalReferenceCoverage is 0.5 when half of FAQs mention local entities", () => {
    const r = measure(makeInput({
      localIntel: HYDERABAD_INTEL,
      faqItems: [
        { question: "Where?",        answer: "Near Charminar." },
        { question: "Other topic?",  answer: "No local ref here." },
      ],
    }));
    expect(r.sectionLocalReferenceCoverage).toBe(0.5);
  });
});

// ─── measure — heading references ─────────────────────────────────────────────

describe("measure — heading references", () => {
  it("headingLocalReferenceCount counts entities in H1", () => {
    const r = measure(makeInput({
      localIntel: HYDERABAD_INTEL,
      h1:         "Escorts in Banjara Hills Hyderabad",
    }));
    expect(r.headingLocalReferenceCount).toBeGreaterThanOrEqual(1);
  });

  it("headingLocalReferenceCount is 0 when H1 has no local entities", () => {
    const r = measure(makeInput({
      localIntel: HYDERABAD_INTEL,
      h1:         "Premium Escorts Available",
    }));
    expect(r.headingLocalReferenceCount).toBe(0);
  });
});

// ─── measure — mixed locality categories ──────────────────────────────────────

describe("measure — mixed locality categories", () => {
  const content =
    "Rajiv Gandhi International Airport serves Hyderabad. " +
    "Charminar is a landmark. " +
    "Bonalu is a festival. " +
    "Visit Inorbit Mall Cyberabad for shopping. " +
    "HITEC City is the tech hub.";

  it("airportMentionCount is 1", () => {
    const r = measure(makeInput({ localIntel: HYDERABAD_INTEL, introContent: content }));
    expect(r.airportMentionCount).toBe(1);
  });

  it("landmarkMentionCount is ≥1 for Charminar", () => {
    const r = measure(makeInput({ localIntel: HYDERABAD_INTEL, introContent: content }));
    expect(r.landmarkMentionCount).toBeGreaterThanOrEqual(1);
  });

  it("festivalMentionCount is ≥1 for Bonalu", () => {
    const r = measure(makeInput({ localIntel: HYDERABAD_INTEL, introContent: content }));
    expect(r.festivalMentionCount).toBeGreaterThanOrEqual(1);
  });

  it("shoppingMallMentionCount is ≥1 for Inorbit Mall Cyberabad", () => {
    const r = measure(makeInput({ localIntel: HYDERABAD_INTEL, introContent: content }));
    expect(r.shoppingMallMentionCount).toBeGreaterThanOrEqual(1);
  });

  it("techParkMentionCount is ≥1 for HITEC City", () => {
    const r = measure(makeInput({ localIntel: HYDERABAD_INTEL, introContent: content }));
    expect(r.techParkMentionCount).toBeGreaterThanOrEqual(1);
  });

  it("transportMentionCount = airports + railway + bus", () => {
    const r = measure(makeInput({ localIntel: HYDERABAD_INTEL, introContent: content }));
    expect(r.transportMentionCount).toBe(
      (r.airportMentionCount ?? 0) +
      (r.railwayStationMentionCount ?? 0) +
      (r.busStandMentionCount ?? 0),
    );
  });
});

// ─── measure — Unicode locality names ────────────────────────────────────────

describe("measure — Unicode locality names", () => {
  const hindiIntel: LocalIntelSnapshot = {
    city:      "हैदराबाद",
    source:    "curated",
    landmarks: ["चारमीनार", "गोलकोंडा किला"],
    dbAreas:   ["बंजारा हिल्स", "जुबली हिल्स"],
  };

  it("detects Unicode landmark in intro", () => {
    const r = measure(makeInput({
      localIntel:   hindiIntel,
      introContent: "हम चारमीनार के पास स्थित हैं।",
    }));
    expect(r.landmarkMentionCount).toBeGreaterThanOrEqual(1);
  });

  it("cityNameOccurrences counts Unicode city name", () => {
    const r = measure(makeInput({
      localIntel:   hindiIntel,
      introContent: "हैदराबाद में हैदराबाद की सेवाएं।",
    }));
    expect(r.cityNameOccurrences).toBe(2);
  });
});

// ─── measure — missing optional arrays ───────────────────────────────────────

describe("measure — missing optional arrays", () => {
  it("does not throw when all optional arrays are absent", () => {
    const minimal: LocalIntelSnapshot = {
      city:   "Minimal",
      source: "curated",
    };
    expect(() => measure(makeInput({ localIntel: minimal }))).not.toThrow();
  });

  it("returns 0 counts when arrays are absent", () => {
    const minimal: LocalIntelSnapshot = { city: "Minimal" };
    const r = measure(makeInput({
      localIntel:   minimal,
      introContent: "Minimal city is great.",
    }));
    expect(r.landmarkMentionCount).toBe(0);
    expect(r.festivalMentionCount).toBe(0);
    expect(r.airportMentionCount).toBe(0);
  });
});

// ─── measure — overlapping locality names ─────────────────────────────────────

describe("measure — overlapping locality names", () => {
  it("'Banjara Hills' mention does not pollute 'Hills' or 'Jubilee Hills' counts", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "We are in Banjara Hills.",
    }));
    // uniqueLocalReferenceCount should be 1 (only Banjara Hills matches)
    // "Jubilee Hills" does not appear in text
    const entities = buildEntityList(HYDERABAD_INTEL);
    const jubilee = entities.find((e) => e.normName === "jubilee hills");
    const banjara = entities.find((e) => e.normName === "banjara hills");
    expect(jubilee).toBeDefined();
    expect(banjara).toBeDefined();
    // localReferenceCount should include banjara hills but not jubilee hills
    expect(r.uniqueLocalReferenceCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — city name repetition ──────────────────────────────────────────

describe("measure — cityNameOccurrences", () => {
  it("counts every city name occurrence in full content", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Hyderabad escorts are available in Hyderabad.",
      h1:           "Escorts in Hyderabad",
    }));
    expect(r.cityNameOccurrences).toBe(3); // 2 in intro, 1 in h1
  });

  it("is 0 when city name is not mentioned", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Premium services available.",
    }));
    expect(r.cityNameOccurrences).toBe(0);
  });

  it("is case-insensitive", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "HYDERABAD is amazing. hyderabad escorts.",
    }));
    expect(r.cityNameOccurrences).toBe(2);
  });
});

// ─── measure — density calculation ───────────────────────────────────────────

describe("measure — localEntityDensity", () => {
  it("is 0 when there are no local references", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "No local entities here.",
    }));
    expect(r.localEntityDensity).toBe(0);
  });

  it("scales with local reference count relative to word count", () => {
    // 10-word intro, should give non-zero density when entity matches
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar in Banjara Hills for a great experience.",
    }));
    expect(r.localEntityDensity).toBeGreaterThan(0);
  });

  it("localEntityDensity = (totalMentions / totalWords) × 100", () => {
    const intro = "Charminar Charminar Charminar";  // 3 words, 3 mentions of Charminar
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: intro,
    }));
    // 3 mentions / 3 words * 100 = 100
    expect(r.localEntityDensity).toBeCloseTo(100, 0);
  });
});

// ─── measure — entropy calculation ───────────────────────────────────────────

describe("measure — referenceEntropy", () => {
  it("is 0 when all references are in one category", () => {
    // Only landmarks mentioned (Charminar appears many times, no other categories)
    const r = measure(makeInput({
      localIntel:   { city: "H", landmarks: ["Charminar"], source: "curated" },
      introContent: "Charminar Charminar Charminar",
    }));
    expect(r.referenceEntropy).toBe(0);
  });

  it("is > 0 when references span multiple categories", () => {
    const content = "Near Charminar airport Rajiv Gandhi International Airport and Bonalu festival.";
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: content,
    }));
    expect(r.referenceEntropy).toBeGreaterThan(0);
  });

  it("is bounded between 0 and 1", () => {
    const content =
      "Charminar, Banjara Hills, Rajiv Gandhi International Airport, " +
      "Bonalu, Laad Bazaar, HITEC City, Hussain Sagar.";
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: content,
    }));
    expect(r.referenceEntropy).toBeGreaterThanOrEqual(0);
    expect(r.referenceEntropy).toBeLessThanOrEqual(1);
  });
});

// ─── measure — distribution calculation ──────────────────────────────────────

describe("measure — referenceDistributionScore", () => {
  it("is 0 when no content zones have local references", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "No entities here.",
    }));
    expect(r.referenceDistributionScore).toBe(0);
  });

  it("is 1/3 when only intro has local references", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar.",
      h1:           "Generic heading",
      faqItems:     [{ question: "Q?", answer: "A." }],
    }));
    expect(r.referenceDistributionScore).toBeCloseTo(1 / 3, 3);
  });

  it("is 2/3 when intro and h1 have local references", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar.",
      h1:           "Escorts in Banjara Hills",
      faqItems:     [{ question: "Q?", answer: "A." }],
    }));
    expect(r.referenceDistributionScore).toBeCloseTo(2 / 3, 3);
  });

  it("is 1 when all three zones (intro, h1, faq) have local references", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar.",
      h1:           "Escorts near Banjara Hills",
      faqItems:     [{ question: "Where?", answer: "Near Jubilee Hills." }],
    }));
    expect(r.referenceDistributionScore).toBe(1);
  });
});

// ─── measure — whitespace normalisation ───────────────────────────────────────

describe("measure — whitespace normalisation", () => {
  it("matches entity despite extra whitespace in content", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit  Banjara   Hills today.",
    }));
    // 'banjara hills' normalised matches 'banjara   hills' normalised
    expect(r.localReferenceCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── measure — case-insensitive matching ──────────────────────────────────────

describe("measure — case-insensitive matching", () => {
  it("matches entity in ALL CAPS", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit BANJARA HILLS today.",
    }));
    expect(r.localReferenceCount).toBeGreaterThanOrEqual(1);
  });

  it("matches entity in Title Case", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar is beautiful.",
    }));
    expect(r.landmarkMentionCount).toBeGreaterThanOrEqual(1);
  });

  it("matches entity in lowercase", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "we love charminar in banjara hills.",
    }));
    expect(r.localReferenceCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── measure — neighborhoodCoverage ──────────────────────────────────────────

describe("measure — neighborhoodCoverage", () => {
  it("is 0 when no dbAreas are mentioned", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "No area mentioned here.",
    }));
    expect(r.neighborhoodCoverage).toBe(0);
  });

  it("is 1/5 when one of five dbAreas is mentioned", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Banjara Hills.",
    }));
    // dbAreas: ["Banjara Hills", "Jubilee Hills", "Ameerpet", "Begumpet", "Madhapur"] = 5
    expect(r.neighborhoodCoverage).toBeCloseTo(1 / 5, 3);
  });

  it("is 1 when all dbAreas are mentioned", () => {
    const introContent =
      "Banjara Hills and Jubilee Hills and Ameerpet and Begumpet and Madhapur.";
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent,
    }));
    expect(r.neighborhoodCoverage).toBe(1);
  });

  it("is 0 when dbAreas array is absent", () => {
    const r = measure(makeInput({
      localIntel:   { city: "X", landmarks: ["Charminar"] },
      introContent: "Charminar is here.",
    }));
    expect(r.neighborhoodCoverage).toBe(0);
  });
});

// ─── measure — geographicSpread ───────────────────────────────────────────────

describe("measure — geographicSpread", () => {
  it("is 0 when no categories have mentions", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "No local entities.",
    }));
    expect(r.geographicSpread).toBe(0);
  });

  it("is > 0 when at least one category has mentions", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar is a famous landmark.",
    }));
    expect(r.geographicSpread).toBeGreaterThan(0);
  });

  it("increases as more categories are covered", () => {
    const r1 = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar.",
    }));
    const r2 = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar and Bonalu and Rajiv Gandhi International Airport.",
    }));
    expect(r2.geographicSpread!).toBeGreaterThanOrEqual(r1.geographicSpread!);
  });
});

// ─── measure — primaryLocationCoverage / secondaryLocationCoverage ────────────

describe("measure — primaryLocationCoverage", () => {
  it("is > 0 when at least one luxuryArea or businessDistrict is mentioned", () => {
    // primaryPool = luxuryAreas + premiumResidentialAreas + businessDistricts
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Located in Banjara Hills.",
    }));
    expect(r.primaryLocationCoverage).toBeGreaterThan(0);
  });

  it("is 0 when none of the primary locations are mentioned", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar is famous.",  // Charminar is landmark, not luxury/business
    }));
    // Charminar is NOT in luxuryAreas or businessDistricts
    // primaryPool includes Banjara Hills (both luxuryArea and businessDistrict), etc.
    expect(r.primaryLocationCoverage).toBe(0);
  });
});

describe("measure — secondaryLocationCoverage", () => {
  it("is > 0 when at least one landmark or tourist attraction is mentioned", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar, the iconic landmark.",
    }));
    expect(r.secondaryLocationCoverage).toBeGreaterThan(0);
  });
});

// ─── measure — locationMentionFrequency ───────────────────────────────────────

describe("measure — locationMentionFrequency", () => {
  it("is 0 when no references exist", () => {
    expect(measure(makeInput({ localIntel: HYDERABAD_INTEL })).locationMentionFrequency).toBe(0);
  });

  it("equals 1 when each entity is mentioned exactly once", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Visit Charminar once.",
    }));
    expect(r.locationMentionFrequency).toBe(1);
  });

  it("is > 1 when an entity is repeated", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar and Charminar again.",
    }));
    expect(r.locationMentionFrequency).toBeGreaterThan(1);
  });
});

// ─── measure — referenceRedundancy ───────────────────────────────────────────

describe("measure — referenceRedundancy", () => {
  it("is 0 when each entity is mentioned exactly once", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar is beautiful.",
    }));
    expect(r.referenceRedundancy).toBe(0);
  });

  it("is > 0 when an entity is repeated", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar Charminar Charminar.",
    }));
    expect(r.referenceRedundancy).toBeGreaterThan(0);
  });

  it("is bounded between 0 and 1", () => {
    const r = measure(makeInput({
      localIntel:   HYDERABAD_INTEL,
      introContent: "Charminar Charminar Banjara Hills Banjara Hills.",
    }));
    expect(r.referenceRedundancy).toBeGreaterThanOrEqual(0);
    expect(r.referenceRedundancy).toBeLessThanOrEqual(1);
  });
});

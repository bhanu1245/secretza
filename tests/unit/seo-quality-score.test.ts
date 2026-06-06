import { describe, it, expect } from "vitest";
import {
  analyzeSeoContent,
  computeSeoQualityScore,
  countWords,
  type SeoQualityInput,
} from "@/lib/seo-quality";
import { isContentClean } from "@/lib/content-filter";

const NO_DUP = {
  title: false,
  metaDescription: false,
  h1: false,
  introContent: false,
  faqContent: false,
};

function input(overrides: Partial<SeoQualityInput>): SeoQualityInput {
  return {
    title: "",
    metaDescription: "",
    h1: "",
    introContent: "",
    canonicalUrl: "",
    featuredImage: "",
    faqCount: 0,
    internalLinksCount: 0,
    wordCount: 0,
    uniquenessScore: 100,
    duplicateFields: { ...NO_DUP },
    ...overrides,
  };
}

describe("SEO quality scoring (shared engine reused by hook + route)", () => {
  it("counts words, ignoring HTML", () => {
    expect(countWords("<p>hello   world</p>")).toBe(2);
    expect(countWords("")).toBe(0);
  });

  it("rich complete content scores much higher than sparse", () => {
    const sparse = computeSeoQualityScore(input({ title: "t", wordCount: 5, uniquenessScore: 50 }));
    const rich = computeSeoQualityScore(
      input({
        title: "t",
        metaDescription: "m",
        h1: "h",
        canonicalUrl: "c",
        featuredImage: "f",
        faqCount: 5,
        internalLinksCount: 5,
        wordCount: 600,
        uniquenessScore: 100,
      }),
    );
    expect(rich).toBeGreaterThan(sparse);
    expect(rich).toBeGreaterThanOrEqual(90);
  });

  it("flags content below the minimum word count", () => {
    const result = analyzeSeoContent(input({ wordCount: 100 }));
    expect(result.meetsMinWordCount).toBe(false);
  });

  it("penalizes duplicate fields", () => {
    const clean = computeSeoQualityScore(input({ title: "t", wordCount: 600, uniquenessScore: 100 }));
    const dup = computeSeoQualityScore(
      input({ title: "t", wordCount: 600, uniquenessScore: 100, duplicateFields: { ...NO_DUP, title: true } }),
    );
    expect(dup).toBeLessThan(clean);
  });

  it("isContentClean guards AI/user output against contact leaks", () => {
    expect(isContentClean("clean professional copy")).toBe(true);
    expect(isContentClean("ping me 9876543210")).toBe(false);
    expect(isContentClean("")).toBe(true);
  });
});

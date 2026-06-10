import { describe, expect, it } from "vitest";
import { generateKeywordPhraseSEO } from "@/lib/seo-keyword-content";

describe("generateKeywordPhraseSEO", () => {
  it("builds title, meta, and h1 from keyword phrase", () => {
    const content = generateKeywordPhraseSEO("Premium Companions", "premium-companions");
    expect(content.title).toContain("Premium Companions");
    expect(content.h1).toBe("Premium Companions");
    expect(content.metaDescription).toContain("premium companions");
    expect(content.primaryKeyword).toBe("Premium Companions");
    expect(content.pageType).toBe("longtail");
  });
});

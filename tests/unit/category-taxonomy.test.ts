import { describe, expect, it } from "vitest";
import {
  CATEGORY_TAXONOMY,
  EXTRA_ROOT_CATEGORIES,
  validateCategoryTaxonomy,
} from "@/lib/category-taxonomy";

describe("category taxonomy", () => {
  it("has no duplicate slugs or names", () => {
    expect(validateCategoryTaxonomy()).toEqual([]);
  });

  it("covers all required parent categories", () => {
    const required = [
      "escorts",
      "massage",
      "dating",
      "companionship",
      "adult-services",
      "adult-jobs",
      "couples",
      "models",
      "striptease",
      "bdsm",
      "fetish",
      "webcam",
      "phone-sexting",
      "events-parties",
      "gigolo",
    ];
    const slugs = new Set(CATEGORY_TAXONOMY.map((parent) => parent.slug));
    for (const slug of required) {
      expect(slugs.has(slug), `missing parent ${slug}`).toBe(true);
    }
  });

  it("defines the expected subcategory counts per parent", () => {
    const counts = Object.fromEntries(
      CATEGORY_TAXONOMY.map((parent) => [parent.slug, parent.subcategories.length]),
    );
    expect(counts).toEqual({
      escorts: 10,
      massage: 10,
      dating: 6,
      companionship: 5,
      "adult-services": 5,
      "adult-jobs": 5,
      couples: 4,
      models: 5,
      striptease: 4,
      bdsm: 5,
      fetish: 5,
      webcam: 4,
      "phone-sexting": 4,
      "events-parties": 4,
      gigolo: 4,
    });
  });

  it("adds only the missing root categories via EXTRA_ROOT_CATEGORIES", () => {
    expect(EXTRA_ROOT_CATEGORIES.map((c) => c.slug)).toEqual(["adult-jobs", "couples", "models"]);
  });

  it("uses distinct slugs for couple massage variants", () => {
    const massage = CATEGORY_TAXONOMY.find((p) => p.slug === "massage");
    const couples = CATEGORY_TAXONOMY.find((p) => p.slug === "couples");
    const massageCouple = massage?.subcategories.find((s) => s.name === "Couple Massage");
    const couplesCouple = couples?.subcategories.find((s) => s.slug === "couples-massage");
    expect(massageCouple?.slug).toBe("couple-massage");
    expect(couplesCouple?.name).toBe("Couples Massage");
    expect(couplesCouple?.slug).not.toBe(massageCouple?.slug);
  });
});

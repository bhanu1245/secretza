import { describe, expect, it } from "vitest";
import { indiaAllStates } from "@/lib/india-geo-seed-data";
import { indiaCities, indiaStates } from "@/lib/india-geo-data";
import {
  REQUIRED_MAJOR_CITY_SLUGS,
  countIndiaStatesByType,
  validateIndiaGeoSourceData,
} from "@/lib/seed-india-geo-expand";

describe("India geo source data", () => {
  it("includes all 28 states and 8 union territories", () => {
    expect(indiaAllStates).toHaveLength(36);
    expect(indiaStates).toHaveLength(36);

    const states = indiaAllStates.filter((s) => s.type === "state");
    const uts = indiaAllStates.filter((s) => s.type === "ut");
    expect(states).toHaveLength(28);
    expect(uts).toHaveLength(8);
  });

  it("has unique state slugs in source", () => {
    const slugs = indiaAllStates.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique city slug per state in source", () => {
    const keys = indiaCities.map((c) => `${c.stateSlug}:${c.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers required major cities by slug or alias", () => {
    const validation = validateIndiaGeoSourceData();
    expect(validation.pass).toBe(true);
    expect(validation.missingMajorCities).toEqual([]);
  });

  it("lists user-requested metros in required set", () => {
    const mustHave = [
      "delhi",
      "mumbai",
      "bengaluru",
      "chennai",
      "hyderabad",
      "kolkata",
      "amaravati",
      "prayagraj",
      "mysuru",
    ];
    for (const slug of mustHave) {
      expect(REQUIRED_MAJOR_CITY_SLUGS).toContain(slug);
    }
  });
});

describe("India geo audit helpers", () => {
  it("counts states vs union territories", () => {
    const counts = countIndiaStatesByType(indiaAllStates);
    expect(counts.states).toBe(28);
    expect(counts.unionTerritories).toBe(8);
  });
});

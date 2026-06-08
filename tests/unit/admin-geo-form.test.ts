import { describe, expect, it } from "vitest";
import {
  buildGeoCascadeUrl,
  filterCitiesByState,
  filterStatesByCountry,
  geoSubmitLabel,
  validateGeoForm,
} from "@/lib/admin-geo-form";

const emptyForm = {
  name: "Test",
  slug: "test",
  code: "",
  countryId: "",
  stateId: "",
  cityId: "",
};

describe("admin geo form helpers", () => {
  it("filters states by country", () => {
    const states = [
      { id: "s1", name: "Maharashtra", countryId: "in" },
      { id: "s2", name: "California", countryId: "us" },
    ];
    expect(filterStatesByCountry(states, "in")).toHaveLength(1);
    expect(filterStatesByCountry(states, "")).toEqual([]);
  });

  it("filters cities by state", () => {
    const cities = [
      { id: "c1", name: "Mumbai", stateId: "s1" },
      { id: "c2", name: "Pune", stateId: "s2" },
    ];
    expect(filterCitiesByState(cities, "s1")).toHaveLength(1);
    expect(filterCitiesByState(cities, "")).toEqual([]);
  });

  it("requires country for state creation", () => {
    expect(validateGeoForm("states", { ...emptyForm, countryId: "" })).toMatch(/country/i);
    expect(validateGeoForm("states", { ...emptyForm, countryId: "in" })).toBeNull();
  });

  it("requires country and state for city creation", () => {
    expect(validateGeoForm("cities", { ...emptyForm, countryId: "in" })).toMatch(/state/i);
    expect(
      validateGeoForm("cities", { ...emptyForm, countryId: "in", stateId: "s1" }),
    ).toBeNull();
  });

  it("requires full parent chain for area creation", () => {
    expect(
      validateGeoForm("areas", { ...emptyForm, countryId: "in", stateId: "s1" }),
    ).toMatch(/city/i);
    expect(
      validateGeoForm("areas", {
        ...emptyForm,
        countryId: "in",
        stateId: "s1",
        cityId: "c1",
      }),
    ).toBeNull();
  });

  it("returns entity-specific add labels", () => {
    expect(geoSubmitLabel("states", false)).toBe("Add State");
    expect(geoSubmitLabel("cities", false)).toBe("Add City");
    expect(geoSubmitLabel("areas", false)).toBe("Add Area");
  });

  it("builds scoped cascade URLs with parent filters", () => {
    expect(buildGeoCascadeUrl("states", { countryId: "in-1" })).toBe(
      "/api/admin/geo/states?limit=100&countryId=in-1",
    );
    expect(buildGeoCascadeUrl("cities", { stateId: "mh-1" })).toBe(
      "/api/admin/geo/cities?limit=100&stateId=mh-1",
    );
    expect(buildGeoCascadeUrl("areas", { cityId: "mum-1" })).toBe(
      "/api/admin/geo/areas?limit=100&cityId=mum-1",
    );
  });

  it("returns null when cascade parent id is missing", () => {
    expect(buildGeoCascadeUrl("states", {})).toBeNull();
    expect(buildGeoCascadeUrl("cities", {})).toBeNull();
    expect(buildGeoCascadeUrl("areas", {})).toBeNull();
  });
});

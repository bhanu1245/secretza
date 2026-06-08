export type GeoFormValues = {
  name: string;
  slug: string;
  code: string;
  countryId: string;
  stateId: string;
  cityId: string;
};

export type GeoReferenceItem = {
  id: string;
  name: string;
  countryId?: string;
  stateId?: string;
};

export type GeoFormType = "countries" | "states" | "cities" | "areas";

export type GeoCascadeType = "states" | "cities" | "areas";

export type GeoCascadeParent = {
  countryId?: string;
  stateId?: string;
  cityId?: string;
};

const GEO_CASCADE_LIMIT = 100;

/** Build scoped list URL for cascading geo dropdowns (no global preload). */
export function buildGeoCascadeUrl(
  type: GeoCascadeType,
  parent: GeoCascadeParent,
  limit = GEO_CASCADE_LIMIT,
): string | null {
  const params = new URLSearchParams({ limit: String(limit) });

  if (type === "states") {
    if (!parent.countryId) return null;
    params.set("countryId", parent.countryId);
  } else if (type === "cities") {
    if (!parent.stateId) return null;
    params.set("stateId", parent.stateId);
  } else if (type === "areas") {
    if (!parent.cityId) return null;
    params.set("cityId", parent.cityId);
  }

  return `/api/admin/geo/${type}?${params.toString()}`;
}

export function filterStatesByCountry(
  states: GeoReferenceItem[],
  countryId: string,
): GeoReferenceItem[] {
  if (!countryId) return [];
  return states.filter((state) => state.countryId === countryId);
}

export function filterCitiesByState(
  cities: GeoReferenceItem[],
  stateId: string,
): GeoReferenceItem[] {
  if (!stateId) return [];
  return cities.filter((city) => city.stateId === stateId);
}

export function validateGeoForm(
  type: GeoFormType,
  form: GeoFormValues,
): string | null {
  if (!form.name.trim()) return "Name is required";
  if (!form.slug.trim()) return "Slug is required";

  if (type === "states" && !form.countryId) {
    return "Select a country before adding a state";
  }

  if (type === "cities") {
    if (!form.countryId) return "Select a country before adding a city";
    if (!form.stateId) return "Select a state before adding a city";
  }

  if (type === "areas") {
    if (!form.countryId) return "Select a country before adding an area";
    if (!form.stateId) return "Select a state before adding an area";
    if (!form.cityId) return "Select a city before adding an area";
  }

  return null;
}

export function geoSubmitLabel(type: GeoFormType, editing: boolean): string {
  if (editing) return "Update";
  switch (type) {
    case "states":
      return "Add State";
    case "cities":
      return "Add City";
    case "areas":
      return "Add Area";
    default:
      return "Add Country";
  }
}

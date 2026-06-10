/**
 * Configurable longtail keyword templates for advanced SEO generation.
 * Used by City + Category + Longtail generator.
 */
export const DEFAULT_LONGTAIL_KEYWORDS = [
  "Independent",
  "VIP",
  "Luxury",
  "Verified",
  "Premium",
  "College",
  "Elite",
  "High Profile",
  "Russian",
  "Model",
  "Celebrity",
  "Top Rated",
  "Best",
] as const;

export type LongtailTemplate = (typeof DEFAULT_LONGTAIL_KEYWORDS)[number];

/** Build a full longtail phrase: "{template} {category} {city}". */
export function buildLongtailPhrase(
  template: string,
  categoryName: string,
  cityName: string,
): string {
  const t = template.trim();
  const cat = categoryName.trim();
  const city = cityName.trim();
  if (!t || !cat || !city) return "";
  return `${t} ${cat} ${city}`;
}

/** Build phrase from custom keyword prefix + category + city. */
export function buildCategoryCityKeywordPhrase(
  keywordPrefix: string,
  categoryName: string,
  cityName: string,
): string {
  const prefix = keywordPrefix.trim();
  const cat = categoryName.trim();
  const city = cityName.trim();
  if (!prefix || !cat || !city) return "";

  const lower = prefix.toLowerCase();
  if (lower.includes(cat.toLowerCase())) {
    return `${prefix} ${city}`.trim();
  }
  return `${prefix} ${cat} ${city}`.trim();
}

/** Build phrase from base keyword + city (Keyword × Cities mode). */
export function buildKeywordCityPhrase(keyword: string, cityName: string): string {
  const k = keyword.trim();
  const city = cityName.trim();
  if (!k || !city) return "";
  if (k.toLowerCase().endsWith(city.toLowerCase())) return k;
  return `${k} ${city}`;
}

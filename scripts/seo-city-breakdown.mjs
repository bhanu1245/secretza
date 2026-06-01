import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db", { readonly: true });

const totalCities = db.query("SELECT COUNT(*) as n FROM City").get().n;
const activeCities = db.query("SELECT COUNT(*) as n FROM City WHERE isActive = 1").get().n;
const inactiveCities = db.query("SELECT COUNT(*) as n FROM City WHERE isActive = 0").get().n;

const byCountry = db.query(`
  SELECT co.slug as country, co.name as countryName, co.isActive as countryActive, COUNT(*) as cityCount
  FROM City c JOIN State s ON c.stateId = s.id JOIN Country co ON s.countryId = co.id
  WHERE c.isActive = 1
  GROUP BY co.slug, co.name, co.isActive
  ORDER BY cityCount DESC
`).all();

const totalCitySeoPages = db.query("SELECT COUNT(*) as n FROM SeoPage WHERE pageType='city'").get().n;

const nonIndiaCount = db.query(`
  SELECT COUNT(*) as n FROM SeoPage sp
  JOIN City c ON c.slug = sp.pageSlug
  JOIN State s ON c.stateId = s.id
  JOIN Country co ON s.countryId = co.id
  WHERE sp.pageType = 'city' AND co.slug != 'india'
`).get().n;

const nonIndiaSample = db.query(`
  SELECT sp.pageSlug, co.slug as country
  FROM SeoPage sp
  JOIN City c ON c.slug = sp.pageSlug
  JOIN State s ON c.stateId = s.id
  JOIN Country co ON s.countryId = co.id
  WHERE sp.pageType = 'city' AND co.slug != 'india'
  ORDER BY co.slug, sp.pageSlug
  LIMIT 15
`).all();

// Indian cities that DO have SeoPages
const indiaWithSeo = db.query(`
  SELECT COUNT(*) as n FROM SeoPage sp
  JOIN City c ON c.slug = sp.pageSlug
  JOIN State s ON c.stateId = s.id
  JOIN Country co ON s.countryId = co.id
  WHERE sp.pageType = 'city' AND co.slug = 'india' AND c.isActive = 1 AND co.isActive = 1
`).get().n;

console.log("=== CITY TABLE BREAKDOWN ===");
console.log("Total cities:", totalCities);
console.log("Active cities:", activeCities);
console.log("Inactive cities:", inactiveCities);
console.log("");
console.log("=== ACTIVE CITIES BY COUNTRY ===");
byCountry.forEach(r =>
  console.log(` ${r.country} (countryActive=${r.countryActive}): ${r.cityCount} cities`)
);
console.log("");
console.log("=== SEOPAGE ANALYSIS ===");
console.log("Total city SeoPages:", totalCitySeoPages);
console.log("  - India (isActive=1, country.isActive=1):", indiaWithSeo);
console.log("  - Non-India cities:", nonIndiaCount);
console.log("");
console.log("=== NON-INDIA CITY SLUGS IN existingSlugs (first 15) ===");
nonIndiaSample.forEach(r => console.log(` "${r.pageSlug}" → country: ${r.country}`));

console.log("");
console.log("=== THE BUG (existingSlugs cross-contamination) ===");
console.log("getExistingPageSlugs('city') returns ALL city SeoPages regardless of country.");
console.log("The notIn filter sends ALL 374 slugs to the India city query.");
console.log("India active cities: 322, all already have SeoPages → batch returns 0.");

db.close();

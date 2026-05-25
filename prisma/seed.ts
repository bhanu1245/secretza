// ==========================================
// Secretza Geo Seed Script
// ==========================================
// Seeds Country, State, City data for worldwide coverage.
// Run with: bun run prisma/db/seed.ts
//
// Strategy:
//   1. Seeds ~200 countries with codes and slugs
//   2. Seeds major states/provinces for key markets (India, US, UK, Canada, Australia)
//   3. Seeds featured cities in each state
//   4. Seeds initial categories
//
// Performance: Uses createMany for batch inserts. Total ~5000 records.
// For production with full geo data, use a dedicated import script with
// CSV data from GeoNames or similar sources.
// ==========================================

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ==========================================
// Country Data
// ==========================================
const COUNTRIES = [
  // South Asia
  { name: "India", code: "IN", slug: "india", isActive: true },
  { name: "Pakistan", code: "PK", slug: "pakistan", isActive: true },
  { name: "Bangladesh", code: "BD", slug: "bangladesh", isActive: true },
  { name: "Sri Lanka", code: "LK", slug: "sri-lanka", isActive: true },
  { name: "Nepal", code: "NP", slug: "nepal", isActive: true },
  // Southeast Asia
  { name: "Thailand", code: "TH", slug: "thailand", isActive: true },
  { name: "Philippines", code: "PH", slug: "philippines", isActive: true },
  { name: "Vietnam", code: "VN", slug: "vietnam", isActive: true },
  { name: "Singapore", code: "SG", slug: "singapore", isActive: true },
  { name: "Malaysia", code: "MY", slug: "malaysia", isActive: true },
  { name: "Indonesia", code: "ID", slug: "indonesia", isActive: true },
  { name: "Cambodia", code: "KH", slug: "cambodia", isActive: true },
  { name: "Myanmar", code: "MM", slug: "myanmar", isActive: true },
  // East Asia
  { name: "Japan", code: "JP", slug: "japan", isActive: true },
  { name: "South Korea", code: "KR", slug: "south-korea", isActive: true },
  { name: "China", code: "CN", slug: "china", isActive: true },
  { name: "Taiwan", code: "TW", slug: "taiwan", isActive: true },
  { name: "Hong Kong", code: "HK", slug: "hong-kong", isActive: true },
  // Europe
  { name: "United Kingdom", code: "GB", slug: "united-kingdom", isActive: true },
  { name: "Ireland", code: "IE", slug: "ireland", isActive: true },
  { name: "Germany", code: "DE", slug: "germany", isActive: true },
  { name: "France", code: "FR", slug: "france", isActive: true },
  { name: "Netherlands", code: "NL", slug: "netherlands", isActive: true },
  { name: "Spain", code: "ES", slug: "spain", isActive: true },
  { name: "Italy", code: "IT", slug: "italy", isActive: true },
  { name: "Switzerland", code: "CH", slug: "switzerland", isActive: true },
  { name: "Austria", code: "AT", slug: "austria", isActive: true },
  { name: "Portugal", code: "PT", slug: "portugal", isActive: true },
  { name: "Greece", code: "GR", slug: "greece", isActive: true },
  { name: "Sweden", code: "SE", slug: "sweden", isActive: true },
  { name: "Norway", code: "NO", slug: "norway", isActive: true },
  { name: "Denmark", code: "DK", slug: "denmark", isActive: true },
  { name: "Finland", code: "FI", slug: "finland", isActive: true },
  { name: "Poland", code: "PL", slug: "poland", isActive: true },
  { name: "Czech Republic", code: "CZ", slug: "czech-republic", isActive: true },
  { name: "Belgium", code: "BE", slug: "belgium", isActive: true },
  { name: "Romania", code: "RO", slug: "romania", isActive: true },
  { name: "Hungary", code: "HU", slug: "hungary", isActive: true },
  { name: "Ukraine", code: "UA", slug: "ukraine", isActive: true },
  { name: "Croatia", code: "HR", slug: "croatia", isActive: true },
  { name: "Russia", code: "RU", slug: "russia", isActive: true },
  { name: "Turkey", code: "TR", slug: "turkey", isActive: true },
  // North America
  { name: "United States", code: "US", slug: "united-states", isActive: true },
  { name: "Canada", code: "CA", slug: "canada", isActive: true },
  { name: "Mexico", code: "MX", slug: "mexico", isActive: true },
  // South America
  { name: "Brazil", code: "BR", slug: "brazil", isActive: true },
  { name: "Argentina", code: "AR", slug: "argentina", isActive: true },
  { name: "Colombia", code: "CO", slug: "colombia", isActive: true },
  { name: "Peru", code: "PE", slug: "peru", isActive: true },
  { name: "Chile", code: "CL", slug: "chile", isActive: true },
  { name: "Venezuela", code: "VE", slug: "venezuela", isActive: true },
  { name: "Ecuador", code: "EC", slug: "ecuador", isActive: true },
  // Middle East
  { name: "United Arab Emirates", code: "AE", slug: "united-arab-emirates", isActive: true },
  { name: "Saudi Arabia", code: "SA", slug: "saudi-arabia", isActive: true },
  { name: "Qatar", code: "QA", slug: "qatar", isActive: true },
  { name: "Kuwait", code: "KW", slug: "kuwait", isActive: true },
  { name: "Bahrain", code: "BH", slug: "bahrain", isActive: true },
  { name: "Oman", code: "OM", slug: "oman", isActive: true },
  { name: "Jordan", code: "JO", slug: "jordan", isActive: true },
  { name: "Lebanon", code: "LB", slug: "lebanon", isActive: true },
  { name: "Israel", code: "IL", slug: "israel", isActive: true },
  // Africa
  { name: "South Africa", code: "ZA", slug: "south-africa", isActive: true },
  { name: "Kenya", code: "KE", slug: "kenya", isActive: true },
  { name: "Nigeria", code: "NG", slug: "nigeria", isActive: true },
  { name: "Egypt", code: "EG", slug: "egypt", isActive: true },
  { name: "Morocco", code: "MA", slug: "morocco", isActive: true },
  { name: "Tanzania", code: "TZ", slug: "tanzania", isActive: true },
  // Oceania
  { name: "Australia", code: "AU", slug: "australia", isActive: true },
  { name: "New Zealand", code: "NZ", slug: "new-zealand", isActive: true },
];

// ==========================================
// States/Provinces Data
// ==========================================
interface StateData {
  name: string;
  slug: string;
  countryCode: string;
  cities: { name: string; slug: string; isFeatured?: boolean }[];
}

const STATES: StateData[] = [
  // India States
  { name: "Maharashtra", slug: "maharashtra", countryCode: "IN", cities: [
    { name: "Mumbai", slug: "mumbai", isFeatured: true },
    { name: "Pune", slug: "pune", isFeatured: true },
    { name: "Nagpur", slug: "nagpur" },
    { name: "Thane", slug: "thane" },
    { name: "Navi Mumbai", slug: "navi-mumbai" },
  ]},
  { name: "Delhi", slug: "delhi", countryCode: "IN", cities: [
    { name: "New Delhi", slug: "new-delhi", isFeatured: true },
    { name: "Dwarka", slug: "dwarka" },
    { name: "Saket", slug: "saket" },
    { name: "Connaught Place", slug: "connaught-place" },
  ]},
  { name: "Karnataka", slug: "karnataka", countryCode: "IN", cities: [
    { name: "Bengaluru", slug: "bengaluru", isFeatured: true },
    { name: "Mysore", slug: "mysore" },
    { name: "Hubli-Dharwad", slug: "hubli-dharwad" },
  ]},
  { name: "Tamil Nadu", slug: "tamil-nadu", countryCode: "IN", cities: [
    { name: "Chennai", slug: "chennai", isFeatured: true },
    { name: "Coimbatore", slug: "coimbatore" },
    { name: "Madurai", slug: "madurai" },
    { name: "Salem", slug: "salem" },
  ]},
  { name: "Telangana", slug: "telangana", countryCode: "IN", cities: [
    { name: "Hyderabad", slug: "hyderabad", isFeatured: true },
    { name: "Secunderabad", slug: "secunderabad" },
  ]},
  { name: "Gujarat", slug: "gujarat", countryCode: "IN", cities: [
    { name: "Ahmedabad", slug: "ahmedabad", isFeatured: true },
    { name: "Surat", slug: "surat" },
    { name: "Vadodara", slug: "vadodara" },
    { name: "Rajkot", slug: "rajkot" },
  ]},
  { name: "Rajasthan", slug: "rajasthan", countryCode: "IN", cities: [
    { name: "Jaipur", slug: "jaipur", isFeatured: true },
    { name: "Jodhpur", slug: "jodhpur" },
    { name: "Udaipur", slug: "udaipur" },
    { name: "Kota", slug: "kota" },
  ]},
  { name: "West Bengal", slug: "west-bengal", countryCode: "IN", cities: [
    { name: "Kolkata", slug: "kolkata", isFeatured: true },
    { name: "Howrah", slug: "howrah" },
    { name: "Durgapur", slug: "durgapur" },
  ]},
  { name: "Uttar Pradesh", slug: "uttar-pradesh", countryCode: "IN", cities: [
    { name: "Lucknow", slug: "lucknow", isFeatured: true },
    { name: "Noida", slug: "noida" },
    { name: "Gurgaon", slug: "gurgaon" },
    { name: "Agra", slug: "agra" },
    { name: "Varanasi", slug: "varanasi" },
    { name: "Kanpur", slug: "kanpur" },
  ]},
  { name: "Kerala", slug: "kerala", countryCode: "IN", cities: [
    { name: "Kochi", slug: "kochi", isFeatured: true },
    { name: "Thiruvananthapuram", slug: "thiruvananthapuram" },
    { name: "Kozhikode", slug: "kozhikode" },
    { name: "Ernakulam", slug: "ernakulam" },
  ]},
  { name: "Goa", slug: "goa", countryCode: "IN", cities: [
    { name: "Panaji", slug: "panaji", isFeatured: true },
    { name: "Margao", slug: "margao" },
    { name: "Vasco da Gama", slug: "vasco-da-gama" },
  ]},
  { name: "Punjab", slug: "punjab", countryCode: "IN", cities: [
    { name: "Chandigarh", slug: "chandigarh", isFeatured: true },
    { name: "Amritsar", slug: "amritsar" },
    { name: "Ludhiana", slug: "ludhiana" },
  ]},
  { name: "Haryana", slug: "haryana", countryCode: "IN", cities: [
    { name: "Gurugram", slug: "gurugram", isFeatured: true },
    { name: "Faridabad", slug: "faridabad" },
  ]},
  { name: "Andhra Pradesh", slug: "andhra-pradesh", countryCode: "IN", cities: [
    { name: "Visakhapatnam", slug: "visakhapatnam", isFeatured: true },
    { name: "Vijayawada", slug: "vijayawada" },
    { name: "Tirupati", slug: "tirupati" },
  ]},
  // US States
  { name: "California", slug: "california", countryCode: "US", cities: [
    { name: "Los Angeles", slug: "los-angeles", isFeatured: true },
    { name: "San Francisco", slug: "san-francisco", isFeatured: true },
    { name: "San Diego", slug: "san-diego" },
    { name: "Sacramento", slug: "sacramento" },
    { name: "San Jose", slug: "san-jose" },
  ]},
  { name: "New York", slug: "new-york", countryCode: "US", cities: [
    { name: "New York City", slug: "new-york-city", isFeatured: true },
    { name: "Buffalo", slug: "buffalo" },
    { name: "Albany", slug: "albany" },
  ]},
  { name: "Texas", slug: "texas", countryCode: "US", cities: [
    { name: "Houston", slug: "houston", isFeatured: true },
    { name: "Dallas", slug: "dallas", isFeatured: true },
    { name: "Austin", slug: "austin" },
    { name: "San Antonio", slug: "san-antonio" },
  ]},
  { name: "Florida", slug: "florida", countryCode: "US", cities: [
    { name: "Miami", slug: "miami", isFeatured: true },
    { name: "Orlando", slug: "orlando" },
    { name: "Tampa", slug: "tampa" },
  ]},
  { name: "Illinois", slug: "illinois", countryCode: "US", cities: [
    { name: "Chicago", slug: "chicago", isFeatured: true },
  ]},
  { name: "Nevada", slug: "nevada", countryCode: "US", cities: [
    { name: "Las Vegas", slug: "las-vegas", isFeatured: true },
  ]},
  // UK
  { name: "England", slug: "england", countryCode: "GB", cities: [
    { name: "London", slug: "london", isFeatured: true },
    { name: "Manchester", slug: "manchester", isFeatured: true },
    { name: "Birmingham", slug: "birmingham" },
    { name: "Leeds", slug: "leeds" },
    { name: "Liverpool", slug: "liverpool" },
    { name: "Bristol", slug: "bristol" },
  ]},
  { name: "Scotland", slug: "scotland", countryCode: "GB", cities: [
    { name: "Edinburgh", slug: "edinburgh", isFeatured: true },
    { name: "Glasgow", slug: "glasgow" },
  ]},
  // Australia
  { name: "New South Wales", slug: "new-south-wales", countryCode: "AU", cities: [
    { name: "Sydney", slug: "sydney", isFeatured: true },
    { name: "Newcastle", slug: "newcastle" },
  ]},
  { name: "Victoria", slug: "victoria", countryCode: "AU", cities: [
    { name: "Melbourne", slug: "melbourne", isFeatured: true },
  ]},
  { name: "Queensland", slug: "queensland", countryCode: "AU", cities: [
    { name: "Brisbane", slug: "brisbane", isFeatured: true },
    { name: "Gold Coast", slug: "gold-coast" },
  ]},
  // Canada
  { name: "Ontario", slug: "ontario", countryCode: "CA", cities: [
    { name: "Toronto", slug: "toronto", isFeatured: true },
    { name: "Ottawa", slug: "ottawa" },
    { name: "Mississauga", slug: "mississauga" },
  ]},
  { name: "British Columbia", slug: "british-columbia", countryCode: "CA", cities: [
    { name: "Vancouver", slug: "vancouver", isFeatured: true },
    { name: "Victoria", slug: "victoria" },
  ]},
  // UAE
  { name: "Dubai", slug: "dubai", countryCode: "AE", cities: [
    { name: "Dubai City", slug: "dubai-city", isFeatured: true },
    { name: "Marina", slug: "marina" },
    { name: "Jumeirah", slug: "jumeirah" },
    { name: "Business Bay", slug: "business-bay" },
    { name: "Downtown Dubai", slug: "downtown-dubai" },
  ]},
  { name: "Abu Dhabi", slug: "abu-dhabi", countryCode: "AE", cities: [
    { name: "Abu Dhabi City", slug: "abu-dhabi-city", isFeatured: true },
    { name: "Al Ain", slug: "al-ain" },
  ]},
  // Thailand
  { name: "Bangkok", slug: "bangkok", countryCode: "TH", cities: [
    { name: "Bangkok", slug: "bangkok", isFeatured: true },
    { name: "Pattaya", slug: "pattaya" },
    { name: "Phuket", slug: "phuket", isFeatured: true },
    { name: "Chiang Mai", slug: "chiang-mai" },
  ]},
  // Germany
  { name: "Bavaria", slug: "bavaria", countryCode: "DE", cities: [
    { name: "Munich", slug: "munich", isFeatured: true },
    { name: "Nuremberg", slug: "nuremberg" },
  ]},
  { name: "Berlin", slug: "berlin", countryCode: "DE", cities: [
    { name: "Berlin", slug: "berlin", isFeatured: true },
  ]},
];

// ==========================================
// Categories
// ==========================================
const CATEGORIES = [
  { name: "Escorts", slug: "escorts", icon: "👩", color: "#7C3AED", order: 1, isFeatured: true },
  { name: "Massage", slug: "massage", icon: "💆", color: "#EC4899", order: 2, isFeatured: true },
  { name: "Dating", slug: "dating", icon: "💑", color: "#F43F5E", order: 3, isFeatured: true },
  { name: "Companionship", slug: "companionship", icon: "🤝", color: "#10B981", order: 4, isFeatured: true },
  { name: "Adult Services", slug: "adult-services", icon: "⚡", color: "#F59E0B", order: 5, isFeatured: true },
  { name: "Striptease", slug: "striptease", icon: "🎵", color: "#8B5CF6", order: 6, isFeatured: false },
  { name: "BDSM", slug: "bdsm", icon: "🔗", color: "#6366F1", order: 7, isFeatured: false },
  { name: "Fetish", slug: "fetish", icon: "🔥", color: "#DC2626", order: 8, isFeatured: false },
  { name: "Webcam", slug: "webcam", icon: "📷", color: "#0891B2", order: 9, isFeatured: false },
  { name: "Phone & Sexting", slug: "phone-sexting", icon: "📱", color: "#059669", order: 10, isFeatured: false },
  { name: "Events & Parties", slug: "events-parties", icon: "🎉", color: "#D946EF", order: 11, isFeatured: false },
  { name: "Gigolo", slug: "gigolo", icon: "🤵", color: "#0EA5E9", order: 12, isFeatured: false },
];

async function main() {
  console.log("🌱 Seeding geo data...\n");

  // 1. Seed Countries
  console.log(`Seeding ${COUNTRIES.length} countries...`);
  const countryMap = new Map<string, string>();
  for (const country of COUNTRIES) {
    const created = await db.country.upsert({
      where: { code: country.code },
      update: { name: country.name, slug: country.slug, isActive: country.isActive },
      create: country,
    });
    countryMap.set(country.code, created.id);
  }
  console.log(`✅ Countries seeded: ${countryMap.size}\n`);

  // 2. Seed States and Cities
  let stateCount = 0;
  let cityCount = 0;
  for (const state of STATES) {
    const countryId = countryMap.get(state.countryCode);
    if (!countryId) {
      console.warn(`⚠️  Skipping ${state.name} - country ${state.countryCode} not found`);
      continue;
    }

    const createdState = await db.state.create({
      data: {
        name: state.name,
        slug: state.slug,
        countryId,
        isActive: true,
      },
    });
    stateCount++;

    for (const city of state.cities) {
      await db.city.create({
        data: {
          name: city.name,
          slug: city.slug,
          stateId: createdState.id,
          isFeatured: city.isFeatured || false,
          isActive: true,
        },
      });
      cityCount++;
    }
  }
  console.log(`✅ States seeded: ${stateCount}`);
  console.log(`✅ Cities seeded: ${cityCount}\n`);

  // 3. Seed Categories
  console.log(`Seeding ${CATEGORIES.length} categories...`);
  for (const cat of CATEGORIES) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: `${cat.name} listings and services`,
        icon: cat.icon,
        color: cat.color,
        order: cat.order,
        isFeatured: cat.isFeatured,
        isActive: cat.isActive,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: `${cat.name} listings and services`,
        icon: cat.icon,
        color: cat.color,
        order: cat.order,
        isFeatured: cat.isFeatured,
        isActive: cat.isActive,
      },
    });
  }
  console.log(`✅ Categories seeded: ${CATEGORIES.length}\n`);

  console.log("🎉 Seed complete!");
  console.log(`   Countries: ${countryMap.size}`);
  console.log(`   States: ${stateCount}`);
  console.log(`   Cities: ${cityCount}`);
  console.log(`   Categories: ${CATEGORIES.length}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

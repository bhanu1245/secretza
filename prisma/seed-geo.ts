// ==========================================
// Enterprise Geo Seed Script
// ==========================================
// Seeds Country, State, City, and District data.
// Run with: bunx tsx prisma/seed-geo.ts
//
// Idempotent: safe to run multiple times (skips existing records).
// ==========================================

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ==========================================
// Countries
// ==========================================
const COUNTRIES = [
  { name: "India", code: "IN", slug: "india" },
  { name: "United States", code: "US", slug: "united-states" },
  { name: "United Kingdom", code: "GB", slug: "united-kingdom" },
  { name: "Canada", code: "CA", slug: "canada" },
  { name: "Australia", code: "AU", slug: "australia" },
  { name: "Germany", code: "DE", slug: "germany" },
  { name: "France", code: "FR", slug: "france" },
  { name: "Japan", code: "JP", slug: "japan" },
  { name: "South Korea", code: "KR", slug: "south-korea" },
  { name: "China", code: "CN", slug: "china" },
  { name: "Brazil", code: "BR", slug: "brazil" },
  { name: "Mexico", code: "MX", slug: "mexico" },
  { name: "Argentina", code: "AR", slug: "argentina" },
  { name: "Colombia", code: "CO", slug: "colombia" },
  { name: "Russia", code: "RU", slug: "russia" },
  { name: "Italy", code: "IT", slug: "italy" },
  { name: "Spain", code: "ES", slug: "spain" },
  { name: "Netherlands", code: "NL", slug: "netherlands" },
  { name: "Belgium", code: "BE", slug: "belgium" },
  { name: "Switzerland", code: "CH", slug: "switzerland" },
  { name: "Austria", code: "AT", slug: "austria" },
  { name: "Sweden", code: "SE", slug: "sweden" },
  { name: "Norway", code: "NO", slug: "norway" },
  { name: "Denmark", code: "DK", slug: "denmark" },
  { name: "Finland", code: "FI", slug: "finland" },
  { name: "Ireland", code: "IE", slug: "ireland" },
  { name: "Portugal", code: "PT", slug: "portugal" },
  { name: "Poland", code: "PL", slug: "poland" },
  { name: "Czech Republic", code: "CZ", slug: "czech-republic" },
  { name: "Turkey", code: "TR", slug: "turkey" },
  { name: "UAE", code: "AE", slug: "uae" },
  { name: "Saudi Arabia", code: "SA", slug: "saudi-arabia" },
  { name: "South Africa", code: "ZA", slug: "south-africa" },
  { name: "Nigeria", code: "NG", slug: "nigeria" },
  { name: "Kenya", code: "KE", slug: "kenya" },
  { name: "Egypt", code: "EG", slug: "egypt" },
  { name: "Thailand", code: "TH", slug: "thailand" },
  { name: "Vietnam", code: "VN", slug: "vietnam" },
  { name: "Philippines", code: "PH", slug: "philippines" },
  { name: "Indonesia", code: "ID", slug: "indonesia" },
  { name: "Malaysia", code: "MY", slug: "malaysia" },
  { name: "Singapore", code: "SG", slug: "singapore" },
  { name: "New Zealand", code: "NZ", slug: "new-zealand" },
  { name: "Israel", code: "IL", slug: "israel" },
  { name: "Greece", code: "GR", slug: "greece" },
  { name: "Romania", code: "RO", slug: "romania" },
  { name: "Ukraine", code: "UA", slug: "ukraine" },
  { name: "Hungary", code: "HU", slug: "hungary" },
  { name: "Pakistan", code: "PK", slug: "pakistan" },
  { name: "Bangladesh", code: "BD", slug: "bangladesh" },
  { name: "Sri Lanka", code: "LK", slug: "sri-lanka" },
  { name: "Nepal", code: "NP", slug: "nepal" },
];

// ==========================================
// States/Provinces (countryCode, name, slug)
// ==========================================
const STATES: Array<{ countryCode: string; name: string; slug: string }> = [
  // India
  { countryCode: "IN", name: "Maharashtra", slug: "maharashtra" },
  { countryCode: "IN", name: "Delhi", slug: "delhi" },
  { countryCode: "IN", name: "Karnataka", slug: "karnataka" },
  { countryCode: "IN", name: "Tamil Nadu", slug: "tamil-nadu" },
  { countryCode: "IN", name: "Telangana", slug: "telangana" },
  { countryCode: "IN", name: "West Bengal", slug: "west-bengal" },
  { countryCode: "IN", name: "Gujarat", slug: "gujarat" },
  { countryCode: "IN", name: "Rajasthan", slug: "rajasthan" },
  { countryCode: "IN", name: "Uttar Pradesh", slug: "uttar-pradesh" },
  { countryCode: "IN", name: "Madhya Pradesh", slug: "madhya-pradesh" },
  { countryCode: "IN", name: "Kerala", slug: "kerala" },
  { countryCode: "IN", name: "Punjab", slug: "punjab" },
  { countryCode: "IN", name: "Haryana", slug: "haryana" },
  { countryCode: "IN", name: "Bihar", slug: "bihar" },
  { countryCode: "IN", name: "Odisha", slug: "odisha" },
  { countryCode: "IN", name: "Andhra Pradesh", slug: "andhra-pradesh" },
  // US
  { countryCode: "US", name: "California", slug: "california" },
  { countryCode: "US", name: "New York", slug: "new-york" },
  { countryCode: "US", name: "Texas", slug: "texas" },
  { countryCode: "US", name: "Florida", slug: "florida" },
  { countryCode: "US", name: "Illinois", slug: "illinois" },
  { countryCode: "US", name: "Pennsylvania", slug: "pennsylvania" },
  { countryCode: "US", name: "Ohio", slug: "ohio" },
  { countryCode: "US", name: "Georgia", slug: "georgia" },
  { countryCode: "US", name: "Washington", slug: "washington" },
  { countryCode: "US", name: "Massachusetts", slug: "massachusetts" },
  { countryCode: "US", name: "Arizona", slug: "arizona" },
  { countryCode: "US", name: "Nevada", slug: "nevada" },
  { countryCode: "US", name: "Colorado", slug: "colorado" },
  // UK
  { countryCode: "GB", name: "England", slug: "england" },
  { countryCode: "GB", name: "Scotland", slug: "scotland" },
  { countryCode: "GB", name: "Wales", slug: "wales" },
  { countryCode: "GB", name: "Northern Ireland", slug: "northern-ireland" },
  // Canada
  { countryCode: "CA", name: "Ontario", slug: "ontario" },
  { countryCode: "CA", name: "Quebec", slug: "quebec" },
  { countryCode: "CA", name: "British Columbia", slug: "british-columbia" },
  { countryCode: "CA", name: "Alberta", slug: "alberta" },
  // Australia
  { countryCode: "AU", name: "New South Wales", slug: "new-south-wales" },
  { countryCode: "AU", name: "Victoria", slug: "victoria" },
  { countryCode: "AU", name: "Queensland", slug: "queensland" },
  { countryCode: "AU", name: "Western Australia", slug: "western-australia" },
  // Germany
  { countryCode: "DE", name: "Bavaria", slug: "bavaria" },
  { countryCode: "DE", name: "Berlin", slug: "berlin" },
  { countryCode: "DE", name: "Hamburg", slug: "hamburg" },
  { countryCode: "DE", name: "Hesse", slug: "hesse" },
  { countryCode: "DE", name: "North Rhine-Westphalia", slug: "north-rhine-westphalia" },
  // France
  { countryCode: "FR", name: "Ile-de-France", slug: "ile-de-france" },
  { countryCode: "FR", name: "Provence-Alpes-Cote d'Azur", slug: "provence-alpes-cote-dazur" },
  { countryCode: "FR", name: "Auvergne-Rhone-Alpes", slug: "auvergne-rhone-alpes" },
  { countryCode: "FR", name: "Occitanie", slug: "occitanie" },
  // Japan
  { countryCode: "JP", name: "Tokyo", slug: "tokyo" },
  { countryCode: "JP", name: "Osaka", slug: "osaka" },
  { countryCode: "JP", name: "Kyoto", slug: "kyoto" },
  { countryCode: "JP", name: "Hokkaido", slug: "hokkaido" },
  // South Korea
  { countryCode: "KR", name: "Seoul", slug: "seoul" },
  { countryCode: "KR", name: "Gyeonggi", slug: "gyeonggi" },
  { countryCode: "KR", name: "Busan", slug: "busan" },
  // Brazil
  { countryCode: "BR", name: "Sao Paulo", slug: "sao-paulo" },
  { countryCode: "BR", name: "Rio de Janeiro", slug: "rio-de-janeiro" },
  { countryCode: "BR", name: "Minas Gerais", slug: "minas-gerais" },
  // UAE
  { countryCode: "AE", name: "Dubai", slug: "dubai" },
  { countryCode: "AE", name: "Abu Dhabi", slug: "abu-dhabi" },
  { countryCode: "AE", name: "Sharjah", slug: "sharjah" },
  // Turkey
  { countryCode: "TR", name: "Istanbul", slug: "istanbul" },
  { countryCode: "TR", name: "Ankara", slug: "ankara" },
  { countryCode: "TR", name: "Izmir", slug: "izmir" },
  // South Africa
  { countryCode: "ZA", name: "Gauteng", slug: "gauteng" },
  { countryCode: "ZA", name: "Western Cape", slug: "western-cape" },
  { countryCode: "ZA", name: "KwaZulu-Natal", slug: "kwazulu-natal" },
  // Singapore
  { countryCode: "SG", name: "Central Region", slug: "central-region" },
];

// ==========================================
// Cities (countryCode, stateSlug, name, slug, isFeatured)
// ==========================================
const CITIES: Array<{ countryCode: string; stateSlug: string; name: string; slug: string; isFeatured?: boolean }> = [
  // India
  { countryCode: "IN", stateSlug: "maharashtra", name: "Mumbai", slug: "mumbai", isFeatured: true },
  { countryCode: "IN", stateSlug: "maharashtra", name: "Pune", slug: "pune", isFeatured: true },
  { countryCode: "IN", stateSlug: "delhi", name: "New Delhi", slug: "new-delhi", isFeatured: true },
  { countryCode: "IN", stateSlug: "karnataka", name: "Bangalore", slug: "bangalore", isFeatured: true },
  { countryCode: "IN", stateSlug: "tamil-nadu", name: "Chennai", slug: "chennai", isFeatured: true },
  { countryCode: "IN", stateSlug: "telangana", name: "Hyderabad", slug: "hyderabad", isFeatured: true },
  { countryCode: "IN", stateSlug: "west-bengal", name: "Kolkata", slug: "kolkata", isFeatured: true },
  { countryCode: "IN", stateSlug: "gujarat", name: "Ahmedabad", slug: "ahmedabad", isFeatured: true },
  { countryCode: "IN", stateSlug: "rajasthan", name: "Jaipur", slug: "jaipur", isFeatured: true },
  { countryCode: "IN", stateSlug: "uttar-pradesh", name: "Lucknow", slug: "lucknow" },
  { countryCode: "IN", stateSlug: "madhya-pradesh", name: "Bhopal", slug: "bhopal" },
  { countryCode: "IN", stateSlug: "kerala", name: "Kochi", slug: "kochi" },
  { countryCode: "IN", stateSlug: "kerala", name: "Thiruvananthapuram", slug: "thiruvananthapuram" },
  { countryCode: "IN", stateSlug: "punjab", name: "Chandigarh", slug: "chandigarh" },
  { countryCode: "IN", stateSlug: "haryana", name: "Gurgaon", slug: "gurgaon" },
  { countryCode: "IN", stateSlug: "haryana", name: "Faridabad", slug: "faridabad" },
  { countryCode: "IN", stateSlug: "bihar", name: "Patna", slug: "patna" },
  { countryCode: "IN", stateSlug: "odisha", name: "Bhubaneswar", slug: "bhubaneswar" },
  { countryCode: "IN", stateSlug: "andhra-pradesh", name: "Visakhapatnam", slug: "visakhapatnam" },
  { countryCode: "IN", stateSlug: "gujarat", name: "Surat", slug: "surat" },
  { countryCode: "IN", stateSlug: "maharashtra", name: "Nagpur", slug: "nagpur" },
  { countryCode: "IN", stateSlug: "rajasthan", name: "Udaipur", slug: "udaipur" },
  { countryCode: "IN", stateSlug: "uttar-pradesh", name: "Agra", slug: "agra" },
  { countryCode: "IN", stateSlug: "karnataka", name: "Mysore", slug: "mysore" },
  { countryCode: "IN", stateSlug: "tamil-nadu", name: "Coimbatore", slug: "coimbatore" },
  // US
  { countryCode: "US", stateSlug: "california", name: "Los Angeles", slug: "los-angeles", isFeatured: true },
  { countryCode: "US", stateSlug: "california", name: "San Francisco", slug: "san-francisco", isFeatured: true },
  { countryCode: "US", stateSlug: "california", name: "San Diego", slug: "san-diego" },
  { countryCode: "US", stateSlug: "new-york", name: "New York City", slug: "new-york-city", isFeatured: true },
  { countryCode: "US", stateSlug: "texas", name: "Houston", slug: "houston" },
  { countryCode: "US", stateSlug: "texas", name: "Dallas", slug: "dallas" },
  { countryCode: "US", stateSlug: "texas", name: "Austin", slug: "austin" },
  { countryCode: "US", stateSlug: "florida", name: "Miami", slug: "miami", isFeatured: true },
  { countryCode: "US", stateSlug: "florida", name: "Orlando", slug: "orlando" },
  { countryCode: "US", stateSlug: "illinois", name: "Chicago", slug: "chicago", isFeatured: true },
  { countryCode: "US", stateSlug: "pennsylvania", name: "Philadelphia", slug: "philadelphia" },
  { countryCode: "US", stateSlug: "washington", name: "Seattle", slug: "seattle", isFeatured: true },
  { countryCode: "US", stateSlug: "massachusetts", name: "Boston", slug: "boston" },
  { countryCode: "US", stateSlug: "arizona", name: "Phoenix", slug: "phoenix" },
  { countryCode: "US", stateSlug: "nevada", name: "Las Vegas", slug: "las-vegas" },
  { countryCode: "US", stateSlug: "colorado", name: "Denver", slug: "denver" },
  // UK
  { countryCode: "GB", stateSlug: "england", name: "London", slug: "london", isFeatured: true },
  { countryCode: "GB", stateSlug: "england", name: "Manchester", slug: "manchester" },
  { countryCode: "GB", stateSlug: "england", name: "Birmingham", slug: "birmingham" },
  { countryCode: "GB", stateSlug: "england", name: "Liverpool", slug: "liverpool" },
  { countryCode: "GB", stateSlug: "england", name: "Leeds", slug: "leeds" },
  { countryCode: "GB", stateSlug: "scotland", name: "Edinburgh", slug: "edinburgh" },
  { countryCode: "GB", stateSlug: "scotland", name: "Glasgow", slug: "glasgow" },
  { countryCode: "GB", stateSlug: "wales", name: "Cardiff", slug: "cardiff" },
  // Canada
  { countryCode: "CA", stateSlug: "ontario", name: "Toronto", slug: "toronto", isFeatured: true },
  { countryCode: "CA", stateSlug: "ontario", name: "Ottawa", slug: "ottawa" },
  { countryCode: "CA", stateSlug: "quebec", name: "Montreal", slug: "montreal", isFeatured: true },
  { countryCode: "CA", stateSlug: "quebec", name: "Quebec City", slug: "quebec-city" },
  { countryCode: "CA", stateSlug: "british-columbia", name: "Vancouver", slug: "vancouver", isFeatured: true },
  { countryCode: "CA", stateSlug: "alberta", name: "Calgary", slug: "calgary" },
  { countryCode: "CA", stateSlug: "alberta", name: "Edmonton", slug: "edmonton" },
  // Australia
  { countryCode: "AU", stateSlug: "new-south-wales", name: "Sydney", slug: "sydney", isFeatured: true },
  { countryCode: "AU", stateSlug: "victoria", name: "Melbourne", slug: "melbourne", isFeatured: true },
  { countryCode: "AU", stateSlug: "queensland", name: "Brisbane", slug: "brisbane" },
  { countryCode: "AU", stateSlug: "western-australia", name: "Perth", slug: "perth" },
  { countryCode: "AU", stateSlug: "new-south-wales", name: "Canberra", slug: "canberra" },
  // Germany
  { countryCode: "DE", stateSlug: "berlin", name: "Berlin", slug: "berlin", isFeatured: true },
  { countryCode: "DE", stateSlug: "bavaria", name: "Munich", slug: "munich", isFeatured: true },
  { countryCode: "DE", stateSlug: "hamburg", name: "Hamburg", slug: "hamburg" },
  { countryCode: "DE", stateSlug: "hesse", name: "Frankfurt", slug: "frankfurt" },
  { countryCode: "DE", stateSlug: "north-rhine-westphalia", name: "Cologne", slug: "cologne" },
  { countryCode: "DE", stateSlug: "north-rhine-westphalia", name: "Dusseldorf", slug: "dusseldorf" },
  // France
  { countryCode: "FR", stateSlug: "ile-de-france", name: "Paris", slug: "paris", isFeatured: true },
  { countryCode: "FR", stateSlug: "provence-alpes-cote-dazur", name: "Nice", slug: "nice" },
  { countryCode: "FR", stateSlug: "provence-alpes-cote-dazur", name: "Marseille", slug: "marseille" },
  { countryCode: "FR", stateSlug: "auvergne-rhone-alpes", name: "Lyon", slug: "lyon" },
  // Japan
  { countryCode: "JP", stateSlug: "tokyo", name: "Tokyo", slug: "tokyo", isFeatured: true },
  { countryCode: "JP", stateSlug: "osaka", name: "Osaka", slug: "osaka" },
  { countryCode: "JP", stateSlug: "kyoto", name: "Kyoto", slug: "kyoto" },
  // South Korea
  { countryCode: "KR", stateSlug: "seoul", name: "Seoul", slug: "seoul", isFeatured: true },
  { countryCode: "KR", stateSlug: "busan", name: "Busan", slug: "busan" },
  // Brazil
  { countryCode: "BR", stateSlug: "sao-paulo", name: "Sao Paulo", slug: "sao-paulo", isFeatured: true },
  { countryCode: "BR", stateSlug: "rio-de-janeiro", name: "Rio de Janeiro", slug: "rio-de-janeiro", isFeatured: true },
  // UAE
  { countryCode: "AE", stateSlug: "dubai", name: "Dubai", slug: "dubai", isFeatured: true },
  { countryCode: "AE", stateSlug: "abu-dhabi", name: "Abu Dhabi", slug: "abu-dhabi" },
  { countryCode: "AE", stateSlug: "sharjah", name: "Sharjah", slug: "sharjah" },
  // Turkey
  { countryCode: "TR", stateSlug: "istanbul", name: "Istanbul", slug: "istanbul", isFeatured: true },
  { countryCode: "TR", stateSlug: "ankara", name: "Ankara", slug: "ankara" },
  { countryCode: "TR", stateSlug: "izmir", name: "Izmir", slug: "izmir" },
  // South Africa
  { countryCode: "ZA", stateSlug: "gauteng", name: "Johannesburg", slug: "johannesburg", isFeatured: true },
  { countryCode: "ZA", stateSlug: "gauteng", name: "Pretoria", slug: "pretoria" },
  { countryCode: "ZA", stateSlug: "western-cape", name: "Cape Town", slug: "cape-town", isFeatured: true },
  { countryCode: "ZA", stateSlug: "kwazulu-natal", name: "Durban", slug: "durban" },
  // Singapore
  { countryCode: "SG", stateSlug: "central-region", name: "Singapore", slug: "singapore", isFeatured: true },
  // Thailand
  { countryCode: "TH", name: "Bangkok", slug: "bangkok", stateSlug: "", isFeatured: true },
  // Italy
  { countryCode: "IT", name: "Rome", slug: "rome", stateSlug: "", isFeatured: true },
  { countryCode: "IT", name: "Milan", slug: "milan", stateSlug: "" },
  // Spain
  { countryCode: "ES", name: "Madrid", slug: "madrid", stateSlug: "", isFeatured: true },
  { countryCode: "ES", name: "Barcelona", slug: "barcelona", stateSlug: "" },
  // Netherlands
  { countryCode: "NL", name: "Amsterdam", slug: "amsterdam", stateSlug: "", isFeatured: true },
  // Israel
  { countryCode: "IL", name: "Tel Aviv", slug: "tel-aviv", stateSlug: "", isFeatured: true },
  // Greece
  { countryCode: "GR", name: "Athens", slug: "athens", stateSlug: "" },
  // Mexico
  { countryCode: "MX", name: "Mexico City", slug: "mexico-city", stateSlug: "", isFeatured: true },
  // Argentina
  { countryCode: "AR", name: "Buenos Aires", slug: "buenos-aires", stateSlug: "", isFeatured: true },
  // New Zealand
  { countryCode: "NZ", name: "Auckland", slug: "auckland", stateSlug: "" },
];

// ==========================================
// Districts (citySlug, countryCode, name, slug)
// ==========================================
const DISTRICTS: Array<{ citySlug: string; countryCode: string; name: string; slug: string }> = [
  // Mumbai
  { citySlug: "mumbai", countryCode: "IN", name: "Andheri", slug: "andheri" },
  { citySlug: "mumbai", countryCode: "IN", name: "Bandra", slug: "bandra" },
  { citySlug: "mumbai", countryCode: "IN", name: "Juhu", slug: "juhu" },
  { citySlug: "mumbai", countryCode: "IN", name: "Worli", slug: "worli" },
  { citySlug: "mumbai", countryCode: "IN", name: "Colaba", slug: "colaba" },
  { citySlug: "mumbai", countryCode: "IN", name: "Powai", slug: "powai" },
  { citySlug: "mumbai", countryCode: "IN", name: "Malad", slug: "malad" },
  { citySlug: "mumbai", countryCode: "IN", name: "Borivali", slug: "borivali" },
  { citySlug: "mumbai", countryCode: "IN", name: "Thane", slug: "thane" },
  { citySlug: "mumbai", countryCode: "IN", name: "Navi Mumbai", slug: "navi-mumbai" },
  { citySlug: "mumbai", countryCode: "IN", name: "Vashi", slug: "vashi" },
  { citySlug: "mumbai", countryCode: "IN", name: "Churchgate", slug: "churchgate" },
  { citySlug: "mumbai", countryCode: "IN", name: "Dadar", slug: "dadar" },
  { citySlug: "mumbai", countryCode: "IN", name: "Lower Parel", slug: "lower-parel" },
  { citySlug: "mumbai", countryCode: "IN", name: "Kurla", slug: "kurla" },
  // Delhi
  { citySlug: "new-delhi", countryCode: "IN", name: "Connaught Place", slug: "connaught-place" },
  { citySlug: "new-delhi", countryCode: "IN", name: "South Delhi", slug: "south-delhi" },
  { citySlug: "new-delhi", countryCode: "IN", name: "North Delhi", slug: "north-delhi" },
  { citySlug: "new-delhi", countryCode: "IN", name: "East Delhi", slug: "east-delhi" },
  { citySlug: "new-delhi", countryCode: "IN", name: "West Delhi", slug: "west-delhi" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Dwarka", slug: "dwarka" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Rohini", slug: "rohini" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Saket", slug: "saket" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Karol Bagh", slug: "karol-bagh" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Lajpat Nagar", slug: "lajpat-nagar" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Greater Kailash", slug: "greater-kailash" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Hauz Khas", slug: "hauz-khas" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Chanakyapuri", slug: "chanakyapuri" },
  { citySlug: "new-delhi", countryCode: "IN", name: "Mehrauli", slug: "mehrauli" },
  // Bangalore
  { citySlug: "bangalore", countryCode: "IN", name: "Koramangala", slug: "koramangala" },
  { citySlug: "bangalore", countryCode: "IN", name: "Indiranagar", slug: "indiranagar" },
  { citySlug: "bangalore", countryCode: "IN", name: "Whitefield", slug: "whitefield" },
  { citySlug: "bangalore", countryCode: "IN", name: "Electronic City", slug: "electronic-city" },
  { citySlug: "bangalore", countryCode: "IN", name: "HSR Layout", slug: "hsr-layout" },
  { citySlug: "bangalore", countryCode: "IN", name: "Jayanagar", slug: "jayanagar" },
  { citySlug: "bangalore", countryCode: "IN", name: "MG Road", slug: "mg-road" },
  { citySlug: "bangalore", countryCode: "IN", name: "Bannerghatta Road", slug: "bannerghatta-road" },
  { citySlug: "bangalore", countryCode: "IN", name: "Marathahalli", slug: "marathahalli" },
  { citySlug: "bangalore", countryCode: "IN", name: "Yelahanka", slug: "yelahanka" },
  // Chennai
  { citySlug: "chennai", countryCode: "IN", name: "T. Nagar", slug: "t-nagar" },
  { citySlug: "chennai", countryCode: "IN", name: "Adyar", slug: "adyar" },
  { citySlug: "chennai", countryCode: "IN", name: "Anna Nagar", slug: "anna-nagar" },
  { citySlug: "chennai", countryCode: "IN", name: "Velachery", slug: "velachery" },
  { citySlug: "chennai", countryCode: "IN", name: "Nungambakkam", slug: "nungambakkam" },
  { citySlug: "chennai", countryCode: "IN", name: "Egmore", slug: "egmore" },
  { citySlug: "chennai", countryCode: "IN", name: "Guindy", slug: "guindy" },
  { citySlug: "chennai", countryCode: "IN", name: "OMR", slug: "omr" },
  { citySlug: "chennai", countryCode: "IN", name: "Porur", slug: "porur" },
  // Hyderabad
  { citySlug: "hyderabad", countryCode: "IN", name: "Banjara Hills", slug: "banjara-hills" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Jubilee Hills", slug: "jubilee-hills" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Madhapur", slug: "madhapur" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Hitech City", slug: "hitech-city" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Gachibowli", slug: "gachibowli" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Secunderabad", slug: "secunderabad" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Ameerpet", slug: "ameerpet" },
  { citySlug: "hyderabad", countryCode: "IN", name: "Kukatpally", slug: "kukatpally" },
  // Kolkata
  { citySlug: "kolkata", countryCode: "IN", name: "Park Street", slug: "park-street" },
  { citySlug: "kolkata", countryCode: "IN", name: "Salt Lake", slug: "salt-lake" },
  { citySlug: "kolkata", countryCode: "IN", name: "New Town", slug: "new-town" },
  { citySlug: "kolkata", countryCode: "IN", name: "Howrah", slug: "howrah" },
  { citySlug: "kolkata", countryCode: "IN", name: "Dum Dum", slug: "dum-dum" },
  { citySlug: "kolkata", countryCode: "IN", name: "Gariahat", slug: "gariahat" },
  { citySlug: "kolkata", countryCode: "IN", name: "Behala", slug: "behala" },
];

// ==========================================
// Seed functions
// ==========================================

async function seedCountries() {
  console.log(`\n  Seeding ${COUNTRIES.length} countries...`);
  let created = 0;
  let updated = 0;
  const countryMap = new Map<string, string>();

  for (const c of COUNTRIES) {
    const result = await db.country.upsert({
      where: { code: c.code },
      update: { name: c.name, slug: c.slug, isActive: true },
      create: { name: c.name, code: c.code, slug: c.slug, isActive: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
    countryMap.set(c.code, result.id);
  }

  console.log(`  Countries: ${created} created, ${updated} updated`);
  return countryMap;
}

async function seedStates(countryMap: Map<string, string>) {
  console.log(`\n  Seeding ${STATES.length} states/provinces...`);
  let created = 0;
  let skipped = 0;
  const stateIdMap = new Map<string, string>();

  for (const s of STATES) {
    const countryId = countryMap.get(s.countryCode);
    if (!countryId) { skipped++; continue; }

    const existing = await db.state.findUnique({
      where: { slug_countryId: { slug: s.slug, countryId } },
    });
    if (existing) {
      stateIdMap.set(`${s.countryCode}:${s.slug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.state.create({
      data: { name: s.name, slug: s.slug, countryId, isActive: true },
    });
    stateIdMap.set(`${s.countryCode}:${s.slug}`, result.id);
    created++;
  }

  console.log(`  States: ${created} created, ${skipped} already exist`);
  return stateIdMap;
}

async function seedCities(stateIdMap: Map<string, string>) {
  console.log(`\n  Seeding ${CITIES.length} cities...`);
  let created = 0;
  let skipped = 0;
  const cityIdMap = new Map<string, string>(); // "countryCode:citySlug" -> id

  for (const c of CITIES) {
    // Find the state ID
    let stateId: string | undefined;

    if (c.stateSlug) {
      stateId = stateIdMap.get(`${c.countryCode}:${c.stateSlug}`);
    }

    // For cities without state slugs, find any state in that country
    if (!stateId) {
      const country = await db.country.findUnique({ where: { code: c.countryCode } });
      if (country) {
        const anyState = await db.state.findFirst({ where: { countryId: country.id } });
        if (anyState) stateId = anyState.id;
      }
    }

    if (!stateId) { skipped++; continue; }

    const existing = await db.city.findUnique({
      where: { slug_stateId: { slug: c.slug, stateId } },
    });
    if (existing) {
      cityIdMap.set(`${c.countryCode}:${c.slug}`, existing.id);
      skipped++;
      continue;
    }

    const result = await db.city.create({
      data: {
        name: c.name,
        slug: c.slug,
        stateId,
        isActive: true,
        isFeatured: c.isFeatured || false,
      },
    });
    cityIdMap.set(`${c.countryCode}:${c.slug}`, result.id);
    created++;
  }

  console.log(`  Cities: ${created} created, ${skipped} already exist`);
  return cityIdMap;
}

async function seedDistricts(cityIdMap: Map<string, string>) {
  console.log(`\n  Seeding ${DISTRICTS.length} districts...`);
  let created = 0;
  let skipped = 0;

  for (const d of DISTRICTS) {
    const cityId = cityIdMap.get(`${d.countryCode}:${d.citySlug}`);
    if (!cityId) { skipped++; continue; }

    const existing = await db.district.findUnique({
      where: { slug_cityId: { slug: d.slug, cityId } },
    });
    if (existing) { skipped++; continue; }

    await db.district.create({
      data: { name: d.name, slug: d.slug, cityId, isActive: true },
    });
    created++;
  }

  console.log(`  Districts: ${created} created, ${skipped} already exist`);
}

// ==========================================
// Main
// ==========================================
async function main() {
  console.log("Geo Seed - Starting...\n");

  const countryMap = await seedCountries();
  const stateIdMap = await seedStates(countryMap);
  const cityIdMap = await seedCities(stateIdMap);
  await seedDistricts(cityIdMap);

  console.log("\nGeo Seed complete!");
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => db.$disconnect());

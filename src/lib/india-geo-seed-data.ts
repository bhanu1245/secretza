// ============================================================================
// India Geo Seed Data — Comprehensive Districts & Localities
// ============================================================================
// Supplements india-geo-data.ts (states + cities) with district and locality
// data for all major Indian cities. Used by prisma/seed-geo.ts to populate
// the District and Locality tables.
// ============================================================================

export interface IndiaSeedState {
  name: string;
  slug: string;
  type: "state" | "ut";
}

export interface IndiaSeedDistrict {
  citySlug: string;
  stateSlug: string;
  name: string;
  slug: string;
}

export interface IndiaSeedLocality {
  citySlug: string;
  stateSlug: string;
  districtSlug: string;
  name: string;
  slug: string;
}

// ============================================================================
// All 36 States & Union Territories
// ============================================================================
export const indiaAllStates: IndiaSeedState[] = [
  { name: "Andhra Pradesh", slug: "andhra-pradesh", type: "state" },
  { name: "Arunachal Pradesh", slug: "arunachal-pradesh", type: "state" },
  { name: "Assam", slug: "assam", type: "state" },
  { name: "Bihar", slug: "bihar", type: "state" },
  { name: "Chhattisgarh", slug: "chhattisgarh", type: "state" },
  { name: "Goa", slug: "goa", type: "state" },
  { name: "Gujarat", slug: "gujarat", type: "state" },
  { name: "Haryana", slug: "haryana", type: "state" },
  { name: "Himachal Pradesh", slug: "himachal-pradesh", type: "state" },
  { name: "Jharkhand", slug: "jharkhand", type: "state" },
  { name: "Karnataka", slug: "karnataka", type: "state" },
  { name: "Kerala", slug: "kerala", type: "state" },
  { name: "Madhya Pradesh", slug: "madhya-pradesh", type: "state" },
  { name: "Maharashtra", slug: "maharashtra", type: "state" },
  { name: "Manipur", slug: "manipur", type: "state" },
  { name: "Meghalaya", slug: "meghalaya", type: "state" },
  { name: "Mizoram", slug: "mizoram", type: "state" },
  { name: "Nagaland", slug: "nagaland", type: "state" },
  { name: "Odisha", slug: "odisha", type: "state" },
  { name: "Punjab", slug: "punjab", type: "state" },
  { name: "Rajasthan", slug: "rajasthan", type: "state" },
  { name: "Sikkim", slug: "sikkim", type: "state" },
  { name: "Tamil Nadu", slug: "tamil-nadu", type: "state" },
  { name: "Telangana", slug: "telangana", type: "state" },
  { name: "Tripura", slug: "tripura", type: "state" },
  { name: "Uttar Pradesh", slug: "uttar-pradesh", type: "state" },
  { name: "Uttarakhand", slug: "uttarakhand", type: "state" },
  { name: "West Bengal", slug: "west-bengal", type: "state" },
  { name: "Andaman and Nicobar Islands", slug: "andaman-nicobar", type: "ut" },
  { name: "Chandigarh", slug: "chandigarh", type: "ut" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", slug: "dadra-nagar-haveli", type: "ut" },
  { name: "Delhi", slug: "delhi", type: "ut" },
  { name: "Jammu and Kashmir", slug: "jammu-kashmir", type: "ut" },
  { name: "Ladakh", slug: "ladakh", type: "ut" },
  { name: "Lakshadweep", slug: "lakshadweep", type: "ut" },
  { name: "Puducherry", slug: "puducherry", type: "ut" },
];

// ============================================================================
// Districts (areas within cities)
// ============================================================================
export const indiaDistricts: IndiaSeedDistrict[] = [
  // === MUMBAI (15 districts) ===
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Andheri", slug: "andheri" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Bandra", slug: "bandra" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Juhu", slug: "juhu" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Worli", slug: "worli" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Colaba", slug: "colaba" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Powai", slug: "powai" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Malad", slug: "malad" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Borivali", slug: "borivali" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Churchgate", slug: "churchgate" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Dadar", slug: "dadar" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Lower Parel", slug: "lower-parel" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Kurla", slug: "kurla" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Goregaon", slug: "goregaon" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Vile Parle", slug: "vile-parle" },
  { citySlug: "mumbai", stateSlug: "maharashtra", name: "Mulund", slug: "mulund" },

  // === PUNE (10 districts) ===
  { citySlug: "pune", stateSlug: "maharashtra", name: "Hinjewadi", slug: "hinjewadi" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Koregaon Park", slug: "koregaon-park" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Viman Nagar", slug: "viman-nagar" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Baner", slug: "baner" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Pashan", slug: "pashan" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Aundh", slug: "aundh" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Kothrud", slug: "kothrud" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Hadapsar", slug: "hadapsar" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Magarpatta", slug: "magarpatta" },
  { citySlug: "pune", stateSlug: "maharashtra", name: "Wakad", slug: "wakad" },

  // === NAGPUR (6 districts) ===
  { citySlug: "nagpur", stateSlug: "maharashtra", name: "Dharampeth", slug: "dharampeth" },
  { citySlug: "nagpur", stateSlug: "maharashtra", name: "Sitabuldi", slug: "sitabuldi" },
  { citySlug: "nagpur", stateSlug: "maharashtra", name: "Civil Lines", slug: "civil-lines" },
  { citySlug: "nagpur", stateSlug: "maharashtra", name: "Dhantoli", slug: "dhantoli" },
  { citySlug: "nagpur", stateSlug: "maharashtra", name: "Wardha Road", slug: "wardha-road" },
  { citySlug: "nagpur", stateSlug: "maharashtra", name: "Manish Nagar", slug: "manish-nagar" },

  // === NASHIK (5 districts) ===
  { citySlug: "nashik", stateSlug: "maharashtra", name: "Panchavati", slug: "panchavati" },
  { citySlug: "nashik", stateSlug: "maharashtra", name: "College Road", slug: "college-road" },
  { citySlug: "nashik", stateSlug: "maharashtra", name: "Indira Nagar", slug: "indira-nagar" },
  { citySlug: "nashik", stateSlug: "maharashtra", name: "Satpur", slug: "satpur" },
  { citySlug: "nashik", stateSlug: "maharashtra", name: "Gangapur Road", slug: "gangapur-road" },

  // === THANE (5 districts) ===
  { citySlug: "thane", stateSlug: "maharashtra", name: "Thane West", slug: "thane-west" },
  { citySlug: "thane", stateSlug: "maharashtra", name: "Thane East", slug: "thane-east" },
  { citySlug: "thane", stateSlug: "maharashtra", name: "Ghodbunder Road", slug: "ghodbunder-road" },
  { citySlug: "thane", stateSlug: "maharashtra", name: "Majiwada", slug: "majiwada" },
  { citySlug: "thane", stateSlug: "maharashtra", name: "Kapurbawdi", slug: "kapurbawdi" },

  // === NEW DELHI (14 districts) ===
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Connaught Place", slug: "connaught-place" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "South Delhi", slug: "south-delhi" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "North Delhi", slug: "north-delhi" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "East Delhi", slug: "east-delhi" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "West Delhi", slug: "west-delhi" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Dwarka", slug: "dwarka" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Rohini", slug: "rohini" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Saket", slug: "saket" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Karol Bagh", slug: "karol-bagh" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Lajpat Nagar", slug: "lajpat-nagar" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Greater Kailash", slug: "greater-kailash" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Hauz Khas", slug: "hauz-khas" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Chanakyapuri", slug: "chanakyapuri" },
  { citySlug: "new-delhi", stateSlug: "delhi", name: "Mehrauli", slug: "mehrauli" },

  // === BANGALORE (10 districts) ===
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Koramangala", slug: "koramangala" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Indiranagar", slug: "indiranagar" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Whitefield", slug: "whitefield" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Electronic City", slug: "electronic-city" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "HSR Layout", slug: "hsr-layout" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Jayanagar", slug: "jayanagar" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "MG Road", slug: "mg-road" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Bannerghatta Road", slug: "bannerghatta-road" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Marathahalli", slug: "marathahalli" },
  { citySlug: "bangalore", stateSlug: "karnataka", name: "Yelahanka", slug: "yelahanka" },

  // === MYSORE (5 districts) ===
  { citySlug: "mysore", stateSlug: "karnataka", name: "Mysore Palace Area", slug: "mysore-palace-area" },
  { citySlug: "mysore", stateSlug: "karnataka", name: "Gandhinagar", slug: "gandhinagar-mysore" },
  { citySlug: "mysore", stateSlug: "karnataka", name: "Saraswathipuram", slug: "saraswathipuram" },
  { citySlug: "mysore", stateSlug: "karnataka", name: "Vijayanagar", slug: "vijayanagar-mysore" },
  { citySlug: "mysore", stateSlug: "karnataka", name: "Hunsur Road", slug: "hunsur-road" },

  // === MANGALORE (5 districts) ===
  { citySlug: "mangalore", stateSlug: "karnataka", name: "Hampankatta", slug: "hampankatta" },
  { citySlug: "mangalore", stateSlug: "karnataka", name: "Kadri", slug: "kadri" },
  { citySlug: "mangalore", stateSlug: "karnataka", name: "Pumpwell", slug: "pumpwell" },
  { citySlug: "mangalore", stateSlug: "karnataka", name: "Surathkal", slug: "surathkal" },
  { citySlug: "mangalore", stateSlug: "karnataka", name: "Attavar", slug: "attavar" },

  // === HUBLI (4 districts) ===
  { citySlug: "hubli", stateSlug: "karnataka", name: "Old Hubli", slug: "old-hubli" },
  { citySlug: "hubli", stateSlug: "karnataka", name: "Vidyanagar", slug: "vidyanagar" },
  { citySlug: "hubli", stateSlug: "karnataka", name: "Dharwad Road", slug: "dharwad-road" },
  { citySlug: "hubli", stateSlug: "karnataka", name: "Gokul Road", slug: "gokul-road" },

  // === HYDERABAD (8 districts) ===
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Banjara Hills", slug: "banjara-hills" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Jubilee Hills", slug: "jubilee-hills" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Madhapur", slug: "madhapur" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Hitech City", slug: "hitech-city" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Gachibowli", slug: "gachibowli" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Secunderabad", slug: "secunderabad" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Ameerpet", slug: "ameerpet" },
  { citySlug: "hyderabad", stateSlug: "telangana", name: "Kukatpally", slug: "kukatpally" },

  // === WARANGAL (4 districts) ===
  { citySlug: "warangal", stateSlug: "telangana", name: "Kazipet", slug: "kazipet" },
  { citySlug: "warangal", stateSlug: "telangana", name: "Hanamkonda", slug: "hanamkonda" },
  { citySlug: "warangal", stateSlug: "telangana", name: "Warangal Fort Area", slug: "warangal-fort-area" },
  { citySlug: "warangal", stateSlug: "telangana", name: "Narsampet Road", slug: "narsampet-road" },

  // === CHENNAI (9 districts) ===
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "T. Nagar", slug: "t-nagar" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Adyar", slug: "adyar" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Anna Nagar", slug: "anna-nagar" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Velachery", slug: "velachery" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Nungambakkam", slug: "nungambakkam" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Egmore", slug: "egmore" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Guindy", slug: "guindy" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "OMR", slug: "omr" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", name: "Porur", slug: "porur" },

  // === COIMBATORE (6 districts) ===
  { citySlug: "coimbatore", stateSlug: "tamil-nadu", name: "RS Puram", slug: "rs-puram" },
  { citySlug: "coimbatore", stateSlug: "tamil-nadu", name: "Gandhipuram", slug: "gandhipuram" },
  { citySlug: "coimbatore", stateSlug: "tamil-nadu", name: "Peelamedu", slug: "peelamedu" },
  { citySlug: "coimbatore", stateSlug: "tamil-nadu", name: "Saibaba Colony", slug: "saibaba-colony" },
  { citySlug: "coimbatore", stateSlug: "tamil-nadu", name: "Town Hall", slug: "town-hall" },
  { citySlug: "coimbatore", stateSlug: "tamil-nadu", name: "Avarampalayam", slug: "avarampalayam" },

  // === MADURAI (5 districts) ===
  { citySlug: "madurai", stateSlug: "tamil-nadu", name: "North Masi Street", slug: "north-masi-street" },
  { citySlug: "madurai", stateSlug: "tamil-nadu", name: "South Masi Street", slug: "south-masi-street" },
  { citySlug: "madurai", stateSlug: "tamil-nadu", name: "KK Nagar", slug: "kk-nagar" },
  { citySlug: "madurai", stateSlug: "tamil-nadu", name: "Vandiyur", slug: "vandiyur" },
  { citySlug: "madurai", stateSlug: "tamil-nadu", name: "Tallakulam", slug: "tallakulam" },

  // === SALEM (4 districts) ===
  { citySlug: "salem", stateSlug: "tamil-nadu", name: "Fairlands", slug: "fairlands" },
  { citySlug: "salem", stateSlug: "tamil-nadu", name: "Shevapet", slug: "shevapet" },
  { citySlug: "salem", stateSlug: "tamil-nadu", name: "Kondalampatti", slug: "kondalampatti" },
  { citySlug: "salem", stateSlug: "tamil-nadu", name: "Suramangalam", slug: "suramangalam" },

  // === KOLKATA (7 districts) ===
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "Park Street", slug: "park-street" },
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "Salt Lake", slug: "salt-lake" },
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "New Town", slug: "new-town" },
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "Howrah", slug: "howrah" },
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "Dum Dum", slug: "dum-dum" },
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "Gariahat", slug: "gariahat" },
  { citySlug: "kolkata", stateSlug: "west-bengal", name: "Behala", slug: "behala" },

  // === SILIGURI (4 districts) ===
  { citySlug: "siliguri", stateSlug: "west-bengal", name: "Hill Cart Road", slug: "hill-cart-road" },
  { citySlug: "siliguri", stateSlug: "west-bengal", name: "Sevoke Road", slug: "sevoke-road" },
  { citySlug: "siliguri", stateSlug: "west-bengal", name: "Matigara", slug: "matigara" },
  { citySlug: "siliguri", stateSlug: "west-bengal", name: "Sukna", slug: "sukna" },

  // === HOWRAH (3 districts) ===
  { citySlug: "howrah", stateSlug: "west-bengal", name: "Bally", slug: "bally" },
  { citySlug: "howrah", stateSlug: "west-bengal", name: "Shibpur", slug: "shibpur" },
  { citySlug: "howrah", stateSlug: "west-bengal", name: "Santragachhi", slug: "santragachhi" },

  // === AHMEDABAD (10 districts) ===
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "CG Road", slug: "cg-road" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "SG Highway", slug: "sg-highway" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Navrangpura", slug: "navrangpura" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Maninagar", slug: "maninagar" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Satellite", slug: "satellite" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Bopal", slug: "bopal" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Vastrapur", slug: "vastrapur" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Ashram Road", slug: "ashram-road" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Bodakdev", slug: "bodakdev" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", name: "Paldi", slug: "paldi" },

  // === SURAT (6 districts) ===
  { citySlug: "surat", stateSlug: "gujarat", name: "Ring Road", slug: "ring-road" },
  { citySlug: "surat", stateSlug: "gujarat", name: "Adajan", slug: "adajan" },
  { citySlug: "surat", stateSlug: "gujarat", name: "Vesu", slug: "vesu" },
  { citySlug: "surat", stateSlug: "gujarat", name: "Dumas Road", slug: "dumas-road" },
  { citySlug: "surat", stateSlug: "gujarat", name: "Piplod", slug: "piplod" },
  { citySlug: "surat", stateSlug: "gujarat", name: "Sachin GIDC", slug: "sachin-gidc" },

  // === VADODARA (6 districts) ===
  { citySlug: "vadodara", stateSlug: "gujarat", name: "Alkapuri", slug: "alkapuri" },
  { citySlug: "vadodara", stateSlug: "gujarat", name: "Sayajigunj", slug: "sayajigunj" },
  { citySlug: "vadodara", stateSlug: "gujarat", name: "Fatehgunj", slug: "fatehgunj" },
  { citySlug: "vadodara", stateSlug: "gujarat", name: "Gorwa", slug: "gorwa" },
  { citySlug: "vadodara", stateSlug: "gujarat", name: "Manjalpur", slug: "manjalpur" },
  { citySlug: "vadodara", stateSlug: "gujarat", name: "Tandalja", slug: "tandalja" },

  // === RAJKOT (5 districts) ===
  { citySlug: "rajkot", stateSlug: "gujarat", name: "Race Course Ring Road", slug: "race-course-ring-road" },
  { citySlug: "rajkot", stateSlug: "gujarat", name: "Kalawad Road", slug: "kalawad-road" },
  { citySlug: "rajkot", stateSlug: "gujarat", name: "150 Feet Ring Road", slug: "150-feet-ring-road" },
  { citySlug: "rajkot", stateSlug: "gujarat", name: "Sadhu Vaswani Road", slug: "sadhu-vaswani-road" },
  { citySlug: "rajkot", stateSlug: "gujarat", name: "Mavdi", slug: "mavdi" },

  // === JAIPUR (10 districts) ===
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "MI Road", slug: "mi-road" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "C-Scheme", slug: "c-scheme" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Vaishali Nagar", slug: "vaishali-nagar" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Malviya Nagar", slug: "malviya-nagar" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Tonk Road", slug: "tonk-road" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Pink City", slug: "pink-city" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Mansarovar", slug: "mansarovar" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Jagatpura", slug: "jagatpura" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Sodala", slug: "sodala" },
  { citySlug: "jaipur", stateSlug: "rajasthan", name: "Raja Park", slug: "raja-park" },

  // === JODHPUR (5 districts) ===
  { citySlug: "jodhpur", stateSlug: "rajasthan", name: "Clock Tower", slug: "clock-tower" },
  { citySlug: "jodhpur", stateSlug: "rajasthan", name: "Paota", slug: "paota" },
  { citySlug: "jodhpur", stateSlug: "rajasthan", name: "Shastri Nagar", slug: "shastri-nagar" },
  { citySlug: "jodhpur", stateSlug: "rajasthan", name: "Ratanada", slug: "ratanada" },
  { citySlug: "jodhpur", stateSlug: "rajasthan", name: "Pal Road", slug: "pal-road" },

  // === UDAIPUR (4 districts) ===
  { citySlug: "udaipur", stateSlug: "rajasthan", name: "Fateh Sagar Lake", slug: "fateh-sagar-lake" },
  { citySlug: "udaipur", stateSlug: "rajasthan", name: "City Palace Area", slug: "city-palace-area" },
  { citySlug: "udaipur", stateSlug: "rajasthan", name: "Sukhadia Circle", slug: "sukhadia-circle" },
  { citySlug: "udaipur", stateSlug: "rajasthan", name: "Hiran Magri", slug: "hiran-magri" },

  // === KOTA (4 districts) ===
  { citySlug: "kota", stateSlug: "rajasthan", name: "Kota Barrage", slug: "kota-barrage" },
  { citySlug: "kota", stateSlug: "rajasthan", name: "Talwandi", slug: "talwandi" },
  { citySlug: "kota", stateSlug: "rajasthan", name: "Vigyan Nagar", slug: "vigyan-nagar" },
  { citySlug: "kota", stateSlug: "rajasthan", name: "Rajeev Gandhi Nagar", slug: "rajeev-gandhi-nagar" },

  // === LUCKNOW (8 districts) ===
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Hazratganj", slug: "hazratganj" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Gomti Nagar", slug: "gomti-nagar" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Aminabad", slug: "aminabad" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Indira Nagar", slug: "indira-nagar-lucknow" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Aliganj", slug: "aliganj" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Kapoorthala", slug: "kapoorthala" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Chinhat", slug: "chinhat" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", name: "Amausi", slug: "amausi" },

  // === KANPUR (6 districts) ===
  { citySlug: "kanpur", stateSlug: "uttar-pradesh", name: "Civil Lines", slug: "civil-lines-kanpur" },
  { citySlug: "kanpur", stateSlug: "uttar-pradesh", name: "Swaroop Nagar", slug: "swaroop-nagar" },
  { citySlug: "kanpur", stateSlug: "uttar-pradesh", name: "Kidwai Nagar", slug: "kidwai-nagar" },
  { citySlug: "kanpur", stateSlug: "uttar-pradesh", name: "Shastri Nagar", slug: "shastri-nagar-kanpur" },
  { citySlug: "kanpur", stateSlug: "uttar-pradesh", name: "Kakadeo", slug: "kakadeo" },
  { citySlug: "kanpur", stateSlug: "uttar-pradesh", name: "Mall Road", slug: "mall-road-kanpur" },

  // === AGRA (5 districts) ===
  { citySlug: "agra", stateSlug: "uttar-pradesh", name: "Sadar Bazaar", slug: "sadar-bazaar" },
  { citySlug: "agra", stateSlug: "uttar-pradesh", name: "MG Road Agra", slug: "mg-road-agra" },
  { citySlug: "agra", stateSlug: "uttar-pradesh", name: "Fatehabad Road", slug: "fatehabad-road" },
  { citySlug: "agra", stateSlug: "uttar-pradesh", name: "Sanjay Place", slug: "sanjay-place" },
  { citySlug: "agra", stateSlug: "uttar-pradesh", name: "Kamla Nagar", slug: "kamla-nagar" },

  // === VARANASI (5 districts) ===
  { citySlug: "varanasi", stateSlug: "uttar-pradesh", name: "Dashashwamedh Ghat", slug: "dashashwamedh-ghat" },
  { citySlug: "varanasi", stateSlug: "uttar-pradesh", name: "Godowlia", slug: "godowlia" },
  { citySlug: "varanasi", stateSlug: "uttar-pradesh", name: "Assi Ghat", slug: "assi-ghat" },
  { citySlug: "varanasi", stateSlug: "uttar-pradesh", name: "Cantt", slug: "cantt" },
  { citySlug: "varanasi", stateSlug: "uttar-pradesh", name: "Lanka", slug: "lanka" },

  // === NOIDA (6 districts) ===
  { citySlug: "noida", stateSlug: "uttar-pradesh", name: "Sector 18", slug: "sector-18" },
  { citySlug: "noida", stateSlug: "uttar-pradesh", name: "Sector 62", slug: "sector-62" },
  { citySlug: "noida", stateSlug: "uttar-pradesh", name: "Sector 15", slug: "sector-15" },
  { citySlug: "noida", stateSlug: "uttar-pradesh", name: "Atta Market", slug: "atta-market" },
  { citySlug: "noida", stateSlug: "uttar-pradesh", name: "Greater Noida", slug: "greater-noida" },
  { citySlug: "noida", stateSlug: "uttar-pradesh", name: "Sector 128", slug: "sector-128" },

  // === GHAZIABAD (4 districts) ===
  { citySlug: "ghaziabad", stateSlug: "uttar-pradesh", name: "Vaishali", slug: "vaishali-ghaziabad" },
  { citySlug: "ghaziabad", stateSlug: "uttar-pradesh", name: "Indirapuram", slug: "indirapuram" },
  { citySlug: "ghaziabad", stateSlug: "uttar-pradesh", name: "Crossing Republik", slug: "crossing-republik" },
  { citySlug: "ghaziabad", stateSlug: "uttar-pradesh", name: "Kavi Nagar", slug: "kavi-nagar" },

  // === BHOPAL (6 districts) ===
  { citySlug: "bhopal", stateSlug: "madhya-pradesh", name: "New Market", slug: "new-market" },
  { citySlug: "bhopal", stateSlug: "madhya-pradesh", name: "MP Nagar", slug: "mp-nagar" },
  { citySlug: "bhopal", stateSlug: "madhya-pradesh", name: "Arera Colony", slug: "arera-colony" },
  { citySlug: "bhopal", stateSlug: "madhya-pradesh", name: "Habibganj", slug: "habibganj" },
  { citySlug: "bhopal", stateSlug: "madhya-pradesh", name: "Bairagarh", slug: "bairagarh" },
  { citySlug: "bhopal", stateSlug: "madhya-pradesh", name: "Shahpura Lake", slug: "shahpura-lake" },

  // === INDORE (6 districts) ===
  { citySlug: "indore", stateSlug: "madhya-pradesh", name: "Sapna Sangeeta", slug: "sapna-sangeeta" },
  { citySlug: "indore", stateSlug: "madhya-pradesh", name: "MG Road Indore", slug: "mg-road-indore" },
  { citySlug: "indore", stateSlug: "madhya-pradesh", name: "Vijay Nagar", slug: "vijay-nagar" },
  { citySlug: "indore", stateSlug: "madhya-pradesh", name: "Palasia", slug: "palasia" },
  { citySlug: "indore", stateSlug: "madhya-pradesh", name: "South Tukoganj", slug: "south-tukoganj" },
  { citySlug: "indore", stateSlug: "madhya-pradesh", name: "Scheme No 78", slug: "scheme-no-78" },

  // === JABALPUR (4 districts) ===
  { citySlug: "jabalpur", stateSlug: "madhya-pradesh", name: "Famous Chowk", slug: "famous-chowk" },
  { citySlug: "jabalpur", stateSlug: "madhya-pradesh", name: "Wright Town", slug: "wright-town" },
  { citySlug: "jabalpur", stateSlug: "madhya-pradesh", name: "Cantt Jabalpur", slug: "cantt-jabalpur" },
  { citySlug: "jabalpur", stateSlug: "madhya-pradesh", name: "Gorakhpur", slug: "gorakhpur-jabalpur" },

  // === GWALIOR (4 districts) ===
  { citySlug: "gwalior", stateSlug: "madhya-pradesh", name: "Lashkar", slug: "lashkar" },
  { citySlug: "gwalior", stateSlug: "madhya-pradesh", name: "Morar", slug: "morar" },
  { citySlug: "gwalior", stateSlug: "madhya-pradesh", name: "Thatipur", slug: "thatipur" },
  { citySlug: "gwalior", stateSlug: "madhya-pradesh", name: "City Center", slug: "city-center-gwalior" },

  // === KOCHI (6 districts) ===
  { citySlug: "kochi", stateSlug: "kerala", name: "MG Road Kochi", slug: "mg-road-kochi" },
  { citySlug: "kochi", stateSlug: "kerala", name: "Edappally", slug: "edappally" },
  { citySlug: "kochi", stateSlug: "kerala", name: "Kakkanad", slug: "kakkanad" },
  { citySlug: "kochi", stateSlug: "kerala", name: "Marine Drive", slug: "marine-drive" },
  { citySlug: "kochi", stateSlug: "kerala", name: "Kaloor", slug: "kaloor" },
  { citySlug: "kochi", stateSlug: "kerala", name: "Vytilla", slug: "vytilla" },

  // === THIRUVANANTHAPURAM (5 districts) ===
  { citySlug: "thiruvananthapuram", stateSlug: "kerala", name: "MG Road Trivandrum", slug: "mg-road-trivandrum" },
  { citySlug: "thiruvananthapuram", stateSlug: "kerala", name: "Kowdiar", slug: "kowdiar" },
  { citySlug: "thiruvananthapuram", stateSlug: "kerala", name: "Vazhuthacaud", slug: "vazhuthacaud" },
  { citySlug: "thiruvananthapuram", stateSlug: "kerala", name: "Sreekaryam", slug: "sreekaryam" },
  { citySlug: "thiruvananthapuram", stateSlug: "kerala", name: "Pattom", slug: "pattom" },

  // === KOZHIKODE (4 districts) ===
  { citySlug: "kozhikode", stateSlug: "kerala", name: "SM Street", slug: "sm-street" },
  { citySlug: "kozhikode", stateSlug: "kerala", name: "Mavoor Road", slug: "mavoor-road" },
  { citySlug: "kozhikode", stateSlug: "kerala", name: "Nadakkavu", slug: "nadakkavu" },
  { citySlug: "kozhikode", stateSlug: "kerala", name: "Kuttichira", slug: "kuttichira" },

  // === PATNA (6 districts) ===
  { citySlug: "patna", stateSlug: "bihar", name: "Boring Road", slug: "boring-road" },
  { citySlug: "patna", stateSlug: "bihar", name: "Frazer Road", slug: "frazer-road" },
  { citySlug: "patna", stateSlug: "bihar", name: "Gandhi Maidan", slug: "gandhi-maidan" },
  { citySlug: "patna", stateSlug: "bihar", name: "Kankarbagh", slug: "kankarbagh" },
  { citySlug: "patna", stateSlug: "bihar", name: "Baily Road", slug: "baily-road" },
  { citySlug: "patna", stateSlug: "bihar", name: "Patliputra", slug: "patliputra" },

  // === GAYA (4 districts) ===
  { citySlug: "gaya", stateSlug: "bihar", name: "Bodh Gaya", slug: "bodh-gaya" },
  { citySlug: "gaya", stateSlug: "bihar", name: "Gandhi Chowk", slug: "gandhi-chowk" },
  { citySlug: "gaya", stateSlug: "bihar", name: "University Area", slug: "university-area-gaya" },
  { citySlug: "gaya", stateSlug: "bihar", name: "Gaya Town", slug: "gaya-town" },

  // === AMRITSAR (5 districts) ===
  { citySlug: "amritsar", stateSlug: "punjab", name: "Hall Gate", slug: "hall-gate" },
  { citySlug: "amritsar", stateSlug: "punjab", name: "Lawrence Road", slug: "lawrence-road" },
  { citySlug: "amritsar", stateSlug: "punjab", name: "Ranjit Avenue", slug: "ranjit-avenue" },
  { citySlug: "amritsar", stateSlug: "punjab", name: "Green Avenue", slug: "green-avenue" },
  { citySlug: "amritsar", stateSlug: "punjab", name: "Majitha Road", slug: "majitha-road" },

  // === LUDHIANA (5 districts) ===
  { citySlug: "ludhiana", stateSlug: "punjab", name: "Civil Lines Ludhiana", slug: "civil-lines-ludhiana" },
  { citySlug: "ludhiana", stateSlug: "punjab", name: "Model Town", slug: "model-town" },
  { citySlug: "ludhiana", stateSlug: "punjab", name: "Ghumar Mandi", slug: "ghumar-mandi" },
  { citySlug: "ludhiana", stateSlug: "punjab", name: "Dugri Road", slug: "dugri-road" },
  { citySlug: "ludhiana", stateSlug: "punjab", name: "Ferozepur Road", slug: "ferozepur-road" },

  // === JALANDHAR (4 districts) ===
  { citySlug: "jalandhar", stateSlug: "punjab", name: "Model Town Jalandhar", slug: "model-town-jalandhar" },
  { citySlug: "jalandhar", stateSlug: "punjab", name: "Lamma Pind", slug: "lamma-pind" },
  { citySlug: "jalandhar", stateSlug: "punjab", name: "GT Road Jalandhar", slug: "gt-road-jalandhar" },
  { citySlug: "jalandhar", stateSlug: "punjab", name: "Raja Garden", slug: "raja-garden" },

  // === MOHALI (4 districts) ===
  { citySlug: "mohali", stateSlug: "punjab", name: "Phase 7", slug: "phase-7" },
  { citySlug: "mohali", stateSlug: "punjab", name: "Phase 3B2", slug: "phase-3b2" },
  { citySlug: "mohali", stateSlug: "punjab", name: "Sector 70", slug: "sector-70" },
  { citySlug: "mohali", stateSlug: "punjab", name: "Industrial Area", slug: "industrial-area-mohali" },

  // === GURUGRAM (8 districts) ===
  { citySlug: "gurugram", stateSlug: "haryana", name: "DLF Cyber City", slug: "dlf-cyber-city" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "MG Road Gurugram", slug: "mg-road-gurugram" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "Sohna Road", slug: "sohna-road" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "Golf Course Road", slug: "golf-course-road" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "Sector 29", slug: "sector-29-gurugram" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "Udyog Vihar", slug: "udyog-vihar" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "Sector 56", slug: "sector-56" },
  { citySlug: "gurugram", stateSlug: "haryana", name: "Palam Vihar", slug: "palam-vihar" },

  // === FARIDABAD (4 districts) ===
  { citySlug: "faridabad", stateSlug: "haryana", name: "Sector 15", slug: "sector-15-faridabad" },
  { citySlug: "faridabad", stateSlug: "haryana", name: "NIT Faridabad", slug: "nit-faridabad" },
  { citySlug: "faridabad", stateSlug: "haryana", name: "Ballabhgarh", slug: "ballabhgarh" },
  { citySlug: "faridabad", stateSlug: "haryana", name: "Mathura Road", slug: "mathura-road-faridabad" },

  // === VISAKHAPATNAM (5 districts) ===
  { citySlug: "visakhapatnam", stateSlug: "andhra-pradesh", name: "Dwaraka Nagar", slug: "dwaraka-nagar" },
  { citySlug: "visakhapatnam", stateSlug: "andhra-pradesh", name: "Siripuram Junction", slug: "siripuram-junction" },
  { citySlug: "visakhapatnam", stateSlug: "andhra-pradesh", name: "Beach Road", slug: "beach-road-vizag" },
  { citySlug: "visakhapatnam", stateSlug: "andhra-pradesh", name: "MVP Colony", slug: "mvp-colony" },
  { citySlug: "visakhapatnam", stateSlug: "andhra-pradesh", name: "Gajuwaka", slug: "gajuwaka" },

  // === VIJAYAWADA (5 districts) ===
  { citySlug: "vijayawada", stateSlug: "andhra-pradesh", name: "Governorpet", slug: "governorpet" },
  { citySlug: "vijayawada", stateSlug: "andhra-pradesh", name: "MG Road Vijayawada", slug: "mg-road-vijayawada" },
  { citySlug: "vijayawada", stateSlug: "andhra-pradesh", name: "Benz Circle", slug: "benz-circle" },
  { citySlug: "vijayawada", stateSlug: "andhra-pradesh", name: "Lanka", slug: "lanka-vijayawada" },
  { citySlug: "vijayawada", stateSlug: "andhra-pradesh", name: "Auto Nagar", slug: "auto-nagar" },

  // === TIRUPATI (4 districts) ===
  { citySlug: "tirupati", stateSlug: "andhra-pradesh", name: "Tirumala", slug: "tirumala" },
  { citySlug: "tirupati", stateSlug: "andhra-pradesh", name: "Alipiri", slug: "alipiri" },
  { citySlug: "tirupati", stateSlug: "andhra-pradesh", name: "RTC Bus Stand Area", slug: "rtc-bus-stand-area" },
  { citySlug: "tirupati", stateSlug: "andhra-pradesh", name: "Renigunta Road", slug: "renigunta-road" },

  // === BHUBANESWAR (5 districts) ===
  { citySlug: "bhubaneswar", stateSlug: "odisha", name: "Saheed Nagar", slug: "saheed-nagar" },
  { citySlug: "bhubaneswar", stateSlug: "odisha", name: "Unit 1 Market", slug: "unit-1-market" },
  { citySlug: "bhubaneswar", stateSlug: "odisha", name: "Khandagiri", slug: "khandagiri" },
  { citySlug: "bhubaneswar", stateSlug: "odisha", name: "Patia", slug: "patia" },
  { citySlug: "bhubaneswar", stateSlug: "odisha", name: "CRP Square", slug: "crp-square" },

  // === CUTTACK (4 districts) ===
  { citySlug: "cuttack", stateSlug: "odisha", name: "Baliyatra Ground", slug: "baliyatra-ground" },
  { citySlug: "cuttack", stateSlug: "odisha", name: "Badambadi", slug: "badambadi" },
  { citySlug: "cuttack", stateSlug: "odisha", name: "Cantt Cuttack", slug: "cantt-cuttack" },
  { citySlug: "cuttack", stateSlug: "odisha", name: "Markat Nagar", slug: "markat-nagar" },

  // === RAIPUR (5 districts) ===
  { citySlug: "raipur", stateSlug: "chhattisgarh", name: "Pandri", slug: "pandri" },
  { citySlug: "raipur", stateSlug: "chhattisgarh", name: "Telibandha", slug: "telibandha" },
  { citySlug: "raipur", stateSlug: "chhattisgarh", name: "Fafadih Chowk", slug: "fafadih-chowk" },
  { citySlug: "raipur", stateSlug: "chhattisgarh", name: "Purena", slug: "purena" },
  { citySlug: "raipur", stateSlug: "chhattisgarh", name: "Tatibandh", slug: "tatibandh" },

  // === GUWAHATI (5 districts) ===
  { citySlug: "guwahati", stateSlug: "assam", name: "Paltan Bazaar", slug: "paltan-bazaar" },
  { citySlug: "guwahati", stateSlug: "assam", name: "GS Road", slug: "gs-road" },
  { citySlug: "guwahati", stateSlug: "assam", name: "Beltola", slug: "beltola" },
  { citySlug: "guwahati", stateSlug: "assam", name: "Kamakhya", slug: "kamakhya" },
  { citySlug: "guwahati", stateSlug: "assam", name: "Zoo Road", slug: "zoo-road" },

  // === RANCHI (4 districts) ===
  { citySlug: "ranchi", stateSlug: "jharkhand", name: "Main Road Ranchi", slug: "main-road-ranchi" },
  { citySlug: "ranchi", stateSlug: "jharkhand", name: "Lalpur", slug: "lalpur" },
  { citySlug: "ranchi", stateSlug: "jharkhand", name: "Harmu", slug: "harmu" },
  { citySlug: "ranchi", stateSlug: "jharkhand", name: "Kanke Road", slug: "kanke-road" },

  // === JAMSHEDPUR (4 districts) ===
  { citySlug: "jamshedpur", stateSlug: "jharkhand", name: "Sakchi", slug: "sakchi" },
  { citySlug: "jamshedpur", stateSlug: "jharkhand", name: "Bistupur", slug: "bistupur" },
  { citySlug: "jamshedpur", stateSlug: "jharkhand", name: "Adityapur", slug: "adityapur" },
  { citySlug: "jamshedpur", stateSlug: "jharkhand", name: "Telco", slug: "telco" },

  // === DEHRADUN (5 districts) ===
  { citySlug: "dehradun", stateSlug: "uttarakhand", name: "Rajpur Road", slug: "rajpur-road" },
  { citySlug: "dehradun", stateSlug: "uttarakhand", name: "Clock Tower Dehradun", slug: "clock-tower-dehradun" },
  { citySlug: "dehradun", stateSlug: "uttarakhand", name: "Paltan Bazaar Dehradun", slug: "paltan-bazaar-dehradun" },
  { citySlug: "dehradun", stateSlug: "uttarakhand", name: "ISBT", slug: "isbt-dehradun" },
  { citySlug: "dehradun", stateSlug: "uttarakhand", name: "Prem Nagar", slug: "prem-nagar" },

  // === CHANDIGARH (5 districts) ===
  { citySlug: "chandigarh", stateSlug: "chandigarh", name: "Sector 17", slug: "sector-17" },
  { citySlug: "chandigarh", stateSlug: "chandigarh", name: "Sector 22", slug: "sector-22" },
  { citySlug: "chandigarh", stateSlug: "chandigarh", name: "Sector 35", slug: "sector-35" },
  { citySlug: "chandigarh", stateSlug: "chandigarh", name: "Elante Mall Area", slug: "elante-mall-area" },
  { citySlug: "chandigarh", stateSlug: "chandigarh", name: "Industrial Area", slug: "industrial-area-chandigarh" },

  // === SRINAGAR (4 districts) ===
  { citySlug: "srinagar", stateSlug: "jammu-kashmir", name: "Lal Chowk", slug: "lal-chowk" },
  { citySlug: "srinagar", stateSlug: "jammu-kashmir", name: "Residency Road", slug: "residency-road" },
  { citySlug: "srinagar", stateSlug: "jammu-kashmir", name: "Dal Gate", slug: "dal-gate" },
  { citySlug: "srinagar", stateSlug: "jammu-kashmir", name: "Jawahar Nagar", slug: "jawahar-nagar" },

  // === SHIMLA (3 districts) ===
  { citySlug: "shimla", stateSlug: "himachal-pradesh", name: "Mall Road Shimla", slug: "mall-road-shimla" },
  { citySlug: "shimla", stateSlug: "himachal-pradesh", name: "Ridge", slug: "ridge" },
  { citySlug: "shimla", stateSlug: "himachal-pradesh", name: "Sanjauli", slug: "sanjauli" },

  // === PANAJI (3 districts) ===
  { citySlug: "panaji", stateSlug: "goa", name: "18th June Road", slug: "18th-june-road" },
  { citySlug: "panaji", stateSlug: "goa", name: "Fontainhas", slug: "fontainhas" },
  { citySlug: "panaji", stateSlug: "goa", name: "Miramar", slug: "miramar" },
];

// ============================================================================
// Localities (sub-areas within districts)
// ============================================================================
export const indiaLocalities: IndiaSeedLocality[] = [
  // === MUMBAI LOCALITIES ===
  // Andheri
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "andheri", name: "Andheri East", slug: "andheri-east" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "andheri", name: "Andheri West", slug: "andheri-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "andheri", name: "Lokhandwala", slug: "lokhandwala" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "andheri", name: "Versova", slug: "versova" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "andheri", name: "Azad Nagar", slug: "azad-nagar" },
  // Bandra
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "bandra", name: "Bandra East", slug: "bandra-east" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "bandra", name: "Bandra West", slug: "bandra-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "bandra", name: "Bandra Kurla Complex", slug: "bkc" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "bandra", name: "Linking Road", slug: "linking-road" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "bandra", name: "Pali Hill", slug: "pali-hill" },
  // Juhu
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "juhu", name: "Juhu Beach", slug: "juhu-beach" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "juhu", name: "Juhu Scheme", slug: "juhu-scheme" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "juhu", name: "Vile Parle West", slug: "vile-parle-west" },
  // Worli
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "worli", name: "Worli Sea Face", slug: "worli-sea-face" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "worli", name: "Worli Naka", slug: "worli-naka" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "worli", name: "Shivaji Park", slug: "shivaji-park" },
  // Colaba
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "colaba", name: "Colaba Causeway", slug: "colaba-causeway" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "colaba", name: "Navy Nagar", slug: "navy-nagar" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "colaba", name: "Cuffe Parade", slug: "cuffe-parade" },
  // Powai
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "powai", name: "Hiranandani Gardens", slug: "hiranandani-gardens" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "powai", name: "Powai Lake", slug: "powai-lake" },
  // Malad
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "malad", name: "Malad West", slug: "malad-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "malad", name: "Malad East", slug: "malad-east" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "malad", name: "Goregaon East", slug: "goregaon-east" },
  // Borivali
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "borivali", name: "Borivali West", slug: "borivali-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "borivali", name: "Borivali East", slug: "borivali-east" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "borivali", name: "IC Colony", slug: "ic-colony" },
  // Dadar
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "dadar", name: "Dadar West", slug: "dadar-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "dadar", name: "Dadar East", slug: "dadar-east" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "dadar", name: "Shivaji Park Area", slug: "shivaji-park-area" },
  // Lower Parel
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "lower-parel", name: "Kamala Mills", slug: "kamala-mills" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "lower-parel", name: "Phoenix Mills", slug: "phoenix-mills" },
  // Goregaon
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "goregaon", name: "Goregaon West", slug: "goregaon-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "goregaon", name: "Aarey Colony", slug: "aarey-colony" },
  // Vile Parle
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "vile-parle", name: "Vile Parle East", slug: "vile-parle-east" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "vile-parle", name: "Juhu Tara Road", slug: "juhu-tara-road" },
  // Kurla
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "kurla", name: "Kurla West", slug: "kurla-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "kurla", name: "Kurla East", slug: "kurla-east" },
  // Mulund
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "mulund", name: "Mulund West", slug: "mulund-west" },
  { citySlug: "mumbai", stateSlug: "maharashtra", districtSlug: "mulund", name: "Mulund East", slug: "mulund-east" },

  // === PUNE LOCALITIES ===
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "hinjewadi", name: "Phase 1 Hinjewadi", slug: "phase-1-hinjewadi" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "hinjewadi", name: "Phase 2 Hinjewadi", slug: "phase-2-hinjewadi" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "hinjewadi", name: "Phase 3 Hinjewadi", slug: "phase-3-hinjewadi" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "koregaon-park", name: "KP Lane 1", slug: "kp-lane-1" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "koregaon-park", name: "KP Lane 5", slug: "kp-lane-5" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "koregaon-park", name: "North Main Road", slug: "north-main-road-kp" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "baner", name: "Baner Pashan Link Road", slug: "baner-pashan-link-road" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "baner", name: "Baner Hill Road", slug: "baner-hill-road" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "aundh", name: "Aundh Ravet Road", slug: "aundh-ravet-road" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "aundh", name: "ITI Road", slug: "iti-road" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "kothrud", name: "Paud Road", slug: "paud-road" },
  { citySlug: "pune", stateSlug: "maharashtra", districtSlug: "kothrud", name: "Kothrud Depot", slug: "kothrud-depot" },

  // === DELHI LOCALITIES ===
  // Connaught Place
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "connaught-place", name: "Inner Circle", slug: "inner-circle" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "connaught-place", name: "Outer Circle", slug: "outer-circle" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "connaught-place", name: "M Block", slug: "m-block-cp" },
  // South Delhi
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "south-delhi", name: "Defence Colony", slug: "defence-colony" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "south-delhi", name: "Hauz Khas Village", slug: "hauz-khas-village" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "south-delhi", name: "Green Park", slug: "green-park-delhi" },
  // Dwarka
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "dwarka", name: "Dwarka Sector 21", slug: "dwarka-sector-21" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "dwarka", name: "Dwarka Sector 10", slug: "dwarka-sector-10" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "dwarka", name: "Dwarka Sector 14", slug: "dwarka-sector-14" },
  // Rohini
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "rohini", name: "Rohini Sector 1", slug: "rohini-sector-1" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "rohini", name: "Rohini Sector 7", slug: "rohini-sector-7" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "rohini", name: "Pitampura", slug: "pitampura" },
  // Greater Kailash
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "greater-kailash", name: "GK 1", slug: "gk-1" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "greater-kailash", name: "GK 2", slug: "gk-2" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "greater-kailash", name: "CR Park", slug: "cr-park" },
  // Hauz Khas
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "hauz-khas", name: "IIT Delhi Area", slug: "iit-delhi-area" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "hauz-khas", name: "Aurobindo Marg", slug: "aurobindo-marg" },
  // Lajpat Nagar
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "lajpat-nagar", name: "Lajpat Nagar 1", slug: "lajpat-nagar-1" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "lajpat-nagar", name: "Lajpat Nagar 2", slug: "lajpat-nagar-2" },
  // Karol Bagh
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "karol-bagh", name: "Arya Samaj Road", slug: "arya-samaj-road" },
  { citySlug: "new-delhi", stateSlug: "delhi", districtSlug: "karol-bagh", name: "Girdhari Lal Marg", slug: "girdhari-lal-marg" },

  // === BANGALORE LOCALITIES ===
  // Koramangala
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "koramangala", name: "Koramangala 1st Block", slug: "koramangala-1st-block" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "koramangala", name: "Koramangala 4th Block", slug: "koramangala-4th-block" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "koramangala", name: "Koramangala 6th Block", slug: "koramangala-6th-block" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "koramangala", name: "Koramangala 8th Block", slug: "koramangala-8th-block" },
  // Indiranagar
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "indiranagar", name: "100 Feet Road", slug: "100-feet-road" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "indiranagar", name: "Indiranagar 1st Stage", slug: "indiranagar-1st-stage" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "indiranagar", name: "Indiranagar 2nd Stage", slug: "indiranagar-2nd-stage" },
  // Whitefield
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "whitefield", name: "ITPL", slug: "itpl" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "whitefield", name: "Whitefield Main Road", slug: "whitefield-main-road" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "whitefield", name: "Brookefield", slug: "brookefield" },
  // HSR Layout
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "hsr-layout", name: "HSR Sector 1", slug: "hsr-sector-1" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "hsr-layout", name: "HSR Sector 2", slug: "hsr-sector-2" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "hsr-layout", name: "HSR Sector 7", slug: "hsr-sector-7" },
  // Electronic City
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "electronic-city", name: "Phase 1 Electronic City", slug: "phase-1-electronic-city" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "electronic-city", name: "Phase 2 Electronic City", slug: "phase-2-electronic-city" },
  // Jayanagar
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "jayanagar", name: "Jayanagar 1st Block", slug: "jayanagar-1st-block" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "jayanagar", name: "Jayanagar 4th Block", slug: "jayanagar-4th-block" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "jayanagar", name: "Jayanagar 9th Block", slug: "jayanagar-9th-block" },
  // Marathahalli
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "marathahalli", name: "Marathahalli Bridge", slug: "marathahalli-bridge" },
  { citySlug: "bangalore", stateSlug: "karnataka", districtSlug: "marathahalli", name: "ITPL Main Road", slug: "itpl-main-road" },

  // === HYDERABAD LOCALITIES ===
  // Banjara Hills
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "banjara-hills", name: "Road No 1", slug: "road-no-1" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "banjara-hills", name: "Road No 12", slug: "road-no-12" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "banjara-hills", name: "Road No 10", slug: "road-no-10" },
  // Jubilee Hills
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "jubilee-hills", name: "Road No 36", slug: "road-no-36" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "jubilee-hills", name: "Road No 5", slug: "road-no-5" },
  // Madhapur
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "madhapur", name: "Kavuri Hills", slug: "kavuri-hills" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "madhapur", name: "Ayyappa Society", slug: "ayyappa-society" },
  // Hitech City
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "hitech-city", name: "Cyber Towers", slug: "cyber-towers" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "hitech-city", name: "Kondapur", slug: "kondapur" },
  // Gachibowli
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "gachibowli", name: "Financial District", slug: "financial-district" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "gachibowli", name: "Telangana State Secretariat", slug: "telangana-secretariat" },
  // Ameerpet
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "ameerpet", name: "SR Nagar", slug: "sr-nagar" },
  { citySlug: "hyderabad", stateSlug: "telangana", districtSlug: "ameerpet", name: "Yerramanzil", slug: "yerramanzil" },

  // === CHENNAI LOCALITIES ===
  // T Nagar
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "t-nagar", name: "Pondy Bazaar", slug: "pondy-bazaar" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "t-nagar", name: "Usman Road", slug: "usman-road" },
  // Anna Nagar
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "anna-nagar", name: "Anna Nagar West", slug: "anna-nagar-west" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "anna-nagar", name: "Anna Nagar East", slug: "anna-nagar-east" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "anna-nagar", name: "Wavin Avenue", slug: "wavin-avenue" },
  // Adyar
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "adyar", name: "Kasturba Nagar", slug: "kasturba-nagar" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "adyar", name: "Besant Nagar", slug: "besant-nagar" },
  // Velachery
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "velachery", name: "100 Feet Road Velachery", slug: "100-feet-road-velachery" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "velachery", name: "Velachery Main Road", slug: "velachery-main-road" },
  // OMR
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "omr", name: "Thoraipakkam", slug: "thoraipakkam" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "omr", name: "Karapakkam", slug: "karapakkam" },
  { citySlug: "chennai", stateSlug: "tamil-nadu", districtSlug: "omr", name: "Sholinganallur", slug: "sholinganallur" },

  // === KOLKATA LOCALITIES ===
  // Park Street
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "park-street", name: "Park Street Area", slug: "park-street-area" },
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "park-street", name: "Camac Street", slug: "camac-street" },
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "park-street", name: "Sarat Bose Road", slug: "sarat-bose-road" },
  // Salt Lake
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "salt-lake", name: "Sector V", slug: "sector-v" },
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "salt-lake", name: "Sector I", slug: "sector-i" },
  // New Town
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "new-town", name: "Action Area 1", slug: "action-area-1" },
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "new-town", name: "Action Area 2", slug: "action-area-2" },
  // Gariahat
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "gariahat", name: "Gariahat Market", slug: "gariahat-market" },
  { citySlug: "kolkata", stateSlug: "west-bengal", districtSlug: "gariahat", name: "Jodhpur Park", slug: "jodhpur-park" },

  // === AHMEDABAD LOCALITIES ===
  // CG Road
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "cg-road", name: "CG Road East", slug: "cg-road-east" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "cg-road", name: "CG Road West", slug: "cg-road-west" },
  // SG Highway
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "sg-highway", name: "Satellite SG Highway", slug: "satellite-sg-highway" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "sg-highway", name: "Bodakdev SG Highway", slug: "bodakdev-sg-highway" },
  // Vastrapur
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "vastrapur", name: "Vastrapur Lake", slug: "vastrapur-lake" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "vastrapur", name: "ISCON Cross Road", slug: "iscon-cross-road" },
  // Navrangpura
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "navrangpura", name: "Law Garden", slug: "law-garden" },
  { citySlug: "ahmedabad", stateSlug: "gujarat", districtSlug: "navrangpura", name: "Gujarat University Area", slug: "gujarat-university-area" },

  // === JAIPUR LOCALITIES ===
  // MI Road
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "mi-road", name: "MI Road Market", slug: "mi-road-market" },
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "mi-road", name: "Station Road", slug: "station-road-jaipur" },
  // Vaishali Nagar
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "vaishali-nagar", name: "Vaishali Nagar Main", slug: "vaishali-nagar-main" },
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "vaishali-nagar", name: "Sindhi Camp", slug: "sindhi-camp" },
  // C-Scheme
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "c-scheme", name: "Statue Circle", slug: "statue-circle" },
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "c-scheme", name: "Ashok Marg", slug: "ashok-marg" },
  // Malviya Nagar
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "malviya-nagar", name: "Malviya Nagar Market", slug: "malviya-nagar-market" },
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "malviya-nagar", name: "Jawahar Nagar", slug: "jawahar-nagar-jaipur" },
  // Pink City
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "pink-city", name: "Hawa Mahal Area", slug: "hawa-mahal-area" },
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "pink-city", name: "Johari Bazaar", slug: "johari-bazaar" },
  { citySlug: "jaipur", stateSlug: "rajasthan", districtSlug: "pink-city", name: "Tripolia Bazaar", slug: "tripolia-bazaar" },

  // === LUCKNOW LOCALITIES ===
  // Hazratganj
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", districtSlug: "hazratganj", name: "Ganesh Ganj", slug: "ganesh-ganj" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", districtSlug: "hazratganj", name: "Parivartan Chowk", slug: "parivartan-chowk" },
  // Gomti Nagar
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", districtSlug: "gomti-nagar", name: "Vibhuti Khand", slug: "vibhuti-khand" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", districtSlug: "gomti-nagar", name: "Gomti Nagar Extension", slug: "gomti-nagar-extension" },
  // Indira Nagar
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", districtSlug: "indira-nagar-lucknow", name: "Indira Nagar Sector 14", slug: "indira-nagar-sector-14" },
  { citySlug: "lucknow", stateSlug: "uttar-pradesh", districtSlug: "indira-nagar-lucknow", name: "Indira Nagar Sector 18", slug: "indira-nagar-sector-18" },

  // === GURUGRAM LOCALITIES ===
  // DLF Cyber City
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "dlf-cyber-city", name: "DLF Phase 2", slug: "dlf-phase-2" },
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "dlf-cyber-city", name: "DLF Phase 3", slug: "dlf-phase-3" },
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "dlf-cyber-city", name: "DLF Cyberhub", slug: "dlf-cyberhub" },
  // Golf Course Road
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "golf-course-road", name: "Golf Course Ext Road", slug: "golf-course-ext-road" },
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "golf-course-road", name: "Suncity", slug: "suncity" },
  // Sohna Road
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "sohna-road", name: "Sohna Road Market", slug: "sohna-road-market" },
  { citySlug: "gurugram", stateSlug: "haryana", districtSlug: "sohna-road", name: "Sector 49", slug: "sector-49" },

  // === KOCHI LOCALITIES ===
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "mg-road-kochi", name: "Mattancherry", slug: "mattancherry" },
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "mg-road-kochi", name: "Broadway", slug: "broadway-kochi" },
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "marine-drive", name: "Queen's Walk", slug: "queens-walk" },
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "marine-drive", name: "Ashoka Beach Road", slug: "ashoka-beach-road" },
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "edappally", name: "Edappally Junction", slug: "edappally-junction" },
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "kakkanad", name: "Infopark", slug: "infopark" },
  { citySlug: "kochi", stateSlug: "kerala", districtSlug: "kakkanad", name: "Smart City", slug: "smart-city-kochi" },

  // === CHANDIGARH LOCALITIES ===
  { citySlug: "chandigarh", stateSlug: "chandigarh", districtSlug: "sector-17", name: "Sector 17 Plaza", slug: "sector-17-plaza" },
  { citySlug: "chandigarh", stateSlug: "chandigarh", districtSlug: "sector-22", name: "Sector 22 Market", slug: "sector-22-market" },
  { citySlug: "chandigarh", stateSlug: "chandigarh", districtSlug: "sector-35", name: "Sector 35 Market", slug: "sector-35-market" },

  // === BHUBANESWAR LOCALITIES ===
  { citySlug: "bhubaneswar", stateSlug: "odisha", districtSlug: "saheed-nagar", name: "Saheed Nagar Market", slug: "saheed-nagar-market" },
  { citySlug: "bhubaneswar", stateSlug: "odisha", districtSlug: "patia", name: "KIIT Square", slug: "kiit-square" },
  { citySlug: "bhubaneswar", stateSlug: "odisha", districtSlug: "patia", name: "Infosys Area", slug: "infosys-area-bhubaneswar" },

  // === RAIPUR LOCALITIES ===
  { citySlug: "raipur", stateSlug: "chhattisgarh", districtSlug: "telibandha", name: "Telibandha Lake", slug: "telibandha-lake" },
  { citySlug: "raipur", stateSlug: "chhattisgarh", districtSlug: "pandri", name: "Pandri Market", slug: "pandri-market" },

  // === DEHRADUN LOCALITIES ===
  { citySlug: "dehradun", stateSlug: "uttarakhand", districtSlug: "rajpur-road", name: "Ballupur", slug: "ballupur" },
  { citySlug: "dehradun", stateSlug: "uttarakhand", districtSlug: "rajpur-road", name: "Dharampur", slug: "dharampur" },
  { citySlug: "dehradun", stateSlug: "uttarakhand", districtSlug: "clock-tower-dehradun", name: "Paltan Bazaar", slug: "paltan-bazaar-dehradun" },
];

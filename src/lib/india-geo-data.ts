// ==========================================
// India Geo Database
// ==========================================
// Comprehensive database of all 36 Indian states/UTs and 500+ cities
// Used for SEO page generation, sitemaps, and internal linking

export interface IndiaState {
  name: string;
  slug: string;
}

export interface IndiaCity {
  name: string;
  slug: string;
  stateSlug: string;
  lat: number;
  lng: number;
  population: number;
  tier: 1 | 2 | 3 | 4;
  aliases: string[];
  isMetro: boolean;
}

// ==========================================
// All 36 States & Union Territories
// ==========================================
export const indiaStates: IndiaState[] = [
  { name: "Andhra Pradesh", slug: "andhra-pradesh" },
  { name: "Arunachal Pradesh", slug: "arunachal-pradesh" },
  { name: "Assam", slug: "assam" },
  { name: "Bihar", slug: "bihar" },
  { name: "Chhattisgarh", slug: "chhattisgarh" },
  { name: "Goa", slug: "goa" },
  { name: "Gujarat", slug: "gujarat" },
  { name: "Haryana", slug: "haryana" },
  { name: "Himachal Pradesh", slug: "himachal-pradesh" },
  { name: "Jharkhand", slug: "jharkhand" },
  { name: "Karnataka", slug: "karnataka" },
  { name: "Kerala", slug: "kerala" },
  { name: "Madhya Pradesh", slug: "madhya-pradesh" },
  { name: "Maharashtra", slug: "maharashtra" },
  { name: "Manipur", slug: "manipur" },
  { name: "Meghalaya", slug: "meghalaya" },
  { name: "Mizoram", slug: "mizoram" },
  { name: "Nagaland", slug: "nagaland" },
  { name: "Odisha", slug: "odisha" },
  { name: "Punjab", slug: "punjab" },
  { name: "Rajasthan", slug: "rajasthan" },
  { name: "Sikkim", slug: "sikkim" },
  { name: "Tamil Nadu", slug: "tamil-nadu" },
  { name: "Telangana", slug: "telangana" },
  { name: "Tripura", slug: "tripura" },
  { name: "Uttar Pradesh", slug: "uttar-pradesh" },
  { name: "Uttarakhand", slug: "uttarakhand" },
  { name: "West Bengal", slug: "west-bengal" },
  { name: "Andaman and Nicobar Islands", slug: "andaman-nicobar" },
  { name: "Chandigarh", slug: "chandigarh" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", slug: "dadra-nagar-haveli" },
  { name: "Delhi", slug: "delhi" },
  { name: "Jammu and Kashmir", slug: "jammu-kashmir" },
  { name: "Ladakh", slug: "ladakh" },
  { name: "Lakshadweep", slug: "lakshadweep" },
  { name: "Puducherry", slug: "puducherry" },
];

// ==========================================
// 500+ Cities
// ==========================================
export const indiaCities: IndiaCity[] = [
  // === MAHARASHTRA ===
  { name: "Mumbai", slug: "mumbai", stateSlug: "maharashtra", lat: 19.076, lng: 72.8777, population: 12442373, tier: 1, aliases: ["bombay", "bambai"], isMetro: true },
  { name: "Pune", slug: "pune", stateSlug: "maharashtra", lat: 18.5204, lng: 73.8567, population: 3124458, tier: 1, aliases: ["poona"], isMetro: true },
  { name: "Nagpur", slug: "nagpur", stateSlug: "maharashtra", lat: 21.1458, lng: 79.0882, population: 2405665, tier: 2, aliases: [], isMetro: false },
  { name: "Thane", slug: "thane", stateSlug: "maharashtra", lat: 19.2183, lng: 72.9781, population: 1845000, tier: 2, aliases: [], isMetro: false },
  { name: "Navi Mumbai", slug: "navi-mumbai", stateSlug: "maharashtra", lat: 19.033, lng: 73.0297, population: 1120000, tier: 2, aliases: [], isMetro: false },
  { name: "Nashik", slug: "nashik", stateSlug: "maharashtra", lat: 19.9975, lng: 73.7898, population: 1486053, tier: 2, aliases: [], isMetro: false },
  { name: "Aurangabad", slug: "aurangabad", stateSlug: "maharashtra", lat: 19.8762, lng: 75.3433, population: 1172160, tier: 2, aliases: [], isMetro: false },
  { name: "Solapur", slug: "solapur", stateSlug: "maharashtra", lat: 17.6805, lng: 75.8908, population: 951118, tier: 2, aliases: ["sholapur"], isMetro: false },
  { name: "Kolhapur", slug: "kolhapur", stateSlug: "maharashtra", lat: 16.705, lng: 74.2433, population: 549236, tier: 3, aliases: [], isMetro: false },
  { name: "Amravati", slug: "amravati", stateSlug: "maharashtra", lat: 20.932, lng: 77.7523, population: 647057, tier: 3, aliases: [], isMetro: false },
  { name: "Sangli", slug: "sangli", stateSlug: "maharashtra", lat: 16.8564, lng: 74.585, population: 483540, tier: 3, aliases: [], isMetro: false },
  { name: "Jalgaon", slug: "jalgaon", stateSlug: "maharashtra", lat: 21.0077, lng: 75.5633, population: 460228, tier: 3, aliases: [], isMetro: false },
  { name: "Akola", slug: "akola", stateSlug: "maharashtra", lat: 20.7006, lng: 77.0051, population: 427672, tier: 3, aliases: [], isMetro: false },
  { name: "Latur", slug: "latur", stateSlug: "maharashtra", lat: 18.3948, lng: 76.3986, population: 382754, tier: 3, aliases: [], isMetro: false },
  { name: "Dhule", slug: "dhule", stateSlug: "maharashtra", lat: 20.9041, lng: 74.7801, population: 375559, tier: 3, aliases: [], isMetro: false },
  { name: "Chandrapur", slug: "chandrapur", stateSlug: "maharashtra", lat: 19.9615, lng: 79.2961, population: 375309, tier: 3, aliases: [], isMetro: false },
  { name: "Parbhani", slug: "parbhani", stateSlug: "maharashtra", lat: 19.2704, lng: 76.6485, population: 307095, tier: 3, aliases: [], isMetro: false },
  { name: "Satara", slug: "satara", stateSlug: "maharashtra", lat: 17.6863, lng: 73.9971, population: 301094, tier: 3, aliases: [], isMetro: false },
  { name: "Bhiwandi", slug: "bhiwandi", stateSlug: "maharashtra", lat: 19.3028, lng: 73.0407, population: 374628, tier: 3, aliases: [], isMetro: false },
  { name: "Ulhasnagar", slug: "ulhasnagar", stateSlug: "maharashtra", lat: 19.2271, lng: 73.1519, population: 506937, tier: 3, aliases: [], isMetro: false },
  { name: "Vasai-Virar", slug: "vasai-virar", stateSlug: "maharashtra", lat: 19.385, lng: 72.8577, population: 1223361, tier: 2, aliases: ["vasai", "virar"], isMetro: false },

  // === DELHI ===
  { name: "Delhi", slug: "delhi", stateSlug: "delhi", lat: 28.7041, lng: 77.1025, population: 16775209, tier: 1, aliases: ["dilli", "ncr"], isMetro: true },
  { name: "New Delhi", slug: "new-delhi", stateSlug: "delhi", lat: 28.6139, lng: 77.209, population: 11000000, tier: 1, aliases: ["central-delhi"], isMetro: true },
  { name: "Dwarka", slug: "dwarka-delhi", stateSlug: "delhi", lat: 28.5733, lng: 77.042, population: 1100000, tier: 2, aliases: ["dwarka"], isMetro: false },
  { name: "Rohini", slug: "rohini", stateSlug: "delhi", lat: 28.7168, lng: 77.119, population: 900000, tier: 2, aliases: [], isMetro: false },
  { name: "Saket", slug: "saket", stateSlug: "delhi", lat: 28.5244, lng: 77.2066, population: 400000, tier: 3, aliases: [], isMetro: false },
  { name: "Karol Bagh", slug: "karol-bagh", stateSlug: "delhi", lat: 28.6519, lng: 77.1909, population: 450000, tier: 3, aliases: [], isMetro: false },
  { name: "Connaught Place", slug: "connaught-place", stateSlug: "delhi", lat: 28.6315, lng: 77.2167, population: 200000, tier: 3, aliases: ["cp", "rajiv-chowk"], isMetro: false },

  // === KARNATAKA ===
  { name: "Bengaluru", slug: "bengaluru", stateSlug: "karnataka", lat: 12.9716, lng: 77.5946, population: 8443675, tier: 1, aliases: ["bangalore", "bangaluru"], isMetro: true },
  { name: "Bangalore", slug: "bangalore", stateSlug: "karnataka", lat: 12.9716, lng: 77.5946, population: 8443675, tier: 1, aliases: ["bengaluru", "bangaluru"], isMetro: true },
  { name: "Mysuru", slug: "mysuru", stateSlug: "karnataka", lat: 12.2958, lng: 76.6394, population: 920550, tier: 2, aliases: ["mysore"], isMetro: false },
  { name: "Mysore", slug: "mysore", stateSlug: "karnataka", lat: 12.2958, lng: 76.6394, population: 920550, tier: 2, aliases: ["mysuru"], isMetro: false },
  { name: "Hubli", slug: "hubli", stateSlug: "karnataka", lat: 15.3647, lng: 75.124, population: 543778, tier: 3, aliases: ["hubballi"], isMetro: false },
  { name: "Mangalore", slug: "mangalore", stateSlug: "karnataka", lat: 12.9141, lng: 74.856, population: 623341, tier: 2, aliases: ["mangaluru"], isMetro: false },
  { name: "Belgaum", slug: "belgaum", stateSlug: "karnataka", lat: 15.8525, lng: 74.4988, population: 488292, tier: 3, aliases: ["belagavi"], isMetro: false },
  { name: "Gulbarga", slug: "gulbarga", stateSlug: "karnataka", lat: 17.3297, lng: 76.8343, population: 543058, tier: 3, aliases: ["kalaburagi"], isMetro: false },
  { name: "Davangere", slug: "davangere", stateSlug: "karnataka", lat: 14.4634, lng: 75.9282, population: 435127, tier: 3, aliases: [], isMetro: false },
  { name: "Bellary", slug: "bellary", stateSlug: "karnataka", lat: 15.1394, lng: 76.9214, population: 408784, tier: 3, aliases: ["ballari"], isMetro: false },
  { name: "Shimoga", slug: "shimoga", stateSlug: "karnataka", lat: 13.9299, lng: 75.5681, population: 322650, tier: 3, aliases: ["shivamogga"], isMetro: false },

  // === TELANGANA ===
  { name: "Hyderabad", slug: "hyderabad", stateSlug: "telangana", lat: 17.385, lng: 78.4867, population: 6810970, tier: 1, aliases: [], isMetro: true },
  { name: "Warangal", slug: "warangal", stateSlug: "telangana", lat: 17.9784, lng: 79.5941, population: 823000, tier: 2, aliases: [], isMetro: false },
  { name: "Nizamabad", slug: "nizamabad", stateSlug: "telangana", lat: 18.6725, lng: 78.0941, population: 311152, tier: 3, aliases: [], isMetro: false },
  { name: "Karimnagar", slug: "karimnagar", stateSlug: "telangana", lat: 18.4364, lng: 79.1315, population: 297447, tier: 3, aliases: [], isMetro: false },
  { name: "Khammam", slug: "khammam", stateSlug: "telangana", lat: 17.2474, lng: 80.1514, population: 284350, tier: 3, aliases: [], isMetro: false },

  // === TAMIL NADU ===
  { name: "Chennai", slug: "chennai", stateSlug: "tamil-nadu", lat: 13.0827, lng: 80.2707, population: 4681087, tier: 1, aliases: ["madras"], isMetro: true },
  { name: "Coimbatore", slug: "coimbatore", stateSlug: "tamil-nadu", lat: 11.0168, lng: 76.9558, population: 1658141, tier: 2, aliases: ["kovai"], isMetro: false },
  { name: "Madurai", slug: "madurai", stateSlug: "tamil-nadu", lat: 9.9252, lng: 78.1198, population: 1462240, tier: 2, aliases: [], isMetro: false },
  { name: "Tiruchirappalli", slug: "tiruchirappalli", stateSlug: "tamil-nadu", lat: 10.7905, lng: 78.7047, population: 916857, tier: 2, aliases: ["trichy", "tiruchirapalli"], isMetro: false },
  { name: "Salem", slug: "salem", stateSlug: "tamil-nadu", lat: 11.6643, lng: 78.146, population: 829267, tier: 2, aliases: [], isMetro: false },
  { name: "Tirunelveli", slug: "tirunelveli", stateSlug: "tamil-nadu", lat: 8.7139, lng: 77.7567, population: 473637, tier: 3, aliases: ["nellai"], isMetro: false },
  { name: "Erode", slug: "erode", stateSlug: "tamil-nadu", lat: 11.341, lng: 77.7172, population: 521886, tier: 3, aliases: [], isMetro: false },
  { name: "Vellore", slug: "vellore", stateSlug: "tamil-nadu", lat: 12.9165, lng: 79.1325, population: 504079, tier: 3, aliases: [], isMetro: false },
  { name: "Thoothukudi", slug: "thoothukudi", stateSlug: "tamil-nadu", lat: 8.7642, lng: 78.1348, population: 403624, tier: 3, aliases: ["tuticorin"], isMetro: false },
  { name: "Dindigul", slug: "dindigul", stateSlug: "tamil-nadu", lat: 10.3673, lng: 77.9803, population: 301468, tier: 3, aliases: [], isMetro: false },
  { name: "Thanjavur", slug: "thanjavur", stateSlug: "tamil-nadu", lat: 10.787, lng: 79.1378, population: 290720, tier: 3, aliases: [], isMetro: false },
  { name: "Kanyakumari", slug: "kanyakumari", stateSlug: "tamil-nadu", lat: 8.0883, lng: 77.5385, population: 300000, tier: 3, aliases: [], isMetro: false },

  // === UTTAR PRADESH ===
  { name: "Lucknow", slug: "lucknow", stateSlug: "uttar-pradesh", lat: 26.8467, lng: 80.9462, population: 2817105, tier: 1, aliases: [], isMetro: true },
  { name: "Kanpur", slug: "kanpur", stateSlug: "uttar-pradesh", lat: 26.4499, lng: 80.3319, population: 2765348, tier: 1, aliases: [], isMetro: true },
  { name: "Agra", slug: "agra", stateSlug: "uttar-pradesh", lat: 27.1767, lng: 78.0081, population: 1758210, tier: 2, aliases: [], isMetro: false },
  { name: "Varanasi", slug: "varanasi", stateSlug: "uttar-pradesh", lat: 25.3176, lng: 82.9739, population: 1198515, tier: 2, aliases: ["benares", "kashi"], isMetro: false },
  { name: "Prayagraj", slug: "prayagraj", stateSlug: "uttar-pradesh", lat: 25.4358, lng: 81.8463, population: 1122570, tier: 2, aliases: ["allahabad"], isMetro: false },
  { name: "Allahabad", slug: "allahabad", stateSlug: "uttar-pradesh", lat: 25.4316, lng: 81.8463, population: 1122570, tier: 2, aliases: ["prayagraj"], isMetro: false },
  { name: "Meerut", slug: "meerut", stateSlug: "uttar-pradesh", lat: 28.9845, lng: 77.7064, population: 1305429, tier: 2, aliases: [], isMetro: false },
  { name: "Noida", slug: "noida", stateSlug: "uttar-pradesh", lat: 28.5355, lng: 77.391, population: 637272, tier: 2, aliases: ["noida-greater-noida"], isMetro: false },
  { name: "Ghaziabad", slug: "ghaziabad", stateSlug: "uttar-pradesh", lat: 28.6692, lng: 77.4538, population: 1658000, tier: 2, aliases: [], isMetro: false },
  { name: "Bareilly", slug: "bareilly", stateSlug: "uttar-pradesh", lat: 28.3671, lng: 79.4304, population: 903668, tier: 2, aliases: [], isMetro: false },
  { name: "Aligarh", slug: "aligarh", stateSlug: "uttar-pradesh", lat: 27.8839, lng: 78.0783, population: 873407, tier: 2, aliases: [], isMetro: false },
  { name: "Moradabad", slug: "moradabad", stateSlug: "uttar-pradesh", lat: 28.8386, lng: 78.762, population: 889810, tier: 2, aliases: [], isMetro: false },
  { name: "Gorakhpur", slug: "gorakhpur", stateSlug: "uttar-pradesh", lat: 26.7606, lng: 83.3732, population: 673446, tier: 2, aliases: [], isMetro: false },
  { name: "Jhansi", slug: "jhansi", stateSlug: "uttar-pradesh", lat: 25.4484, lng: 78.5685, population: 505693, tier: 3, aliases: [], isMetro: false },
  { name: "Mathura", slug: "mathura", stateSlug: "uttar-pradesh", lat: 27.4924, lng: 77.6737, population: 445689, tier: 3, aliases: [], isMetro: false },
  { name: "Firozabad", slug: "firozabad", stateSlug: "uttar-pradesh", lat: 27.1527, lng: 78.3922, population: 603797, tier: 3, aliases: [], isMetro: false },

  // === GUJARAT ===
  { name: "Ahmedabad", slug: "ahmedabad", stateSlug: "gujarat", lat: 23.0225, lng: 72.5714, population: 5577940, tier: 1, aliases: ["amdavad"], isMetro: true },
  { name: "Surat", slug: "surat", stateSlug: "gujarat", lat: 21.1702, lng: 72.8311, population: 4467797, tier: 1, aliases: ["suryapur"], isMetro: true },
  { name: "Vadodara", slug: "vadodara", stateSlug: "gujarat", lat: 22.3072, lng: 73.1812, population: 1835489, tier: 2, aliases: ["baroda"], isMetro: false },
  { name: "Rajkot", slug: "rajkot", stateSlug: "gujarat", lat: 22.3039, lng: 70.8022, population: 1337545, tier: 2, aliases: [], isMetro: false },
  { name: "Bhavnagar", slug: "bhavnagar", stateSlug: "gujarat", lat: 21.7635, lng: 72.1527, population: 605882, tier: 3, aliases: [], isMetro: false },
  { name: "Jamnagar", slug: "jamnagar", stateSlug: "gujarat", lat: 22.4707, lng: 70.0577, population: 600943, tier: 3, aliases: [], isMetro: false },
  { name: "Junagadh", slug: "junagadh", stateSlug: "gujarat", lat: 21.5222, lng: 70.4579, population: 320250, tier: 3, aliases: [], isMetro: false },
  { name: "Gandhinagar", slug: "gandhinagar", stateSlug: "gujarat", lat: 23.2156, lng: 72.6369, population: 206500, tier: 3, aliases: [], isMetro: false },
  { name: "Anand", slug: "anand", stateSlug: "gujarat", lat: 22.5645, lng: 72.9289, population: 410798, tier: 3, aliases: [], isMetro: false },
  { name: "Nadiad", slug: "nadiad", stateSlug: "gujarat", lat: 22.6875, lng: 72.8565, population: 230958, tier: 3, aliases: [], isMetro: false },
  { name: "Morbi", slug: "morbi", stateSlug: "gujarat", lat: 22.8219, lng: 70.8336, population: 248000, tier: 3, aliases: [], isMetro: false },

  // === RAJASTHAN ===
  { name: "Jaipur", slug: "jaipur", stateSlug: "rajasthan", lat: 26.9124, lng: 75.7873, population: 3073350, tier: 1, aliases: ["pink-city"], isMetro: true },
  { name: "Jodhpur", slug: "jodhpur", stateSlug: "rajasthan", lat: 26.2389, lng: 73.0243, population: 1132515, tier: 2, aliases: ["sun-city"], isMetro: false },
  { name: "Udaipur", slug: "udaipur", stateSlug: "rajasthan", lat: 24.5854, lng: 73.7125, population: 451100, tier: 2, aliases: ["city-of-lakes"], isMetro: false },
  { name: "Kota", slug: "kota", stateSlug: "rajasthan", lat: 25.1801, lng: 75.8641, population: 1001694, tier: 2, aliases: [], isMetro: false },
  { name: "Bikaner", slug: "bikaner", stateSlug: "rajasthan", lat: 28.0229, lng: 73.2159, population: 644686, tier: 3, aliases: [], isMetro: false },
  { name: "Ajmer", slug: "ajmer", stateSlug: "rajasthan", lat: 26.4535, lng: 74.6399, population: 548617, tier: 3, aliases: ["ajmer-sharif"], isMetro: false },
  { name: "Alwar", slug: "alwar", stateSlug: "rajasthan", lat: 27.5568, lng: 76.6344, population: 341422, tier: 3, aliases: [], isMetro: false },
  { name: "Bhilwara", slug: "bhilwara", stateSlug: "rajasthan", lat: 25.3512, lng: 74.6356, population: 360009, tier: 3, aliases: [], isMetro: false },
  { name: "Sikar", slug: "sikar", stateSlug: "rajasthan", lat: 27.6075, lng: 75.1398, population: 300000, tier: 3, aliases: [], isMetro: false },
  { name: "Pushkar", slug: "pushkar", stateSlug: "rajasthan", lat: 26.4897, lng: 74.5511, population: 22000, tier: 4, aliases: [], isMetro: false },

  // === WEST BENGAL ===
  { name: "Kolkata", slug: "kolkata", stateSlug: "west-bengal", lat: 22.5726, lng: 88.3639, population: 4496694, tier: 1, aliases: ["calcutta"], isMetro: true },
  { name: "Howrah", slug: "howrah", stateSlug: "west-bengal", lat: 22.5758, lng: 88.2636, population: 1007761, tier: 2, aliases: [], isMetro: false },
  { name: "Durgapur", slug: "durgapur", stateSlug: "west-bengal", lat: 23.5204, lng: 87.3119, population: 566517, tier: 3, aliases: [], isMetro: false },
  { name: "Asansol", slug: "asansol", stateSlug: "west-bengal", lat: 23.6835, lng: 86.9524, population: 563917, tier: 3, aliases: [], isMetro: false },
  { name: "Siliguri", slug: "siliguri", stateSlug: "west-bengal", lat: 26.7271, lng: 88.3953, population: 513264, tier: 3, aliases: [], isMetro: false },
  { name: "Bardhaman", slug: "bardhaman", stateSlug: "west-bengal", lat: 23.2333, lng: 87.8613, population: 377067, tier: 3, aliases: ["burdwan"], isMetro: false },
  { name: "Darjeeling", slug: "darjeeling", stateSlug: "west-bengal", lat: 27.036, lng: 88.2627, population: 132016, tier: 3, aliases: [], isMetro: false },
  { name: "Malda", slug: "malda", stateSlug: "west-bengal", lat: 25.0037, lng: 88.1439, population: 399000, tier: 3, aliases: [], isMetro: false },
  { name: "Haldia", slug: "haldia", stateSlug: "west-bengal", lat: 22.0307, lng: 88.0629, population: 200762, tier: 3, aliases: [], isMetro: false },

  // === KERALA ===
  { name: "Kochi", slug: "kochi", stateSlug: "kerala", lat: 9.9312, lng: 76.2673, population: 677076, tier: 1, aliases: ["cochin", "ernakulam"], isMetro: true },
  { name: "Thiruvananthapuram", slug: "thiruvananthapuram", stateSlug: "kerala", lat: 8.5241, lng: 76.9366, population: 957730, tier: 2, aliases: ["trivandrum"], isMetro: false },
  { name: "Kozhikode", slug: "kozhikode", stateSlug: "kerala", lat: 11.2588, lng: 75.7804, population: 609224, tier: 2, aliases: ["calicut"], isMetro: false },
  { name: "Thrissur", slug: "thrissur", stateSlug: "kerala", lat: 10.5273, lng: 76.2144, population: 346000, tier: 2, aliases: ["trichur"], isMetro: false },
  { name: "Kollam", slug: "kollam", stateSlug: "kerala", lat: 8.8803, lng: 76.5855, population: 397510, tier: 3, aliases: ["quilon"], isMetro: false },
  { name: "Kannur", slug: "kannur", stateSlug: "kerala", lat: 11.8745, lng: 75.3704, population: 232486, tier: 3, aliases: ["cannanore"], isMetro: false },
  { name: "Alappuzha", slug: "alappuzha", stateSlug: "kerala", lat: 9.4981, lng: 76.3388, population: 241676, tier: 3, aliases: ["alleppey"], isMetro: false },
  { name: "Palakkad", slug: "palakkad", stateSlug: "kerala", lat: 10.7867, lng: 76.6548, population: 295000, tier: 3, aliases: ["palghat"], isMetro: false },
  { name: "Malappuram", slug: "malappuram", stateSlug: "kerala", lat: 11.0623, lng: 76.0731, population: 300000, tier: 3, aliases: [], isMetro: false },
  { name: "Kottayam", slug: "kottayam", stateSlug: "kerala", lat: 9.5916, lng: 76.5222, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Wayanad", slug: "wayanad", stateSlug: "kerala", lat: 11.6854, lng: 76.132, population: 85000, tier: 4, aliases: [], isMetro: false },

  // === MADHYA PRADESH ===
  { name: "Bhopal", slug: "bhopal", stateSlug: "madhya-pradesh", lat: 23.2599, lng: 77.4126, population: 1795648, tier: 2, aliases: ["city-of-lakes"], isMetro: false },
  { name: "Indore", slug: "indore", stateSlug: "madhya-pradesh", lat: 22.7196, lng: 75.8577, population: 1964306, tier: 2, aliases: [], isMetro: false },
  { name: "Jabalpur", slug: "jabalpur", stateSlug: "madhya-pradesh", lat: 23.1815, lng: 79.9864, population: 1267564, tier: 2, aliases: [], isMetro: false },
  { name: "Gwalior", slug: "gwalior", stateSlug: "madhya-pradesh", lat: 26.2183, lng: 78.1828, population: 1102000, tier: 2, aliases: [], isMetro: false },
  { name: "Ujjain", slug: "ujjain", stateSlug: "madhya-pradesh", lat: 23.1791, lng: 75.7872, population: 515215, tier: 3, aliases: [], isMetro: false },
  { name: "Sagar", slug: "sagar", stateSlug: "madhya-pradesh", lat: 23.8388, lng: 78.7428, population: 370000, tier: 3, aliases: [], isMetro: false },
  { name: "Dewas", slug: "dewas", stateSlug: "madhya-pradesh", lat: 22.9642, lng: 76.057, population: 315000, tier: 3, aliases: [], isMetro: false },
  { name: "Satna", slug: "satna", stateSlug: "madhya-pradesh", lat: 24.5839, lng: 80.8312, population: 280000, tier: 3, aliases: [], isMetro: false },
  { name: "Ratlam", slug: "ratlam", stateSlug: "madhya-pradesh", lat: 23.3315, lng: 75.0367, population: 274000, tier: 3, aliases: [], isMetro: false },

  // === BIHAR ===
  { name: "Patna", slug: "patna", stateSlug: "bihar", lat: 25.6093, lng: 85.1376, population: 1684222, tier: 2, aliases: ["patliputra"], isMetro: false },
  { name: "Gaya", slug: "gaya", stateSlug: "bihar", lat: 24.7961, lng: 84.9999, population: 470839, tier: 3, aliases: [], isMetro: false },
  { name: "Muzaffarpur", slug: "muzaffarpur", stateSlug: "bihar", lat: 26.1197, lng: 85.391, population: 393724, tier: 3, aliases: [], isMetro: false },
  { name: "Bhagalpur", slug: "bhagalpur", stateSlug: "bihar", lat: 25.2444, lng: 86.9725, population: 410210, tier: 3, aliases: [], isMetro: false },
  { name: "Darbhanga", slug: "darbhanga", stateSlug: "bihar", lat: 26.1535, lng: 85.8975, population: 380000, tier: 3, aliases: [], isMetro: false },
  { name: "Purnia", slug: "purnia", stateSlug: "bihar", lat: 25.7769, lng: 87.4782, population: 290000, tier: 3, aliases: [], isMetro: false },
  { name: "Ara", slug: "ara", stateSlug: "bihar", lat: 25.5561, lng: 84.6683, population: 280000, tier: 3, aliases: [], isMetro: false },
  { name: "Hajipur", slug: "hajipur", stateSlug: "bihar", lat: 25.6862, lng: 85.2087, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Siwan", slug: "siwan", stateSlug: "bihar", lat: 26.2216, lng: 84.3564, population: 190000, tier: 4, aliases: [], isMetro: false },

  // === PUNJAB ===
  { name: "Chandigarh", slug: "chandigarh", stateSlug: "chandigarh", lat: 30.7333, lng: 76.7794, population: 1055450, tier: 1, aliases: ["city-beautiful"], isMetro: true },
  { name: "Amritsar", slug: "amritsar", stateSlug: "punjab", lat: 31.634, lng: 74.8723, population: 1132619, tier: 2, aliases: [], isMetro: false },
  { name: "Ludhiana", slug: "ludhiana", stateSlug: "punjab", lat: 30.901, lng: 75.8573, population: 1616879, tier: 2, aliases: [], isMetro: false },
  { name: "Jalandhar", slug: "jalandhar", stateSlug: "punjab", lat: 31.326, lng: 75.5762, population: 873725, tier: 3, aliases: [], isMetro: false },
  { name: "Patiala", slug: "patiala", stateSlug: "punjab", lat: 30.3398, lng: 76.3865, population: 445827, tier: 3, aliases: [], isMetro: false },
  { name: "Bathinda", slug: "bathinda", stateSlug: "punjab", lat: 30.2101, lng: 74.9452, population: 390000, tier: 3, aliases: [], isMetro: false },
  { name: "Mohali", slug: "mohali", stateSlug: "punjab", lat: 30.695, lng: 76.7353, population: 210000, tier: 2, aliases: ["sasl-nagar", "sahibzada-ajit-singh-nagar"], isMetro: false },
  { name: "Pathankot", slug: "pathankot", stateSlug: "punjab", lat: 32.2688, lng: 75.6466, population: 170000, tier: 3, aliases: [], isMetro: false },
  { name: "Moga", slug: "moga", stateSlug: "punjab", lat: 30.8201, lng: 75.1708, population: 150000, tier: 4, aliases: [], isMetro: false },

  // === HARYANA ===
  { name: "Gurugram", slug: "gurugram", stateSlug: "haryana", lat: 28.4595, lng: 77.0266, population: 1514000, tier: 1, aliases: ["gurgaon"], isMetro: true },
  { name: "Faridabad", slug: "faridabad", stateSlug: "haryana", lat: 28.4089, lng: 77.3178, population: 1414050, tier: 2, aliases: [], isMetro: false },
  { name: "Panipat", slug: "panipat", stateSlug: "haryana", lat: 29.3909, lng: 76.9635, population: 444524, tier: 3, aliases: [], isMetro: false },
  { name: "Ambala", slug: "ambala", stateSlug: "haryana", lat: 30.3782, lng: 76.7767, population: 411000, tier: 3, aliases: [], isMetro: false },
  { name: "Karnal", slug: "karnal", stateSlug: "haryana", lat: 29.6857, lng: 76.9905, population: 350000, tier: 3, aliases: [], isMetro: false },
  { name: "Rohtak", slug: "rohtak", stateSlug: "haryana", lat: 28.8955, lng: 76.6066, population: 374292, tier: 3, aliases: [], isMetro: false },
  { name: "Hisar", slug: "hisar", stateSlug: "haryana", lat: 29.1492, lng: 75.7217, population: 374000, tier: 3, aliases: [], isMetro: false },
  { name: "Sonipat", slug: "sonipat", stateSlug: "haryana", lat: 28.9931, lng: 77.0151, population: 300000, tier: 3, aliases: ["sonepat"], isMetro: false },

  // === ANDHRA PRADESH ===
  { name: "Visakhapatnam", slug: "visakhapatnam", stateSlug: "andhra-pradesh", lat: 17.6868, lng: 83.2185, population: 2035922, tier: 2, aliases: ["vizag", "vizagapatam"], isMetro: false },
  { name: "Vijayawada", slug: "vijayawada", stateSlug: "andhra-pradesh", lat: 16.5074, lng: 80.6466, population: 1034000, tier: 2, aliases: ["bezawada"], isMetro: false },
  { name: "Amaravati", slug: "amaravati", stateSlug: "andhra-pradesh", lat: 16.5136, lng: 80.5165, population: 150000, tier: 2, aliases: ["amaravathi"], isMetro: false },
  { name: "Guntur", slug: "guntur", stateSlug: "andhra-pradesh", lat: 16.3067, lng: 80.4365, population: 743354, tier: 2, aliases: [], isMetro: false },
  { name: "Nellore", slug: "nellore", stateSlug: "andhra-pradesh", lat: 14.4503, lng: 79.9868, population: 616000, tier: 3, aliases: [], isMetro: false },
  { name: "Kurnool", slug: "kurnool", stateSlug: "andhra-pradesh", lat: 15.8281, lng: 78.0373, population: 484327, tier: 3, aliases: [], isMetro: false },
  { name: "Rajahmundry", slug: "rajahmundry", stateSlug: "andhra-pradesh", lat: 16.9877, lng: 81.7671, population: 478000, tier: 3, aliases: ["rajamahendravaram"], isMetro: false },
  { name: "Tirupati", slug: "tirupati", stateSlug: "andhra-pradesh", lat: 13.6288, lng: 79.4192, population: 475000, tier: 3, aliases: [], isMetro: false },
  { name: "Eluru", slug: "eluru", stateSlug: "andhra-pradesh", lat: 16.6584, lng: 81.1052, population: 290000, tier: 3, aliases: [], isMetro: false },
  { name: "Ongole", slug: "ongole", stateSlug: "andhra-pradesh", lat: 15.5053, lng: 80.0487, population: 270000, tier: 3, aliases: [], isMetro: false },
  { name: "Chirala", slug: "chirala", stateSlug: "andhra-pradesh", lat: 15.8239, lng: 80.3522, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Anantapur", slug: "anantapur", stateSlug: "andhra-pradesh", lat: 14.6799, lng: 77.6013, population: 310000, tier: 3, aliases: [], isMetro: false },

  // === TELANGANA (more cities) ===
  // (already have Hyderabad, Warangal, Nizamabad, Karimnagar, Khammam)

  // === ODISSA ===
  { name: "Bhubaneswar", slug: "bhubaneswar", stateSlug: "odisha", lat: 20.2961, lng: 85.8245, population: 837737, tier: 2, aliases: ["bhubaneshwar"], isMetro: false },
  { name: "Cuttack", slug: "cuttack", stateSlug: "odisha", lat: 20.4619, lng: 85.8829, population: 610189, tier: 2, aliases: ["kataka"], isMetro: false },
  { name: "Rourkela", slug: "rourkela", stateSlug: "odisha", lat: 22.2604, lng: 84.8836, population: 553000, tier: 3, aliases: [], isMetro: false },
  { name: "Berhampur", slug: "berhampur", stateSlug: "odisha", lat: 19.3169, lng: 83.8634, population: 410000, tier: 3, aliases: ["brahmapur"], isMetro: false },
  { name: "Sambalpur", slug: "sambalpur", stateSlug: "odisha", lat: 21.4664, lng: 83.9756, population: 230000, tier: 3, aliases: [], isMetro: false },
  { name: "Puri", slug: "puri", stateSlug: "odisha", lat: 19.8135, lng: 85.8312, population: 200000, tier: 3, aliases: [], isMetro: false },

  // === CHHATTISGARH ===
  { name: "Raipur", slug: "raipur", stateSlug: "chhattisgarh", lat: 21.2514, lng: 81.6296, population: 1010870, tier: 2, aliases: [], isMetro: false },
  { name: "Bhilai", slug: "bhilai", stateSlug: "chhattisgarh", lat: 21.1906, lng: 81.3828, population: 625696, tier: 3, aliases: [], isMetro: false },
  { name: "Bilaspur", slug: "bilaspur", stateSlug: "chhattisgarh", lat: 22.0908, lng: 82.1404, population: 455000, tier: 3, aliases: [], isMetro: false },
  { name: "Korba", slug: "korba", stateSlug: "chhattisgarh", lat: 22.3497, lng: 82.6887, population: 300000, tier: 3, aliases: [], isMetro: false },
  { name: "Durg", slug: "durg", stateSlug: "chhattisgarh", lat: 21.1899, lng: 81.2847, population: 320000, tier: 3, aliases: [], isMetro: false },

  // === GOA ===
  { name: "Panaji", slug: "panaji", stateSlug: "goa", lat: 15.4909, lng: 73.8278, population: 114000, tier: 2, aliases: ["panjim"], isMetro: false },
  { name: "Margao", slug: "margao", stateSlug: "goa", lat: 15.2993, lng: 74.0085, population: 106000, tier: 3, aliases: ["margao", "madgaon"], isMetro: false },
  { name: "Vasco da Gama", slug: "vasco-da-gama", stateSlug: "goa", lat: 15.3989, lng: 73.8308, population: 100000, tier: 3, aliases: ["vasco"], isMetro: false },
  { name: "Mapusa", slug: "mapusa", stateSlug: "goa", lat: 15.6006, lng: 73.826, population: 57000, tier: 4, aliases: [], isMetro: false },

  // === ASSAM ===
  { name: "Guwahati", slug: "guwahati", stateSlug: "assam", lat: 26.1445, lng: 91.7362, population: 957352, tier: 2, aliases: ["gowhati", "gauhati"], isMetro: false },
  { name: "Silchar", slug: "silchar", stateSlug: "assam", lat: 24.8331, lng: 92.7959, population: 228000, tier: 3, aliases: [], isMetro: false },
  { name: "Dibrugarh", slug: "dibrugarh", stateSlug: "assam", lat: 27.4577, lng: 94.9127, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Jorhat", slug: "jorhat", stateSlug: "assam", lat: 26.7497, lng: 94.2167, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Tezpur", slug: "tezpur", stateSlug: "assam", lat: 26.6308, lng: 92.7947, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Nagaon", slug: "nagaon", stateSlug: "assam", lat: 26.3465, lng: 92.6818, population: 130000, tier: 3, aliases: [], isMetro: false },

  // === JHARKHAND ===
  { name: "Ranchi", slug: "ranchi", stateSlug: "jharkhand", lat: 23.3441, lng: 85.3096, population: 1073440, tier: 2, aliases: [], isMetro: false },
  { name: "Jamshedpur", slug: "jamshedpur", stateSlug: "jharkhand", lat: 22.8046, lng: 86.2029, population: 718000, tier: 2, aliases: [], isMetro: false },
  { name: "Dhanbad", slug: "dhanbad", stateSlug: "jharkhand", lat: 23.7957, lng: 86.4304, population: 800000, tier: 2, aliases: ["coal-capital"], isMetro: false },
  { name: "Bokaro", slug: "bokaro", stateSlug: "jharkhand", lat: 23.7844, lng: 85.9594, population: 500000, tier: 3, aliases: ["bokaro-steel-city"], isMetro: false },
  { name: "Hazaribagh", slug: "hazaribagh", stateSlug: "jharkhand", lat: 23.5978, lng: 85.3629, population: 200000, tier: 3, aliases: [], isMetro: false },

  // === UTTARAKHAND ===
  { name: "Dehradun", slug: "dehradun", stateSlug: "uttarakhand", lat: 30.3165, lng: 78.0322, population: 706124, tier: 2, aliases: [], isMetro: false },
  { name: "Haridwar", slug: "haridwar", stateSlug: "uttarakhand", lat: 29.9457, lng: 78.1642, population: 310000, tier: 3, aliases: [], isMetro: false },
  { name: "Rishikesh", slug: "rishikesh", stateSlug: "uttarakhand", lat: 30.0869, lng: 78.2676, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Haldwani", slug: "haldwani", stateSlug: "uttarakhand", lat: 29.2165, lng: 79.5153, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Nainital", slug: "nainital", stateSlug: "uttarakhand", lat: 29.3803, lng: 79.4636, population: 60000, tier: 4, aliases: [], isMetro: false },
  { name: "Mussoorie", slug: "mussoorie", stateSlug: "uttarakhand", lat: 30.4598, lng: 78.0644, population: 30000, tier: 4, aliases: ["queen-of-hills"], isMetro: false },
  { name: "Roorkee", slug: "roorkee", stateSlug: "uttarakhand", lat: 29.8563, lng: 77.8854, population: 150000, tier: 3, aliases: [], isMetro: false },

  // === HIMACHAL PRADESH ===
  { name: "Shimla", slug: "shimla", stateSlug: "himachal-pradesh", lat: 31.1048, lng: 77.1734, population: 169578, tier: 3, aliases: ["simla"], isMetro: false },
  { name: "Dharamshala", slug: "dharamshala", stateSlug: "himachal-pradesh", lat: 32.219, lng: 76.3234, population: 53000, tier: 4, aliases: ["dharamsala"], isMetro: false },
  { name: "Manali", slug: "manali", stateSlug: "himachal-pradesh", lat: 32.2396, lng: 77.1887, population: 30000, tier: 4, aliases: [], isMetro: false },
  { name: "Solan", slug: "solan", stateSlug: "himachal-pradesh", lat: 30.9047, lng: 77.0967, population: 50000, tier: 4, aliases: [], isMetro: false },
  { name: "Mandi", slug: "mandi", stateSlug: "himachal-pradesh", lat: 31.7106, lng: 76.9289, population: 40000, tier: 4, aliases: [], isMetro: false },

  // === JAMMU AND KASHMIR ===
  { name: "Srinagar", slug: "srinagar", stateSlug: "jammu-kashmir", lat: 34.0837, lng: 74.7973, population: 1182000, tier: 2, aliases: [], isMetro: false },
  { name: "Jammu", slug: "jammu", stateSlug: "jammu-kashmir", lat: 32.7266, lng: 74.857, population: 680000, tier: 2, aliases: [], isMetro: false },
  { name: "Anantnag", slug: "anantnag", stateSlug: "jammu-kashmir", lat: 33.7293, lng: 75.1442, population: 150000, tier: 4, aliases: ["ananatnag", "islamabad"], isMetro: false },
  { name: "Gulmarg", slug: "gulmarg", stateSlug: "jammu-kashmir", lat: 34.0484, lng: 74.3805, population: 10000, tier: 4, aliases: [], isMetro: false },
  { name: "Pahalgam", slug: "pahalgam", stateSlug: "jammu-kashmir", lat: 34.0161, lng: 75.315, population: 15000, tier: 4, aliases: [], isMetro: false },

  // === LADAKH ===
  { name: "Leh", slug: "leh", stateSlug: "ladakh", lat: 34.1526, lng: 77.5771, population: 30000, tier: 4, aliases: [], isMetro: false },

  // === NORTHEAST ===
  { name: "Agartala", slug: "agartala", stateSlug: "tripura", lat: 23.8315, lng: 91.2868, population: 400000, tier: 3, aliases: [], isMetro: false },
  { name: "Aizawl", slug: "aizawl", stateSlug: "mizoram", lat: 23.7271, lng: 92.7176, population: 300000, tier: 3, aliases: [], isMetro: false },
  { name: "Imphal", slug: "imphal", stateSlug: "manipur", lat: 24.817, lng: 93.9368, population: 350000, tier: 3, aliases: [], isMetro: false },
  { name: "Kohima", slug: "kohima", stateSlug: "nagaland", lat: 25.6751, lng: 94.1086, population: 100000, tier: 4, aliases: [], isMetro: false },
  { name: "Shillong", slug: "shillong", stateSlug: "meghalaya", lat: 25.5788, lng: 91.8933, population: 143007, tier: 3, aliases: [], isMetro: false },
  { name: "Itanagar", slug: "itanagar", stateSlug: "arunachal-pradesh", lat: 27.0844, lng: 93.6053, population: 80000, tier: 4, aliases: [], isMetro: false },
  { name: "Gangtok", slug: "gangtok", stateSlug: "sikkim", lat: 27.3389, lng: 88.6065, population: 100000, tier: 4, aliases: [], isMetro: false },
  { name: "Dispur", slug: "dispur", stateSlug: "assam", lat: 26.1433, lng: 91.7884, population: 100000, tier: 4, aliases: [], isMetro: false },

  // === UNION TERRITORIES ===
  { name: "Port Blair", slug: "port-blair", stateSlug: "andaman-nicobar", lat: 11.6234, lng: 92.7265, population: 150000, tier: 4, aliases: [], isMetro: false },
  { name: "Puducherry", slug: "puducherry", stateSlug: "puducherry", lat: 11.9416, lng: 79.8083, population: 244377, tier: 3, aliases: ["pondicherry"], isMetro: false },
  { name: "Silvassa", slug: "silvassa", stateSlug: "dadra-nagar-haveli", lat: 20.2665, lng: 73.0167, population: 100000, tier: 4, aliases: [], isMetro: false },
  { name: "Daman", slug: "daman", stateSlug: "dadra-nagar-haveli", lat: 20.3974, lng: 72.8328, population: 50000, tier: 4, aliases: [], isMetro: false },
  { name: "Kavaratti", slug: "kavaratti", stateSlug: "lakshadweep", lat: 10.5667, lng: 72.6417, population: 10000, tier: 4, aliases: [], isMetro: false },

  // === MORE CITIES TO REACH 500+ ===
  // Additional Maharashtra
  { name: "Jalna", slug: "jalna", stateSlug: "maharashtra", lat: 19.8465, lng: 75.8821, population: 280000, tier: 3, aliases: [], isMetro: false },
  { name: "Baramati", slug: "baramati", stateSlug: "maharashtra", lat: 18.15, lng: 74.58, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Ratnagiri", slug: "ratnagiri", stateSlug: "maharashtra", lat: 16.9837, lng: 73.2985, population: 120000, tier: 4, aliases: [], isMetro: false },
  { name: "Sindhudurg", slug: "sindhudurg", stateSlug: "maharashtra", lat: 16.3579, lng: 73.6335, population: 80000, tier: 4, aliases: [], isMetro: false },
  { name: "Wardha", slug: "wardha", stateSlug: "maharashtra", lat: 20.7396, lng: 78.6021, population: 120000, tier: 4, aliases: [], isMetro: false },

  // Additional Gujarat
  { name: "Mehsana", slug: "mehsana", stateSlug: "gujarat", lat: 23.588, lng: 72.3693, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Bhuj", slug: "bhuj", stateSlug: "gujarat", lat: 23.242, lng: 69.6669, population: 150000, tier: 4, aliases: [], isMetro: false },
  { name: "Porbandar", slug: "porbandar", stateSlug: "gujarat", lat: 21.6417, lng: 69.6293, population: 150000, tier: 4, aliases: [], isMetro: false },
  { name: "Veraval", slug: "veraval", stateSlug: "gujarat", lat: 20.888, lng: 70.3756, population: 200000, tier: 3, aliases: [], isMetro: false },

  // Additional Rajasthan
  { name: "Neemrana", slug: "neemrana", stateSlug: "rajasthan", lat: 27.9792, lng: 76.3886, population: 50000, tier: 4, aliases: [], isMetro: false },
  { name: "Mount Abu", slug: "mount-abu", stateSlug: "rajasthan", lat: 24.5926, lng: 72.7156, population: 30000, tier: 4, aliases: [], isMetro: false },
  { name: "Pali", slug: "pali", stateSlug: "rajasthan", lat: 25.7742, lng: 73.3254, population: 150000, tier: 3, aliases: [], isMetro: false },

  // Additional UP
  { name: "Shahjahanpur", slug: "shahjahanpur", stateSlug: "uttar-pradesh", lat: 27.8802, lng: 79.9136, population: 300000, tier: 3, aliases: [], isMetro: false },
  { name: "Hardoi", slug: "hardoi", stateSlug: "uttar-pradesh", lat: 27.3968, lng: 80.1225, population: 250000, tier: 3, aliases: [], isMetro: false },
  { name: "Etawah", slug: "etawah", stateSlug: "uttar-pradesh", lat: 26.7706, lng: 79.0194, population: 220000, tier: 3, aliases: [], isMetro: false },
  { name: "Faizabad", slug: "faizabad", stateSlug: "uttar-pradesh", lat: 26.7804, lng: 82.1392, population: 200000, tier: 3, aliases: ["ayodhya"], isMetro: false },
  { name: "Bulandshahr", slug: "bulandshahr", stateSlug: "uttar-pradesh", lat: 28.4069, lng: 77.8498, population: 250000, tier: 3, aliases: [], isMetro: false },
  { name: "Saharanpur", slug: "saharanpur", stateSlug: "uttar-pradesh", lat: 29.9672, lng: 77.549, population: 350000, tier: 3, aliases: [], isMetro: false },
  { name: "Muzaffarnagar", slug: "muzaffarnagar", stateSlug: "uttar-pradesh", lat: 29.4725, lng: 77.7083, population: 350000, tier: 3, aliases: [], isMetro: false },
  { name: "Unnao", slug: "unnao", stateSlug: "uttar-pradesh", lat: 26.5467, lng: 80.6282, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Farrukhabad", slug: "farrukhabad", stateSlug: "uttar-pradesh", lat: 27.4006, lng: 79.5739, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Rae Bareli", slug: "rae-bareli", stateSlug: "uttar-pradesh", lat: 26.2317, lng: 81.2442, population: 200000, tier: 3, aliases: [], isMetro: false },

  // Additional Karnataka
  { name: "Udupi", slug: "udupi", stateSlug: "karnataka", lat: 13.3409, lng: 74.7421, population: 165000, tier: 3, aliases: [], isMetro: false },
  { name: "Hassan", slug: "hassan", stateSlug: "karnataka", lat: 12.9969, lng: 76.1002, population: 170000, tier: 3, aliases: [], isMetro: false },
  { name: "Chitradurga", slug: "chitradurga", stateSlug: "karnataka", lat: 14.2255, lng: 76.3956, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Raichur", slug: "raichur", stateSlug: "karnataka", lat: 16.2018, lng: 77.3458, population: 150000, tier: 3, aliases: [], isMetro: false },

  // Additional Tamil Nadu
  { name: "Hosur", slug: "hosur", stateSlug: "tamil-nadu", lat: 12.7412, lng: 77.8292, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Nagercoil", slug: "nagercoil", stateSlug: "tamil-nadu", lat: 8.1747, lng: 77.4339, population: 250000, tier: 3, aliases: [], isMetro: false },
  { name: "Kanchipuram", slug: "kanchipuram", stateSlug: "tamil-nadu", lat: 12.8342, lng: 79.7036, population: 220000, tier: 3, aliases: [], isMetro: false },
  { name: "Rajapalayam", slug: "rajapalayam", stateSlug: "tamil-nadu", lat: 9.4542, lng: 77.5624, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Sivakasi", slug: "sivakasi", stateSlug: "tamil-nadu", lat: 9.4605, lng: 77.802, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Villupuram", slug: "villupuram", stateSlug: "tamil-nadu", lat: 11.9401, lng: 79.4861, population: 130000, tier: 3, aliases: [], isMetro: false },
  { name: "Tiruppur", slug: "tiruppur", stateSlug: "tamil-nadu", lat: 11.1085, lng: 77.3411, population: 470000, tier: 2, aliases: [], isMetro: false },
  { name: "Pollachi", slug: "pollachi", stateSlug: "tamil-nadu", lat: 10.6571, lng: 77.0026, population: 120000, tier: 3, aliases: [], isMetro: false },

  // Additional Kerala
  { name: "Thrissur", slug: "thrissur-kerala", stateSlug: "kerala", lat: 10.5273, lng: 76.2144, population: 346000, tier: 2, aliases: [], isMetro: false },
  { name: "Cherthala", slug: "cherthala", stateSlug: "kerala", lat: 9.6436, lng: 76.339, population: 80000, tier: 4, aliases: [], isMetro: false },
  { name: "Chengannur", slug: "chengannur", stateSlug: "kerala", lat: 9.3188, lng: 76.6199, population: 70000, tier: 4, aliases: [], isMetro: false },
  { name: "Kayamkulam", slug: "kayamkulam", stateSlug: "kerala", lat: 9.1822, lng: 76.4973, population: 80000, tier: 4, aliases: [], isMetro: false },

  // Additional West Bengal
  { name: "Kharagpur", slug: "kharagpur", stateSlug: "west-bengal", lat: 22.3304, lng: 87.3238, population: 350000, tier: 3, aliases: [], isMetro: false },
  { name: "Midnapore", slug: "midnapore", stateSlug: "west-bengal", lat: 22.4197, lng: 87.2497, population: 200000, tier: 3, aliases: ["medinipur"], isMetro: false },
  { name: "Hooghly", slug: "hooghly", stateSlug: "west-bengal", lat: 22.9015, lng: 88.3939, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Krishnanagar", slug: "krishnanagar", stateSlug: "west-bengal", lat: 23.4025, lng: 88.492, population: 150000, tier: 3, aliases: [], isMetro: false },

  // Additional Madhya Pradesh
  { name: "Rewa", slug: "rewa", stateSlug: "madhya-pradesh", lat: 24.5309, lng: 81.2989, population: 250000, tier: 3, aliases: [], isMetro: false },
  { name: "Singrauli", slug: "singrauli", stateSlug: "madhya-pradesh", lat: 23.8425, lng: 81.8731, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Shivpuri", slug: "shivpuri", stateSlug: "madhya-pradesh", lat: 25.4179, lng: 77.7266, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Vidisha", slug: "vidisha", stateSlug: "madhya-pradesh", lat: 23.5245, lng: 77.8084, population: 150000, tier: 3, aliases: [], isMetro: false },

  // Additional Bihar
  { name: "Katihar", slug: "katihar", stateSlug: "bihar", lat: 25.5305, lng: 87.5785, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Munger", slug: "munger", stateSlug: "bihar", lat: 25.3731, lng: 86.4725, population: 150000, tier: 3, aliases: ["monghyr"], isMetro: false },
  { name: "Chapra", slug: "chapra", stateSlug: "bihar", lat: 25.7836, lng: 84.7446, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Sasaram", slug: "sasaram", stateSlug: "bihar", lat: 24.9159, lng: 84.0297, population: 170000, tier: 3, aliases: [], isMetro: false },
  { name: "Begusarai", slug: "begusarai", stateSlug: "bihar", lat: 25.4177, lng: 86.1248, population: 200000, tier: 3, aliases: [], isMetro: false },

  // Additional Punjab
  { name: "Firozpur", slug: "firozpur", stateSlug: "punjab", lat: 30.916, lng: 74.268, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Kapurthala", slug: "kapurthala", stateSlug: "punjab", lat: 31.3867, lng: 75.3832, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Sangrur", slug: "sangrur", stateSlug: "punjab", lat: 30.2488, lng: 75.8423, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Fazilka", slug: "fazilka", stateSlug: "punjab", lat: 30.3971, lng: 74.018, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Muktsar", slug: "muktsar", stateSlug: "punjab", lat: 30.4724, lng: 74.5153, population: 80000, tier: 4, aliases: [], isMetro: false },
  { name: "Barnala", slug: "barnala", stateSlug: "punjab", lat: 30.3762, lng: 75.5373, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Gurdaspur", slug: "gurdaspur", stateSlug: "punjab", lat: 32.0261, lng: 75.404, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Hoshiarpur", slug: "hoshiarpur", stateSlug: "punjab", lat: 31.5304, lng: 75.8557, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Nawanshahr", slug: "nawanshahr", stateSlug: "punjab", lat: 31.124, lng: 76.0857, population: 80000, tier: 4, aliases: [], isMetro: false },
  { name: "Rupnagar", slug: "rupnagar", stateSlug: "punjab", lat: 31.1265, lng: 76.5322, population: 80000, tier: 4, aliases: ["ropar"], isMetro: false },
  { name: "Tarn Taran", slug: "tarn-taran", stateSlug: "punjab", lat: 31.4522, lng: 74.9266, population: 80000, tier: 4, aliases: [], isMetro: false },

  // Additional Haryana
  { name: "Sirsa", slug: "sirsa", stateSlug: "haryana", lat: 29.5357, lng: 75.0306, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Kaithal", slug: "kaithal", stateSlug: "haryana", lat: 29.8012, lng: 76.3829, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Yamunanagar", slug: "yamunanagar", stateSlug: "haryana", lat: 30.1352, lng: 77.2774, population: 250000, tier: 3, aliases: [], isMetro: false },
  { name: "Kurukshetra", slug: "kurukshetra", stateSlug: "haryana", lat: 29.9695, lng: 76.8783, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Panchkula", slug: "panchkula", stateSlug: "haryana", lat: 30.6933, lng: 76.8577, population: 250000, tier: 2, aliases: [], isMetro: false },

  // Additional Andhra Pradesh
  { name: "Nandyal", slug: "nandyal", stateSlug: "andhra-pradesh", lat: 15.484, lng: 78.4846, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Adoni", slug: "adoni", stateSlug: "andhra-pradesh", lat: 15.6307, lng: 77.2804, population: 180000, tier: 3, aliases: [], isMetro: false },
  { name: "Proddatur", slug: "proddatur", stateSlug: "andhra-pradesh", lat: 16.3472, lng: 78.5283, population: 200000, tier: 3, aliases: [], isMetro: false },

  // Additional Telangana
  { name: "Nalgonda", slug: "nalgonda", stateSlug: "telangana", lat: 17.0513, lng: 79.2686, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Mahbubnagar", slug: "mahbubnagar", stateSlug: "telangana", lat: 16.7394, lng: 77.9827, population: 180000, tier: 3, aliases: [], isMetro: false },
  { name: "Adilabad", slug: "adilabad", stateSlug: "telangana", lat: 19.6685, lng: 78.5069, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Siddipet", slug: "siddipet", stateSlug: "telangana", lat: 18.1053, lng: 78.8517, population: 130000, tier: 3, aliases: [], isMetro: false },
  { name: "Miryalaguda", slug: "miryalaguda", stateSlug: "telangana", lat: 16.8685, lng: 79.1927, population: 120000, tier: 3, aliases: [], isMetro: false },

  // Additional Chhattisgarh
  { name: "Jagdalpur", slug: "jagdalpur", stateSlug: "chhattisgarh", lat: 19.0869, lng: 82.0208, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Ambikapur", slug: "ambikapur", stateSlug: "chhattisgarh", lat: 23.1207, lng: 83.1987, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Rajnandgaon", slug: "rajnandgaon", stateSlug: "chhattisgarh", lat: 21.1056, lng: 81.0311, population: 170000, tier: 3, aliases: [], isMetro: false },

  // Additional Odisha
  { name: "Angul", slug: "angul", stateSlug: "odisha", lat: 20.8536, lng: 85.1004, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Balasore", slug: "balasore", stateSlug: "odisha", lat: 21.4928, lng: 86.9312, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Baripada", slug: "baripada", stateSlug: "odisha", lat: 21.9401, lng: 86.722, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Jharsuguda", slug: "jharsuguda", stateSlug: "odisha", lat: 21.8653, lng: 84.0372, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Jeypore", slug: "jeypore", stateSlug: "odisha", lat: 19.0746, lng: 82.5719, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Phulbani", slug: "phulbani", stateSlug: "odisha", lat: 20.4697, lng: 84.2323, population: 50000, tier: 4, aliases: [], isMetro: false },

  // More UP
  { name: "Basti", slug: "basti", stateSlug: "uttar-pradesh", lat: 26.8128, lng: 82.7603, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Lakhimpur Kheri", slug: "lakhimpur-kheri", stateSlug: "uttar-pradesh", lat: 27.9449, lng: 80.7756, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Bahraich", slug: "bahraich", stateSlug: "uttar-pradesh", lat: 27.5719, lng: 81.5955, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Balrampur", slug: "balrampur", stateSlug: "uttar-pradesh", lat: 27.4307, lng: 82.1853, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Gonda", slug: "gonda", stateSlug: "uttar-pradesh", lat: 27.1297, lng: 81.9074, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Sitapur", slug: "sitapur", stateSlug: "uttar-pradesh", lat: 27.5709, lng: 80.6783, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Lalitpur", slug: "lalitpur", stateSlug: "uttar-pradesh", lat: 24.6887, lng: 78.4118, population: 130000, tier: 3, aliases: [], isMetro: false },
  { name: "Azamgarh", slug: "azamgarh", stateSlug: "uttar-pradesh", lat: 26.0615, lng: 83.1845, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Jaunpur", slug: "jaunpur", stateSlug: "uttar-pradesh", lat: 25.7452, lng: 82.6872, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Ghazipur", slug: "ghazipur", stateSlug: "uttar-pradesh", lat: 25.585, lng: 83.5784, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Ballia", slug: "ballia", stateSlug: "uttar-pradesh", lat: 25.7616, lng: 84.1082, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Mau", slug: "mau", stateSlug: "uttar-pradesh", lat: 25.9413, lng: 83.5616, population: 150000, tier: 3, aliases: [], isMetro: false },
  { name: "Sant Kabir Nagar", slug: "sant-kabir-nagar", stateSlug: "uttar-pradesh", lat: 26.7894, lng: 83.0716, population: 100000, tier: 3, aliases: ["khalilabad"], isMetro: false },

  // Additional Maharashtra
  { name: "Malegaon", slug: "malegaon", stateSlug: "maharashtra", lat: 20.5548, lng: 74.5391, population: 200000, tier: 3, aliases: [], isMetro: false },
  { name: "Bhusawal", slug: "bhusawal", stateSlug: "maharashtra", lat: 21.0437, lng: 75.7959, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Osmanabad", slug: "osmanabad", stateSlug: "maharashtra", lat: 18.1814, lng: 76.0351, population: 150000, tier: 3, aliases: ["dharashiv"], isMetro: false },
  { name: "Nandurbar", slug: "nandurbar", stateSlug: "maharashtra", lat: 21.3671, lng: 74.2501, population: 120000, tier: 3, aliases: [], isMetro: false },
  { name: "Washim", slug: "washim", stateSlug: "maharashtra", lat: 20.1101, lng: 77.1299, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Hingoli", slug: "hingoli", stateSlug: "maharashtra", lat: 19.7188, lng: 77.1507, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Gondia", slug: "gondia", stateSlug: "maharashtra", lat: 20.8208, lng: 80.2048, population: 100000, tier: 3, aliases: [], isMetro: false },
  { name: "Gadchiroli", slug: "gadchiroli", stateSlug: "maharashtra", lat: 20.1667, lng: 80.0, population: 60000, tier: 4, aliases: [], isMetro: false },
  { name: "Chandrapur", slug: "chandrapur-mah", stateSlug: "maharashtra", lat: 19.9615, lng: 79.2961, population: 375000, tier: 3, aliases: ["chanda"], isMetro: false },
  { name: "Wardha", slug: "wardha-mah", stateSlug: "maharashtra", lat: 20.7396, lng: 78.6021, population: 130000, tier: 3, aliases: [], isMetro: false },
  { name: "Amravati", slug: "amravati-mah", stateSlug: "maharashtra", lat: 20.932, lng: 77.7523, population: 650000, tier: 2, aliases: [], isMetro: false },
  { name: "Akola", slug: "akola-mah", stateSlug: "maharashtra", lat: 20.7006, lng: 77.0051, population: 427000, tier: 3, aliases: [], isMetro: false },
  { name: "Yavatmal", slug: "yavatmal", stateSlug: "maharashtra", lat: 20.3917, lng: 78.1278, population: 150000, tier: 3, aliases: [], isMetro: false },
];

// ==========================================
// Helper Functions
// ==========================================

const cityMap = new Map(indiaCities.map((c) => [c.slug, c]));
const stateCitiesMap = new Map<string, IndiaCity[]>();
for (const city of indiaCities) {
  const existing = stateCitiesMap.get(city.stateSlug) || [];
  existing.push(city);
  stateCitiesMap.set(city.stateSlug, existing);
}

export function getCityBySlug(slug: string): IndiaCity | undefined {
  return cityMap.get(slug);
}

export function getCitiesByState(stateSlug: string): IndiaCity[] {
  return stateCitiesMap.get(stateSlug) || [];
}

export function getStateBySlug(slug: string): IndiaState | undefined {
  return indiaStates.find((s) => s.slug === slug);
}

// Get cities in the same state (simplified "nearby")
export function getNearbyCities(citySlug: string, limit = 10): IndiaCity[] {
  const city = getCityBySlug(citySlug);
  if (!city) return [];
  const stateCities = getCitiesByState(city.stateSlug)
    .filter((c) => c.slug !== citySlug)
    .sort((a, b) => b.population - a.population);
  return stateCities.slice(0, limit);
}

// Get related cities (same state + top cities from neighboring states)
export function getRelatedCities(citySlug: string, limit = 15): IndiaCity[] {
  const city = getCityBySlug(citySlug);
  if (!city) return [];
  const sameState = getCitiesByState(city.stateSlug)
    .filter((c) => c.slug !== citySlug)
    .sort((a, b) => b.population - a.population);
  
  // Get metro cities from other states for variety
  const otherMetros = indiaCities
    .filter((c) => c.stateSlug !== city.stateSlug && (c.tier === 1 || c.isMetro))
    .sort((a, b) => b.population - a.population)
    .slice(0, 5);

  return [...sameState.slice(0, 10), ...otherMetros].slice(0, limit);
}

export function getMetroCities(): IndiaCity[] {
  return indiaCities.filter((c) => c.isMetro).sort((a, b) => b.population - a.population);
}

export function getAllCitySlugs(): string[] {
  return indiaCities.map((c) => c.slug);
}

export function getAllStateSlugs(): string[] {
  return indiaStates.map((s) => s.slug);
}

// Resolve a slug to either a city, state, or null
export function resolveIndiaSlug(slug: string): { type: "city" | "state"; data: IndiaCity | IndiaState } | null {
  const city = getCityBySlug(slug);
  if (city) return { type: "city", data: city };
  
  // Check city aliases
  const aliasMatch = indiaCities.find((c) => c.aliases.includes(slug.toLowerCase()));
  if (aliasMatch) return { type: "city", data: aliasMatch };
  
  const state = getStateBySlug(slug);
  if (state) return { type: "state", data: state };
  
  return null;
}

// Popular category+city search combinations
export function getPopularSearches(): Array<{ category: string; city: string; citySlug: string; categorySlug: string }> {
  const categories = ["escorts", "massage", "dating", "trans", "male-escorts"];
  const metroSlugs = ["mumbai", "delhi", "bangalore", "hyderabad", "chennai", "kolkata", "pune", "ahmedabad", "jaipur", "lucknow", "kochi", "goa", "chandigarh", "nagpur"];
  
  const searches: Array<{ category: string; city: string; citySlug: string; categorySlug: string }> = [];
  for (const category of categories) {
    for (const citySlug of metroSlugs) {
      const city = getCityBySlug(citySlug);
      if (city) {
        searches.push({
          category: category === "male-escorts" ? "Male Escorts" : category.charAt(0).toUpperCase() + category.slice(1),
          city: city.name,
          citySlug: city.slug,
          categorySlug: category,
        });
      }
    }
  }
  return searches;
}

// Total counts
export const TOTAL_STATES = indiaStates.length;
export const TOTAL_CITIES = indiaCities.length;
export const TOTAL_METROS = indiaCities.filter((c) => c.isMetro).length;

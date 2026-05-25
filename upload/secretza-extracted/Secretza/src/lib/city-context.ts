/**
 * City Context Module
 *
 * Provides rich, location-specific data for 8 major Indian cities.
 * Used by seo-content.ts for generating contextual SEO content with
 * authentic neighborhood names, nightlife areas, tourism spots, etc.
 */

// ---------------------------------------------------------------------------
// City data (as const for full type safety)
// ---------------------------------------------------------------------------

interface CityData {
  slug: string;
  description: string;
  nightlife: readonly string[];
  tourism: readonly string[];
  business: readonly string[];
  neighborhoods: readonly string[];
  foodAreas: readonly string[];
  sellingPoints: readonly string[];
}

const CITY_DATA = {
  mumbai: {
    slug: "mumbai",
    description:
      "Mumbai, India's financial capital and the heart of Bollywood, is a city of dreams that pulses with relentless energy. From the iconic Marine Drive promenade and the historic Gateway of India to the bustling lanes of Colaba and the glamorous nightlife of Bandra, Mumbai offers an unmatched urban experience. As India's largest metropolitan economy, it draws millions of professionals, artists, and entrepreneurs every year. The city's 24/7 culture means there is always something happening — whether it's a late-night food trail on Mohammed Ali Road, a film shoot at Goregaon Film City, or a sunset at Juhu Beach. Mumbai's diverse neighborhoods, from the upscale Bandra Kurla Complex to the heritage corridors of South Mumbai, create a tapestry of experiences unlike any other Indian city.",
    nightlife: [
      "Colaba",
      "Bandra",
      "Andheri",
      "Lower Parel",
      "Juhu",
    ] as const,
    tourism: [
      "Gateway of India",
      "Marine Drive",
      "Siddhivinayak Temple",
      "Elephanta Caves",
      "Film City",
    ] as const,
    business: [
      "BKC (Bandra Kurla Complex)",
      "Nariman Point",
      "Powai",
      "Worli",
      "Andheri East",
    ] as const,
    neighborhoods: [
      "Colaba",
      "Bandra West",
      "Juhu",
      "Andheri",
      "Powai",
      "Lower Parel",
      "Malad",
      "Goregaon",
      "Vile Parle",
      "Dadar",
    ] as const,
    foodAreas: [
      "Mohammed Ali Road",
      "Juhu Beach food stalls",
      "Bandra cafes",
      "Colaba restaurants",
      "Versova",
    ] as const,
    sellingPoints: [
      "India's financial capital",
      "24/7 city that never sleeps",
      "largest adult services market",
    ] as const,
  },

  delhi: {
    slug: "delhi",
    description:
      "Delhi, the national capital territory of India, is a city where centuries of Mughal heritage meet modern urban ambition. From the majestic Red Fort and Qutub Minar to the colonial grandeur of Connaught Place and the India Gate war memorial, Delhi is a living museum of Indian history. The city serves as the political nerve center of the world's largest democracy, housing Parliament, the Supreme Court, and countless diplomatic missions. Beyond its monuments, Delhi is known for its vibrant street food culture in Chandni Chowk, its upscale shopping districts in Greater Kailash, and its trendy nightlife in Hauz Khas Village. The broader National Capital Region (NCR) spanning Gurgaon and Noida forms one of India's largest economic zones, attracting professionals from across the country.",
    nightlife: [
      "Connaught Place",
      "Hauz Khas Village",
      "GK-1",
      "Vasant Kunj",
      "Nehru Place",
    ] as const,
    tourism: [
      "India Gate",
      "Red Fort",
      "Qutub Minar",
      "Lotus Temple",
      "Humayun's Tomb",
    ] as const,
    business: [
      "Connaught Place",
      "Nehru Place",
      "Gurgaon (nearby)",
      "Noida (nearby)",
      "Saket",
    ] as const,
    neighborhoods: [
      "Connaught Place",
      "Hauz Khas",
      "Greater Kailash",
      "Defence Colony",
      "Karol Bagh",
      "Lajpat Nagar",
      "Dwarka",
      "Rohini",
      "Pitampura",
      "Chanakyapuri",
    ] as const,
    foodAreas: [
      "Chandni Chowk",
      "Khan Market",
      "Hauz Khas cafes",
      "Pandara Road",
      "Connaught Place",
    ] as const,
    sellingPoints: [
      "National capital region",
      "political and cultural hub",
      "NCR market spanning Delhi-NCR",
    ] as const,
  },

  bangalore: {
    slug: "bangalore",
    description:
      "Bangalore, widely known as India's Silicon Valley, is the country's premier technology hub and a melting pot of cultures from across India and the world. Home to the headquarters of global tech giants and thousands of startups, the city attracts the highest concentration of young professionals and engineers in India. Bangalore's famed pub culture, centered around Indiranagar's 100 Feet Road and Koramangala's bustling 4th Block, gives it a cosmopolitan energy unlike any other Indian city. Despite its modern skyline and tech parks in Electronic City and Whitefield, Bangalore retains its 'Garden City' charm with tree-lined avenues, the sprawling Lalbagh Botanical Garden, and the serene Cubbon Park. The city's year-round pleasant weather, thriving café scene, and cosmopolitan crowd make it one of India's most livable metro areas.",
    nightlife: [
      "Indiranagar",
      "Koramangala",
      "MG Road",
      "Church Street",
      "HSR Layout",
    ] as const,
    tourism: [
      "Bangalore Palace",
      "Lalbagh Botanical Garden",
      "Cubbon Park",
      "Vidhana Soudha",
      "Bull Temple",
    ] as const,
    business: [
      "Electronic City",
      "Whitefield",
      "Manyata Tech Park",
      "Outer Ring Road",
      "MG Road",
    ] as const,
    neighborhoods: [
      "Indiranagar",
      "Koramangala",
      "HSR Layout",
      "JP Nagar",
      "Jayanagar",
      "Whitefield",
      "Electronic City",
      "Marathahalli",
      "BTM Layout",
      "Bannerghatta Road",
    ] as const,
    foodAreas: [
      "Vidyarthi Bhavan",
      "Indiranagar 100ft Road",
      "Koramangala 4th Block",
      "Church Street",
      "HSR Layout",
    ] as const,
    sellingPoints: [
      "India's tech capital",
      "cosmopolitan crowd",
      "highest concentration of young professionals",
    ] as const,
  },

  goa: {
    slug: "goa",
    description:
      "Goa, India's smallest state by area, is the country's undisputed beach paradise and premier holiday destination. With its unique blend of Portuguese colonial heritage, palm-fringed golden beaches, and world-famous nightlife, Goa attracts millions of domestic and international tourists year-round. From the electric atmosphere of Tito's Lane in Baga and the bohemian vibe of Anjuna's flea markets to the serene beauty of Palolem's crescent beach and the architectural splendor of Old Goa's churches, the state offers an extraordinary range of experiences. Goa's tropical climate, laid-back lifestyle, and diverse culinary scene — featuring both Konkani seafood and Portuguese-influenced cuisine — create an intoxicating environment. Beyond tourism, cities like Panaji and Margao serve as growing commercial hubs, making Goa not just a holiday spot but an emerging lifestyle destination.",
    nightlife: [
      "Tito's Lane (Baga)",
      "Candolim",
      "Anjuna",
      "Vagator",
      "Palolem",
    ] as const,
    tourism: [
      "Baga Beach",
      "Old Goa churches",
      "Dudhsagar Falls",
      "Fort Aguada",
      "Spice Plantations",
    ] as const,
    business: [
      "Panaji",
      "Margao",
      "Mapusa",
      "Porvorim",
      "Dona Paula",
    ] as const,
    neighborhoods: [
      "Panaji",
      "Calangute",
      "Baga",
      "Candolim",
      "Anjuna",
      "Vagator",
      "Palolem",
      "Margao",
      "Vasco",
      "Mapusa",
    ] as const,
    foodAreas: [
      "Panaji Latin Quarter",
      "Baga Beach shacks",
      "Candolim restaurants",
      "Mapusa market",
      "Anjuna flea market",
    ] as const,
    sellingPoints: [
      "India's premier holiday destination",
      "beach nightlife",
      "tourist influx year-round",
    ] as const,
  },

  hyderabad: {
    slug: "hyderabad",
    description:
      "Hyderabad, the City of Pearls, is one of India's fastest-growing metropolises, seamlessly blending centuries of Nizami heritage with cutting-edge technology. The city is renowned globally as the biryani capital of India, with iconic establishments like Paradise serving the legendary Hyderabadi dum biryani that draws food lovers from every corner of the country. Hyderabad's tech corridor, anchored by HITEC City, Gachibowli, and the Financial District, rivals Bangalore as a major IT destination, housing offices of Google, Amazon, Microsoft, and hundreds of startups. The historic Charminar, the majestic Golconda Fort, and the sprawling Ramoji Film City showcase the city's cultural and cinematic legacy. With its growing cosmopolitan population, affordable real estate compared to other metros, and a booming services economy, Hyderabad is rapidly emerging as one of India's most dynamic urban centers.",
    nightlife: [
      "Banjara Hills",
      "Jubilee Hills",
      "Madhapur",
      "Gachibowli",
      "Hi-Tech City",
    ] as const,
    tourism: [
      "Charminar",
      "Golconda Fort",
      "Hussain Sagar Lake",
      "Ramoji Film City",
      "Chowmahalla Palace",
    ] as const,
    business: [
      "HITEC City",
      "Gachibowli",
      "Financial District",
      "Madhapur",
      "Banjara Hills",
    ] as const,
    neighborhoods: [
      "Banjara Hills",
      "Jubilee Hills",
      "Madhapur",
      "Gachibowli",
      "Kukatpally",
      "Ameerpet",
      "Begumpet",
      "Somajiguda",
      "Tolichowki",
      "Kondapur",
    ] as const,
    foodAreas: [
      "Paradise biryani",
      "Tank Bund",
      "Madhapur cafes",
      "Banjara Hills restaurants",
      "Charminar area",
    ] as const,
    sellingPoints: [
      "Fast-growing IT city",
      "biryani and cultural heritage",
      "growing services market",
    ] as const,
  },

  chennai: {
    slug: "chennai",
    description:
      "Chennai, the cultural capital of South India, is a city where ancient traditions coexist with a rapidly modernizing economy. Home to the iconic Marina Beach — one of the longest urban beaches in the world — and magnificent Dravidian temples like Kapaleeshwarar, Chennai offers a deep connection to India's artistic and spiritual heritage. The city's thriving IT corridor along Old Mahabalipuram Road (OMR) and the Tidel Park complex has made it one of India's top technology export hubs, attracting major global corporations and a growing young professional workforce. Chennai's food culture is legendary, from the bustling vegetarian eateries of Sowcarpet to the seafood restaurants along East Coast Road. Known for its conservative yet culturally rich society, Chennai also has a premium market with discerning clientele who value quality and authenticity. The city's proximity to heritage sites like Mahabalipuram and Pondicherry adds to its appeal as both a business and cultural destination.",
    nightlife: [
      "Anna Nagar",
      "Nungambakkam",
      "ECR (East Coast Road)",
      "T Nagar",
      "Velachery",
    ] as const,
    tourism: [
      "Marina Beach",
      "Kapaleeshwarar Temple",
      "Fort St George",
      "Mahabalipuram",
      "Vivekananda Rock",
    ] as const,
    business: [
      "Tidel Park",
      "OMR (Old Mahabalipuram Road)",
      "Guindy",
      "Anna Nagar",
      "Adyar",
    ] as const,
    neighborhoods: [
      "Anna Nagar",
      "Nungambakkam",
      "T Nagar",
      "Adyar",
      "Velachery",
      "ECR",
      "OMR",
      "Purasawalkam",
      "Mylapore",
      "Kodambakkam",
    ] as const,
    foodAreas: [
      "Sowcarpet",
      "T Nagar",
      "Anna Nagar",
      "Marina Beach food",
      "ECR beach restaurants",
    ] as const,
    sellingPoints: [
      "Cultural heritage",
      "growing IT corridor (OMR)",
      "conservative market with premium demand",
    ] as const,
  },

  pune: {
    slug: "pune",
    description:
      "Pune, often called the Oxford of the East, is a vibrant city that combines a rich educational heritage with a booming technology sector. Home to prestigious institutions like the University of Pune and the Film and Television Institute of India, the city has long been an intellectual and cultural hub of Maharashtra. In recent years, Pune has emerged as one of India's most important IT destinations, with major tech parks in Hinjewadi, Kharadi, and Magarpatta City attracting global corporations and a massive influx of young professionals. The city's proximity to Mumbai — just a three-hour drive away — makes it both a complementary business center and a preferred residential alternative. Pune's nightlife thrives in Koregaon Park's trendy Lane 7 and the bustling FC Road, while its food scene ranges from authentic Maharashtrian thalis to international cuisines in Aundh and Baner. With its pleasant weather, educated population, and growing urban infrastructure, Pune represents the best of both traditional Maharashtrian culture and modern Indian aspiration.",
    nightlife: [
      "Koregaon Park",
      "Viman Nagar",
      "Hinjewadi",
      "FC Road",
      "MG Road",
    ] as const,
    tourism: [
      "Aga Khan Palace",
      "Shaniwar Wada",
      "Sinhagad Fort",
      "Osho Ashram",
      "Pataleshwar Caves",
    ] as const,
    business: [
      "Hinjewadi IT Park",
      "Kharadi",
      "Magarpatta City",
      "Koregaon Park",
      "Baner",
    ] as const,
    neighborhoods: [
      "Koregaon Park",
      "Viman Nagar",
      "Hinjewadi",
      "Baner",
      "Aundh",
      "Kothrud",
      "FC Road",
      "Wakad",
      "Hadapsar",
      "Pashan",
    ] as const,
    foodAreas: [
      "Koregaon Park Lane 7",
      "FC Road",
      "Viman Nagar",
      "Aundh",
      "Hinjewadi",
    ] as const,
    sellingPoints: [
      "Education hub with young crowd",
      "proximity to Mumbai",
      "growing IT sector",
    ] as const,
  },

  kolkata: {
    slug: "kolkata",
    description:
      "Kolkata, the City of Joy, is India's cultural capital and a city of extraordinary artistic heritage. From the grand colonial architecture of Victoria Memorial and the iconic Howrah Bridge spanning the Hooghly River to the literary cafes of College Street and the vibrant art galleries of Park Street, Kolkata breathes creativity and intellectualism. The city is the birthplace of modern Indian literature, theater, cinema, and political thought, and its residents — known for their warmth, wit, and passion for debate — embody a spirit that is uniquely Bengali. Kolkata's culinary scene is legendary, spanning from Park Street's historic restaurants to the Tangra Chinatown and the aromatic street food of New Market. As an emerging commercial center with IT parks in Salt Lake's Sector V, Kolkata is attracting a new generation of professionals while retaining its deep cultural roots. The city's growing market features discerning clientele who value artistry, intellect, and sophistication.",
    nightlife: [
      "Park Street",
      "New Market",
      "Camac Street",
      "Salt Lake",
      "Sector V",
    ] as const,
    tourism: [
      "Victoria Memorial",
      "Howrah Bridge",
      "Dakshineswar Temple",
      "Park Street",
      "Indian Museum",
    ] as const,
    business: [
      "Park Street",
      "Salt Lake Sector V",
      "Camac Street",
      "Chowringhee",
      "New Alipore",
    ] as const,
    neighborhoods: [
      "Park Street",
      "Salt Lake",
      "Lake Town",
      "Gariahat",
      "New Alipore",
      "Behala",
      "Jadavpur",
      "Dum Dum",
      "Shyambazar",
      "Camac Street",
    ] as const,
    foodAreas: [
      "Park Street restaurants",
      "China Town (Tangra)",
      "College Street",
      "New Market",
      "Gariahat",
    ] as const,
    sellingPoints: [
      "Cultural richness",
      "artistic heritage",
      "growing market with discerning clientele",
    ] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Type helper
// ---------------------------------------------------------------------------

type CitySlug = keyof typeof CITY_DATA;

function isKnownCity(slug: string): slug is CitySlug {
  return slug in CITY_DATA;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Returns a rich, multi-sentence description of a city for SEO content.
 * Returns empty string for unknown cities.
 */
export function getCityDescription(slug: string): string {
  if (!isKnownCity(slug)) return "";
  return CITY_DATA[slug].description;
}

/**
 * Returns the top nightlife areas / party districts for a city.
 * Returns empty array for unknown cities.
 */
export function getCityNightlife(slug: string): string[] {
  if (!isKnownCity(slug)) return [];
  return [...CITY_DATA[slug].nightlife];
}

/**
 * Returns the top tourism landmarks and sightseeing spots.
 * Returns empty array for unknown cities.
 */
export function getCityTourism(slug: string): string[] {
  if (!isKnownCity(slug)) return [];
  return [...CITY_DATA[slug].tourism];
}

/**
 * Returns the major business districts and commercial hubs.
 * Returns empty array for unknown cities.
 */
export function getCityBusiness(slug: string): string[] {
  if (!isKnownCity(slug)) return [];
  return [...CITY_DATA[slug].business];
}

/**
 * Returns popular neighborhoods and localities within the city.
 * Returns empty array for unknown cities.
 */
export function getCityNeighborhoods(slug: string): string[] {
  if (!isKnownCity(slug)) return [];
  return [...CITY_DATA[slug].neighborhoods];
}

/**
 * Returns famous food areas, restaurant clusters, and street-food hubs.
 * Returns empty array for unknown cities.
 */
export function getCityFoodAreas(slug: string): string[] {
  if (!isKnownCity(slug)) return [];
  return [...CITY_DATA[slug].foodAreas];
}

/**
 * Returns unique selling points / differentiators for a city.
 * Returns empty array for unknown cities.
 */
export function getCityUniqueSellingPoints(slug: string): string[] {
  if (!isKnownCity(slug)) return [];
  return [...CITY_DATA[slug].sellingPoints];
}

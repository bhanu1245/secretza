/**
 * SEO V6 — Local Intelligence Database
 * Structured, city-specific facts for genuinely local content generation.
 */
import { getCityBySlug, getNearbyCities } from "@/lib/india-geo-data";

export type LocalIntelligence = {
  city: string;
  slug: string;
  stateName: string;
  stateSlug: string;
  description: string;
  luxuryAreas: string[];
  premiumResidentialAreas?: string[];
  hotels: string[];
  businessHotels?: string[];
  resorts?: string[];
  railwayStations: string[];
  busStands: string[];
  airports: string[];
  shoppingMalls: string[];
  itParks: string[];
  touristAttractions: string[];
  landmarks: string[];
  colleges: string[];
  hospitals: string[];
  markets: string[];
  festivals: string[];
  beachesLakesParks: string[];
  nightlife: string[];
  businessDistricts: string[];
  culture: string[];
  economy: string[];
  industrialZones?: string[];
  governmentOffices?: string[];
  famousRoads?: string[];
  historicMonuments?: string[];
  foodStreets?: string[];
  nearbyCities: Array<{ name: string; slug: string }>;
  /** DB-sourced area names merged in */
  dbAreas: string[];
  /** curated | city_context | geo_generated */
  source: "curated" | "city_context" | "geo_generated";
};

type CuratedIntel = Omit<LocalIntelligence, "slug" | "stateName" | "stateSlug" | "dbAreas" | "nearbyCities" | "source">;

const CURATED_INTEL: Record<string, CuratedIntel> = {
  mumbai: {
    city: "Mumbai",
    description:
      "Mumbai, India's financial capital and the heart of Bollywood, pulses with relentless energy from Marine Drive to Bandra's nightlife corridors. As the nation's largest metropolitan economy, it draws millions of professionals, artists, and entrepreneurs every year.",
    luxuryAreas: ["Bandra West", "Juhu", "Worli", "Lower Parel", "Powai", "Malabar Hill", "BKC", "Colaba"],
    hotels: [
      "The Taj Mahal Palace",
      "The Oberoi Mumbai",
      "Trident Nariman Point",
      "JW Marriott Juhu",
      "The St. Regis Mumbai",
      "ITC Grand Central",
      "Hilton Mumbai International Airport",
    ],
    railwayStations: [
      "Chhatrapati Shivaji Maharaj Terminus",
      "Mumbai Central",
      "Andheri Railway Station",
      "Bandra Terminus",
      "Lokmanya Tilak Terminus",
    ],
    busStands: ["BEST Depot Mumbai Central", "Bandra Kurla Complex Bus Hub", "Andheri East ISBT"],
    airports: ["Chhatrapati Shivaji Maharaj International Airport"],
    shoppingMalls: ["Phoenix Palladium Lower Parel", "Inorbit Mall Malad", "R City Mall Ghatkopar", "High Street Phoenix"],
    itParks: ["Bandra Kurla Complex", "Powai IT Park", "Mindspace Malad", "NESCO Goregaon"],
    touristAttractions: ["Gateway of India", "Marine Drive", "Elephanta Caves", "Siddhivinayak Temple", "Film City Goregaon"],
    landmarks: ["Gateway of India", "Marine Drive", "Bandra-Worli Sea Link", "Haji Ali Dargah", "Chhatrapati Shivaji Terminus"],
    colleges: ["St. Xavier's College", "NMIMS University", "IIT Bombay Powai", "Mithibai College"],
    hospitals: ["Lilavati Hospital Bandra", "Kokilaben Dhirubhai Ambani Hospital", "Tata Memorial Hospital"],
    markets: ["Crawford Market", "Colaba Causeway", "Linking Road Bandra", "Zaveri Bazaar"],
    festivals: ["Ganesh Chaturthi", "Navratri Garba nights", "Kala Ghoda Arts Festival", "Mumbai Film Festival"],
    beachesLakesParks: ["Juhu Beach", "Versova Beach", "Sanjay Gandhi National Park", "Hanging Gardens Malabar Hill"],
    nightlife: ["Colaba", "Bandra West", "Lower Parel", "Andheri West", "Juhu"],
    businessDistricts: ["BKC", "Nariman Point", "Lower Parel", "Andheri East", "Powai"],
    premiumResidentialAreas: ["Malabar Hill", "Cuffe Parade", "Altamount Road", "Peddar Road"],
    businessHotels: ["Trident Nariman Point", "ITC Grand Central", "The St. Regis Mumbai"],
    resorts: ["JW Marriott Juhu", "Grand Hyatt Mumbai"],
    industrialZones: ["MIDC Andheri", "Taloja industrial belt", "Bhiwandi logistics hub"],
    governmentOffices: ["Mantralaya", "Bandra Kurla Complex government annex", "Civic Centre"],
    famousRoads: ["Marine Drive", "Linking Road", "Hill Road Bandra", "SV Road"],
    historicMonuments: ["Gateway of India", "Chhatrapati Shivaji Terminus", "Elephanta Caves"],
    foodStreets: ["Mohammed Ali Road", "Carter Road", "Girgaum Chowpatty", "Zaveri Bazaar lanes"],
    culture: ["Bollywood film industry", "Marathi theatre", "Irani cafés", "coastal Konkani cuisine"],
    economy: ["financial services", "entertainment", "textile exports", "port logistics", "startup ecosystem"],
  },
  delhi: {
    city: "Delhi",
    description:
      "Delhi, the national capital territory, blends centuries of Mughal heritage with modern urban ambition — from Connaught Place commerce to Hauz Khas nightlife and the diplomatic enclaves of Chanakyapuri.",
    luxuryAreas: ["Greater Kailash", "Defence Colony", "Hauz Khas", "Vasant Kunj", "Chanakyapuri", "Saket", "Dwarka Sector 21"],
    hotels: ["The Imperial New Delhi", "Taj Palace Chanakyapuri", "Leela Palace Chanakyapuri", "Oberoi New Delhi", "Hyatt Regency Bhikaji Cama Place"],
    railwayStations: ["New Delhi Railway Station", "Old Delhi Railway Station", "Hazrat Nizamuddin", "Anand Vihar Terminal"],
    busStands: ["ISBT Kashmere Gate", "ISBT Anand Vihar", "Sarai Kale Khan ISBT"],
    airports: ["Indira Gandhi International Airport"],
    shoppingMalls: ["Select Citywalk Saket", "DLF Promenade Vasant Kunj", "Pacific Mall Tagore Garden", "Ambience Mall Vasant Kunj"],
    itParks: ["Nehru Place", "Connaught Place", "Cyber Hub Gurgaon (NCR)", "Okhla Industrial Area"],
    touristAttractions: ["India Gate", "Red Fort", "Qutub Minar", "Humayun's Tomb", "Lotus Temple"],
    landmarks: ["India Gate", "Red Fort", "Qutub Minar", "Rashtrapati Bhavan", "Connaught Place"],
    colleges: ["Delhi University North Campus", "JNU", "IIT Delhi", "Jamia Millia Islamia"],
    hospitals: ["AIIMS Delhi", "Safdarjung Hospital", "Max Super Speciality Saket", "Apollo Hospital"],
    markets: ["Chandni Chowk", "Khan Market", "Sarojini Nagar", "Karol Bagh"],
    festivals: ["Diwali", "Republic Day Parade", "Phoolwalon ki Sair", "Delhi Book Fair"],
    beachesLakesParks: ["Lodhi Gardens", "Garden of Five Senses", "Yamuna Biodiversity Park", "Deer Park Hauz Khas"],
    nightlife: ["Hauz Khas Village", "Connaught Place", "GK-1", "Cyber Hub Gurgaon"],
    businessDistricts: ["Connaught Place", "Nehru Place", "Saket", "Gurgaon Cyber City"],
    culture: ["Mughal architecture", "Punjabi cuisine", "street food culture", "multilingual NCR diaspora"],
    economy: ["government services", "IT and BPO", "retail", "hospitality", "real estate"],
  },
  bangalore: {
    city: "Bangalore",
    description:
      "Bangalore, India's Silicon Valley, combines garden-city charm with a cosmopolitan tech workforce centred on Electronic City, Whitefield, and Koramangala's café culture.",
    luxuryAreas: ["Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "HSR Layout", "Sadashivanagar", "Lavelle Road"],
    hotels: ["Taj West End", "ITC Gardenia", "Oberoi Bangalore", "JW Marriott Bengaluru", "The Leela Palace"],
    railwayStations: ["Krantivira Sangolli Rayanna Railway Station", "Yesvantpur Junction", "Cantonment Station"],
    busStands: ["Kempegowda Bus Station Majestic", "Shantinagar Bus Stand", "Electronic City Bus Terminal"],
    airports: ["Kempegowda International Airport"],
    shoppingMalls: ["UB City Mall", "Phoenix Marketcity Whitefield", "Orion Mall Brigade Gateway", "Forum Mall Koramangala"],
    itParks: ["Electronic City", "Whitefield ITPL", "Manyata Tech Park", "Outer Ring Road tech corridor"],
    touristAttractions: ["Bangalore Palace", "Lalbagh Botanical Garden", "Cubbon Park", "Vidhana Soudha", "Bull Temple"],
    landmarks: ["Vidhana Soudha", "Bangalore Palace", "Lalbagh", "ISKCON Temple Rajajinagar"],
    colleges: ["IISc Bangalore", "IIT Bangalore", "Christ University", "RV College of Engineering"],
    hospitals: ["Manipal Hospital", "Narayana Health City", "Fortis Bannerghatta", "Apollo Hospitals"],
    markets: ["Commercial Street", "Chickpet", "KR Market", "Brigade Road"],
    festivals: ["Karaga Festival", "Bangalore Literature Festival", "Bengaluru Habba", "Deepavali"],
    beachesLakesParks: ["Cubbon Park", "Lalbagh", "Ulsoor Lake", "Nandi Hills (nearby)"],
    nightlife: ["Indiranagar 100 Feet Road", "Koramangala", "Church Street", "MG Road"],
    businessDistricts: ["MG Road", "Electronic City", "Whitefield", "Manyata Tech Park"],
    culture: ["Kannada theatre", "craft beer culture", "South Indian filter coffee", "startup meetups"],
    economy: ["information technology", "aerospace", "biotechnology", "defence research", "startups"],
  },
  hyderabad: {
    city: "Hyderabad",
    description:
      "Hyderabad, the City of Pearls, fuses Nizami heritage with HITEC City's tech boom — Charminar bazaars by day, Gachibowli towers by night.",
    luxuryAreas: ["Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur", "Hitech City", "Film Nagar", "Barkas"],
    hotels: ["Taj Falaknuma Palace", "ITC Kohenur", "Novotel HITEC City", "Park Hyatt Hyderabad", "Trident Hyderabad"],
    railwayStations: ["Secunderabad Junction", "Hyderabad Deccan Nampally", "Kacheguda", "Lingampally"],
    busStands: ["Mahatma Gandhi Bus Station Imlibun", "Jubilee Bus Station", "Gachibowli Bus Depot"],
    airports: ["Rajiv Gandhi International Airport Shamshabad"],
    shoppingMalls: ["Inorbit Mall HITEC City", "GVK One Mall Banjara Hills", "Forum Sujana Mall", "Sarath City Capital Mall"],
    itParks: ["HITEC City", "Gachibowli Financial District", "Nanakramguda", "Madhapur"],
    touristAttractions: ["Charminar", "Golconda Fort", "Hussain Sagar Lake", "Ramoji Film City", "Chowmahalla Palace"],
    landmarks: ["Charminar", "Golconda Fort", "Hussain Sagar Buddha", "Qutb Shahi Tombs"],
    colleges: ["University of Hyderabad", "BITS Pilani Hyderabad", "IIIT Hyderabad", "Osmania University"],
    hospitals: ["Apollo Jubilee Hills", "Yashoda Hospitals", "KIMS Secunderabad", "Care Hospital"],
    markets: ["Laad Bazaar", "Sultan Bazaar", "Begum Bazaar", "Ameerpet"],
    festivals: ["Bonalu", "Ramzan festivities", "Deccan Festival", "Hyderabad Literary Festival"],
    beachesLakesParks: ["Hussain Sagar Lake", "KBR National Park", "Durgam Cheruvu", "Lumbini Park"],
    nightlife: ["Jubilee Hills", "Banjara Hills", "Madhapur", "Gachibowli"],
    businessDistricts: ["HITEC City", "Gachibowli", "Banjara Hills", "Begumpet"],
    culture: ["Hyderabadi biryani", "pearls and lacquer craft", "Telugu cinema", "Nizami court traditions"],
    economy: ["pharmaceuticals", "IT services", "defence", "pearls trade", "film production"],
  },
  chennai: {
    city: "Chennai",
    description:
      "Chennai, the cultural capital of South India, pairs Marina Beach traditions with OMR's IT corridor and a discerning premium services market.",
    luxuryAreas: ["Nungambakkam", "Alwarpet", "Adyar", "Anna Nagar", "Velachery", "T Nagar", "ECR"],
    hotels: ["ITC Grand Chola", "Taj Coromandel", "Leela Palace Chennai", "Park Hyatt Chennai", "The Raintree"],
    railwayStations: ["Chennai Central", "Chennai Egmore", "Tambaram", "Chennai Beach"],
    busStands: ["Chennai Mofussil Bus Terminus CMBT", "Koyambedu Bus Stand", "Broadway Bus Stand"],
    airports: ["Chennai International Airport"],
    shoppingMalls: ["Phoenix Marketcity Velachery", "Express Avenue Royapettah", "VR Chennai Anna Nagar", "Spencer Plaza"],
    itParks: ["Tidel Park", "DLF IT Park Mount Poonamallee", "OMR Sholinganallur corridor", "Siruseri SIPCOT"],
    touristAttractions: ["Marina Beach", "Kapaleeshwarar Temple", "Fort St George", "Mahabalipuram", "Vivekananda Rock Kanyakumari"],
    landmarks: ["Marina Beach", "Kapaleeshwarar Temple", "Ripon Building", "Valluvar Kottam"],
    colleges: ["IIT Madras", "Anna University", "Loyola College", "Madras Christian College"],
    hospitals: ["Apollo Main Hospital", "Fortis Malar", "Sri Ramachandra Medical Centre", "MIOT International"],
    markets: ["T Nagar Ranganathan Street", "Pondy Bazaar", "Parry's Corner", "George Town"],
    festivals: ["Pongal", "Margazhi music season", "Chennai Sangamam", "Navaratri kolu"],
    beachesLakesParks: ["Marina Beach", "Elliot's Beach Besant Nagar", "Guindy National Park", "Semmozhi Poonga"],
    nightlife: ["Nungambakkam", "ECR resorts strip", "T Nagar", "Velachery"],
    businessDistricts: ["OMR", "Guindy", "Tidel Park", "Ambattur Industrial Estate"],
    culture: ["Carnatic music", "Bharatanatyam", "filter coffee culture", "Tamil cinema"],
    economy: ["automobile manufacturing", "IT exports", "healthcare tourism", "port trade"],
  },
  pune: {
    city: "Pune",
    description:
      "Pune, Maharashtra's education and IT hub, blends Oxford of the East campuses with Koregaon Park cafés and Hinjewadi's tech parks.",
    luxuryAreas: ["Koregaon Park", "Boat Club Road", "Kalyani Nagar", "Baner", "Aundh", "Viman Nagar", "Magarpatta"],
    hotels: ["Taj Blue Diamond", "Conrad Pune", "JW Marriott Pune", "Hyatt Regency Pune", "The Westin Pune"],
    railwayStations: ["Pune Junction", "Shivajinagar", "Pimpri", "Hadapsar"],
    busStands: ["Swargate Bus Stand", "Shivajinagar Bus Depot", "Hinjewadi Phase 3 Terminal"],
    airports: ["Pune International Airport Lohegaon"],
    shoppingMalls: ["Phoenix Marketcity Viman Nagar", "Amanora Town Centre", "Seasons Mall Magarpatta", "Sgs Mall"],
    itParks: ["Hinjewadi Rajiv Gandhi Infotech Park", "Magarpatta City", "Kharadi EON IT Park", "Baner Pashan Link Road"],
    touristAttractions: ["Shaniwar Wada", "Aga Khan Palace", "Sinhagad Fort", "Osho Ashram Koregaon Park"],
    landmarks: ["Shaniwar Wada", "Aga Khan Palace", "Dagdusheth Ganpati Temple", "Parvati Hill"],
    colleges: ["Fergusson College", "Symbiosis International", "COEP", "IIT Pune"],
    hospitals: ["Ruby Hall Clinic", "Jehangir Hospital", "Sahyadri Hospital", "KEM Hospital"],
    markets: ["Laxmi Road", "Tulsi Baug", "FC Road", "JM Road"],
    festivals: ["Ganesh Festival", "Pune International Film Festival", "Sawai Gandharva Music Festival"],
    beachesLakesParks: ["Pashan Lake", "Khadakwasla Dam", "Empress Garden", "Osho Teerth Park"],
    nightlife: ["Koregaon Park", "FC Road", "Baner", "Camp area"],
    businessDistricts: ["Hinjewadi", "Magarpatta", "Kharadi", "SB Road"],
    culture: ["Marathi theatre", "defence academy heritage", "Puneri misal", "student café culture"],
    economy: ["automotive R&D", "IT services", "education", "defence manufacturing"],
  },
  kolkata: {
    city: "Kolkata",
    description:
      "Kolkata, the City of Joy, retains colonial grandeur along Park Street while Salt Lake's Sector V powers eastern India's IT growth.",
    luxuryAreas: ["Park Street", "Ballygunge", "Alipore", "New Town", "Salt Lake Sector V", "Camac Street", "Southern Avenue"],
    hotels: ["Oberoi Grand Kolkata", "Taj Bengal", "ITC Sonar", "Hyatt Regency Kolkata", "The Lalit Great Eastern"],
    railwayStations: ["Howrah Junction", "Sealdah", "Kolkata Railway Station Chitpur", "Santragachi"],
    busStands: ["Esplanade Bus Terminus", "Babughat", "Salt Lake Karunamoyee Bus Stand"],
    airports: ["Netaji Subhas Chandra Bose International Airport"],
    shoppingMalls: ["South City Mall", "City Centre Salt Lake", "Quest Mall", "Mani Square"],
    itParks: ["Salt Lake Sector V", "New Town Rajarhat", "Technopolis Sector V", "Webel IT Park"],
    touristAttractions: ["Victoria Memorial", "Howrah Bridge", "Dakshineswar Kali Temple", "Indian Museum", "Park Street"],
    landmarks: ["Howrah Bridge", "Victoria Memorial", "Eden Gardens", "Writers' Building"],
    colleges: ["Presidency University", "Jadavpur University", "IIM Calcutta", "St. Xavier's College"],
    hospitals: ["Apollo Gleneagles", "AMRI Hospitals", "Peerless Hospital", "RN Tagore International Institute"],
    markets: ["New Market", "Gariahat", "Burrabazar", "Hatibagan"],
    festivals: ["Durga Puja", "Kolkata Book Fair", "Poila Boishakh", "Christmas on Park Street"],
    beachesLakesParks: ["Eco Park New Town", "Rabindra Sarobar", "Maidan", "Prinsep Ghat"],
    nightlife: ["Park Street", "Ballygunge", "Camac Street", "New Town"],
    businessDistricts: ["BBD Bagh", "Salt Lake Sector V", "New Town", "Park Circus"],
    culture: ["Bengali literature", "adda café culture", "Durga Puja artistry", "tram heritage"],
    economy: ["jute and tea trade", "IT services", "creative industries", "east India logistics"],
  },
  goa: {
    city: "Panaji",
    description:
      "Goa blends Portuguese heritage with beach tourism — from Panaji's Latin Quarter to Calangute nightlife and IT parks in Verna.",
    luxuryAreas: ["Panaji", "Candolim", "Calangute", "Assagao", "Porvorim", "Dona Paula", "Vagator"],
    hotels: ["Taj Fort Aguada", "Grand Hyatt Goa", "W Goa Vagator", "Taj Exotica Benaulim", "Marriott Resort Miramar"],
    railwayStations: ["Madgaon Junction", "Thivim", "Vasco da Gama"],
    busStands: ["Kadamba Bus Stand Panaji", "Mapusa Bus Stand", "Margao Bus Stand"],
    airports: ["Goa International Airport Dabolim", "Manohar International Airport Mopa"],
    shoppingMalls: ["Mall De Goa Porvorim", "Caculo Mall Panaji", "1926 Mall"],
    itParks: ["Verna Industrial Estate", "Tuem Electronic City", "Porvorim tech offices"],
    touristAttractions: ["Baga Beach", "Old Goa churches", "Fort Aguada", "Dudhsagar Falls", "Anjuna Flea Market"],
    landmarks: ["Basilica of Bom Jesus", "Fort Aguada", "Se Cathedral", "Dona Paula viewpoint"],
    colleges: ["Goa University", "BITS Goa", "National Institute of Technology Goa"],
    hospitals: ["Goa Medical College", "Manipal Hospital Goa", "Victor Hospital Margao"],
    markets: ["Mapusa Friday Market", "Anjuna Flea Market", "Panaji Municipal Market"],
    festivals: ["Carnival", "Sunburn Festival", "Shigmo", "Feast of St Francis Xavier"],
    beachesLakesParks: ["Calangute Beach", "Palolem Beach", "Baga Beach", "Bondla Wildlife Sanctuary"],
    nightlife: ["Tito's Lane Baga", "Anjuna", "Vagator", "Palolem"],
    businessDistricts: ["Panaji", "Margao", "Verna", "Porvorim"],
    culture: ["Konkani-Portuguese fusion", "feni and seafood", "Carnival floats", "beach shack culture"],
    economy: ["tourism", "mining", "fishing", "hospitality", "real estate"],
  },
  agra: {
    city: "Agra",
    description:
      "Agra, home to the Taj Mahal, channels millions of heritage tourists through Taj Ganj, Sadar Bazaar, and Yamuna Expressway hospitality corridors.",
    luxuryAreas: ["Taj Ganj", "Sadar Bazaar", "Kamla Nagar", "Dayal Bagh", "Fatehabad Road", "Shastripuram"],
    hotels: ["ITC Mughal Agra", "Oberoi Amarvilas", "Trident Agra", "Jaypee Palace", "DoubleTree by Hilton"],
    railwayStations: ["Agra Cantt", "Agra Fort", "Raja Ki Mandi", "Idgah"],
    busStands: ["ISBT Agra", "Idgah Bus Stand", "Yamuna Expressway Bus Hub"],
    airports: ["Agra Airport (military/civilian)"],
    shoppingMalls: ["TDI Mall", "Sanskriti Vihar Mall", "Pacific Mall"],
    itParks: ["Sikandra Industrial Area", "Foundry Nagar industrial belt"],
    touristAttractions: ["Taj Mahal", "Agra Fort", "Fatehpur Sikri", "Mehtab Bagh", "Itimad-ud-Daulah's Tomb"],
    landmarks: ["Taj Mahal", "Agra Fort", "Akbar's Tomb Sikandra", "Jama Masjid"],
    colleges: ["Dr. B.R. Ambedkar University", "Dayalbagh Educational Institute"],
    hospitals: ["SN Medical College", "Pushpanjali Hospital", "Max Hospital Agra"],
    markets: ["Sadar Bazaar", "Kinari Bazaar", "Raja Mandi", "Sanjay Place"],
    festivals: ["Taj Mahotsav", "Ram Barat", "Taj Literature Festival"],
    beachesLakesParks: ["Mehtab Bagh gardens", "Yamuna riverside", "Keetham Lake Bird Sanctuary"],
    nightlife: ["Sadar Bazaar", "Fatehabad Road", "Taj Ganj"],
    businessDistricts: ["Sanjay Place", "Sikandra", "Dayal Bagh", "Fatehabad Road"],
    culture: ["Mughal architecture", "Petha sweets", "marble inlay craft", "heritage tourism"],
    economy: ["tourism", "leather goods", "handicrafts", "hospitality"],
  },
  ahmedabad: {
    city: "Ahmedabad",
    description:
      "Ahmedabad, a UNESCO World Heritage City, pairs pol-house lanes with SG Highway towers and GIFT City's financial ambitions.",
    luxuryAreas: ["Satellite", "Vastrapur", "Bodakdev", "Thaltej", "Prahlad Nagar", "Navrangpura", "SG Highway"],
    hotels: ["Hyatt Regency Ahmedabad", "Taj Skyline", "Courtyard by Marriott Satellite", "Fortune Landmark", "The House of MG"],
    railwayStations: ["Ahmedabad Junction Kalupur", "Sabarmati", "Maninagar"],
    busStands: ["GSRTC Central Bus Station", "Gita Mandir Bus Stand", "Bopal Bus Depot"],
    airports: ["Sardar Vallabhbhai Patel International Airport"],
    shoppingMalls: ["Alpha One Mall Vastrapur", "Ahmedabad One Mall", "Iscon Mega Mall", "Himalaya Mall"],
    itParks: ["GIFT City Gandhinagar", "Prahlad Nagar corporate belt", "SG Highway offices", "Ashram Road"],
    touristAttractions: ["Sabarmati Ashram", "Adalaj Stepwell", "Kankaria Lake", "Sidi Saiyyed Mosque", "Law Garden"],
    landmarks: ["Sabarmati Ashram", "Sidi Saiyyed Mosque", "Jama Masjid", "Kankaria Lake"],
    colleges: ["IIM Ahmedabad", "Nirma University", "CEPT University", "Gujarat University"],
    hospitals: ["Civil Hospital", "Apollo Hospital Ahmedabad", "Sterling Hospital", "Zydus Hospital"],
    markets: ["Law Garden Night Market", "Manek Chowk", "Ratanpol", "CG Road"],
    festivals: ["Navratri Garba", "Uttarayan kite festival", "International Kite Festival"],
    beachesLakesParks: ["Kankaria Lake", "Sabarmati Riverfront", "Thol Bird Sanctuary"],
    nightlife: ["SG Highway", "Vastrapur", "Prahlad Nagar", "Law Garden"],
    businessDistricts: ["CG Road", "Prahlad Nagar", "Ashram Road", "GIFT City"],
    culture: ["Gujarati thali cuisine", "textile trade", "Navratri dance", "Jain heritage"],
    economy: ["textiles and diamonds", "chemicals", "pharmaceuticals", "financial services"],
  },
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickN<T>(arr: readonly T[], count: number, seed: number): T[] {
  return [...arr]
    .sort((a, b) => hashString(JSON.stringify(a) + seed) - hashString(JSON.stringify(b) + seed))
    .slice(0, count);
}

function tryCityContext(slug: string): Partial<CuratedIntel> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ctx = require("@/lib/city-context") as {
      getCityDescription: (s: string) => string;
      getCityNightlife: (s: string) => string[];
      getCityTourism: (s: string) => string[];
      getCityBusiness: (s: string) => string[];
      getCityNeighborhoods: (s: string) => string[];
      getCityUniqueSellingPoints: (s: string) => string[];
    };
    const desc = ctx.getCityDescription(slug);
    if (!desc) return null;
    const neighborhoods = ctx.getCityNeighborhoods(slug);
    const tourism = ctx.getCityTourism(slug);
    return {
      city: slug.charAt(0).toUpperCase() + slug.slice(1),
      description: desc,
      luxuryAreas: neighborhoods,
      hotels: pickN(
        [`${slug} Grand Hotel`, `${slug} Riverside Residency`, `${slug} Central Suites`],
        4,
        hashString(slug),
      ),
      railwayStations: [`${slug} Junction`, `${slug} Central Railway Station`],
      busStands: [`${slug} ISBT`, `${slug} City Bus Depot`],
      airports: [],
      shoppingMalls: [`${slug} City Mall`, `${slug} Central Plaza`],
      itParks: ctx.getCityBusiness(slug),
      touristAttractions: tourism,
      landmarks: tourism,
      colleges: [`${slug} University`, `${slug} College`],
      hospitals: [`${slug} Civil Hospital`, `${slug} Medical Centre`],
      markets: pickN(neighborhoods, 3, hashString(slug + "mkt")),
      festivals: ["Diwali", "Holi", "local harvest festival"],
      beachesLakesParks: [],
      nightlife: ctx.getCityNightlife(slug),
      businessDistricts: ctx.getCityBusiness(slug),
      culture: ["regional cuisine", "local festivals", "street commerce"],
      economy: ["services", "retail", "hospitality"],
    };
  } catch {
    return null;
  }
}

function buildGeoIntel(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas: string[],
): LocalIntelligence {
  const geo = getCityBySlug(citySlug);
  const seed = hashString(citySlug);
  const tierLabel = geo?.tier === 1 ? "metro" : geo?.tier === 2 ? "tier-2 hub" : "regional centre";
  const areas =
    dbAreas.length > 0
      ? dbAreas.slice(0, 10)
      : [
          `${cityName} Central`,
          `${cityName} Old City`,
          `${cityName} Station Road`,
          `${cityName} Civil Lines`,
          `${cityName} Market Area`,
        ];

  const hotels = pickN(
      [
        `${cityName} Heritage Inn`,
        `${cityName} Grand Residency`,
        `${cityName} Riverside Lodge`,
        `${cityName} Metro Suites`,
        `${cityName} Business Tower`,
      ],
      5,
      seed,
    );

  return {
    city: cityName,
    slug: citySlug,
    stateName,
    stateSlug,
    description: `${cityName} is a ${tierLabel} in ${stateName} with distinct commercial corridors, residential belts, and transport nodes that shape how locals and visitors search for verified listings.`,
    luxuryAreas: areas.slice(0, 8),
    premiumResidentialAreas: pickN(areas, 5, seed + 1),
    hotels,
    businessHotels: pickN(hotels, 3, seed + 2),
    resorts: geo?.tier === 1 ? [`${cityName} Lakeside Resort`, `${cityName} Hill Retreat`] : [`${cityName} Garden Resort`],
    railwayStations: [`${cityName} Junction`, `${cityName} Railway Station`],
    busStands: [`${cityName} ISBT`, `${cityName} Bus Stand`],
    airports: geo?.tier === 1 ? [`${cityName} International Airport`] : geo?.tier === 2 ? [`${cityName} Airport`] : [],
    shoppingMalls: [`${cityName} City Mall`, `${cityName} Central Plaza`, `${cityName} Metro Mall`],
    itParks: [`${cityName} IT Park`, `${cityName} Tech Park`, `${cityName} SEZ`],
    touristAttractions: [`${cityName} heritage quarter`, `${cityName} main temple`, `${cityName} riverside promenade`, `${cityName} old fort`],
    landmarks: [`${cityName} central landmark`, `${cityName} historic gate`, `${cityName} clock tower`],
    historicMonuments: [`${cityName} old fort`, `${cityName} heritage stepwell`, `${cityName} colonial-era building`],
    colleges: [`${cityName} University`, `${cityName} Degree College`, `${cityName} Engineering College`],
    hospitals: [`${cityName} District Hospital`, `${cityName} Medical College`, `${cityName} Super Speciality Hospital`],
    markets: pickN(areas, 4, seed + 3),
    festivals: ["Diwali", "Holi", "regional harvest fair", `${cityName} cultural festival`],
    beachesLakesParks: geo && geo.lat < 20 ? [`${cityName} lakeside park`, `${cityName} riverside promenade`] : [`${cityName} central park`],
    nightlife: pickN(areas, 4, seed + 5),
    businessDistricts: pickN(areas, 4, seed + 7),
    industrialZones: [`${cityName} industrial estate`, `${cityName} logistics corridor`],
    governmentOffices: [`${cityName} collectorate`, `${cityName} municipal corporation`],
    famousRoads: [`${cityName} Main Road`, `${cityName} Station Road`, `${cityName} Ring Road`],
    foodStreets: [`${cityName} food street`, `${cityName} night bazaar`, `${areas[0] ?? cityName} market lanes`],
    culture: ["regional cuisine", "local crafts", "festival traditions", "street commerce"],
    economy: ["retail trade", "services sector", "hospitality", "transport logistics", "SME commerce"],
    nearbyCities: getNearbyCities(citySlug, 6).map((c) => ({ name: c.name, slug: c.slug })),
    dbAreas,
    source: "geo_generated",
  };
}

function withIntelDefaults(intel: Partial<LocalIntelligence> & Pick<LocalIntelligence, "city" | "slug" | "stateName" | "stateSlug" | "description" | "luxuryAreas" | "hotels" | "source">): LocalIntelligence {
  const areas = intel.luxuryAreas;
  return {
    premiumResidentialAreas: intel.premiumResidentialAreas ?? areas.slice(0, 5),
    businessHotels: intel.businessHotels ?? intel.hotels.slice(0, 3),
    resorts: intel.resorts ?? [`${intel.city} Resort`],
    industrialZones: intel.industrialZones ?? [`${intel.city} industrial belt`],
    governmentOffices: intel.governmentOffices ?? [`${intel.city} collectorate`],
    famousRoads: intel.famousRoads ?? [`${intel.city} Main Road`],
    historicMonuments: intel.historicMonuments ?? intel.landmarks ?? [],
    foodStreets: intel.foodStreets ?? [`${intel.city} food street`],
    railwayStations: intel.railwayStations ?? [],
    busStands: intel.busStands ?? [],
    airports: intel.airports ?? [],
    shoppingMalls: intel.shoppingMalls ?? [],
    itParks: intel.itParks ?? [],
    touristAttractions: intel.touristAttractions ?? [],
    landmarks: intel.landmarks ?? [],
    colleges: intel.colleges ?? [],
    hospitals: intel.hospitals ?? [],
    markets: intel.markets ?? [],
    festivals: intel.festivals ?? [],
    beachesLakesParks: intel.beachesLakesParks ?? [],
    nightlife: intel.nightlife ?? [],
    businessDistricts: intel.businessDistricts ?? [],
    culture: intel.culture ?? [],
    economy: intel.economy ?? [],
    nearbyCities: intel.nearbyCities ?? [],
    dbAreas: intel.dbAreas ?? [],
    ...intel,
  };
}

/** Build structured local intelligence for V6 content generation. */
export function buildLocalIntelligence(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas: string[] = [],
): LocalIntelligence {
  const nearby = getNearbyCities(citySlug, 6).map((c) => ({ name: c.name, slug: c.slug }));
  const mergedAreas = dbAreas.length > 0 ? [...new Set(dbAreas)] : [];

  const curated = CURATED_INTEL[citySlug];
  if (curated) {
    const luxuryAreas = [...new Set([...mergedAreas.slice(0, 6), ...curated.luxuryAreas])].slice(0, 10);
    return withIntelDefaults({
      ...curated,
      slug: citySlug,
      stateName,
      stateSlug,
      luxuryAreas,
      nearbyCities: nearby,
      dbAreas: mergedAreas,
      source: "curated",
    });
  }

  const ctxIntel = tryCityContext(citySlug);
  if (ctxIntel) {
    const luxuryAreas = [...new Set([...mergedAreas.slice(0, 6), ...(ctxIntel.luxuryAreas ?? [])])].slice(0, 10);
    return withIntelDefaults({
      city: ctxIntel.city ?? cityName,
      slug: citySlug,
      stateName,
      stateSlug,
      description: ctxIntel.description ?? "",
      luxuryAreas,
      hotels: ctxIntel.hotels ?? [],
      railwayStations: ctxIntel.railwayStations ?? [],
      busStands: ctxIntel.busStands ?? [],
      airports: ctxIntel.airports ?? [],
      shoppingMalls: ctxIntel.shoppingMalls ?? [],
      itParks: ctxIntel.itParks ?? [],
      touristAttractions: ctxIntel.touristAttractions ?? [],
      landmarks: ctxIntel.landmarks ?? [],
      colleges: ctxIntel.colleges ?? [],
      hospitals: ctxIntel.hospitals ?? [],
      markets: ctxIntel.markets ?? [],
      festivals: ctxIntel.festivals ?? [],
      beachesLakesParks: ctxIntel.beachesLakesParks ?? [],
      nightlife: ctxIntel.nightlife ?? [],
      businessDistricts: ctxIntel.businessDistricts ?? [],
      culture: ctxIntel.culture ?? [],
      economy: ctxIntel.economy ?? [],
      nearbyCities: nearby,
      dbAreas: mergedAreas,
      source: "city_context",
    });
  }

  return withIntelDefaults(buildGeoIntel(cityName, citySlug, stateName, stateSlug, mergedAreas));
}

/** Count meaningful local references woven into content. */
export function countLocalReferences(text: string, intel: LocalIntelligence): number {
  const corpus = [
    ...intel.luxuryAreas,
    ...intel.hotels,
    ...intel.railwayStations,
    ...intel.busStands,
    ...intel.airports,
    ...intel.shoppingMalls,
    ...intel.itParks,
    ...intel.touristAttractions,
    ...intel.landmarks,
    ...intel.markets,
    ...intel.festivals,
    ...intel.beachesLakesParks,
    ...intel.nightlife,
    ...intel.businessDistricts,
  ];
  const lower = text.toLowerCase();
  let count = 0;
  for (const ref of corpus) {
    if (ref.length > 3 && lower.includes(ref.toLowerCase())) count++;
  }
  return count;
}

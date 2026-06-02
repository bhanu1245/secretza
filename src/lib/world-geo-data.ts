// ==========================================
// Enterprise World Geo Database
// ==========================================
// Comprehensive database of 50+ countries, states/provinces, and cities
// Used for seeding the enterprise geo system.
// Data sources: ISO 3166, official government sources, GeoNames
// ==========================================

export interface CountryData {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  slug: string;
}

export interface StateData {
  name: string;
  slug: string;
  countryCode: string;
}

export interface CityData {
  name: string;
  slug: string;
  stateSlug: string;
  countryCode: string;
  isFeatured?: boolean;
}

// ==========================================
// Countries (50+ worldwide with ISO codes)
// ==========================================
export const worldCountries: CountryData[] = [
  // === North America ===
  { name: "United States", code: "US", slug: "united-states" },
  { name: "Canada", code: "CA", slug: "canada" },
  { name: "Mexico", code: "MX", slug: "mexico" },
  { name: "Guatemala", code: "GT", slug: "guatemala" },
  { name: "Costa Rica", code: "CR", slug: "costa-rica" },
  { name: "Panama", code: "PA", slug: "panama" },
  { name: "Jamaica", code: "JM", slug: "jamaica" },
  { name: "Dominican Republic", code: "DO", slug: "dominican-republic" },
  { name: "Trinidad and Tobago", code: "TT", slug: "trinidad-tobago" },

  // === South America ===
  { name: "Brazil", code: "BR", slug: "brazil" },
  { name: "Argentina", code: "AR", slug: "argentina" },
  { name: "Colombia", code: "CO", slug: "colombia" },
  { name: "Peru", code: "PE", slug: "peru" },
  { name: "Chile", code: "CL", slug: "chile" },
  { name: "Venezuela", code: "VE", slug: "venezuela" },
  { name: "Ecuador", code: "EC", slug: "ecuador" },
  { name: "Bolivia", code: "BO", slug: "bolivia" },
  { name: "Uruguay", code: "UY", slug: "uruguay" },
  { name: "Paraguay", code: "PY", slug: "paraguay" },

  // === Europe ===
  { name: "United Kingdom", code: "GB", slug: "united-kingdom" },
  { name: "Ireland", code: "IE", slug: "ireland" },
  { name: "Germany", code: "DE", slug: "germany" },
  { name: "France", code: "FR", slug: "france" },
  { name: "Netherlands", code: "NL", slug: "netherlands" },
  { name: "Spain", code: "ES", slug: "spain" },
  { name: "Italy", code: "IT", slug: "italy" },
  { name: "Switzerland", code: "CH", slug: "switzerland" },
  { name: "Austria", code: "AT", slug: "austria" },
  { name: "Portugal", code: "PT", slug: "portugal" },
  { name: "Greece", code: "GR", slug: "greece" },
  { name: "Sweden", code: "SE", slug: "sweden" },
  { name: "Norway", code: "NO", slug: "norway" },
  { name: "Denmark", code: "DK", slug: "denmark" },
  { name: "Finland", code: "FI", slug: "finland" },
  { name: "Poland", code: "PL", slug: "poland" },
  { name: "Czech Republic", code: "CZ", slug: "czech-republic" },
  { name: "Belgium", code: "BE", slug: "belgium" },
  { name: "Romania", code: "RO", slug: "romania" },
  { name: "Hungary", code: "HU", slug: "hungary" },
  { name: "Ukraine", code: "UA", slug: "ukraine" },
  { name: "Croatia", code: "HR", slug: "croatia" },
  { name: "Russia", code: "RU", slug: "russia" },
  { name: "Turkey", code: "TR", slug: "turkey" },
  { name: "Bulgaria", code: "BG", slug: "bulgaria" },
  { name: "Serbia", code: "RS", slug: "serbia" },
  { name: "Slovakia", code: "SK", slug: "slovakia" },
  { name: "Lithuania", code: "LT", slug: "lithuania" },
  { name: "Latvia", code: "LV", slug: "latvia" },
  { name: "Estonia", code: "EE", slug: "estonia" },
  { name: "Slovenia", code: "SI", slug: "slovenia" },
  { name: "Malta", code: "MT", slug: "malta" },
  { name: "Cyprus", code: "CY", slug: "cyprus" },
  { name: "Luxembourg", code: "LU", slug: "luxembourg" },
  { name: "Iceland", code: "IS", slug: "iceland" },

  // === Asia ===
  { name: "India", code: "IN", slug: "india" },
  { name: "Pakistan", code: "PK", slug: "pakistan" },
  { name: "Bangladesh", code: "BD", slug: "bangladesh" },
  { name: "Sri Lanka", code: "LK", slug: "sri-lanka" },
  { name: "Nepal", code: "NP", slug: "nepal" },
  { name: "China", code: "CN", slug: "china" },
  { name: "Japan", code: "JP", slug: "japan" },
  { name: "South Korea", code: "KR", slug: "south-korea" },
  { name: "Taiwan", code: "TW", slug: "taiwan" },
  { name: "Hong Kong", code: "HK", slug: "hong-kong" },
  { name: "Thailand", code: "TH", slug: "thailand" },
  { name: "Philippines", code: "PH", slug: "philippines" },
  { name: "Vietnam", code: "VN", slug: "vietnam" },
  { name: "Singapore", code: "SG", slug: "singapore" },
  { name: "Malaysia", code: "MY", slug: "malaysia" },
  { name: "Indonesia", code: "ID", slug: "indonesia" },
  { name: "Cambodia", code: "KH", slug: "cambodia" },
  { name: "Myanmar", code: "MM", slug: "myanmar" },

  // === Middle East ===
  { name: "United Arab Emirates", code: "AE", slug: "united-arab-emirates" },
  { name: "Saudi Arabia", code: "SA", slug: "saudi-arabia" },
  { name: "Qatar", code: "QA", slug: "qatar" },
  { name: "Kuwait", code: "KW", slug: "kuwait" },
  { name: "Bahrain", code: "BH", slug: "bahrain" },
  { name: "Oman", code: "OM", slug: "oman" },
  { name: "Jordan", code: "JO", slug: "jordan" },
  { name: "Lebanon", code: "LB", slug: "lebanon" },
  { name: "Israel", code: "IL", slug: "israel" },
  { name: "Iraq", code: "IQ", slug: "iraq" },
  { name: "Iran", code: "IR", slug: "iran" },

  // === Africa ===
  { name: "South Africa", code: "ZA", slug: "south-africa" },
  { name: "Kenya", code: "KE", slug: "kenya" },
  { name: "Nigeria", code: "NG", slug: "nigeria" },
  { name: "Egypt", code: "EG", slug: "egypt" },
  { name: "Morocco", code: "MA", slug: "morocco" },
  { name: "Tanzania", code: "TZ", slug: "tanzania" },
  { name: "Ghana", code: "GH", slug: "ghana" },
  { name: "Ethiopia", code: "ET", slug: "ethiopia" },
  { name: "Tunisia", code: "TN", slug: "tunisia" },
  { name: "Algeria", code: "DZ", slug: "algeria" },

  // === Oceania ===
  { name: "Australia", code: "AU", slug: "australia" },
  { name: "New Zealand", code: "NZ", slug: "new-zealand" },
];

// ==========================================
// States/Provinces
// ==========================================
export const worldStates: StateData[] = [
  // === United States (50 states + DC) ===
  { name: "Alabama", slug: "alabama", countryCode: "US" },
  { name: "Alaska", slug: "alaska", countryCode: "US" },
  { name: "Arizona", slug: "arizona", countryCode: "US" },
  { name: "Arkansas", slug: "arkansas", countryCode: "US" },
  { name: "California", slug: "california", countryCode: "US" },
  { name: "Colorado", slug: "colorado", countryCode: "US" },
  { name: "Connecticut", slug: "connecticut", countryCode: "US" },
  { name: "Delaware", slug: "delaware", countryCode: "US" },
  { name: "District of Columbia", slug: "district-of-columbia", countryCode: "US" },
  { name: "Florida", slug: "florida", countryCode: "US" },
  { name: "Georgia", slug: "georgia", countryCode: "US" },
  { name: "Hawaii", slug: "hawaii", countryCode: "US" },
  { name: "Idaho", slug: "idaho", countryCode: "US" },
  { name: "Illinois", slug: "illinois", countryCode: "US" },
  { name: "Indiana", slug: "indiana", countryCode: "US" },
  { name: "Iowa", slug: "iowa", countryCode: "US" },
  { name: "Kansas", slug: "kansas", countryCode: "US" },
  { name: "Kentucky", slug: "kentucky", countryCode: "US" },
  { name: "Louisiana", slug: "louisiana", countryCode: "US" },
  { name: "Maine", slug: "maine", countryCode: "US" },
  { name: "Maryland", slug: "maryland", countryCode: "US" },
  { name: "Massachusetts", slug: "massachusetts", countryCode: "US" },
  { name: "Michigan", slug: "michigan", countryCode: "US" },
  { name: "Minnesota", slug: "minnesota", countryCode: "US" },
  { name: "Mississippi", slug: "mississippi", countryCode: "US" },
  { name: "Missouri", slug: "missouri", countryCode: "US" },
  { name: "Montana", slug: "montana", countryCode: "US" },
  { name: "Nebraska", slug: "nebraska", countryCode: "US" },
  { name: "Nevada", slug: "nevada", countryCode: "US" },
  { name: "New Hampshire", slug: "new-hampshire", countryCode: "US" },
  { name: "New Jersey", slug: "new-jersey", countryCode: "US" },
  { name: "New Mexico", slug: "new-mexico", countryCode: "US" },
  { name: "New York", slug: "new-york", countryCode: "US" },
  { name: "North Carolina", slug: "north-carolina", countryCode: "US" },
  { name: "North Dakota", slug: "north-dakota", countryCode: "US" },
  { name: "Ohio", slug: "ohio", countryCode: "US" },
  { name: "Oklahoma", slug: "oklahoma", countryCode: "US" },
  { name: "Oregon", slug: "oregon", countryCode: "US" },
  { name: "Pennsylvania", slug: "pennsylvania", countryCode: "US" },
  { name: "Rhode Island", slug: "rhode-island", countryCode: "US" },
  { name: "South Carolina", slug: "south-carolina", countryCode: "US" },
  { name: "South Dakota", slug: "south-dakota", countryCode: "US" },
  { name: "Tennessee", slug: "tennessee", countryCode: "US" },
  { name: "Texas", slug: "texas", countryCode: "US" },
  { name: "Utah", slug: "utah", countryCode: "US" },
  { name: "Vermont", slug: "vermont", countryCode: "US" },
  { name: "Virginia", slug: "virginia", countryCode: "US" },
  { name: "Washington", slug: "washington", countryCode: "US" },
  { name: "West Virginia", slug: "west-virginia", countryCode: "US" },
  { name: "Wisconsin", slug: "wisconsin", countryCode: "US" },
  { name: "Wyoming", slug: "wyoming", countryCode: "US" },

  // === Canada (13 provinces/territories) ===
  { name: "Ontario", slug: "ontario", countryCode: "CA" },
  { name: "Quebec", slug: "quebec", countryCode: "CA" },
  { name: "British Columbia", slug: "british-columbia", countryCode: "CA" },
  { name: "Alberta", slug: "alberta", countryCode: "CA" },
  { name: "Manitoba", slug: "manitoba", countryCode: "CA" },
  { name: "Saskatchewan", slug: "saskatchewan", countryCode: "CA" },
  { name: "Nova Scotia", slug: "nova-scotia", countryCode: "CA" },
  { name: "New Brunswick", slug: "new-brunswick", countryCode: "CA" },
  { name: "Newfoundland and Labrador", slug: "newfoundland-labrador", countryCode: "CA" },
  { name: "Prince Edward Island", slug: "prince-edward-island", countryCode: "CA" },
  { name: "Northwest Territories", slug: "northwest-territories", countryCode: "CA" },
  { name: "Yukon", slug: "yukon", countryCode: "CA" },
  { name: "Nunavut", slug: "nunavut", countryCode: "CA" },

  // === United Kingdom (4 countries + regions) ===
  { name: "England", slug: "england", countryCode: "GB" },
  { name: "Scotland", slug: "scotland", countryCode: "GB" },
  { name: "Wales", slug: "wales", countryCode: "GB" },
  { name: "Northern Ireland", slug: "northern-ireland", countryCode: "GB" },

  // === Australia (8 states/territories) ===
  { name: "New South Wales", slug: "new-south-wales", countryCode: "AU" },
  { name: "Victoria", slug: "victoria", countryCode: "AU" },
  { name: "Queensland", slug: "queensland", countryCode: "AU" },
  { name: "Western Australia", slug: "western-australia", countryCode: "AU" },
  { name: "South Australia", slug: "south-australia", countryCode: "AU" },
  { name: "Tasmania", slug: "tasmania", countryCode: "AU" },
  { name: "Australian Capital Territory", slug: "australian-capital-territory", countryCode: "AU" },
  { name: "Northern Territory", slug: "northern-territory", countryCode: "AU" },

  // === India (36 states/UTs) ===
  { name: "Andhra Pradesh", slug: "andhra-pradesh", countryCode: "IN" },
  { name: "Arunachal Pradesh", slug: "arunachal-pradesh", countryCode: "IN" },
  { name: "Assam", slug: "assam", countryCode: "IN" },
  { name: "Bihar", slug: "bihar", countryCode: "IN" },
  { name: "Chhattisgarh", slug: "chhattisgarh", countryCode: "IN" },
  { name: "Goa", slug: "goa", countryCode: "IN" },
  { name: "Gujarat", slug: "gujarat", countryCode: "IN" },
  { name: "Haryana", slug: "haryana", countryCode: "IN" },
  { name: "Himachal Pradesh", slug: "himachal-pradesh", countryCode: "IN" },
  { name: "Jharkhand", slug: "jharkhand", countryCode: "IN" },
  { name: "Karnataka", slug: "karnataka", countryCode: "IN" },
  { name: "Kerala", slug: "kerala", countryCode: "IN" },
  { name: "Madhya Pradesh", slug: "madhya-pradesh", countryCode: "IN" },
  { name: "Maharashtra", slug: "maharashtra", countryCode: "IN" },
  { name: "Manipur", slug: "manipur", countryCode: "IN" },
  { name: "Meghalaya", slug: "meghalaya", countryCode: "IN" },
  { name: "Mizoram", slug: "mizoram", countryCode: "IN" },
  { name: "Nagaland", slug: "nagaland", countryCode: "IN" },
  { name: "Odisha", slug: "odisha", countryCode: "IN" },
  { name: "Punjab", slug: "punjab", countryCode: "IN" },
  { name: "Rajasthan", slug: "rajasthan", countryCode: "IN" },
  { name: "Sikkim", slug: "sikkim", countryCode: "IN" },
  { name: "Tamil Nadu", slug: "tamil-nadu", countryCode: "IN" },
  { name: "Telangana", slug: "telangana", countryCode: "IN" },
  { name: "Tripura", slug: "tripura", countryCode: "IN" },
  { name: "Uttar Pradesh", slug: "uttar-pradesh", countryCode: "IN" },
  { name: "Uttarakhand", slug: "uttarakhand", countryCode: "IN" },
  { name: "West Bengal", slug: "west-bengal", countryCode: "IN" },
  { name: "Andaman and Nicobar Islands", slug: "andaman-nicobar", countryCode: "IN" },
  { name: "Chandigarh", slug: "chandigarh", countryCode: "IN" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", slug: "dadra-nagar-haveli", countryCode: "IN" },
  { name: "Delhi", slug: "delhi", countryCode: "IN" },
  { name: "Jammu and Kashmir", slug: "jammu-kashmir", countryCode: "IN" },
  { name: "Ladakh", slug: "ladakh", countryCode: "IN" },
  { name: "Lakshadweep", slug: "lakshadweep", countryCode: "IN" },
  { name: "Puducherry", slug: "puducherry", countryCode: "IN" },

  // === Germany (16 states) ===
  { name: "Bavaria", slug: "bavaria", countryCode: "DE" },
  { name: "Berlin", slug: "berlin", countryCode: "DE" },
  { name: "Hamburg", slug: "hamburg", countryCode: "DE" },
  { name: "Hesse", slug: "hesse", countryCode: "DE" },
  { name: "North Rhine-Westphalia", slug: "north-rhine-westphalia", countryCode: "DE" },
  { name: "Baden-Wurttemberg", slug: "baden-wurttemberg", countryCode: "DE" },
  { name: "Saxony", slug: "saxony", countryCode: "DE" },
  { name: "Lower Saxony", slug: "lower-saxony", countryCode: "DE" },
  { name: "Rhineland-Palatinate", slug: "rhineland-palatinate", countryCode: "DE" },
  { name: "Thuringia", slug: "thuringia", countryCode: "DE" },
  { name: "Brandenburg", slug: "brandenburg", countryCode: "DE" },
  { name: "Schleswig-Holstein", slug: "schleswig-holstein", countryCode: "DE" },
  { name: "Mecklenburg-Vorpommern", slug: "mecklenburg-vorpommern", countryCode: "DE" },
  { name: "Saarland", slug: "saarland", countryCode: "DE" },
  { name: "Bremen", slug: "bremen", countryCode: "DE" },
  { name: "Saxony-Anhalt", slug: "saxony-anhalt", countryCode: "DE" },

  // === France (13 metropolitan regions) ===
  { name: "Ile-de-France", slug: "ile-de-france", countryCode: "FR" },
  { name: "Provence-Alpes-Cote d'Azur", slug: "provence-alpes-cote-dazur", countryCode: "FR" },
  { name: "Auvergne-Rhone-Alpes", slug: "auvergne-rhone-alpes", countryCode: "FR" },
  { name: "Nouvelle-Aquitaine", slug: "nouvelle-aquitaine", countryCode: "FR" },
  { name: "Occitanie", slug: "occitanie", countryCode: "FR" },
  { name: "Hauts-de-France", slug: "hauts-de-france", countryCode: "FR" },
  { name: "Grand Est", slug: "grand-est", countryCode: "FR" },
  { name: "Brittany", slug: "brittany", countryCode: "FR" },
  { name: "Normandy", slug: "normandy", countryCode: "FR" },
  { name: "Pays de la Loire", slug: "pays-de-la-loire", countryCode: "FR" },
  { name: "Bourgogne-Franche-Comte", slug: "bourgogne-franche-comte", countryCode: "FR" },
  { name: "Centre-Val de Loire", slug: "centre-val-de-loire", countryCode: "FR" },
  { name: "Corsica", slug: "corsica", countryCode: "FR" },

  // === Spain (17 autonomous communities) ===
  { name: "Madrid", slug: "madrid", countryCode: "ES" },
  { name: "Catalonia", slug: "catalonia", countryCode: "ES" },
  { name: "Andalusia", slug: "andalusia", countryCode: "ES" },
  { name: "Valencia", slug: "valencia", countryCode: "ES" },
  { name: "Basque Country", slug: "basque-country", countryCode: "ES" },
  { name: "Galicia", slug: "galicia", countryCode: "ES" },
  { name: "Canary Islands", slug: "canary-islands", countryCode: "ES" },
  { name: "Balearic Islands", slug: "balearic-islands", countryCode: "ES" },
  { name: "Castilla-La Mancha", slug: "castilla-la-mancha", countryCode: "ES" },
  { name: "Castilla y Leon", slug: "castilla-y-leon", countryCode: "ES" },
  { name: "Aragon", slug: "aragon", countryCode: "ES" },
  { name: "Murcia", slug: "murcia", countryCode: "ES" },
  { name: "Navarre", slug: "navarre", countryCode: "ES" },
  { name: "Asturias", slug: "asturias", countryCode: "ES" },
  { name: "Extremadura", slug: "extremadura", countryCode: "ES" },
  { name: "Cantabria", slug: "cantabria", countryCode: "ES" },
  { name: "La Rioja", slug: "la-rioja", countryCode: "ES" },

  // === Italy (20 regions) ===
  { name: "Lombardy", slug: "lombardy", countryCode: "IT" },
  { name: "Lazio", slug: "lazio", countryCode: "IT" },
  { name: "Campania", slug: "campania", countryCode: "IT" },
  { name: "Veneto", slug: "veneto", countryCode: "IT" },
  { name: "Emilia-Romagna", slug: "emilia-romagna", countryCode: "IT" },
  { name: "Piedmont", slug: "piedmont", countryCode: "IT" },
  { name: "Sicily", slug: "sicily", countryCode: "IT" },
  { name: "Tuscany", slug: "tuscany", countryCode: "IT" },
  { name: "Apulia", slug: "apulia", countryCode: "IT" },
  { name: "Liguria", slug: "liguria", countryCode: "IT" },
  { name: "Sardinia", slug: "sardinia", countryCode: "IT" },
  { name: "Piedmont", slug: "piedmont", countryCode: "IT" },

  // === Brazil (27 states - major ones) ===
  { name: "Sao Paulo", slug: "sao-paulo", countryCode: "BR" },
  { name: "Rio de Janeiro", slug: "rio-de-janeiro", countryCode: "BR" },
  { name: "Minas Gerais", slug: "minas-gerais", countryCode: "BR" },
  { name: "Bahia", slug: "bahia", countryCode: "BR" },
  { name: "Parana", slug: "parana", countryCode: "BR" },
  { name: "Rio Grande do Sul", slug: "rio-grande-do-sul", countryCode: "BR" },
  { name: "Pernambuco", slug: "pernambuco", countryCode: "BR" },
  { name: "Ceara", slug: "ceara", countryCode: "BR" },
  { name: "Federal District", slug: "federal-district", countryCode: "BR" },
  { name: "Amazonas", slug: "amazonas", countryCode: "BR" },
  { name: "Goias", slug: "goias", countryCode: "BR" },
  { name: "Santa Catarina", slug: "santa-catarina", countryCode: "BR" },

  // === Japan (47 prefectures - major ones) ===
  { name: "Tokyo", slug: "tokyo", countryCode: "JP" },
  { name: "Osaka", slug: "osaka", countryCode: "JP" },
  { name: "Hokkaido", slug: "hokkaido", countryCode: "JP" },
  { name: "Kyoto", slug: "kyoto", countryCode: "JP" },
  { name: "Kanagawa", slug: "kanagawa", countryCode: "JP" },
  { name: "Aichi", slug: "aichi", countryCode: "JP" },
  { name: "Fukuoka", slug: "fukuoka", countryCode: "JP" },
  { name: "Hyogo", slug: "hyogo", countryCode: "JP" },
  { name: "Chiba", slug: "chiba", countryCode: "JP" },
  { name: "Saitama", slug: "saitama", countryCode: "JP" },
  { name: "Okinawa", slug: "okinawa", countryCode: "JP" },

  // === South Korea ===
  { name: "Seoul", slug: "seoul", countryCode: "KR" },
  { name: "Busan", slug: "busan", countryCode: "KR" },
  { name: "Incheon", slug: "incheon", countryCode: "KR" },
  { name: "Daegu", slug: "daegu", countryCode: "KR" },
  { name: "Gyeonggi", slug: "gyeonggi", countryCode: "KR" },
  { name: "Gyeongsangnam-do", slug: "gyeongsangnam-do", countryCode: "KR" },
  { name: "Jeju", slug: "jeju", countryCode: "KR" },

  // === Mexico (32 states - major ones) ===
  { name: "Mexico City", slug: "mexico-city", countryCode: "MX" },
  { name: "Jalisco", slug: "jalisco", countryCode: "MX" },
  { name: "Nuevo Leon", slug: "nuevo-leon", countryCode: "MX" },
  { name: "Puebla", slug: "puebla", countryCode: "MX" },
  { name: "Guerrero", slug: "guerrero", countryCode: "MX" },
  { name: "Quintana Roo", slug: "quintana-roo", countryCode: "MX" },
  { name: "Yucatan", slug: "yucatan", countryCode: "MX" },
  { name: "Baja California", slug: "baja-california", countryCode: "MX" },
  { name: "Chihuahua", slug: "chihuahua", countryCode: "MX" },
  { name: "Sonora", slug: "sonora", countryCode: "MX" },

  // === Argentina (23 provinces - major ones) ===
  { name: "Buenos Aires", slug: "buenos-aires", countryCode: "AR" },
  { name: "Ciudad Autonoma de Buenos Aires", slug: "ciudad-buenos-aires", countryCode: "AR" },
  { name: "Cordoba", slug: "cordoba", countryCode: "AR" },
  { name: "Santa Fe", slug: "santa-fe", countryCode: "AR" },
  { name: "Mendoza", slug: "mendoza", countryCode: "AR" },
  { name: "Tucuman", slug: "tucuman", countryCode: "AR" },

  // === UAE (7 Emirates) ===
  { name: "Dubai", slug: "dubai", countryCode: "AE" },
  { name: "Abu Dhabi", slug: "abu-dhabi", countryCode: "AE" },
  { name: "Sharjah", slug: "sharjah", countryCode: "AE" },
  { name: "Ajman", slug: "ajman", countryCode: "AE" },
  { name: "Ras Al Khaimah", slug: "ras-al-khaimah", countryCode: "AE" },
  { name: "Fujairah", slug: "fujairah", countryCode: "AE" },
  { name: "Umm Al Quwain", slug: "umm-al-quwain", countryCode: "AE" },

  // === Saudi Arabia (13 provinces - major ones) ===
  { name: "Riyadh", slug: "riyadh", countryCode: "SA" },
  { name: "Makkah", slug: "makkah", countryCode: "SA" },
  { name: "Madinah", slug: "madinah", countryCode: "SA" },
  { name: "Eastern Province", slug: "eastern-province", countryCode: "SA" },
  { name: "Asir", slug: "asir", countryCode: "SA" },
  { name: "Tabuk", slug: "tabuk", countryCode: "SA" },
  { name: "Jizan", slug: "jizan", countryCode: "SA" },

  // === South Africa (9 provinces) ===
  { name: "Gauteng", slug: "gauteng", countryCode: "ZA" },
  { name: "Western Cape", slug: "western-cape", countryCode: "ZA" },
  { name: "KwaZulu-Natal", slug: "kwazulu-natal", countryCode: "ZA" },
  { name: "Eastern Cape", slug: "eastern-cape", countryCode: "ZA" },
  { name: "Free State", slug: "free-state", countryCode: "ZA" },
  { name: "Limpopo", slug: "limpopo", countryCode: "ZA" },
  { name: "Mpumalanga", slug: "mpumalanga", countryCode: "ZA" },
  { name: "North West", slug: "north-west", countryCode: "ZA" },
  { name: "Northern Cape", slug: "northern-cape", countryCode: "ZA" },

  // === Thailand (76 provinces - major ones) ===
  { name: "Bangkok", slug: "bangkok", countryCode: "TH" },
  { name: "Chiang Mai", slug: "chiang-mai", countryCode: "TH" },
  { name: "Phuket", slug: "phuket", countryCode: "TH" },
  { name: "Chonburi", slug: "chonburi", countryCode: "TH" },
  { name: "Surat Thani", slug: "surat-thani", countryCode: "TH" },
  { name: "Krabi", slug: "krabi", countryCode: "TH" },
  { name: "Chiang Rai", slug: "chiang-rai", countryCode: "TH" },

  // === Netherlands (12 provinces - major ones) ===
  { name: "North Holland", slug: "north-holland", countryCode: "NL" },
  { name: "South Holland", slug: "south-holland", countryCode: "NL" },
  { name: "Utrecht", slug: "utrecht", countryCode: "NL" },
  { name: "North Brabant", slug: "north-brabant", countryCode: "NL" },
  { name: "Gelderland", slug: "gelderland", countryCode: "NL" },
  { name: "Limburg", slug: "limburg", countryCode: "NL" },

  // === China (major provinces/municipalities) ===
  { name: "Beijing", slug: "beijing", countryCode: "CN" },
  { name: "Shanghai", slug: "shanghai", countryCode: "CN" },
  { name: "Guangdong", slug: "guangdong", countryCode: "CN" },
  { name: "Zhejiang", slug: "zhejiang", countryCode: "CN" },
  { name: "Jiangsu", slug: "jiangsu", countryCode: "CN" },
  { name: "Sichuan", slug: "sichuan", countryCode: "CN" },
  { name: "Hubei", slug: "hubei", countryCode: "CN" },
  { name: "Fujian", slug: "fujian", countryCode: "CN" },

  // === Malaysia (13 states - major ones) ===
  { name: "Kuala Lumpur", slug: "kuala-lumpur", countryCode: "MY" },
  { name: "Selangor", slug: "selangor", countryCode: "MY" },
  { name: "Penang", slug: "penang", countryCode: "MY" },
  { name: "Johor", slug: "johor", countryCode: "MY" },
  { name: "Sabah", slug: "sabah", countryCode: "MY" },
  { name: "Sarawak", slug: "sarawak", countryCode: "MY" },
  { name: "Malacca", slug: "malacca", countryCode: "MY" },

  // === Indonesia (major provinces) ===
  { name: "DKI Jakarta", slug: "dki-jakarta", countryCode: "ID" },
  { name: "West Java", slug: "west-java", countryCode: "ID" },
  { name: "East Java", slug: "east-java", countryCode: "ID" },
  { name: "Bali", slug: "bali", countryCode: "ID" },
  { name: "Central Java", slug: "central-java", countryCode: "ID" },
  { name: "North Sumatra", slug: "north-sumatra", countryCode: "ID" },
  { name: "South Sulawesi", slug: "south-sulawesi", countryCode: "ID" },

  // === Philippines (major regions) ===
  { name: "Metro Manila", slug: "metro-manila", countryCode: "PH" },
  { name: "Cebu", slug: "cebu", countryCode: "PH" },
  { name: "Davao", slug: "davao", countryCode: "PH" },
  { name: "Central Visayas", slug: "central-visayas", countryCode: "PH" },

  // === Vietnam ===
  { name: "Ho Chi Minh City", slug: "ho-chi-minh-city", countryCode: "VN" },
  { name: "Hanoi", slug: "hanoi", countryCode: "VN" },
  { name: "Da Nang", slug: "da-nang", countryCode: "VN" },
  { name: "Haiphong", slug: "haiphong", countryCode: "VN" },

  // === Colombia ===
  { name: "Bogota", slug: "bogota", countryCode: "CO" },
  { name: "Antioquia", slug: "antioquia", countryCode: "CO" },
  { name: "Valle del Cauca", slug: "valle-del-cauca", countryCode: "CO" },
  { name: "Atlantico", slug: "atlantico", countryCode: "CO" },
  { name: "Santander", slug: "santander", countryCode: "CO" },

  // === Egypt ===
  { name: "Cairo", slug: "cairo", countryCode: "EG" },
  { name: "Alexandria", slug: "alexandria", countryCode: "EG" },
  { name: "Giza", slug: "giza", countryCode: "EG" },
  { name: "Luxor", slug: "luxor", countryCode: "EG" },
  { name: "Aswan", slug: "aswan", countryCode: "EG" },
  { name: "Red Sea", slug: "red-sea", countryCode: "EG" },

  // === Nigeria ===
  { name: "Lagos", slug: "lagos", countryCode: "NG" },
  { name: "Abuja", slug: "abuja", countryCode: "NG" },
  { name: "Kano", slug: "kano", countryCode: "NG" },
  { name: "Rivers", slug: "rivers", countryCode: "NG" },
  { name: "Oyo", slug: "oyo", countryCode: "NG" },

  // === Kenya ===
  { name: "Nairobi", slug: "nairobi", countryCode: "KE" },
  { name: "Mombasa", slug: "mombasa", countryCode: "KE" },
  { name: "Kisumu", slug: "kisumu", countryCode: "KE" },
  { name: "Nakuru", slug: "nakuru", countryCode: "KE" },

  // === Switzerland ===
  { name: "Zurich", slug: "zurich", countryCode: "CH" },
  { name: "Geneva", slug: "geneva", countryCode: "CH" },
  { name: "Bern", slug: "bern", countryCode: "CH" },
  { name: "Basel", slug: "basel", countryCode: "CH" },
  { name: "Vaud", slug: "vaud", countryCode: "CH" },

  // === Austria ===
  { name: "Vienna", slug: "vienna", countryCode: "AT" },
  { name: "Salzburg", slug: "salzburg", countryCode: "AT" },
  { name: "Tyrol", slug: "tyrol", countryCode: "AT" },
  { name: "Styria", slug: "styria", countryCode: "AT" },

  // === Poland ===
  { name: "Masovia", slug: "masovia", countryCode: "PL" },
  { name: "Lesser Poland", slug: "lesser-poland", countryCode: "PL" },
  { name: "Silesia", slug: "silesia", countryCode: "PL" },
  { name: "Greater Poland", slug: "greater-poland", countryCode: "PL" },
  { name: "Pomerania", slug: "pomerania", countryCode: "PL" },

  // === New Zealand ===
  { name: "Auckland", slug: "auckland", countryCode: "NZ" },
  { name: "Wellington", slug: "wellington", countryCode: "NZ" },
  { name: "Canterbury", slug: "canterbury", countryCode: "NZ" },
  { name: "Waikato", slug: "waikato", countryCode: "NZ" },
  { name: "Bay of Plenty", slug: "bay-of-plenty", countryCode: "NZ" },

  // === South Korea (additional) ===
  { name: "Daejeon", slug: "daejeon", countryCode: "KR" },

  // === Ukraine ===
  { name: "Kyiv", slug: "kyiv", countryCode: "UA" },
  { name: "Odesa", slug: "odesa", countryCode: "UA" },
  { name: "Lviv", slug: "lviv", countryCode: "UA" },
  { name: "Kharkiv", slug: "kharkiv", countryCode: "UA" },

  // === Russia ===
  { name: "Moscow", slug: "moscow", countryCode: "RU" },
  { name: "Saint Petersburg", slug: "saint-petersburg", countryCode: "RU" },
  { name: "Novosibirsk Oblast", slug: "novosibirsk-oblast", countryCode: "RU" },
  { name: "Sverdlovsk Oblast", slug: "sverdlovsk-oblast", countryCode: "RU" },
  { name: "Krasnodar Krai", slug: "krasnodar-krai", countryCode: "RU" },

  // === Turkey ===
  { name: "Istanbul", slug: "istanbul", countryCode: "TR" },
  { name: "Ankara", slug: "ankara", countryCode: "TR" },
  { name: "Izmir", slug: "izmir", countryCode: "TR" },
  { name: "Antalya", slug: "antalya", countryCode: "TR" },
  { name: "Bursa", slug: "bursa", countryCode: "TR" },

  // === Portugal ===
  { name: "Lisbon", slug: "lisbon", countryCode: "PT" },
  { name: "Porto", slug: "porto", countryCode: "PT" },
  { name: "Algarve", slug: "algarve", countryCode: "PT" },
  { name: "Madeira", slug: "madeira", countryCode: "PT" },

  // === Greece ===
  { name: "Attica", slug: "attica", countryCode: "GR" },
  { name: "Central Macedonia", slug: "central-macedonia", countryCode: "GR" },
  { name: "Crete", slug: "crete", countryCode: "GR" },
  { name: "South Aegean", slug: "south-aegean", countryCode: "GR" },

  // === Sweden ===
  { name: "Stockholm", slug: "stockholm", countryCode: "SE" },
  { name: "Vastra Gotaland", slug: "vastra-gotaland", countryCode: "SE" },
  { name: "Skane", slug: "skane", countryCode: "SE" },

  // === Norway ===
  { name: "Oslo", slug: "oslo", countryCode: "NO" },
  { name: "Hordaland", slug: "hordaland", countryCode: "NO" },
  { name: "Rogaland", slug: "rogaland", countryCode: "NO" },

  // === Denmark ===
  { name: "Capital Region", slug: "capital-region", countryCode: "DK" },
  { name: "Central Denmark", slug: "central-denmark", countryCode: "DK" },
  { name: "South Denmark", slug: "south-denmark", countryCode: "DK" },

  // === Finland ===
  { name: "Uusimaa", slug: "uusimaa", countryCode: "FI" },
  { name: "Pirkanmaa", slug: "pirkanmaa", countryCode: "FI" },
  { name: "Southwest Finland", slug: "southwest-finland", countryCode: "FI" },

  // === Ireland ===
  { name: "Leinster", slug: "leinster", countryCode: "IE" },
  { name: "Munster", slug: "munster", countryCode: "IE" },
  { name: "Connacht", slug: "connacht", countryCode: "IE" },
  { name: "Ulster", slug: "ulster", countryCode: "IE" },

  // === Czech Republic ===
  { name: "Prague", slug: "prague", countryCode: "CZ" },
  { name: "Central Bohemia", slug: "central-bohemia", countryCode: "CZ" },
  { name: "South Moravia", slug: "south-moravia", countryCode: "CZ" },

  // === Belgium ===
  { name: "Brussels-Capital", slug: "brussels-capital", countryCode: "BE" },
  { name: "Flanders", slug: "flanders", countryCode: "BE" },
  { name: "Wallonia", slug: "wallonia", countryCode: "BE" },

  // === Romania ===
  { name: "Bucharest", slug: "bucharest", countryCode: "RO" },
  { name: "Transylvania", slug: "transylvania", countryCode: "RO" },
  { name: "Muntenia", slug: "muntenia", countryCode: "RO" },

  // === Hungary ===
  { name: "Budapest", slug: "budapest", countryCode: "HU" },
  { name: "Pest County", slug: "pest-county", countryCode: "HU" },
  { name: "Fejer", slug: "fejer", countryCode: "HU" },

  // === Singapore ===
  { name: "Central Region", slug: "central-region", countryCode: "SG" },

  // === Qatar ===
  { name: "Doha", slug: "doha", countryCode: "QA" },
  { name: "Al Rayyan", slug: "al-rayyan", countryCode: "QA" },

  // === Kuwait ===
  { name: "Al Asimah", slug: "al-asimah", countryCode: "KW" },
  { name: "Hawalli", slug: "hawalli", countryCode: "KW" },
  { name: "Farwaniya", slug: "farwaniya", countryCode: "KW" },

  // === Bahrain ===
  { name: "Capital Governorate", slug: "capital-governorate", countryCode: "BH" },
  { name: "Southern Governorate", slug: "southern-governorate", countryCode: "BH" },

  // === Oman ===
  { name: "Muscat", slug: "muscat", countryCode: "OM" },
  { name: "Dhofar", slug: "dhofar", countryCode: "OM" },

  // === Jordan ===
  { name: "Amman", slug: "amman", countryCode: "JO" },
  { name: "Aqaba", slug: "aqaba", countryCode: "JO" },
  { name: "Irbid", slug: "irbid", countryCode: "JO" },

  // === Lebanon ===
  { name: "Beirut", slug: "beirut", countryCode: "LB" },
  { name: "Mount Lebanon", slug: "mount-lebanon", countryCode: "LB" },

  // === Israel ===
  { name: "Tel Aviv", slug: "tel-aviv", countryCode: "IL" },
  { name: "Jerusalem", slug: "jerusalem", countryCode: "IL" },
  { name: "Haifa", slug: "haifa", countryCode: "IL" },

  // === Morocco ===
  { name: "Casablanca-Settat", slug: "casablanca-settat", countryCode: "MA" },
  { name: "Marrakech-Safi", slug: "marrakech-safi", countryCode: "MA" },
  { name: "Tanger-Tetouan-Al Hoceima", slug: "tanger-tetouan", countryCode: "MA" },
  { name: "Fes-Meknes", slug: "fes-meknes", countryCode: "MA" },

  // === Tanzania ===
  { name: "Dar es Salaam", slug: "dar-es-salaam", countryCode: "TZ" },
  { name: "Dodoma", slug: "dodoma", countryCode: "TZ" },
  { name: "Arusha", slug: "arusha", countryCode: "TZ" },

  // === Ghana ===
  { name: "Greater Accra", slug: "greater-accra", countryCode: "GH" },
  { name: "Ashanti", slug: "ashanti", countryCode: "GH" },

  // === Ethiopia ===
  { name: "Addis Ababa", slug: "addis-ababa", countryCode: "ET" },
  { name: "Oromia", slug: "oromia", countryCode: "ET" },

  // === Tunisia ===
  { name: "Tunis", slug: "tunis", countryCode: "TN" },
  { name: "Sfax", slug: "sfax", countryCode: "TN" },

  // === Algeria ===
  { name: "Algiers", slug: "algiers", countryCode: "DZ" },
  { name: "Oran", slug: "oran", countryCode: "DZ" },

  // === Peru ===
  { name: "Lima", slug: "lima", countryCode: "PE" },
  { name: "Cusco", slug: "cusco", countryCode: "PE" },
  { name: "Arequipa", slug: "arequipa", countryCode: "PE" },

  // === Chile ===
  { name: "Santiago Metropolitan", slug: "santiago-metropolitan", countryCode: "CL" },
  { name: "Valparaiso", slug: "valparaiso", countryCode: "CL" },
  { name: "Biobio", slug: "biobio", countryCode: "CL" },

  // === Venezuela ===
  { name: "Distrito Capital", slug: "distrito-capital", countryCode: "VE" },
  { name: "Miranda", slug: "miranda", countryCode: "VE" },
  { name: "Zulia", slug: "zulia", countryCode: "VE" },

  // === Ecuador ===
  { name: "Pichincha", slug: "pichincha", countryCode: "EC" },
  { name: "Guayas", slug: "guayas", countryCode: "EC" },

  // === Taiwan ===
  { name: "Taipei", slug: "taipei", countryCode: "TW" },
  { name: "Kaohsiung", slug: "kaohsiung", countryCode: "TW" },
  { name: "Taichung", slug: "taichung", countryCode: "TW" },

  // === Hong Kong ===
  { name: "Hong Kong Island", slug: "hong-kong-island", countryCode: "HK" },
  { name: "Kowloon", slug: "kowloon", countryCode: "HK" },
  { name: "New Territories", slug: "new-territories", countryCode: "HK" },

  // === Pakistan ===
  { name: "Sindh", slug: "sindh", countryCode: "PK" },
  { name: "Punjab", slug: "punjab", countryCode: "PK" },
  { name: "Khyber Pakhtunkhwa", slug: "khyber-pakhtunkhwa", countryCode: "PK" },
  { name: "Islamabad Capital Territory", slug: "islamabad", countryCode: "PK" },

  // === Bangladesh ===
  { name: "Dhaka Division", slug: "dhaka-division", countryCode: "BD" },
  { name: "Chittagong Division", slug: "chittagong-division", countryCode: "BD" },
  { name: "Sylhet Division", slug: "sylhet-division", countryCode: "BD" },

  // === Sri Lanka ===
  { name: "Western Province", slug: "western-province", countryCode: "LK" },
  { name: "Central Province", slug: "central-province", countryCode: "LK" },
  { name: "Southern Province", slug: "southern-province", countryCode: "LK" },

  // === Nepal ===
  { name: "Bagmati", slug: "bagmati", countryCode: "NP" },
  { name: "Gandaki", slug: "gandaki", countryCode: "NP" },
  { name: "Lumbini", slug: "lumbini", countryCode: "NP" },

  // === Myanmar ===
  { name: "Yangon", slug: "yangon", countryCode: "MM" },
  { name: "Mandalay", slug: "mandalay", countryCode: "MM" },
  { name: "Shan State", slug: "shan-state", countryCode: "MM" },

  // === Cambodia ===
  { name: "Phnom Penh", slug: "phnom-penh", countryCode: "KH" },
  { name: "Siem Reap", slug: "siem-reap", countryCode: "KH" },

  // === Bulgaria ===
  { name: "Sofia City", slug: "sofia-city", countryCode: "BG" },
  { name: "Varna", slug: "varna", countryCode: "BG" },
  { name: "Plovdiv", slug: "plovdiv", countryCode: "BG" },

  // === Serbia ===
  { name: "Belgrade", slug: "belgrade", countryCode: "RS" },
  { name: "Vojvodina", slug: "vojvodina", countryCode: "RS" },

  // === Slovakia ===
  { name: "Bratislava", slug: "bratislava", countryCode: "SK" },
  { name: "Kosice", slug: "kosice", countryCode: "SK" },

  // === Croatia ===
  { name: "Zagreb", slug: "zagreb", countryCode: "HR" },
  { name: "Split-Dalmatia", slug: "split-dalmatia", countryCode: "HR" },
  { name: "Istria", slug: "istria", countryCode: "HR" },
];

// ==========================================
// Cities (Top 100+ US cities, international cities)
// ==========================================
export const worldCities: CityData[] = [
  // ============================================
  // UNITED STATES - Top 100 Cities
  // ============================================
  { name: "New York City", slug: "new-york-city", stateSlug: "new-york", countryCode: "US", isFeatured: true },
  { name: "Los Angeles", slug: "los-angeles", stateSlug: "california", countryCode: "US", isFeatured: true },
  { name: "Chicago", slug: "chicago", stateSlug: "illinois", countryCode: "US", isFeatured: true },
  { name: "Houston", slug: "houston", stateSlug: "texas", countryCode: "US", isFeatured: true },
  { name: "Phoenix", slug: "phoenix", stateSlug: "arizona", countryCode: "US", isFeatured: true },
  { name: "Philadelphia", slug: "philadelphia", stateSlug: "pennsylvania", countryCode: "US", isFeatured: true },
  { name: "San Antonio", slug: "san-antonio", stateSlug: "texas", countryCode: "US", isFeatured: true },
  { name: "San Diego", slug: "san-diego", stateSlug: "california", countryCode: "US", isFeatured: true },
  { name: "Dallas", slug: "dallas", stateSlug: "texas", countryCode: "US", isFeatured: true },
  { name: "San Jose", slug: "san-jose", stateSlug: "california", countryCode: "US", isFeatured: true },
  { name: "Austin", slug: "austin", stateSlug: "texas", countryCode: "US", isFeatured: true },
  { name: "Jacksonville", slug: "jacksonville", stateSlug: "florida", countryCode: "US" },
  { name: "Fort Worth", slug: "fort-worth", stateSlug: "texas", countryCode: "US" },
  { name: "Columbus", slug: "columbus", stateSlug: "ohio", countryCode: "US" },
  { name: "Charlotte", slug: "charlotte", stateSlug: "north-carolina", countryCode: "US" },
  { name: "San Francisco", slug: "san-francisco", stateSlug: "california", countryCode: "US", isFeatured: true },
  { name: "Indianapolis", slug: "indianapolis", stateSlug: "indiana", countryCode: "US" },
  { name: "Seattle", slug: "seattle", stateSlug: "washington", countryCode: "US", isFeatured: true },
  { name: "Denver", slug: "denver", stateSlug: "colorado", countryCode: "US", isFeatured: true },
  { name: "Washington", slug: "washington", stateSlug: "district-of-columbia", countryCode: "US", isFeatured: true },
  { name: "Boston", slug: "boston", stateSlug: "massachusetts", countryCode: "US", isFeatured: true },
  { name: "El Paso", slug: "el-paso", stateSlug: "texas", countryCode: "US" },
  { name: "Nashville", slug: "nashville", stateSlug: "tennessee", countryCode: "US" },
  { name: "Detroit", slug: "detroit", stateSlug: "michigan", countryCode: "US" },
  { name: "Oklahoma City", slug: "oklahoma-city", stateSlug: "oklahoma", countryCode: "US" },
  { name: "Portland", slug: "portland", stateSlug: "oregon", countryCode: "US" },
  { name: "Las Vegas", slug: "las-vegas", stateSlug: "nevada", countryCode: "US", isFeatured: true },
  { name: "Memphis", slug: "memphis", stateSlug: "tennessee", countryCode: "US" },
  { name: "Louisville", slug: "louisville", stateSlug: "kentucky", countryCode: "US" },
  { name: "Baltimore", slug: "baltimore", stateSlug: "maryland", countryCode: "US" },
  { name: "Milwaukee", slug: "milwaukee", stateSlug: "wisconsin", countryCode: "US" },
  { name: "Albuquerque", slug: "albuquerque", stateSlug: "new-mexico", countryCode: "US" },
  { name: "Tucson", slug: "tucson", stateSlug: "arizona", countryCode: "US" },
  { name: "Fresno", slug: "fresno", stateSlug: "california", countryCode: "US" },
  { name: "Sacramento", slug: "sacramento", stateSlug: "california", countryCode: "US" },
  { name: "Mesa", slug: "mesa", stateSlug: "arizona", countryCode: "US" },
  { name: "Atlanta", slug: "atlanta", stateSlug: "georgia", countryCode: "US", isFeatured: true },
  { name: "Kansas City", slug: "kansas-city", stateSlug: "missouri", countryCode: "US" },
  { name: "Colorado Springs", slug: "colorado-springs", stateSlug: "colorado", countryCode: "US" },
  { name: "Raleigh", slug: "raleigh", stateSlug: "north-carolina", countryCode: "US" },
  { name: "Omaha", slug: "omaha", stateSlug: "nebraska", countryCode: "US" },
  { name: "Miami", slug: "miami", stateSlug: "florida", countryCode: "US", isFeatured: true },
  { name: "Long Beach", slug: "long-beach", stateSlug: "california", countryCode: "US" },
  { name: "Virginia Beach", slug: "virginia-beach", stateSlug: "virginia", countryCode: "US" },
  { name: "Oakland", slug: "oakland", stateSlug: "california", countryCode: "US" },
  { name: "Minneapolis", slug: "minneapolis", stateSlug: "minnesota", countryCode: "US" },
  { name: "Tulsa", slug: "tulsa", stateSlug: "oklahoma", countryCode: "US" },
  { name: "Arlington", slug: "arlington", stateSlug: "texas", countryCode: "US" },
  { name: "Tampa", slug: "tampa", stateSlug: "florida", countryCode: "US" },
  { name: "New Orleans", slug: "new-orleans", stateSlug: "louisiana", countryCode: "US" },
  { name: "Wichita", slug: "wichita", stateSlug: "kansas", countryCode: "US" },
  { name: "Cleveland", slug: "cleveland", stateSlug: "ohio", countryCode: "US" },
  { name: "Bakersfield", slug: "bakersfield", stateSlug: "california", countryCode: "US" },
  { name: "Aurora", slug: "aurora", stateSlug: "colorado", countryCode: "US" },
  { name: "Anaheim", slug: "anaheim", stateSlug: "california", countryCode: "US" },
  { name: "Honolulu", slug: "honolulu", stateSlug: "hawaii", countryCode: "US" },
  { name: "Santa Ana", slug: "santa-ana", stateSlug: "california", countryCode: "US" },
  { name: "Corpus Christi", slug: "corpus-christi", stateSlug: "texas", countryCode: "US" },
  { name: "Riverside", slug: "riverside", stateSlug: "california", countryCode: "US" },
  { name: "St. Louis", slug: "st-louis", stateSlug: "missouri", countryCode: "US" },
  { name: "Lexington", slug: "lexington", stateSlug: "kentucky", countryCode: "US" },
  { name: "Stockton", slug: "stockton", stateSlug: "california", countryCode: "US" },
  { name: "Pittsburgh", slug: "pittsburgh", stateSlug: "pennsylvania", countryCode: "US" },
  { name: "Saint Paul", slug: "saint-paul", stateSlug: "minnesota", countryCode: "US" },
  { name: "Anchorage", slug: "anchorage", stateSlug: "alaska", countryCode: "US" },
  { name: "Cincinnati", slug: "cincinnati", stateSlug: "ohio", countryCode: "US" },
  { name: "Henderson", slug: "henderson", stateSlug: "nevada", countryCode: "US" },
  { name: "Greensboro", slug: "greensboro", stateSlug: "north-carolina", countryCode: "US" },
  { name: "Plano", slug: "plano", stateSlug: "texas", countryCode: "US" },
  { name: "Newark", slug: "newark", stateSlug: "new-jersey", countryCode: "US" },
  { name: "Toledo", slug: "toledo", stateSlug: "ohio", countryCode: "US" },
  { name: "Lincoln", slug: "lincoln", stateSlug: "nebraska", countryCode: "US" },
  { name: "Orlando", slug: "orlando", stateSlug: "florida", countryCode: "US" },
  { name: "Chula Vista", slug: "chula-vista", stateSlug: "california", countryCode: "US" },
  { name: "Jersey City", slug: "jersey-city", stateSlug: "new-jersey", countryCode: "US" },
  { name: "Chandler", slug: "chandler", stateSlug: "arizona", countryCode: "US" },
  { name: "Fort Wayne", slug: "fort-wayne", stateSlug: "indiana", countryCode: "US" },
  { name: "Buffalo", slug: "buffalo", stateSlug: "new-york", countryCode: "US" },
  { name: "Durham", slug: "durham", stateSlug: "north-carolina", countryCode: "US" },
  { name: "St. Petersburg", slug: "st-petersburg", stateSlug: "florida", countryCode: "US" },
  { name: "Irvine", slug: "irvine", stateSlug: "california", countryCode: "US" },
  { name: "Laredo", slug: "laredo", stateSlug: "texas", countryCode: "US" },
  { name: "Lubbock", slug: "lubbock", stateSlug: "texas", countryCode: "US" },
  { name: "Madison", slug: "madison", stateSlug: "wisconsin", countryCode: "US" },
  { name: "Gilbert", slug: "gilbert", stateSlug: "arizona", countryCode: "US" },
  { name: "Norfolk", slug: "norfolk", stateSlug: "virginia", countryCode: "US" },
  { name: "Reno", slug: "reno", stateSlug: "nevada", countryCode: "US" },
  { name: "Winston-Salem", slug: "winston-salem", stateSlug: "north-carolina", countryCode: "US" },
  { name: "Glendale", slug: "glendale", stateSlug: "arizona", countryCode: "US" },
  { name: "Hialeah", slug: "hialeah", stateSlug: "florida", countryCode: "US" },
  { name: "Garland", slug: "garland", stateSlug: "texas", countryCode: "US" },
  { name: "Scottsdale", slug: "scottsdale", stateSlug: "arizona", countryCode: "US" },
  { name: "Irving", slug: "irving", stateSlug: "texas", countryCode: "US" },
  { name: "Chesapeake", slug: "chesapeake", stateSlug: "virginia", countryCode: "US" },
  { name: "North Las Vegas", slug: "north-las-vegas", stateSlug: "nevada", countryCode: "US" },
  { name: "Fremont", slug: "fremont", stateSlug: "california", countryCode: "US" },
  { name: "Baton Rouge", slug: "baton-rouge", stateSlug: "louisiana", countryCode: "US" },
  { name: "Richmond", slug: "richmond", stateSlug: "virginia", countryCode: "US" },
  { name: "Boise", slug: "boise", stateSlug: "idaho", countryCode: "US" },
  { name: "San Bernardino", slug: "san-bernardino", stateSlug: "california", countryCode: "US" },

  // ============================================
  // CANADA - Major Cities
  // ============================================
  { name: "Toronto", slug: "toronto", stateSlug: "ontario", countryCode: "CA", isFeatured: true },
  { name: "Montreal", slug: "montreal", stateSlug: "quebec", countryCode: "CA", isFeatured: true },
  { name: "Vancouver", slug: "vancouver", stateSlug: "british-columbia", countryCode: "CA", isFeatured: true },
  { name: "Calgary", slug: "calgary", stateSlug: "alberta", countryCode: "CA", isFeatured: true },
  { name: "Edmonton", slug: "edmonton", stateSlug: "alberta", countryCode: "CA", isFeatured: true },
  { name: "Ottawa", slug: "ottawa", stateSlug: "ontario", countryCode: "CA", isFeatured: true },
  { name: "Winnipeg", slug: "winnipeg", stateSlug: "manitoba", countryCode: "CA" },
  { name: "Quebec City", slug: "quebec-city", stateSlug: "quebec", countryCode: "CA" },
  { name: "Hamilton", slug: "hamilton", stateSlug: "ontario", countryCode: "CA" },
  { name: "Halifax", slug: "halifax", stateSlug: "nova-scotia", countryCode: "CA" },
  { name: "Victoria", slug: "victoria", stateSlug: "british-columbia", countryCode: "CA" },
  { name: "Regina", slug: "regina", stateSlug: "saskatchewan", countryCode: "CA" },
  { name: "Saskatoon", slug: "saskatoon", stateSlug: "saskatchewan", countryCode: "CA" },
  { name: "St. John's", slug: "st-johns", stateSlug: "newfoundland-labrador", countryCode: "CA" },
  { name: "Mississauga", slug: "mississauga", stateSlug: "ontario", countryCode: "CA" },
  { name: "Brampton", slug: "brampton", stateSlug: "ontario", countryCode: "CA" },
  { name: "Burnaby", slug: "burnaby", stateSlug: "british-columbia", countryCode: "CA" },
  { name: "Surrey", slug: "surrey", stateSlug: "british-columbia", countryCode: "CA" },
  { name: "Windsor", slug: "windsor", stateSlug: "ontario", countryCode: "CA" },
  { name: "London", slug: "london", stateSlug: "ontario", countryCode: "CA" },
  { name: "Kelowna", slug: "kelowna", stateSlug: "british-columbia", countryCode: "CA" },
  { name: "Oshawa", slug: "oshawa", stateSlug: "ontario", countryCode: "CA" },
  { name: "Markham", slug: "markham", stateSlug: "ontario", countryCode: "CA" },
  { name: "Vaughan", slug: "vaughan", stateSlug: "ontario", countryCode: "CA" },
  { name: "Fredericton", slug: "fredericton", stateSlug: "new-brunswick", countryCode: "CA" },
  { name: "Charlottetown", slug: "charlottetown", stateSlug: "prince-edward-island", countryCode: "CA" },
  { name: "Whitehorse", slug: "whitehorse", stateSlug: "yukon", countryCode: "CA" },
  { name: "Iqaluit", slug: "iqaluit", stateSlug: "nunavut", countryCode: "CA" },
  { name: "Yellowknife", slug: "yellowknife", stateSlug: "northwest-territories", countryCode: "CA" },
  { name: "Laval", slug: "laval", stateSlug: "quebec", countryCode: "CA" },
  { name: "Gatineau", slug: "gatineau", stateSlug: "quebec", countryCode: "CA" },
  { name: "Thunder Bay", slug: "thunder-bay", stateSlug: "ontario", countryCode: "CA" },
  { name: "Red Deer", slug: "red-deer", stateSlug: "alberta", countryCode: "CA" },
  { name: "Lethbridge", slug: "lethbridge", stateSlug: "alberta", countryCode: "CA" },

  // ============================================
  // UNITED KINGDOM - Major Cities
  // ============================================
  { name: "London", slug: "london", stateSlug: "england", countryCode: "GB", isFeatured: true },
  { name: "Birmingham", slug: "birmingham", stateSlug: "england", countryCode: "GB", isFeatured: true },
  { name: "Manchester", slug: "manchester", stateSlug: "england", countryCode: "GB", isFeatured: true },
  { name: "Leeds", slug: "leeds", stateSlug: "england", countryCode: "GB" },
  { name: "Liverpool", slug: "liverpool", stateSlug: "england", countryCode: "GB" },
  { name: "Bristol", slug: "bristol", stateSlug: "england", countryCode: "GB" },
  { name: "Sheffield", slug: "sheffield", stateSlug: "england", countryCode: "GB" },
  { name: "Nottingham", slug: "nottingham", stateSlug: "england", countryCode: "GB" },
  { name: "Newcastle upon Tyne", slug: "newcastle", stateSlug: "england", countryCode: "GB" },
  { name: "Brighton", slug: "brighton", stateSlug: "england", countryCode: "GB" },
  { name: "Oxford", slug: "oxford", stateSlug: "england", countryCode: "GB" },
  { name: "Cambridge", slug: "cambridge", stateSlug: "england", countryCode: "GB" },
  { name: "York", slug: "york", stateSlug: "england", countryCode: "GB" },
  { name: "Leicester", slug: "leicester", stateSlug: "england", countryCode: "GB" },
  { name: "Coventry", slug: "coventry", stateSlug: "england", countryCode: "GB" },
  { name: "Edinburgh", slug: "edinburgh", stateSlug: "scotland", countryCode: "GB", isFeatured: true },
  { name: "Glasgow", slug: "glasgow", stateSlug: "scotland", countryCode: "GB" },
  { name: "Aberdeen", slug: "aberdeen", stateSlug: "scotland", countryCode: "GB" },
  { name: "Dundee", slug: "dundee", stateSlug: "scotland", countryCode: "GB" },
  { name: "Inverness", slug: "inverness", stateSlug: "scotland", countryCode: "GB" },
  { name: "Cardiff", slug: "cardiff", stateSlug: "wales", countryCode: "GB" },
  { name: "Swansea", slug: "swansea", stateSlug: "wales", countryCode: "GB" },
  { name: "Newport", slug: "newport", stateSlug: "wales", countryCode: "GB" },
  { name: "Belfast", slug: "belfast", stateSlug: "northern-ireland", countryCode: "GB" },
  { name: "Derry", slug: "derry", stateSlug: "northern-ireland", countryCode: "GB" },

  // ============================================
  // AUSTRALIA - Major Cities
  // ============================================
  { name: "Sydney", slug: "sydney", stateSlug: "new-south-wales", countryCode: "AU", isFeatured: true },
  { name: "Melbourne", slug: "melbourne", stateSlug: "victoria", countryCode: "AU", isFeatured: true },
  { name: "Brisbane", slug: "brisbane", stateSlug: "queensland", countryCode: "AU", isFeatured: true },
  { name: "Perth", slug: "perth", stateSlug: "western-australia", countryCode: "AU", isFeatured: true },
  { name: "Adelaide", slug: "adelaide", stateSlug: "south-australia", countryCode: "AU" },
  { name: "Gold Coast", slug: "gold-coast", stateSlug: "queensland", countryCode: "AU" },
  { name: "Canberra", slug: "canberra", stateSlug: "australian-capital-territory", countryCode: "AU" },
  { name: "Hobart", slug: "hobart", stateSlug: "tasmania", countryCode: "AU" },
  { name: "Darwin", slug: "darwin", stateSlug: "northern-territory", countryCode: "AU" },
  { name: "Newcastle", slug: "newcastle", stateSlug: "new-south-wales", countryCode: "AU" },
  { name: "Wollongong", slug: "wollongong", stateSlug: "new-south-wales", countryCode: "AU" },
  { name: "Sunshine Coast", slug: "sunshine-coast", stateSlug: "queensland", countryCode: "AU" },
  { name: "Cairns", slug: "cairns", stateSlug: "queensland", countryCode: "AU" },
  { name: "Townsville", slug: "townsville", stateSlug: "queensland", countryCode: "AU" },
  { name: "Geelong", slug: "geelong", stateSlug: "victoria", countryCode: "AU" },
  { name: "Launceston", slug: "launceston", stateSlug: "tasmania", countryCode: "AU" },
  { name: "Ballarat", slug: "ballarat", stateSlug: "victoria", countryCode: "AU" },
  { name: "Bendigo", slug: "bendigo", stateSlug: "victoria", countryCode: "AU" },

  // ============================================
  // GERMANY - Major Cities
  // ============================================
  { name: "Berlin", slug: "berlin", stateSlug: "berlin", countryCode: "DE", isFeatured: true },
  { name: "Munich", slug: "munich", stateSlug: "bavaria", countryCode: "DE", isFeatured: true },
  { name: "Hamburg", slug: "hamburg", stateSlug: "hamburg", countryCode: "DE", isFeatured: true },
  { name: "Frankfurt", slug: "frankfurt", stateSlug: "hesse", countryCode: "DE" },
  { name: "Cologne", slug: "cologne", stateSlug: "north-rhine-westphalia", countryCode: "DE" },
  { name: "Dusseldorf", slug: "dusseldorf", stateSlug: "north-rhine-westphalia", countryCode: "DE" },
  { name: "Stuttgart", slug: "stuttgart", stateSlug: "baden-wurttemberg", countryCode: "DE" },
  { name: "Dresden", slug: "dresden", stateSlug: "saxony", countryCode: "DE" },
  { name: "Leipzig", slug: "leipzig", stateSlug: "saxony", countryCode: "DE" },
  { name: "Nuremberg", slug: "nuremberg", stateSlug: "bavaria", countryCode: "DE" },
  { name: "Hanover", slug: "hanover", stateSlug: "lower-saxony", countryCode: "DE" },
  { name: "Bremen", slug: "bremen", stateSlug: "bremen", countryCode: "DE" },
  { name: "Dortmund", slug: "dortmund", stateSlug: "north-rhine-westphalia", countryCode: "DE" },
  { name: "Essen", slug: "essen", stateSlug: "north-rhine-westphalia", countryCode: "DE" },
  { name: "Bonn", slug: "bonn", stateSlug: "north-rhine-westphalia", countryCode: "DE" },
  { name: "Freiburg", slug: "freiburg", stateSlug: "baden-wurttemberg", countryCode: "DE" },

  // ============================================
  // FRANCE - Major Cities
  // ============================================
  { name: "Paris", slug: "paris", stateSlug: "ile-de-france", countryCode: "FR", isFeatured: true },
  { name: "Marseille", slug: "marseille", stateSlug: "provence-alpes-cote-dazur", countryCode: "FR" },
  { name: "Lyon", slug: "lyon", stateSlug: "auvergne-rhone-alpes", countryCode: "FR" },
  { name: "Toulouse", slug: "toulouse", stateSlug: "occitanie", countryCode: "FR" },
  { name: "Nice", slug: "nice", stateSlug: "provence-alpes-cote-dazur", countryCode: "FR" },
  { name: "Nantes", slug: "nantes", stateSlug: "pays-de-la-loire", countryCode: "FR" },
  { name: "Strasbourg", slug: "strasbourg", stateSlug: "grand-est", countryCode: "FR" },
  { name: "Montpellier", slug: "montpellier", stateSlug: "occitanie", countryCode: "FR" },
  { name: "Bordeaux", slug: "bordeaux", stateSlug: "nouvelle-aquitaine", countryCode: "FR" },
  { name: "Lille", slug: "lille", stateSlug: "hauts-de-france", countryCode: "FR" },
  { name: "Rennes", slug: "rennes", stateSlug: "brittany", countryCode: "FR" },
  { name: "Reims", slug: "reims", stateSlug: "grand-est", countryCode: "FR" },
  { name: "Cannes", slug: "cannes", stateSlug: "provence-alpes-cote-dazur", countryCode: "FR" },

  // ============================================
  // SPAIN - Major Cities
  // ============================================
  { name: "Madrid", slug: "madrid", stateSlug: "madrid", countryCode: "ES", isFeatured: true },
  { name: "Barcelona", slug: "barcelona", stateSlug: "catalonia", countryCode: "ES", isFeatured: true },
  { name: "Valencia", slug: "valencia", stateSlug: "valencia", countryCode: "ES" },
  { name: "Seville", slug: "seville", stateSlug: "andalusia", countryCode: "ES" },
  { name: "Malaga", slug: "malaga", stateSlug: "andalusia", countryCode: "ES" },
  { name: "Bilbao", slug: "bilbao", stateSlug: "basque-country", countryCode: "ES" },
  { name: "Palma de Mallorca", slug: "palma-de-mallorca", stateSlug: "balearic-islands", countryCode: "ES" },
  { name: "Granada", slug: "granada", stateSlug: "andalusia", countryCode: "ES" },
  { name: "Tenerife", slug: "tenerife", stateSlug: "canary-islands", countryCode: "ES" },
  { name: "Las Palmas", slug: "las-palmas", stateSlug: "canary-islands", countryCode: "ES" },
  { name: "San Sebastian", slug: "san-sebastian", stateSlug: "basque-country", countryCode: "ES" },
  { name: "Cordoba", slug: "cordoba", stateSlug: "andalusia", countryCode: "ES" },

  // ============================================
  // ITALY - Major Cities
  // ============================================
  { name: "Rome", slug: "rome", stateSlug: "lazio", countryCode: "IT", isFeatured: true },
  { name: "Milan", slug: "milan", stateSlug: "lombardy", countryCode: "IT", isFeatured: true },
  { name: "Naples", slug: "naples", stateSlug: "campania", countryCode: "IT" },
  { name: "Turin", slug: "turin", stateSlug: "piedmont", countryCode: "IT" },
  { name: "Florence", slug: "florence", stateSlug: "tuscany", countryCode: "IT" },
  { name: "Venice", slug: "venice", stateSlug: "veneto", countryCode: "IT" },
  { name: "Bologna", slug: "bologna", stateSlug: "emilia-romagna", countryCode: "IT" },
  { name: "Genoa", slug: "genoa", stateSlug: "liguria", countryCode: "IT" },
  { name: "Palermo", slug: "palermo", stateSlug: "sicily", countryCode: "IT" },
  { name: "Catania", slug: "catania", stateSlug: "sicily", countryCode: "IT" },
  { name: "Bari", slug: "bari", stateSlug: "apulia", countryCode: "IT" },
  { name: "Cagliari", slug: "cagliari", stateSlug: "sardinia", countryCode: "IT" },

  // ============================================
  // UAE - Major Cities
  // ============================================
  { name: "Dubai City", slug: "dubai-city", stateSlug: "dubai", countryCode: "AE", isFeatured: true },
  { name: "Downtown Dubai", slug: "downtown-dubai", stateSlug: "dubai", countryCode: "AE" },
  { name: "Dubai Marina", slug: "dubai-marina", stateSlug: "dubai", countryCode: "AE" },
  { name: "Jumeirah", slug: "jumeirah", stateSlug: "dubai", countryCode: "AE" },
  { name: "Business Bay", slug: "business-bay", stateSlug: "dubai", countryCode: "AE" },
  { name: "Palm Jumeirah", slug: "palm-jumeirah", stateSlug: "dubai", countryCode: "AE" },
  { name: "Deira", slug: "deira", stateSlug: "dubai", countryCode: "AE" },
  { name: "Bur Dubai", slug: "bur-dubai", stateSlug: "dubai", countryCode: "AE" },
  { name: "Abu Dhabi City", slug: "abu-dhabi-city", stateSlug: "abu-dhabi", countryCode: "AE", isFeatured: true },
  { name: "Al Ain", slug: "al-ain", stateSlug: "abu-dhabi", countryCode: "AE" },
  { name: "Sharjah City", slug: "sharjah-city", stateSlug: "sharjah", countryCode: "AE" },
  { name: "Ajman City", slug: "ajman-city", stateSlug: "ajman", countryCode: "AE" },
  { name: "Ras Al Khaimah City", slug: "ras-al-khaimah-city", stateSlug: "ras-al-khaimah", countryCode: "AE" },
  { name: "Fujairah City", slug: "fujairah-city", stateSlug: "fujairah", countryCode: "AE" },

  // ============================================
  // SAUDI ARABIA - Major Cities
  // ============================================
  { name: "Riyadh", slug: "riyadh", stateSlug: "riyadh", countryCode: "SA", isFeatured: true },
  { name: "Jeddah", slug: "jeddah", stateSlug: "makkah", countryCode: "SA", isFeatured: true },
  { name: "Mecca", slug: "mecca", stateSlug: "makkah", countryCode: "SA" },
  { name: "Medina", slug: "medina", stateSlug: "madinah", countryCode: "SA" },
  { name: "Dammam", slug: "dammam", stateSlug: "eastern-province", countryCode: "SA" },
  { name: "Khobar", slug: "khobar", stateSlug: "eastern-province", countryCode: "SA" },
  { name: "Taif", slug: "taif", stateSlug: "makkah", countryCode: "SA" },
  { name: "Tabuk", slug: "tabuk", stateSlug: "tabuk", countryCode: "SA" },
  { name: "Abha", slug: "abha", stateSlug: "asir", countryCode: "SA" },

  // ============================================
  // JAPAN - Major Cities
  // ============================================
  { name: "Tokyo", slug: "tokyo", stateSlug: "tokyo", countryCode: "JP", isFeatured: true },
  { name: "Osaka", slug: "osaka", stateSlug: "osaka", countryCode: "JP", isFeatured: true },
  { name: "Yokohama", slug: "yokohama", stateSlug: "kanagawa", countryCode: "JP" },
  { name: "Nagoya", slug: "nagoya", stateSlug: "aichi", countryCode: "JP" },
  { name: "Sapporo", slug: "sapporo", stateSlug: "hokkaido", countryCode: "JP" },
  { name: "Fukuoka", slug: "fukuoka", stateSlug: "fukuoka", countryCode: "JP" },
  { name: "Kobe", slug: "kobe", stateSlug: "hyogo", countryCode: "JP" },
  { name: "Kyoto", slug: "kyoto", stateSlug: "kyoto", countryCode: "JP" },
  { name: "Hiroshima", slug: "hiroshima", stateSlug: "hiroshima", countryCode: "JP" },
  { name: "Chiba", slug: "chiba", stateSlug: "chiba", countryCode: "JP" },
  { name: "Sendai", slug: "sendai", stateSlug: "miyagi", countryCode: "JP" },
  { name: "Naha", slug: "naha", stateSlug: "okinawa", countryCode: "JP" },

  // ============================================
  // SOUTH KOREA - Major Cities
  // ============================================
  { name: "Seoul", slug: "seoul", stateSlug: "seoul", countryCode: "KR", isFeatured: true },
  { name: "Busan", slug: "busan", stateSlug: "busan", countryCode: "KR" },
  { name: "Incheon", slug: "incheon", stateSlug: "incheon", countryCode: "KR" },
  { name: "Daegu", slug: "daegu", stateSlug: "daegu", countryCode: "KR" },
  { name: "Daejeon", slug: "daejeon", stateSlug: "daejeon", countryCode: "KR" },
  { name: "Suwon", slug: "suwon", stateSlug: "gyeonggi", countryCode: "KR" },
  { name: "Jeju City", slug: "jeju-city", stateSlug: "jeju", countryCode: "KR" },
  { name: "Gwangju", slug: "gwangju", stateSlug: "gwangju", countryCode: "KR" },

  // ============================================
  // CHINA - Major Cities
  // ============================================
  { name: "Beijing", slug: "beijing", stateSlug: "beijing", countryCode: "CN", isFeatured: true },
  { name: "Shanghai", slug: "shanghai", stateSlug: "shanghai", countryCode: "CN", isFeatured: true },
  { name: "Guangzhou", slug: "guangzhou", stateSlug: "guangdong", countryCode: "CN" },
  { name: "Shenzhen", slug: "shenzhen", stateSlug: "guangdong", countryCode: "CN" },
  { name: "Chengdu", slug: "chengdu", stateSlug: "sichuan", countryCode: "CN" },
  { name: "Hangzhou", slug: "hangzhou", stateSlug: "zhejiang", countryCode: "CN" },
  { name: "Wuhan", slug: "wuhan", stateSlug: "hubei", countryCode: "CN" },
  { name: "Nanjing", slug: "nanjing", stateSlug: "jiangsu", countryCode: "CN" },
  { name: "Xiamen", slug: "xiamen", stateSlug: "fujian", countryCode: "CN" },

  // ============================================
  // THAILAND - Major Cities
  // ============================================
  { name: "Bangkok", slug: "bangkok", stateSlug: "bangkok", countryCode: "TH", isFeatured: true },
  { name: "Chiang Mai", slug: "chiang-mai", stateSlug: "chiang-mai", countryCode: "TH" },
  { name: "Pattaya", slug: "pattaya", stateSlug: "chonburi", countryCode: "TH" },
  { name: "Phuket City", slug: "phuket-city", stateSlug: "phuket", countryCode: "TH", isFeatured: true },
  { name: "Krabi Town", slug: "krabi-town", stateSlug: "krabi", countryCode: "TH" },
  { name: "Koh Samui", slug: "koh-samui", stateSlug: "surat-thani", countryCode: "TH" },
  { name: "Chiang Rai", slug: "chiang-rai", stateSlug: "chiang-rai", countryCode: "TH" },

  // ============================================
  // MALAYSIA - Major Cities
  // ============================================
  { name: "Kuala Lumpur", slug: "kuala-lumpur", stateSlug: "kuala-lumpur", countryCode: "MY", isFeatured: true },
  { name: "Petaling Jaya", slug: "petaling-jaya", stateSlug: "selangor", countryCode: "MY" },
  { name: "George Town", slug: "george-town", stateSlug: "penang", countryCode: "MY" },
  { name: "Johor Bahru", slug: "johor-bahru", stateSlug: "johor", countryCode: "MY" },
  { name: "Kota Kinabalu", slug: "kota-kinabalu", stateSlug: "sabah", countryCode: "MY" },
  { name: "Kuching", slug: "kuching", stateSlug: "sarawak", countryCode: "MY" },
  { name: "Malacca City", slug: "malacca-city", stateSlug: "malacca", countryCode: "MY" },

  // ============================================
  // INDONESIA - Major Cities
  // ============================================
  { name: "Jakarta", slug: "jakarta", stateSlug: "dki-jakarta", countryCode: "ID", isFeatured: true },
  { name: "Surabaya", slug: "surabaya", stateSlug: "east-java", countryCode: "ID" },
  { name: "Bandung", slug: "bandung", stateSlug: "west-java", countryCode: "ID" },
  { name: "Bali", slug: "bali", stateSlug: "bali", countryCode: "ID", isFeatured: true },
  { name: "Semarang", slug: "semarang", stateSlug: "central-java", countryCode: "ID" },
  { name: "Medan", slug: "medan", stateSlug: "north-sumatra", countryCode: "ID" },
  { name: "Makassar", slug: "makassar", stateSlug: "south-sulawesi", countryCode: "ID" },

  // ============================================
  // PHILIPPINES - Major Cities
  // ============================================
  { name: "Manila", slug: "manila", stateSlug: "metro-manila", countryCode: "PH", isFeatured: true },
  { name: "Quezon City", slug: "quezon-city", stateSlug: "metro-manila", countryCode: "PH" },
  { name: "Makati", slug: "makati", stateSlug: "metro-manila", countryCode: "PH" },
  { name: "Cebu City", slug: "cebu-city", stateSlug: "cebu", countryCode: "PH" },
  { name: "Davao City", slug: "davao-city", stateSlug: "davao", countryCode: "PH" },
  { name: "Boracay", slug: "boracay", stateSlug: "central-visayas", countryCode: "PH" },

  // ============================================
  // VIETNAM - Major Cities
  // ============================================
  { name: "Ho Chi Minh City", slug: "ho-chi-minh-city", stateSlug: "ho-chi-minh-city", countryCode: "VN", isFeatured: true },
  { name: "Hanoi", slug: "hanoi", stateSlug: "hanoi", countryCode: "VN", isFeatured: true },
  { name: "Da Nang", slug: "da-nang", stateSlug: "da-nang", countryCode: "VN" },
  { name: "Haiphong", slug: "haiphong", stateSlug: "haiphong", countryCode: "VN" },
  { name: "Hoi An", slug: "hoi-an", stateSlug: "quang-nam", countryCode: "VN" },

  // ============================================
  // SINGAPORE
  // ============================================
  { name: "Singapore", slug: "singapore", stateSlug: "central-region", countryCode: "SG", isFeatured: true },
  { name: "Orchard", slug: "orchard", stateSlug: "central-region", countryCode: "SG" },
  { name: "Marina Bay", slug: "marina-bay", stateSlug: "central-region", countryCode: "SG" },
  { name: "Sentosa", slug: "sentosa", stateSlug: "central-region", countryCode: "SG" },

  // ============================================
  // TAIWAN - Major Cities
  // ============================================
  { name: "Taipei", slug: "taipei", stateSlug: "taipei", countryCode: "TW", isFeatured: true },
  { name: "Kaohsiung", slug: "kaohsiung", stateSlug: "kaohsiung", countryCode: "TW" },
  { name: "Taichung", slug: "taichung", stateSlug: "taichung", countryCode: "TW" },

  // ============================================
  // HONG KONG
  // ============================================
  { name: "Hong Kong", slug: "hong-kong", stateSlug: "hong-kong-island", countryCode: "HK", isFeatured: true },
  { name: "Kowloon", slug: "kowloon", stateSlug: "kowloon", countryCode: "HK" },
  { name: "Tsim Sha Tsui", slug: "tsim-sha-tsui", stateSlug: "kowloon", countryCode: "HK" },

  // ============================================
  // NETHERLANDS - Major Cities
  // ============================================
  { name: "Amsterdam", slug: "amsterdam", stateSlug: "north-holland", countryCode: "NL", isFeatured: true },
  { name: "Rotterdam", slug: "rotterdam", stateSlug: "south-holland", countryCode: "NL" },
  { name: "The Hague", slug: "the-hague", stateSlug: "south-holland", countryCode: "NL" },
  { name: "Utrecht", slug: "utrecht", stateSlug: "utrecht", countryCode: "NL" },
  { name: "Eindhoven", slug: "eindhoven", stateSlug: "north-brabant", countryCode: "NL" },
  { name: "Groningen", slug: "groningen", stateSlug: "groningen", countryCode: "NL" },
  { name: "Maastricht", slug: "maastricht", stateSlug: "limburg", countryCode: "NL" },

  // ============================================
  // SWITZERLAND - Major Cities
  // ============================================
  { name: "Zurich", slug: "zurich", stateSlug: "zurich", countryCode: "CH", isFeatured: true },
  { name: "Geneva", slug: "geneva", stateSlug: "geneva", countryCode: "CH" },
  { name: "Basel", slug: "basel", stateSlug: "basel", countryCode: "CH" },
  { name: "Lausanne", slug: "lausanne", stateSlug: "vaud", countryCode: "CH" },
  { name: "Bern", slug: "bern", stateSlug: "bern", countryCode: "CH" },
  { name: "Lucerne", slug: "lucerne", stateSlug: "lucerne", countryCode: "CH" },
  { name: "Interlaken", slug: "interlaken", stateSlug: "bern", countryCode: "CH" },
  { name: "Zermatt", slug: "zermatt", stateSlug: "valais", countryCode: "CH" },

  // ============================================
  // AUSTRIA - Major Cities
  // ============================================
  { name: "Vienna", slug: "vienna", stateSlug: "vienna", countryCode: "AT", isFeatured: true },
  { name: "Salzburg", slug: "salzburg", stateSlug: "salzburg", countryCode: "AT" },
  { name: "Innsbruck", slug: "innsbruck", stateSlug: "tyrol", countryCode: "AT" },
  { name: "Graz", slug: "graz", stateSlug: "styria", countryCode: "AT" },
  { name: "Linz", slug: "linz", stateSlug: "upper-austria", countryCode: "AT" },

  // ============================================
  // BRAZIL - Major Cities
  // ============================================
  { name: "Sao Paulo", slug: "sao-paulo", stateSlug: "sao-paulo", countryCode: "BR", isFeatured: true },
  { name: "Rio de Janeiro", slug: "rio-de-janeiro", stateSlug: "rio-de-janeiro", countryCode: "BR", isFeatured: true },
  { name: "Brasilia", slug: "brasilia", stateSlug: "federal-district", countryCode: "BR" },
  { name: "Salvador", slug: "salvador", stateSlug: "bahia", countryCode: "BR" },
  { name: "Fortaleza", slug: "fortaleza", stateSlug: "ceara", countryCode: "BR" },
  { name: "Belo Horizonte", slug: "belo-horizonte", stateSlug: "minas-gerais", countryCode: "BR" },
  { name: "Manaus", slug: "manaus", stateSlug: "amazonas", countryCode: "BR" },
  { name: "Curitiba", slug: "curitiba", stateSlug: "parana", countryCode: "BR" },
  { name: "Recife", slug: "recife", stateSlug: "pernambuco", countryCode: "BR" },
  { name: "Porto Alegre", slug: "porto-alegre", stateSlug: "rio-grande-do-sul", countryCode: "BR" },
  { name: "Florianopolis", slug: "florianopolis", stateSlug: "santa-catarina", countryCode: "BR" },
  { name: "Goiania", slug: "goiania", stateSlug: "goias", countryCode: "BR" },

  // ============================================
  // MEXICO - Major Cities
  // ============================================
  { name: "Mexico City", slug: "mexico-city", stateSlug: "mexico-city", countryCode: "MX", isFeatured: true },
  { name: "Guadalajara", slug: "guadalajara", stateSlug: "jalisco", countryCode: "MX" },
  { name: "Monterrey", slug: "monterrey", stateSlug: "nuevo-leon", countryCode: "MX" },
  { name: "Cancun", slug: "cancun", stateSlug: "quintana-roo", countryCode: "MX", isFeatured: true },
  { name: "Puebla", slug: "puebla", stateSlug: "puebla", countryCode: "MX" },
  { name: "Tijuana", slug: "tijuana", stateSlug: "baja-california", countryCode: "MX" },
  { name: "Playa del Carmen", slug: "playa-del-carmen", stateSlug: "quintana-roo", countryCode: "MX" },
  { name: "Oaxaca", slug: "oaxaca", stateSlug: "oaxaca", countryCode: "MX" },
  { name: "Merida", slug: "merida", stateSlug: "yucatan", countryCode: "MX" },
  { name: "Acapulco", slug: "acapulco", stateSlug: "guerrero", countryCode: "MX" },
  { name: "Los Cabos", slug: "los-cabos", stateSlug: "baja-california-sur", countryCode: "MX" },
  { name: "Guadalajara Centro", slug: "guadalajara-centro", stateSlug: "jalisco", countryCode: "MX" },

  // ============================================
  // ARGENTINA - Major Cities
  // ============================================
  { name: "Buenos Aires", slug: "buenos-aires", stateSlug: "ciudad-buenos-aires", countryCode: "AR", isFeatured: true },
  { name: "Cordoba", slug: "cordoba", stateSlug: "cordoba", countryCode: "AR" },
  { name: "Rosario", slug: "rosario", stateSlug: "santa-fe", countryCode: "AR" },
  { name: "Mendoza", slug: "mendoza", stateSlug: "mendoza", countryCode: "AR" },
  { name: "La Plata", slug: "la-plata", stateSlug: "buenos-aires", countryCode: "AR" },
  { name: "Mar del Plata", slug: "mar-del-plata", stateSlug: "buenos-aires", countryCode: "AR" },

  // ============================================
  // COLOMBIA - Major Cities
  // ============================================
  { name: "Bogota", slug: "bogota", stateSlug: "bogota", countryCode: "CO", isFeatured: true },
  { name: "Medellin", slug: "medellin", stateSlug: "antioquia", countryCode: "CO" },
  { name: "Cali", slug: "cali", stateSlug: "valle-del-cauca", countryCode: "CO" },
  { name: "Cartagena", slug: "cartagena", stateSlug: "bolivar", countryCode: "CO", isFeatured: true },
  { name: "Barranquilla", slug: "barranquilla", stateSlug: "atlantico", countryCode: "CO" },
  { name: "Bucaramanga", slug: "bucaramanga", stateSlug: "santander", countryCode: "CO" },

  // ============================================
  // TURKEY - Major Cities
  // ============================================
  { name: "Istanbul", slug: "istanbul", stateSlug: "istanbul", countryCode: "TR", isFeatured: true },
  { name: "Ankara", slug: "ankara", stateSlug: "ankara", countryCode: "TR" },
  { name: "Izmir", slug: "izmir", stateSlug: "izmir", countryCode: "TR" },
  { name: "Antalya", slug: "antalya", stateSlug: "antalya", countryCode: "TR", isFeatured: true },
  { name: "Bursa", slug: "bursa", stateSlug: "bursa", countryCode: "TR" },
  { name: "Bodrum", slug: "bodrum", stateSlug: "mugla", countryCode: "TR" },
  { name: "Cappadocia", slug: "cappadocia", stateSlug: "nevsehir", countryCode: "TR" },

  // ============================================
  // SOUTH AFRICA - Major Cities
  // ============================================
  { name: "Johannesburg", slug: "johannesburg", stateSlug: "gauteng", countryCode: "ZA", isFeatured: true },
  { name: "Cape Town", slug: "cape-town", stateSlug: "western-cape", countryCode: "ZA", isFeatured: true },
  { name: "Durban", slug: "durban", stateSlug: "kwazulu-natal", countryCode: "ZA" },
  { name: "Pretoria", slug: "pretoria", stateSlug: "gauteng", countryCode: "ZA" },
  { name: "Port Elizabeth", slug: "port-elizabeth", stateSlug: "eastern-cape", countryCode: "ZA" },
  { name: "Stellenbosch", slug: "stellenbosch", stateSlug: "western-cape", countryCode: "ZA" },

  // ============================================
  // EGYPT - Major Cities
  // ============================================
  { name: "Cairo", slug: "cairo", stateSlug: "cairo", countryCode: "EG", isFeatured: true },
  { name: "Alexandria", slug: "alexandria", stateSlug: "alexandria", countryCode: "EG" },
  { name: "Giza", slug: "giza", stateSlug: "giza", countryCode: "EG" },
  { name: "Luxor", slug: "luxor", stateSlug: "luxor", countryCode: "EG" },
  { name: "Aswan", slug: "aswan", stateSlug: "aswan", countryCode: "EG" },
  { name: "Sharm El Sheikh", slug: "sharm-el-sheikh", stateSlug: "red-sea", countryCode: "EG" },
  { name: "Hurghada", slug: "hurghada", stateSlug: "red-sea", countryCode: "EG" },

  // ============================================
  // NIGERIA - Major Cities
  // ============================================
  { name: "Lagos", slug: "lagos", stateSlug: "lagos", countryCode: "NG", isFeatured: true },
  { name: "Abuja", slug: "abuja", stateSlug: "abuja", countryCode: "NG" },
  { name: "Kano", slug: "kano", stateSlug: "kano", countryCode: "NG" },
  { name: "Ibadan", slug: "ibadan", stateSlug: "oyo", countryCode: "NG" },
  { name: "Port Harcourt", slug: "port-harcourt", stateSlug: "rivers", countryCode: "NG" },

  // ============================================
  // KENYA - Major Cities
  // ============================================
  { name: "Nairobi", slug: "nairobi", stateSlug: "nairobi", countryCode: "KE", isFeatured: true },
  { name: "Mombasa", slug: "mombasa", stateSlug: "mombasa", countryCode: "KE" },
  { name: "Kisumu", slug: "kisumu", stateSlug: "kisumu", countryCode: "KE" },
  { name: "Nakuru", slug: "nakuru", stateSlug: "nakuru", countryCode: "KE" },

  // ============================================
  // MOROCCO - Major Cities
  // ============================================
  { name: "Casablanca", slug: "casablanca", stateSlug: "casablanca-settat", countryCode: "MA", isFeatured: true },
  { name: "Marrakech", slug: "marrakech", stateSlug: "marrakech-safi", countryCode: "MA", isFeatured: true },
  { name: "Tangier", slug: "tangier", stateSlug: "tanger-tetouan", countryCode: "MA" },
  { name: "Fes", slug: "fes", stateSlug: "fes-meknes", countryCode: "MA" },
  { name: "Rabat", slug: "rabat", stateSlug: "rabat-sale-kenitra", countryCode: "MA" },

  // ============================================
  // NEW ZEALAND - Major Cities
  // ============================================
  { name: "Auckland", slug: "auckland", stateSlug: "auckland", countryCode: "NZ", isFeatured: true },
  { name: "Wellington", slug: "wellington", stateSlug: "wellington", countryCode: "NZ" },
  { name: "Christchurch", slug: "christchurch", stateSlug: "canterbury", countryCode: "NZ" },
  { name: "Hamilton", slug: "hamilton", stateSlug: "waikato", countryCode: "NZ" },
  { name: "Tauranga", slug: "tauranga", stateSlug: "bay-of-plenty", countryCode: "NZ" },
  { name: "Queenstown", slug: "queenstown", stateSlug: "otago", countryCode: "NZ" },

  // ============================================
  // RUSSIA - Major Cities
  // ============================================
  { name: "Moscow", slug: "moscow", stateSlug: "moscow", countryCode: "RU", isFeatured: true },
  { name: "Saint Petersburg", slug: "saint-petersburg", stateSlug: "saint-petersburg", countryCode: "RU" },
  { name: "Novosibirsk", slug: "novosibirsk", stateSlug: "novosibirsk-oblast", countryCode: "RU" },
  { name: "Yekaterinburg", slug: "yekaterinburg", stateSlug: "sverdlovsk-oblast", countryCode: "RU" },
  { name: "Sochi", slug: "sochi", stateSlug: "krasnodar-krai", countryCode: "RU" },
  { name: "Kazan", slug: "kazan", stateSlug: "tatarstan", countryCode: "RU" },

  // ============================================
  // UKRAINE - Major Cities
  // ============================================
  { name: "Kyiv", slug: "kyiv", stateSlug: "kyiv", countryCode: "UA", isFeatured: true },
  { name: "Odesa", slug: "odesa", stateSlug: "odesa", countryCode: "UA" },
  { name: "Lviv", slug: "lviv", stateSlug: "lviv", countryCode: "UA" },
  { name: "Kharkiv", slug: "kharkiv", stateSlug: "kharkiv", countryCode: "UA" },

  // ============================================
  // PORTUGAL - Major Cities
  // ============================================
  { name: "Lisbon", slug: "lisbon", stateSlug: "lisbon", countryCode: "PT", isFeatured: true },
  { name: "Porto", slug: "porto", stateSlug: "porto", countryCode: "PT" },
  { name: "Faro", slug: "faro", stateSlug: "algarve", countryCode: "PT" },
  { name: "Funchal", slug: "funchal", stateSlug: "madeira", countryCode: "PT" },
  { name: "Sintra", slug: "sintra", stateSlug: "lisbon", countryCode: "PT" },

  // ============================================
  // GREECE - Major Cities
  // ============================================
  { name: "Athens", slug: "athens", stateSlug: "attica", countryCode: "GR", isFeatured: true },
  { name: "Thessaloniki", slug: "thessaloniki", stateSlug: "central-macedonia", countryCode: "GR" },
  { name: "Heraklion", slug: "heraklion", stateSlug: "crete", countryCode: "GR" },
  { name: "Santorini", slug: "santorini", stateSlug: "south-aegean", countryCode: "GR", isFeatured: true },
  { name: "Mykonos", slug: "mykonos", stateSlug: "south-aegean", countryCode: "GR" },
  { name: "Rhodes", slug: "rhodes", stateSlug: "south-aegean", countryCode: "GR" },

  // ============================================
  // SWEDEN - Major Cities
  // ============================================
  { name: "Stockholm", slug: "stockholm", stateSlug: "stockholm", countryCode: "SE", isFeatured: true },
  { name: "Gothenburg", slug: "gothenburg", stateSlug: "vastra-gotaland", countryCode: "SE" },
  { name: "Malmo", slug: "malmo", stateSlug: "skane", countryCode: "SE" },

  // ============================================
  // NORWAY - Major Cities
  // ============================================
  { name: "Oslo", slug: "oslo", stateSlug: "oslo", countryCode: "NO", isFeatured: true },
  { name: "Bergen", slug: "bergen", stateSlug: "hordaland", countryCode: "NO" },
  { name: "Stavanger", slug: "stavanger", stateSlug: "rogaland", countryCode: "NO" },
  { name: "Tromso", slug: "tromso", stateSlug: "troms", countryCode: "NO" },

  // ============================================
  // DENMARK - Major Cities
  // ============================================
  { name: "Copenhagen", slug: "copenhagen", stateSlug: "capital-region", countryCode: "DK", isFeatured: true },
  { name: "Aarhus", slug: "aarhus", stateSlug: "central-denmark", countryCode: "DK" },
  { name: "Odense", slug: "odense", stateSlug: "south-denmark", countryCode: "DK" },

  // ============================================
  // FINLAND - Major Cities
  // ============================================
  { name: "Helsinki", slug: "helsinki", stateSlug: "uusimaa", countryCode: "FI", isFeatured: true },
  { name: "Tampere", slug: "tampere", stateSlug: "pirkanmaa", countryCode: "FI" },
  { name: "Turku", slug: "turku", stateSlug: "southwest-finland", countryCode: "FI" },

  // ============================================
  // IRELAND - Major Cities
  // ============================================
  { name: "Dublin", slug: "dublin", stateSlug: "leinster", countryCode: "IE", isFeatured: true },
  { name: "Cork", slug: "cork", stateSlug: "munster", countryCode: "IE" },
  { name: "Galway", slug: "galway", stateSlug: "connacht", countryCode: "IE" },
  { name: "Limerick", slug: "limerick", stateSlug: "munster", countryCode: "IE" },

  // ============================================
  // CZECH REPUBLIC - Major Cities
  // ============================================
  { name: "Prague", slug: "prague", stateSlug: "prague", countryCode: "CZ", isFeatured: true },
  { name: "Brno", slug: "brno", stateSlug: "south-moravia", countryCode: "CZ" },
  { name: "Ostrava", slug: "ostrava", stateSlug: "moravia-silesia", countryCode: "CZ" },

  // ============================================
  // BELGIUM - Major Cities
  // ============================================
  { name: "Brussels", slug: "brussels", stateSlug: "brussels-capital", countryCode: "BE", isFeatured: true },
  { name: "Antwerp", slug: "antwerp", stateSlug: "flanders", countryCode: "BE" },
  { name: "Ghent", slug: "ghent", stateSlug: "flanders", countryCode: "BE" },
  { name: "Bruges", slug: "bruges", stateSlug: "flanders", countryCode: "BE" },

  // ============================================
  // POLAND - Major Cities
  // ============================================
  { name: "Warsaw", slug: "warsaw", stateSlug: "masovia", countryCode: "PL", isFeatured: true },
  { name: "Krakow", slug: "krakow", stateSlug: "lesser-poland", countryCode: "PL" },
  { name: "Wroclaw", slug: "wroclaw", stateSlug: "lower-silesia", countryCode: "PL" },
  { name: "Gdansk", slug: "gdansk", stateSlug: "pomerania", countryCode: "PL" },
  { name: "Poznan", slug: "poznan", stateSlug: "greater-poland", countryCode: "PL" },

  // ============================================
  // ROMANIA - Major Cities
  // ============================================
  { name: "Bucharest", slug: "bucharest", stateSlug: "bucharest", countryCode: "RO", isFeatured: true },
  { name: "Cluj-Napoca", slug: "cluj-napoca", stateSlug: "transylvania", countryCode: "RO" },
  { name: "Timisoara", slug: "timisoara", stateSlug: "banat", countryCode: "RO" },
  { name: "Brasov", slug: "brasov", stateSlug: "transylvania", countryCode: "RO" },

  // ============================================
  // HUNGARY - Major Cities
  // ============================================
  { name: "Budapest", slug: "budapest", stateSlug: "budapest", countryCode: "HU", isFeatured: true },
  { name: "Debrecen", slug: "debrecen", stateSlug: "hajdu-bihar", countryCode: "HU" },
  { name: "Szeged", slug: "szeged", stateSlug: "csongrad", countryCode: "HU" },

  // ============================================
  // QATAR - Major Cities
  // ============================================
  { name: "Doha", slug: "doha", stateSlug: "doha", countryCode: "QA", isFeatured: true },
  { name: "Al Rayyan", slug: "al-rayyan", stateSlug: "al-rayyan", countryCode: "QA" },

  // ============================================
  // KUWAIT - Major Cities
  // ============================================
  { name: "Kuwait City", slug: "kuwait-city", stateSlug: "al-asimah", countryCode: "KW", isFeatured: true },
  { name: "Salmiya", slug: "salmiya", stateSlug: "hawalli", countryCode: "KW" },
  { name: "Jabriya", slug: "jabriya", stateSlug: "farwaniya", countryCode: "KW" },

  // ============================================
  // BAHRAIN - Major Cities
  // ============================================
  { name: "Manama", slug: "manama", stateSlug: "capital-governorate", countryCode: "BH", isFeatured: true },
  { name: "Riffa", slug: "riffa", stateSlug: "southern-governorate", countryCode: "BH" },

  // ============================================
  // OMAN - Major Cities
  // ============================================
  { name: "Muscat", slug: "muscat", stateSlug: "muscat", countryCode: "OM", isFeatured: true },
  { name: "Salalah", slug: "salalah", stateSlug: "dhofar", countryCode: "OM" },
  { name: "Sohar", slug: "sohar", stateSlug: "al-batinah", countryCode: "OM" },

  // ============================================
  // JORDAN - Major Cities
  // ============================================
  { name: "Amman", slug: "amman", stateSlug: "amman", countryCode: "JO", isFeatured: true },
  { name: "Aqaba", slug: "aqaba", stateSlug: "aqaba", countryCode: "JO" },
  { name: "Petra", slug: "petra", stateSlug: "maan", countryCode: "JO" },
  { name: "Irbid", slug: "irbid", stateSlug: "irbid", countryCode: "JO" },

  // ============================================
  // LEBANON - Major Cities
  // ============================================
  { name: "Beirut", slug: "beirut", stateSlug: "beirut", countryCode: "LB", isFeatured: true },
  { name: "Byblos", slug: "byblos", stateSlug: "mount-lebanon", countryCode: "LB" },
  { name: "Tripoli", slug: "tripoli", stateSlug: "north", countryCode: "LB" },

  // ============================================
  // ISRAEL - Major Cities
  // ============================================
  { name: "Tel Aviv", slug: "tel-aviv", stateSlug: "tel-aviv", countryCode: "IL", isFeatured: true },
  { name: "Jerusalem", slug: "jerusalem", stateSlug: "jerusalem", countryCode: "IL" },
  { name: "Haifa", slug: "haifa", stateSlug: "haifa", countryCode: "IL" },
  { name: "Eilat", slug: "eilat", stateSlug: "southern-district", countryCode: "IL" },

  // ============================================
  // PAKISTAN - Major Cities
  // ============================================
  { name: "Karachi", slug: "karachi", stateSlug: "sindh", countryCode: "PK", isFeatured: true },
  { name: "Lahore", slug: "lahore", stateSlug: "punjab", countryCode: "PK" },
  { name: "Islamabad", slug: "islamabad", stateSlug: "islamabad", countryCode: "PK" },
  { name: "Rawalpindi", slug: "rawalpindi", stateSlug: "punjab", countryCode: "PK" },
  { name: "Peshawar", slug: "peshawar", stateSlug: "khyber-pakhtunkhwa", countryCode: "PK" },
  { name: "Faisalabad", slug: "faisalabad", stateSlug: "punjab", countryCode: "PK" },

  // ============================================
  // BANGLADESH - Major Cities
  // ============================================
  { name: "Dhaka", slug: "dhaka", stateSlug: "dhaka-division", countryCode: "BD", isFeatured: true },
  { name: "Chittagong", slug: "chittagong", stateSlug: "chittagong-division", countryCode: "BD" },
  { name: "Sylhet", slug: "sylhet", stateSlug: "sylhet-division", countryCode: "BD" },

  // ============================================
  // SRI LANKA - Major Cities
  // ============================================
  { name: "Colombo", slug: "colombo", stateSlug: "western-province", countryCode: "LK", isFeatured: true },
  { name: "Kandy", slug: "kandy", stateSlug: "central-province", countryCode: "LK" },
  { name: "Galle", slug: "galle", stateSlug: "southern-province", countryCode: "LK" },
  { name: "Sigiriya", slug: "sigiriya", stateSlug: "central-province", countryCode: "LK" },

  // ============================================
  // NEPAL - Major Cities
  // ============================================
  { name: "Kathmandu", slug: "kathmandu", stateSlug: "bagmati", countryCode: "NP", isFeatured: true },
  { name: "Pokhara", slug: "pokhara", stateSlug: "gandaki", countryCode: "NP" },
  { name: "Lumbini", slug: "lumbini", stateSlug: "lumbini", countryCode: "NP" },

  // ============================================
  // MYANMAR - Major Cities
  // ============================================
  { name: "Yangon", slug: "yangon", stateSlug: "yangon", countryCode: "MM", isFeatured: true },
  { name: "Mandalay", slug: "mandalay", stateSlug: "mandalay", countryCode: "MM" },
  { name: "Bagan", slug: "bagan", stateSlug: "mandalay", countryCode: "MM" },

  // ============================================
  // CAMBODIA - Major Cities
  // ============================================
  { name: "Phnom Penh", slug: "phnom-penh", stateSlug: "phnom-penh", countryCode: "KH", isFeatured: true },
  { name: "Siem Reap", slug: "siem-reap", stateSlug: "siem-reap", countryCode: "KH" },

  // ============================================
  // PERU - Major Cities
  // ============================================
  { name: "Lima", slug: "lima", stateSlug: "lima", countryCode: "PE", isFeatured: true },
  { name: "Cusco", slug: "cusco", stateSlug: "cusco", countryCode: "PE" },
  { name: "Arequipa", slug: "arequipa", stateSlug: "arequipa", countryCode: "PE" },

  // ============================================
  // CHILE - Major Cities
  // ============================================
  { name: "Santiago", slug: "santiago", stateSlug: "santiago-metropolitan", countryCode: "CL", isFeatured: true },
  { name: "Valparaiso", slug: "valparaiso", stateSlug: "valparaiso", countryCode: "CL" },
  { name: "Concepcion", slug: "concepcion", stateSlug: "biobio", countryCode: "CL" },
  { name: "Punta Arenas", slug: "punta-arenas", stateSlug: "magallanes", countryCode: "CL" },

  // ============================================
  // VENEZUELA - Major Cities
  // ============================================
  { name: "Caracas", slug: "caracas", stateSlug: "distrito-capital", countryCode: "VE" },
  { name: "Maracaibo", slug: "maracaibo", stateSlug: "zulia", countryCode: "VE" },
  { name: "Valencia", slug: "valencia", stateSlug: "carabobo", countryCode: "VE" },

  // ============================================
  // ECUADOR - Major Cities
  // ============================================
  { name: "Quito", slug: "quito", stateSlug: "pichincha", countryCode: "EC", isFeatured: true },
  { name: "Guayaquil", slug: "guayaquil", stateSlug: "guayas", countryCode: "EC" },

  // ============================================
  // BULGARIA - Major Cities
  // ============================================
  { name: "Sofia", slug: "sofia", stateSlug: "sofia-city", countryCode: "BG", isFeatured: true },
  { name: "Varna", slug: "varna", stateSlug: "varna", countryCode: "BG" },
  { name: "Plovdiv", slug: "plovdiv", stateSlug: "plovdiv", countryCode: "BG" },

  // ============================================
  // SERBIA - Major Cities
  // ============================================
  { name: "Belgrade", slug: "belgrade", stateSlug: "belgrade", countryCode: "RS", isFeatured: true },
  { name: "Novi Sad", slug: "novi-sad", stateSlug: "vojvodina", countryCode: "RS" },

  // ============================================
  // SLOVAKIA - Major Cities
  // ============================================
  { name: "Bratislava", slug: "bratislava", stateSlug: "bratislava", countryCode: "SK", isFeatured: true },
  { name: "Kosice", slug: "kosice", stateSlug: "kosice", countryCode: "SK" },

  // ============================================
  // CROATIA - Major Cities
  // ============================================
  { name: "Zagreb", slug: "zagreb", stateSlug: "zagreb", countryCode: "HR", isFeatured: true },
  { name: "Split", slug: "split", stateSlug: "split-dalmatia", countryCode: "HR" },
  { name: "Dubrovnik", slug: "dubrovnik", stateSlug: "dubrovnik-neretva", countryCode: "HR" },
  { name: "Zadar", slug: "zadar", stateSlug: "zadar", countryCode: "HR" },

  // ============================================
  // TANZANIA - Major Cities
  // ============================================
  { name: "Dar es Salaam", slug: "dar-es-salaam", stateSlug: "dar-es-salaam", countryCode: "TZ", isFeatured: true },
  { name: "Dodoma", slug: "dodoma", stateSlug: "dodoma", countryCode: "TZ" },
  { name: "Arusha", slug: "arusha", stateSlug: "arusha", countryCode: "TZ" },
  { name: "Zanzibar", slug: "zanzibar", stateSlug: "zanzibar", countryCode: "TZ" },

  // ============================================
  // GHANA - Major Cities
  // ============================================
  { name: "Accra", slug: "accra", stateSlug: "greater-accra", countryCode: "GH", isFeatured: true },
  { name: "Kumasi", slug: "kumasi", stateSlug: "ashanti", countryCode: "GH" },

  // ============================================
  // ETHIOPIA - Major Cities
  // ============================================
  { name: "Addis Ababa", slug: "addis-ababa", stateSlug: "addis-ababa", countryCode: "ET", isFeatured: true },

  // ============================================
  // ICELAND
  // ============================================
  { name: "Reykjavik", slug: "reykjavik", stateSlug: "capital-region", countryCode: "IS", isFeatured: true },

  // ============================================
  // LUXEMBOURG
  // ============================================
  { name: "Luxembourg City", slug: "luxembourg-city", stateSlug: "luxembourg", countryCode: "LU", isFeatured: true },

  // ============================================
  // MALTA
  // ============================================
  { name: "Valletta", slug: "valletta", stateSlug: "central-region", countryCode: "MT", isFeatured: true },

  // ============================================
  // CYPRUS
  // ============================================
  { name: "Nicosia", slug: "nicosia", stateSlug: "nicosia", countryCode: "CY", isFeatured: true },
  { name: "Limassol", slug: "limassol", stateSlug: "limassol", countryCode: "CY" },
  { name: "Paphos", slug: "paphos", stateSlug: "paphos", countryCode: "CY" },
  { name: "Larnaca", slug: "larnaca", stateSlug: "larnaca", countryCode: "CY" },

  // ============================================
  // GUATEMALA
  // ============================================
  { name: "Guatemala City", slug: "guatemala-city", stateSlug: "guatemala", countryCode: "GT", isFeatured: true },
  { name: "Antigua", slug: "antigua", stateSlug: "sacatepequez", countryCode: "GT" },

  // ============================================
  // COSTA RICA
  // ============================================
  { name: "San Jose", slug: "san-jose", stateSlug: "san-jose", countryCode: "CR", isFeatured: true },
  { name: "Limon", slug: "limon", stateSlug: "limon", countryCode: "CR" },

  // ============================================
  // JAMAICA
  // ============================================
  { name: "Kingston", slug: "kingston", stateSlug: "kingston", countryCode: "JM", isFeatured: true },
  { name: "Montego Bay", slug: "montego-bay", stateSlug: "cornwall", countryCode: "JM" },

  // ============================================
  // DOMINICAN REPUBLIC
  // ============================================
  { name: "Santo Domingo", slug: "santo-domingo", stateSlug: "distrito-nacional", countryCode: "DO", isFeatured: true },
  { name: "Punta Cana", slug: "punta-cana", stateSlug: "la-altagracia", countryCode: "DO" },

  // ============================================
  // TRINIDAD & TOBAGO
  // ============================================
  { name: "Port of Spain", slug: "port-of-spain", stateSlug: "port-of-spain", countryCode: "TT", isFeatured: true },

  // ============================================
  // BOLIVIA
  // ============================================
  { name: "La Paz", slug: "la-paz", stateSlug: "la-paz", countryCode: "BO" },
  { name: "Santa Cruz", slug: "santa-cruz", stateSlug: "santa-cruz", countryCode: "BO" },
  { name: "Sucre", slug: "sucre", stateSlug: "chuquisaca", countryCode: "BO" },

  // ============================================
  // URUGUAY
  // ============================================
  { name: "Montevideo", slug: "montevideo", stateSlug: "montevideo", countryCode: "UY", isFeatured: true },
  { name: "Punta del Este", slug: "punta-del-este", stateSlug: "maldonado", countryCode: "UY" },

  // ============================================
  // PARAGUAY
  // ============================================
  { name: "Asuncion", slug: "asuncion", stateSlug: "asuncion", countryCode: "PY", isFeatured: true },
  { name: "Ciudad del Este", slug: "ciudad-del-este", stateSlug: "alto-parana", countryCode: "PY" },

  // ============================================
  // PANAMA
  // ============================================
  { name: "Panama City", slug: "panama-city", stateSlug: "panama", countryCode: "PA", isFeatured: true },
];

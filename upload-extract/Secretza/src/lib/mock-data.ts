import type { Category, Country, State, City, Listing, PricingPackage } from "./types";

// ==========================================
// Categories
// ==========================================
export const categories: Category[] = [
  {
    id: "cat-1",
    name: "Escorts",
    slug: "escorts",
    description: "Premium escort services worldwide",
    icon: "Heart",
    color: "#EC4899",
    order: 1,
    isActive: true,
    isFeatured: true,
    listingCount: 2847,
  },
  {
    id: "cat-2",
    name: "Massage",
    slug: "massage",
    description: "Professional massage and bodywork",
    icon: "Sparkles",
    color: "#8B5CF6",
    order: 2,
    isActive: true,
    isFeatured: true,
    listingCount: 1923,
  },
  {
    id: "cat-3",
    name: "Dating",
    slug: "dating",
    description: "Dating and companionship",
    icon: "Flame",
    color: "#F59E0B",
    order: 3,
    isActive: true,
    isFeatured: true,
    listingCount: 1456,
  },
  {
    id: "cat-4",
    name: "Trans",
    slug: "trans",
    description: "Transgender classifieds",
    icon: "Star",
    color: "#06B6D4",
    order: 4,
    isActive: true,
    isFeatured: true,
    listingCount: 892,
  },
  {
    id: "cat-5",
    name: "Male Escorts",
    slug: "male-escorts",
    description: "Male escort services",
    icon: "User",
    color: "#10B981",
    order: 5,
    isActive: true,
    isFeatured: true,
    listingCount: 734,
  },
  {
    id: "cat-6",
    name: "Couples",
    slug: "couples",
    description: "Couple services and experiences",
    icon: "HeartHandshake",
    color: "#F43F5E",
    order: 6,
    isActive: true,
    isFeatured: true,
    listingCount: 567,
  },
  {
    id: "cat-7",
    name: "Adult Jobs",
    slug: "adult-jobs",
    description: "Adult industry job listings",
    icon: "Briefcase",
    color: "#6366F1",
    order: 7,
    isActive: true,
    isFeatured: false,
    listingCount: 423,
  },
  {
    id: "cat-8",
    name: "Adult Services",
    slug: "adult-services",
    description: "Professional adult services",
    icon: "Gem",
    color: "#A855F7",
    order: 8,
    isActive: true,
    isFeatured: false,
    listingCount: 1156,
  },
  {
    id: "cat-9",
    name: "Webcam",
    slug: "webcam",
    description: "Live webcam models",
    icon: "Camera",
    color: "#EF4444",
    order: 9,
    isActive: true,
    isFeatured: false,
    listingCount: 689,
  },
  {
    id: "cat-10",
    name: "Phone & Chat",
    slug: "phone-chat",
    description: "Phone and chat services",
    icon: "Phone",
    color: "#14B8A6",
    order: 10,
    isActive: true,
    isFeatured: false,
    listingCount: 345,
  },
];

// ==========================================
// Countries, States, Cities
// ==========================================
export const countries: Country[] = [
  {
    id: "co-1",
    name: "United States",
    code: "US",
    slug: "usa",
    isActive: true,
    listingCount: 4523,
    states: [
      {
        id: "st-1",
        name: "New York",
        slug: "new-york",
        countryId: "co-1",
        isActive: true,
        listingCount: 892,
        cities: [
          { id: "ci-1", name: "New York City", slug: "new-york-city", stateId: "st-1", isFeatured: true, isActive: true, listingCount: 567 },
          { id: "ci-2", name: "Buffalo", slug: "buffalo", stateId: "st-1", isFeatured: false, isActive: true, listingCount: 123 },
          { id: "ci-3", name: "Albany", slug: "albany", stateId: "st-1", isFeatured: false, isActive: true, listingCount: 89 },
          { id: "ci-4", name: "Rochester", slug: "rochester", stateId: "st-1", isFeatured: false, isActive: true, listingCount: 67 },
        ],
      },
      {
        id: "st-2",
        name: "California",
        slug: "california",
        countryId: "co-1",
        isActive: true,
        listingCount: 1234,
        cities: [
          { id: "ci-5", name: "Los Angeles", slug: "los-angeles", stateId: "st-2", isFeatured: true, isActive: true, listingCount: 789 },
          { id: "ci-6", name: "San Francisco", slug: "san-francisco", stateId: "st-2", isFeatured: true, isActive: true, listingCount: 456 },
          { id: "ci-7", name: "San Diego", slug: "san-diego", stateId: "st-2", isFeatured: false, isActive: true, listingCount: 234 },
        ],
      },
      {
        id: "st-3",
        name: "Nevada",
        slug: "nevada",
        countryId: "co-1",
        isActive: true,
        listingCount: 567,
        cities: [
          { id: "ci-8", name: "Las Vegas", slug: "las-vegas", stateId: "st-3", isFeatured: true, isActive: true, listingCount: 456 },
          { id: "ci-9", name: "Reno", slug: "reno", stateId: "st-3", isFeatured: false, isActive: true, listingCount: 78 },
        ],
      },
      {
        id: "st-4",
        name: "Texas",
        slug: "texas",
        countryId: "co-1",
        isActive: true,
        listingCount: 789,
        cities: [
          { id: "ci-10", name: "Houston", slug: "houston", stateId: "st-4", isFeatured: true, isActive: true, listingCount: 345 },
          { id: "ci-11", name: "Dallas", slug: "dallas", stateId: "st-4", isFeatured: true, isActive: true, listingCount: 289 },
          { id: "ci-12", name: "Austin", slug: "austin", stateId: "st-4", isFeatured: false, isActive: true, listingCount: 156 },
        ],
      },
      {
        id: "st-5",
        name: "Florida",
        slug: "florida",
        countryId: "co-1",
        isActive: true,
        listingCount: 678,
        cities: [
          { id: "ci-13", name: "Miami", slug: "miami", stateId: "st-5", isFeatured: true, isActive: true, listingCount: 423 },
          { id: "ci-14", name: "Orlando", slug: "orlando", stateId: "st-5", isFeatured: false, isActive: true, listingCount: 178 },
        ],
      },
    ],
  },
  {
    id: "co-2",
    name: "United Kingdom",
    code: "GB",
    slug: "uk",
    isActive: true,
    listingCount: 2345,
    states: [
      {
        id: "st-6",
        name: "England",
        slug: "england",
        countryId: "co-2",
        isActive: true,
        listingCount: 1890,
        cities: [
          { id: "ci-15", name: "London", slug: "london", stateId: "st-6", isFeatured: true, isActive: true, listingCount: 1234 },
          { id: "ci-16", name: "Manchester", slug: "manchester", stateId: "st-6", isFeatured: true, isActive: true, listingCount: 345 },
          { id: "ci-17", name: "Birmingham", slug: "birmingham", stateId: "st-6", isFeatured: false, isActive: true, listingCount: 234 },
          { id: "ci-18", name: "Leeds", slug: "leeds", stateId: "st-6", isFeatured: false, isActive: true, listingCount: 156 },
        ],
      },
      {
        id: "st-7",
        name: "Scotland",
        slug: "scotland",
        countryId: "co-2",
        isActive: true,
        listingCount: 234,
        cities: [
          { id: "ci-19", name: "Edinburgh", slug: "edinburgh", stateId: "st-7", isFeatured: true, isActive: true, listingCount: 156 },
          { id: "ci-20", name: "Glasgow", slug: "glasgow", stateId: "st-7", isFeatured: false, isActive: true, listingCount: 78 },
        ],
      },
    ],
  },
  {
    id: "co-3",
    name: "Australia",
    code: "AU",
    slug: "australia",
    isActive: true,
    listingCount: 1234,
    states: [
      {
        id: "st-8",
        name: "New South Wales",
        slug: "new-south-wales",
        countryId: "co-3",
        isActive: true,
        listingCount: 567,
        cities: [
          { id: "ci-21", name: "Sydney", slug: "sydney", stateId: "st-8", isFeatured: true, isActive: true, listingCount: 456 },
        ],
      },
      {
        id: "st-9",
        name: "Victoria",
        slug: "victoria",
        countryId: "co-3",
        isActive: true,
        listingCount: 456,
        cities: [
          { id: "ci-22", name: "Melbourne", slug: "melbourne", stateId: "st-9", isFeatured: true, isActive: true, listingCount: 389 },
        ],
      },
    ],
  },
  {
    id: "co-4",
    name: "Canada",
    code: "CA",
    slug: "canada",
    isActive: true,
    listingCount: 1123,
    states: [
      {
        id: "st-10",
        name: "Ontario",
        slug: "ontario",
        countryId: "co-4",
        isActive: true,
        listingCount: 567,
        cities: [
          { id: "ci-23", name: "Toronto", slug: "toronto", stateId: "st-10", isFeatured: true, isActive: true, listingCount: 456 },
        ],
      },
      {
        id: "st-11",
        name: "British Columbia",
        slug: "british-columbia",
        countryId: "co-4",
        isActive: true,
        listingCount: 345,
        cities: [
          { id: "ci-24", name: "Vancouver", slug: "vancouver", stateId: "st-11", isFeatured: true, isActive: true, listingCount: 289 },
        ],
      },
    ],
  },
  {
    id: "co-5",
    name: "Germany",
    code: "DE",
    slug: "germany",
    isActive: true,
    listingCount: 987,
    states: [
      {
        id: "st-12",
        name: "Berlin",
        slug: "berlin",
        countryId: "co-5",
        isActive: true,
        listingCount: 456,
        cities: [
          { id: "ci-25", name: "Berlin", slug: "berlin-city", stateId: "st-12", isFeatured: true, isActive: true, listingCount: 456 },
        ],
      },
      {
        id: "st-13",
        name: "Bavaria",
        slug: "bavaria",
        countryId: "co-5",
        isActive: true,
        listingCount: 345,
        cities: [
          { id: "ci-26", name: "Munich", slug: "munich", stateId: "st-13", isFeatured: true, isActive: true, listingCount: 289 },
        ],
      },
    ],
  },
  {
    id: "co-6",
    name: "India",
    code: "IN",
    slug: "india",
    isActive: true,
    listingCount: 876,
    states: [
      {
        id: "st-14",
        name: "Maharashtra",
        slug: "maharashtra",
        countryId: "co-6",
        isActive: true,
        listingCount: 456,
        cities: [
          { id: "ci-27", name: "Mumbai", slug: "mumbai", stateId: "st-14", isFeatured: true, isActive: true, listingCount: 389 },
        ],
      },
      {
        id: "st-15",
        name: "Delhi",
        slug: "delhi",
        countryId: "co-6",
        isActive: true,
        listingCount: 345,
        cities: [
          { id: "ci-28", name: "New Delhi", slug: "new-delhi", stateId: "st-15", isFeatured: true, isActive: true, listingCount: 312 },
        ],
      },
    ],
  },
  {
    id: "co-7",
    name: "UAE",
    code: "AE",
    slug: "uae",
    isActive: true,
    listingCount: 654,
    states: [
      {
        id: "st-16",
        name: "Dubai",
        slug: "dubai",
        countryId: "co-7",
        isActive: true,
        listingCount: 456,
        cities: [
          { id: "ci-29", name: "Dubai", slug: "dubai-city", stateId: "st-16", isFeatured: true, isActive: true, listingCount: 456 },
        ],
      },
      {
        id: "st-17",
        name: "Abu Dhabi",
        slug: "abu-dhabi",
        countryId: "co-7",
        isActive: true,
        listingCount: 198,
        cities: [
          { id: "ci-30", name: "Abu Dhabi", slug: "abu-dhabi-city", stateId: "st-17", isFeatured: false, isActive: true, listingCount: 198 },
        ],
      },
    ],
  },
  {
    id: "co-8",
    name: "France",
    code: "FR",
    slug: "france",
    isActive: true,
    listingCount: 567,
    states: [
      {
        id: "st-18",
        name: "Ile-de-France",
        slug: "ile-de-france",
        countryId: "co-8",
        isActive: true,
        listingCount: 456,
        cities: [
          { id: "ci-31", name: "Paris", slug: "paris", stateId: "st-18", isFeatured: true, isActive: true, listingCount: 456 },
        ],
      },
    ],
  },
];

// ==========================================
// Featured / Trending Cities
// ==========================================
export const trendingCities: (City & { country: Country; state: State })[] = [
  { ...countries[0].states![0].cities![0], state: countries[0].states![0], country: countries[0] },
  { ...countries[0].states![1].cities![0], state: countries[0].states![1], country: countries[0] },
  { ...countries[0].states![2].cities![0], state: countries[0].states![2], country: countries[0] },
  { ...countries[1].states![0].cities![0], state: countries[1].states![0], country: countries[1] },
  { ...countries[0].states![3].cities![0], state: countries[0].states![3], country: countries[0] },
  { ...countries[0].states![4].cities![0], state: countries[0].states![4], country: countries[0] },
  { ...countries[2].states![0].cities![0], state: countries[2].states![0], country: countries[2] },
  { ...countries[2].states![1].cities![0], state: countries[2].states![1], country: countries[2] },
  { ...countries[3].states![0].cities![0], state: countries[3].states![0], country: countries[3] },
  { ...countries[3].states![1].cities![0], state: countries[3].states![1], country: countries[3] },
  { ...countries[4].states![0].cities![0], state: countries[4].states![0], country: countries[4] },
  { ...countries[4].states![1].cities![0], state: countries[4].states![1], country: countries[4] },
  { ...countries[6].states![0].cities![0], state: countries[6].states![0], country: countries[6] },
  { ...countries[7].states![0].cities![0], state: countries[7].states![0], country: countries[7] },
  { ...countries[5].states![0].cities![0], state: countries[5].states![0], country: countries[5] },
  { ...countries[5].states![1].cities![0], state: countries[5].states![1], country: countries[5] },
];

// ==========================================
// Mock Listings
// ==========================================
const listingImages = [
  [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&crop=face",
  ],
  [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&crop=face",
  ],
  [
    "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=600&h=800&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&crop=face",
  ],
  [
    "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600&h=800&fit=crop&crop=face",
  ],
  [
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=800&fit=crop&crop=face",
  ],
  [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&crop=face",
  ],
];

const listingTitles = [
  "Stunning Companion for Elite Events",
  "Professional Masseuse - Deep Tissue & Relaxation",
  "Exotic Beauty Seeking Upscale Gentlemen",
  "Verified Luxury Companion - Incall & Outcall",
  "Classy European Model Available Today",
  "Premium Massage Therapy - Hotel Visits",
  "Gorgeous Brunette - Discreet & Professional",
  "Elegant Asian Companion - First Time",
  "Blonde Bombshell - Dinner Dates & More",
  "Tall Athletic Beauty - Your Perfect Date",
  "Sophisticated Redhead - VIP Treatment",
  "Experienced Professional - Satisfaction Guaranteed",
  "Young & Beautiful - Available 24/7",
  "Petite & Sweet - Incall Special",
  "Curvaceous Goddess - Outcall Available",
  "International Companion - Travel Companion",
  "Busty Beauty - Weekend Specials",
  "Fitness Model - Massage & Companionship",
  "College Girl - Part Time Available",
  "Mature & Elegant - For Discerning Gentlemen",
  "Duos Available - Double the Fun",
  "Fetish Friendly - Open Minded",
  "Tantric Massage Specialist - Certified",
  "Party Friendly - Club & Event Companions",
  "New in Town - Fresh Face",
  "High Class Independent - No Agency",
  "Sugar Baby Material - Generous Only",
  "Verified & Reviewed - Top Rated",
  "VIP Experience - Premium Service",
  "Late Night Available - After Hours",
  "Discreet & Confidential - Your Privacy First",
  "GFE Experience - Girlfriend Material",
  "Exotic Dancer - Private Shows",
  "Professional Dominatrix - Sessions Available",
  " Couples Therapy - Experienced",
];

const descriptions = [
  "Experience the ultimate companionship with a stunning, sophisticated, and discreet professional. Available for dinner dates, social events, travel, and private encounters. Your satisfaction and privacy are my top priorities.",
  "Let me melt your stress away with my expert touch. Professional massage therapist with years of experience. Specializing in deep tissue, Swedish, and relaxation massage. Clean, private location or hotel visits available.",
  "Hello gentlemen! I'm a fun-loving, adventurous spirit looking for upscale company. Whether you need a date for a special occasion or just some quality time, I'm your perfect match. Discretion is guaranteed.",
  "Step into a world of elegance and pleasure. I offer a premium, no-rush experience tailored to your desires. Incall in a luxurious apartment or outcall to your hotel. Verified photos and reviews.",
  "Your search ends here! I combine beauty, intelligence, and passion to create unforgettable experiences. Fluent in English and French. Available for international travel with prior arrangement.",
];

export const mockListings: Listing[] = listingTitles.map((title, i) => ({
  id: `listing-${i + 1}`,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  description: descriptions[i % descriptions.length],
  category: categories[i % categories.length],
  country: countries[i % countries.length],
  state: countries[i % countries.length].states![i % (countries[i % countries.length].states?.length || 1)],
  city: countries[i % countries.length].states![i % (countries[i % countries.length].states?.length || 1)].cities![i % (countries[i % countries.length].states![i % (countries[i % countries.length].states?.length || 1)].cities?.length || 1)],
  tags: ["verified", "premium", "discrete", "incall", "outcall"].slice(0, 2 + (i % 4)),
  price: i % 3 === 0 ? `$${150 + i * 25}/hr` : null,
  currency: "USD",
  contact: {
    email: i % 2 === 0 ? `contact${i}@email.com` : undefined,
    telegram: i % 3 === 0 ? `@companion${i}` : undefined,
    instagram: i % 4 === 0 ? `@model${i}` : undefined,
    website: i % 5 === 0 ? `www.example${i}.com` : undefined,
    customText: i % 6 === 0 ? "WhatsApp available - text only" : undefined,
  },
  images: listingImages[i % listingImages.length].map((url, j) => ({
    url,
    alt: `${title} - Photo ${j + 1}`,
    isPrimary: j === 0,
  })),
  status: "approved",
  isFeatured: i < 8,
  isBoosted: i < 4,
  featuredUntil: i < 8 ? "2026-06-20T00:00:00.000Z" : null,
  boostUntil: i < 4 ? "2026-06-10T00:00:00.000Z" : null,
  lastBumpedAt: i >= 4 && i < 12 ? `2026-06-${String(1 + (i % 28)).padStart(2, "0")}T${String(12 + (i % 12)).padStart(2, "0")}:00:00.000Z` : null,
  priorityScore: i < 4 ? 1000 + 500 + 10 + 25 : i < 8 ? 500 + 10 + 25 : i < 12 ? 50 + 10 + 25 : 10 + 25,
  expiresAt: "2026-07-01T00:00:00.000Z",
  viewCount: 100 + (i * 347) % 4900,
  createdAt: new Date(2026, 4, 20 - (i % 28), 12 + (i % 12), i * 7).toISOString(),
  user: {
    id: `user-${i + 1}`,
    name: ["Sophia", "Emma", "Isabella", "Olivia", "Ava", "Victoria", "Luna", "Chloe", "Mia", "Aria"][i % 10],
    avatar: listingImages[i % listingImages.length][0],
  },
}));

// Separate featured and latest
export const featuredListings = mockListings.filter((l) => l.isFeatured);
export const latestListings = [...mockListings]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 12);

// ==========================================
// Pricing Packages
// ==========================================
export const pricingPackages: PricingPackage[] = [
  {
    id: "pkg-free",
    name: "Basic",
    description: "Get started with a standard listing",
    price: 0,
    currency: "USD",
    duration: 7,
    features: ["1 active listing", "3 images", "7-day duration", "Basic search visibility"],
  },
  {
    id: "pkg-featured",
    name: "Featured",
    description: "Stand out with a featured listing",
    price: 29.99,
    currency: "USD",
    duration: 14,
    features: ["1 active listing", "8 images", "14-day duration", "Featured badge", "Priority in search", "Boost visibility"],
    isPopular: true,
  },
  {
    id: "pkg-premium",
    name: "Premium",
    description: "Maximum exposure and features",
    price: 59.99,
    currency: "USD",
    duration: 30,
    features: [
      "5 active listings",
      "20 images per listing",
      "30-day duration",
      "Featured badge",
      "Top of search results",
      "Analytics dashboard",
      "Priority support",
      "Auto-renewal option",
    ],
  },
  {
    id: "pkg-vip",
    name: "VIP",
    description: "The ultimate premium experience",
    price: 149.99,
    currency: "USD",
    duration: 30,
    features: [
      "Unlimited listings",
      "Unlimited images",
      "30-day duration",
      "VIP badge & glow",
      "Always top placement",
      "Full analytics suite",
      "Dedicated support",
      "Auto-renewal",
      "Custom branding",
    ],
  },
];

// ==========================================
// Admin Stats
// ==========================================
export const adminStats = {
  totalUsers: 12847,
  totalListings: 11234,
  activeListings: 8923,
  pendingReview: 156,
  totalRevenue: 284750,
  monthlyRevenue: 42350,
  featuredListings: 1234,
  premiumUsers: 567,
};

// ==========================================
// Helper Functions
// ==========================================
export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getCountryBySlug(slug: string): Country | undefined {
  return countries.find((c) => c.slug === slug);
}

export function getCityBySlug(countrySlug: string, stateSlug: string, citySlug: string): (City & { country: Country; state: State }) | undefined {
  const country = countries.find((c) => c.slug === countrySlug);
  if (!country) return undefined;
  const state = country.states?.find((s) => s.slug === stateSlug);
  if (!state) return undefined;
  const city = state.cities?.find((c) => c.slug === citySlug);
  if (!city) return undefined;
  return { ...city, state, country };
}

export function getListingsByCategory(slug: string): Listing[] {
  return mockListings.filter((l) => l.category.slug === slug);
}

export function getListingsByCity(countrySlug: string, citySlug: string): Listing[] {
  return mockListings.filter(
    (l) => l.country.slug === countrySlug && l.city.slug === citySlug
  );
}

export function searchListings(keyword?: string): Listing[] {
  if (!keyword) return mockListings;
  const lower = keyword.toLowerCase();
  return mockListings.filter(
    (l) =>
      l.title.toLowerCase().includes(lower) ||
      l.description.toLowerCase().includes(lower) ||
      l.tags.some((t) => t.toLowerCase().includes(lower)) ||
      l.category.name.toLowerCase().includes(lower) ||
      l.city.name.toLowerCase().includes(lower) ||
      l.country.name.toLowerCase().includes(lower)
  );
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

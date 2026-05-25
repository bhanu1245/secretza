// ==========================================
// Enterprise Category Seed Script
// ==========================================
// Seeds marketplace categories with subcategories, SEO metadata, and icons.
// Run with: bunx tsx prisma/seed-categories.ts
//
// Idempotent: safe to run multiple times (upsert by slug).
// ==========================================

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ==========================================
// Category definitions
// ==========================================
interface CategoryDef {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  children?: Omit<CategoryDef, "children">[];
}

const CATEGORIES: CategoryDef[] = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Buy and sell electronics, gadgets, and tech accessories",
    icon: "Smartphone",
    color: "#3B82F6",
    order: 1,
    isFeatured: true,
    seoTitle: "Electronics for Sale - Phones, Laptops, Gadgets | Secretza",
    seoDescription: "Browse thousands of electronics listings. Find phones, laptops, tablets, cameras, and more at great prices on Secretza.",
    children: [
      { name: "Mobile Phones", slug: "mobile-phones", description: "New and used smartphones", icon: "Smartphone", color: "#3B82F6", order: 1, isFeatured: false, seoTitle: "Mobile Phones for Sale", seoDescription: "Find new and used smartphones from top brands." },
      { name: "Laptops & Computers", slug: "laptops-computers", description: "Laptops, desktops, and components", icon: "Laptop", color: "#3B82F6", order: 2, isFeatured: false, seoTitle: "Laptops & Computers for Sale", seoDescription: "Buy and sell laptops, desktops, and computer parts." },
      { name: "Cameras", slug: "cameras", description: "Digital cameras, lenses, and accessories", icon: "Camera", color: "#3B82F6", order: 3, isFeatured: false, seoTitle: "Cameras for Sale", seoDescription: "Find DSLRs, mirrorless cameras, and camera accessories." },
      { name: "Audio & Headphones", slug: "audio-headphones", description: "Speakers, headphones, and audio equipment", icon: "Headphones", color: "#3B82F6", order: 4, isFeatured: false, seoTitle: "Audio & Headphones for Sale", seoDescription: "Shop headphones, speakers, and audio gear." },
      { name: "Gaming", slug: "gaming", description: "Consoles, games, and gaming accessories", icon: "Gamepad2", color: "#3B82F6", order: 5, isFeatured: false, seoTitle: "Gaming Equipment for Sale", seoDescription: "Buy and sell gaming consoles, games, and accessories." },
    ],
  },
  {
    name: "Real Estate",
    slug: "real-estate",
    description: "Find properties, apartments, and land for sale or rent",
    icon: "Home",
    color: "#10B981",
    order: 2,
    isFeatured: true,
    seoTitle: "Real Estate - Apartments, Houses, Land | Secretza",
    seoDescription: "Discover apartments, houses, commercial spaces, and land listings. Buy, sell, or rent properties on Secretza.",
    children: [
      { name: "Apartments for Sale", slug: "apartments-sale", description: "Apartments and flats for purchase", icon: "Building", color: "#10B981", order: 1, isFeatured: false, seoTitle: "Apartments for Sale", seoDescription: "Browse apartments for sale in your area." },
      { name: "Houses for Sale", slug: "houses-sale", description: "Houses and villas for purchase", icon: "Home", color: "#10B981", order: 2, isFeatured: false, seoTitle: "Houses for Sale", seoDescription: "Find houses and villas for sale." },
      { name: "Rentals", slug: "rentals", description: "Properties for rent", icon: "Key", color: "#10B981", order: 3, isFeatured: false, seoTitle: "Property Rentals", seoDescription: "Browse rental properties including apartments and houses." },
      { name: "Commercial Property", slug: "commercial-property", description: "Office spaces, shops, and warehouses", icon: "Store", color: "#10B981", order: 4, isFeatured: false, seoTitle: "Commercial Property for Sale & Rent", seoDescription: "Find office spaces, retail shops, and warehouses." },
      { name: "Land & Plots", slug: "land-plots", description: "Land and plots for sale", icon: "MapPin", color: "#10B981", order: 5, isFeatured: false, seoTitle: "Land & Plots for Sale", seoDescription: "Buy land and plots for residential or commercial use." },
    ],
  },
  {
    name: "Vehicles",
    slug: "vehicles",
    description: "Buy and sell cars, motorcycles, and other vehicles",
    icon: "Car",
    color: "#F59E0B",
    order: 3,
    isFeatured: true,
    seoTitle: "Vehicles for Sale - Cars, Bikes, Boats | Secretza",
    seoDescription: "Browse vehicles for sale including cars, motorcycles, boats, and commercial vehicles on Secretza.",
    children: [
      { name: "Cars", slug: "cars", description: "New and used cars for sale", icon: "Car", color: "#F59E0B", order: 1, isFeatured: false, seoTitle: "Cars for Sale", seoDescription: "Find new and used cars from dealers and private sellers." },
      { name: "Motorcycles", slug: "motorcycles", description: "Motorcycles and scooters", icon: "Bike", color: "#F59E0B", order: 2, isFeatured: false, seoTitle: "Motorcycles for Sale", seoDescription: "Buy and sell motorcycles and scooters." },
      { name: "Trucks & Commercial", slug: "trucks-commercial", description: "Trucks, vans, and commercial vehicles", icon: "Truck", color: "#F59E0B", order: 3, isFeatured: false, seoTitle: "Commercial Vehicles for Sale", seoDescription: "Find trucks, vans, and commercial vehicles." },
      { name: "Boats & Marine", slug: "boats-marine", description: "Boats, yachts, and marine equipment", icon: "Ship", color: "#F59E0B", order: 4, isFeatured: false, seoTitle: "Boats for Sale", seoDescription: "Browse boats, yachts, and marine equipment." },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Clothing, accessories, and footwear",
    icon: "Shirt",
    color: "#EC4899",
    order: 4,
    isFeatured: true,
    seoTitle: "Fashion & Clothing - New & Used | Secretza",
    seoDescription: "Shop fashion, clothing, shoes, and accessories. Designer brands and everyday wear at great prices.",
    children: [
      { name: "Men's Clothing", slug: "mens-clothing", description: "Shirts, pants, suits, and casual wear", icon: "User", color: "#EC4899", order: 1, isFeatured: false, seoTitle: "Men's Clothing for Sale", seoDescription: "Browse men's fashion and clothing." },
      { name: "Women's Clothing", slug: "womens-clothing", description: "Dresses, tops, and women's wear", icon: "User", color: "#EC4899", order: 2, isFeatured: false, seoTitle: "Women's Clothing for Sale", seoDescription: "Shop women's clothing and fashion." },
      { name: "Footwear", slug: "footwear", description: "Shoes, sneakers, boots, and sandals", icon: "Footprints", color: "#EC4899", order: 3, isFeatured: false, seoTitle: "Footwear for Sale", seoDescription: "Find shoes, sneakers, and boots." },
      { name: "Accessories", slug: "accessories", description: "Watches, jewelry, bags, and more", icon: "Watch", color: "#EC4899", order: 4, isFeatured: false, seoTitle: "Fashion Accessories for Sale", seoDescription: "Shop watches, jewelry, bags, and accessories." },
    ],
  },
  {
    name: "Services",
    slug: "services",
    description: "Professional and personal services",
    icon: "Briefcase",
    color: "#7C3AED",
    order: 5,
    isFeatured: true,
    seoTitle: "Professional Services | Secretza",
    seoDescription: "Find professional services including tutoring, repairs, cleaning, beauty, and more on Secretza.",
    children: [
      { name: "Home Services", slug: "home-services", description: "Cleaning, plumbing, electrical, and repair", icon: "Wrench", color: "#7C3AED", order: 1, isFeatured: false, seoTitle: "Home Services", seoDescription: "Find home repair, cleaning, and maintenance services." },
      { name: "Education & Tutoring", slug: "education-tutoring", description: "Tutoring, coaching, and training", icon: "GraduationCap", color: "#7C3AED", order: 2, isFeatured: false, seoTitle: "Education & Tutoring Services", seoDescription: "Find tutors, coaches, and educational services." },
      { name: "Health & Beauty", slug: "health-beauty", description: "Salon, spa, massage, and wellness", icon: "Heart", color: "#7C3AED", order: 3, isFeatured: false, seoTitle: "Health & Beauty Services", seoDescription: "Discover health, beauty, and wellness services." },
      { name: "IT & Digital Services", slug: "it-digital-services", description: "Web development, design, and tech services", icon: "Code", color: "#7C3AED", order: 4, isFeatured: false, seoTitle: "IT & Digital Services", seoDescription: "Find web developers, designers, and tech professionals." },
      { name: "Financial Services", slug: "financial-services", description: "Accounting, consulting, and legal", icon: "DollarSign", color: "#7C3AED", order: 5, isFeatured: false, seoTitle: "Financial & Legal Services", seoDescription: "Browse financial, accounting, and legal services." },
    ],
  },
  {
    name: "Jobs",
    slug: "jobs",
    description: "Job listings and employment opportunities",
    icon: "UserCheck",
    color: "#0891B2",
    order: 6,
    isFeatured: true,
    seoTitle: "Jobs & Employment - Find Your Next Job | Secretza",
    seoDescription: "Browse job listings across industries. Find full-time, part-time, freelance, and remote opportunities.",
    children: [
      { name: "Full-Time", slug: "full-time", description: "Full-time employment positions", icon: "Clock", color: "#0891B2", order: 1, isFeatured: false, seoTitle: "Full-Time Jobs", seoDescription: "Find full-time job opportunities." },
      { name: "Part-Time", slug: "part-time", description: "Part-time and flexible positions", icon: "Clock", color: "#0891B2", order: 2, isFeatured: false, seoTitle: "Part-Time Jobs", seoDescription: "Browse part-time and flexible job listings." },
      { name: "Freelance", slug: "freelance", description: "Freelance and contract work", icon: "PenTool", color: "#0891B2", order: 3, isFeatured: false, seoTitle: "Freelance Jobs", seoDescription: "Find freelance and contract work opportunities." },
      { name: "Remote Work", slug: "remote-work", description: "Work from home and remote positions", icon: "Wifi", color: "#0891B2", order: 4, isFeatured: false, seoTitle: "Remote Jobs", seoDescription: "Discover remote and work-from-home positions." },
    ],
  },
  {
    name: "Home & Garden",
    slug: "home-garden",
    description: "Furniture, appliances, decor, and garden supplies",
    icon: "Armchair",
    color: "#84CC16",
    order: 7,
    isFeatured: false,
    seoTitle: "Home & Garden - Furniture, Decor, Appliances | Secretza",
    seoDescription: "Find furniture, appliances, home decor, and garden supplies. Create your perfect living space.",
    children: [
      { name: "Furniture", slug: "furniture", description: "Sofas, tables, beds, and storage", icon: "Armchair", color: "#84CC16", order: 1, isFeatured: false, seoTitle: "Furniture for Sale", seoDescription: "Buy and sell new and used furniture." },
      { name: "Appliances", slug: "appliances", description: "Kitchen and home appliances", icon: "Refrigerator", color: "#84CC16", order: 2, isFeatured: false, seoTitle: "Home Appliances for Sale", seoDescription: "Find kitchen and home appliances." },
      { name: "Home Decor", slug: "home-decor", description: "Decorative items, art, and lighting", icon: "Lamp", color: "#84CC16", order: 3, isFeatured: false, seoTitle: "Home Decor", seoDescription: "Shop home decor, art, and lighting." },
      { name: "Garden & Outdoor", slug: "garden-outdoor", description: "Garden tools, plants, and outdoor equipment", icon: "TreePine", color: "#84CC16", order: 4, isFeatured: false, seoTitle: "Garden & Outdoor Supplies", seoDescription: "Find garden tools, plants, and outdoor equipment." },
    ],
  },
  {
    name: "Sports & Outdoors",
    slug: "sports-outdoors",
    description: "Sports equipment, fitness gear, and outdoor gear",
    icon: "Dumbbell",
    color: "#F97316",
    order: 8,
    isFeatured: false,
    seoTitle: "Sports & Outdoors Equipment | Secretza",
    seoDescription: "Buy and sell sports equipment, fitness gear, camping supplies, and outdoor adventure gear.",
    children: [
      { name: "Fitness Equipment", slug: "fitness-equipment", description: "Gym equipment and fitness gear", icon: "Dumbbell", color: "#F97316", order: 1, isFeatured: false, seoTitle: "Fitness Equipment for Sale", seoDescription: "Find gym equipment and fitness gear." },
      { name: "Team Sports", slug: "team-sports", description: "Equipment for football, basketball, cricket, etc.", icon: "Trophy", color: "#F97316", order: 2, isFeatured: false, seoTitle: "Team Sports Equipment", seoDescription: "Browse equipment for team sports." },
      { name: "Cycling", slug: "cycling", description: "Bicycles, parts, and accessories", icon: "Bike", color: "#F97316", order: 3, isFeatured: false, seoTitle: "Cycling Equipment for Sale", seoDescription: "Find bicycles, cycling gear, and accessories." },
    ],
  },
  {
    name: "Books & Media",
    slug: "books-media",
    description: "Books, music, movies, and collectibles",
    icon: "BookOpen",
    color: "#6366F1",
    order: 9,
    isFeatured: false,
    seoTitle: "Books & Media - Buy and Sell | Secretza",
    seoDescription: "Find books, vinyl records, movies, video games, and collectible items.",
    children: [
      { name: "Books", slug: "books", description: "Textbooks, novels, and non-fiction", icon: "BookOpen", color: "#6366F1", order: 1, isFeatured: false, seoTitle: "Books for Sale", seoDescription: "Buy and sell new and used books." },
      { name: "Music & Instruments", slug: "music-instruments", description: "Musical instruments and music media", icon: "Music", color: "#6366F1", order: 2, isFeatured: false, seoTitle: "Music & Instruments for Sale", seoDescription: "Find musical instruments and music media." },
      { name: "Movies & TV", slug: "movies-tv", description: "DVDs, Blu-rays, and streaming accounts", icon: "Film", color: "#6366F1", order: 3, isFeatured: false, seoTitle: "Movies & TV for Sale", seoDescription: "Browse movies, TV series, and media." },
      { name: "Video Games", slug: "video-games", description: "Console games, PC games, and accessories", icon: "Gamepad2", color: "#6366F1", order: 4, isFeatured: false, seoTitle: "Video Games for Sale", seoDescription: "Buy and sell video games and gaming accessories." },
    ],
  },
  {
    name: "Kids & Baby",
    slug: "kids-baby",
    description: "Children's clothing, toys, and baby supplies",
    icon: "Baby",
    color: "#F472B6",
    order: 10,
    isFeatured: false,
    seoTitle: "Kids & Baby Items | Secretza",
    seoDescription: "Find kids clothing, toys, strollers, and baby essentials at great prices.",
    children: [
      { name: "Toys & Games", slug: "toys-games", description: "Toys, puzzles, and board games", icon: "Puzzle", color: "#F472B6", order: 1, isFeatured: false, seoTitle: "Toys & Games for Sale", seoDescription: "Browse toys, puzzles, and board games." },
      { name: "Baby Essentials", slug: "baby-essentials", description: "Strollers, car seats, and baby gear", icon: "Baby", color: "#F472B6", order: 2, isFeatured: false, seoTitle: "Baby Essentials for Sale", seoDescription: "Find baby gear, strollers, and essentials." },
      { name: "Kids Clothing", slug: "kids-clothing", description: "Clothing and footwear for children", icon: "Shirt", color: "#F472B6", order: 3, isFeatured: false, seoTitle: "Kids Clothing for Sale", seoDescription: "Shop children's clothing and footwear." },
    ],
  },
  {
    name: "Pets",
    slug: "pets",
    description: "Pets, pet supplies, and pet services",
    icon: "Dog",
    color: "#A3E635",
    order: 11,
    isFeatured: false,
    seoTitle: "Pets & Pet Supplies | Secretza",
    seoDescription: "Find pets for adoption, pet food, accessories, and pet care services.",
    children: [
      { name: "Dogs", slug: "dogs", description: "Dogs and puppies for adoption and sale", icon: "Dog", color: "#A3E635", order: 1, isFeatured: false, seoTitle: "Dogs for Adoption & Sale", seoDescription: "Find dogs and puppies." },
      { name: "Cats", slug: "cats", description: "Cats and kittens for adoption and sale", icon: "Cat", color: "#A3E635", order: 2, isFeatured: false, seoTitle: "Cats for Adoption & Sale", seoDescription: "Find cats and kittens." },
      { name: "Pet Supplies", slug: "pet-supplies", description: "Pet food, accessories, and equipment", icon: "ShoppingBag", color: "#A3E635", order: 3, isFeatured: false, seoTitle: "Pet Supplies for Sale", seoDescription: "Shop pet food, toys, and accessories." },
    ],
  },
  {
    name: "Business & Industrial",
    slug: "business-industrial",
    description: "Business equipment, machinery, and industrial supplies",
    icon: "Factory",
    color: "#78716C",
    order: 12,
    isFeatured: false,
    seoTitle: "Business & Industrial Equipment | Secretza",
    seoDescription: "Buy and sell business equipment, industrial machinery, and commercial supplies.",
    children: [
      { name: "Office Equipment", slug: "office-equipment", description: "Printers, desks, and office supplies", icon: "Printer", color: "#78716C", order: 1, isFeatured: false, seoTitle: "Office Equipment for Sale", seoDescription: "Find office furniture and equipment." },
      { name: "Industrial Machinery", slug: "industrial-machinery", description: "Manufacturing and industrial equipment", icon: "Cog", color: "#78716C", order: 2, isFeatured: false, seoTitle: "Industrial Machinery for Sale", seoDescription: "Browse industrial and manufacturing equipment." },
      { name: "Restaurant & Food", slug: "restaurant-food", description: "Restaurant equipment and food service", icon: "ChefHat", color: "#78716C", order: 3, isFeatured: false, seoTitle: "Restaurant Equipment for Sale", seoDescription: "Find restaurant and food service equipment." },
    ],
  },
  {
    name: "Art & Collectibles",
    slug: "art-collectibles",
    description: "Fine art, antiques, coins, stamps, and collectible items",
    icon: "Palette",
    color: "#D946EF",
    order: 13,
    isFeatured: false,
    seoTitle: "Art & Collectibles | Secretza",
    seoDescription: "Discover fine art, antiques, vintage items, coins, stamps, and rare collectibles.",
    children: [
      { name: "Fine Art", slug: "fine-art", description: "Paintings, sculptures, and digital art", icon: "Palette", color: "#D946EF", order: 1, isFeatured: false, seoTitle: "Fine Art for Sale", seoDescription: "Browse paintings, sculptures, and art." },
      { name: "Antiques & Vintage", slug: "antiques-vintage", description: "Antique furniture, vintage items", icon: "Hourglass", color: "#D946EF", order: 2, isFeatured: false, seoTitle: "Antiques & Vintage Items", seoDescription: "Find antique and vintage collectibles." },
      { name: "Coins & Stamps", slug: "coins-stamps", description: "Coins, banknotes, and philately", icon: "Coins", color: "#D946EF", order: 3, isFeatured: false, seoTitle: "Coins & Stamps", seoDescription: "Browse coins, banknotes, and stamps." },
    ],
  },
  {
    name: "Music & Instruments",
    slug: "music-instruments",
    description: "Musical instruments and audio equipment for sale",
    icon: "Music",
    color: "#0EA5E9",
    order: 14,
    isFeatured: false,
    seoTitle: "Musical Instruments for Sale | Secretza",
    seoDescription: "Buy and sell guitars, keyboards, drums, DJ equipment, and more.",
    children: [
      { name: "Guitars", slug: "guitars", description: "Acoustic, electric, and bass guitars", icon: "Guitar", color: "#0EA5E9", order: 1, isFeatured: false, seoTitle: "Guitars for Sale", seoDescription: "Find acoustic, electric, and bass guitars." },
      { name: "Keyboards & Pianos", slug: "keyboards-pianos", description: "Keyboards, pianos, and synthesizers", icon: "Piano", color: "#0EA5E9", order: 2, isFeatured: false, seoTitle: "Keyboards & Pianos for Sale", seoDescription: "Browse keyboards, pianos, and synthesizers." },
      { name: "DJ & Audio", slug: "dj-audio", description: "DJ equipment, mixers, and speakers", icon: "Speaker", color: "#0EA5E9", order: 3, isFeatured: false, seoTitle: "DJ & Audio Equipment", seoDescription: "Find DJ equipment, mixers, and audio gear." },
    ],
  },
  {
    name: "Community",
    slug: "community",
    description: "Events, groups, volunteering, and local community",
    icon: "Users",
    color: "#14B8A6",
    order: 15,
    isFeatured: false,
    seoTitle: "Community - Events, Groups, Activities | Secretza",
    seoDescription: "Connect with your local community. Find events, groups, volunteering opportunities, and activities.",
    children: [
      { name: "Events", slug: "events", description: "Local events and activities", icon: "Calendar", color: "#14B8A6", order: 1, isFeatured: false, seoTitle: "Local Events", seoDescription: "Discover local events and activities." },
      { name: "Classes & Workshops", slug: "classes-workshops", description: "Learn new skills and hobbies", icon: "GraduationCap", color: "#14B8A6", order: 2, isFeatured: false, seoTitle: "Classes & Workshops", seoDescription: "Find classes and workshops near you." },
      { name: "Volunteering", slug: "volunteering", description: "Volunteer opportunities", icon: "Heart", color: "#14B8A6", order: 3, isFeatured: false, seoTitle: "Volunteer Opportunities", seoDescription: "Discover ways to volunteer in your community." },
    ],
  },
  {
    name: "Free Stuff",
    slug: "free-stuff",
    description: "Give away items for free or find free items",
    icon: "Gift",
    color: "#22C55E",
    order: 16,
    isFeatured: false,
    seoTitle: "Free Stuff - Giveaways & Donations | Secretza",
    seoDescription: "Find free items, giveaways, and donation listings. Give away items you no longer need.",
    children: [
      { name: "Giveaways", slug: "giveaways", description: "Items being given away for free", icon: "Gift", color: "#22C55E", order: 1, isFeatured: false, seoTitle: "Free Giveaways", seoDescription: "Browse items being given away for free." },
      { name: "Donations", slug: "donations", description: "Charitable donations and requests", icon: "Heart", color: "#22C55E", order: 2, isFeatured: false, seoTitle: "Donations", seoDescription: "Find donation listings and charitable items." },
      { name: "Recycling & Upcycling", slug: "recycling-upcycling", description: "Recyclable materials and upcycled goods", icon: "Recycle", color: "#22C55E", order: 3, isFeatured: false, seoTitle: "Recycling & Upcycling", seoDescription: "Find recyclable materials and upcycled items." },
    ],
  },
];

// ==========================================
// Seed functions
// ==========================================
async function seedCategory(cat: CategoryDef, parentId: string | null = null): Promise<void> {
  const result = await db.category.upsert({
    where: { slug: cat.slug },
    update: {
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      order: cat.order,
      isFeatured: cat.isFeatured,
      parentId,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
    },
    create: {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      order: cat.order,
      isFeatured: cat.isFeatured,
      parentId,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
    },
  });

  if (cat.children && cat.children.length > 0) {
    for (const child of cat.children) {
      await seedCategory(child, result.id);
    }
  }
}

async function main() {
  console.log(`Seeding ${CATEGORIES.length} categories with subcategories...\n`);

  let totalCreated = 0;
  for (const cat of CATEGORIES) {
    const before = await db.category.count();
    await seedCategory(cat);
    const after = await db.category.count();
    totalCreated += (after - before);
  }

  console.log(`\nCategories seeded! Total in DB: ${await db.category.count()}`);
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => db.$disconnect());

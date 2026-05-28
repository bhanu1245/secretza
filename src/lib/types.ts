// ==========================================
// Secretza Type Definitions
// ==========================================

export type UserRole = "user" | "admin" | "moderator";
export type ListingStatus = "pending" | "approved" | "rejected" | "expired";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type AuthProvider = "email" | "google";

// ==========================================
// User Types
// ==========================================
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: UserRole;
  isVerified: boolean;
  isSuspended: boolean;
  isPremium: boolean;
  premiumExpiry: string | null;
  provider: AuthProvider;
  createdAt: string;
}

// ==========================================
// Category Types
// ==========================================
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  listingCount: number;
}

// ==========================================
// Geo Types
// ==========================================
export interface Country {
  id: string;
  name: string;
  code: string;
  slug: string;
  isActive: boolean;
  listingCount: number;
  states?: State[];
}

export interface State {
  id: string;
  name: string;
  slug: string;
  countryId: string;
  isActive: boolean;
  listingCount: number;
  cities?: City[];
}

export interface City {
  id: string;
  name: string;
  slug: string;
  stateId: string;
  isFeatured: boolean;
  isActive: boolean;
  listingCount: number;
}

// ==========================================
// Listing Types
// ==========================================
export interface ListingImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface ListingImageDB {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  width: number;
  height: number;
  sortOrder: number;
  blurHash?: string;
  isPrimary?: boolean;
  sizeBytes?: number;
  moderationStatus?: string;
}

export interface ContactInfo {
  email?: string;
  telegram?: string;
  whatsapp?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  customText?: string;
}

export type RankLabel = "boosted" | "featured" | "rotated" | "standard";

export interface Listing {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: Category;
  country: Country;
  state: State;
  city: City;
  tags: string[];
  price: string | null;
  currency: string;
  contact: ContactInfo;
  images: ListingImage[];
  listingImages?: ListingImageDB[];
  profileImage?: string | null;
  galleryImages?: string[] | string;
  status: ListingStatus;
  isFeatured: boolean;
  isBoosted: boolean;
  featuredUntil: string | null;
  boostUntil: string | null;
  lastBumpedAt: string | null;
  priorityScore: number;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
  user: Pick<User, "id" | "name" | "avatar">;
  computedScore?: number;
  rankLabel?: RankLabel;
  reviewCount?: number;
  averageRating?: number;
}

// ==========================================
// Payment Types
// ==========================================
export interface Payment {
  id: string;
  userId: string;
  listingId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  gatewayTxId: string | null;
  couponCode: string | null;
  createdAt: string;
}

export interface PricingPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: number; // days
  features: string[];
  isPopular?: boolean;
}

// ==========================================
// Search & Filter Types
// ==========================================
export interface SearchFilters {
  keyword?: string;
  categorySlug?: string;
  countrySlug?: string;
  stateSlug?: string;
  citySlug?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "newest" | "featured" | "price_low" | "price_high";
  page?: number;
  limit?: number;
}

export interface SearchResult {
  listings: Listing[];
  total: number;
  page: number;
  totalPages: number;
  facets?: {
    categories: { slug: string; name: string; count: number }[];
    cities: { slug: string; name: string; count: number }[];
    countries: { slug: string; name: string; count: number }[];
  };
}

// ==========================================
// Admin Types
// ==========================================
export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  pendingReview: number;
  totalRevenue: number;
  monthlyRevenue: number;
  featuredListings: number;
  premiumUsers: number;
}

export interface ModerationItem {
  listing: Listing;
  riskScore: number;
  issues: string[];
}

// ==========================================
// Manual Payment Types
// ==========================================
export type ManualPaymentType = "boost" | "feature" | "premium";
export type ManualPaymentStatus = "pending" | "approved" | "rejected" | "proof_requested" | "duplicate";

export interface ManualPaymentSubmission {
  id: string;
  userId: string;
  listingId: string | null;
  paymentType: ManualPaymentType;
  amount: number;
  utrNumber: string;
  screenshotUrl: string | null;
  planLabel?: string | null;
  selectedPlan?: string | null;
  paymentMethod?: string | null;
  notes: string | null;
  status: ManualPaymentStatus;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: { id: string; title: string; slug: string } | null;
  user?: Pick<User, "id" | "email" | "name">;
}

// ==========================================
// App View Types (Client-side navigation)
// ==========================================
export type AppView =
  | "home"
  | "search"
  | "listing"
  | "category"
  | "location"
  | "geo-india"
  | "geo-state"
  | "geo-city"
  | "geo-district"
  | "geo-locality"
  | "auth"
  | "dashboard"
  | "post-ad"
  | "admin"
  | "pricing"
  | "auth-verify"
  | "payment-manual";

export interface NavigationState {
  view: AppView;
  params: Record<string, string>;
}

// ==========================================
// Review Types
// ==========================================
export type ReviewStatus = "pending" | "approved" | "rejected" | "flagged";

export interface Review {
  id: string;
  listingId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  isPremium: boolean;
  status: ReviewStatus;
  helpfulCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
  user: Pick<User, "id" | "name" | "avatar">;
  featuredUntil?: string | null;
}

export interface ReviewSummary {
  count: number;
  averageRating: number;
  ratingDistribution: Record<string, number>; // { "1": 5, "2": 3, ... }
}

export interface ReviewAnalytics {
  totalReviews: number;
  approvedReviews: number;
  pendingReviews: number;
  rejectedReviews: number;
  flaggedReviews: number;
  averageRating: number;
  reviewsByDay: Array<{ date: string; count: number; avgRating: number }>;
  topRatedListings: Array<{ listingId: string; title: string; avgRating: number; reviewCount: number }>;
  recentFlagged: Review[];
}

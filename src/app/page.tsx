'use client';

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ADMIN_HOME, isAdminRole } from "@/lib/admin-nav";
import { useNavigationStore, useUIStore, useAuthStore } from "@/store/useAppStore";
import { useListing, useListings, useCategories } from "@/hooks/useApiData";

type PricingTier = {
  label: string;
  amount: number;
  durationMinutes?: number;
  durationDays?: number;
};

type PaymentSettingsConfig = {
  upiId: string;
  whatsappNumber: string;
  instructions: string[];
  qrImageUrl: string | null;
  boostTiers: PricingTier[];
  featuredTiers: PricingTier[];
  premiumTiers: PricingTier[];
};

// Layout
import Header from "@/components/secretza/layout/Header";
import Footer from "@/components/secretza/layout/Footer";
import MobileBottomNav from "@/components/secretza/layout/MobileBottomNav";

// Home Sections
import HeroSection from "@/components/secretza/home/HeroSection";
import CategoryGrid from "@/components/secretza/home/CategoryGrid";
import TrendingCities from "@/components/secretza/home/TrendingCities";
import FeaturedListings from "@/components/secretza/home/FeaturedListings";
import LatestListings from "@/components/secretza/home/LatestListings";
import TrustSection from "@/components/secretza/home/TrustSection";

// Listing
import ListingDetail from "@/components/secretza/listing/ListingDetail";
import ListingCard from "@/components/secretza/listing/ListingCard";
import SearchResults from "@/components/secretza/listing/SearchResults";
import CreateListingForm from "@/components/secretza/listing/CreateListingForm";

// Auth
import AuthModal from "@/components/secretza/auth/AuthModal";
import AuthVerificationDashboard from "@/components/secretza/auth/AuthVerificationDashboard";

// Dashboard
import Dashboard from "@/components/secretza/dashboard/Dashboard";

// Payment
import ManualPaymentPage from "@/components/secretza/payment/ManualPaymentPage";

// Geo Explorer
import IndiaGeoExplorer from "@/components/secretza/geo/IndiaGeoExplorer";
import { parseSpaDeepLink } from "@/lib/public-navigation";
import { toast } from "sonner";

// ==========================================
// View Transitions
// ==========================================
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ==========================================
// Home Page
// ==========================================
function HomePage() {
  return (
    <div className="flex flex-col gap-0">
      <HeroSection />
      <CategoryGrid />
      <TrendingCities />
      <FeaturedListings />
      <LatestListings />
      <TrustSection />
    </div>
  );
}

// ==========================================
// Category Page — Fetches real data from API
// ==========================================
function CategoryPage({ slug }: { slug: string }) {
  const navigate = useNavigationStore((s) => s.navigate);
  const { categories } = useCategories();
  const { listings: categoryListings, loading, total } = useListings({
    category: slug,
    limit: 24,
  });

  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Category Not Found</h1>
        <p className="text-muted-foreground mb-6">The category you&apos;re looking for doesn&apos;t exist.</p>
        <button onClick={() => navigate("home")} className="text-violet hover:text-violet-hover">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <button onClick={() => navigate("home")} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{category.name}</h1>
        <p className="text-muted-foreground mt-2">{category.description || `Browse ${category.listingCount.toLocaleString()} ${category.name.toLowerCase()} listings worldwide`}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: category.color }}>
            {total} Listings
          </span>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin size-8 border-2 border-violet/30 border-t-violet rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading listings...</p>
        </div>
      ) : categoryListings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No listings in this category yet.</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Location Page — City listings filtered from API
// ==========================================
function LocationPage({
  country,
  state,
  city,
}: {
  country: string;
  state: string;
  city: string;
}) {
  const navigate = useNavigationStore((s) => s.navigate);
  const { listings, loading, total, error } = useListings({
    country,
    state,
    city,
    limit: 24,
    sortBy: "relevance",
  });

  const cityLabel = city
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const stateLabel = state
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const countryLabel = country
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <button
          onClick={() => navigate("home")}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          Listings in {cityLabel}
        </h1>
        <p className="text-muted-foreground mt-2">
          {stateLabel}, {countryLabel}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-violet">
            {total} Listings
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin size-8 border-2 border-violet/30 border-t-violet rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading listings...</p>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-400 mb-2">Failed to load city listings.</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No approved listings in {cityLabel} yet.
          </p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Pricing Page — reads live tiers from PaymentSettings (single source of truth)
// ==========================================
function CheckMark() {
  return (
    <svg className="size-4 text-violet shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PricingPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const { isAuthenticated, setAuthModalOpen, setAuthModalTab } = useAuthStore();
  const [config, setConfig] = useState<PaymentSettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/payment-settings")
      .then((res) => res.json())
      .then((data) => { if (mounted) setConfig(data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const requireAuth = (cb: () => void) => {
    if (!isAuthenticated) {
      setAuthModalTab("register");
      setAuthModalOpen(true);
      return;
    }
    cb();
  };

  const boostMin   = config ? Math.min(...config.boostTiers.map((t) => t.amount))   : null;
  const featureMin = config ? Math.min(...config.featuredTiers.map((t) => t.amount)) : null;
  const premiumTier = config?.premiumTiers[0] ?? null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <button onClick={() => navigate("home")} className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1">
        ← Back
      </button>
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          Choose Your <span className="text-violet">Plan</span>
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Select the perfect plan to boost your visibility and reach more potential clients.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Loading pricing plans...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* ── Free / Basic ─────────────────────────────── */}
          <motion.div whileHover={{ y: -4 }} className="relative rounded-xl border border-border bg-surface p-6 flex flex-col hover:border-violet/30">
            <h3 className="text-lg font-bold text-foreground">Basic</h3>
            <p className="text-xs text-muted-foreground mt-1">Get started with a standard listing</p>
            <div className="mt-4 mb-6">
              <span className="text-3xl font-bold text-foreground">Free</span>
            </div>
            <ul className="flex-1 space-y-2.5 mb-6">
              {["1 active listing", "3 images per listing", "Standard search visibility", "7-day listing duration"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckMark />{f}</li>
              ))}
            </ul>
            <button
              onClick={() => requireAuth(() => navigate("post-ad"))}
              className="w-full py-2.5 rounded-lg font-semibold text-sm border border-border text-foreground hover:bg-surface-light hover:border-violet/30 transition-all"
            >
              Post Free Ad
            </button>
          </motion.div>

          {/* ── Boost ────────────────────────────────────── */}
          <motion.div whileHover={{ y: -4 }} className="relative rounded-xl border border-border bg-surface p-6 flex flex-col hover:border-violet/30">
            <h3 className="text-lg font-bold text-foreground">Boost</h3>
            <p className="text-xs text-muted-foreground mt-1">Push your listing to the top temporarily</p>
            <div className="mt-4 mb-6">
              {boostMin !== null ? (
                <>
                  <span className="text-sm text-muted-foreground">From </span>
                  <span className="text-3xl font-bold text-foreground">₹{boostMin}</span>
                </>
              ) : (
                <span className="text-3xl font-bold text-foreground">—</span>
              )}
            </div>
            <ul className="flex-1 space-y-2.5 mb-6">
              {config?.boostTiers.map((t) => (
                <li key={t.label} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckMark />
                  {t.label} — ₹{t.amount}
                </li>
              )) ?? []}
              {["Instant visibility boost", "Appears above regular listings"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckMark />{f}</li>
              ))}
            </ul>
            <button
              onClick={() => requireAuth(() => navigate("payment-manual", { paymentType: "boost" }))}
              className="w-full py-2.5 rounded-lg font-semibold text-sm border border-border text-foreground hover:bg-surface-light hover:border-violet/30 transition-all"
            >
              Boost a Listing
            </button>
          </motion.div>

          {/* ── Featured ─────────────────────────────────── */}
          <motion.div whileHover={{ y: -4 }} className="relative rounded-xl border border-violet/50 violet-glow bg-surface p-6 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-violet text-[10px] font-bold text-white uppercase tracking-wider">
              Most Popular
            </div>
            <h3 className="text-lg font-bold text-foreground">Featured</h3>
            <p className="text-xs text-muted-foreground mt-1">Stand out with a featured listing badge</p>
            <div className="mt-4 mb-6">
              {featureMin !== null ? (
                <>
                  <span className="text-sm text-muted-foreground">From </span>
                  <span className="text-3xl font-bold text-foreground">₹{featureMin}</span>
                </>
              ) : (
                <span className="text-3xl font-bold text-foreground">—</span>
              )}
            </div>
            <ul className="flex-1 space-y-2.5 mb-6">
              {config?.featuredTiers.map((t) => (
                <li key={t.label} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckMark />
                  {t.label} — ₹{t.amount}
                </li>
              )) ?? []}
              {["Featured badge on listing", "Priority placement in search"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckMark />{f}</li>
              ))}
            </ul>
            <button
              onClick={() => requireAuth(() => navigate("payment-manual", { paymentType: "feature" }))}
              className="w-full py-2.5 rounded-lg font-semibold text-sm gradient-violet text-white hover:opacity-90 shadow-md shadow-violet/20 transition-all"
            >
              Feature a Listing
            </button>
          </motion.div>

          {/* ── Premium ──────────────────────────────────── */}
          <motion.div whileHover={{ y: -4 }} className="relative rounded-xl border border-border bg-surface p-6 flex flex-col hover:border-violet/30">
            <h3 className="text-lg font-bold text-foreground">Premium</h3>
            <p className="text-xs text-muted-foreground mt-1">Maximum exposure across all your listings</p>
            <div className="mt-4 mb-6">
              {premiumTier ? (
                <>
                  <span className="text-3xl font-bold text-foreground">₹{premiumTier.amount}</span>
                  <span className="text-sm text-muted-foreground">/{premiumTier.durationDays}d</span>
                </>
              ) : (
                <span className="text-3xl font-bold text-foreground">—</span>
              )}
            </div>
            <ul className="flex-1 space-y-2.5 mb-6">
              {["Premium badge on all listings", "Top-priority ranking", "All listings boosted", "Multiple active listings"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckMark />{f}</li>
              ))}
            </ul>
            <button
              onClick={() => requireAuth(() => navigate("payment-manual", { paymentType: "premium" }))}
              className="w-full py-2.5 rounded-lg font-semibold text-sm border border-border text-foreground hover:bg-surface-light hover:border-violet/30 transition-all"
            >
              Get Premium
            </button>
          </motion.div>

        </div>
      )}
    </div>
  );
}

// ==========================================
// Main App Component
// ==========================================
function HomeApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nav = useNavigationStore((s) => s.nav);
  const selectedListingId = useUIStore((s) => s.selectedListingId);
  const setSelectedListingId = useUIStore((s) => s.setSelectedListingId);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  // Fetch the selected listing from the API (fixes BUG #2)
  const { listing: selectedListing, loading: listingLoading } = useListing(selectedListingId);

  // Fetch listings for the "Browse Listings" grid (fixes BUG #4)
  const { listings: browseListings, loading: browseLoading } = useListings({ limit: 8 });

  // Handle deep-links from SSR pages (?view=pricing&tab=listings etc.)
  useEffect(() => {
    const deepLink = parseSpaDeepLink(searchParams);
    if (!deepLink) return;
    navigate(deepLink.view, deepLink.params);
    router.replace("/", { scroll: false });
  }, [searchParams, navigate, router]);

  // Handle OAuth errors redirected back to / by NextAuth (pages.error: "/").
  // OAuthAccountNotLinked: user tried Google sign-in but an email/password
  // account already exists with the same address.
  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    if (error === "OAuthAccountNotLinked") {
      toast.error("Account already exists", {
        description:
          "An account with this email already exists. Please sign in with your email and password.",
      });
      setAuthModalTab("login");
      setAuthModalOpen(true);
    }
    // Clear the error param from the URL so it does not persist on refresh.
    router.replace("/", { scroll: false });
  }, [searchParams, router, setAuthModalOpen, setAuthModalTab]);

  // Redirect unauthenticated users away from protected views (after render, not during)
  useEffect(() => {
    if (nav.view === "dashboard" && !isAuthenticated) {
      navigate("home");
    }
  }, [nav.view, isAuthenticated, navigate]);

  // Legacy SPA admin view → canonical /admin route
  useEffect(() => {
    if (nav.view !== "admin") return;
    if (!isAuthenticated || !user || !isAdminRole(user.role)) {
      navigate(isAuthenticated ? "dashboard" : "home");
      return;
    }
    router.replace(ADMIN_HOME);
    navigate("home");
  }, [nav.view, isAuthenticated, user, navigate, router]);

  // Full-page views (no header/footer)
  if (nav.view === "dashboard") {
    if (!isAuthenticated) {
      return null;
    }
    return (
      <>
        <Dashboard />
        <AuthModal />
      </>
    );
  }

  if (nav.view === "admin") {
    return null;
  }

  // Auth Verification Dashboard (full-page, no header/footer)
  if (nav.view === "auth-verify") {
    return <AuthVerificationDashboard />;
  }

  // Manual Payment Page (full-page, no header/footer)
  if (nav.view === "payment-manual") {
    return (
      <>
        <ManualPaymentPage
          listingId={nav.params.listingId}
          paymentType={(nav.params.paymentType as "boost" | "feature" | "premium") || "boost"}
          listingTitle={nav.params.listingTitle}
        />
        <AuthModal />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-16 pb-16 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={nav.view + JSON.stringify(nav.params)}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[calc(100vh-8rem)]"
          >
            {nav.view === "home" && <HomePage />}

            {nav.view === "search" && <SearchResults />}

            {nav.view === "listing" && (
              <div className="max-w-7xl mx-auto px-4 py-8">
                <button
                  onClick={() => {
                    setSelectedListingId(null);
                    navigate("home");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
                >
                  ← Back
                </button>
                <p className="text-muted-foreground">Select a listing to view details</p>
                {browseLoading ? (
                  <div className="text-center py-16">
                    <div className="animate-spin size-8 border-2 border-violet/30 border-t-violet rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading listings...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    {browseListings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {nav.view === "category" && (
              <CategoryPage slug={nav.params.slug || ""} />
            )}

            {nav.view === "location" && (
              <LocationPage
                country={nav.params.country || ""}
                state={nav.params.state || ""}
                city={nav.params.city || ""}
              />
            )}

            {nav.view === "post-ad" && (
              <div className="max-w-4xl mx-auto px-4 py-8">
                <button
                  onClick={() => navigate(nav.params?.mode === "edit" ? "dashboard" : "home")}
                  className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1"
                >
                  ← Back
                </button>
                <CreateListingForm
                  editListingId={nav.params.listingId || null}
                  editMode={nav.params.mode === "edit"}
                />
              </div>
            )}

            {nav.view === "pricing" && <PricingPage />}

            {/* Geo Explorer */}
            {(nav.view === "geo-india" ||
              nav.view === "geo-state" ||
              nav.view === "geo-city" ||
              nav.view === "geo-district" ||
              nav.view === "geo-locality") && <IndiaGeoExplorer />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer (hidden on mobile when bottom nav is shown) */}
      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />

      {/* Modals */}
      <AuthModal />
      {selectedListing && (
        <ListingDetail
          listing={selectedListing}
          isOpen={true}
          onClose={() => setSelectedListingId(null)}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeApp />
    </Suspense>
  );
}

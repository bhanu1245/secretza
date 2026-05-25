'use client';

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigationStore, useUIStore, useAuthStore } from "@/store/useAppStore";
import { useListing, useListings, useCategories } from "@/hooks/useApiData";
import { pricingPackages } from "@/lib/config";

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

// Admin
import AdminPanel from "@/components/secretza/admin/AdminPanel";

// Payment
import ManualPaymentPage from "@/components/secretza/payment/ManualPaymentPage";

// Geo Explorer
import IndiaGeoExplorer from "@/components/secretza/geo/IndiaGeoExplorer";

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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <CategoryGrid />
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <TrendingCities />
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <FeaturedListings />
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <LatestListings />
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <TrustSection />
      </section>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
// Pricing Page — Uses pricingPackages from config
// ==========================================
function PricingPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const { isAuthenticated, setAuthModalOpen, setAuthModalTab } = useAuthStore();
  const handleSelectPackage = (pkg: typeof pricingPackages[0]) => {
    if (!isAuthenticated) {
      setAuthModalTab("register");
      setAuthModalOpen(true);
      return;
    }
    navigate("post-ad", { package: pkg.id });
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {pricingPackages.map((pkg: typeof pricingPackages[0]) => (
          <motion.div
            key={pkg.id}
            whileHover={{ y: -4 }}
            className={`relative rounded-xl border bg-surface p-6 flex flex-col ${
              pkg.isPopular
                ? "border-violet/50 violet-glow"
                : "border-border hover:border-violet/30"
            }`}
          >
            {pkg.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-violet text-[10px] font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
            )}
            <h3 className="text-lg font-bold text-foreground">{pkg.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
            <div className="mt-4 mb-6">
              {pkg.price === 0 ? (
                <span className="text-3xl font-bold text-foreground">Free</span>
              ) : (
                <>
                  <span className="text-3xl font-bold text-foreground">${pkg.price}</span>
                  <span className="text-sm text-muted-foreground">/{pkg.duration}d</span>
                </>
              )}
            </div>
            <ul className="flex-1 space-y-2.5 mb-6">
              {pkg.features.map((feature: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <svg className="size-4 text-violet shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelectPackage(pkg)}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                pkg.isPopular
                  ? "gradient-violet text-white hover:opacity-90 shadow-md shadow-violet/20"
                  : "border border-border text-foreground hover:bg-surface-light hover:border-violet/30"
              }`}
            >
              {pkg.price === 0 ? "Get Started" : "Select Plan"}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Main App Component
// ==========================================
export default function Home() {
  const nav = useNavigationStore((s) => s.nav);
  const selectedListingId = useUIStore((s) => s.selectedListingId);
  const setSelectedListingId = useUIStore((s) => s.setSelectedListingId);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Fetch the selected listing from the API (fixes BUG #2)
  const { listing: selectedListing, loading: listingLoading } = useListing(selectedListingId);

  // Fetch listings for the "Browse Listings" grid (fixes BUG #4)
  const { listings: browseListings, loading: browseLoading } = useListings({ limit: 8 });

  // Redirect unauthenticated users away from protected views (after render, not during)
  useEffect(() => {
    if (nav.view === "dashboard" && !isAuthenticated) {
      navigate("home");
    }
  }, [nav.view, isAuthenticated, navigate]);

  // Redirect unauthenticated users away from admin view
  useEffect(() => {
    if (nav.view === "admin" && (!isAuthenticated || !user || (user.role !== "admin" && user.role !== "moderator"))) {
      navigate(isAuthenticated ? "dashboard" : "home");
    }
  }, [nav.view, isAuthenticated, user, navigate]);

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
    if (!isAuthenticated || !user || (user.role !== "admin" && user.role !== "moderator")) {
      return null;
    }
    return (
      <>
        <AdminPanel />
        <AuthModal />
      </>
    );
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
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

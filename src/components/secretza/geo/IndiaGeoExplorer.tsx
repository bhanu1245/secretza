"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, ChevronRight, ChevronLeft, Search, Globe, Building2, Map, Navigation } from "lucide-react";
import { useNavigationStore } from "@/store/useAppStore";
import { usePublicNavigation } from "@/hooks/usePublicNavigation";

// ==========================================
// Types
// ==========================================
interface GeoState {
  id: string;
  name: string;
  slug: string;
  cityCount: number;
}

interface GeoCity {
  id: string;
  name: string;
  slug: string;
  isFeatured: boolean;
  districtCount?: number;
}

interface GeoDistrict {
  id: string;
  name: string;
  slug: string;
  localityCount?: number;
}

interface GeoLocality {
  id: string;
  name: string;
  slug: string;
}

// ==========================================
// India Geo Explorer Component
// ==========================================
export default function IndiaGeoExplorer() {
  const navigate = useNavigationStore((s) => s.navigate);
  const { goHome } = usePublicNavigation();
  const nav = useNavigationStore((s) => s.nav);

  // Data state
  const [states, setStates] = useState<GeoState[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [districts, setDistricts] = useState<GeoDistrict[]>([]);
  const [localities, setLocalities] = useState<GeoLocality[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    name: string;
    slug: string;
    city: { name: string; slug: string };
    state: { name: string; slug: string };
    district: { name: string; slug: string };
  }>>([]);

  // Current breadcrumb context
  const [breadcrumb, setBreadcrumb] = useState<
    Array<{ label: string; slug: string; view: string }>
  >([]);

  // Fetch functions
  const fetchIndia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/geo/india");
      if (res.ok) {
        const data = await res.json();
        setStates(data.states || []);
        setCities([]);
        setDistricts([]);
        setLocalities([]);
        setBreadcrumb([{ label: "India", slug: "india", view: "geo-india" }]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchState = useCallback(async (stateSlug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/geo/india/${stateSlug}`);
      if (res.ok) {
        const data = await res.json();
        setCities(data.cities || []);
        setDistricts([]);
        setLocalities([]);
        setBreadcrumb([
          { label: "India", slug: "india", view: "geo-india" },
          { label: data.state.name, slug: stateSlug, view: "geo-state" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCity = useCallback(async (stateSlug: string, citySlug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/geo/india/${stateSlug}/${citySlug}`);
      if (res.ok) {
        const data = await res.json();
        setDistricts(data.districts || []);
        setLocalities([]);
        setBreadcrumb([
          { label: "India", slug: "india", view: "geo-india" },
          { label: data.state.name, slug: stateSlug, view: "geo-state" },
          { label: data.city.name, slug: citySlug, view: "geo-city" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDistrict = useCallback(
    async (stateSlug: string, citySlug: string, districtSlug: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/geo/india/${stateSlug}/${citySlug}/${districtSlug}`
        );
        if (res.ok) {
          const data = await res.json();
          setLocalities(data.localities || []);
          setBreadcrumb([
            { label: "India", slug: "india", view: "geo-india" },
            { label: data.state.name, slug: stateSlug, view: "geo-state" },
            { label: data.city.name, slug: citySlug, view: "geo-city" },
            { label: data.district.name, slug: districtSlug, view: "geo-district" },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const searchLocalities = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/geo/india/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Handle navigation
  useEffect(() => {
    const { view, params } = nav;
    if (view === "geo-india") {
      fetchIndia();
    } else if (view === "geo-state") {
      fetchState(params.stateSlug || "");
    } else if (view === "geo-city") {
      fetchCity(params.stateSlug || "", params.citySlug || "");
    } else if (view === "geo-district") {
      fetchDistrict(
        params.stateSlug || "",
        params.citySlug || "",
        params.districtSlug || ""
      );
    } else if (view === "geo-locality") {
      // For locality, we just show the breadcrumb
    }
  }, [nav.view, nav.params, fetchIndia, fetchState, fetchCity, fetchDistrict]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchLocalities(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchLocalities]);

  // Determine what to show
  const currentView = nav.view;
  const params = nav.params;

  const handleStateClick = (slug: string) => {
    navigate("geo-state", { stateSlug: slug });
  };

  const handleCityClick = (slug: string) => {
    navigate("geo-city", { stateSlug: params.stateSlug || "", citySlug: slug });
  };

  const handleDistrictClick = (slug: string) => {
    navigate("geo-district", {
      stateSlug: params.stateSlug || "",
      citySlug: params.citySlug || "",
      districtSlug: slug,
    });
  };

  const handleBreadcrumbClick = (index: number) => {
    const item = breadcrumb[index];
    navigate(item.view as any, {
      stateSlug: index >= 1 ? breadcrumb[1]?.slug : "",
      citySlug: index >= 2 ? breadcrumb[2]?.slug : "",
      districtSlug: index >= 3 ? breadcrumb[3]?.slug : "",
    });
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={goHome}
          className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to Home
        </button>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search localities across India..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet/50 focus:border-violet/50 transition-all"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
              {searchResults.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    navigate("geo-district", {
                      stateSlug: r.state.slug,
                      citySlug: r.city.slug,
                      districtSlug: r.district.slug,
                    });
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-light transition-colors flex items-center justify-between"
                >
                  <span className="text-foreground">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {r.city.name}, {r.state.name}
                    </span>
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Breadcrumbs */}
        <nav className="mb-6">
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {breadcrumb.map((item, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                )}
                {i < breadcrumb.length - 1 ? (
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    className="text-violet hover:text-violet-hover transition-colors"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="text-foreground font-medium">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin size-8 border-2 border-violet/30 border-t-violet rounded-full mb-4" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : currentView === "geo-india" ? (
          /* States Grid */
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Globe className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Explore India
                </h1>
                <p className="text-muted-foreground text-sm">
                  {states.length} states &amp; union territories
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {states
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((state) => (
                  <button
                    key={state.id}
                    onClick={() => handleStateClick(state.slug)}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface hover:border-violet/30 hover:bg-surface-light transition-all group p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="size-4 text-muted-foreground group-hover:text-violet transition-colors" />
                      <span className="text-sm font-medium text-foreground">
                        {state.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-surface px-2 py-1 rounded-md">
                      {state.cityCount}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ) : currentView === "geo-state" ? (
          /* Cities Grid */
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Building2 className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {breadcrumb[breadcrumb.length - 1]?.label}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {cities.length} cities
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {cities
                .sort((a, b) => {
                  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleCityClick(city.slug)}
                    className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all group ${
                      city.isFeatured
                        ? "border-violet/30 bg-violet/5 hover:border-violet/50"
                        : "border-border bg-surface hover:border-violet/30 hover:bg-surface-light"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin
                        className={`size-4 transition-colors ${
                          city.isFeatured
                            ? "text-violet"
                            : "text-muted-foreground group-hover:text-violet"
                        }`}
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground block">
                          {city.name}
                        </span>
                        {city.isFeatured && (
                          <span className="text-[10px] text-violet font-medium">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-violet transition-colors" />
                  </button>
                ))}
            </div>
          </div>
        ) : currentView === "geo-city" ? (
          /* Districts Grid */
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Map className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {breadcrumb[breadcrumb.length - 1]?.label}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {districts.length} areas
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {districts.map((district) => (
                <button
                  key={district.id}
                  onClick={() => handleDistrictClick(district.slug)}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface hover:border-violet/30 hover:bg-surface-light transition-all group p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Navigation className="size-4 text-muted-foreground group-hover:text-violet transition-colors" />
                    <span className="text-sm font-medium text-foreground">
                      {district.name}
                    </span>
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-violet transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : currentView === "geo-district" ? (
          /* Localities List */
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <MapPin className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {breadcrumb[breadcrumb.length - 1]?.label}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {localities.length} localities
                </p>
              </div>
            </div>
            {localities.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {localities.map((locality) => (
                  <div
                    key={locality.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <MapPin className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {locality.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MapPin className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No localities found</p>
              </div>
            )}
          </div>
        ) : currentView === "geo-locality" ? (
          <div className="text-center py-12">
            <MapPin className="size-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {breadcrumb[breadcrumb.length - 1]?.label}
            </h2>
            <p className="text-muted-foreground text-sm">
              Browse listings in this area
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

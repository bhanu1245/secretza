"use client";

import { useState, useEffect } from "react";
import type { Listing, Category, Country, State, City } from "@/lib/types";

// ==========================================
// useListings — Fetches listings from /api/listings
// ==========================================
export function useListings(options?: {
  featured?: boolean;
  category?: string;
  country?: string;
  state?: string;
  city?: string;
  keyword?: string;
  sortBy?: string;
  limit?: number;
  page?: number;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize options for stable dependency
  const key = JSON.stringify(options || {});

  useEffect(() => {
    const params = new URLSearchParams();
    if (options?.featured) params.set("featured", "true");
    if (options?.category) params.set("category", options.category);
    if (options?.country) params.set("country", options.country);
    if (options?.state) params.set("state", options.state);
    if (options?.city) params.set("city", options.city);
    if (options?.keyword) params.set("keyword", options.keyword);
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    // NaN validation for page/limit
    const safeLimit = options?.limit != null && !isNaN(options.limit) ? options.limit : null;
    const safePage = options?.page != null && !isNaN(options.page) ? options.page : null;
    if (safeLimit) params.set("limit", String(safeLimit));
    if (safePage) params.set("page", String(safePage));

    // Use microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });

    // Debounce for search/filter changes
    const timer = setTimeout(() => {
      fetch(`/api/listings?${params}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setListings(data.listings || []);
          setTotal(data.total || 0);
        })
        .catch((err) => {
          setError(err?.message || "Failed to fetch listings");
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [key]);

  return { listings, total, loading, error };
}

// ==========================================
// useCategories — Fetches categories from /api/categories
// ==========================================
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch((err) => {
        setError(err?.message || "Failed to fetch categories");
      })
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading, error };
}

// ==========================================
// useLocations — Fetches flat country list from /api/locations
// ==========================================
export function useLocations() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/locations")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.countries && data.countries.length > 0) {
          setCountries(data.countries);
        }
      })
      .catch((err) => {
        setError(err?.message || "Failed to fetch locations");
      })
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading, error };
}

// ==========================================
// useCountryDetail — Fetches a single country with nested states/cities
// from /api/locations?country={slug}
// ==========================================
export function useCountryDetail(countrySlug?: string) {
  const [fetchedCountry, setFetchedCountry] = useState<
    (Country & { states?: (State & { cities?: City[] })[] }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countrySlug) return;
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });
    fetch(`/api/locations?country=${countrySlug}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setFetchedCountry(data.country || null))
      .catch((err) => {
        setError(err?.message || "Failed to fetch country detail");
        setFetchedCountry(null);
      })
      .finally(() => setLoading(false));
  }, [countrySlug]);

  // Derive country: null when no slug is provided
  const country = countrySlug ? fetchedCountry : null;

  return { country, loading, error };
}

// ==========================================
// useTrendingCities — Fetches featured cities by iterating top 5 countries only
// ==========================================
export function useTrendingCities() {
  const [cities, setCities] = useState<
    (City & { state: State; country: Country })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all countries, then fetch only top 5 countries' detail for featured cities
    fetch("/api/locations")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Only fetch details for top 5 countries to avoid N+1 storm
        const topCountries: string[] = (data.countries || [])
          .slice(0, 5)
          .map((c: Country) => c.slug);

        return Promise.all(
          topCountries.map((slug: string) =>
            fetch(`/api/locations?country=${slug}`)
              .then((r) => r.json())
              .then((d) => d.country)
              .catch(() => null)
          )
        );
      })
      .then((countryDetails) => {
        const allCities: (City & { state: State; country: Country })[] = [];
        for (const c of countryDetails) {
          if (!c || !c.states) continue;
          for (const s of c.states) {
            if (!s.cities) continue;
            for (const city of s.cities) {
              if (city.listingCount > 0 || city.isFeatured) {
                allCities.push({
                  ...city,
                  state: {
                    id: s.id,
                    name: s.name,
                    slug: s.slug,
                    countryId: s.countryId,
                    isActive: s.isActive,
                    listingCount: s.listingCount,
                  },
                  country: {
                    id: c.id,
                    name: c.name,
                    code: c.code,
                    slug: c.slug,
                    isActive: c.isActive,
                    listingCount: c.listingCount,
                  },
                });
              }
            }
          }
        }
        allCities.sort((a, b) => b.listingCount - a.listingCount);
        setCities(allCities.slice(0, 12));
      })
      .catch((err) => {
        setError(err?.message || "Failed to fetch trending cities");
      })
      .finally(() => setLoading(false));
  }, []);

  return { cities, loading, error };
}

// ==========================================
// useListing — Fetch a single listing by ID
// ==========================================
export function useListing(id: string | null) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      // Use microtask to avoid synchronous setState in effect
      Promise.resolve().then(() => setListing(null));
      return;
    }
    // Use microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });
    fetch(`/api/listings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setListing(data))
      .catch((err) => {
        setError(err?.message || "Failed to fetch listing");
        setListing(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { listing, loading, error };
}

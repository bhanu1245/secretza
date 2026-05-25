"use client";

import { useState, useEffect, useRef } from "react";
import type { Listing, Category, Country, State, City } from "@/lib/types";
import {
  mockListings,
  categories as mockCategories,
  countries as mockCountries,
  trendingCities as mockTrendingCities,
  featuredListings as mockFeaturedListings,
  latestListings as mockLatestListings,
} from "@/lib/mock-data";

// ==========================================
// useListings — Fetches listings from /api/listings
// Falls back to mock data for instant initial render.
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
  const [listings, setListings] = useState<Listing[]>(() => {
    if (options?.featured) return mockFeaturedListings;
    if (options?.sortBy === "newest") return mockLatestListings;
    return mockListings;
  });
  const [total, setTotal] = useState(listings.length);
  const [loading, setLoading] = useState(false);
  const isFirstMount = useRef(true);

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
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.page) params.set("page", String(options.page));

    // On first mount, fetch silently (mock data is showing)
    // On subsequent changes, show loading indicator
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetch(`/api/listings?${params}`)
        .then((res) => res.json())
        .then((data) => {
          setListings(data.listings || []);
          setTotal(data.total || 0);
        })
        .catch(() => {
          // Keep mock data on error
        });
      return;
    }

    // Debounce for search/filter changes
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/listings?${params}`)
        .then((res) => res.json())
        .then((data) => {
          setListings(data.listings || []);
          setTotal(data.total || 0);
        })
        .catch(() => {
          // Keep current data on error
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [key]);

  return { listings, total, loading };
}

// ==========================================
// useCategories — Fetches categories from /api/categories
// Falls back to mock data for instant initial render.
// ==========================================
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        // Keep mock data on error
      })
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}

// ==========================================
// useLocations — Fetches flat country list from /api/locations
// Falls back to mock data for instant initial render.
// ==========================================
export function useLocations() {
  const [countries, setCountries] = useState<Country[]>(mockCountries);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        if (data.countries && data.countries.length > 0) {
          setCountries(data.countries);
        }
      })
      .catch(() => {
        // Keep mock data on error
      })
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading };
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

  useEffect(() => {
    if (!countrySlug) return;
    fetch(`/api/locations?country=${countrySlug}`)
      .then((res) => res.json())
      .then((data) => setFetchedCountry(data.country || null))
      .catch(() => {
        // Fallback: find country in mock data
        const mockCountry = mockCountries.find((c) => c.slug === countrySlug);
        setFetchedCountry(mockCountry || null);
      })
      .finally(() => setLoading(false));
  }, [countrySlug]);

  // Derive country: null when no slug is provided
  const country = countrySlug ? fetchedCountry : null;

  return { country, loading };
}

// ==========================================
// useTrendingCities — Fetches featured cities by iterating all countries
// Falls back to mock trending cities for instant initial render.
// ==========================================
export function useTrendingCities() {
  const [cities, setCities] = useState<
    (City & { state: State; country: Country })[]
  >(mockTrendingCities);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch all countries, then fetch each country's detail for featured cities
    fetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        const countrySlugs: string[] = (data.countries || []).map(
          (c: Country) => c.slug
        );
        // Fetch each country's detail to collect featured cities
        return Promise.all(
          countrySlugs.map((slug: string) =>
            fetch(`/api/locations?country=${slug}`)
              .then((r) => r.json())
              .then((d) => d.country)
              .catch(() => null)
          )
        );
      })
      .then((countryDetails) => {
        const allFeatured: (City & { state: State; country: Country })[] = [];
        for (const c of countryDetails) {
          if (!c || !c.states) continue;
          for (const s of c.states) {
            if (!s.cities) continue;
            for (const city of s.cities) {
              if (city.isFeatured) {
                allFeatured.push({
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
        // Only update if we got results from the API
        if (allFeatured.length > 0) {
          setCities(allFeatured);
        }
      })
      .catch(() => {
        // Keep mock data on error
      })
      .finally(() => setLoading(false));
  }, []);

  return { cities, loading };
}

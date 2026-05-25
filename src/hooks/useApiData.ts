"use client";

import { useState, useEffect, useRef } from "react";
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

    // Debounce for search/filter changes
    const timer = setTimeout(() => {
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
// ==========================================
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        // Keep empty on error
      })
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}

// ==========================================
// useLocations — Fetches flat country list from /api/locations
// ==========================================
export function useLocations() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        if (data.countries && data.countries.length > 0) {
          setCountries(data.countries);
        }
      })
      .catch(() => {
        // Keep empty on error
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
        setFetchedCountry(null);
      })
      .finally(() => setLoading(false));
  }, [countrySlug]);

  // Derive country: null when no slug is provided
  const country = countrySlug ? fetchedCountry : null;

  return { country, loading };
}

// ==========================================
// useTrendingCities — Fetches featured cities by iterating all countries
// ==========================================
export function useTrendingCities() {
  const [cities, setCities] = useState<
    (City & { state: State; country: Country })[]
  >([]);
  const [loading, setLoading] = useState(true);

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
        setCities(allFeatured);
      })
      .catch(() => {
        // Keep empty on error
      })
      .finally(() => setLoading(false));
  }, []);

  return { cities, loading };
}

// ==========================================
// useListing — Fetch a single listing by ID
// ==========================================
export function useListing(id: string | null) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      // Use microtask to avoid synchronous setState in effect
      Promise.resolve().then(() => setListing(null));
      return;
    }
    // Use microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => setLoading(true));
    fetch(`/api/listings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setListing(data))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { listing, loading };
}

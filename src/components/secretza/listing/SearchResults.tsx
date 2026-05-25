"use client";

import { useState, useCallback } from "react";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { SearchFilters, Category, Country, State, City } from "@/lib/types";
import { useSearchStore } from "@/store/useAppStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { useListings, useCategories, useLocations, useCountryDetail } from "@/hooks/useApiData";
import ListingCard from "./ListingCard";

const ITEMS_PER_PAGE = 12;

const sortOptions: { value: SearchFilters["sortBy"]; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "relevance", label: "Relevance" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

// ==========================================
// FilterContent Component (extracted)
// ==========================================
function FilterContent({
  filters,
  setFilters,
  selectedCountry,
  selectedState,
  hasActiveFilters,
  resetFilters,
  categories,
  countries,
}: {
  filters: SearchFilters;
  setFilters: (f: Partial<SearchFilters>) => void;
  selectedCountry: (Country & { states?: (State & { cities?: City[] })[] }) | undefined;
  selectedState: (State & { cities?: City[] }) | undefined;
  hasActiveFilters: boolean;
  resetFilters: () => void;
  categories: Category[];
  countries: Country[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Category Filter */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#F5F5F7]">Category</h3>
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
          {categories
            .filter((c) => c.isActive)
            .map((cat) => (
              <label
                key={cat.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-[#1E1E2A]"
              >
                <Checkbox
                  checked={filters.categorySlug === cat.slug}
                  onCheckedChange={(checked) => {
                    setFilters({
                      categorySlug: checked ? cat.slug : undefined,
                    });
                  }}
                  className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-violet data-[state=checked]:border-violet"
                />
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-[#A1A1AA]">{cat.name}</span>
                  <span className="ml-auto text-xs text-[#A1A1AA]/60">
                    {cat.listingCount}
                  </span>
                </div>
              </label>
            ))}
        </div>
      </div>

      <Separator className="bg-[rgba(255,255,255,0.08)]" />

      {/* Country Filter */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#F5F5F7]">Country</h3>
        <Select
          value={filters.countrySlug || "all"}
          onValueChange={(val) =>
            setFilters({
              countrySlug: val === "all" ? undefined : val,
              stateSlug: undefined,
              citySlug: undefined,
            })
          }
        >
          <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
            <SelectItem value="all">All Countries</SelectItem>
            {countries
              .filter((c) => c.isActive)
              .map((country) => (
                <SelectItem key={country.id} value={country.slug}>
                  {country.name} ({country.listingCount})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* State Filter */}
      {selectedCountry && selectedCountry.states && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#F5F5F7]">State / Region</h3>
          <Select
            value={filters.stateSlug || "all"}
            onValueChange={(val) =>
              setFilters({
                stateSlug: val === "all" ? undefined : val,
                citySlug: undefined,
              })
            }
          >
            <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
              <SelectItem value="all">All States</SelectItem>
              {selectedCountry.states
                .filter((s) => s.isActive)
                .map((state) => (
                  <SelectItem key={state.id} value={state.slug}>
                    {state.name} ({state.listingCount})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* City Filter */}
      {selectedState && selectedState.cities && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#F5F5F7]">City</h3>
          <Select
            value={filters.citySlug || "all"}
            onValueChange={(val) =>
              setFilters({
                citySlug: val === "all" ? undefined : val,
              })
            }
          >
            <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
              <SelectItem value="all">All Cities</SelectItem>
              {selectedState.cities
                .filter((c) => c.isActive)
                .map((city) => (
                  <SelectItem key={city.id} value={city.slug}>
                    {city.name} ({city.listingCount})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator className="bg-[rgba(255,255,255,0.08)]" />

      {/* Featured Only Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#F5F5F7]">Featured Only</span>
        <Switch
          checked={!!filters.featured}
          onCheckedChange={(checked) =>
            setFilters({ featured: checked || undefined })
          }
        />
      </div>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          className="w-full border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:bg-[#1E1E2A] hover:text-[#F5F5F7]"
          onClick={resetFilters}
        >
          <X className="mr-2 size-4" />
          Reset Filters
        </Button>
      )}
    </div>
  );
}

export default function SearchResults() {
  const isMobile = useIsMobile();
  const { filters, setFilters, resetFilters } = useSearchStore();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Fetch data from API
  const { categories: apiCategories } = useCategories();
  const { countries: apiCountries } = useLocations();
  const { country: countryDetail } = useCountryDetail(filters.countrySlug);

  // Derive selected state/city from country detail
  const selectedCountry = countryDetail || undefined;
  const selectedState = selectedCountry?.states?.find(
    (s) => s.slug === filters.stateSlug
  );

  // Fetch listings from API
  const { listings: searchListings, total: searchTotal, loading: searchLoading } = useListings({
    keyword: filters.keyword,
    category: filters.categorySlug,
    country: filters.countrySlug,
    state: filters.stateSlug,
    city: filters.citySlug,
    featured: filters.featured ? true : undefined,
    sortBy: filters.sortBy,
    page: filters.page || 1,
    limit: ITEMS_PER_PAGE,
  });

  // Pagination (server-side)
  const totalPages = Math.max(1, Math.ceil(searchTotal / ITEMS_PER_PAGE));
  const currentPage = filters.page || 1;

  const handlePageChange = useCallback(
    (page: number) => {
      setFilters({ page: Math.max(1, Math.min(page, totalPages)) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setFilters, totalPages]
  );

  const hasActiveFilters =
    filters.keyword ||
    filters.categorySlug ||
    filters.countrySlug ||
    filters.stateSlug ||
    filters.citySlug ||
    filters.featured;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Search Bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            type="text"
            placeholder="Search listings..."
            value={filters.keyword || ""}
            onChange={(e) => {
              setFilters({ keyword: e.target.value || undefined, page: 1 });
            }}
            className="h-11 border-[rgba(255,255,255,0.08)] bg-surface pl-10 pr-4 text-[#F5F5F7] placeholder:text-[#A1A1AA]/60 focus:border-violet/40"
          />
          {filters.keyword && (
            <button
              onClick={() => setFilters({ keyword: undefined })}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F5F5F7]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Sort Select (desktop) */}
        {!isMobile && (
          <Select
            value={filters.sortBy || "featured"}
            onValueChange={(val) =>
              setFilters({ sortBy: val as SearchFilters["sortBy"], page: 1 })
            }
          >
            <SelectTrigger className="w-44 border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Mobile Filter Trigger */}
        {isMobile && (
          <Sheet
            open={mobileFiltersOpen}
            onOpenChange={setMobileFiltersOpen}
          >
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA] hover:bg-[#1E1E2A] hover:text-[#F5F5F7]"
              >
                <SlidersHorizontal className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="text-[#F5F5F7]">Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-2 overflow-y-auto px-1 pb-8">
                <FilterContent
                  filters={filters}
                  setFilters={setFilters}
                  selectedCountry={selectedCountry}
                  selectedState={selectedState}
                  hasActiveFilters={hasActiveFilters}
                  resetFilters={resetFilters}
                  categories={apiCategories}
                  countries={apiCountries}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Sort Select (mobile) */}
      {isMobile && (
        <div className="mb-4">
          <Select
            value={filters.sortBy || "featured"}
            onValueChange={(val) =>
              setFilters({ sortBy: val as SearchFilters["sortBy"], page: 1 })
            }
          >
            <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar Filters (desktop) */}
        {!isMobile && (
          <aside className="w-64 shrink-0">
            <div className="sticky top-24 rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
                <SlidersHorizontal className="size-4 text-violet" />
                Filters
              </h2>
              <FilterContent
                filters={filters}
                setFilters={setFilters}
                selectedCountry={selectedCountry}
                selectedState={selectedState}
                hasActiveFilters={hasActiveFilters}
                resetFilters={resetFilters}
                categories={apiCategories}
                countries={apiCountries}
              />
            </div>
          </aside>
        )}

        {/* Results Area */}
        <main className="min-w-0 flex-1">
          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#A1A1AA]">Active filters:</span>
              {filters.keyword && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 bg-[#1E1E2A] text-[#A1A1AA] hover:text-[#F5F5F7]"
                  onClick={() => setFilters({ keyword: undefined })}
                >
                  &ldquo;{filters.keyword}&rdquo;
                  <X className="size-3" />
                </Badge>
              )}
              {filters.categorySlug && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 bg-[#1E1E2A] text-[#A1A1AA] hover:text-[#F5F5F7]"
                  onClick={() => setFilters({ categorySlug: undefined })}
                >
                  {apiCategories.find((c) => c.slug === filters.categorySlug)?.name}
                  <X className="size-3" />
                </Badge>
              )}
              {filters.countrySlug && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 bg-[#1E1E2A] text-[#A1A1AA] hover:text-[#F5F5F7]"
                  onClick={() =>
                    setFilters({
                      countrySlug: undefined,
                      stateSlug: undefined,
                      citySlug: undefined,
                    })
                  }
                >
                  {apiCountries.find((c) => c.slug === filters.countrySlug)?.name}
                  <X className="size-3" />
                </Badge>
              )}
              {filters.featured && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 bg-[#1E1E2A] text-[#A1A1AA] hover:text-[#F5F5F7]"
                  onClick={() => setFilters({ featured: undefined })}
                >
                  Featured
                  <X className="size-3" />
                </Badge>
              )}
            </div>
          )}

          {/* Results Count */}
          <p className="mb-4 text-sm text-[#A1A1AA]">
            <span className="font-semibold text-[#F5F5F7]">
              {searchTotal}
            </span>{" "}
            listing{searchTotal !== 1 ? "s" : ""} found
          </p>

          {/* Grid or Empty State */}
          {searchLoading && searchListings.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="rounded-xl bg-surface border border-border overflow-hidden">
                    <div className="aspect-[3/4] bg-muted" />
                    <div className="p-3">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : searchListings.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {searchListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA] hover:bg-[#1E1E2A] hover:text-[#F5F5F7] disabled:opacity-40"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        // Show first, last, and pages around current
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <span key={page} className="flex items-center">
                            {showEllipsis && (
                              <span className="px-1 text-xs text-[#A1A1AA]">
                                ...
                              </span>
                            )}
                            <Button
                              variant={
                                currentPage === page ? "default" : "outline"
                              }
                              size="icon"
                              className={`h-9 w-9 text-sm ${
                                currentPage === page
                                  ? "bg-violet text-white hover:bg-violet-hover"
                                  : "border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA] hover:bg-[#1E1E2A] hover:text-[#F5F5F7]"
                              }`}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </Button>
                          </span>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA] hover:bg-[#1E1E2A] hover:text-[#F5F5F7] disabled:opacity-40"
                    disabled={currentPage >= totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface py-16">
              <SearchX className="mb-4 size-12 text-[#A1A1AA]/40" />
              <h3 className="mb-1 text-lg font-semibold text-[#F5F5F7]">
                No listings found
              </h3>
              <p className="mb-4 text-sm text-[#A1A1AA]">
                Try adjusting your search or filters
              </p>
              <Button
                variant="outline"
                className="border-violet/30 text-violet hover:bg-violet/10"
                onClick={resetFilters}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

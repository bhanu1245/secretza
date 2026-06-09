"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListings } from "@/hooks/useApiData";
import { useNavigationStore, useSearchStore } from "@/store/useAppStore";
import type { Listing } from "@/lib/types";
import ListingCard from "../listing/ListingCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const PAGE_SIZE = 8;

function mergeListings(base: Listing[], extra: Listing[]): Listing[] {
  const seen = new Set(base.map((listing) => listing.id));
  const appended = extra.filter((listing) => !seen.has(listing.id));
  return appended.length > 0 ? [...base, ...appended] : base;
}

export default function LatestListings() {
  const navigate = useNavigationStore((s) => s.navigate);
  const setFilters = useSearchStore((s) => s.setFilters);
  const [extraListings, setExtraListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const { listings, total, loading } = useListings({
    page: 1,
    limit: PAGE_SIZE,
    sortBy: "newest",
  });

  const allListings = useMemo(
    () => mergeListings(listings, extraListings),
    [listings, extraListings],
  );

  const hasMore = allListings.length < total;

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        sortBy: "newest",
        limit: String(PAGE_SIZE),
        page: String(nextPage),
      });
      const res = await fetch(`/api/listings?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const batch = (data.listings || []) as Listing[];
      setExtraListings((prev) => mergeListings(prev, batch));
      setPage(nextPage);
    } catch {
      // Keep existing listings visible if pagination fetch fails.
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, page]);

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-8 sm:mb-10">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Latest Listings
          </h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Fresh listings added recently
          </p>
        </div>
        <Button
          onClick={() => {
            setFilters({ sortBy: "newest", page: 1 });
            navigate("search");
          }}
          variant="ghost"
          className="text-violet hover:text-violet-hover hover:bg-violet/10 font-medium"
        >
          View All Listings
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Grid */}
      {loading && allListings.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {allListings.map((listing) => (
            <motion.div
              key={listing.id}
              variants={cardVariants}
              initial={false}
            >
              <ListingCard listing={listing} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-10">
          <Button
            onClick={handleLoadMore}
            disabled={loadingMore}
            variant="outline"
            size="lg"
            className="border-violet/30 text-violet hover:bg-violet/10 hover:text-violet-hover hover:border-violet/50 font-medium px-8 rounded-lg"
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </section>
  );
}

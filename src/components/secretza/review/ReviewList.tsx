"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PenLine,
  ChevronDown,
  Loader2,
  MessageSquareOff,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "@/components/secretza/review/StarRating";
import ReviewCard from "@/components/secretza/review/ReviewCard";
import CreateReviewForm from "@/components/secretza/review/CreateReviewForm";
import { useAuthStore } from "@/store/useAppStore";
import type { Review } from "@/components/secretza/review/CreateReviewForm";

interface ReviewListProps {
  listingId: string;
}

type SortOption = "newest" | "highest" | "lowest" | "helpful";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Most Recent" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
  { value: "helpful", label: "Most Helpful" },
];

const PAGE_SIZE = 20;

export default function ReviewList({ listingId }: ReviewListProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [hasMore, setHasMore] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Stats derived from reviews
  const stats = useMemo(() => {
    if (reviews.length === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    }

    return { average, total, distribution };
  }, [reviews]);

  const fetchReviews = useCallback(
    async (append = false) => {
      const loadingFn = append ? setLoadingMore : setLoading;
      loadingFn(true);
      setError(null);

      try {
        const offset = append ? reviews.length : 0;
        const sortParam = sortBy;
        const res = await fetch(
          `/api/reviews?listingId=${listingId}&sort=${sortParam}&limit=${PAGE_SIZE}&offset=${offset}`,
          { credentials: "include" }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch reviews");
        }

        const data = await res.json();
        const newReviews: Review[] = Array.isArray(data.reviews)
          ? data.reviews
          : Array.isArray(data)
            ? data
            : [];

        if (append) {
          setReviews((prev) => [...prev, ...newReviews]);
        } else {
          setReviews(newReviews);
        }

        setHasMore(newReviews.length >= PAGE_SIZE);
      } catch (err) {
        console.error("[ReviewList] Failed to fetch:", err);
        setError("Could not load reviews. Please try again.");
      } finally {
        loadingFn(false);
      }
    },
    [listingId, sortBy, reviews.length]
  );

  // Initial fetch
  useEffect(() => {
    fetchReviews(false);
  }, [listingId, sortBy]);

  const handleLoadMore = () => {
    fetchReviews(true);
  };

  const handleReviewSubmitted = useCallback(() => {
    setShowForm(false);
    // Re-fetch from scratch to get updated stats
    fetchReviews(false);
  }, [listingId]);

  const handleHelpful = useCallback(async (reviewId: string) => {
    try {
      await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: "POST",
        credentials: "include",
      });
      // Optimistically update local state
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r
        )
      );
    } catch {
      // Silently fail - the UI already shows the helpful state
    }
  }, []);

  const handleReport = useCallback(async (reviewId: string) => {
    try {
      await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Silently fail
    }
  }, []);

  return (
    <div className="w-full">
      {/* Header + Write Review button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#F5F5F7]">
          Reviews & Ratings
        </h2>
        {!showForm && (
          <Button
            onClick={() => {
              if (isAuthenticated) {
                setShowForm(true);
              } else {
                const { setAuthModalOpen, setAuthModalTab } =
                  useAuthStore.getState();
                setAuthModalTab("login");
                setAuthModalOpen(true);
              }
            }}
            className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-500 text-white rounded-lg shadow-lg shadow-violet/25 gap-2"
          >
            <PenLine className="size-4" />
            Write a Review
          </Button>
        )}
      </div>

      {/* Create Review Form */}
      {showForm && (
        <div className="mb-8">
          <CreateReviewForm
            listingId={listingId}
            listingTitle=""
            onSubmitted={handleReviewSubmitted}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && reviews.length === 0 && (
        <div className="space-y-6">
          {/* Summary skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5">
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="size-14 rounded-lg" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex-1 space-y-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton
                      className="h-2.5 rounded-full"
                      style={{ width: `${Math.max(20, 100 - i * 15)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Card skeletons */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquareOff className="size-10 text-[#52525B] mb-3" />
          <p className="text-sm text-[#A1A1AA] mb-4">{error}</p>
          <Button
            variant="outline"
            onClick={() => fetchReviews(false)}
            className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA] hover:bg-violet/10 hover:text-violet hover:border-violet/30"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && reviews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet/10 flex items-center justify-center mb-4">
            <MessageSquareOff className="size-7 text-violet/60" />
          </div>
          <h3 className="text-base font-semibold text-[#F5F5F7] mb-1.5">
            No Reviews Yet
          </h3>
          <p className="text-sm text-[#A1A1AA] max-w-sm">
            Be the first to review this listing! Share your experience and help
            others make informed decisions.
          </p>
        </div>
      )}

      {/* Reviews content */}
      {!loading && reviews.length > 0 && (
        <>
          {/* Summary Section */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5 mb-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Average + stars */}
              <div className="flex flex-col items-center justify-center sm:min-w-[120px]">
                <span className="text-4xl font-bold text-[#F5F5F7] tabular-nums">
                  {stats.average.toFixed(1)}
                </span>
                <StarRating
                  rating={stats.average}
                  size="md"
                  showValue={false}
                />
                <span className="text-xs text-[#A1A1AA] mt-1">
                  {stats.total} review{stats.total !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Distribution bars */}
              <div className="flex-1 flex flex-col gap-1.5 justify-center">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.distribution[star] || 0;
                  const percentage =
                    stats.total > 0
                      ? Math.round((count / stats.total) * 100)
                      : 0;

                  return (
                    <div
                      key={star}
                      className="flex items-center gap-2.5 group"
                    >
                      <span className="text-xs text-[#A1A1AA] w-3 text-right tabular-nums">
                        {star}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[#0B0B0F] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400/80 transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#52525B] w-8 tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
            <ArrowUpDown className="size-3.5 text-[#52525B] shrink-0 mr-1" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  sortBy === opt.value
                    ? "bg-violet/15 text-violet border border-violet/30"
                    : "text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-white/5 border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Review cards */}
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onHelpful={handleHelpful}
                onReport={handleReport}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA] hover:bg-violet/10 hover:text-violet hover:border-violet/30 gap-2 rounded-lg"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    Show More Reviews
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

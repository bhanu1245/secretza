"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  TrendingUp,
  Clock,
  Shield,
  Loader2,
  ChevronDown,
  ThumbsUp,
  Flag,
  Eye,
  RefreshCw,
  BarChart3,
  Users,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import StarRating from "@/components/secretza/review/StarRating";
import ReviewViewModal from "@/components/secretza/admin/ReviewViewModal";
import ReviewRejectDialog from "@/components/secretza/admin/ReviewRejectDialog";
import type { ReviewRejectionReasonId } from "@/lib/review-moderation";

// ==========================================
// Types
// ==========================================
interface Review {
  id: string;
  listingId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  isPremium: boolean;
  status: string;
  helpfulCount: number;
  reportCount: number;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
  listing?: { id: string; title: string; slug: string };
}

interface ReviewAnalytics {
  totalReviews: number;
  approvedReviews: number;
  pendingReviews: number;
  rejectedReviews: number;
  flaggedReviews: number;
  averageRating: number;
  reviewsByDay: Array<{ date: string; count: number; avgRating: number }>;
  topRatedListings: Array<{
    listingId: string;
    title: string;
    avgRating: number;
    reviewCount: number;
  }>;
  recentFlagged: Array<Review>;
}

type ReviewFilter = "all" | "pending" | "approved" | "rejected" | "flagged";
type ModerateAction = "approve" | "reject" | "flag" | "feature" | "unfeature";

// ==========================================
// Helpers
// ==========================================
function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "rejected":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "flagged":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateText(text: string | null, maxLen: number): string {
  if (!text) return "—";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function getActionToast(action: ModerateAction): {
  title: string;
  description: string;
} {
  switch (action) {
    case "approve":
      return {
        title: "Review approved",
        description: "The review has been published.",
      };
    case "reject":
      return {
        title: "Review rejected",
        description: "The review has been removed.",
      };
    case "flag":
      return {
        title: "Review flagged",
        description: "The review has been flagged for further review.",
      };
    case "feature":
      return {
        title: "Review featured",
        description: "The review has been marked as featured.",
      };
    case "unfeature":
      return {
        title: "Review unfeatured",
        description: "The review is no longer featured.",
      };
  }
}

// ==========================================
// Loading Skeletons
// ==========================================
function ReviewRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0 w-48">
        <Skeleton className="size-8 rounded-full bg-[rgba(255,255,255,0.06)]" />
        <div className="min-w-0">
          <Skeleton className="h-3.5 w-24 rounded bg-[rgba(255,255,255,0.06)]" />
          <Skeleton className="h-2.5 w-16 rounded bg-[rgba(255,255,255,0.04)] mt-1" />
        </div>
      </div>
      <Skeleton className="h-3 w-32 rounded bg-[rgba(255,255,255,0.06)] flex-shrink-0" />
      <Skeleton className="h-4 w-20 rounded bg-[rgba(255,255,255,0.06)] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-3 w-full max-w-xs rounded bg-[rgba(255,255,255,0.04)]" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full bg-[rgba(255,255,255,0.06)] flex-shrink-0" />
      <Skeleton className="h-3 w-16 rounded bg-[rgba(255,255,255,0.04)] flex-shrink-0" />
      <div className="flex gap-1 flex-shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="size-7 rounded-md bg-[rgba(255,255,255,0.06)]"
          />
        ))}
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="bg-[#15151D] border-[rgba(255,255,255,0.08)]"
          >
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 rounded bg-[rgba(255,255,255,0.06)] mb-2" />
              <Skeleton className="h-7 w-14 rounded bg-[rgba(255,255,255,0.08)] mb-1" />
              <Skeleton className="h-2.5 w-24 rounded bg-[rgba(255,255,255,0.04)]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-12 w-full rounded-lg bg-[rgba(255,255,255,0.04)]"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// AdminReviewQueue Component
// ==========================================
export function AdminReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("pending");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [viewReview, setViewReview] = useState<Review | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Review | null>(null);
  const limit = 20;

  const fetchReviews = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("status", activeFilter);
      params.set("page", reset ? "1" : String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();

      if (reset) {
        setReviews(data.reviews || []);
        setPage(1);
      } else {
        setReviews((prev) => [...prev, ...(data.reviews || [])]);
      }
      setTotal(data.total || 0);
      setStatusCounts(data.statusCounts || {});
    } catch (error) {
      logError(error, { component: "AdminReviewPanel" });
    } finally {
      setLoading(false);
    }
  }, [activeFilter, page]);

  useEffect(() => {
    fetchReviews(true);
  }, [activeFilter]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);

    try {
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("status", activeFilter);
      params.set("page", String(nextPage));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch more reviews");
      const data = await res.json();

      setReviews((prev) => [...prev, ...(data.reviews || [])]);
      setTotal(data.total || 0);
      setStatusCounts(data.statusCounts || {});
    } catch (error) {
      logError(error, { component: "AdminReviewPanel" });
      toast.error("Failed to load more reviews");
      setPage(page); // Revert page on error
    }
  };

  const handleModerate = async (
    reviewId: string,
    action: ModerateAction,
    note?: string,
    rejectionReason?: ReviewRejectionReasonId,
  ) => {
    setActionLoading(reviewId);
    try {
      const body: {
        action: ModerateAction;
        adminNote?: string;
        rejectionReason?: ReviewRejectionReasonId;
      } = { action };
      if (note?.trim()) body.adminNote = note.trim();
      if (rejectionReason) body.rejectionReason = rejectionReason;

      const res = await fetch(`/api/admin/reviews/${reviewId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Moderation action failed");
      }

      // Optimistic removal from list for approve/reject actions
      if (action === "approve" || action === "reject") {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        // Update status in place for flag/feature/unfeature
        setReviews((prev) =>
          prev.map((r) => {
            if (r.id !== reviewId) return r;
            return {
              ...r,
              status: action === "flag" ? "flagged" : r.status,
              isFeatured: action === "feature" ? true : action === "unfeature" ? false : r.isFeatured,
            };
          })
        );
      }

      // Collapse expanded review
      setExpandedReview(null);
      setAdminNote("");

      const toastInfo = getActionToast(action);
      toast.success(toastInfo.title, { description: toastInfo.description });
    } catch (error) {
      logError(error, { component: "AdminReviewPanel" });
      toast.error(
        error instanceof Error ? error.message : "Moderation action failed"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const filters: { key: ReviewFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "flagged", label: "Flagged" },
  ];

  const formatFilterLabel = (key: ReviewFilter, label: string) => {
    if (key === "all") {
      const allCount = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
      return allCount > 0 ? `${label} (${allCount})` : label;
    }
    const count = statusCounts[key] ?? 0;
    return count > 0 ? `${label} (${count})` : label;
  };

  const hasMore = reviews.length < total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Review Moderation</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Review and moderate user-submitted reviews.{" "}
          <span className="text-[#F5F5F7] font-medium">{total}</span> total
          reviews
          {activeFilter !== "all" && (
            <>
              {" "}
              &middot;{" "}
              <span className="text-[#8B5CF6] font-medium">
                {total} {activeFilter}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeFilter === f.key
                ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            {formatFilterLabel(f.key, f.label)}
          </button>
        ))}
        <button
          onClick={() => fetchReviews(true)}
          className="px-3 py-1.5 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-1.5 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Reviews List */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-48 flex-shrink-0">
              User
            </span>
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-32 flex-shrink-0">
              Listing
            </span>
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-20 flex-shrink-0">
              Rating
            </span>
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider flex-1 min-w-0">
              Review
            </span>
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-16 flex-shrink-0 text-center">
              Status
            </span>
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-20 flex-shrink-0">
              Date
            </span>
            <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-32 flex-shrink-0 text-right">
              Actions
            </span>
          </div>

          {/* Reviews */}
          {loading && reviews.length === 0 ? (
            <div>
              {Array.from({ length: 8 }).map((_, i) => (
                <ReviewRowSkeleton key={i} />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="size-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-[#F5F5F7] font-medium">
                No reviews to moderate
              </p>
              <p className="text-sm text-[#A1A1AA] mt-1">
                {activeFilter === "pending"
                  ? "All pending reviews have been reviewed."
                  : `No ${activeFilter} reviews found.`}
              </p>
            </div>
          ) : (
            <div>
              {reviews.map((review) => {
                const isExpanded = expandedReview === review.id;
                const isActioning = actionLoading === review.id;

                return (
                  <React.Fragment key={review.id}>
                    <div className="flex items-center gap-4 px-6 py-4 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                      {/* User */}
                      <div className="flex items-center gap-3 min-w-0 w-48 flex-shrink-0">
                        {review.user.image ? (
                          <img
                            src={review.user.image}
                            alt=""
                            className="size-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="size-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(review.user.name || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-[#F5F5F7] font-medium truncate">
                            {review.user.name || "Anonymous"}
                          </p>
                          <div className="flex items-center gap-1">
                            {review.isVerified && (
                              <CheckCircle className="size-3 text-emerald-400" />
                            )}
                            {review.isPremium && (
                              <Star className="size-3 text-amber-400 fill-amber-400" />
                            )}
                            {review.reportCount > 0 && (
                              <span className="text-[10px] text-red-400">
                                {review.reportCount} reports
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Listing */}
                      <div className="min-w-0 w-32 flex-shrink-0">
                        {review.listing ? (
                          <a
                            href={`/listing/${review.listing.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#A1A1AA] hover:text-[#8B5CF6] transition-colors truncate block"
                          >
                            {truncateText(review.listing.title, 28)}
                            <ExternalLink className="inline size-2.5 ml-1 opacity-50" />
                          </a>
                        ) : (
                          <span className="text-xs text-[#52525B]">
                            Unknown listing
                          </span>
                        )}
                      </div>

                      {/* Star Rating */}
                      <div className="w-20 flex-shrink-0">
                        <StarRating rating={review.rating} size="sm" />
                      </div>

                      {/* Review Body */}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() =>
                            setExpandedReview(isExpanded ? null : review.id)
                          }
                          className="text-left w-full"
                        >
                          {review.title && (
                            <p className="text-xs font-medium text-[#F5F5F7] truncate">
                              {review.title}
                            </p>
                          )}
                          <p className="text-xs text-[#A1A1AA] mt-0.5">
                            {isExpanded
                              ? review.body || "—"
                              : truncateText(review.body, 80)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {review.helpfulCount > 0 && (
                              <span className="text-[10px] text-[#52525B] flex items-center gap-0.5">
                                <ThumbsUp className="size-2.5" />
                                {review.helpfulCount} helpful
                              </span>
                            )}
                            {review.isFeatured && (
                              <Badge
                                variant="outline"
                                className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[9px] px-1.5 py-0 rounded-full"
                              >
                                Featured
                              </Badge>
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Status */}
                      <div className="w-16 flex-shrink-0 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusBadge(
                            review.status
                          )}`}
                        >
                          {review.status}
                        </Badge>
                      </div>

                      {/* Date */}
                      <div className="w-20 flex-shrink-0">
                        <span className="text-[10px] text-[#52525B]">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 w-36 flex-shrink-0 justify-end">
                        <button
                          onClick={() => setViewReview(review)}
                          title="View Review"
                          className="p-1.5 rounded-md hover:bg-sky-500/10 text-[#A1A1AA] hover:text-sky-400 transition-colors"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleModerate(review.id, "approve", adminNote)
                          }
                          disabled={isActioning}
                          title="Approve"
                          className="p-1.5 rounded-md hover:bg-emerald-500/10 text-[#A1A1AA] hover:text-emerald-400 transition-colors disabled:opacity-50"
                        >
                          {isActioning ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="size-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setRejectTarget(review)}
                          disabled={isActioning}
                          title="Reject"
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="size-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleModerate(review.id, "flag", adminNote)
                          }
                          disabled={isActioning}
                          title="Flag"
                          className="p-1.5 rounded-md hover:bg-amber-500/10 text-[#A1A1AA] hover:text-amber-400 transition-colors disabled:opacity-50"
                        >
                          <AlertTriangle className="size-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleModerate(
                              review.id,
                              review.isFeatured ? "unfeature" : "feature",
                              adminNote
                            )
                          }
                          disabled={isActioning}
                          title={review.isFeatured ? "Unfeature" : "Feature"}
                          className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
                            review.isFeatured
                              ? "text-violet-400 bg-violet-500/10"
                              : "text-[#A1A1AA] hover:bg-violet-500/10 hover:text-violet-400"
                          }`}
                        >
                          <Star
                            className={`size-3.5 ${
                              review.isFeatured ? "fill-violet-400" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Expanded View with Admin Note */}
                    {isExpanded && (
                      <div className="px-6 py-4 bg-[#1E1E2A]/50 border-b border-[rgba(255,255,255,0.04)]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Full Review */}
                          <div>
                            <p className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                              Full Review
                            </p>
                            <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                              {review.title && (
                                <p className="text-sm font-medium text-[#F5F5F7] mb-1">
                                  {review.title}
                                </p>
                              )}
                              <p className="text-sm text-[#A1A1AA] whitespace-pre-wrap">
                                {review.body || "No review body provided."}
                              </p>
                            </div>
                          </div>

                          {/* Admin Note */}
                          <div>
                            <p className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                              Admin Note (optional)
                            </p>
                            <Textarea
                              placeholder="Add an internal note..."
                              value={adminNote}
                              onChange={(e) => setAdminNote(e.target.value)}
                              className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] text-xs min-h-[80px] resize-none rounded-lg"
                            />
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                size="sm"
                                className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                onClick={() =>
                                  handleModerate(
                                    review.id,
                                    "approve",
                                    adminNote
                                  )
                                }
                                disabled={isActioning}
                              >
                                <CheckCircle className="size-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                onClick={() => setRejectTarget(review)}
                                disabled={isActioning}
                              >
                                <XCircle className="size-3 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[10px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                                onClick={() =>
                                  handleModerate(
                                    review.id,
                                    "flag",
                                    adminNote
                                  )
                                }
                                disabled={isActioning}
                              >
                                <AlertTriangle className="size-3 mr-1" />
                                Flag
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Load More */}
        {hasMore && !loading && (
          <div className="p-4 border-t border-[rgba(255,255,255,0.06)] text-center">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              className="bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.06)] text-xs rounded-lg"
            >
              <ChevronDown className="size-3.5 mr-1" />
              Load More ({total - reviews.length} remaining)
            </Button>
          </div>
        )}

        {/* Loading indicator for pagination */}
        {loading && reviews.length > 0 && (
          <div className="p-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin text-[#7C3AED]" />
            <span className="text-xs text-[#A1A1AA]">Loading more reviews...</span>
          </div>
        )}
      </Card>

      <ReviewViewModal
        review={viewReview}
        open={!!viewReview}
        onOpenChange={(open) => !open && setViewReview(null)}
      />

      <ReviewRejectDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        reviewerName={rejectTarget?.user.name}
        loading={actionLoading === rejectTarget?.id}
        onConfirm={({ rejectionReason, rejectionNote }) => {
          if (!rejectTarget) return;
          handleModerate(
            rejectTarget.id,
            "reject",
            rejectionNote,
            rejectionReason,
          ).finally(() => setRejectTarget(null));
        }}
      />
    </div>
  );
}

// ==========================================
// AdminReviewAnalytics Component
// ==========================================
export function AdminReviewAnalytics() {
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reviews/analytics?days=${days}`
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch (error) {
      logError(error, { component: "AdminReviewPanel" });
      toast.error("Failed to load review analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const statsCards = analytics
    ? [
        {
          label: "Total Reviews",
          value: analytics.totalReviews,
          icon: MessageSquare,
          color: "#7C3AED",
          bg: "rgba(124,58,237,0.1)",
        },
        {
          label: "Avg Rating",
          value: analytics.averageRating.toFixed(1),
          icon: Star,
          color: "#F59E0B",
          bg: "rgba(245,158,11,0.1)",
        },
        {
          label: "Pending",
          value: analytics.pendingReviews,
          icon: Clock,
          color: "#F59E0B",
          bg: "rgba(245,158,11,0.1)",
        },
        {
          label: "Approved",
          value: analytics.approvedReviews,
          icon: CheckCircle,
          color: "#10B981",
          bg: "rgba(16,185,129,0.1)",
        },
        {
          label: "Rejected",
          value: analytics.rejectedReviews,
          icon: XCircle,
          color: "#EF4444",
          bg: "rgba(239,68,68,0.1)",
        },
        {
          label: "Flagged",
          value: analytics.flaggedReviews,
          icon: AlertTriangle,
          color: "#F59E0B",
          bg: "rgba(245,158,11,0.1)",
        },
      ]
    : [];

  const last7Days = analytics?.reviewsByDay
    ? analytics.reviewsByDay.slice(-7)
    : [];

  if (loading && !analytics) {
    return <AnalyticsSkeleton />;
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">
            Review Analytics
          </h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Insights and trends for platform reviews.
          </p>
        </div>
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-12 text-center">
            <BarChart3 className="size-10 text-[#52525B] mx-auto mb-3" />
            <p className="text-[#A1A1AA]">Failed to load analytics data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">Review Analytics</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Insights and trends for platform reviews.
          </p>
        </div>

        {/* Days Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-semibold">
            Period:
          </span>
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                days === d
                  ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                  : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={() => fetchAnalytics()}
            className="px-3 py-1.5 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-1.5 transition-colors"
            disabled={loading}
          >
            <RefreshCw
              className={`size-3 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsCards.map((stat) => (
          <Card
            key={stat.label}
            className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(124,58,237,0.2)] transition-all"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: stat.bg }}
                >
                  <stat.icon
                    className="size-4"
                    style={{ color: stat.color }}
                  />
                </div>
              </div>
              <p className="text-xl font-bold text-[#F5F5F7]">
                {stat.label === "Avg Rating" ? (
                  <span className="flex items-center gap-1.5">
                    {stat.value}
                    <Star className="size-3 text-amber-400 fill-amber-400" />
                  </span>
                ) : (
                  stat.value.toLocaleString()
                )}
              </p>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout: Top Rated + Reviews Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rated Listings */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <TrendingUp className="size-4 text-[#7C3AED]" />
              Top Rated Listings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {analytics.topRatedListings.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Star className="size-8 text-[#52525B] mx-auto mb-2" />
                <p className="text-sm text-[#52525B]">
                  No listings with reviews yet
                </p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)]">
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-10">
                        #
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Listing
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-32">
                        Avg Rating
                      </th>
                      <th className="text-right px-6 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-20">
                        Reviews
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topRatedListings.map((listing, i) => (
                      <tr
                        key={listing.listingId}
                        className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                      >
                        <td className="px-6 py-3">
                          <span
                            className={`text-xs font-bold ${
                              i === 0
                                ? "text-amber-400"
                                : i === 1
                                ? "text-[#A1A1AA]"
                                : i === 2
                                ? "text-amber-600"
                                : "text-[#52525B]"
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-[#F5F5F7] truncate block max-w-[200px]">
                            {listing.title}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StarRating
                              rating={listing.avgRating}
                              size="sm"
                            />
                            <span className="text-xs text-[#A1A1AA] ml-1">
                              {listing.avgRating.toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="text-xs text-[#A1A1AA]">
                            {listing.reviewCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reviews Trend (Last 7 Days) */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <BarChart3 className="size-4 text-[#7C3AED]" />
              Reviews Trend
            </CardTitle>
            <p className="text-[10px] text-[#A1A1AA]">
              Last 7 days activity
            </p>
          </CardHeader>
          <CardContent>
            {last7Days.length === 0 ? (
              <div className="py-10 text-center">
                <BarChart3 className="size-8 text-[#52525B] mx-auto mb-2" />
                <p className="text-sm text-[#52525B]">No trend data available</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Bar visualization */}
                <div className="flex items-end gap-2 h-32 mb-3 px-1">
                  {last7Days.map((day, i) => {
                    const maxCount = Math.max(
                      ...last7Days.map((d) => d.count),
                      1
                    );
                    const heightPct = (day.count / maxCount) * 100;

                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <span className="text-[10px] text-[#A1A1AA] font-medium">
                          {day.count}
                        </span>
                        <div className="w-full relative group">
                          <div
                            className="w-full rounded-t-sm bg-gradient-to-t from-[#7C3AED] to-[#8B5CF6] transition-all duration-500 min-h-[2px]"
                            style={{ height: `${Math.max(heightPct, 4)}%` }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#15151D] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            <p className="text-[10px] text-[#F5F5F7] font-medium">
                              {day.count} reviews
                            </p>
                            <p className="text-[9px] text-[#A1A1AA]">
                              Avg: {day.avgRating.toFixed(1)} ★
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Date labels */}
                <div className="flex gap-2 px-1">
                  {last7Days.map((day, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center"
                    >
                      <span className="text-[9px] text-[#52525B]">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Summary list */}
                <div className="mt-4 space-y-2">
                  {last7Days.map((day, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]"
                    >
                      <span className="text-xs text-[#A1A1AA]">
                        {formatDate(day.date)}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <StarRating
                            rating={day.avgRating}
                            size="sm"
                          />
                          <span className="text-[10px] text-[#A1A1AA]">
                            {day.avgRating.toFixed(1)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-[rgba(124,58,237,0.1)] text-[#8B5CF6] border-[rgba(124,58,237,0.2)] text-[10px] font-medium px-2 py-0.5 rounded-full"
                        >
                          {day.count} reviews
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Flagged Reviews */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-400" />
            Recent Flagged Reviews
            {analytics.recentFlagged.length > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full ml-1"
              >
                {analytics.recentFlagged.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.recentFlagged.length === 0 ? (
            <div className="text-center py-10">
              <Shield className="size-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-[#A1A1AA]">
                No flagged reviews. Looking good!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.recentFlagged.map((review) => (
                <div
                  key={review.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)] hover:border-amber-500/20 transition-colors"
                >
                  {/* User Avatar */}
                  {review.user.image ? (
                    <img
                      src={review.user.image}
                      alt=""
                      className="size-9 rounded-full object-cover flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="size-9 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      {(review.user.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[#F5F5F7]">
                        {review.user.name || "Anonymous"}
                      </span>
                      <span className="text-[10px] text-[#52525B]">
                        reviewed
                      </span>
                      {review.listing && (
                        <a
                          href={`/listing/${review.listing.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#8B5CF6] hover:text-violet-300 transition-colors truncate"
                        >
                          {review.listing.title}
                          <ExternalLink className="inline size-2.5 ml-0.5 opacity-50" />
                        </a>
                      )}
                    </div>

                    {/* Review snippet */}
                    <p className="text-xs text-[#A1A1AA] mb-2">
                      {review.title && (
                        <span className="font-medium text-[#F5F5F7]">
                          &quot;{truncateText(review.title, 40)}&quot;
                        </span>
                      )}
                      {review.title && review.body && " — "}
                      {truncateText(review.body, 100)}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <StarRating rating={review.rating} size="sm" />
                        <span className="text-[10px] text-[#A1A1AA] ml-1">
                          {review.rating}/5
                        </span>
                      </div>
                      {review.reportCount > 0 && (
                        <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                          <Flag className="size-2.5" />
                          {review.reportCount} report{review.reportCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-[10px] text-[#52525B]">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Status & Rating indicator */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    >
                      Flagged
                    </Badge>
                    {review.isVerified && (
                      <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle className="size-2.5" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

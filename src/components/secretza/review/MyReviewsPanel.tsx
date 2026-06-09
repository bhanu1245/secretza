"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import StarRating from "@/components/secretza/review/StarRating";
import {
  getReviewStatusLabel,
  parseRejectionAdminNote,
} from "@/lib/review-moderation";
import { logError } from "@/lib/logger";

type UserReview = {
  id: string;
  listingId: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  listing: { id: string; title: string; slug: string } | null;
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "rejected":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "flagged":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

export default function MyReviewsPanel() {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/mine", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (error) {
      logError(error, { component: "MyReviewsPanel" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-violet" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="py-16 text-center">
          <MessageSquare className="size-12 text-[#52525B] mx-auto mb-4" />
          <p className="text-[#F5F5F7] font-medium">No reviews yet</p>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Reviews you submit on listings will appear here with their moderation status.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const rejection = parseRejectionAdminNote(review.adminNote);
        return (
          <Card
            key={review.id}
            className="bg-[#15151D] border-[rgba(255,255,255,0.08)]"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[#F5F5F7] truncate">
                    {review.title || "Untitled review"}
                  </p>
                  <p className="text-xs text-[#A1A1AA] truncate">
                    Listing:{" "}
                    {review.listing ? (
                      <a
                        href={`/listing/${review.listing.slug}`}
                        className="text-violet hover:underline"
                      >
                        {review.listing.title}
                      </a>
                    ) : (
                      "Unknown listing"
                    )}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${statusBadgeClass(review.status)}`}
                >
                  {getReviewStatusLabel(review.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-xs text-[#52525B]">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>

              {review.body && (
                <p className="text-sm text-[#A1A1AA] line-clamp-3">{review.body}</p>
              )}

              {review.status === "rejected" && rejection.reasonLabel && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                  <p className="font-medium text-red-200">Reason: {rejection.reasonLabel}</p>
                  {rejection.note && <p className="mt-1 text-red-300/90">{rejection.note}</p>}
                </div>
              )}

              {review.status === "pending" && (
                <p className="text-xs text-amber-400/90">
                  Your review is awaiting moderation and will become public once approved.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

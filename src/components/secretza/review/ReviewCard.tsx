"use client";

import { useState, useCallback } from "react";
import {
  ThumbsUp,
  Flag,
  ShieldCheck,
  Sparkles,
  Crown,
  CheckCircle2,
  XCircle,
  Star,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StarRating from "@/components/secretza/review/StarRating";
import TimeAgo from "@/components/secretza/shared/TimeAgo";
import type { Review } from "@/components/secretza/review/CreateReviewForm";

interface ReviewCardProps {
  review: Review;
  onHelpful?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
  canModerate?: boolean;
  onModerate?: (reviewId: string, action: string) => void;
}

export default function ReviewCard({
  review,
  onHelpful,
  onReport,
  canModerate = false,
  onModerate,
}: ReviewCardProps) {
  const [helpfulClicked, setHelpfulClicked] = useState(false);
  const [reportClicked, setReportClicked] = useState(false);
  const [showModeration, setShowModeration] = useState(false);

  const handleHelpful = useCallback(() => {
    if (helpfulClicked) return;
    setHelpfulClicked(true);
    onHelpful?.(review.id);
  }, [helpfulClicked, onHelpful, review.id]);

  const handleReport = useCallback(() => {
    if (reportClicked) return;
    setReportClicked(true);
    onReport?.(review.id);
  }, [reportClicked, onReport, review.id]);

  const handleModerate = useCallback(
    (action: string) => {
      onModerate?.(review.id, action);
      setShowModeration(false);
    },
    [onModerate, review.id]
  );

  const displayName = review.user?.name || "Anonymous";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-4 sm:p-5 transition-colors hover:border-[rgba(255,255,255,0.12)]">
      {/* Top row: Avatar + info + actions */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar className="size-10 shrink-0 border border-[rgba(255,255,255,0.08)]">
          {review.user?.image ? (
            <AvatarImage
              src={review.user.image}
              alt={displayName}
            />
          ) : null}
          <AvatarFallback className="bg-violet/10 text-violet text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#F5F5F7] truncate">
              {displayName}
            </span>

            {/* Badges */}
            {review.isVerified && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-0 gap-1 text-[10px] px-1.5 py-0 h-5">
                <ShieldCheck className="size-3" />
                Verified
              </Badge>
            )}
            {review.isFeatured && (
              <Badge className="bg-violet/15 text-violet border-0 gap-1 text-[10px] px-1.5 py-0 h-5">
                <Sparkles className="size-3" />
                Featured
              </Badge>
            )}
            {review.isPremium && (
              <Badge className="bg-amber-500/15 text-amber-400 border-0 gap-1 text-[10px] px-1.5 py-0 h-5">
                <Crown className="size-3" />
                Premium
              </Badge>
            )}
          </div>

          {/* Rating + Time */}
          <div className="flex items-center gap-3 mt-1">
            <StarRating rating={review.rating} size="sm" />
            <TimeAgo
              date={review.createdAt}
              className="text-xs text-[#52525B]"
            />
          </div>
        </div>

        {/* Admin moderation menu */}
        {canModerate && (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowModeration(!showModeration)}
              className="size-7 text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-white/5"
            >
              <MoreHorizontal className="size-4" />
            </Button>
            {showModeration && (
              <div className="absolute right-0 top-8 z-20 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] p-1 shadow-xl min-w-[140px]">
                <button
                  onClick={() => handleModerate("approve")}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => handleModerate("reject")}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <XCircle className="size-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => handleModerate("feature")}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-violet hover:bg-violet/10 transition-colors"
                >
                  <Star className="size-3.5" />
                  Feature
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review content */}
      <div className="mt-3.5">
        {review.title && (
          <h4 className="text-sm font-semibold text-[#F5F5F7] mb-1.5">
            {review.title}
          </h4>
        )}
        {review.body && (
          <p className="text-sm text-[#A1A1AA] leading-relaxed whitespace-pre-wrap">
            {review.body}
          </p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
        {/* Helpful button */}
        <button
          onClick={handleHelpful}
          disabled={helpfulClicked}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            helpfulClicked
              ? "text-violet bg-violet/10 cursor-default"
              : "text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-white/5"
          }`}
        >
          <ThumbsUp className="size-3.5" />
          <span>Helpful</span>
          <span className="font-medium">
            {(review.helpfulCount || 0) + (helpfulClicked ? 1 : 0)}
          </span>
        </button>

        {/* Report button */}
        <button
          onClick={handleReport}
          disabled={reportClicked}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            reportClicked
              ? "text-amber-400 bg-amber-500/10 cursor-default"
              : "text-[#52525B] hover:text-[#A1A1AA] hover:bg-white/5"
          }`}
        >
          <Flag className="size-3.5" />
          <span>{reportClicked ? "Reported" : "Report"}</span>
        </button>
      </div>
    </div>
  );
}

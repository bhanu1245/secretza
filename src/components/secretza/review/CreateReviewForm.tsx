"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, ShieldCheck, AlertCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StarRating from "@/components/secretza/review/StarRating";
import { useAuthStore } from "@/store/useAppStore";
import { apiFetch, fetchCsrfToken } from "@/lib/api-client";
import { toast } from "sonner";

export interface Review {
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
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface CreateReviewFormProps {
  listingId: string;
  listingTitle: string;
  existingReview?: Review | null;
  onSubmitted?: () => void;
  onCancel?: () => void;
  userVerified?: boolean;
}

export default function CreateReviewForm({
  listingId,
  listingTitle,
  existingReview,
  onSubmitted,
  onCancel,
  userVerified,
}: CreateReviewFormProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isUserVerified = userVerified ?? user?.isVerified ?? false;

  const isEditing = !!existingReview;

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when editing
  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setTitle(existingReview.title ?? "");
      setBody(existingReview.body ?? "");
    }
  }, [existingReview]);

  // Pre-fetch CSRF token when the form is shown for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      fetchCsrfToken().catch(() => {
        // Token will be fetched again on submit
      });
    }
  }, [isAuthenticated]);

  const canSubmit = useMemo(() => {
    return rating >= 1 && body.trim().length >= 10;
  }, [rating, body]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/reviews/${existingReview.id}`
        : "/api/reviews";
      const method = isEditing ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          listingId,
          rating,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg =
          data.error ||
          `Failed to ${isEditing ? "update" : "submit"} review. Please try again.`;
        setError(errorMsg);
        toast.error("Review failed", { description: errorMsg });
        return;
      }

      toast.success(
        isEditing ? "Review updated!" : "Review submitted!",
        {
          description: isEditing
            ? "Your review has been updated successfully."
            : isUserVerified
              ? "Your review has been published."
              : "Your review is pending moderation.",
        }
      );

      // Reset form
      if (!isEditing) {
        setRating(0);
        setTitle("");
        setBody("");
      }

      onSubmitted?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      setError(`Network error: ${message}`);
      toast.error("Network error", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth guard
  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-lg text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-violet/15 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="size-7 text-violet" />
        </div>
        <h3 className="text-lg font-bold text-[#F5F5F7] mb-2">
          Sign In Required
        </h3>
        <p className="text-sm text-[#A1A1AA] mb-5">
          You need to be signed in to write a review.
        </p>
        <Button
          onClick={() => {
            const { setAuthModalOpen, setAuthModalTab } =
              useAuthStore.getState();
            setAuthModalTab("login");
            setAuthModalOpen(true);
          }}
          className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-500 text-white rounded-lg shadow-lg shadow-violet/25"
        >
          Sign In to Review
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-[#F5F5F7]">
            {isEditing ? "Edit Review" : "Write a Review"}
          </h3>
          <p className="text-sm text-[#A1A1AA] mt-0.5">
            {isEditing
              ? `Update your review for "${listingTitle}"`
              : `Share your experience with "${listingTitle}"`}
          </p>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="size-8 text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-white/5"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] p-5 sm:p-6">
        {/* Star Rating Selector */}
        <div className="mb-5">
          <Label className="text-sm text-[#A1A1AA] mb-2.5 block">
            Your Rating <span className="text-red-400">*</span>
          </Label>
          <StarRating
            rating={rating}
            size="lg"
            interactive
            onChange={setRating}
            showValue
          />
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <Label
            htmlFor="review-title"
            className="text-sm text-[#A1A1AA] mb-2 block"
          >
            Title{" "}
            <span className="text-[#52525B]">(optional)</span>
          </Label>
          <Input
            id="review-title"
            type="text"
            placeholder="Summarize your experience"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="border-[rgba(255,255,255,0.08)] bg-[#0B0B0F] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
          />
          <span className="text-xs text-[#52525B] mt-1 block text-right">
            {title.length}/200
          </span>
        </div>

        {/* Body Textarea */}
        <div className="mb-5">
          <Label
            htmlFor="review-body"
            className="text-sm text-[#A1A1AA] mb-2 block"
          >
            Your Review <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="review-body"
            placeholder="Tell others about your experience... (minimum 10 characters)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            className="min-h-[120px] resize-none border-[rgba(255,255,255,0.08)] bg-[#0B0B0F] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
          />
          <span className="text-xs text-[#52525B] mt-1 block text-right">
            {body.length}/2000
          </span>
        </div>

        {/* Verified Status Notice */}
        <div
          className={`flex items-start gap-2.5 rounded-lg p-3 mb-5 ${
            isUserVerified
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-amber-500/10 border border-amber-500/20"
          }`}
        >
          {isUserVerified ? (
            <ShieldCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
          )}
          <p
            className={`text-xs leading-relaxed ${
              isUserVerified ? "text-emerald-400/90" : "text-amber-400/90"
            }`}
          >
            {isUserVerified
              ? "Your review will be published immediately."
              : "Your review will be reviewed by our moderation team before being published."}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-5">
            <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-white/5"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-500 text-white rounded-lg shadow-lg shadow-violet/25 disabled:opacity-50 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isEditing ? "Updating..." : "Submitting..."}
              </>
            ) : (
              <>
                <Send className="size-4" />
                {isEditing ? "Update Review" : "Submit Review"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

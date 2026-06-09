"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import StarRating from "@/components/secretza/review/StarRating";
import { getReviewStatusLabel } from "@/lib/review-moderation";

type ReviewViewData = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
  listing?: { id: string; title: string; slug: string };
};

type ReviewViewModalProps = {
  review: ReviewViewData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ReviewViewModal({
  review,
  open,
  onOpenChange,
}: ReviewViewModalProps) {
  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">Review Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Reviewer</p>
              <p className="text-[#F5F5F7] font-medium">{review.user.name || "Anonymous"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Listing</p>
              {review.listing ? (
                <a
                  href={`/listing/${review.listing.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet hover:underline"
                >
                  {review.listing.title}
                </a>
              ) : (
                <p className="text-[#A1A1AA]">Unknown listing</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Rating</p>
              <StarRating rating={review.rating} size="sm" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Status</p>
              <Badge variant="outline">{getReviewStatusLabel(review.status)}</Badge>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Created</p>
              <p className="text-[#A1A1AA]">
                {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {review.title && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Title</p>
              <p className="text-[#F5F5F7] font-medium">{review.title}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Full Review</p>
            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] p-4">
              <p className="text-[#A1A1AA] whitespace-pre-wrap leading-relaxed">
                {review.body || "No review text provided."}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

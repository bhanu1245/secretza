"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REVIEW_REJECTION_REASONS,
  type ReviewRejectionReasonId,
} from "@/lib/review-moderation";

type ReviewRejectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewerName?: string | null;
  onConfirm: (payload: {
    rejectionReason: ReviewRejectionReasonId;
    rejectionNote?: string;
  }) => void;
  loading?: boolean;
};

export default function ReviewRejectDialog({
  open,
  onOpenChange,
  reviewerName,
  onConfirm,
  loading = false,
}: ReviewRejectDialogProps) {
  const [reason, setReason] = useState<ReviewRejectionReasonId>("spam");
  const [note, setNote] = useState("");

  const handleConfirm = () => {
    onConfirm({
      rejectionReason: reason,
      rejectionNote: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">Reject Review</DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            Reject the review from {reviewerName || "this user"}? The reviewer will see the reason in their dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Rejection reason</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReviewRejectionReasonId)}
              className="w-full rounded-lg border border-white/10 bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] outline-none"
            >
              {REVIEW_REJECTION_REASONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Additional note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional context for the reviewer..."
              className="min-h-[80px] resize-none bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Reject Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

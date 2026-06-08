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
  LISTING_REJECTION_REASONS,
  type ListingRejectionReasonId,
} from "@/lib/listing-moderation";

type ListingRejectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingTitle: string | null;
  onConfirm: (payload: {
    rejectionReason: ListingRejectionReasonId;
    rejectionNote?: string;
  }) => Promise<void>;
  loading?: boolean;
};

export default function ListingRejectDialog({
  open,
  onOpenChange,
  listingTitle,
  onConfirm,
  loading = false,
}: ListingRejectDialogProps) {
  const [reason, setReason] = useState<ListingRejectionReasonId>("spam");
  const [note, setNote] = useState("");

  async function handleConfirm() {
    await onConfirm({
      rejectionReason: reason,
      rejectionNote: reason === "other" ? note.trim() : note.trim() || undefined,
    });
    setNote("");
    setReason("spam");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">Reject listing</DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            {listingTitle ? `Reject "${listingTitle}"` : "Select a rejection reason for audit logging."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Reason</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ListingRejectionReasonId)}
              className="w-full rounded-lg border border-white/10 bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] outline-none"
            >
              {LISTING_REJECTION_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">
              {reason === "other" ? "Details (required for Other)" : "Additional note (optional)"}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional context for moderators..."
              className="bg-[#0B0B0F] border-white/10 text-[#F5F5F7] resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-white/10 bg-transparent text-[#A1A1AA] hover:bg-white/[0.04]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (reason === "other" && !note.trim())}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Rejecting..." : "Reject listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

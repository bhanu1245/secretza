"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ListingDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string | null;
  listingTitle: string | null;
  onConfirm: () => void;
  loading?: boolean;
};

export default function ListingDeleteConfirmDialog({
  open,
  onOpenChange,
  listingId,
  listingTitle,
  onConfirm,
  loading = false,
}: ListingDeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">Delete listing?</DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            This permanently deletes the listing and its stored images. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-[#1E1E2A] p-3 text-sm space-y-1">
          <p className="text-[#F5F5F7] font-medium">{listingTitle || "Untitled listing"}</p>
          <p className="text-xs text-[#52525B]">ID: {listingId}</p>
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
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Deleting..." : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

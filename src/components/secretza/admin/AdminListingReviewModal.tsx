"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Loader2, Trash2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdminListingDetail } from "@/lib/admin-listing-detail";

export type AdminListingReviewMode = "listings" | "moderation";

type AdminListingReviewModalProps = {
  listingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AdminListingReviewMode;
  onApprove: (id: string) => Promise<void>;
  onRejectRequest: (id: string, title: string) => void;
  onDeleteRequest?: (id: string, title: string) => void;
  actionLoading?: boolean;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[#1E1E2A] p-3">
      <span className="text-[10px] text-[#52525B] uppercase tracking-wide">{label}</span>
      <p className="text-sm text-[#F5F5F7] font-medium mt-1 break-words">{value}</p>
    </div>
  );
}

function imageStatusClass(status: string) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "rejected") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

export default function AdminListingReviewModal({
  listingId,
  open,
  onOpenChange,
  mode,
  onApprove,
  onRejectRequest,
  onDeleteRequest,
  actionLoading = false,
}: AdminListingReviewModalProps) {
  const [listing, setListing] = useState<AdminListingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadListing = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load listing");
      setListing(data.listing);
    } catch (err) {
      setListing(null);
      setError(err instanceof Error ? err.message : "Failed to load listing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && listingId) {
      loadListing(listingId);
    } else if (!open) {
      setListing(null);
      setError(null);
    }
  }, [open, listingId, loadListing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7] pr-6">
            {listing?.title || "Listing review"}
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            Listing ID: {listingId || "—"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>
        ) : listing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Status" value={<span className="capitalize">{listing.status}</span>} />
              <Field label="Created" value={formatDate(listing.createdAt)} />
              <Field label="Updated" value={formatDate(listing.updatedAt)} />
              <Field label="Expires" value={formatDate(listing.expiresAt)} />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">Content</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Category" value={listing.category?.name || "—"} />
                <Field label="Subcategory" value={listing.subcategory?.name || "—"} />
              </div>
              <div className="mt-3 rounded-lg bg-[#1E1E2A] p-3">
                <span className="text-[10px] text-[#52525B] uppercase tracking-wide">Description</span>
                <p className="text-sm text-[#A1A1AA] mt-2 whitespace-pre-wrap">{listing.description || "—"}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">User</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name" value={listing.user?.name || "—"} />
                <Field label="Email" value={listing.user?.email || "—"} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">Location</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Country" value={listing.country?.name || "—"} />
                <Field label="State" value={listing.state?.name || "—"} />
                <Field label="City" value={listing.city?.name || "—"} />
                <Field label="Area" value={listing.areaRelation?.name || "—"} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">Monetization</h4>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Featured" value={listing.isFeatured ? "Yes" : "No"} />
                <Field label="Premium" value={listing.isPremium ? "Yes" : "No"} />
                <Field label="Boosted" value={listing.isBoosted ? "Yes" : "No"} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">Safety</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Reports" value={listing.reportCount} />
                <Field label="Risk score" value={`${listing.riskScore}/100`} />
                <Field label="Pending images" value={listing.pendingImageCount} />
              </div>
              {listing.status === "rejected" && listing.lastRejection && (
                <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm">
                  <p className="text-red-300 font-medium">
                    Rejection: {listing.lastRejection.reasonLabel || "No reason recorded"}
                  </p>
                  {listing.lastRejection.note && (
                    <p className="text-[#A1A1AA] mt-1">{listing.lastRejection.note}</p>
                  )}
                  {listing.lastRejection.rejectedAt && (
                    <p className="text-[10px] text-[#52525B] mt-1">
                      {formatDate(listing.lastRejection.rejectedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                Images ({listing.listingImages.length})
              </h4>
              {listing.listingImages.length === 0 ? (
                <p className="text-sm text-[#52525B]">No images attached.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {listing.listingImages.map((img) => (
                    <div
                      key={img.id}
                      className="rounded-lg overflow-hidden border border-white/10 bg-[#1E1E2A]"
                    >
                      <div className="aspect-[3/4] relative">
                        <img
                          src={img.mediumUrl || img.thumbnailUrl || img.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 flex items-center justify-between gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${imageStatusClass(img.moderationStatus)}`}
                        >
                          {img.moderationStatus}
                        </Badge>
                        {img.isFlagged && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30">
                            flagged
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {listing && (
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={() => onApprove(listing.id)}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              <CheckCircle className="size-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={() => onRejectRequest(listing.id, listing.title)}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              <XCircle className="size-3 mr-1" /> Reject
            </Button>
            {mode === "listings" && onDeleteRequest && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() => onDeleteRequest(listing.id, listing.title)}
                className="h-8 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
              >
                <Trash2 className="size-3 mr-1" /> Delete
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

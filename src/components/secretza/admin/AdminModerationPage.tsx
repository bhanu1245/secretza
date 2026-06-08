"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Flag,
  ImageIcon,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminPaginationBar from "@/components/secretza/admin/AdminPaginationBar";
import AdminListingReviewModal from "@/components/secretza/admin/AdminListingReviewModal";
import ListingRejectDialog from "@/components/secretza/admin/ListingRejectDialog";
import { buildAdminListingsUrl } from "@/lib/admin-listings-query";
import { resolveAdminListingThumbnail } from "@/lib/listing-images";
import { logError } from "@/lib/logger";
import type { ListingRejectionReasonId } from "@/lib/listing-moderation";

type ModerationQueueItem = {
  listing: {
    id: string;
    title: string;
    riskScore: number;
    category?: { name: string };
    city?: { name: string };
    country?: { name: string };
    user?: { name: string | null };
    listingImages?: Array<{ url?: string; thumbnailUrl?: string }>;
    profileImage?: string | null;
  };
  riskScore: number;
};

type ModerationImage = {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  width: number;
  height: number;
  moderationStatus: string;
  moderationReason?: string;
  isFlagged: boolean;
  listing?: { id: string; title: string; status: string };
};

function ImageModerationPanel({
  onViewListing,
}: {
  onViewListing: (listingId: string) => void;
}) {
  const [images, setImages] = useState<ModerationImage[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, flagged: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/upload/moderate?status=${status}&limit=50`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load queue (${res.status})`);
      }
      const data = await res.json();
      setImages(data.images || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moderation queue");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages(statusFilter);
  }, [statusFilter, fetchImages]);

  const handleModerate = async (imageId: string, action: "approve" | "reject" | "flag") => {
    setProcessingId(imageId);
    try {
      const res = await fetch("/api/upload/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(imageId);
          return next;
        });
        toast.success(`Image ${action}d`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to moderate image");
      }
    } catch {
      toast.error("Failed to moderate image. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkModerate = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setProcessingId("bulk");
    try {
      const res = await fetch("/api/upload/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [...selectedIds], action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.stats) setStats(data.stats);
        setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
        setSelectedIds(new Set());
        toast.success(`Bulk ${action}: ${data.results?.filter((r: { success: boolean }) => r.success).length ?? 0} images`);
        await fetchImages(statusFilter);
      } else {
        toast.error(data.error || "Bulk moderation failed");
      }
    } catch {
      toast.error("Bulk moderation failed");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(["pending", "flagged", "rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === status
                ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {stats[status as keyof typeof stats] > 0 && (
              <span className="ml-1.5 text-[10px] opacity-60">{stats[status as keyof typeof stats]}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => fetchImages(statusFilter)}
          className="px-3 py-1.5 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-1"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
        {selectedIds.size > 0 && (
          <>
            <Button size="sm" onClick={() => handleBulkModerate("approve")} className="h-7 text-xs bg-emerald-600">
              Approve {selectedIds.size}
            </Button>
            <Button size="sm" onClick={() => handleBulkModerate("reject")} className="h-7 text-xs bg-red-600">
              Reject {selectedIds.size}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="size-12 text-emerald-400 mx-auto mb-4" />
          <p className="text-[#F5F5F7] font-medium">No images to review</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="bg-[#15151D] border-[rgba(255,255,255,0.08)] overflow-hidden group">
              <div className="relative aspect-[3/4] overflow-hidden">
                <label className="absolute top-2 right-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(image.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(image.id);
                        else next.delete(image.id);
                        return next;
                      });
                    }}
                    className="size-4"
                  />
                </label>
                <img
                  src={image.mediumUrl || image.thumbnailUrl || image.url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {image.isFlagged && (
                  <Badge className="absolute top-2 left-2 bg-red-500/90 text-white border-0 text-[9px] px-1.5 py-0">
                    <Flag className="size-2.5 mr-0.5" />
                    Flagged
                  </Badge>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-[10px] text-white/80 truncate">{image.listing?.title || "No listing"}</p>
                  <p className="text-[9px] text-white/50 capitalize">{image.listing?.status}</p>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {image.listing?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewListing(image.listing!.id)}
                    className="w-full h-7 text-[10px] border-white/10 text-[#A1A1AA] hover:bg-white/[0.04]"
                  >
                    <FileText className="size-3 mr-1" />
                    View Listing
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={processingId === image.id}
                    onClick={() => handleModerate(image.id, "approve")}
                    className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    disabled={processingId === image.id}
                    onClick={() => handleModerate(image.id, "reject")}
                    className="h-7 px-2.5 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    <XCircle className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={processingId === image.id}
                    onClick={() => handleModerate(image.id, "flag")}
                    className="h-7 px-2.5 text-[10px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                  >
                    <Flag className="size-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminModerationPage() {
  const [tab, setTab] = useState("listings");
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [reviewListingId, setReviewListingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildAdminListingsUrl({ status: "pending", page, limit });
      const response = await fetch(url);
      const data = await response.json();
      const moderationItems = (data.listings || []).map((listing: ModerationQueueItem["listing"]) => ({
        listing,
        riskScore: listing.riskScore || 0,
      }));
      setItems(moderationItems);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
    } catch (error) {
      logError(error, { component: "AdminModerationPage" });
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (tab === "listings") loadItems();
  }, [tab, loadItems]);

  const patchListing = async (
    listingId: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast.success(successMessage);
      setItems((prev) => prev.filter((i) => i.listing.id !== listingId));
      setTotal((t) => Math.max(0, t - 1));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const approveItem = async (id: string) => {
    const ok = await patchListing(id, { action: "approve" }, "Listing approved");
    if (ok) setReviewListingId(null);
  };

  const handleRejectConfirm = async (payload: {
    rejectionReason: ListingRejectionReasonId;
    rejectionNote?: string;
  }) => {
    if (!rejectTarget) return;
    const ok = await patchListing(
      rejectTarget.id,
      { action: "reject", ...payload },
      "Listing rejected",
    );
    if (ok) {
      setRejectTarget(null);
      setReviewListingId(null);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score < 30) return { label: "Low Risk", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bar: "#10B981" };
    if (score < 70) return { label: "Medium Risk", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", bar: "#F59E0B" };
    return { label: "High Risk", color: "bg-red-500/15 text-red-400 border-red-500/30", bar: "#EF4444" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Moderation</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Review pending listings and images. Risk scores help prioritize the queue.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)]">
          <TabsTrigger value="listings" className="text-xs data-[state=active]:bg-[#7C3AED]/15 data-[state=active]:text-[#8B5CF6]">
            <FileText className="size-3.5 mr-1.5" />
            Listings
            {total > 0 && <span className="ml-1 text-[10px] opacity-70">({total})</span>}
          </TabsTrigger>
          <TabsTrigger value="images" className="text-xs data-[state=active]:bg-[#7C3AED]/15 data-[state=active]:text-[#8B5CF6]">
            <ImageIcon className="size-3.5 mr-1.5" />
            Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#F5F5F7]">{items.filter((i) => i.riskScore < 30).length}</p>
                  <p className="text-[10px] text-[#A1A1AA]">Low Risk (this page)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="size-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#F5F5F7]">{items.filter((i) => i.riskScore >= 30 && i.riskScore < 70).length}</p>
                  <p className="text-[10px] text-[#A1A1AA]">Medium Risk (this page)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Shield className="size-4 text-red-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#F5F5F7]">{items.filter((i) => i.riskScore >= 70).length}</p>
                  <p className="text-[10px] text-[#A1A1AA]">High Risk (this page)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-[#A1A1AA]">Loading pending listings...</div>
          ) : items.length === 0 ? (
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="py-16 text-center">
                <ShieldCheck className="size-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-[#F5F5F7] font-medium">All caught up!</p>
                <p className="text-sm text-[#A1A1AA] mt-1">No pending items on this page.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const risk = getRiskBadge(item.riskScore);
                const thumbnail = resolveAdminListingThumbnail(item.listing);
                return (
                  <Card key={item.listing.id} className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <img src={thumbnail} alt="" className="w-20 h-24 rounded-lg object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-sm font-semibold text-[#F5F5F7] truncate">{item.listing.title}</h3>
                                <p className="text-xs text-[#A1A1AA] mt-0.5">
                                  {item.listing.category?.name} · {item.listing.city?.name}, {item.listing.country?.name}
                                </p>
                                <p className="text-xs text-[#A1A1AA] mt-0.5">By {item.listing.user?.name || "Unknown"}</p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${risk.color}`}>
                                {risk.label} ({item.riskScore})
                              </Badge>
                            </div>
                            <div className="mt-3 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${item.riskScore}%`, backgroundColor: risk.bar }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex lg:flex-col gap-2 lg:items-end flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewListingId(item.listing.id)}
                            className="h-9 px-4 text-xs border-white/10 text-[#A1A1AA]"
                          >
                            View
                          </Button>
                          <Button size="sm" onClick={() => approveItem(item.listing.id)} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg">
                            <CheckCircle className="size-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setRejectTarget({ id: item.listing.id, title: item.listing.title })}
                            className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg"
                          >
                            <XCircle className="size-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
            <AdminPaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
              disabled={loading}
            />
          </Card>
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImageModerationPanel onViewListing={(id) => setReviewListingId(id)} />
        </TabsContent>
      </Tabs>

      <AdminListingReviewModal
        listingId={reviewListingId}
        open={!!reviewListingId}
        onOpenChange={(open) => !open && setReviewListingId(null)}
        mode="moderation"
        onApprove={approveItem}
        onRejectRequest={(id, title) => setRejectTarget({ id, title })}
        actionLoading={actionLoading}
      />

      <ListingRejectDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        listingTitle={rejectTarget?.title ?? null}
        onConfirm={handleRejectConfirm}
        loading={actionLoading}
      />
    </div>
  );
}

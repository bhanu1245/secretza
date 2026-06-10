"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Eye, Search, Star, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import AdminPaginationBar from "@/components/secretza/admin/AdminPaginationBar";
import AdminListingReviewModal from "@/components/secretza/admin/AdminListingReviewModal";
import ListingRejectDialog from "@/components/secretza/admin/ListingRejectDialog";
import ListingDeleteConfirmDialog from "@/components/secretza/admin/ListingDeleteConfirmDialog";
import AdminRankingTools from "@/components/secretza/admin/AdminRankingTools";
import { buildAdminListingsUrl } from "@/lib/admin-listings-query";
import { resolveAdminListingThumbnail } from "@/lib/listing-images";
import { logError } from "@/lib/logger";
import type { ListingRejectionReasonId } from "@/lib/listing-moderation";
import type { ListingStatus } from "@/lib/types";

type ListingRow = {
  id: string;
  title: string;
  status: string;
  viewCount: number;
  isFeatured: boolean;
  createdAt: string;
  category?: { name: string };
  city?: { name: string };
  country?: { code: string };
  listingImages?: Array<{ url?: string; thumbnailUrl?: string }>;
  profileImage?: string | null;
};

export default function AdminListingsPage() {
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [reviewListingId, setReviewListingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const statuses: (ListingStatus | "all")[] = ["all", "approved", "pending", "rejected", "expired"];

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch, limit]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = buildAdminListingsUrl({
        page,
        limit,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to load listings (${response.status})`);
      setListings(data.listings || []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setSelected(new Set());
    } catch (err) {
      logError(err, { component: "AdminListingsPage" });
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const patchListing = useCallback(
    async (
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
        await loadListings();
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [loadListings],
  );

  const handleApprove = async (listingId: string) => {
    const ok = await patchListing(listingId, { action: "approve" }, "Listing approved");
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const ok = await patchListing(deleteTarget.id, { action: "delete" }, "Listing deleted");
    if (ok) {
      setDeleteTarget(null);
      setReviewListingId(null);
    }
  };

  const handleRowAction = async (
    listingId: string,
    action: "approve" | "reject" | "feature" | "delete",
  ) => {
    if (action === "reject") {
      const row = listings.find((l) => l.id === listingId);
      setRejectTarget({ id: listingId, title: row?.title || "Listing" });
      return;
    }
    if (action === "delete") {
      const row = listings.find((l) => l.id === listingId);
      setDeleteTarget({ id: listingId, title: row?.title || "Listing" });
      return;
    }
    await patchListing(
      listingId,
      { action },
      `Listing ${action === "approve" ? "approved" : action === "feature" ? "featured" : action + "d"}`,
    );
  };

  const handleBulkAction = async (action: "approve" | "reject" | "feature") => {
    if (action === "reject") {
      toast.error("Bulk reject requires individual reasons — reject from row or review modal.");
      return;
    }
    const ids = [...selected];
    setActionLoading(true);
    try {
      let success = 0;
      for (const id of ids) {
        const res = await fetch(`/api/admin/listings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (res.ok) success++;
      }
      toast.success(`${success} listing(s) ${action}d`);
      await loadListings();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === listings.length) setSelected(new Set());
    else setSelected(new Set(listings.map((l) => l.id)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Listings</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Manage all listings on the platform.</p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-sm text-red-300">{error}</CardContent>
        </Card>
      )}

      <AdminRankingTools />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, user email, or city..."
            className="w-full rounded-xl border border-white/10 bg-[#0B0B0F] py-2 pl-10 pr-3 text-sm text-[#F5F5F7] outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                statusFilter === status
                  ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                  : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#A1A1AA]">{selected.size} selected</span>
          <Button size="sm" onClick={() => handleBulkAction("approve")} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
            <CheckCircle className="size-3 mr-1" /> Approve
          </Button>
          <Button size="sm" onClick={() => handleBulkAction("feature")} className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
            <Star className="size-3 mr-1" /> Feature
          </Button>
        </div>
      )}

      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#A1A1AA]">Loading listings...</div>
          ) : listings.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#A1A1AA]">No listings found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={selected.size === listings.length && listings.length > 0}
                        onCheckedChange={toggleAll}
                        className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
                      />
                    </th>
                    {["Title", "Category", "Location", "Status", "Views", "Featured", "Date", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
                    <tr key={listing.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selected.has(listing.id)}
                          onCheckedChange={() => toggleSelect(listing.id)}
                          className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <img src={resolveAdminListingThumbnail(listing)} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                          <span className="text-sm text-[#F5F5F7] truncate max-w-[200px]">{listing.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#A1A1AA]">
                        {listing.city?.name ?? "—"}, {listing.country?.code ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] capitalize">{listing.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.viewCount?.toLocaleString() ?? 0}</td>
                      <td className="px-4 py-3">
                        {listing.isFeatured ? (
                          <Star className="size-4 text-amber-400 fill-amber-400" />
                        ) : (
                          <span className="text-[10px] text-[#52525B]">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#52525B]">
                        {new Date(listing.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setReviewListingId(listing.id)} className="p-1.5 rounded-md hover:bg-white/[0.05] text-[#A1A1AA]" title="View">
                            <Eye className="size-3.5" />
                          </button>
                          <button onClick={() => handleRowAction(listing.id, "approve")} className="p-1.5 rounded-md hover:bg-emerald-500/10 text-[#A1A1AA]" title="Approve">
                            <CheckCircle className="size-3.5" />
                          </button>
                          <button onClick={() => handleRowAction(listing.id, "reject")} className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA]" title="Reject">
                            <XCircle className="size-3.5" />
                          </button>
                          <button onClick={() => handleRowAction(listing.id, "delete")} className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA]" title="Delete">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AdminPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
            disabled={loading}
          />
        </CardContent>
      </Card>

      <AdminListingReviewModal
        listingId={reviewListingId}
        open={!!reviewListingId}
        onOpenChange={(open) => !open && setReviewListingId(null)}
        mode="listings"
        onApprove={handleApprove}
        onRejectRequest={(id, title) => setRejectTarget({ id, title })}
        onDeleteRequest={(id, title) => setDeleteTarget({ id, title })}
        actionLoading={actionLoading}
      />

      <ListingRejectDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        listingTitle={rejectTarget?.title ?? null}
        onConfirm={handleRejectConfirm}
        loading={actionLoading}
      />

      <ListingDeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        listingId={deleteTarget?.id ?? null}
        listingTitle={deleteTarget?.title ?? null}
        onConfirm={handleDeleteConfirm}
        loading={actionLoading}
      />
    </div>
  );
}

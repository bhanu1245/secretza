"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Search, Star, Trash2, XCircle, Zap } from "lucide-react";

type AdminListing = {
  id: string;
  title: string;
  status: string;
  isFeatured: boolean;
  isBoosted: boolean;
  price: string | null;
  currency: string;
  createdAt: string;
  user: { email: string; name: string | null } | null;
  category: { name: string } | null;
  city: { name: string } | null;
};

const filters = ["all", "pending", "approved", "rejected", "featured", "boosted"] as const;

export default function AdminListingsPage() {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = filter === "all" ? "" : `?filter=${filter}`;
      const response = await fetch(`/api/admin/listings${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load listings");
      setListings(data.listings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function runAction(id: string, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !window.confirm("Delete this listing?")) return;

    const response = await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Action failed");
      return;
    }

    if (action === "delete") {
      setListings((current) => current.filter((listing) => listing.id !== id));
    } else {
      await loadListings();
    }
  }

  const visibleListings = listings.filter((listing) => {
    const text = `${listing.title} ${listing.user?.email || ""}`.toLowerCase();
    return !search || text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Listings</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">Review, approve, reject, and delete user listings.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg border px-3 py-2 text-xs capitalize ${
                filter === item
                  ? "border-[#7C3AED]/30 bg-[#7C3AED]/15 text-[#8B5CF6]"
                  : "border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:bg-white/[0.04]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search listings..."
            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#7C3AED]/40"
          />
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D]">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[rgba(255,255,255,0.08)] px-4 py-3 text-xs uppercase tracking-wide text-[#A1A1AA]">
          <span>{loading ? "Loading..." : `${visibleListings.length} listings`}</span>
          <span>Actions</span>
        </div>

        {visibleListings.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#A1A1AA]">No listings found</div>
        ) : (
          visibleListings.map((listing) => (
            <div key={listing.id} className="grid gap-4 border-b border-[rgba(255,255,255,0.06)] p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{listing.title}</h2>
                  <span className="rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/15 px-2 py-0.5 text-[10px] uppercase text-[#8B5CF6]">
                    {listing.status}
                  </span>
                  {listing.isFeatured && <Star className="size-4 text-amber-400" />}
                  {listing.isBoosted && <Zap className="size-4 text-violet-400" />}
                </div>
                <p className="mt-1 text-sm text-[#A1A1AA]">
                  {listing.user?.email || "Unknown user"} · {listing.category?.name || "Category"} · {listing.city?.name || "City"}
                </p>
                <p className="mt-1 text-xs text-[#52525B]">
                  {listing.currency} {listing.price || "0"} · {new Date(listing.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => runAction(listing.id, "approve")} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <CheckCircle className="inline size-3.5 mr-1" />
                  Approve
                </button>
                <button onClick={() => runAction(listing.id, "reject")} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <XCircle className="inline size-3.5 mr-1" />
                  Reject
                </button>
                <button onClick={() => runAction(listing.id, "delete")} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">
                  <Trash2 className="inline size-3.5 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

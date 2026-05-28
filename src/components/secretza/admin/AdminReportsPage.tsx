"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Search, ShieldAlert, UserX } from "lucide-react";
import { getListingCoverImage } from "@/lib/listing-images";

type Report = {
  id: string;
  reason: string;
  description?: string | null;
  isResolved: boolean;
  moderatorNotes?: string | null;
  createdAt: string;
  reporter: { id: string; name?: string | null; email: string };
  listing: any;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "all") params.set("isResolved", filter === "resolved" ? "true" : "false");
    if (query.trim()) params.set("q", query.trim());
    return `/api/admin/reports?${params.toString()}`;
  }, [filter, query]);

  const load = async () => {
    setLoading(true);
    const res = await fetch(url);
    const data = await res.json();
    setReports(data.reports || []);
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(load).catch(() => {
      toast.error("Failed to load reports");
      setLoading(false);
    });
  }, [url]);

  const resolve = async (report: Report, action: "resolve" | "dismiss" | "suspend_listing" | "suspend_user") => {
    if ((action === "suspend_listing" || action === "suspend_user") && !confirm("This moderation action is restrictive. Continue?")) {
      return;
    }
    setProcessingId(report.id);
    const res = await fetch(`/api/admin/reports/${report.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, moderatorNotes: notes[report.id] || "" }),
    });
    setProcessingId(null);
    if (!res.ok) {
      toast.error("Failed to update report");
      return;
    }
    toast.success("Report updated");
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Reports</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Review listing, abuse, and spam reports with moderation actions.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#71717A]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reports, listings, or reporters"
            className="w-full rounded-lg bg-[#15151D] border border-[rgba(255,255,255,0.08)] pl-9 pr-3 py-2 text-sm text-[#F5F5F7]"
          />
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as any)} className="rounded-lg bg-[#15151D] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]">
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[#A1A1AA]">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-sm text-[#A1A1AA]">No reports found.</div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.08)]">
            {reports.map((report) => {
              const cover = getListingCoverImage(report.listing);
              return (
                <div key={report.id} className="p-4 grid grid-cols-1 xl:grid-cols-[96px,1fr,260px] gap-4">
                  {cover ? (
                    <img src={cover.thumbnailUrl || cover.url} alt={report.listing.title} className="w-24 h-28 rounded-lg object-cover" />
                  ) : (
                    <div className="w-24 h-28 rounded-lg bg-[#0B0B0F] flex items-center justify-center">
                      <ShieldAlert className="size-5 text-[#52525B]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[#F5F5F7] truncate">{report.listing.title}</h3>
                      <span className={report.isResolved ? "text-[10px] text-emerald-300" : "text-[10px] text-amber-300"}>
                        {report.isResolved ? "Resolved" : "Open"}
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA]">{report.listing.category?.name || "Uncategorized"} · {report.listing.city?.name || "No city"} · status {report.listing.status}</p>
                    <p className="text-sm text-[#F5F5F7] mt-3">{report.reason}</p>
                    {report.description && <p className="text-xs text-[#A1A1AA] mt-1">{report.description}</p>}
                    <p className="text-xs text-[#71717A] mt-3">Reported by {report.reporter.email} on {new Date(report.createdAt).toLocaleString()}</p>
                    {report.moderatorNotes && <p className="text-xs text-emerald-300 mt-2">Notes: {report.moderatorNotes}</p>}
                  </div>
                  <div className="space-y-2">
                    <textarea
                      value={notes[report.id] || ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                      placeholder="Moderator notes"
                      rows={3}
                      className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#F5F5F7]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button disabled={processingId === report.id || report.isResolved} onClick={() => resolve(report, "resolve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        <CheckCircle className="size-3 inline mr-1" /> Resolve
                      </button>
                      <button disabled={processingId === report.id || report.isResolved} onClick={() => resolve(report, "dismiss")} className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#F5F5F7] disabled:opacity-50">
                        Dismiss
                      </button>
                      <button disabled={processingId === report.id || report.isResolved} onClick={() => resolve(report, "suspend_listing")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        Suspend Listing
                      </button>
                      <button disabled={processingId === report.id || report.isResolved} onClick={() => resolve(report, "suspend_user")} className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 disabled:opacity-50">
                        <UserX className="size-3 inline mr-1" /> User
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

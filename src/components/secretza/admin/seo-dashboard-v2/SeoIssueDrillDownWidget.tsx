"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Search, ExternalLink, RefreshCw, Wand2, Wrench, Edit3, Filter, CheckSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getSeoPagePublicUrl } from "@/lib/seo-public-page";
import { apiFetch } from "@/lib/api-client";
import { BULK_ACTION_TO_JOB_TYPE } from "@/lib/seo-job-types";

export type IssueType =
  | "missing_title"
  | "missing_meta"
  | "missing_h1"
  | "missing_canonical"
  | "missing_schema"
  | "missing_image"
  | "thin_content"
  | "missing_internal_links"
  | "duplicate_titles"
  | "duplicate_meta"
  | "duplicate_h1"
  | "duplicate_content"
  | "broken_internal_links";

interface DrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueType: IssueType | null;
  issueName: string;
  issueDescription: string;
}

const BULK_ACTION_LABELS: Record<string, string> = {
  auto_fix: "Auto Fix",
  regenerate: "Regenerate",
  generate_missing: "Generate Missing Meta",
  repair_canonical: "Repair Canonicals",
};

export function SeoIssueDrillDownWidget({
  open,
  onOpenChange,
  issueType,
  issueName,
  issueDescription,
}: DrillDownProps) {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [pageTypeFilter, setPageTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [indexingFilter, setIndexingFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [fixConfirmOpen, setFixConfirmOpen] = useState(false);
  const [pageToFix, setPageToFix] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<string | null>(null);
  const [bulkPreview, setBulkPreview] = useState<{
    pageCount: number;
    estimatedMinutes: number;
    issueTypes: string[];
    batchSize: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictJob, setConflictJob] = useState<{ id: string; jobType: string } | null>(null);
  const [conflictMessage, setConflictMessage] = useState("");

  const limit = 50; // Increased limit for better grouping

  useEffect(() => {
    if (!open || !issueType) {
      setPages([]);
      setSelectedIds(new Set());
      setSearch("");
      setPageTypeFilter("all");
      setStatusFilter("all");
      setIndexingFilter("all");
      setSortField("updatedAt");
      setSortOrder("desc");
      return;
    }
    const timer = setTimeout(() => {
      fetchPages(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, issueType, search, pageTypeFilter, statusFilter, indexingFilter, sortField, sortOrder]);

  const fetchPages = async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: issueType as string,
        page: page.toString(),
        limit: limit.toString(),
        sortField,
        sortOrder,
      });
      if (search) params.set("search", search);
      if (pageTypeFilter !== "all") params.set("pageType", pageTypeFilter);
      if (statusFilter === "published") params.set("isPublished", "true");
      if (statusFilter === "draft") params.set("isPublished", "false");
      if (indexingFilter === "indexed") params.set("indexed", "true");
      if (indexingFilter === "noindex") params.set("indexed", "false");

      const res = await fetch(`/api/seo/issues?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch issues");
      const data = await res.json();
      setPages(data.pages);
      setTotal(data.total);
      setCurrentPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading pages");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pages.length && pages.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Group pages if issue is duplicate
  const groupedPages = useMemo(() => {
    if (!issueType?.startsWith("duplicate")) return null;
    const groups = new Map<string, any[]>();
    for (const p of pages) {
      const val = p.duplicateValue || "Unknown";
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(p);
    }
    return Array.from(groups.entries()).map(([value, items]) => ({ value, items }));
  }, [pages, issueType]);

  const handleRegenerate = async (id: string) => {
    if (!confirm("Are you sure you want to regenerate SEO for this page?")) return;

    const payload = { mode: "selected_pages", pageIds: [id], confirmed: true, dryRun: false };
    console.log("ACTION_START", "regenerate", payload);
    setActionLoading(`regen_${id}`);
    try {
      const res = await apiFetch("/api/seo/regenerate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to regenerate");
      const completed = data?.run?.completed ?? 0;
      const failed = data?.run?.failed ?? 0;
      if (completed > 0) {
        toast.success(`Regenerated ${completed} page${completed === 1 ? "" : "s"}.`);
      } else {
        toast.error(failed > 0 ? `Regeneration failed for ${failed} page(s).` : "No pages were regenerated.");
      }
      fetchPages(currentPage);
      window.dispatchEvent(new CustomEvent("seo_dashboard_refresh"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error regenerating page");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (slug: string) => {
    window.open(`/admin/seo?search=${encodeURIComponent(slug)}`, "_blank");
  };

  const confirmAutoFix = (id: string) => {
    setPageToFix(id);
    setFixConfirmOpen(true);
  };

  /** Shared Auto Fix path — used by single-row and bulk actions. */
  const submitAutoFix = async (pageIds: string[]) => {
    if (!issueType || pageIds.length === 0) return;
    const payload = { pageIds, issueType };
    console.log("ACTION_START", "auto_fix", payload);
    const res = await apiFetch("/api/seo/issues/autofix", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Auto fix failed");

    const changed = data?.changed ?? 0;
    const skipped = data?.skipped ?? 0;
    const failed = data?.failed ?? 0;
    const processed = data?.processed ?? pageIds.length;

    if (changed > 0) {
      toast.success(
        data.message ||
          `Auto Fix: ${changed} fixed, ${skipped} skipped, ${failed} failed (${processed} processed).`,
      );
    } else if (failed > 0) {
      toast.error(
        data.message ||
          `Auto Fix failed for ${failed} of ${processed} page(s).`,
      );
    } else {
      toast.info(data?.message || "No fixes were necessary.");
    }

    fetchPages(currentPage);
    window.dispatchEvent(new CustomEvent("seo_dashboard_refresh"));
    return data;
  };

  const executeAutoFix = async () => {
    if (!pageToFix) return;
    setActionLoading("auto_fix");
    try {
      await submitAutoFix([pageToFix]);
      setFixConfirmOpen(false);
      setPageToFix(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error running auto fix");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Opens a controlled confirmation dialog. We deliberately avoid the native
  // window.confirm() here: this dropdown is nested inside the Radix Dialog, and a
  // blocking confirm() inside a Radix DropdownMenuItem leaves the dismiss layer
  // in a bad state (body pointer-events:none), so the action never runs.
  const resolveBulkJobType = (action: string) => BULK_ACTION_TO_JOB_TYPE[action];

  const loadBulkPreview = async (action: string, ids: string[]) => {
    const jobType = resolveBulkJobType(action);
    if (!jobType) return null;
    setPreviewLoading(true);
    try {
      const res = await apiFetch("/api/seo/jobs/preview", {
        method: "POST",
        body: JSON.stringify({
          jobType,
          pageIds: ids,
          issueType: action === "auto_fix" ? issueType : undefined,
          issueTypes: issueType ? [issueType] : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Preview failed");
      return data.preview as {
        pageCount: number;
        estimatedMinutes: number;
        issueTypes: string[];
        batchSize: number;
      };
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    if (!resolveBulkJobType(action)) {
      toast.error("Unsupported bulk action");
      return;
    }
    setPendingBulkAction(action);
    setBulkConfirmOpen(true);
    const preview = await loadBulkPreview(action, Array.from(selectedIds));
    setBulkPreview(preview);
  };

  const createBackgroundJob = async (action: string, ids: string[]) => {
    const jobType = resolveBulkJobType(action);
    if (!jobType) throw new Error("Unsupported bulk action");

    const payload: Record<string, unknown> = {
      jobType,
      pageIds: ids,
      issueTypes: issueType ? [issueType] : [],
    };
    if (action === "auto_fix" && issueType) {
      payload.issueType = issueType;
    }

    const res = await apiFetch("/api/seo/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409 && data.conflict) {
      setConflictJob(data.activeJob ?? null);
      setConflictMessage(data.message ?? "Another job is already running.");
      setConflictOpen(true);
      return null;
    }

    if (!res.ok) throw new Error(data?.error || "Failed to create job");
    return data.job as { id: string };
  };

  const executeBulkAction = async () => {
    const action = pendingBulkAction;
    const ids = Array.from(selectedIds);
    if (!action || ids.length === 0) {
      setBulkConfirmOpen(false);
      return;
    }

    const actionName = BULK_ACTION_LABELS[action] || action;

    setActionLoading("bulk_action");
    try {
      const job = await createBackgroundJob(action, ids);
      if (!job) return;

      toast.success(
        `Background job started: ${actionName} on ${ids.length} page(s). Track progress in Job Queue.`,
      );
      window.dispatchEvent(
        new CustomEvent("seo_job_highlight", { detail: { jobId: job.id } }),
      );

      setBulkConfirmOpen(false);
      setPendingBulkAction(null);
      setBulkPreview(null);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Error running ${actionName}`);
    } finally {
      setActionLoading(null);
    }
  };

  const waitForConflictJob = async () => {
    if (!conflictJob?.id) return;
    setActionLoading("wait_conflict");
    try {
      let attempts = 0;
      while (attempts < 120) {
        const res = await fetch(`/api/seo/jobs/${conflictJob.id}`);
        const data = await res.json().catch(() => ({}));
        const status = data?.job?.status;
        if (status === "completed" || status === "failed" || status === "cancelled") {
          setConflictOpen(false);
          setConflictJob(null);
          toast.success("Previous job finished. You can retry your bulk action.");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
      }
      toast.info("Job still running. Check Job Queue for progress.");
    } finally {
      setActionLoading(null);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="ml-1 text-[#52525B]">↕</span>;
    return <span className="ml-1 text-[#F5F5F7]">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-[#F5F5F7] text-xl flex items-center gap-2">
            {issueName}
            <Badge variant="outline" className="bg-[#1E1E2A] text-[#A1A1AA] border-[rgba(255,255,255,0.08)]">
              {total} pages affected
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            {issueDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 py-2 bg-[#15151D] z-10 sticky top-0">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#52525B]" />
            <Input
              placeholder="Search in these pages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-sm pl-9"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
              <SelectTrigger className="w-[110px] bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-xs h-9 shrink-0">
                <Filter className="size-3 mr-1 text-[#52525B]" />
                <SelectValue placeholder="Page Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="longtail">Longtail</SelectItem>
                <SelectItem value="category_city">Category+City</SelectItem>
                <SelectItem value="city">City</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="state">State</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[100px] bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-xs h-9 shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border-violet-500/30 h-9 shrink-0"
                  disabled={selectedIds.size === 0 || actionLoading !== null}
                >
                  {actionLoading === "bulk_action" ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <CheckSquare className="size-4 mr-2" />
                  )}
                  Bulk Actions ({selectedIds.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
                <DropdownMenuItem className="text-violet-400 focus:bg-violet-600/20 focus:text-violet-300 cursor-pointer" onClick={() => handleBulkAction("auto_fix")}>
                  Auto Fix Selected
                </DropdownMenuItem>
                <DropdownMenuItem className="text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.05)] cursor-pointer" onClick={() => handleBulkAction("regenerate")}>
                  Regenerate Selected
                </DropdownMenuItem>
                <DropdownMenuItem className="text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.05)] cursor-pointer" onClick={() => handleBulkAction("generate_missing")}>
                  Generate Missing Meta
                </DropdownMenuItem>
                <DropdownMenuItem className="text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.05)] cursor-pointer" onClick={() => handleBulkAction("repair_canonical")}>
                  Repair Canonicals
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/50">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-[#0E0E17] z-10">
              <tr className="text-[#A1A1AA] border-b border-[rgba(255,255,255,0.06)] select-none">
                <th className="py-3 px-4 font-medium w-[40px]">
                  <input
                    type="checkbox"
                    className="rounded border-[rgba(255,255,255,0.2)] bg-transparent accent-violet-600 cursor-pointer"
                    checked={pages.length > 0 && selectedIds.size === pages.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th 
                  className="py-3 px-4 font-medium cursor-pointer hover:text-[#F5F5F7] transition-colors"
                  onClick={() => handleSort("pageSlug")}
                >
                  Page Info <SortIcon field="pageSlug" />
                </th>
                <th 
                  className="py-3 px-4 font-medium cursor-pointer hover:text-[#F5F5F7] transition-colors"
                  onClick={() => handleSort("seoQualityScore")}
                >
                  SEO Score & Status <SortIcon field="seoQualityScore" />
                </th>
                {issueType?.startsWith("duplicate") && (
                  <th 
                    className="py-3 px-4 font-medium cursor-pointer hover:text-[#F5F5F7] transition-colors"
                    onClick={() => handleSort("duplicateValue")}
                  >
                    Duplicate Value <SortIcon field="duplicateValue" />
                  </th>
                )}
                {issueType === "broken_internal_links" && (
                  <th className="py-3 px-4 font-medium">Broken Links</th>
                )}
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {loading && pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#A1A1AA]">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                    Loading pages...
                  </td>
                </tr>
              ) : pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#52525B]">
                    No pages found matching this issue.
                  </td>
                </tr>
              ) : groupedPages ? (
                groupedPages.map((group, groupIndex) => (
                  <React.Fragment key={`group-${groupIndex}`}>
                    <tr className="bg-[rgba(255,255,255,0.01)] border-t border-[rgba(255,255,255,0.06)]">
                      <td colSpan={issueType?.startsWith("duplicate") ? 5 : 4} className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-[#1E1E2A] text-amber-400 border-amber-500/30 text-xs">
                            Group {groupIndex + 1}
                          </Badge>
                          <span className="text-xs text-[#A1A1AA] truncate max-w-[600px]" title={group.value}>
                            Duplicate value: <strong className="text-[#F5F5F7]">"{group.value}"</strong>
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((p) => (
                      <tr key={p.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            className="rounded border-[rgba(255,255,255,0.2)] bg-transparent accent-violet-600 cursor-pointer"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                          />
                        </td>
                        <td className="py-3 px-4 max-w-[300px]">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-[#F5F5F7] truncate" title={p.title || "No Title"}>
                              {p.title || <span className="italic text-[#52525B]">No Title</span>}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                              <Badge variant="outline" className="bg-transparent border-[#A1A1AA]/30 py-0 h-4 text-[9px] uppercase tracking-wider">
                                {p.pageType}
                              </Badge>
                              <span className="truncate" title={p.pageSlug}>{p.pageSlug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <span className={p.seoQualityScore >= 80 ? "text-emerald-400 font-medium" : p.seoQualityScore >= 60 ? "text-amber-400 font-medium" : "text-red-400 font-medium"}>
                              Score: {p.seoQualityScore ?? "—"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#52525B]">
                                Risk: {p.duplicateRisk || "low"}
                              </span>
                              <span className="text-[10px] text-[#A1A1AA]">
                                • {p.isPublished ? "Published" : "Draft"}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#52525B]">
                              Updated: {new Date(p.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-[200px] truncate text-[#A1A1AA] text-xs" title={p.duplicateValue}>
                          {p.duplicateValue}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 hover:bg-violet-600/20 text-violet-400 font-medium"
                              title="Auto Fix Issue"
                              disabled={actionLoading !== null}
                              onClick={() => confirmAutoFix(p.id)}
                            >
                              Auto Fix
                            </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                            title="Edit SEO"
                            onClick={() => handleEdit(p.pageSlug)}
                          >
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                              title="Regenerate SEO"
                              onClick={() => handleRegenerate(p.id)}
                              disabled={actionLoading === `regen_${p.id}`}
                            >
                              {actionLoading === `regen_${p.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                              title="View Live Page"
                              onClick={() => window.open(getSeoPagePublicUrl(p), "_blank")}
                            >
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                pages.map((p) => (
                  <tr key={p.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-[rgba(255,255,255,0.2)] bg-transparent accent-violet-600 cursor-pointer"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="py-3 px-4 max-w-[300px]">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-[#F5F5F7] truncate" title={p.title || "No Title"}>
                          {p.title || <span className="italic text-[#52525B]">No Title</span>}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Badge variant="outline" className="bg-transparent border-[#A1A1AA]/30 py-0 h-4 text-[9px] uppercase tracking-wider">
                            {p.pageType}
                          </Badge>
                          <span className="truncate" title={p.pageSlug}>{p.pageSlug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className={p.seoQualityScore >= 80 ? "text-emerald-400 font-medium" : p.seoQualityScore >= 60 ? "text-amber-400 font-medium" : "text-red-400 font-medium"}>
                          Score: {p.seoQualityScore ?? "—"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#52525B]">
                            Risk: {p.duplicateRisk || "low"}
                          </span>
                          <span className="text-[10px] text-[#A1A1AA]">
                            • {p.isPublished ? "Published" : "Draft"}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#52525B]">
                          Updated: {new Date(p.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    {issueType === "broken_internal_links" && (
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="flex flex-col gap-1 text-xs text-[#A1A1AA]">
                          {(p.brokenLinks ?? []).slice(0, 2).map((link: { brokenUrl: string; anchor: string; suggestedReplacement?: string | null }, idx: number) => (
                            <div key={`${p.id}-broken-${idx}`} className="truncate" title={`${link.anchor} → ${link.brokenUrl}`}>
                              <span className="text-red-400">{link.brokenUrl}</span>
                              {link.suggestedReplacement ? (
                                <span className="text-emerald-400"> → {link.suggestedReplacement}</span>
                              ) : (
                                <span className="text-[#52525B]"> (remove)</span>
                              )}
                            </div>
                          ))}
                          {(p.brokenLinkCount ?? 0) > 2 && (
                            <span className="text-[#52525B]">+{(p.brokenLinkCount ?? 0) - 2} more</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 hover:bg-violet-600/20 text-violet-400 font-medium"
                          title="Auto Fix Issue"
                          disabled={actionLoading !== null}
                          onClick={() => confirmAutoFix(p.id)}
                        >
                          Auto Fix
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                          title="Edit SEO"
                          onClick={() => handleEdit(p.pageSlug)}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                          title="Regenerate SEO"
                          onClick={() => handleRegenerate(p.id)}
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                          title="View Live Page"
                          onClick={() => window.open(getSeoPagePublicUrl(p), "_blank")}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between shrink-0 pt-4 border-t border-[rgba(255,255,255,0.08)]">
          <span className="text-xs text-[#A1A1AA]">
            Showing {pages.length} of {total} results
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => fetchPages(currentPage - 1)}
              className="bg-transparent border-[rgba(255,255,255,0.08)]"
            >
              Previous
            </Button>
            <span className="text-xs text-[#F5F5F7] px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => fetchPages(currentPage + 1)}
              className="bg-transparent border-[rgba(255,255,255,0.08)]"
            >
              Next
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Auto Fix Confirmation Dialog */}
      <Dialog open={fixConfirmOpen} onOpenChange={setFixConfirmOpen}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Confirm Auto Fix</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Are you sure you want to automatically resolve this issue for the selected page?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setFixConfirmOpen(false)}
              className="bg-transparent border-[rgba(255,255,255,0.08)] text-[#A1A1AA]"
            >
              Cancel
            </Button>
            <Button
              onClick={executeAutoFix}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={actionLoading === "auto_fix"}
            >
              {actionLoading === "auto_fix" ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Processing</>
              ) : "Confirm Auto Fix"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(o) => { if (!o) { setBulkConfirmOpen(false); setPendingBulkAction(null); setBulkPreview(null); } }}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">
              Confirm {pendingBulkAction ? BULK_ACTION_LABELS[pendingBulkAction] ?? pendingBulkAction : "Bulk Action"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-[#A1A1AA] space-y-2 mt-2">
                <p>
                  You are about to process:{" "}
                  <span className="text-[#F5F5F7] font-medium">
                    {bulkPreview?.pageCount ?? selectedIds.size} pages
                  </span>
                </p>
                {previewLoading ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Loader2 className="size-3 animate-spin" /> Estimating duration…
                  </p>
                ) : (
                  <p>
                    Estimated duration:{" "}
                    <span className="text-[#F5F5F7] font-medium">
                      ~{bulkPreview?.estimatedMinutes ?? "—"} minutes
                    </span>
                  </p>
                )}
                {(bulkPreview?.issueTypes?.length ?? 0) > 0 && (
                  <p>
                    Affected issue types:{" "}
                    <span className="text-[#F5F5F7]">
                      {bulkPreview!.issueTypes.join(", ")}
                    </span>
                  </p>
                )}
                <p className="text-xs text-[#52525B]">
                  Runs as a background job (batch size {bulkPreview?.batchSize ?? 100}). Dashboard updates automatically.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => { setBulkConfirmOpen(false); setPendingBulkAction(null); setBulkPreview(null); }}
              className="bg-transparent border-[rgba(255,255,255,0.08)] text-[#A1A1AA]"
              disabled={actionLoading === "bulk_action"}
            >
              Cancel
            </Button>
            <Button
              onClick={executeBulkAction}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={actionLoading === "bulk_action" || previewLoading}
            >
              {actionLoading === "bulk_action" ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Starting…</>
              ) : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Concurrent job conflict */}
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Job Already Running</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              {conflictMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConflictOpen(false)}
              className="bg-transparent border-[rgba(255,255,255,0.08)] text-[#A1A1AA]"
            >
              Cancel
            </Button>
            {conflictJob?.id && (
              <Button
                variant="outline"
                onClick={() => {
                  setConflictOpen(false);
                  window.dispatchEvent(
                    new CustomEvent("seo_job_highlight", { detail: { jobId: conflictJob.id } }),
                  );
                }}
                className="border-violet-500/30 text-violet-400"
              >
                View Job
              </Button>
            )}
            <Button
              onClick={waitForConflictJob}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={actionLoading === "wait_conflict"}
            >
              {actionLoading === "wait_conflict" ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Waiting…</>
              ) : "Wait"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

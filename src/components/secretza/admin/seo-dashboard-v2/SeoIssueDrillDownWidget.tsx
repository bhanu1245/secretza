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
import { toast } from "sonner";
import { getSeoPagePublicUrl } from "@/lib/seo-public-page";

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
  | "duplicate_content";

interface DrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueType: IssueType | null;
  issueName: string;
  issueDescription: string;
}

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
    toast.info("Regeneration will be implemented in bulk operations phase.");
  };

  const handleEdit = (id: string) => {
    toast.info("Edit mode opening (Placeholder).");
  };

  const confirmAutoFix = (id: string) => {
    setPageToFix(id);
    setFixConfirmOpen(true);
  };

  const executeAutoFix = async () => {
    if (!pageToFix) return;
    toast.success(`Auto fix queued for page ID: ${pageToFix}. (Bulk Phase feature)`);
    setFixConfirmOpen(false);
    setPageToFix(null);
  };

  const supportsAutoFix = [
    "missing_meta",
    "missing_title",
    "missing_h1",
    "missing_schema",
    "duplicate_titles",
    "duplicate_meta",
  ].includes(issueType || "");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
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

            <Button
              variant="outline"
              size="sm"
              className="bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border-violet-500/30 h-9 shrink-0"
              disabled={selectedIds.size === 0}
            >
              <CheckSquare className="size-4 mr-2" />
              Bulk Actions ({selectedIds.size})
            </Button>
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
                            {supportsAutoFix && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 hover:bg-violet-600/20 text-violet-400 font-medium"
                                title="Auto Fix Issue"
                                onClick={() => confirmAutoFix(p.id)}
                              >
                                Auto Fix
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                              title="Edit SEO"
                              onClick={() => handleEdit(p.id)}
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
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {supportsAutoFix && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 hover:bg-violet-600/20 text-violet-400 font-medium"
                            title="Auto Fix Issue"
                            onClick={() => confirmAutoFix(p.id)}
                          >
                            Auto Fix
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA]"
                          title="Edit SEO"
                          onClick={() => handleEdit(p.id)}
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
            >
              Confirm Auto Fix
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

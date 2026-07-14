"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  readabilityScoreColor,
  seoScoreColor,
  uniquenessScoreColor,
  type QualitySettings,
  type ReviewDashboard,
  type ReviewPageDiff,
  type ReviewPageRow,
} from "@/types/seo-review";
import {
  logReviewLoadingFinished,
  logReviewLoadingStarted,
  REVIEW_LOADING_WATCHDOG_MS,
  reviewStudioGetJson,
  reviewStudioPostJson,
  ReviewStudioTimeoutError,
} from "@/lib/review-studio-client";

export type { QualitySettings, ReviewDashboard, ReviewPageRow } from "@/types/seo-review";

type ReviewFilter =
  | "all"
  | "weak_seo"
  | "weak_uniqueness"
  | "excellent"
  | "ready"
  | "needs_improvement"
  | "regenerated"
  | "improved"
  | "skipped";

type SortKey =
  | "seo"
  | "uniqueness"
  | "readability"
  | "generationTimeMs"
  | "pageSlug"
  | "pageType"
  | "status";

type CommitSummary = {
  total: number;
  excellent: number;
  weakSeo: number;
  weakUniqueness: number;
  duplicates: number;
  needsImprovement: number;
  productionReady: number;
  commitProductionOnly: number;
};

type SeoReviewStudioProps = {
  jobId: string;
  pages: ReviewPageRow[];
  dashboard: ReviewDashboard | null;
  qualitySettings: QualitySettings;
  onPagesChange: (pages: ReviewPageRow[], dashboard?: ReviewDashboard | null) => void;
  onQualitySettingsChange: (settings: QualitySettings) => void;
  onCommit: (mode: "production_only" | "selected" | "all_anyway", slugs?: string[]) => Promise<void>;
  onDiscard: () => Promise<void>;
  onClose: () => void;
  committing: boolean;
};

const SCORE_CLASS: Record<string, string> = {
  green: "text-emerald-400",
  blue: "text-sky-400",
  orange: "text-amber-400",
  red: "text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  excellent: "Excellent",
  ready: "Ready",
  needs_improvement: "Needs Improvement",
  regenerated: "Regenerated",
  improved: "Improved",
  skipped: "Skipped",
  failed: "Failed",
};

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

export default function SeoReviewStudio({
  jobId,
  pages,
  dashboard,
  qualitySettings,
  onPagesChange,
  onQualitySettingsChange,
  onCommit,
  onDiscard,
  onClose,
  committing,
}: SeoReviewStudioProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("seo");
  const [sortAsc, setSortAsc] = useState(false);
  const [busySlugs, setBusySlugs] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [viewSlug, setViewSlug] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<Record<string, unknown> | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitSummary, setCommitSummary] = useState<CommitSummary | null>(null);
  const [commitScope, setCommitScope] = useState<"all" | "selected">("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(qualitySettings);
  const [viewTimedOut, setViewTimedOut] = useState(false);
  const viewAbortRef = useRef<AbortController | null>(null);
  const bulkAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      viewAbortRef.current?.abort();
      bulkAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!viewLoading) return;
    const watchdog = setTimeout(() => {
      console.warn("ReviewStudio: view watchdog fired (>90s)");
      viewAbortRef.current?.abort();
      setViewLoading(false);
      setViewTimedOut(true);
      toast.error("Operation taking longer than expected. Please retry.");
    }, REVIEW_LOADING_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [viewLoading]);

  const applyJobResponse = useCallback(
    (data: { job?: { dryRunPreview?: { pages?: ReviewPageRow[]; dashboard?: ReviewDashboard } } }) => {
      const preview = data.job?.dryRunPreview;
      if (preview?.pages) {
        onPagesChange(preview.pages, preview.dashboard ?? null);
      }
    },
    [onPagesChange],
  );

  const filteredPages = useMemo(() => {
    let list = [...pages];
    switch (filter) {
      case "weak_seo":
        list = list.filter((p) => p.seo < qualitySettings.minSeo);
        break;
      case "weak_uniqueness":
        list = list.filter((p) => p.uniqueness < qualitySettings.minUniqueness);
        break;
      case "excellent":
        list = list.filter((p) => p.status === "excellent" || p.productionReady);
        break;
      case "ready":
        list = list.filter((p) => p.status === "ready");
        break;
      case "needs_improvement":
        list = list.filter((p) => p.status === "needs_improvement" || !p.productionReady);
        break;
      case "regenerated":
        list = list.filter((p) => p.status === "regenerated");
        break;
      case "improved":
        list = list.filter((p) => p.status === "improved");
        break;
      case "skipped":
        list = list.filter((p) => p.status === "skipped");
        break;
      default:
        break;
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "seo":
          cmp = a.seo - b.seo;
          break;
        case "uniqueness":
          cmp = a.uniqueness - b.uniqueness;
          break;
        case "readability":
          cmp = a.readability - b.readability;
          break;
        case "generationTimeMs":
          cmp = a.generationTimeMs - b.generationTimeMs;
          break;
        case "pageSlug":
          cmp = a.pageSlug.localeCompare(b.pageSlug);
          break;
        case "pageType":
          cmp = a.pageType.localeCompare(b.pageType);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [pages, filter, sortKey, sortAsc, qualitySettings]);

  const allVisibleSelected =
    filteredPages.length > 0 && filteredPages.every((p) => selected.has(p.pageSlug));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of filteredPages) next.delete(p.pageSlug);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of filteredPages) next.add(p.pageSlug);
        return next;
      });
    }
  };

  const selectWeakPages = () => {
    const weak = pages.filter(
      (p) =>
        p.seo < qualitySettings.minSeo ||
        p.uniqueness < qualitySettings.minUniqueness ||
        p.readability < qualitySettings.minReadability,
    );
    setSelected(new Set(weak.map((p) => p.pageSlug)));
    toast.info(`Selected ${weak.length} weak page(s)`);
  };

  const runPageAction = async (slug: string, action: "regenerate_page" | "improve_page") => {
    const label = action === "regenerate_page" ? "regenerate" : "improve";
    console.log(`ReviewStudio: ${label}() started`, { jobId, pageSlug: slug });
    setBusySlugs((s) => new Set(s).add(slug));
    try {
      const data = await reviewStudioPostJson(
        { action, jobId, pageSlug: slug },
        label,
      );
      applyJobResponse(data);
      console.log(`ReviewStudio: ${label}() completed`, { jobId, pageSlug: slug });
      toast.success(action === "regenerate_page" ? "Page regenerated" : "Page improved");
    } catch (err) {
      console.error(`ReviewStudio: ${label}() failed`, err);
      const msg =
        err instanceof ReviewStudioTimeoutError
          ? "Request timed out after 60 seconds. Please retry."
          : err instanceof Error
            ? err.message
            : "Action failed";
      toast.error(msg);
    } finally {
      setBusySlugs((s) => {
        const next = new Set(s);
        next.delete(slug);
        return next;
      });
    }
  };

  const runBulkAction = async (
    action: "bulk_regenerate" | "bulk_improve" | "discard_selected" | "improve_weak",
  ) => {
    const slugs = action === "improve_weak" ? undefined : [...selected];
    if (action !== "improve_weak" && (!slugs || slugs.length === 0)) {
      toast.error("Select at least one page");
      return;
    }
    console.log(`ReviewStudio: bulk ${action}() started`, {
      jobId,
      slugCount: slugs?.length ?? "all-weak",
    });
    bulkAbortRef.current?.abort();
    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setBulkBusy(true);
    logReviewLoadingStarted(`bulk-${action}`);
    try {
      const data = await reviewStudioPostJson<{
        removed?: number;
        pages?: unknown[];
        job?: { dryRunPreview?: { pages?: ReviewPageRow[]; dashboard?: ReviewDashboard } };
      }>(
        { action, jobId, pageSlugs: slugs },
        `bulk-${action}`,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      applyJobResponse(data);
      console.log(`ReviewStudio: bulk ${action}() completed`, { jobId });
      if (action === "discard_selected") {
        setSelected(new Set());
        toast.info(`Removed ${data.removed ?? 0} page(s) from preview`);
      } else {
        toast.success(
          action === "improve_weak"
            ? `Improved ${data.pages?.length ?? 0} weak page(s)`
            : `Updated ${data.pages?.length ?? slugs?.length ?? 0} page(s)`,
        );
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(`ReviewStudio: bulk ${action}() failed`, err);
      const msg =
        err instanceof ReviewStudioTimeoutError
          ? "Request timed out after 60 seconds. Please retry."
          : err instanceof Error
            ? err.message
            : "Bulk action failed";
      toast.error(msg);
    } finally {
      if (bulkAbortRef.current === controller) bulkAbortRef.current = null;
      setBulkBusy(false);
      logReviewLoadingFinished(`bulk-${action}`);
    }
  };

  const openView = async (slug: string) => {
    console.log("ReviewStudio: fetchReview() started", { jobId, pageSlug: slug });
    viewAbortRef.current?.abort();
    const controller = new AbortController();
    viewAbortRef.current = controller;

    setViewSlug(slug);
    setViewLoading(true);
    setViewDetail(null);
    setViewTimedOut(false);
    logReviewLoadingStarted("fetchReview");

    try {
      const { response, data } = await reviewStudioGetJson<{ page?: Record<string, unknown>; error?: string }>(
        `/api/admin/seo/generate-city-pack?jobId=${jobId}&pageSlug=${encodeURIComponent(slug)}`,
        "fetchReview",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error ?? "Failed to load page");
      if (!data.page) {
        setViewDetail(null);
        toast.error("No preview available for this page");
        setViewSlug(null);
        return;
      }
      setViewDetail(data.page);
      console.log("ReviewStudio: fetchReview() completed", { jobId, pageSlug: slug });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("ReviewStudio: fetchReview() failed", err);
      const msg =
        err instanceof ReviewStudioTimeoutError
          ? "Request timed out after 60 seconds. Please retry."
          : err instanceof Error
            ? err.message
            : "Failed to load page";
      toast.error(msg);
      setViewTimedOut(err instanceof ReviewStudioTimeoutError);
      setViewSlug(null);
    } finally {
      if (viewAbortRef.current === controller) viewAbortRef.current = null;
      setViewLoading(false);
      logReviewLoadingFinished("fetchReview");
    }
  };

  const openCommitDialog = async (scope: "all" | "selected") => {
    setCommitScope(scope);
    console.log("ReviewStudio: commit_summary() started", { jobId, scope });
    try {
      const slugs = scope === "selected" ? [...selected] : undefined;
      const data = await reviewStudioPostJson<{ summary: CommitSummary }>(
        { action: "commit_summary", jobId, pageSlugs: slugs },
        "commit_summary",
      );
      setCommitSummary(data.summary);
      setShowCommitDialog(true);
      console.log("ReviewStudio: commit_summary() completed", { jobId });
    } catch (err) {
      console.error("ReviewStudio: commit_summary() failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to load commit summary");
    }
  };

  const saveSettings = async () => {
    console.log("ReviewStudio: update_settings() started", { jobId });
    try {
      const data = await reviewStudioPostJson<{
        qualitySettings?: QualitySettings;
        job?: { dryRunPreview?: { pages?: ReviewPageRow[]; dashboard?: ReviewDashboard } };
      }>({ action: "update_settings", jobId, settings: settingsDraft }, "update_settings");
      if (data.qualitySettings) onQualitySettingsChange(data.qualitySettings);
      applyJobResponse(data);
      setShowSettings(false);
      console.log("ReviewStudio: update_settings() completed", { jobId });
      toast.success("Quality thresholds updated");
    } catch (err) {
      console.error("ReviewStudio: update_settings() failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const handleStudioClose = () => {
    viewAbortRef.current?.abort();
    bulkAbortRef.current?.abort();
    setViewLoading(false);
    setBulkBusy(false);
    setViewSlug(null);
    onClose();
  };

  const dash = dashboard ?? {
    pageCount: pages.length,
    wouldSaveCount: pages.filter((p) => p.wouldSave).length,
    excellentCount: pages.filter((p) => p.productionReady).length,
    needsImprovementCount: pages.filter((p) => !p.productionReady).length,
    productionReadyCount: pages.filter((p) => p.productionReady).length,
    weakSeoCount: pages.filter((p) => p.seo < qualitySettings.minSeo).length,
    duplicateCount: pages.filter((p) => p.duplicateRisk === "high").length,
    avgSeo:
      pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.seo, 0) / pages.length)
        : null,
    avgUniqueness:
      pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.uniqueness, 0) / pages.length)
        : null,
    avgReadability:
      pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.readability, 0) / pages.length)
        : null,
    estimatedQuality: "Good",
  };

  return (
    <div className="space-y-3">
      {/* Dashboard summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Pages Previewed</p>
          <p className="text-[#F5F5F7] font-semibold text-lg">{dash.pageCount}</p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Would Save</p>
          <p className="text-emerald-400 font-semibold text-lg">{dash.wouldSaveCount}</p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Excellent</p>
          <p className="text-emerald-400 font-semibold text-lg">{dash.excellentCount}</p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Needs Improvement</p>
          <p className="text-amber-400 font-semibold text-lg">{dash.needsImprovementCount}</p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Avg SEO</p>
          <p className="text-violet-400 font-semibold">{dash.avgSeo ?? "—"}</p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Avg Uniqueness</p>
          <p className="text-emerald-400 font-semibold">
            {dash.avgUniqueness != null ? `${dash.avgUniqueness}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Avg Readability</p>
          <p className="text-sky-400 font-semibold">{dash.avgReadability ?? "—"}</p>
        </div>
        <div className="rounded-lg bg-[#0E0E17] p-2">
          <p className="text-[#71717A]">Est. Google Quality</p>
          <p className="text-[#F5F5F7] font-semibold">{dash.estimatedQuality}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={bulkBusy || committing}
          onClick={() => void runBulkAction("bulk_regenerate")}
        >
          {bulkBusy ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RefreshCw className="size-3 mr-1" />}
          Regenerate Selected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={bulkBusy || committing}
          onClick={() => void runBulkAction("bulk_improve")}
        >
          <Sparkles className="size-3 mr-1" />
          Improve Selected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs border-red-500/30 text-red-300"
          disabled={bulkBusy || committing}
          onClick={() => void runBulkAction("discard_selected")}
        >
          <Trash2 className="size-3 mr-1" />
          Discard Selected
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
          disabled={bulkBusy || committing || selected.size === 0}
          onClick={() => void openCommitDialog("selected")}
        >
          <Upload className="size-3 mr-1" />
          Commit Selected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={bulkBusy || committing}
          onClick={selectWeakPages}
        >
          Select Weak Pages
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={bulkBusy || committing}
          onClick={() => void runBulkAction("improve_weak")}
        >
          <Sparkles className="size-3 mr-1" />
          Improve All Weak
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs ml-auto"
          onClick={() => {
            setSettingsDraft(qualitySettings);
            setShowSettings(true);
          }}
        >
          Quality Settings
        </Button>
      </div>

      {/* Filters & sort */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ReviewFilter)}
          className="rounded border border-white/10 bg-[#0B0B0F] px-2 py-1 text-[#F5F5F7]"
        >
          <option value="all">All</option>
          <option value="weak_seo">Weak SEO</option>
          <option value="weak_uniqueness">Weak Uniqueness</option>
          <option value="excellent">Excellent</option>
          <option value="ready">Ready</option>
          <option value="needs_improvement">Needs Improvement</option>
          <option value="regenerated">Regenerated</option>
          <option value="improved">Improved</option>
          <option value="skipped">Skipped</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded border border-white/10 bg-[#0B0B0F] px-2 py-1 text-[#F5F5F7]"
        >
          <option value="seo">SEO Score</option>
          <option value="uniqueness">Uniqueness</option>
          <option value="readability">Readability</option>
          <option value="generationTimeMs">Generation Time</option>
          <option value="pageSlug">Slug</option>
          <option value="pageType">Type</option>
          <option value="status">Status</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={() => setSortAsc((v) => !v)}
        >
          {sortAsc ? "↑ Asc" : "↓ Desc"}
        </Button>
        <span className="text-[#6B6B7A]">{selected.size} selected</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] overflow-hidden max-h-[45vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#0E0E17] text-[#71717A] sticky top-0 z-10">
            <tr>
              <th className="p-2 w-8">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="text-left p-2">Slug</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">SEO</th>
              <th className="text-left p-2">Unique</th>
              <th className="text-left p-2">Read</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Save?</th>
              <th className="text-left p-2">Generated</th>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPages.map((p) => {
              const seoC = SCORE_CLASS[seoScoreColor(p.seo)];
              const uniqC = SCORE_CLASS[uniquenessScoreColor(p.uniqueness)];
              const readC = SCORE_CLASS[readabilityScoreColor(p.readability)];
              const busy = busySlugs.has(p.pageSlug);
              return (
                <tr
                  key={p.pageSlug}
                  className="border-t border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02]"
                >
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(p.pageSlug)}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(p.pageSlug);
                          else next.delete(p.pageSlug);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="p-2 font-mono text-[#F5F5F7] max-w-[120px] truncate" title={p.pageSlug}>
                    {p.pageSlug}
                  </td>
                  <td className="p-2 text-[#A1A1AA]">{p.pageType}</td>
                  <td className={`p-2 font-medium ${seoC}`}>{p.seo}</td>
                  <td className={`p-2 font-medium ${uniqC}`}>{p.uniqueness}%</td>
                  <td className={`p-2 font-medium ${readC}`}>{p.readability}</td>
                  <td className="p-2">
                    <span
                      className={
                        p.productionReady
                          ? "text-emerald-400"
                          : p.status === "needs_improvement"
                            ? "text-amber-400"
                            : "text-[#A1A1AA]"
                      }
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="p-2">
                    {p.productionReady ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-amber-400" />
                    )}
                  </td>
                  <td className="p-2 text-[#6B6B7A] whitespace-nowrap">{formatTime(p.generatedAt)}</td>
                  <td className="p-2 text-[#6B6B7A]">{formatMs(p.generationTimeMs)}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => void openView(p.pageSlug)}
                      >
                        <Eye className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy || bulkBusy}
                        onClick={() => void runPageAction(p.pageSlug, "regenerate_page")}
                      >
                        {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        disabled={busy || bulkBusy}
                        onClick={() => void runPageAction(p.pageSlug, "improve_page")}
                      >
                        <Sparkles className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[#6B6B7A]">
        Preview cached 30 min. Only production-ready pages (SEO ≥ {qualitySettings.productionMinSeo},
        Uniqueness ≥ {qualitySettings.productionMinUniqueness}%, Readability ≥{" "}
        {qualitySettings.productionMinReadability}) commit by default.
      </p>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-white/5">
        <Button
          type="button"
          variant="outline"
          onClick={() => void onDiscard()}
          disabled={committing || bulkBusy}
          className="border-red-500/30 text-red-300 hover:bg-red-500/10"
        >
          Discard All
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleStudioClose}
          disabled={committing}
          className="border-white/10 bg-transparent text-[#A1A1AA]"
        >
          Close
        </Button>
        <Button
          type="button"
          onClick={() => void openCommitDialog("all")}
          disabled={committing || bulkBusy || dash.productionReadyCount === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {committing ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Committing…
            </>
          ) : (
            `Commit Production-Ready (${dash.productionReadyCount})`
          )}
        </Button>
      </div>

      {/* View modal */}
      <Dialog
        open={!!viewSlug}
        onOpenChange={(open) => {
          if (!open) {
            viewAbortRef.current?.abort();
            setViewLoading(false);
            setViewSlug(null);
          }
        }}
      >
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] font-mono text-sm">{viewSlug}</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">Read-only preview</DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="size-6 animate-spin text-violet-400" />
              {viewTimedOut && (
                <p className="text-xs text-amber-400">Taking longer than expected…</p>
              )}
            </div>
          ) : viewDetail ? (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 text-sm">
                <Section title="SEO Title" value={String(viewDetail.title ?? "")} />
                <Section title="Meta Description" value={String(viewDetail.metaDescription ?? "")} />
                <Section title="H1" value={String(viewDetail.h1 ?? "")} />
                <Section
                  title="Full Content"
                  value={
                    (viewDetail.content as { fullIntroContent?: string; introParagraph?: string })?.fullIntroContent ??
                    (viewDetail.content as { introParagraph?: string })?.introParagraph ??
                    String(viewDetail.introPreview ?? "")
                  }
                  mono
                />
                {Array.isArray((viewDetail.content as { faqs?: unknown[] })?.faqs) && (
                  <div>
                    <p className="text-xs font-medium text-[#A1A1AA] mb-2">FAQs</p>
                    {((viewDetail.content as { faqs: Array<{ question: string; answer: string }> }).faqs).map(
                      (f, i) => (
                        <div key={i} className="mb-2 rounded bg-[#0B0B0F] p-2">
                          <p className="text-[#F5F5F7] font-medium">{f.question}</p>
                          <p className="text-[#A1A1AA] text-xs mt-1">{f.answer}</p>
                        </div>
                      ),
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label="SEO" value={String(viewDetail.seo)} />
                  <Metric label="Uniqueness" value={`${viewDetail.uniqueness}%`} />
                  <Metric label="Readability" value={String(viewDetail.readability)} />
                  <Metric label="Internal Links" value={String(viewDetail.internalLinksCount ?? 0)} />
                  <Metric label="Duplicate Risk" value={String(viewDetail.duplicateRisk)} />
                  <Metric label="Local Intel" value={viewDetail.localIntelligence ? "Yes" : "No"} />
                </div>
                {viewDetail.aiNotes != null && viewDetail.aiNotes !== "" ? (
                  <Section title="AI Notes" value={String(viewDetail.aiNotes)} />
                ) : null}
                {Array.isArray(viewDetail.validationIssues) && viewDetail.validationIssues.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-400 mb-1">Validation Issues</p>
                    <ul className="list-disc pl-4 text-xs text-amber-300/80">
                      {(viewDetail.validationIssues as string[]).map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {viewDetail.diff != null ? (
                  <div className="rounded-lg border border-violet-500/20 p-3 space-y-2">
                    <p className="text-xs font-medium text-violet-300">AI Diff</p>
                    {(viewDetail.diff as ReviewPageDiff)?.intro?.changed && (
                      <>
                        <p className="text-[10px] text-[#71717A]">Original</p>
                        <p className="text-xs text-red-400/70 line-through max-h-24 overflow-y-auto">
                          {(viewDetail.diff as ReviewPageDiff)?.intro.old}
                        </p>
                        <p className="text-[10px] text-[#71717A]">Improved</p>
                        <p className="text-xs text-emerald-400 max-h-32 overflow-y-auto">
                          {(viewDetail.diff as ReviewPageDiff)?.intro.new}
                        </p>
                      </>
                    )}
                    <div className="flex gap-4 text-xs">
                      {(viewDetail.diff as ReviewPageDiff)?.seoDelta != null && (
                        <span className="text-emerald-400">
                          SEO {(viewDetail.diff as ReviewPageDiff)!.seoDelta! >= 0 ? "+" : ""}
                          {(viewDetail.diff as ReviewPageDiff)!.seoDelta}
                        </span>
                      )}
                      {(viewDetail.diff as ReviewPageDiff)?.uniquenessDelta != null && (
                        <span className="text-emerald-400">
                          Uniqueness {(viewDetail.diff as ReviewPageDiff)!.uniquenessDelta! >= 0 ? "+" : ""}
                          {(viewDetail.diff as ReviewPageDiff)!.uniquenessDelta}%
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Commit confirmation */}
      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#F5F5F7]">Confirm Commit</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[#A1A1AA] space-y-2 text-sm">
                {commitSummary && (
                  <>
                    <p>
                      <strong className="text-[#F5F5F7]">{commitSummary.total}</strong> pages in scope
                    </p>
                    <ul className="space-y-1 text-xs">
                      <li className="text-emerald-400">{commitSummary.excellent} production-ready</li>
                      <li className="text-amber-400">{commitSummary.weakSeo} weak SEO</li>
                      <li className="text-amber-400">{commitSummary.duplicates} high duplicate risk</li>
                      <li className="text-red-400">{commitSummary.needsImprovement} need improvement</li>
                    </ul>
                    <p className="text-xs pt-2">
                      Low-quality pages will not be committed unless you choose &quot;Commit all anyway&quot;.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setShowCommitDialog(false);
                const slugs = commitScope === "selected" ? [...selected] : undefined;
                void onCommit("production_only", slugs);
              }}
            >
              Commit production-ready only
            </AlertDialogAction>
            {commitSummary && commitSummary.needsImprovement > 0 && (
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  setShowCommitDialog(false);
                  const slugs = commitScope === "selected" ? [...selected] : undefined;
                  void onCommit("all_anyway", slugs);
                }}
              >
                Commit all anyway
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quality settings */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Quality Thresholds</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Pages below minimum thresholds cannot auto-commit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <ThresholdField
              label="Minimum SEO"
              value={settingsDraft.minSeo}
              onChange={(v) => setSettingsDraft((s) => ({ ...s, minSeo: v }))}
            />
            <ThresholdField
              label="Minimum Uniqueness"
              value={settingsDraft.minUniqueness}
              onChange={(v) => setSettingsDraft((s) => ({ ...s, minUniqueness: v }))}
            />
            <ThresholdField
              label="Minimum Readability"
              value={settingsDraft.minReadability}
              onChange={(v) => setSettingsDraft((s) => ({ ...s, minReadability: v }))}
            />
            <div className="border-t border-white/5 pt-3 space-y-2">
              <p className="text-xs text-[#71717A]">Retry until threshold (optional)</p>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Retry until SEO ≥ 90</Label>
                <Switch
                  checked={settingsDraft.retryUntilSeo === 90}
                  onCheckedChange={(on) =>
                    setSettingsDraft((s) => ({ ...s, retryUntilSeo: on ? 90 : null }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Retry until Uniqueness ≥ 80</Label>
                <Switch
                  checked={settingsDraft.retryUntilUniqueness === 80}
                  onCheckedChange={(on) =>
                    setSettingsDraft((s) => ({ ...s, retryUntilUniqueness: on ? 80 : null }))
                  }
                />
              </div>
              <ThresholdField
                label="Maximum retries"
                value={settingsDraft.maxRetries}
                onChange={(v) => setSettingsDraft((s) => ({ ...s, maxRetries: v }))}
                max={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSettings()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, value, mono }: { title: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#A1A1AA] mb-1">{title}</p>
      <p
        className={`text-[#F5F5F7] text-xs rounded bg-[#0B0B0F] p-2 max-h-40 overflow-y-auto whitespace-pre-wrap ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[#0B0B0F] p-2">
      <p className="text-[#71717A]">{label}</p>
      <p className="text-[#F5F5F7] font-medium">{value}</p>
    </div>
  );
}

function ThresholdField({
  label,
  value,
  onChange,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div>
      <Label className="text-xs text-[#A1A1AA]">{label}</Label>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="mt-1 bg-[#0B0B0F] border-white/10 h-8"
      />
    </div>
  );
}

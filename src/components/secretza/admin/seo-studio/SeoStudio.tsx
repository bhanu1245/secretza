"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Loader2,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  History,
  Undo2,
  FlaskConical,
  Search,
  Download,
  Eye,
  Sparkles,
  Filter,
  CheckSquare,
} from "lucide-react";
import { useSeoRegeneration } from "./useSeoRegeneration";
import { SeoStudioPageInspector } from "./SeoStudioPageInspector";
import { SeoStudioCompletionModal } from "./SeoStudioCompletionModal";
import { SeoStudioRiskBadge } from "./SeoStudioRiskBadge";
import type { BatchCompletionReport, StudioFilter, StudioItem } from "./types";

const MODES = [
  { value: "all", label: "All Pages", description: "Every SEO page matching the page type filter" },
  { value: "selected_cities", label: "Selected Cities", description: "Comma-separated city slugs only" },
  { value: "duplicate_risk", label: "Duplicate-Risk Pages", description: "Medium or high duplicate risk" },
  { value: "low_score", label: "Low-Score Pages", description: "SEO quality score below threshold" },
  { value: "below_words", label: "Below 500 Words", description: "Pages under minimum word count" },
] as const;

const BATCH_SIZES = [10, 25, 50, 100];

const FILTER_OPTIONS: { value: StudioFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High Risk" },
  { value: "medium", label: "Medium Risk" },
  { value: "low", label: "Low Risk" },
  { value: "duplicate", label: "Duplicate Risk" },
  { value: "low_score", label: "SEO Score < 70" },
  { value: "low_uniqueness", label: "Uniqueness < 50" },
  { value: "missing_faq", label: "Missing FAQ" },
  { value: "missing_meta", label: "Missing Meta" },
];

function formatElapsed(ms: number | null) {
  if (ms == null) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "dry_run_completed")
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
  if (s === "processing" || s === "queued")
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{status}</Badge>;
  if (s === "awaiting_confirmation")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Awaiting confirmation</Badge>;
  if (s === "failed" || s === "cancelled")
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function buildFilterParams(filter: StudioFilter, search: string, pageType: string) {
  const p = new URLSearchParams();
  if (filter === "high") p.set("risk", "high");
  else if (filter === "medium") p.set("risk", "medium");
  else if (filter === "low") p.set("risk", "low");
  else if (filter === "duplicate") p.set("duplicateOnly", "true");
  else if (filter === "low_score") p.set("seoScoreMax", "70");
  else if (filter === "low_uniqueness") p.set("uniquenessMax", "50");
  else if (filter === "missing_faq") p.set("missingFaq", "true");
  else if (filter === "missing_meta") p.set("missingMeta", "true");
  if (pageType !== "all") p.set("pageType", pageType);
  if (search.trim()) p.set("search", search.trim());
  return p;
}

type LogEntry = { id: string; slug: string; status: string; ts: number };

export default function SeoStudio() {
  const regen = useSeoRegeneration();
  const {
    mode, setMode, batchSize, setBatchSize, dryRun, setDryRun,
    pageTypeFilter, setPageTypeFilter, citySlugs, setCitySlugs,
    lowScoreThreshold, setLowScoreThreshold, loading, runs, activeRun,
    setActiveRun, report, dashboard, confirmOpen, setConfirmOpen,
    schemaOutdated, pollingStopped, connectionError, retryConnection,
    fetchRuns, fetchRunDetail, startRun, confirmRun, resumeRun, cancelRun, rollbackRun,
    dryRunSession, dryRunItems, setDryRunItems, commitDryRun, discardDryRun,
  } = regen;

  const [items, setItems] = useState<StudioItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsFetchOk, setItemsFetchOk] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsPollingStopped, setItemsPollingStopped] = useState(false);
  const itemsFailuresRef = useRef(0);
  const itemsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [filter, setFilter] = useState<StudioFilter>("all");
  const [tablePageType, setTablePageType] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspectorItem, setInspectorItem] = useState<StudioItem | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [processLog, setProcessLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const prevItemsRef = useRef<Map<string, string>>(new Map());
  const prevRunStatusRef = useRef<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [batchReport, setBatchReport] = useState<BatchCompletionReport | null>(null);
  const [inspectorRefreshKey, setInspectorRefreshKey] = useState(0);

  const runId = activeRun?.id;
  const isMemoryDryRun = Boolean(dryRunSession && activeRun?.dryRun);

  const loadReviewed = useCallback((id: string) => {
    try {
      const raw = localStorage.getItem(`seo-studio-reviewed-${id}`);
      if (raw) setReviewed(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, []);

  const saveReviewed = useCallback((id: string, set: Set<string>) => {
    localStorage.setItem(`seo-studio-reviewed-${id}`, JSON.stringify([...set]));
  }, []);

  useEffect(() => {
    if (isMemoryDryRun) {
      setItems(dryRunItems);
      setItemsTotal(dryRunItems.length);
      setItemsTotalPages(1);
      setItemsFetchOk(true);
      setItemsError(null);
      setItemsLoading(false);
    }
  }, [isMemoryDryRun, dryRunItems]);

  const fetchItems = useCallback(async (opts?: { silent?: boolean }) => {
    if (isMemoryDryRun) return;
    if (!runId) {
      setItems([]);
      setItemsFetchOk(false);
      setItemsError(null);
      return;
    }
    if (!opts?.silent) setItemsLoading(true);
    try {
      const p = buildFilterParams(filter, search, tablePageType);
      p.set("page", String(itemsPage));
      p.set("limit", "50");
      const res = await apiFetch(`/api/seo/regenerate/${runId}/items?${p.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        itemsFailuresRef.current += 1;
        const msg =
          data.code === "SCHEMA_OUTDATED"
            ? "Database schema outdated — run prisma db push"
            : (data.error ?? "Failed to load pages");
        setItemsError(msg);
        setItemsFetchOk(false);
        if (itemsFailuresRef.current >= 3) {
          setItemsPollingStopped(true);
          if (itemsPollRef.current) {
            clearInterval(itemsPollRef.current);
            itemsPollRef.current = null;
          }
        }
        if (itemsFailuresRef.current === 1) {
          toast.error("Unable to load regeneration data", {
            description: data.action ?? msg,
            duration: 8000,
          });
        }
        return;
      }

      itemsFailuresRef.current = 0;
      setItemsPollingStopped(false);
      setItemsError(null);
      setItemsFetchOk(true);

      const list: StudioItem[] = data.items ?? [];
      setItems(list);
      setItemsTotal(data.total ?? 0);
      setItemsTotalPages(data.totalPages ?? 1);

      if (data.code === "SCHEMA_OUTDATED" || data.schemaDegraded) {
        setItemsError(data.action ?? "Run: bunx prisma db push && bunx prisma generate");
      }

      const nextLog: LogEntry[] = [];
      const prev = prevItemsRef.current;
      for (const item of list) {
        const old = prev.get(item.id);
        if (old !== item.status) {
          nextLog.push({ id: item.id, slug: item.pageSlug, status: item.status, ts: Date.now() });
          if (old === "queued" && item.status === "processing") {
            toast.info(`Processing ${item.pageSlug}`);
          }
          if (
            old !== "completed" &&
            item.status === "completed" &&
            item.predictedUnique != null &&
            item.priorUnique != null &&
            item.predictedUnique > item.priorUnique
          ) {
            toast.success(
              `${item.pageSlug} uniqueness improved ${Math.round(item.priorUnique)}% → ${Math.round(item.predictedUnique)}%`,
            );
          }
          if (item.status === "completed" && item.saved) {
            toast.success(`Saved automatically — ${item.pageSlug}`, {
              description: item.processedAt
                ? new Date(item.processedAt).toLocaleString()
                : undefined,
            });
          }
          if (item.status === "skipped" && item.discarded) {
            toast.info(`Not saved — ${item.pageSlug}`, {
              description: item.error ?? "No improvement",
            });
          }
        }
        prev.set(item.id, item.status);
      }
      if (nextLog.length > 0) {
        setProcessLog((log) => [...nextLog, ...log].slice(0, 200));
        setInspectorRefreshKey((k) => k + 1);
      }
    } catch {
      itemsFailuresRef.current += 1;
      setItemsError("Unable to load pages");
      setItemsFetchOk(false);
      if (itemsFailuresRef.current >= 3) setItemsPollingStopped(true);
      if (itemsFailuresRef.current === 1) toast.error("Failed to load pages");
    } finally {
      setItemsLoading(false);
    }
  }, [runId, filter, search, tablePageType, itemsPage, isMemoryDryRun]);

  const retryItemsFetch = useCallback(async () => {
    itemsFailuresRef.current = 0;
    setItemsPollingStopped(false);
    setItemsError(null);
    await retryConnection();
    await fetchItems();
  }, [fetchItems, retryConnection]);

  useEffect(() => {
    if (runId) {
      loadReviewed(runId);
      prevItemsRef.current = new Map();
      setProcessLog([]);
      setItemsPage(1);
      itemsFailuresRef.current = 0;
      setItemsPollingStopped(false);
      setItemsError(null);
    }
  }, [runId, loadReviewed]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!inspectorItem) return;
    const fresh = items.find((i) => i.id === inspectorItem.id);
    if (fresh) setInspectorItem(fresh);
  }, [items, inspectorItem?.id]);

  useEffect(() => {
    if (itemsPollRef.current) clearInterval(itemsPollRef.current);
    if (!runId || itemsPollingStopped || pollingStopped) return;
    itemsPollRef.current = setInterval(() => {
      void fetchItems({ silent: true });
      if (activeRun) void fetchRunDetail(activeRun.id);
    }, 3000);
    return () => {
      if (itemsPollRef.current) clearInterval(itemsPollRef.current);
    };
  }, [runId, fetchItems, activeRun, fetchRunDetail, itemsPollingStopped, pollingStopped]);

  useEffect(() => {
    if (!activeRun) return;
    const prev = prevRunStatusRef.current;
    const cur = activeRun.status;
    if (
      prev &&
      ["queued", "processing"].includes(prev) &&
      (cur === "completed" || cur === "dry_run_completed")
    ) {
      const r = report as BatchCompletionReport | null;
      if (r) {
        setBatchReport(r);
        setCompletionOpen(true);
        toast.success("Batch completed successfully");
      }
    }
    prevRunStatusRef.current = cur;
  }, [activeRun?.status, report]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [processLog.length]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPage = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const handleCommitDryRun = async (mode: "all" | "selected" | "improved") => {
    if (!dryRunSession) return;
    const previewIds =
      mode === "selected"
        ? [...selected]
        : mode === "improved"
          ? items.filter((i) => i.status === "ready_to_commit").map((i) => i.id)
          : undefined;
    await commitDryRun({ mode, previewIds });
  };

  const bulkRegenerate = async () => {
    if (!runId || selected.size === 0) return;
    if (isMemoryDryRun) {
      const pages = items
        .filter((i) => selected.has(i.id))
        .map((i) => ({ pageType: i.pageType, pageSlug: i.pageSlug }));
      setItemsLoading(true);
      try {
        const res = await apiFetch("/api/seo/dry-run/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages, mode: "regenerate" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Dry run failed");
        type DryRunPreviewRow = {
          previewId: string;
          pageSlug: string;
          pageType: string;
          wouldSave: boolean;
          saveReason: string;
          before?: { uniqueness: number | null; seo: number | null };
          after?: { uniqueness: number; seo: number };
        };
        const newItems = (data.previews as DryRunPreviewRow[] ?? []).map((p) => ({
          id: p.previewId,
          previewId: p.previewId,
          seoPageId: null,
          pageSlug: p.pageSlug,
          pageType: p.pageType,
          status: p.wouldSave ? "ready_to_commit" : "dry_run",
          error: p.wouldSave ? null : p.saveReason,
          predictedWords: null,
          predictedUnique: p.after?.uniqueness,
          predictedScore: p.after?.seo,
          predictedRisk: null,
          versionId: null,
          priorUnique: p.before?.uniqueness,
          priorSeoScore: p.before?.seo,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          page: null,
        })) as StudioItem[];
        setDryRunItems((prev) => {
          const map = new Map(prev.map((i) => [i.pageSlug, i]));
          for (const ni of newItems) map.set(ni.pageSlug, ni);
          return [...map.values()];
        });
        setSelected(new Set());
        toast.success("Dry run preview updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Dry run failed");
      } finally {
        setItemsLoading(false);
      }
      return;
    }
    const ids = [...selected];
    setItems((prev) =>
      prev.map((i) => (ids.includes(i.id) ? { ...i, status: "queued", saved: false, discarded: false } : i)),
    );
    toast.success(`🚀 Regeneration started — ${ids.length} page(s) queued`);
    setItemsLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${runId}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate", itemIds: ids, dryRun, reuseRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk regenerate failed");
      setSelected(new Set());
      await fetchRuns();
      await fetchRunDetail(runId);
      void fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk regenerate failed");
      void fetchItems();
    } finally {
      setItemsLoading(false);
    }
  };

  const bulkRollback = async () => {
    if (!runId || selected.size === 0) return;
    if (!confirm(`Rollback ${selected.size} selected page(s)?`)) return;
    setItemsLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${runId}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback", itemIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rollback failed");
      toast.success(`Rolled back ${data.rolledBack} page(s)`);
      setSelected(new Set());
      void fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setItemsLoading(false);
    }
  };

  const exportSelected = async (format: "csv" | "json") => {
    if (!runId) return;
    const ids = selected.size > 0 ? [...selected].join(",") : "";
    const url = `/api/seo/regenerate/${runId}/export?format=${format}${ids ? `&itemIds=${ids}` : ""}`;
    if (format === "csv") {
      window.open(url, "_blank");
    } else {
      const res = await apiFetch(url);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `seo-export-${runId}.json`;
      a.click();
    }
    toast.success("Export started");
  };

  const markReviewed = () => {
    if (!runId) return;
    const next = new Set(reviewed);
    selected.forEach((id) => next.add(id));
    setReviewed(next);
    saveReviewed(runId, next);
    toast.success(`Marked ${selected.size} as reviewed`);
    setSelected(new Set());
  };

  const singleRegenerate = async (item: StudioItem) => {
    if (!runId) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "queued", saved: false, discarded: false } : i)),
    );
    toast.success(`🚀 Regeneration started — ${item.pageSlug} queued`);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${runId}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate", itemIds: [item.id], dryRun, reuseRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchRunDetail(runId);
      void fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
      void fetchItems();
    }
  };

  const rollbackVersion = async (versionId: string) => {
    setItemsLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/rollback/${versionId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Rolled back ${data.pageSlug}`);
      void fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setItemsLoading(false);
    }
  };

  const progress = activeRun;
  const summaryStats = useMemo(() => {
    if (!progress) return null;
    return [
      { label: "Total Pages", value: progress.totalPages, color: "text-[#F5F5F7]" },
      { label: "Completed", value: progress.completed, color: "text-emerald-400" },
      { label: "Queued", value: Math.max(0, progress.queued), color: "text-amber-400" },
      { label: "Processing", value: progress.processing, color: "text-blue-400" },
      { label: "Failed", value: progress.failed, color: "text-red-400" },
      { label: "Avg SEO", value: progress.avgSeoScore?.toFixed(0) ?? "—", color: "text-violet-400" },
      { label: "Avg Unique", value: progress.avgUniqueness != null ? `${progress.avgUniqueness.toFixed(0)}%` : "—", color: "text-emerald-400" },
      { label: "High Risk", value: progress.highRiskCount, color: "text-red-400" },
    ];
  }, [progress]);

  const logIcon = (status: string) => {
    if (status === "completed") return "✓";
    if (status === "processing") return "⏳";
    if (status === "failed") return "✗";
    return "○";
  };

  const itemStatusLabel = (item: StudioItem) => {
    const s = item.status;
    if (s === "processing") {
      return (
        <span className="inline-flex items-center gap-1 text-blue-400">
          <Loader2 className="size-3 animate-spin" /> Processing
        </span>
      );
    }
    if (s === "queued") {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400">
          <Clock className="size-3" /> Queued
        </span>
      );
    }
    if (s === "dry_run") {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400">
          <FlaskConical className="size-3" /> 🟡 Dry Run
        </span>
      );
    }
    if (s === "ready_to_commit") {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="size-3" /> 🟢 Ready to Commit
        </span>
      );
    }
    if (s === "saved") {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="size-3" /> ✅ Saved
        </span>
      );
    }
    if (s === "completed") {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="size-3" /> Completed
          {item.saved && <span className="text-[10px] text-emerald-500/80">saved</span>}
        </span>
      );
    }
    if (s === "skipped") {
      return <span className="text-amber-400">Skipped</span>;
    }
    if (s === "failed" || s === "cancelled") {
      return <span className="text-red-400">{s}</span>;
    }
    return <span>{s}</span>;
  };

  const progressPct = progress
    ? Math.round((progress.completed / Math.max(progress.totalPages, 1)) * 100)
    : 0;
  const isRunning = progress && ["queued", "processing"].includes(progress.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7] flex items-center gap-2">
            <Sparkles className="size-6 text-violet-400" />
            SEO Studio
          </h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Analysis, regeneration, version control, and bulk operations
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchRuns(true)} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {summaryStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {summaryStats.map((s) => (
            <Card key={s.label} className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-3">
                <p className="text-[10px] text-[#71717A] uppercase tracking-wide">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)] lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7] flex items-center gap-2 text-base">
              <Zap className="size-4 text-amber-400" /> Run Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={mode} onValueChange={(v) => setMode(v as import("./types").RegenerationMode)}>
              <SelectTrigger className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === "selected_cities" && (
              <Input value={citySlugs} onChange={(e) => setCitySlugs(e.target.value)} className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)] h-9 text-sm" placeholder="city slugs" />
            )}
            {mode === "low_score" && (
              <Input
                type="number"
                value={lowScoreThreshold}
                onChange={(e) => setLowScoreThreshold(Number(e.target.value))}
                className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)] h-9 text-sm"
                placeholder="Score threshold"
              />
            )}
            {mode !== "selected_cities" && (
              <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                <SelectTrigger className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)] h-9 text-sm">
                  <SelectValue placeholder="Page type" />
                </SelectTrigger>
                <SelectContent>
                  {["city", "category", "category_city", "state", "country", "longtail"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-1 flex-wrap">
              {BATCH_SIZES.map((s) => (
                <Button key={s} type="button" size="sm" variant={batchSize === s ? "default" : "outline"} className="h-7 text-xs" onClick={() => setBatchSize(s)}>{s}</Button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] p-2">
              <Label htmlFor="dry-run" className="text-xs flex items-center gap-1">
                <FlaskConical className="size-3 text-blue-400" /> Dry run
              </Label>
              <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
            </div>
            {!dryRun && (
              <p className="text-xs text-amber-300 flex gap-1">
                <AlertTriangle className="size-3 shrink-0 mt-0.5" /> Live runs require confirmation
              </p>
            )}
            <Button className="w-full" onClick={startRun} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : dryRun ? <FlaskConical className="size-4 mr-2" /> : <Play className="size-4 mr-2" />}
              {dryRun ? "Start Dry Run" : "Queue Live Regeneration"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7] flex items-center gap-2 text-base">
              <Clock className="size-4 text-blue-400" /> Progress &amp; Live Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!progress ? (
              <p className="text-sm text-[#71717A]">Start a run to see progress here.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#A1A1AA]">Status</span>
                    {statusBadge(progress.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      ["Total", progress.totalPages],
                      ["Done", progress.completed],
                      ["Left", Math.max(0, progress.remaining)],
                      ["Failed", progress.failed],
                      ["Elapsed", formatElapsed(progress.elapsedMs)],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="bg-[#0B0B0F] rounded p-2">
                        <p className="text-[#71717A]">{l}</p>
                        <p className="font-semibold text-[#F5F5F7]">{v}</p>
                      </div>
                    ))}
                  </div>
                  {dashboard && (
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-[rgba(255,255,255,0.06)] pt-3">
                      {[
                        ["Avg time/page", dashboard.avgGenerationTimeMs != null ? `${(dashboard.avgGenerationTimeMs / 1000).toFixed(1)}s` : "—"],
                        ["Uniq. Δ avg", dashboard.avgUniquenessImprovement != null ? `+${dashboard.avgUniquenessImprovement}%` : "—"],
                        ["Retries", dashboard.totalRetries],
                        ["Candidates", dashboard.totalCandidatesEvaluated],
                        ["Paras rewritten", dashboard.totalParagraphsRewritten],
                        ["Conflicts fixed", dashboard.totalConflictsFixed],
                        ["Auto-saved", dashboard.pagesAutoSaved],
                        ["Manual review", dashboard.pagesManualReview],
                        ["Est. tokens", dashboard.estimatedTokenCost.toLocaleString()],
                      ].map(([l, v]) => (
                        <div key={String(l)} className="bg-[#0B0B0F] rounded p-2">
                          <p className="text-[#71717A]">{l}</p>
                          <p className="font-semibold text-[#F5F5F7]">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {isMemoryDryRun && dryRunSession?.dashboard && (
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-[rgba(255,255,255,0.06)] pt-3">
                      {[
                        ["Meeting threshold", dryRunSession.dashboard.meetingThreshold],
                        ["Would save", dryRunSession.dashboard.wouldSaveCount],
                        ["Fail uniqueness", dryRunSession.dashboard.failingUniqueness],
                        ["Fail SEO", dryRunSession.dashboard.failingSeo],
                        ["Avg uniqueness", dryRunSession.dashboard.avgUniqueness != null ? `${dryRunSession.dashboard.avgUniqueness}%` : "—"],
                        ["Avg SEO", dryRunSession.dashboard.avgSeo ?? "—"],
                        ["Est. time/page", dryRunSession.dashboard.avgGenerationTimeMs != null ? `${(dryRunSession.dashboard.avgGenerationTimeMs / 1000).toFixed(1)}s` : "—"],
                      ].map(([l, v]) => (
                        <div key={String(l)} className="bg-[#0B0B0F] rounded p-2">
                          <p className="text-[#71717A]">{l}</p>
                          <p className="font-semibold text-[#F5F5F7]">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {isMemoryDryRun && (
                      <>
                        <Button size="sm" onClick={() => void handleCommitDryRun("all")} disabled={loading}>
                          <CheckCircle2 className="size-3 mr-1" /> Commit All
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleCommitDryRun("selected")} disabled={loading || selected.size === 0}>
                          Commit Selected ({selected.size})
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleCommitDryRun("improved")} disabled={loading}>
                          Commit Improved
                        </Button>
                        <Button size="sm" variant="destructive" onClick={discardDryRun} disabled={loading}>
                          Discard
                        </Button>
                      </>
                    )}
                    {progress.status === "awaiting_confirmation" && (
                      <Button size="sm" onClick={() => setConfirmOpen(true)}>
                        <CheckCircle2 className="size-3 mr-1" /> Confirm
                      </Button>
                    )}
                    {["queued", "processing"].includes(progress.status) && (
                      <>
                        <Button size="sm" variant="outline" onClick={resumeRun} disabled={loading}>Resume</Button>
                        <Button size="sm" variant="destructive" onClick={cancelRun} disabled={loading}>Cancel</Button>
                      </>
                    )}
                    {progress.status === "completed" && !progress.dryRun && (
                      <Button size="sm" variant="outline" onClick={rollbackRun} disabled={loading}>
                        <Undo2 className="size-3 mr-1" /> Rollback Run
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="h-40 rounded-lg bg-[#0B0B0F] p-2" ref={logRef}>
                  {processLog.length === 0 ? (
                    <p className="text-xs text-[#71717A]">Processing log will appear here…</p>
                  ) : (
                    processLog.map((e, i) => (
                      <p key={`${e.id}-${e.ts}-${i}`} className="text-xs text-[#A1A1AA] py-0.5 font-mono">
                        <span className={e.status === "completed" ? "text-emerald-400" : e.status === "processing" ? "text-blue-400" : "text-[#71717A]"}>
                          {logIcon(e.status)}
                        </span>{" "}
                        {e.slug} <span className="text-[#52525B]">{e.status}</span>
                      </p>
                    ))
                  )}
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(schemaOutdated || connectionError || itemsError) && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-200">
                  {schemaOutdated || itemsError?.includes("schema")
                    ? "Database update required"
                    : "Unable to load regeneration data"}
                </p>
                <p className="text-xs text-amber-200/80 mt-1">
                  {connectionError ?? itemsError ?? "API unavailable. Cached progress is preserved."}
                </p>
                {schemaOutdated && (
                  <p className="text-xs text-amber-200/70 mt-2 font-mono">
                    bunx prisma db push<br />
                    bunx prisma generate
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-amber-500/40 shrink-0" onClick={() => void retryItemsFetch()}>
              <RefreshCw className="size-3 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {runId && (
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-2">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <CardTitle className="text-[#F5F5F7] text-base flex items-center gap-2">
                <Filter className="size-4" />
                {itemsError && !itemsFetchOk
                  ? `Pages (${items.length > 0 ? itemsTotal.toLocaleString() : "—"})`
                  : `Pages (${itemsTotal.toLocaleString()})`}
              </CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-[#52525B]" />
                  <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setItemsPage(1); }}
                    placeholder="Search slug/title…"
                    className="pl-7 h-8 w-44 bg-[#0B0B0F] border-[rgba(255,255,255,0.08)] text-xs"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => { setFilter(v as StudioFilter); setItemsPage(1); }}>
                  <SelectTrigger className="h-8 w-36 bg-[#0B0B0F] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tablePageType} onValueChange={(v) => { setTablePageType(v); setItemsPage(1); }}>
                  <SelectTrigger className="h-8 w-28 bg-[#0B0B0F] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {["city", "state", "category", "category_city", "longtail"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {progress && (
              <div className="space-y-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0B0B0F] p-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#A1A1AA] font-medium">
                    {isRunning ? "Running…" : "Overall Progress"}
                  </span>
                  <span className="text-[#F5F5F7] font-semibold">{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#141419] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-[#71717A]">
                  {progress.completed} / {progress.totalPages} pages completed
                  {progress.estimatedRemainingMs != null && isRunning && (
                    <span className="ml-2 text-violet-400">
                      · ETA {formatElapsed(progress.estimatedRemainingMs)}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-3 text-[10px] text-[#A1A1AA]">
                  <span>Completed: <strong className="text-emerald-400">{progress.completed}</strong></span>
                  <span>Processing: <strong className="text-blue-400">{progress.processing}</strong></span>
                  <span>Queued: <strong className="text-amber-400">{progress.queued}</strong></span>
                  <span>Failed: <strong className="text-red-400">{progress.failed}</strong></span>
                  <span>Remaining: <strong className="text-[#F5F5F7]">{progress.remaining}</strong></span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={selectAllPage}>
                <CheckSquare className="size-3 mr-1" /> Select All
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={selected.size === 0} onClick={bulkRegenerate}>
                <RefreshCw className="size-3 mr-1" /> Regenerate ({selected.size})
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={selected.size === 0} onClick={bulkRollback}>
                <Undo2 className="size-3 mr-1" /> Rollback
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void exportSelected("csv")}>
                <Download className="size-3 mr-1" /> CSV
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void exportSelected("json")}>
                <Download className="size-3 mr-1" /> JSON
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={selected.size === 0} onClick={markReviewed}>
                Mark Reviewed
              </Button>
            </div>

            {itemsLoading && items.length === 0 && !itemsError ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-violet-400" />
              </div>
            ) : itemsFetchOk && items.length === 0 ? (
              <p className="text-sm text-[#71717A] py-8 text-center">No pages match the current filters.</p>
            ) : itemsError && items.length === 0 ? (
              <p className="text-sm text-amber-400/90 py-8 text-center">Unable to load pages.</p>
            ) : (
              <div className="relative">
                {itemsLoading && items.length > 0 && (
                  <div className="absolute inset-0 z-20 bg-[#141419]/60 flex items-center justify-center rounded-lg">
                    <Loader2 className="size-6 animate-spin text-violet-400" />
                  </div>
                )}
              <ScrollArea className="h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#141419] z-10">
                    <tr className="text-left text-[#71717A] border-b border-[rgba(255,255,255,0.08)]">
                      <th className="pb-2 w-8" />
                      <th className="pb-2 pr-2">Page</th>
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">SEO</th>
                      <th className="pb-2 pr-2">Unique</th>
                      <th className="pb-2 pr-2">Risk</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const score = item.predictedScore ?? item.page?.seoQualityScore;
                      const uniq = item.predictedUnique ?? item.page?.uniquenessScore;
                      const uniqDelta =
                        item.priorUnique != null && uniq != null && item.status === "completed"
                          ? uniq - item.priorUnique
                          : null;
                      const risk = item.predictedRisk ?? item.page?.duplicateRisk;
                      return (
                        <tr key={item.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                          <td className="py-2">
                            <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                          </td>
                          <td className="py-2 pr-2">
                            <p className="text-[#F5F5F7] font-mono text-xs">{item.pageSlug}</p>
                            <p className="text-[10px] text-[#52525B]">{item.pageType}</p>
                            {reviewed.has(item.id) && <Badge className="text-[10px] h-4 mt-0.5">Reviewed</Badge>}
                          </td>
                          <td className="py-2 pr-2 text-xs">{itemStatusLabel(item)}</td>
                          <td className="py-2 pr-2 text-xs text-violet-400">{score?.toFixed(0) ?? "—"}</td>
                          <td className="py-2 pr-2 text-xs">
                            {uniq != null ? `${uniq.toFixed(0)}%` : "—"}
                            {uniqDelta != null && uniqDelta > 0 && (
                              <span className="text-emerald-400 ml-1">+{uniqDelta.toFixed(0)}</span>
                            )}
                          </td>
                          <td className="py-2 pr-2"><SeoStudioRiskBadge risk={risk} compact /></td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                title="View Details"
                                onClick={() => { setInspectorItem(item); setInspectorOpen(true); }}
                              >
                                <Eye className="size-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void singleRegenerate(item)}>
                                <RefreshCw className="size-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-[#71717A]">
              <span>Page {itemsPage} of {itemsTotalPages} · {itemsTotal} total</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7" disabled={itemsPage <= 1} onClick={() => setItemsPage((p) => p - 1)}>Prev</Button>
                <Button size="sm" variant="outline" className="h-7" disabled={itemsPage >= itemsTotalPages} onClick={() => setItemsPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader><CardTitle className="text-sm text-[#F5F5F7]">Regeneration Report</CardTitle></CardHeader>
          <CardContent className="text-sm text-[#A1A1AA]">
            Updated: {(report as { pagesUpdated?: number }).pagesUpdated ?? "—"} ·
            Failures: {(report as { failures?: number }).failures ?? "—"}
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
        <CardHeader>
          <CardTitle className="text-[#F5F5F7] flex items-center gap-2 text-base">
            <History className="size-4" /> Run History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-[#71717A]">No runs yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => { setActiveRun(run); void fetchRunDetail(run.id); }}
                  className="w-full flex items-center justify-between rounded-lg bg-[#0B0B0F] p-3 text-left hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F7]">
                      {run.mode} · {run.dryRun ? "DRY" : "LIVE"} · {run.totalPages} pages
                    </p>
                    <p className="text-xs text-[#71717A]">{run.createdByEmail ?? "system"}</p>
                  </div>
                  {statusBadge(run.status)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SeoStudioPageInspector
        runId={runId ?? ""}
        item={inspectorItem}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        onRegenerate={singleRegenerate}
        onRollback={rollbackVersion}
        refreshKey={inspectorRefreshKey}
        onRefresh={() => void fetchItems()}
        isDryRun={isMemoryDryRun}
        previewId={inspectorItem?.previewId ?? inspectorItem?.id}
      />

      <SeoStudioCompletionModal
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        report={batchReport}
        runId={runId ?? ""}
        isDryRun={isMemoryDryRun}
        onCommitAll={isMemoryDryRun ? () => void handleCommitDryRun("all") : undefined}
        onDiscard={isMemoryDryRun ? discardDryRun : undefined}
        onViewChanged={() => {
          setFilter("all");
          setCompletionOpen(false);
          void fetchItems();
        }}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Confirm Live Regeneration</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Write regenerated content to <strong>{activeRun?.totalPages ?? 0}</strong> pages.
              Snapshots saved for rollback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmRun} disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              Yes, regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

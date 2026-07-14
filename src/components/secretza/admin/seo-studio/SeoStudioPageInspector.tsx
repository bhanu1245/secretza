"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Copy,
  RotateCcw,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { SeoStudioRiskBadge } from "./SeoStudioRiskBadge";
import type { StudioItem } from "./types";
import type { RiskDiagnostic } from "@/lib/seo-studio-analysis";

const OPTIMIZE_ACTION_IDS = new Set([
  "rewrite_intro",
  "reduce_repetition",
  "keyword_density",
]);

type ScoreDelta = { old: number | null; new: number | null; changed: boolean };
type TextDiff = { old: string; new: string; changed: boolean };

type InspectData = {
  inspector: Record<string, unknown> | null;
  analysis: {
    diagnostics: RiskDiagnostic[];
    suggestions: Array<{ id: string; label: string; description: string; estimatedGain: number; priority: string }>;
    scoreBreakdown: Array<{ key: string; label: string; score: number; max: number; status: string }>;
    estimatedImprovement: number;
  } | null;
  heatmap: Array<{ slug: string; pageType: string; similarityPct: number }>;
  paragraphHeatmap?: Array<{
    paragraphIndex: number;
    paragraphPreview: string;
    conflictSlug: string;
    conflictPageType: string;
    similarityPct: number;
  }>;
  engineInfo?: {
    activeEngine: string;
    uniquenessEngine?: string;
    localIntelligence?: boolean;
  };
  regenerationMeta?: {
    status: string;
    predictedUnique: number | null;
    predictedScore: number | null;
    priorUnique: number | null;
    priorSeoScore: number | null;
    processedAt: string | null;
    error: string | null;
  };
  comparison: {
    title?: TextDiff;
    meta?: TextDiff;
    h1?: TextDiff;
    content?: TextDiff;
    uniqueness?: ScoreDelta;
    seoScore?: ScoreDelta;
  } | null;
  versions: Array<{
    id: string;
    title: string | null;
    wordCount: number | null;
    seoQualityScore: number | null;
    uniquenessScore: number | null;
    priorUniqueness: number | null;
    priorSeoScore: number | null;
    newUniqueness: number | null;
    newSeoScore: number | null;
    optimizationAction: string | null;
    createdAt: string;
    rolledBackAt: string | null;
    createdByEmail: string | null;
  }>;
};

type ProgressStage = {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "skipped";
};

type OptimizeResponse = {
  success: boolean;
  action: string;
  rollbackVersionId: string | null;
  unchanged?: boolean;
  message?: string;
  comparison: InspectData["comparison"];
  error?: string;
};

function ChangedField({ label, oldVal, newVal, changed }: { label: string; oldVal: string; newVal: string; changed: boolean }) {
  return (
    <div className="rounded-lg bg-[#0B0B0F] p-3 space-y-2">
      <p className="text-xs font-medium text-[#A1A1AA]">{label}</p>
      {changed ? (
        <>
          <p className="text-xs text-red-400/80 line-through max-h-24 overflow-y-auto">{oldVal}</p>
          <p className="text-sm text-emerald-400 max-h-32 overflow-y-auto">{newVal}</p>
        </>
      ) : (
        <p className="text-sm text-[#F5F5F7]">{newVal}</p>
      )}
    </div>
  );
}

function formatScoreDelta(label: string, delta: ScoreDelta | undefined, suffix = "%") {
  if (!delta) return null;
  const oldVal = delta.old != null ? `${Math.round(delta.old)}${suffix}` : "—";
  const newVal = delta.new != null ? `${Math.round(delta.new)}${suffix}` : "—";
  const diff =
    delta.old != null && delta.new != null ? Math.round(delta.new - delta.old) : null;
  return (
    <div className="rounded-lg bg-[#0B0B0F] p-3 text-xs">
      <p className="text-[#A1A1AA] mb-1">{label}</p>
      {delta.changed ? (
        <>
          <p className="text-[#71717A]">Before: {oldVal}</p>
          <p className="text-emerald-400 font-medium">After: {newVal}</p>
          {diff != null && diff > 0 && (
            <p className="text-emerald-400 mt-1">▲ +{diff}{suffix}</p>
          )}
        </>
      ) : (
        <p className="text-[#F5F5F7]">{newVal}</p>
      )}
    </div>
  );
}

export function SeoStudioPageInspector({
  runId,
  item,
  open,
  onOpenChange,
  onRegenerate,
  onRollback,
  refreshKey = 0,
  onRefresh,
  isDryRun = false,
  previewId,
}: {
  runId: string;
  item: StudioItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRegenerate: (item: StudioItem) => void;
  onRollback: (versionId: string) => void;
  refreshKey?: number;
  onRefresh?: () => void;
  isDryRun?: boolean;
  previewId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InspectData | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [rollbackPreview, setRollbackPreview] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [undoVersionId, setUndoVersionId] = useState<string | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const [progressStages, setProgressStages] = useState<ProgressStage[] | null>(null);
  const [autoImproveLoading, setAutoImproveLoading] = useState(false);
  const [conflictLoading, setConflictLoading] = useState<string | null>(null);
  const [paragraphLoading, setParagraphLoading] = useState<number | null>(null);
  const [dryRunDiff, setDryRunDiff] = useState<{
    faqs: TextDiff;
    cta: TextDiff;
    paragraphs: Array<{ index: number; old: string; new: string; changed: boolean }>;
    metadata: Record<string, unknown>;
    generationTimeMs: number;
  } | null>(null);

  const loadInspect = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      if (isDryRun && previewId) {
        const res = await apiFetch(`/api/seo/dry-run/preview?previewId=${previewId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Preview not found");
        const full = json.full as {
          before: { uniqueness: number | null; seo: number | null; title: string | null; meta: string | null; h1: string | null; intro: string | null };
          after: { uniqueness: number; seo: number; title: string; meta: string; h1: string; intro: string };
          diff: {
            intro: TextDiff;
            h1: TextDiff;
            meta: TextDiff;
            faqs: TextDiff;
            cta: TextDiff;
            paragraphs: Array<{ index: number; old: string; new: string; changed: boolean }>;
          };
          metadata: Record<string, unknown>;
          wouldSave: boolean;
          saveReason: string;
          generationTimeMs: number;
        };
        setDryRunDiff({
          faqs: full.diff.faqs,
          cta: full.diff.cta,
          paragraphs: full.diff.paragraphs,
          metadata: full.metadata,
          generationTimeMs: full.generationTimeMs,
        });
        setData({
          inspector: {
            seoTitle: full.after.title,
            metaDescription: full.after.meta,
            h1: full.after.h1,
            uniqueness: full.after.uniqueness,
            seoScore: full.after.seo,
          },
          analysis: null,
          heatmap: [],
          engineInfo: {
            activeEngine: String(full.metadata.engineVersion ?? "v6.1"),
            localIntelligence: true,
          },
          regenerationMeta: {
            status: full.wouldSave ? "ready_to_commit" : "dry_run",
            predictedUnique: full.after.uniqueness,
            predictedScore: full.after.seo,
            priorUnique: full.before.uniqueness,
            priorSeoScore: full.before.seo,
            processedAt: null,
            error: full.wouldSave ? null : full.saveReason,
          },
          comparison: {
            title: {
              old: full.before.title ?? "—",
              new: full.after.title,
              changed: full.before.title !== full.after.title,
            },
            meta: full.diff.meta,
            h1: full.diff.h1,
            content: full.diff.intro,
            uniqueness: {
              old: full.before.uniqueness,
              new: full.after.uniqueness,
              changed: full.before.uniqueness !== full.after.uniqueness,
            },
            seoScore: {
              old: full.before.seo,
              new: full.after.seo,
              changed: full.before.seo !== full.after.seo,
            },
          },
          versions: [],
        });
        return;
      }
      setDryRunDiff(null);
      const res = await apiFetch(`/api/seo/regenerate/${runId}/items/${item.id}/inspect`);
      const json = (await res.json()) as InspectData;
      setData(json);
    } catch {
      toast.error("Failed to load page details");
    } finally {
      setLoading(false);
    }
  }, [item, runId, isDryRun, previewId]);

  const loadProgress = useCallback(async () => {
    if (
      !item ||
      (!["processing", "queued"].includes(item.status) && !autoImproveLoading)
    ) {
      if (!autoImproveLoading) setProgressStages(null);
      return;
    }
    try {
      const res = await apiFetch(`/api/seo/regenerate/${runId}/items/${item.id}/progress`);
      const json = (await res.json()) as { stages: ProgressStage[] | null };
      setProgressStages(json.stages);
    } catch {
      setProgressStages(null);
    }
  }, [item, runId, autoImproveLoading]);

  useEffect(() => {
    if (!open || !item) {
      setData(null);
      setUndoVersionId(null);
      setProgressStages(null);
      return;
    }
    void loadInspect();
    void loadProgress();
  }, [open, item?.id, item?.status, runId, loadInspect, loadProgress, refreshKey]);

  useEffect(() => {
    if (!open || !item) return;
    const active =
      item.status === "processing" || item.status === "queued" || autoImproveLoading;
    if (!active) return;
    const t = setInterval(() => void loadProgress(), 2500);
    return () => clearInterval(t);
  }, [open, item?.id, item?.status, autoImproveLoading, loadProgress]);

  const ins = data?.inspector as Record<string, unknown> | null;

  const copySeo = () => {
    if (!ins) return;
    const text = `Title: ${ins.seoTitle}\nMeta: ${ins.metaDescription}\nH1: ${ins.h1}\nCanonical: ${ins.canonicalUrl}`;
    void navigator.clipboard.writeText(text);
    toast.success("SEO fields copied");
  };

  const runOptimize = async (actionId: string) => {
    if (!item) return;
    setActionLoading(actionId);
    try {
      const res = await apiFetch(
        `/api/seo/regenerate/${runId}/items/${item.id}/optimize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionId }),
        },
      );
      const result = (await res.json()) as OptimizeResponse;
      if (!res.ok) throw new Error(result.error ?? "Optimization failed");

      if (result.unchanged) {
        toast.info(result.message ?? "No changes needed");
      } else {
        const uniq = result.comparison?.uniqueness;
        if (uniq?.changed && uniq.old != null && uniq.new != null) {
          toast.success(
            `Uniqueness improved from ${Math.round(uniq.old)}% → ${Math.round(uniq.new)}%`,
          );
        } else {
          const seo = result.comparison?.seoScore;
          if (seo?.changed && seo.old != null && seo.new != null) {
            toast.success(
              `SEO score improved from ${Math.round(seo.old)} → ${Math.round(seo.new)}`,
            );
          } else {
            toast.success("Optimization applied");
          }
        }
        if (result.rollbackVersionId) {
          setUndoVersionId(result.rollbackVersionId);
        }
      }

      await loadInspect();
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      setActionLoading(null);
    }
  };

  const runAutoImprove = async () => {
    if (!item) return;
    setAutoImproveLoading(true);
    try {
      const res = await apiFetch(
        `/api/seo/regenerate/${runId}/items/${item.id}/auto-improve`,
        { method: "POST" },
      );
      const result = (await res.json()) as {
        error?: string;
        startUnique: number;
        currentUnique: number;
        improved: boolean;
      };
      if (!res.ok) throw new Error(result.error ?? "Auto improve failed");
      if (result.improved) {
        toast.success(
          `Uniqueness improved ${Math.round(result.startUnique)}% → ${Math.round(result.currentUnique)}%`,
        );
      } else {
        toast.info("No further improvement possible");
      }
      await loadInspect();
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto improve failed");
    } finally {
      setAutoImproveLoading(false);
    }
  };

  const fixParagraph = async (paragraphIndex: number, conflictSlug?: string) => {
    if (!item) return;
    setParagraphLoading(paragraphIndex);
    try {
      const res = await apiFetch(
        `/api/seo/regenerate/${runId}/items/${item.id}/fix-paragraph`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paragraphIndex, conflictSlug }),
        },
      );
      const result = (await res.json()) as OptimizeResponse;
      if (!res.ok) throw new Error(result.error ?? "Fix paragraph failed");
      const uniq = result.comparison?.uniqueness;
      if (uniq?.changed && uniq.old != null && uniq.new != null) {
        toast.success(`Paragraph rewritten — uniqueness ${Math.round(uniq.old)}% → ${Math.round(uniq.new)}%`);
      } else {
        toast.success("Paragraph rewritten");
      }
      if (result.rollbackVersionId) setUndoVersionId(result.rollbackVersionId);
      await loadInspect();
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fix paragraph failed");
    } finally {
      setParagraphLoading(null);
    }
  };

  const fixConflict = async (conflictSlug: string) => {
    if (!item) return;
    setConflictLoading(conflictSlug);
    try {
      const res = await apiFetch(
        `/api/seo/regenerate/${runId}/items/${item.id}/fix-conflict`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conflictSlug }),
        },
      );
      const result = (await res.json()) as OptimizeResponse;
      if (!res.ok) throw new Error(result.error ?? "Fix failed");
      const uniq = result.comparison?.uniqueness;
      if (uniq?.changed && uniq.old != null && uniq.new != null) {
        toast.success(`Conflict fixed — uniqueness ${Math.round(uniq.old)}% → ${Math.round(uniq.new)}%`);
      } else {
        toast.success(`Rewrote overlapping paragraphs vs ${conflictSlug}`);
      }
      if (result.rollbackVersionId) setUndoVersionId(result.rollbackVersionId);
      await loadInspect();
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fix conflict failed");
    } finally {
      setConflictLoading(null);
    }
  };

  const handleUndo = async () => {
    if (!undoVersionId) return;
    setUndoLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/rollback/${undoVersionId}`, {
        method: "POST",
      });
      const body = (await res.json()) as { error?: string; pageSlug?: string };
      if (!res.ok) throw new Error(body.error ?? "Undo failed");
      toast.success(`Restored previous version${body.pageSlug ? ` for ${body.pageSlug}` : ""}`);
      setUndoVersionId(null);
      onRollback(undoVersionId);
      await loadInspect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setUndoLoading(false);
    }
  };

  const handleVersionRollback = async (versionId: string) => {
    setRollbackPreview(null);
    onRollback(versionId);
    setUndoVersionId(null);
    await loadInspect();
  };

  const cmp = data?.comparison;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#141419] border-[rgba(255,255,255,0.08)] w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#F5F5F7]">
            {item?.pageSlug ?? "Page Inspector"}
          </SheetTitle>
          <SheetDescription className="text-[#A1A1AA]">
            {item?.pageType} · {item?.status}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-violet-400" />
          </div>
        ) : ins ? (
          <div className="space-y-4 mt-4 pb-8">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copySeo}>
                <Copy className="size-3 mr-1" /> Copy SEO
              </Button>
              {item && (
                <Button size="sm" variant="outline" onClick={() => onRegenerate(item)}>
                  <RefreshCw className="size-3 mr-1" /> Regenerate
                </Button>
              )}
              {item && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={autoImproveLoading}
                  onClick={() => void runAutoImprove()}
                  className="border-violet-500/40 text-violet-300"
                >
                  {autoImproveLoading ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 mr-1" />
                  )}
                  Auto Improve
                </Button>
              )}
              {undoVersionId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleUndo()}
                  disabled={undoLoading}
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  {undoLoading ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3 mr-1" />
                  )}
                  Undo
                </Button>
              )}
            </div>

            {item?.saved && item.processedAt && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                <p className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Saved automatically
                </p>
                <p className="text-[#A1A1AA] mt-1">
                  {new Date(item.processedAt).toLocaleString()}
                </p>
              </div>
            )}

            {(data?.regenerationMeta || data?.engineInfo) && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs space-y-1">
                <p className="text-violet-300 font-semibold">Generation (V6)</p>
                {data.engineInfo && (
                  <p className="text-[#A1A1AA]">
                    Engine: <span className="text-[#F5F5F7]">{data.engineInfo.activeEngine}</span>
                    {data.engineInfo.localIntelligence && " · Local intelligence"}
                  </p>
                )}
                {data.regenerationMeta && (
                  <>
                    {data.regenerationMeta.priorUnique != null && data.regenerationMeta.predictedUnique != null && (
                      <p className="text-emerald-400">
                        Uniqueness: {Math.round(data.regenerationMeta.priorUnique)}% →{" "}
                        {Math.round(data.regenerationMeta.predictedUnique)}%
                        {data.regenerationMeta.predictedUnique > data.regenerationMeta.priorUnique && (
                          <span className="ml-1">
                            ▲ +{Math.round(data.regenerationMeta.predictedUnique - data.regenerationMeta.priorUnique)}%
                          </span>
                        )}
                      </p>
                    )}
                    {data.regenerationMeta.priorSeoScore != null && data.regenerationMeta.predictedScore != null && (
                      <p className="text-emerald-400/90">
                        SEO: {Math.round(data.regenerationMeta.priorSeoScore)} →{" "}
                        {Math.round(data.regenerationMeta.predictedScore)}
                      </p>
                    )}
                    <p className="text-[#71717A]">Status: {data.regenerationMeta.status}</p>
                    {data.regenerationMeta.error && data.regenerationMeta.error !== "saved" && (
                      <p className="text-amber-400">{data.regenerationMeta.error}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {progressStages && progressStages.length > 0 && (
              <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-xs font-semibold text-blue-300">Processing stages</p>
                {progressStages.map((stage) => (
                  <div key={stage.id} className="flex items-center gap-2 text-xs">
                    {stage.status === "running" && <Loader2 className="size-3 animate-spin text-blue-400" />}
                    {stage.status === "complete" && <span className="text-emerald-400">✓</span>}
                    {stage.status === "pending" && <span className="text-[#52525B]">○</span>}
                    {stage.status === "skipped" && <span className="text-[#71717A]">—</span>}
                    <span className={stage.status === "running" ? "text-blue-300" : "text-[#A1A1AA]"}>
                      {stage.label}
                      {stage.status === "running" && "…"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  ["SEO Score", ins.seoScore],
                  ["Uniqueness", ins.uniqueness != null ? `${ins.uniqueness}%` : "—"],
                  ["Word Count", ins.wordCount],
                  ["FAQ Count", ins.faqCount],
                  ["Internal Links", ins.internalLinks],
                  ["External Links", ins.externalLinks],
                  ["Images", ins.imageCount],
                ] as Array<[string, string | number | null | undefined]>
              ).map(([k, v]) => (
                <div key={k} className="rounded bg-[#0B0B0F] p-2">
                  <p className="text-[#71717A]">{k}</p>
                  <p className="text-[#F5F5F7] font-medium">{v != null ? String(v) : "—"}</p>
                </div>
              ))}
            </div>

            {data?.analysis && (
              <div className="space-y-2">
                <SeoStudioRiskBadge
                  risk={String(ins.duplicateRisk)}
                  diagnostics={data.analysis.diagnostics}
                />
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-violet-400"
                  onClick={() => setScoreOpen(!scoreOpen)}
                >
                  SEO Score: {String(ins.seoScore ?? "—")}
                  {scoreOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {scoreOpen && (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {data.analysis.scoreBreakdown.map((s) => (
                      <div key={s.key} className="flex justify-between bg-[#0B0B0F] rounded px-2 py-1">
                        <span className="text-[#A1A1AA]">{s.label}</span>
                        <span className={s.status === "good" ? "text-emerald-400" : s.status === "warn" ? "text-amber-400" : "text-red-400"}>
                          {s.score}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#A1A1AA]">Metadata</p>
              <div className="text-sm space-y-1 text-[#F5F5F7]">
                <p><span className="text-[#71717A]">Title:</span> {String(ins.seoTitle ?? "—")}</p>
                <p><span className="text-[#71717A]">Meta:</span> {String(ins.metaDescription ?? "—")}</p>
                <p><span className="text-[#71717A]">H1:</span> {String(ins.h1 ?? "—")}</p>
                <p><span className="text-[#71717A]">Canonical:</span> {String(ins.canonicalUrl ?? "—")}</p>
              </div>
            </div>

            {data?.analysis?.suggestions && data.analysis.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A1A1AA]">
                  AI Optimization (+{data.analysis.estimatedImprovement.toFixed(0)}% est.)
                </p>
                {data.analysis.suggestions.map((s) => {
                  const actionable = OPTIMIZE_ACTION_IDS.has(s.id);
                  const busy = actionLoading === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!actionable || actionLoading !== null}
                      onClick={() => actionable && void runOptimize(s.id)}
                      className={[
                        "w-full text-left rounded-lg border p-3 text-xs transition-colors",
                        actionable
                          ? "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-500/50 cursor-pointer"
                          : "border-[rgba(255,255,255,0.06)] bg-[#0B0B0F] cursor-default opacity-70",
                        busy ? "opacity-80" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {actionable && <Sparkles className="size-3 text-violet-400 shrink-0" />}
                          <p className="text-violet-300 font-medium">{s.label}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-violet-500/30 text-violet-300"
                          >
                            +{s.estimatedGain}%
                          </Badge>
                          {busy && <Loader2 className="size-3 animate-spin text-violet-400" />}
                        </div>
                      </div>
                      <p className="text-[#A1A1AA] mt-1">{s.description}</p>
                      {actionable && (
                        <p className="text-violet-400/80 mt-1.5 text-[10px]">
                          Click to apply — intro-only, rest of page preserved
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {cmp && (cmp.content?.changed || cmp.uniqueness?.changed || cmp.seoScore?.changed) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A1A1AA]">Before / After</p>
                <div className="grid grid-cols-2 gap-2">
                  {formatScoreDelta("Uniqueness", cmp.uniqueness)}
                  {formatScoreDelta("SEO Score", cmp.seoScore, "")}
                </div>
                {cmp.title && (
                  <ChangedField label="Title" oldVal={cmp.title.old} newVal={cmp.title.new} changed={cmp.title.changed} />
                )}
                {cmp.meta && (
                  <ChangedField label="Meta" oldVal={cmp.meta.old} newVal={cmp.meta.new} changed={cmp.meta.changed} />
                )}
                {cmp.h1 && (
                  <ChangedField label="H1" oldVal={cmp.h1.old} newVal={cmp.h1.new} changed={cmp.h1.changed} />
                )}
                {cmp.content?.changed && (
                  <ChangedField
                    label="Intro"
                    oldVal={cmp.content.old}
                    newVal={cmp.content.new}
                    changed={cmp.content.changed}
                  />
                )}
              </div>
            )}

            {dryRunDiff && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A1A1AA]">Preview Diff</p>
                <ChangedField label="FAQ" oldVal={dryRunDiff.faqs.old} newVal={dryRunDiff.faqs.new} changed={dryRunDiff.faqs.changed} />
                <ChangedField label="CTA" oldVal={dryRunDiff.cta.old} newVal={dryRunDiff.cta.new} changed={dryRunDiff.cta.changed} />
                {dryRunDiff.paragraphs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#71717A]">Changed paragraphs</p>
                    {dryRunDiff.paragraphs.map((p) => (
                      <ChangedField
                        key={p.index}
                        label={`Paragraph ${p.index + 1}`}
                        oldVal={p.old}
                        newVal={p.new}
                        changed={p.changed}
                      />
                    ))}
                  </div>
                )}
                <div className="rounded-lg bg-[#0B0B0F] p-3 text-xs space-y-1">
                  <p className="text-violet-300 font-semibold">Preview metadata</p>
                  <p className="text-[#A1A1AA]">Duration: {(dryRunDiff.generationTimeMs / 1000).toFixed(1)}s</p>
                  {typeof dryRunDiff.metadata.attemptsUsed === "number" && (
                    <p className="text-[#A1A1AA]">Attempts: {dryRunDiff.metadata.attemptsUsed}</p>
                  )}
                  {typeof dryRunDiff.metadata.candidatesEvaluated === "number" && (
                    <p className="text-[#A1A1AA]">Candidates: {dryRunDiff.metadata.candidatesEvaluated}</p>
                  )}
                </div>
              </div>
            )}

            {data?.paragraphHeatmap && data.paragraphHeatmap.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A1A1AA]">Paragraph Duplicates</p>
                {data.paragraphHeatmap.map((p, i) => (
                  <div key={`${p.paragraphIndex}-${p.conflictSlug}-${i}`} className="rounded bg-[#0B0B0F] p-2 text-xs space-y-1">
                    <p className="text-[#71717A] line-clamp-2">{p.paragraphPreview}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-amber-400">
                        vs {p.conflictSlug} · {p.similarityPct}%
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[10px] text-violet-400"
                        disabled={paragraphLoading !== null}
                        onClick={() => void fixParagraph(p.paragraphIndex, p.conflictSlug)}
                      >
                        {paragraphLoading === p.paragraphIndex ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Rewrite Only This Paragraph"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data?.heatmap && data.heatmap.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A1A1AA]">Page-Level Duplicate Heatmap</p>
                {data.heatmap.map((h) => (
                  <div key={h.slug} className="flex items-center gap-2 text-xs">
                    <span className="text-[#F5F5F7] w-24 truncate">{h.slug}</span>
                    <div className="flex-1 h-2 rounded bg-[#0B0B0F] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-red-500"
                        style={{ width: `${h.similarityPct}%` }}
                      />
                    </div>
                    <span className="text-amber-400 w-8 text-right">{h.similarityPct}%</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-[10px] text-violet-400"
                      disabled={conflictLoading !== null}
                      onClick={() => void fixConflict(h.slug)}
                    >
                      {conflictLoading === h.slug ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        "Fix Only This Conflict"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#A1A1AA]">Content</p>
              <ScrollArea className="h-48 rounded-lg bg-[#0B0B0F] p-3">
                <pre className="text-xs text-[#A1A1AA] whitespace-pre-wrap font-sans">
                  {String(ins.introContent ?? "No content")}
                </pre>
              </ScrollArea>
            </div>

            {data?.versions && data.versions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A1A1AA]">Version History</p>
                {data.versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded bg-[#0B0B0F] p-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="text-[#F5F5F7] truncate">{v.title ?? "—"}</p>
                      <p className="text-[#71717A]">
                        {new Date(v.createdAt).toLocaleString()} · {v.createdByEmail?.split(" · ")[0] ?? "system"}
                      </p>
                      {v.priorUniqueness != null && (
                        <p className="text-emerald-400/90 mt-0.5">
                          Unique {Math.round(v.priorUniqueness)}%
                          {v.newUniqueness != null && ` → ${Math.round(v.newUniqueness)}%`}
                          {v.priorSeoScore != null && ` · SEO ${Math.round(v.priorSeoScore)}`}
                          {v.newSeoScore != null && ` → ${Math.round(v.newSeoScore)}`}
                        </p>
                      )}
                      {v.optimizationAction && (
                        <p className="text-violet-400/80 text-[10px]">{v.optimizationAction}</p>
                      )}
                    </div>
                    {!v.rolledBackAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRollbackPreview(v.id)}
                      >
                        <Eye className="size-3 mr-1" /> Restore
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#71717A] py-8">No page data available.</p>
        )}

        {rollbackPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#141419] border border-[rgba(255,255,255,0.08)] rounded-lg p-4 max-w-sm w-full space-y-3">
              <p className="text-[#F5F5F7] font-medium">Confirm rollback?</p>
              <p className="text-xs text-[#A1A1AA]">This restores the saved version snapshot.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setRollbackPreview(null)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => void handleVersionRollback(rollbackPreview)}
                >
                  <RotateCcw className="size-3 mr-1" /> Rollback
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

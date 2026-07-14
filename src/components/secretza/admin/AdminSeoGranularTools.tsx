"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Layers, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildGeoCascadeUrl } from "@/lib/admin-geo-form";
import SeoReviewStudio from "@/components/secretza/admin/SeoReviewStudio";
import {
  DEFAULT_QUALITY_SETTINGS,
  type QualitySettings,
  type ReviewDashboard,
  type ReviewPageRow,
} from "@/types/seo-review";
import {
  clearCityPackPreviewSession,
  loadCityPackPreviewSession,
  saveCityPackPreviewSession,
} from "@/lib/seo-city-pack-preview-storage";
import {
  logReviewLoadingFinished,
  logReviewLoadingStarted,
  REVIEW_LOADING_WATCHDOG_MS,
  reviewStudioFetch,
  reviewStudioPostJson,
  ReviewStudioTimeoutError,
} from "@/lib/review-studio-client";

export type SeoGranularMode = "city_pack" | "single_city" | "category_city";

type GeoItem = { id: string; name: string; countryId?: string; stateId?: string };

type CategoryItem = { id: string; name: string; slug: string };

export interface GranularSeoPreview {
  cityId: string;
  cityName: string;
  stateName: string;
  countryName: string;
  categoryName?: string;
  toGenerate: number;
  toSkip: number;
  total: number;
  breakdown: {
    city: number;
    categoryCity: number;
    longtail: number;
  };
}

type AdminSeoGranularToolsProps = {
  mode: SeoGranularMode | null;
  onModeChange: (mode: SeoGranularMode | null) => void;
  onComplete?: () => void;
  disabled?: boolean;
};

const MODE_CONFIG: Record<
  SeoGranularMode,
  {
    title: string;
    description: string;
    previewPath: string;
    generatePath: string;
    confirmLabel: string;
  }
> = {
  city_pack: {
    title: "Generate City SEO Pack",
    description:
      "Generate the city page, all category+city pages, and all longtail+city pages for one city only.",
    previewPath: "/api/admin/seo/generate-city-pack",
    generatePath: "/api/admin/seo/generate-city-pack",
    confirmLabel: "Generate Complete SEO Pack",
  },
  single_city: {
    title: "Generate Single City",
    description: "Generate only the city-level SEO page for the selected location.",
    previewPath: "/api/admin/seo/generate-city",
    generatePath: "/api/admin/seo/generate-city",
    confirmLabel: "Generate City Page",
  },
  category_city: {
    title: "Generate Category + City",
    description: "Generate one category+city SEO page for the selected combination.",
    previewPath: "/api/admin/seo/generate-category-city",
    generatePath: "/api/admin/seo/generate-category-city",
    confirmLabel: "Generate Category + City Page",
  },
};

const fieldClass =
  "w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50";

type DryRunPreviewPage = ReviewPageRow;

type CityPackJobStatus = {
  jobId: string;
  status: string;
  dryRun: boolean;
  total: number;
  completed: number;
  created: number;
  skipped: number;
  failed: number;
  percentComplete: number;
  currentStage: string;
  currentPage: string | null;
  elapsedMs: number;
  errors: string[];
  previewReady?: boolean;
  result: {
    created: number;
    skipped: number;
    total: number;
    cityName: string;
    stateName?: string;
    countryName?: string;
  } | null;
  qualitySettings?: QualitySettings;
  dryRunPreview?: {
    ready: boolean;
    wouldSaveCount: number;
    avgUniqueness: number | null;
    avgSeo: number | null;
    avgReadability: number | null;
    failedPages: number;
    pageCount: number;
    dashboard?: ReviewDashboard;
    pages?: DryRunPreviewPage[];
  } | null;
};

const POLL_MS = 2000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "stalled", "cancelled"]);

function formatElapsed(ms: number) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

export default function AdminSeoGranularTools({
  mode,
  onModeChange,
  onComplete,
  disabled = false,
}: AdminSeoGranularToolsProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === "admin";

  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [preview, setPreview] = useState<GranularSeoPreview | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [jobStatus, setJobStatus] = useState<CityPackJobStatus | null>(null);
  const [showDryRunPreview, setShowDryRunPreview] = useState(false);
  const [previewPages, setPreviewPages] = useState<DryRunPreviewPage[]>([]);
  const [previewDashboard, setPreviewDashboard] = useState<ReviewDashboard | null>(null);
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>({
    ...DEFAULT_QUALITY_SETTINGS,
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [previewTimedOut, setPreviewTimedOut] = useState(false);
  const [committing, setCommitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const sessionRestoreRef = useRef(false);

  const isOpen = mode !== null;
  const config = mode ? MODE_CONFIG[mode] : null;
  const isBusy = generating || committing || disabled;

  const resetForm = useCallback(() => {
    setCountryId("");
    setStateId("");
    setCityId("");
    setCategoryId("");
    setPreview(null);
    setStates([]);
    setCities([]);
    setJobStatus(null);
    setShowDryRunPreview(false);
    setPreviewPages([]);
    setPreviewDashboard(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewUnavailable(false);
    setPreviewTimedOut(false);
    setCommitting(false);
    sessionRestoreRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(async (jobId: string, signal?: AbortSignal) => {
    const res = await reviewStudioFetch(
      `/api/admin/seo/generate-city-pack?jobId=${jobId}`,
      {},
      { label: "pollJob", externalSignal: signal },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load job status");
    const job = data.job as CityPackJobStatus;
    setJobStatus(job);
    return job;
  }, []);

  const loadPreview = useCallback(async (jobId: string) => {
    console.log("ReviewStudio: loadPreview() called", { jobId });
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUnavailable(false);
    setPreviewTimedOut(false);
    logReviewLoadingStarted("loadPreview");

    const MAX_PREVIEW_RETRIES = 8;
    const RETRY_DELAY_MS = 2000;

    try {
      for (let attempt = 0; attempt < MAX_PREVIEW_RETRIES; attempt++) {
        if (controller.signal.aborted) {
          console.log("ReviewStudio: loadPreview() aborted");
          return;
        }

        const res = await reviewStudioFetch(
          `/api/admin/seo/generate-city-pack?jobId=${jobId}&includePreview=true`,
          {},
          { label: `loadPreview attempt ${attempt + 1}`, externalSignal: controller.signal },
        );
        const data = await res.json();

        if (res.status === 202) {
          console.log("ReviewStudio: loadPreview() preview not ready (202)", { attempt });
          if (attempt < MAX_PREVIEW_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          throw new Error(data.error ?? "Preview not ready yet — try again shortly");
        }

        if (!res.ok) throw new Error(data.error ?? "Failed to load preview");

        const job = data.job as CityPackJobStatus;
        const pages = job.dryRunPreview?.pages ?? [];

        if (!pages.length) {
          const allSkipped =
            job.status === "completed" && (job.skipped ?? 0) >= (job.total ?? 0) && (job.total ?? 0) > 0;
          if (allSkipped) {
            setJobStatus(job);
            setPreviewPages([]);
            setPreviewDashboard(job.dryRunPreview?.dashboard ?? null);
            if (job.qualitySettings) setQualitySettings(job.qualitySettings);
            setShowDryRunPreview(true);
            setPreviewUnavailable(false);
            saveCityPackPreviewSession({
              jobId,
              cityId: cityId || "",
              cityName: job.result?.cityName ?? preview?.cityName ?? "City",
            });
            toast.info("Dry run complete — all pages already exist, nothing to preview");
            return;
          }

          setJobStatus(job);
          setPreviewPages([]);
          setShowDryRunPreview(true);
          setPreviewUnavailable(true);
          setPreviewError("No preview available");
          console.warn("ReviewStudio: loadPreview() empty preview", { jobId, jobStatus: job.status });
          return;
        }

        setJobStatus(job);
        setPreviewPages(pages);
        setPreviewDashboard(job.dryRunPreview?.dashboard ?? null);
        if (job.qualitySettings) setQualitySettings(job.qualitySettings);
        setShowDryRunPreview(true);
        setPreviewUnavailable(false);
        saveCityPackPreviewSession({
          jobId,
          cityId: cityId || "",
          cityName: job.result?.cityName ?? preview?.cityName ?? "City",
        });
        console.log("ReviewStudio: loadPreview() success", { jobId, pageCount: pages.length });
        toast.success(`Dry run preview ready — ${pages.length} page(s)`);
        return;
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      const msg =
        err instanceof ReviewStudioTimeoutError
          ? "Request timed out after 60 seconds. Please retry."
          : err instanceof Error
            ? err.message
            : "Failed to load preview";

      console.error("ReviewStudio: loadPreview() failed", err);
      setPreviewError(msg);
      setPreviewTimedOut(err instanceof ReviewStudioTimeoutError);
      setShowDryRunPreview(false);
      setPreviewUnavailable(false);
      toast.error(msg);
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }
      setPreviewLoading(false);
      logReviewLoadingFinished("loadPreview");
    }
  }, [cityId, preview?.cityName]);

  useEffect(() => {
    return () => {
      stopPolling();
      abortRef.current?.abort();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (!isOpen) {
      sessionRestoreRef.current = false;
      return;
    }
    if (
      mode !== "city_pack" ||
      showDryRunPreview ||
      generating ||
      previewLoading ||
      sessionRestoreRef.current
    ) {
      return;
    }
    const stored = loadCityPackPreviewSession();
    if (!stored?.jobId) return;
    sessionRestoreRef.current = true;
    console.log("ReviewStudio: restoring session preview", { jobId: stored.jobId });
    void loadPreview(stored.jobId);
  }, [isOpen, mode, showDryRunPreview, generating, previewLoading, loadPreview]);

  useEffect(() => {
    if (!previewLoading) return;
    const watchdog = setTimeout(() => {
      console.warn("ReviewStudio: loadPreview watchdog fired (>90s)");
      previewAbortRef.current?.abort();
      setPreviewLoading(false);
      setPreviewTimedOut(true);
      setPreviewError("Operation taking longer than expected. Please retry.");
    }, REVIEW_LOADING_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [previewLoading]);

  const loadCountries = useCallback(async () => {
    const res = await fetch("/api/admin/geo/countries?limit=100");
    const data = await res.json();
    if (res.ok) setCountries(data.items || []);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (res.ok) {
      const items = (data.categories ?? data.items ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
        isActive?: boolean;
        parentId?: string | null;
      }>;
      setCategories(
        items
          .filter((c) => c.isActive !== false && !c.parentId)
          .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      );
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }
    void loadCountries();
    if (mode === "category_city") void loadCategories();
  }, [isOpen, mode, loadCountries, loadCategories, resetForm]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId("");
      setCityId("");
      setCategoryId("");
      setPreview(null);
      return;
    }
    const url = buildGeoCascadeUrl("states", { countryId });
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setStates(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [countryId]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      setCityId("");
      setCategoryId("");
      setPreview(null);
      return;
    }
    const url = buildGeoCascadeUrl("cities", { stateId });
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setCities(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [stateId]);

  useEffect(() => {
    if (!cityId || !config) {
      setPreview(null);
      return;
    }
    if (mode === "category_city" && !categoryId) {
      setPreview(null);
      return;
    }

    const params = new URLSearchParams({ cityId });
    if (mode === "category_city" && categoryId) {
      params.set("categoryId", categoryId);
    }

    setLoadingPreview(true);
    fetch(`${config.previewPath}?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load preview");
        setPreview(data.preview ?? null);
      })
      .catch((err) => {
        setPreview(null);
        toast.error(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => setLoadingPreview(false));
  }, [cityId, categoryId, mode, config]);

  const handleCloseModal = useCallback(() => {
    console.log("ReviewStudio: modal close — resetting loading state");
    stopPolling();
    abortRef.current?.abort();
    previewAbortRef.current?.abort();
    setPreviewLoading(false);
    setGenerating(false);
    setCommitting(false);
    onModeChange(null);
  }, [onModeChange, stopPolling]);

  const handleDiscardPreview = useCallback(async () => {
    if (!jobStatus?.jobId) {
      handleCloseModal();
      return;
    }
    console.log("ReviewStudio: discard() started", { jobId: jobStatus.jobId });
    setCommitting(true);
    try {
      await reviewStudioPostJson({ action: "discard", jobId: jobStatus.jobId }, "discard");
      console.log("ReviewStudio: discard() completed", { jobId: jobStatus.jobId });
      clearCityPackPreviewSession();
      toast.info("Preview discarded — no changes saved");
      handleCloseModal();
    } catch (err) {
      console.error("ReviewStudio: discard() failed", err);
      toast.error(err instanceof Error ? err.message : "Discard failed");
    } finally {
      setCommitting(false);
    }
  }, [handleCloseModal, jobStatus?.jobId]);

  const handleCommitPreview = useCallback(
    async (
      commitMode: "production_only" | "selected" | "all_anyway" = "production_only",
      slugs?: string[],
    ) => {
      if (!jobStatus?.jobId) return;
      console.log("ReviewStudio: commit() started", {
        jobId: jobStatus.jobId,
        mode: commitMode,
        slugCount: slugs?.length ?? 0,
      });
      setCommitting(true);
      try {
        const data = await reviewStudioPostJson<{
          committed: number;
          rejected?: number;
        }>(
          {
            action: "commit",
            jobId: jobStatus.jobId,
            mode: commitMode,
            pageSlugs: slugs,
          },
          "commit",
        );
        console.log("ReviewStudio: commit() completed", {
          jobId: jobStatus.jobId,
          committed: data.committed,
          mode: commitMode,
        });
        clearCityPackPreviewSession();
        const rejected = data.rejected ?? 0;
        toast.success(
          `Committed ${data.committed} page(s)${rejected > 0 ? ` (${rejected} below quality threshold skipped)` : ""}`,
        );
        onComplete?.();
        handleCloseModal();
      } catch (err) {
        console.error("ReviewStudio: commit() failed", err);
        toast.error(err instanceof Error ? err.message : "Commit failed");
      } finally {
        setCommitting(false);
      }
    },
    [handleCloseModal, jobStatus?.jobId, onComplete],
  );

  const handleJobFinished = useCallback(
    (job: CityPackJobStatus) => {
      const cityLabel = job.result?.cityName || preview?.cityName || "city";
      if (job.status === "completed") {
        if (job.dryRun) {
          setGenerating(false);
          console.log("ReviewStudio: job completed — loading preview", { jobId: job.jobId });
          void loadPreview(job.jobId);
          return;
        }
        if ((job.result?.created ?? job.created) > 0) {
          toast.success(
            `Generated ${job.result?.created ?? job.created} SEO page(s) for ${cityLabel}${
              (job.result?.skipped ?? job.skipped) > 0
                ? ` (${job.result?.skipped ?? job.skipped} already existed)`
                : ""
            }`,
          );
        } else if ((job.result?.skipped ?? job.skipped) > 0) {
          toast.info(`All pages already exist for ${cityLabel}. Nothing to generate.`);
        } else {
          toast.success("Generation complete");
        }
        onModeChange(null);
        onComplete?.();
      } else if (job.status === "stalled") {
        setGenerating(false);
        toast.error("Generation stalled — no progress for 60s. Click Retry to start again.");
      } else if (job.status === "failed") {
        setGenerating(false);
        toast.error(job.errors[job.errors.length - 1] ?? "Generation failed");
      }
    },
    [loadPreview, onComplete, onModeChange, preview?.cityName],
  );

  const startJobPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      const controller = new AbortController();
      abortRef.current = controller;

      const tick = async () => {
        try {
          const job = await pollJob(jobId, controller.signal);
          if (TERMINAL_STATUSES.has(job.status)) {
            stopPolling();
            setGenerating(false);
            handleJobFinished(job);
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          stopPolling();
          setGenerating(false);
          toast.error(err instanceof Error ? err.message : "Lost connection to job");
        }
      };

      void tick();
      pollRef.current = setInterval(() => void tick(), POLL_MS);
    },
    [handleJobFinished, pollJob, stopPolling],
  );

  const handleGenerate = async () => {
    if (!config || !cityId) return;
    if (mode === "category_city" && !categoryId) return;

    setGenerating(true);
    setJobStatus(null);
    stopPolling();
    abortRef.current?.abort();

    try {
      const body: Record<string, string | boolean> = { cityId };
      if (mode === "category_city") body.categoryId = categoryId;
      if (mode === "city_pack") body.dryRun = dryRun;

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(config.generatePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      if (mode === "city_pack" && data.jobId) {
        setJobStatus({
          jobId: data.jobId,
          status: data.status ?? "queued",
          dryRun: data.dryRun === true,
          total: data.total ?? preview?.total ?? 0,
          completed: 0,
          created: 0,
          skipped: 0,
          failed: 0,
          percentComplete: 0,
          currentStage: "queued",
          currentPage: null,
          elapsedMs: 0,
          errors: [],
          result: null,
        });
        toast.info(data.dryRun ? "Dry run started…" : "Generation started…");
        startJobPolling(data.jobId);
        return;
      }

      const cityLabel = data.cityName || preview?.cityName || "city";
      if (data.created > 0) {
        toast.success(
          `Generated ${data.created} SEO page(s) for ${cityLabel}${
            data.skipped > 0 ? ` (${data.skipped} already existed)` : ""
          }`,
        );
      } else if (data.skipped > 0) {
        toast.info(`All ${data.skipped} page(s) already exist for ${cityLabel}. Nothing to generate.`);
      } else {
        toast.success(data.message || "Generation complete");
      }

      onModeChange(null);
      onComplete?.();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      if (mode !== "city_pack") {
        setGenerating(false);
      }
    }
  };

  if (!isAdmin) return null;

  const canConfirm =
    !!cityId &&
    !!preview &&
    !loadingPreview &&
    !generating &&
    !showDryRunPreview &&
    (mode !== "category_city" || !!categoryId);

  const showConfigForm = !showDryRunPreview && !previewLoading;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !generating) handleCloseModal();
      }}
    >
      <DialogContent
        className={`bg-[#15151D] border-[rgba(255,255,255,0.08)] ${
          showDryRunPreview ? "max-w-5xl max-h-[90vh] overflow-y-auto" : "max-w-md"
        }`}
      >
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7] flex items-center gap-2">
            {mode === "city_pack" ? (
              <Layers className="size-4 text-[#7C3AED]" />
            ) : (
              <MapPin className="size-4 text-[#7C3AED]" />
            )}
            {showDryRunPreview ? "SEO Review Studio — Dry Run Preview" : config?.title}
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            {showDryRunPreview
              ? "No changes have been written. Review results, then commit or discard."
              : config?.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {previewLoading && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-[#A1A1AA]">
              <Loader2 className="size-6 animate-spin text-violet-400" />
              Loading preview results…
              {previewTimedOut && (
                <p className="text-xs text-amber-400">Taking longer than expected…</p>
              )}
            </div>
          )}

          {previewError && !previewLoading && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
              <p className="text-sm text-red-300 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                {previewError}
              </p>
              {jobStatus?.jobId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs w-full"
                  onClick={() => {
                    sessionRestoreRef.current = false;
                    setPreviewTimedOut(false);
                    void loadPreview(jobStatus.jobId);
                  }}
                >
                  Retry Load Preview
                </Button>
              )}
            </div>
          )}

          {showDryRunPreview && previewUnavailable && !previewLoading && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-center">
              <p className="text-sm text-amber-300 flex items-center justify-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                No preview available
              </p>
              <p className="text-xs text-[#A1A1AA]">
                The dry run completed but no preview data was returned. The job may have expired.
              </p>
              {jobStatus?.jobId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => void loadPreview(jobStatus.jobId)}
                >
                  Retry
                </Button>
              )}
            </div>
          )}

          {showDryRunPreview && previewPages.length === 0 && !previewUnavailable && !previewLoading && (
            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0E0E17] p-4 text-sm text-[#A1A1AA] text-center">
              All pages for this city already exist. Nothing new was generated in this dry run.
            </div>
          )}

          {showDryRunPreview && previewPages.length > 0 && jobStatus?.jobId && (
            <SeoReviewStudio
              jobId={jobStatus.jobId}
              pages={previewPages}
              dashboard={previewDashboard}
              qualitySettings={qualitySettings}
              onPagesChange={(pages, dashboard) => {
                setPreviewPages(pages);
                if (dashboard) setPreviewDashboard(dashboard);
              }}
              onQualitySettingsChange={setQualitySettings}
              onCommit={handleCommitPreview}
              onDiscard={handleDiscardPreview}
              onClose={() => setShowDryRunPreview(false)}
              committing={committing}
            />
          )}

          {showConfigForm && (
          <>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Country</label>
            <select
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              className={fieldClass}
              disabled={isBusy || loadingGeo}
            >
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">State</label>
            <select
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              className={fieldClass}
              disabled={!countryId || isBusy || loadingGeo}
            >
              <option value="">Select state</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">City</label>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className={fieldClass}
              disabled={!stateId || isBusy || loadingGeo}
            >
              <option value="">Select city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {mode === "category_city" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={fieldClass}
                disabled={!cityId || isBusy}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingPreview && cityId && (mode !== "category_city" || categoryId) && (
            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
              <Loader2 className="size-3 animate-spin" />
              Loading preview...
            </div>
          )}

          {mode === "city_pack" && (
            <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] p-2">
              <Label htmlFor="city-pack-dry-run" className="text-xs text-[#A1A1AA]">
                Dry run (preview only, no DB writes)
              </Label>
              <Switch
                id="city-pack-dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isBusy}
              />
            </div>
          )}

          {jobStatus && generating && !showDryRunPreview && !previewLoading && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-violet-300 font-medium capitalize">
                  {jobStatus.status === "stalled" ? (
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="size-3" /> Stalled
                    </span>
                  ) : (
                    <>
                      {jobStatus.dryRun ? "Dry run" : "Generating"} — {jobStatus.currentStage.replace(/_/g, " ")}
                    </>
                  )}
                </span>
                <span className="text-[#A1A1AA]">{jobStatus.percentComplete}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#0B0B0F] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${jobStatus.percentComplete}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-[#A1A1AA]">
                <span>{jobStatus.completed}/{jobStatus.total} pages</span>
                <span className="text-emerald-400">{jobStatus.created} created</span>
                <span>{jobStatus.skipped} skipped</span>
                {jobStatus.failed > 0 && <span className="text-red-400">{jobStatus.failed} failed</span>}
                <span>{formatElapsed(jobStatus.elapsedMs)}</span>
              </div>
              {jobStatus.currentPage && (
                <p className="text-[10px] text-[#6B6B7A] font-mono truncate">{jobStatus.currentPage}</p>
              )}
              {jobStatus.status === "stalled" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs w-full"
                  onClick={() => void handleGenerate()}
                >
                  Retry
                </Button>
              )}
            </div>
          )}

          {preview && !loadingPreview && showConfigForm && (
            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0E0E17] p-3 space-y-1.5">
              <p className="text-sm text-[#F5F5F7]">
                <span className="text-[#A1A1AA]">City:</span> {preview.cityName}
              </p>
              {preview.categoryName && (
                <p className="text-sm text-[#F5F5F7]">
                  <span className="text-[#A1A1AA]">Category:</span> {preview.categoryName}
                </p>
              )}
              <p className="text-sm font-medium text-emerald-400">
                Pages to generate: {preview.toGenerate}
              </p>
              {preview.toSkip > 0 && (
                <p className="text-xs text-[#A1A1AA]">
                  {preview.toSkip} existing page{preview.toSkip !== 1 ? "s" : ""} will be skipped
                </p>
              )}
              {mode === "city_pack" && preview.toGenerate > 0 && (
                <p className="text-[10px] text-[#6B6B7A]">
                  Includes {preview.breakdown.city} city, {preview.breakdown.categoryCity} category+city,{" "}
                  {preview.breakdown.longtail} longtail pages
                </p>
              )}
            </div>
          )}
          </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {showDryRunPreview && previewPages.length > 0 ? null : showDryRunPreview ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={committing}
                className="border-white/10 bg-transparent text-[#A1A1AA]"
              >
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={generating || committing}
                className="border-white/10 bg-transparent text-[#A1A1AA]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canConfirm || isBusy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {jobStatus?.dryRun
                      ? `Dry run… ${jobStatus.percentComplete}%`
                      : jobStatus
                        ? `Generating… ${jobStatus.percentComplete}%`
                        : "Generating…"}
                  </>
                ) : (
                  mode === "city_pack" && dryRun
                    ? "Preview SEO Pack (Dry Run)"
                    : config?.confirmLabel
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Standalone trigger buttons for the granular generation card. */
export function SeoGranularTriggerButtons({
  onOpen,
  disabled,
}: {
  onOpen: (mode: SeoGranularMode) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={() => onOpen("city_pack")}
      disabled={disabled}
      className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
    >
      <Layers className="size-3 mr-1" />
      Generate City SEO Pack
    </Button>
  );
}

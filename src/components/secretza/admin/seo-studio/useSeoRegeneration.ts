"use client";



import { useState, useEffect, useCallback, useRef } from "react";

import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";

import type { DryRunBatchDashboard, RunProgress, RegenerationMode, StudioItem } from "./types";

import type { RunDashboardStats } from "@/lib/seo-generation-metadata";



const MAX_POLL_FAILURES = 3;

const POLL_MS = 3000;



type ApiErrorBody = {

  code?: string;

  error?: string;

  action?: string;

};



function isSchemaOutdatedBody(data: ApiErrorBody | null): boolean {

  return data?.code === "SCHEMA_OUTDATED";

}



export function useSeoRegeneration() {

  const [mode, setMode] = useState<RegenerationMode>("all");

  const [batchSize, setBatchSize] = useState(25);

  const [dryRun, setDryRun] = useState(true);

  const [pageTypeFilter, setPageTypeFilter] = useState("city");

  const [citySlugs, setCitySlugs] = useState("agra,ahmedabad,mumbai");

  const [lowScoreThreshold, setLowScoreThreshold] = useState(70);

  const [loading, setLoading] = useState(false);

  const [runs, setRuns] = useState<RunProgress[]>([]);

  const [activeRun, setActiveRun] = useState<RunProgress | null>(null);

  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  const [dashboard, setDashboard] = useState<RunDashboardStats | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [schemaOutdated, setSchemaOutdated] = useState(false);

  const [pollingStopped, setPollingStopped] = useState(false);

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [dryRunSession, setDryRunSession] = useState<{
    sessionId: string;
    dashboard: DryRunBatchDashboard;
  } | null>(null);
  const [dryRunItems, setDryRunItems] = useState<StudioItem[]>([]);



  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processTickRef = useRef(false);

  const pollFailuresRef = useRef(0);

  const schemaToastShownRef = useRef(false);



  const handleFetchFailure = useCallback((data?: ApiErrorBody | null, fallbackMsg?: string) => {

    pollFailuresRef.current += 1;

    if (isSchemaOutdatedBody(data ?? null)) {

      setSchemaOutdated(true);

      setConnectionError(data?.action ?? "Run: bunx prisma db push && bunx prisma generate");

      if (!schemaToastShownRef.current) {

        schemaToastShownRef.current = true;

        toast.error("Database schema outdated", {

          description: "Run prisma db push, then Retry",

          duration: 10000,

        });

      }

    } else if (fallbackMsg) {

      setConnectionError(fallbackMsg);

    }

    if (pollFailuresRef.current >= MAX_POLL_FAILURES) {

      setPollingStopped(true);

      if (pollRef.current) {

        clearInterval(pollRef.current);

        pollRef.current = null;

      }

    }

  }, []);



  const resetConnectionState = useCallback(() => {

    pollFailuresRef.current = 0;

    setPollingStopped(false);

    setSchemaOutdated(false);

    setConnectionError(null);

    schemaToastShownRef.current = false;

  }, []);



  const fetchRuns = useCallback(async (restoreActive = true) => {

    try {

      const res = await apiFetch("/api/seo/regenerate?limit=20");

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {

        handleFetchFailure(data as ApiErrorBody, "Failed to load regeneration runs");

        return;

      }

      const list: RunProgress[] = data.runs ?? [];

      setRuns(list);

      pollFailuresRef.current = 0;

      if (restoreActive) {

        setActiveRun((current) => {

          if (current) return current;

          return (

            list.find((r) =>

              ["queued", "processing", "awaiting_confirmation"].includes(r.status),

            ) ?? null

          );

        });

      }

    } catch {

      handleFetchFailure(null, "Failed to load regeneration runs");

    }

  }, [handleFetchFailure]);



  const fetchRunDetail = useCallback(async (runId: string) => {

    try {

      const res = await apiFetch(`/api/seo/regenerate/${runId}`);

      const data = await res.json().catch(() => ({}));



      if (!res.ok && res.status === 503 && isSchemaOutdatedBody(data as ApiErrorBody)) {

        handleFetchFailure(data as ApiErrorBody);

        return null;

      }

      if (!res.ok) {

        handleFetchFailure(data as ApiErrorBody, "Failed to load run details");

        return null;

      }



      pollFailuresRef.current = 0;

      if (data.code === "SCHEMA_OUTDATED" || data.schemaDegraded) {

        setSchemaOutdated(true);

        setConnectionError((data as ApiErrorBody).action ?? "Run prisma db push");

      } else {

        setSchemaOutdated(false);

        setConnectionError(null);

      }



      if (data.run) setActiveRun(data.run);

      setReport(data.report);

      setDashboard(data.dashboard ?? null);

      return data.run as RunProgress;

    } catch {

      handleFetchFailure(null, "Failed to load run details");

      return null;

    }

  }, [handleFetchFailure]);



  const retryConnection = useCallback(async () => {

    resetConnectionState();

    await fetchRuns(false);

    if (activeRun?.id) await fetchRunDetail(activeRun.id);

  }, [resetConnectionState, fetchRuns, fetchRunDetail, activeRun?.id]);



  useEffect(() => {

    void fetchRuns(true);

  }, [fetchRuns]);



  useEffect(() => {

    if (pollRef.current) clearInterval(pollRef.current);

    if (!activeRun || pollingStopped) return;

    const active = ["queued", "processing", "awaiting_confirmation"].includes(activeRun.status);

    if (!active) return;

    pollRef.current = setInterval(() => void fetchRunDetail(activeRun.id), POLL_MS);

    return () => {

      if (pollRef.current) clearInterval(pollRef.current);

    };

  }, [activeRun?.id, activeRun?.status, fetchRunDetail, pollingStopped]);



  useEffect(() => {

    if (!activeRun || pollingStopped) return;

    if (!["queued", "processing"].includes(activeRun.status)) return;



    const processTick = async () => {

      if (processTickRef.current) return;

      processTickRef.current = true;

      try {

        const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/process`, {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ untilDone: false }),

        });

        if (res.ok) {

          const data = await res.json();

          if (data.run) setActiveRun(data.run);

          pollFailuresRef.current = 0;

        } else {

          const data = await res.json().catch(() => ({}));

          if (isSchemaOutdatedBody(data as ApiErrorBody)) {

            handleFetchFailure(data as ApiErrorBody);

          }

        }

      } finally {

        processTickRef.current = false;

      }

    };



    void processTick();

    const worker = setInterval(() => void processTick(), 4000);

    return () => clearInterval(worker);

  }, [activeRun?.id, activeRun?.status, pollingStopped, handleFetchFailure]);



  const buildPayload = () => ({

    mode,

    dryRun,

    confirmed: false,

    batchSize,

    pageTypeFilter: mode === "selected_cities" ? "city" : pageTypeFilter,

    citySlugs:

      mode === "selected_cities"

        ? citySlugs.split(",").map((s) => s.trim()).filter(Boolean)

        : undefined,

    lowScoreThreshold: mode === "low_score" ? lowScoreThreshold : undefined,

    duplicateRisks: mode === "duplicate_risk" ? ["medium", "high"] : undefined,

  });



  const startRun = async () => {

    setLoading(true);

    try {

      const endpoint = dryRun ? "/api/seo/regenerate/dry-run" : "/api/seo/regenerate";

      const res = await apiFetch(endpoint, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(buildPayload()),

      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed to start run");

      resetConnectionState();

      if (dryRun && data.sessionId) {

        setDryRunSession({

          sessionId: data.sessionId,

          dashboard: data.dashboard,

        });

        setDryRunItems((data.items as StudioItem[]) ?? []);

        setActiveRun(data.run);

        setReport(data.report);

        toast.success("Dry run completed — review previews before committing");

      } else if (data.requiresConfirmation) {

        setDryRunSession(null);

        setActiveRun(data.run);

        setConfirmOpen(true);

        toast.info("Run queued — confirm before writes are applied");

      } else {

        setDryRunSession(null);

        setActiveRun(data.run);

        setReport(data.report);

        if (["queued", "processing"].includes(data.run?.status ?? "")) {

          toast.success("🚀 Regeneration started");

        } else {

          toast.success("Regeneration completed");

        }

      }

      if (!dryRun) {

        await fetchRuns();

        if (data.run?.id) await fetchRunDetail(data.run.id);

      }

    } catch (e) {

      toast.error(e instanceof Error ? e.message : "Failed to start run");

    } finally {

      setLoading(false);

    }

  };



  const confirmRun = async () => {

    if (!activeRun) return;

    setLoading(true);

    setConfirmOpen(false);

    try {

      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/confirm`, { method: "POST" });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Confirm failed");

      resetConnectionState();

      setActiveRun(data.run);

      setReport(data.report);

      toast.success(

        data.background ? "🚀 Regeneration started" : "Regeneration completed",

      );

      await fetchRuns(false);

      await fetchRunDetail(activeRun.id);

    } catch (e) {

      toast.error(e instanceof Error ? e.message : "Confirm failed");

    } finally {

      setLoading(false);

    }

  };



  const resumeRun = async () => {

    if (!activeRun) return;

    setLoading(true);

    try {

      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/process`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ untilDone: false }),

      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Resume failed");

      resetConnectionState();

      setActiveRun(data.run);

      setReport(data.report);

      toast.success("Processing continues automatically");

      await fetchRunDetail(activeRun.id);

    } catch (e) {

      toast.error(e instanceof Error ? e.message : "Resume failed");

    } finally {

      setLoading(false);

    }

  };



  const cancelRun = async () => {

    if (!activeRun) return;

    setLoading(true);

    try {

      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/cancel`, { method: "POST" });

      const data = await res.json();

      if (!res.ok) throw new Error("Cancel failed");

      setActiveRun(data.run);

      toast.success("Run cancelled");

      await fetchRuns();

    } catch {

      toast.error("Failed to cancel run");

    } finally {

      setLoading(false);

    }

  };



  const commitDryRun = async (input: {
    mode: "all" | "selected" | "improved";
    previewIds?: string[];
  }) => {
    if (!dryRunSession) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/seo/dry-run/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: dryRunSession.sessionId,
          mode: input.mode,
          previewIds: input.previewIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Commit failed");
      toast.success(`Committed ${data.committed} page(s)`);
      if (data.skipped > 0) {
        toast.info(`${data.skipped} page(s) skipped (below threshold)`);
      }
      const committedIds = new Set(
        (data.results as Array<{ previewId: string; ok: boolean }>)
          .filter((r) => r.ok)
          .map((r) => r.previewId),
      );
      setDryRunItems((prev) =>
        prev.map((item) =>
          committedIds.has(item.id) ? { ...item, status: "saved", saved: true } : item,
        ),
      );
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commit failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const discardDryRun = () => {
    setDryRunSession(null);
    setDryRunItems([]);
    setActiveRun(null);
    setReport(null);
    toast.info("Dry run previews discarded");
  };

  const rollbackRun = async () => {

    if (!activeRun || !confirm("Rollback all pages from this run?")) return;

    setLoading(true);

    try {

      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/rollback`, { method: "POST" });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Rollback failed");

      toast.success(`Rolled back ${data.rolledBack} page(s)`);

      await fetchRunDetail(activeRun.id);

    } catch (e) {

      toast.error(e instanceof Error ? e.message : "Rollback failed");

    } finally {

      setLoading(false);

    }

  };



  return {

    mode,

    setMode,

    batchSize,

    setBatchSize,

    dryRun,

    setDryRun,

    pageTypeFilter,

    setPageTypeFilter,

    citySlugs,

    setCitySlugs,

    lowScoreThreshold,

    setLowScoreThreshold,

    loading,

    runs,

    activeRun,

    setActiveRun,

    report,

    dashboard,

    confirmOpen,

    setConfirmOpen,

    schemaOutdated,

    pollingStopped,

    connectionError,

    retryConnection,

    fetchRuns,

    fetchRunDetail,

    startRun,

    confirmRun,

    resumeRun,

    cancelRun,

    rollbackRun,
    dryRunSession,
    setDryRunSession,
    dryRunItems,
    setDryRunItems,
    commitDryRun,
    discardDryRun,

  };

}



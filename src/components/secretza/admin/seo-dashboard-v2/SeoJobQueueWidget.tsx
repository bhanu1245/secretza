"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ListTodo,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Ban,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { JOB_TYPE_LABELS, type SeoJobType } from "@/lib/seo-job-types";

type JobProgress = {
  id: string;
  jobType: string;
  status: string;
  progress: number;
  total: number;
  processed: number;
  remaining: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  estimatedTimeRemaining: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  action: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

const POLL_MS = 3000;

function formatEta(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.ceil(seconds / 60);
  return `${mins}m`;
}

function statusBadge(status: string) {
  switch (status) {
    case "running":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "queued":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "completed":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "failed":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "cancelled":
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

export function SeoJobQueueWidget({ highlightJobId }: { highlightJobId?: string | null }) {
  const [jobs, setJobs] = useState<JobProgress[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const prevActiveRef = useRef(0);
  const processTickRef = useRef(false);

  const driveActiveJobBatch = useCallback(async (jobList: JobProgress[]) => {
    const active = jobList.find((j) => j.status === "queued" || j.status === "running");
    if (!active || processTickRef.current) return;
    processTickRef.current = true;
    try {
      const res = await apiFetch(`/api/seo/jobs/${active.id}/process`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        console.log("SEO_JOB_CLIENT_BATCH", {
          jobId: active.id,
          processed: data.processed,
          done: data.done,
        });
      }
    } catch (err) {
      console.warn("SEO_JOB_CLIENT_BATCH_ERROR", err);
    } finally {
      processTickRef.current = false;
    }
  }, []);

  const fetchJobs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [jobsRes, auditRes] = await Promise.all([
        fetch(`/api/seo/jobs?page=${page}&limit=10`),
        fetch(`/api/seo/jobs/audit?page=${auditPage}&limit=10`),
      ]);
      if (!jobsRes.ok) throw new Error("Failed to fetch jobs");
      const jobsData = await jobsRes.json();
      const jobList: JobProgress[] = jobsData.jobs ?? [];
      setJobs(jobList);
      setTotalPages(jobsData.totalPages ?? 1);
      console.log("SEO_JOB_FETCH", { count: jobList.length, page });

      if (jobList.some((j) => j.status === "queued" || j.status === "running")) {
        await driveActiveJobBatch(jobList);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs ?? []);
        setAuditTotalPages(auditData.totalPages ?? 1);
      }

      const active = (jobsData.jobs ?? []).filter(
        (j: JobProgress) => j.status === "queued" || j.status === "running",
      ).length;

      if (prevActiveRef.current > 0 && active === 0) {
        window.dispatchEvent(new CustomEvent("seo_dashboard_refresh"));
      }
      prevActiveRef.current = active;
    } catch (err) {
      if (showSpinner) {
        toast.error(err instanceof Error ? err.message : "Failed to load job queue");
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [page, auditPage, driveActiveJobBatch]);

  useEffect(() => {
    void fetchJobs(true);
    const interval = setInterval(() => void fetchJobs(false), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    if (highlightJobId) {
      const el = document.getElementById(`seo-job-${highlightJobId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightJobId, jobs]);

  const handleCancel = async (jobId: string) => {
    setActionLoading(`cancel_${jobId}`);
    try {
      const res = await apiFetch(`/api/seo/jobs/${jobId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Cancel failed");
      toast.success("Job cancelled");
      void fetchJobs(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    setActionLoading(`retry_${jobId}`);
    try {
      const res = await apiFetch(`/api/seo/jobs/${jobId}/retry`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Retry failed");
      toast.success(`Requeued ${data.requeued ?? 0} failed page(s)`);
      void fetchJobs(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading(null);
    }
  };

  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");

  if (loading && jobs.length === 0) {
    return (
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)] min-h-[200px] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
      </Card>
    );
  }

  return (
    <div className="space-y-4" id="seo-job-queue">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Loader2 className={`size-5 ${activeJobs.length > 0 ? "animate-spin" : ""}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{activeJobs.length}</p>
              <p className="text-xs text-[#A1A1AA]">Active Jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">
                {jobs.filter((j) => j.status === "completed").length}
              </p>
              <p className="text-xs text-[#A1A1AA]">Completed (page)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">
                {jobs.filter((j) => j.status === "failed").length}
              </p>
              <p className="text-xs text-[#A1A1AA]">Failed (page)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">
                {activeJobs[0]?.estimatedTimeRemaining != null
                  ? formatEta(activeJobs[0].estimatedTimeRemaining)
                  : "—"}
              </p>
              <p className="text-xs text-[#A1A1AA]">ETA (top job)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
              <ListTodo className="size-4" /> Job Queue
            </CardTitle>
            <CardDescription className="text-xs text-[#A1A1AA]">
              Polls every {POLL_MS / 1000}s · batches of 100 pages
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]"
            onClick={() => void fetchJobs(true)}
          >
            <RefreshCw className="size-3 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-[#52525B] text-center py-6">No background jobs yet.</p>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                id={`seo-job-${job.id}`}
                className={`p-3 rounded-lg bg-[#1E1E2A] border ${
                  highlightJobId === job.id
                    ? "border-violet-500/50"
                    : "border-[rgba(255,255,255,0.06)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#F5F5F7]">
                      {JOB_TYPE_LABELS[job.jobType as SeoJobType] ?? job.jobType}
                    </span>
                    <Badge variant="outline" className={statusBadge(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-[#52525B]">
                    {job.createdByEmail ?? "system"} · {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#A1A1AA]">
                    <span>
                      {job.processed} / {job.total} ({job.progress}%)
                    </span>
                    <span>ETA {formatEta(job.estimatedTimeRemaining)}</span>
                  </div>
                  <Progress
                    value={job.progress}
                    className="h-2 bg-[#15151D] transition-all duration-500"
                  />
                  <div className="flex flex-wrap gap-3 text-xs text-[#A1A1AA]">
                    <span className="text-emerald-400">✓ {job.successCount}</span>
                    <span className="text-red-400">✗ {job.failedCount}</span>
                    <span className="text-amber-400">⊘ {job.skippedCount}</span>
                    <span>Remaining: {job.remaining}</span>
                  </div>
                </div>

                {(job.status === "queued" || job.status === "running") && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={actionLoading === `cancel_${job.id}`}
                      onClick={() => void handleCancel(job.id)}
                    >
                      {actionLoading === `cancel_${job.id}` ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : (
                        <Ban className="size-3 mr-1" />
                      )}
                      Cancel
                    </Button>
                  </div>
                )}

                {job.failedCount > 0 && (job.status === "completed" || job.status === "failed") && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                      disabled={actionLoading === `retry_${job.id}`}
                      onClick={() => void handleRetry(job.id)}
                    >
                      {actionLoading === `retry_${job.id}` ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3 mr-1" />
                      )}
                      Retry Failed ({job.failedCount})
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-[#A1A1AA]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Audit Log</CardTitle>
          <CardDescription className="text-xs text-[#A1A1AA]">
            Job creation, completion, cancellation, and retries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-64 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[#52525B] text-center py-4">No audit entries yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex justify-between gap-2 text-xs p-2 rounded bg-[#1E1E2A]"
              >
                <div>
                  <span className="text-[#F5F5F7]">{log.action}</span>
                  {log.details && (
                    <span className="text-[#A1A1AA] ml-2">
                      {typeof log.details.total === "number" && `· ${log.details.total} pages`}
                      {typeof log.details.successCount === "number" &&
                        ` · ✓${log.details.successCount}`}
                      {typeof log.details.failedCount === "number" &&
                        ` · ✗${log.details.failedCount}`}
                    </span>
                  )}
                </div>
                <span className="text-[#52525B] shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
          {auditTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-[#A1A1AA]">
                Page {auditPage} of {auditTotalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={auditPage >= auditTotalPages}
                onClick={() => setAuditPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

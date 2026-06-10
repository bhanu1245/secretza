"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Activity, Clock, CheckCircle2, XCircle, RefreshCw, BarChart3, List, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SeoRegenerationMonitorWidget() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [queueOpen, setQueueOpen] = useState(false);

  const fetchMonitorData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seo/regeneration/monitor?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch monitor data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load monitor data");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchMonitorData();
  }, [fetchMonitorData]);

  if (loading && !data) {
    return (
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)] min-h-[300px] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
      </Card>
    );
  }

  if (!data) return null;

  const { metrics, history } = data;

  return (
    <div className="space-y-4">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{metrics.runningJobs}</p>
              <p className="text-xs text-[#A1A1AA]">Running Jobs</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <PauseCircle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{metrics.pendingJobs}</p>
              <p className="text-xs text-[#A1A1AA]">Pending Jobs</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{metrics.completedJobs}</p>
              <p className="text-xs text-[#A1A1AA]">Completed Jobs</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{metrics.failedJobs}</p>
              <p className="text-xs text-[#A1A1AA]">Failed Jobs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* History Graph */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)] lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Regeneration History</CardTitle>
              <CardDescription className="text-xs text-[#A1A1AA]">Jobs completed over time</CardDescription>
            </div>
            <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v, 10))}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
                <SelectValue placeholder="Days" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-[250px]">
            {history && history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#A1A1AA", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#15151D", borderColor: "rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "#F5F5F7" }}
                  />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="failed" name="Failed" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#52525B] text-sm">
                No regeneration history available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Performance Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-sm text-[#A1A1AA]">Success Rate</span>
              <span className="text-sm font-medium text-emerald-400">{metrics.successRate}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-sm text-[#A1A1AA]">Failure Rate</span>
              <span className="text-sm font-medium text-red-400">{metrics.failureRate}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-sm text-[#A1A1AA]">Avg. Duration</span>
              <span className="text-sm font-medium text-[#F5F5F7]">{metrics.avgDuration}s</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-sm text-[#A1A1AA]">Last Run</span>
              <span className="text-sm font-medium text-[#F5F5F7]">
                {metrics.lastRunTime ? new Date(metrics.lastRunTime).toLocaleDateString() : "Never"}
              </span>
            </div>
            
            <Button 
              className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white" 
              onClick={() => setQueueOpen(true)}
            >
              <List className="size-4 mr-2" />
              View Queue Details
            </Button>
          </CardContent>
        </Card>
      </div>

      <SeoRegenerationQueueModal open={queueOpen} onOpenChange={setQueueOpen} />
    </div>
  );
}

function SeoRegenerationQueueModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchJobs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p.toString(), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      
      const res = await fetch(`/api/seo/regenerate?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      // The API returns { runs: [...] }
      setJobs(data.runs || []);
      setTotal(data.total || 0); // We'll need to update the API to return total, or just use what we have
      setPage(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading jobs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (open) {
      fetchJobs(1);
    }
  }, [open, fetchJobs]);

  const handleAction = async (id: string, action: string) => {
    // Only admins can do this, but we'll try and show error if unauthorized
    if (!confirm(`Are you sure you want to ${action} this job?`)) return;
    
    try {
      const res = await fetch(`/api/seo/regenerate/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
         const d = await res.json();
         throw new Error(d.error || `Failed to ${action}`);
      }
      toast.success(`Successfully executed ${action} on job`);
      fetchJobs(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Error executing ${action}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7]">Regeneration Queue Details</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-2 py-2 shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-xs h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchJobs(1)} className="bg-transparent border-[rgba(255,255,255,0.08)] text-[#A1A1AA]">
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/50">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-[#0E0E17] z-10">
              <tr className="text-[#A1A1AA] border-b border-[rgba(255,255,255,0.06)]">
                <th className="py-2 px-4 font-medium">Job ID</th>
                <th className="py-2 px-4 font-medium">Mode</th>
                <th className="py-2 px-4 font-medium">Status</th>
                <th className="py-2 px-4 font-medium">Progress</th>
                <th className="py-2 px-4 font-medium">Started At</th>
                <th className="py-2 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#A1A1AA]">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#52525B]">
                    No jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="py-2 px-4 text-xs font-mono text-[#A1A1AA]">{job.id.slice(0, 8)}...</td>
                    <td className="py-2 px-4 text-xs uppercase text-[#F5F5F7]">{job.mode}</td>
                    <td className="py-2 px-4">
                      <Badge variant="outline" className={`bg-transparent text-[10px] ${
                        job.status === "completed" ? "text-emerald-400 border-emerald-400/30" :
                        job.status === "failed" ? "text-red-400 border-red-400/30" :
                        job.status === "processing" ? "text-blue-400 border-blue-400/30" :
                        "text-amber-400 border-amber-400/30"
                      }`}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-xs text-[#A1A1AA]">
                      {job.completedCount} / {job.queuedCount}
                    </td>
                    <td className="py-2 px-4 text-xs text-[#A1A1AA]">
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {(job.status === "pending" || job.status === "processing") && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs text-red-400 hover:bg-red-400/10 hover:text-red-300"
                          onClick={() => handleAction(job.id, "cancel")}
                        >
                          Cancel
                        </Button>
                      )}
                      {job.status === "failed" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs text-blue-400 hover:bg-blue-400/10 hover:text-blue-300"
                          onClick={() => handleAction(job.id, "process")}
                        >
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

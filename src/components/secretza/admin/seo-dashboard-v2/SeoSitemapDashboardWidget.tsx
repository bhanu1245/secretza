"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Map as MapIcon, CheckCircle2, XCircle, RefreshCw, Send, Download, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export function SeoSitemapDashboardWidget() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [activeIssue, setActiveIssue] = useState<{ title: string; description: string; count: number } | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seo/sitemap/dashboard`);
      if (!res.ok) throw new Error("Failed to fetch sitemap data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sitemap data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleAction = async (action: string) => {
    if (action === "download") {
      window.open("/sitemap.xml", "_blank");
      return;
    }
    
    if (action === "view") {
      window.open("/sitemap.xml", "_blank");
      return;
    }

    if (!confirm(`Are you sure you want to ${action} the sitemap?`)) return;

    setActionLoading(action);
    try {
      const res = await fetch(`/api/seo/sitemap/dashboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `Failed to ${action}`);
      }
      toast.success(`Sitemap ${action} successfully executed`);
      if (action === "validate") {
        fetchDashboard();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Error executing ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const openDrillDown = (title: string, description: string, count: number) => {
    if (count === 0) return;
    setActiveIssue({ title, description, count });
    setDrillDownOpen(true);
  };

  if (loading && !data) {
    return (
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)] min-h-[300px] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
      </Card>
    );
  }

  if (!data) return null;

  const { stats, health } = data;

  const healthColor = health.score >= 90 ? "#10B981" : health.score >= 70 ? "#EAB308" : "#EF4444";
  const healthBg = health.score >= 90 ? "rgba(16,185,129,0.1)" : health.score >= 70 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)";

  return (
    <div className="space-y-4">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400">
              <MapIcon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{stats.totalUrls.toLocaleString()}</p>
              <p className="text-xs text-[#A1A1AA]">Total URLs</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{stats.validUrls.toLocaleString()}</p>
              <p className="text-xs text-[#A1A1AA]">Valid URLs</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{(stats.missingUrls + stats.invalidUrls).toLocaleString()}</p>
              <p className="text-xs text-[#A1A1AA]">Issues Found</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F5F5F7]">{stats.chunks}</p>
              <p className="text-xs text-[#A1A1AA]">Sitemap Chunks</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score & Breakdown */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Sitemap Health Score</CardTitle>
            <CardDescription className="text-xs text-[#A1A1AA]">Breakdown of sitemap validation issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 mt-2">
              <div className="relative size-24 shrink-0 flex items-center justify-center rounded-full" style={{ background: healthBg }}>
                <svg className="absolute inset-0 size-full transform -rotate-90">
                  <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke={healthColor}
                    strokeWidth="6"
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * health.score) / 100}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <span className="text-2xl font-bold" style={{ color: healthColor }}>{health.score}</span>
              </div>
              <div className="flex-1 w-full space-y-3">
                <div 
                  className={`flex justify-between items-center p-2 rounded-md transition-colors ${health.missingUrls > 0 ? "hover:bg-[rgba(255,255,255,0.05)] cursor-pointer" : "opacity-50"}`}
                  onClick={() => openDrillDown("Missing URLs", "Pages that exist but are not in the sitemap.", health.missingUrls)}
                >
                  <span className="text-sm text-[#F5F5F7]">Missing URLs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-400">{health.missingUrls.toLocaleString()}</span>
                    {health.missingUrls > 0 && <AlertTriangle className="size-3 text-amber-400" />}
                  </div>
                </div>
                <div 
                  className={`flex justify-between items-center p-2 rounded-md transition-colors ${health.invalidEntries > 0 ? "hover:bg-[rgba(255,255,255,0.05)] cursor-pointer" : "opacity-50"}`}
                  onClick={() => openDrillDown("Invalid Entries", "Pages with invalid canonicals or formatting.", health.invalidEntries)}
                >
                  <span className="text-sm text-[#F5F5F7]">Invalid Entries</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-400">{health.invalidEntries.toLocaleString()}</span>
                    {health.invalidEntries > 0 && <AlertTriangle className="size-3 text-red-400" />}
                  </div>
                </div>
                <div 
                  className={`flex justify-between items-center p-2 rounded-md transition-colors ${health.duplicateUrls > 0 ? "hover:bg-[rgba(255,255,255,0.05)] cursor-pointer" : "opacity-50"}`}
                  onClick={() => openDrillDown("Duplicate URLs", "Pages that resolve to the same canonical URL.", health.duplicateUrls)}
                >
                  <span className="text-sm text-[#F5F5F7]">Duplicate URLs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-400">{health.duplicateUrls.toLocaleString()}</span>
                    {health.duplicateUrls > 0 && <AlertTriangle className="size-3 text-amber-400" />}
                  </div>
                </div>
                <div 
                  className={`flex justify-between items-center p-2 rounded-md transition-colors ${health.brokenLinks > 0 ? "hover:bg-[rgba(255,255,255,0.05)] cursor-pointer" : "opacity-50"}`}
                  onClick={() => openDrillDown("Broken Links", "Sitemap entries resulting in 404s.", health.brokenLinks)}
                >
                  <span className="text-sm text-[#F5F5F7]">Broken Links (404s)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-400">{health.brokenLinks.toLocaleString()}</span>
                    {health.brokenLinks > 0 && <AlertTriangle className="size-3 text-red-400" />}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata & Actions */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Sitemap Info</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-4">
            <div className="space-y-2 flex-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#A1A1AA]">Last Generated</span>
                <span className="text-[#F5F5F7]">
                  {stats.lastGenerated ? new Date(stats.lastGenerated).toLocaleDateString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#A1A1AA]">Last Submitted</span>
                <span className="text-[#F5F5F7]">
                  {stats.lastSubmitted ? new Date(stats.lastSubmitted).toLocaleDateString() : "Unknown"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#A1A1AA]">Last Validation</span>
                <span className="text-[#F5F5F7]">
                  {stats.lastValidation ? new Date(stats.lastValidation).toLocaleDateString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#A1A1AA]">Est. Size</span>
                <span className="text-[#F5F5F7]">
                  {(stats.sitemapSize / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-auto">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-transparent border-[rgba(255,255,255,0.08)] text-xs text-[#A1A1AA] hover:text-[#F5F5F7]"
                onClick={() => handleAction("regenerate")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "regenerate" ? <Loader2 className="size-3 mr-2 animate-spin" /> : <RefreshCw className="size-3 mr-2" />}
                Regenerate
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-transparent border-[rgba(255,255,255,0.08)] text-xs text-[#A1A1AA] hover:text-[#F5F5F7]"
                onClick={() => handleAction("validate")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "validate" ? <Loader2 className="size-3 mr-2 animate-spin" /> : <ShieldCheck className="size-3 mr-2" />}
                Validate
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-blue-500/10 border-blue-500/30 text-xs text-blue-400 hover:bg-blue-500/20"
                onClick={() => handleAction("submit")}
                disabled={actionLoading !== null}
              >
                {actionLoading === "submit" ? <Loader2 className="size-3 mr-2 animate-spin" /> : <Send className="size-3 mr-2" />}
                Submit (Ping)
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full bg-transparent border-[rgba(255,255,255,0.08)] text-xs text-[#A1A1AA] hover:text-[#F5F5F7]"
                onClick={() => handleAction("view")}
                disabled={actionLoading !== null}
              >
                <ExternalLink className="size-3 mr-2" />
                View XML
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] flex items-center gap-2">
              {activeIssue?.title}
              <Badge variant="outline" className="bg-[#1E1E2A] text-amber-400 border-amber-500/30 text-xs">
                {activeIssue?.count.toLocaleString()} Affected
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              {activeIssue?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-[#A1A1AA]">
            <p className="text-sm">This detailed view will be fully integrated in the Bulk Operations phase.</p>
            <Button variant="outline" className="mt-4 bg-transparent border-[rgba(255,255,255,0.08)]" onClick={() => setDrillDownOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

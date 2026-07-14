"use client";

import { useState } from "react";
import {
  Activity,
  FileCheck,
  FileText,
  FileX2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getHealthColor(score: number) {
  if (score >= 80) return { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Excellent" };
  if (score >= 60) return { color: "#EAB308", bg: "rgba(234,179,8,0.1)", label: "Good" };
  if (score >= 40) return { color: "#F97316", bg: "rgba(249,115,22,0.1)", label: "Needs Improvement" };
  return { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "Critical" };
}

import { SeoIssueDrillDownWidget, IssueType } from "./SeoIssueDrillDownWidget";

export function SeoHealthOverviewWidget({ data }: { data: any }) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [activeIssue, setActiveIssue] = useState<{
    type: IssueType;
    name: string;
    description: string;
  } | null>(null);

  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-[#15151D] border border-[rgba(255,255,255,0.08)] rounded-xl" />
        ))}
      </div>
    );
  }

  const health = getHealthColor(data.healthScore);
  const totalPages = data.seoPages.total;
  const issues = data.contentIssues;
  const duplicates = data.duplicates;

  const breakdownItems = [
    {
      name: "Meta Titles",
      count: duplicates.pagesWithDuplicateTitle,
      total: totalPages,
      issue: "Duplicate Titles",
      issueType: "duplicate_titles",
    },
    {
      name: "Meta Descriptions",
      count: issues.missingMetaDescription + duplicates.pagesWithDuplicateMeta,
      total: totalPages,
      issue: "Missing or Duplicate",
      issueType: issues.missingMetaDescription > 0 ? "missing_meta" : "duplicate_meta",
    },
    {
      name: "H1 Tags",
      count: issues.missingH1 + duplicates.pagesWithDuplicateH1,
      total: totalPages,
      issue: "Missing or Duplicate",
      issueType: issues.missingH1 > 0 ? "missing_h1" : "duplicate_h1",
    },
    {
      name: "Canonical URLs",
      count: issues.missingCanonical,
      total: totalPages,
      issue: "Missing Canonical",
      issueType: "missing_canonical",
    },
    {
      name: "Schema Markup",
      count: issues.missingStructuredData,
      total: totalPages,
      issue: "Missing Schema",
      issueType: "missing_schema",
    },
    {
      name: "Featured Images",
      count: issues.missingFeaturedImage,
      total: totalPages,
      issue: "Missing Image",
      issueType: "missing_image",
    },
    {
      name: "Word Count",
      count: issues.belowMinWords,
      total: totalPages,
      issue: `Below ${issues.minWordCount} words`,
      issueType: "thin_content",
    },
    {
      name: "Internal Links",
      count: issues.missingInternalLinks,
      total: totalPages,
      issue: `Below ${issues.minInternalLinks} links`,
      issueType: "missing_internal_links",
    },
    {
      name: "Broken Internal Links",
      count: issues.brokenInternalLinks ?? 0,
      total: totalPages,
      issue: "Links resolve to 404",
      issueType: "broken_internal_links",
    },
    {
      name: "Duplicate Issues",
      count: duplicates.pagesWithDuplicateContent,
      total: totalPages,
      issue: "Content Hash Match",
      issueType: "duplicate_content",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top row: Health Score + High-level metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <Card
          className="bg-[#15151D] border-[rgba(255,255,255,0.08)] cursor-pointer hover:border-[#7C3AED] transition-colors"
          onClick={() => setBreakdownOpen(true)}
        >
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6 h-full justify-center">
            <div className="text-center">
              <p className="text-5xl font-bold" style={{ color: health.color }}>
                {data.healthScore}
              </p>
              <p className="text-xs text-[#A1A1AA] mt-1">SEO Health Score</p>
            </div>
            <div className="flex flex-col items-center sm:items-start gap-2">
              <Badge
                variant="outline"
                style={{
                  backgroundColor: health.bg,
                  color: health.color,
                  borderColor: `${health.color}30`,
                }}
              >
                {health.label}
              </Badge>
              <p className="text-xs text-[#A1A1AA] text-center sm:text-left">
                Click to view detailed breakdown
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Essential Counts */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total SEO Pages"
            value={formatNumber(data.seoPages.total)}
            icon={FileText}
            color="#7C3AED"
            bg="rgba(124,58,237,0.1)"
          />
          <StatCard
            label="Published"
            value={formatNumber(data.seoPages.published)}
            icon={FileCheck}
            color="#10B981"
            bg="rgba(16,185,129,0.1)"
          />
          <StatCard
            label="Drafts"
            value={formatNumber(data.seoPages.drafts)}
            icon={FileX2}
            color="#EAB308"
            bg="rgba(234,179,8,0.1)"
          />
          <StatCard
            label="Noindex"
            value={formatNumber(data.seoPages.noindex)}
            icon={AlertTriangle}
            color="#EF4444"
            bg="rgba(239,68,68,0.1)"
          />
          <StatCard
            label="Indexed"
            value={formatNumber(data.indexation.indexed)}
            icon={Layers}
            color="#3B82F6"
            bg="rgba(59,130,246,0.1)"
          />
          <StatCard
            label="Avg SEO Score"
            value={data.quality.avgSeoScore}
            icon={Activity}
            color="#10B981"
            bg="rgba(16,185,129,0.1)"
          />
          <StatCard
            label="Avg Readability"
            value={data.quality.avgReadability}
            icon={HelpCircle}
            color="#F59E0B"
            bg="rgba(245,158,11,0.1)"
          />
          <StatCard
            label="Last Regeneration"
            value={formatTimeAgo(data.regeneration.lastRegenerationDate)}
            icon={Clock}
            color="#A1A1AA"
            bg="rgba(161,161,170,0.1)"
          />
        </div>
      </div>

      {/* Breakdown Modal */}
      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] text-xl flex items-center gap-2">
              <Activity className="size-5 text-[#7C3AED]" />
              SEO Health Breakdown
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {breakdownItems.map((item, i) => {
                const isHealthy = item.count === 0;
                const percentage =
                  item.total > 0
                    ? Math.round(((item.total - item.count) / item.total) * 100)
                    : 100;

                return (
                  <Card 
                    key={i} 
                    className="bg-[#1E1E2A] border-[rgba(255,255,255,0.05)] cursor-pointer hover:border-[#7C3AED] transition-colors"
                    onClick={() => {
                      if (!isHealthy) {
                        setActiveIssue({
                          type: item.issueType as IssueType,
                          name: item.name,
                          description: item.issue,
                        });
                        setDrillDownOpen(true);
                      }
                    }}
                  >
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#F5F5F7]">
                          {item.name}
                        </span>
                        {isHealthy ? (
                          <CheckCircle2 className="size-4 text-emerald-400" />
                        ) : (
                          <XCircle className="size-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#15151D] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              isHealthy ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#A1A1AA] w-8 text-right">
                          {percentage}%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A1A1AA]">
                        {isHealthy
                          ? "No issues detected"
                          : `${formatNumber(item.count)} pages: ${item.issue}`}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SeoIssueDrillDownWidget
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        issueType={activeIssue?.type ?? null}
        issueName={activeIssue?.name ?? ""}
        issueDescription={activeIssue?.description ?? ""}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  bg: string;
}) {
  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: bg }}>
          <Icon className="size-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm sm:text-lg font-bold text-[#F5F5F7] truncate">{value}</p>
          <p className="text-[10px] text-[#A1A1AA] truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

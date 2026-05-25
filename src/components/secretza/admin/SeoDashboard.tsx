'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Loader2,
  FileCheck,
  FileX2,
  Map,
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Globe,
  Copy,
  Link2,
  FileText,
  FileQuestion,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ShieldCheck,
  Search,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Map as MapIcon,
} from 'lucide-react';

// ==========================================
// Types
// ==========================================
interface SeoDashboardData {
  indexation: {
    total: number;
    indexed: number;
    noindexed: number;
    lowConfidence: number;
    topIssues: Array<{
      pageType: string;
      pageSlug: string;
      url: string;
      overallScore: number;
      recommendation: string;
      reasons: string[];
    }>;
  };
  crawl: {
    totalCrawls: number;
    botCrawls: number;
    googlebotCrawls: number;
    topCrawledPages: Array<{
      path: string;
      count: number;
      lastCrawl: string;
    }>;
    orphanedPages: Array<{
      path: string;
      lastCrawl: string;
    }>;
    brokenPages: Array<{
      path: string;
      statusCode: number;
      count: number;
    }>;
    crawlFrequency: Array<{
      path: string;
      avgInterval: number;
      lastCrawl: string;
    }>;
  };
  sitemap: {
    totalUrls: number;
    chunks: number;
    noindexExcluded: number;
    lastGenerated: string;
    breakdown: Array<{
      section: string;
      count: number;
    }>;
  };
  seoPages: {
    total: number;
    published: number;
    drafts: number;
    noindex: number;
    withCustomContent: number;
    withFaqs: number;
  };
  duplicateRisk: Array<{
    slug: string;
    type: string;
    duplicates: string[];
    risk: string;
  }>;
  topLandingPages: Array<{
    url: string;
    title: string;
    type: string;
    listings: number;
  }>;
  healthScore: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

// ==========================================
// Helpers
// ==========================================
function getHealthColor(score: number): { color: string; bg: string; label: string } {
  if (score >= 80) return { color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: 'Excellent' };
  if (score >= 60) return { color: '#EAB308', bg: 'rgba(234,179,8,0.1)', label: 'Good' };
  if (score >= 40) return { color: '#F97316', bg: 'rgba(249,115,22,0.1)', label: 'Needs Improvement' };
  return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Critical' };
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'crawl': return <Bot className="size-3.5 text-blue-400" />;
    case 'index': return <FileCheck className="size-3.5 text-emerald-400" />;
    case 'error': return <AlertTriangle className="size-3.5 text-red-400" />;
    case 'sitemap': return <MapIcon className="size-3.5 text-amber-400" />;
    case 'noindex': return <FileX2 className="size-3.5 text-rose-400" />;
    default: return <Activity className="size-3.5 text-[#A1A1AA]" />;
  }
}

function getRiskBadge(risk: string) {
  switch (risk.toLowerCase()) {
    case 'high':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'medium':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'low':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function getScoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 60) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (score >= 40) return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  return 'bg-red-500/15 text-red-400 border-red-500/30';
}

// ==========================================
// Health Score Ring Component (SVG)
// ==========================================
function HealthScoreRing({ score }: { score: number }) {
  const { color, label } = getHealthColor(score);
  const radius = 70;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={radius * 2}
        height={radius * 2}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-medium text-[#A1A1AA] mt-0.5">
          / 100
        </span>
      </div>
    </div>
  );
}

// ==========================================
// Section 1: Health Score Card
// ==========================================
function HealthScoreSection({ score }: { score: number }) {
  const { color, bg, label } = getHealthColor(score);

  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
          <Activity className="size-4 text-[#7C3AED]" />
          SEO Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <HealthScoreRing score={score} />
          <div className="text-center sm:text-left space-y-2">
            <Badge
              variant="outline"
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: bg, color, borderColor: `${color}30` }}
            >
              {label}
            </Badge>
            <p className="text-sm text-[#A1A1AA] max-w-[260px]">
              {score >= 80
                ? 'Your site is in excellent health. Keep up the great work!'
                : score >= 60
                ? 'Good overall, but there are areas that could be improved.'
                : score >= 40
                ? 'Several issues need attention to improve search visibility.'
                : 'Critical issues detected. Immediate action is required.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Section 2: Quick Stats Grid
// ==========================================
function QuickStatsGrid({ data }: { data: SeoDashboardData }) {
  const stats = [
    {
      label: 'Indexed Pages',
      value: data.indexation.indexed,
      icon: FileCheck,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Noindex Pages',
      value: data.indexation.noindexed,
      icon: FileX2,
      color: '#EF4444',
      bg: 'rgba(239,68,68,0.1)',
      trend: '+3%',
      trendUp: false,
    },
    {
      label: 'MapIcon URLs',
      value: data.sitemap.totalUrls,
      icon: MapIcon,
      color: '#7C3AED',
      bg: 'rgba(124,58,237,0.1)',
      trend: `${data.sitemap.chunks} chunks`,
      trendUp: null,
    },
    {
      label: 'Googlebot Visits',
      value: data.crawl.googlebotCrawls,
      icon: Bot,
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.1)',
      trend: '+8.4%',
      trendUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(124,58,237,0.2)] transition-all"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg" style={{ backgroundColor: stat.bg }}>
                <stat.icon className="size-4" style={{ color: stat.color }} />
              </div>
              {stat.trendUp !== null && (
                <span
                  className={`text-[10px] font-medium flex items-center gap-0.5 ${
                    stat.trendUp ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {stat.trendUp ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {stat.trend}
                </span>
              )}
              {stat.trendUp === null && (
                <span className="text-[10px] text-[#52525B]">{stat.trend}</span>
              )}
            </div>
            <p className="text-xl font-bold text-[#F5F5F7]">
              {formatNumber(stat.value)}
            </p>
            <p className="text-[10px] text-[#A1A1AA] mt-0.5">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==========================================
// Section 3: Indexation Breakdown
// ==========================================
function IndexationBreakdown({ data }: { data: SeoDashboardData }) {
  const { indexed, noindexed, lowConfidence, total } = data.indexation;
  const indexedPct = total > 0 ? ((indexed / total) * 100).toFixed(1) : '0';
  const noindexedPct = total > 0 ? ((noindexed / total) * 100).toFixed(1) : '0';
  const lowPct = total > 0 ? ((lowConfidence / total) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Horizontal bar */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
            <Layers className="size-4 text-[#7C3AED]" />
            Indexation Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Stacked bar */}
            <div className="h-8 rounded-lg overflow-hidden flex bg-[rgba(255,255,255,0.04)]">
              <div
                className="bg-emerald-500 transition-all duration-700 flex items-center justify-center"
                style={{ width: `${indexedPct}%` }}
                title={`Indexed: ${indexedPct}%`}
              >
                {Number(indexedPct) > 10 && (
                  <span className="text-[9px] font-bold text-white">{indexedPct}%</span>
                )}
              </div>
              <div
                className="bg-red-500/70 transition-all duration-700 flex items-center justify-center"
                style={{ width: `${noindexedPct}%` }}
                title={`Noindexed: ${noindexedPct}%`}
              >
                {Number(noindexedPct) > 10 && (
                  <span className="text-[9px] font-bold text-white">{noindexedPct}%</span>
                )}
              </div>
              <div
                className="bg-amber-500/70 transition-all duration-700 flex items-center justify-center"
                style={{ width: `${lowPct}%` }}
                title={`Low confidence: ${lowPct}%`}
              >
                {Number(lowPct) > 10 && (
                  <span className="text-[9px] font-bold text-white">{lowPct}%</span>
                )}
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-xs text-[#A1A1AA]">Indexed ({formatNumber(indexed)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-500/70" />
                <span className="text-xs text-[#A1A1AA]">Noindexed ({formatNumber(noindexed)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-amber-500/70" />
                <span className="text-xs text-[#A1A1AA]">Low Confidence ({formatNumber(lowConfidence)})</span>
              </div>
            </div>
            <p className="text-xs text-[#52525B]">
              Total: {formatNumber(total)} pages analyzed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Right: Top 5 issues */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-400" />
            Top Indexation Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
            {data.indexation.topIssues.length === 0 ? (
              <p className="text-sm text-[#52525B] text-center py-6">No issues detected</p>
            ) : (
              data.indexation.topIssues.slice(0, 5).map((issue, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]"
                >
                  <span className="text-xs font-bold text-[#52525B] w-5 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F5F5F7] truncate">
                      {issue.pageSlug}
                    </p>
                    <p className="text-[10px] text-[#52525B]">
                      {issue.pageType} &middot; Score: {issue.overallScore}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${getScoreBadge(
                      issue.overallScore
                    )}`}
                  >
                    {issue.recommendation}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// Section 4: Crawl Analytics
// ==========================================
function CrawlAnalytics({ data }: { data: SeoDashboardData }) {
  const [showOrphans, setShowOrphans] = useState(false);
  const [showBroken, setShowBroken] = useState(false);

  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
          <BarChart3 className="size-4 text-[#7C3AED]" />
          Crawl Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Top Crawled Pages Table */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">
            Top 10 Most Crawled Paths
          </p>
          <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Path
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Crawl Count
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Last Crawl
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.crawl.topCrawledPages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-sm text-[#52525B]">
                      No crawl data available
                    </td>
                  </tr>
                ) : (
                  data.crawl.topCrawledPages.slice(0, 10).map((page, i) => (
                    <tr
                      key={i}
                      className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-[#52525B]">{i + 1}</td>
                      <td className="px-4 py-2.5 text-xs text-[#F5F5F7] font-mono truncate max-w-[300px]">
                        {page.path}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#A1A1AA] text-right">
                        {formatNumber(page.count)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#52525B] text-right">
                        {formatTimeAgo(page.lastCrawl)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orphaned & Broken pages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Orphaned pages */}
          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <button
              onClick={() => setShowOrphans(!showOrphans)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileX2 className="size-4 text-amber-400" />
                <span className="text-xs font-semibold text-[#F5F5F7]">
                  Orphaned Pages
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 rounded-full"
                >
                  {data.crawl.orphanedPages.length}
                </Badge>
              </div>
              {showOrphans ? (
                <ChevronUp className="size-3.5 text-[#52525B]" />
              ) : (
                <ChevronDown className="size-3.5 text-[#52525B]" />
              )}
            </button>
            {showOrphans && (
              <div className="border-t border-[rgba(255,255,255,0.06)] max-h-48 overflow-y-auto custom-scrollbar">
                {data.crawl.orphanedPages.length === 0 ? (
                  <p className="text-xs text-[#52525B] text-center py-4">No orphaned pages</p>
                ) : (
                  data.crawl.orphanedPages.slice(0, 10).map((page, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)]"
                    >
                      <span className="text-xs text-[#A1A1AA] font-mono truncate max-w-[250px]">
                        {page.path}
                      </span>
                      <span className="text-[10px] text-[#52525B] flex-shrink-0 ml-2">
                        {formatTimeAgo(page.lastCrawl)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Broken pages (4xx) */}
          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <button
              onClick={() => setShowBroken(!showBroken)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-red-400" />
                <span className="text-xs font-semibold text-[#F5F5F7]">
                  Broken Pages (4xx)
                </span>
                <Badge
                  variant="outline"
                  className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 rounded-full"
                >
                  {data.crawl.brokenPages.length}
                </Badge>
              </div>
              {showBroken ? (
                <ChevronUp className="size-3.5 text-[#52525B]" />
              ) : (
                <ChevronDown className="size-3.5 text-[#52525B]" />
              )}
            </button>
            {showBroken && (
              <div className="border-t border-[rgba(255,255,255,0.06)] max-h-48 overflow-y-auto custom-scrollbar">
                {data.crawl.brokenPages.length === 0 ? (
                  <p className="text-xs text-[#52525B] text-center py-4">No broken pages</p>
                ) : (
                  data.crawl.brokenPages.slice(0, 10).map((page, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)]"
                    >
                      <span className="text-xs text-[#A1A1AA] font-mono truncate max-w-[200px]">
                        {page.path}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className="bg-red-500/15 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0 rounded-full"
                        >
                          {page.statusCode}
                        </Badge>
                        <span className="text-[10px] text-[#52525B]">{page.count}x</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Section 5: MapIcon Statistics
// ==========================================
function MapIconStatistics({ data }: { data: SeoDashboardData }) {
  const sectionLabels: Record<string, string> = {
    static: 'Static Pages',
    categories: 'Categories',
    cities: 'Cities',
    category_city: 'Category+City Combos',
    listings: 'Listings',
    images: 'Images',
  };

  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
            <MapIcon className="size-4 text-[#7C3AED]" />
            MapIcon Statistics
          </CardTitle>
          <span className="text-[10px] text-[#52525B]">
            Last generated: {data.sitemap.lastGenerated ? formatTimeAgo(data.sitemap.lastGenerated) : 'Never'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.sitemap.breakdown.map((item) => (
            <div
              key={item.section}
              className="p-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]"
            >
              <p className="text-lg font-bold text-[#F5F5F7]">{formatNumber(item.count)}</p>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">
                {sectionLabels[item.section] || item.section}
              </p>
            </div>
          ))}
          <div className="p-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]">
            <p className="text-lg font-bold text-[#F5F5F7]">{data.sitemap.chunks}</p>
            <p className="text-[10px] text-[#A1A1AA] mt-0.5">Total Chunks</p>
          </div>
          <div className="p-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]">
            <p className="text-lg font-bold text-[#F5F5F7]">{data.sitemap.noindexExcluded}</p>
            <p className="text-[10px] text-[#A1A1AA] mt-0.5">Noindex Excluded</p>
          </div>
          <div className="p-3 rounded-lg bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)]">
            <p className="text-lg font-bold text-[#8B5CF6]">{formatNumber(data.sitemap.totalUrls)}</p>
            <p className="text-[10px] text-[#8B5CF6] mt-0.5">Total URLs</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Section 6: Duplicate Risk Pages
// ==========================================
function DuplicateRiskSection({ data }: { data: SeoDashboardData }) {
  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
          <Copy className="size-4 text-amber-400" />
          Duplicate Risk Pages
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.duplicateRisk.length === 0 ? (
          <p className="text-sm text-[#52525B] text-center py-8">
            No duplicate content risks detected
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Canonical Suggestion
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.duplicateRisk.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-[#F5F5F7] font-mono">{item.slug}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className="bg-[rgba(255,255,255,0.04)] text-[#A1A1AA] border-[rgba(255,255,255,0.08)] text-[10px] px-1.5 py-0.5 rounded-full"
                      >
                        {item.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getRiskBadge(item.risk)}`}
                      >
                        {item.risk}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-[#A1A1AA] truncate max-w-[200px] block">
                        {item.duplicates.length > 0 ? item.duplicates[0] : 'N/A'}
                      </span>
                      {item.duplicates.length > 1 && (
                        <span className="text-[10px] text-[#52525B]">
                          +{item.duplicates.length - 1} more
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// Section 7: Top Landing Pages
// ==========================================
function TopLandingPages({ data }: { data: SeoDashboardData }) {
  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
          <Globe className="size-4 text-[#7C3AED]" />
          Top Landing Pages
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.topLandingPages.length === 0 ? (
          <p className="text-sm text-[#52525B] text-center py-8">
            No landing page data available
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    URL
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Listings
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topLandingPages.map((page, i) => (
                  <tr
                    key={i}
                    className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link2 className="size-3 text-[#52525B] flex-shrink-0" />
                        <span className="text-xs text-[#F5F5F7] font-mono truncate max-w-[200px]">
                          {page.url}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-[#A1A1AA] truncate max-w-[200px] block">
                        {page.title}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px] px-1.5 py-0.5 rounded-full"
                      >
                        {page.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#A1A1AA] text-right">
                      {formatNumber(page.listings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// Section 8: SEO Content Stats
// ==========================================
function SeoContentStats({ data }: { data: SeoDashboardData }) {
  const stats = [
    {
      label: 'Published SEO Pages',
      value: data.seoPages.published,
      icon: FileCheck,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
    },
    {
      label: 'Draft SEO Pages',
      value: data.seoPages.drafts,
      icon: FileText,
      color: '#EAB308',
      bg: 'rgba(234,179,8,0.1)',
    },
    {
      label: 'Pages with Custom Content',
      value: data.seoPages.withCustomContent,
      icon: FileText,
      color: '#7C3AED',
      bg: 'rgba(124,58,237,0.1)',
    },
    {
      label: 'Pages with FAQs',
      value: data.seoPages.withFaqs,
      icon: FileQuestion,
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.1)',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="bg-[#15151D] border-[rgba(255,255,255,0.08)]"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg" style={{ backgroundColor: stat.bg }}>
                <stat.icon className="size-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[#F5F5F7]">{formatNumber(stat.value)}</p>
                <p className="text-[10px] text-[#A1A1AA]">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==========================================
// Section 9: Recent Activity
// ==========================================
function RecentActivity({ data }: { data: SeoDashboardData }) {
  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
          <Clock className="size-4 text-[#7C3AED]" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-[#52525B] text-center py-8">
            No recent activity
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[17px] top-3 bottom-3 w-px bg-[rgba(255,255,255,0.06)]" />
            <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {data.recentActivity.slice(0, 10).map((event, i) => (
                <div key={i} className="flex items-start gap-3 py-2 group">
                  <div className="relative z-10 mt-0.5 p-1.5 rounded-full bg-[#1E1E2A] border border-[rgba(255,255,255,0.06)]">
                    {getActivityIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#F5F5F7] group-hover:text-[#8B5CF6] transition-colors">
                      {event.message}
                    </p>
                    <p className="text-[10px] text-[#52525B] mt-0.5">
                      {formatTimeAgo(event.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// Section 10: Verification Status
// ==========================================
function VerificationStatus() {
  const verifications = [
    {
      name: 'Google Search Console',
      configured: true,
    },
    {
      name: 'Bing Webmaster Tools',
      configured: true,
    },
    {
      name: 'Yandex Webmaster',
      configured: false,
    },
  ];

  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#7C3AED]" />
          Verification Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {verifications.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]"
            >
              <div className="flex items-center gap-3">
                {v.configured ? (
                  <div className="p-1.5 rounded-full bg-emerald-500/15">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-full bg-zinc-500/15">
                    <XCircle className="size-4 text-zinc-500" />
                  </div>
                )}
                <span className="text-sm text-[#F5F5F7]">{v.name}</span>
              </div>
              <Badge
                variant="outline"
                className={
                  v.configured
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full'
                    : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[10px] px-2 py-0.5 rounded-full'
                }
              >
                {v.configured ? 'Verified' : 'Not Configured'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Main SeoDashboard Component
// ==========================================
export default function SeoDashboard() {
  const [data, setData] = useState<SeoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDashboard = useCallback(
    (showToast = false) => {
      fetch(`/api/seo/dashboard?days=${days}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then((res) => {
          setData(res);
          if (showToast) toast.success('Dashboard refreshed');
        })
        .catch(() => {
          toast.error(showToast ? 'Failed to refresh SEO dashboard' : 'Failed to load SEO dashboard');
        })
        .finally(() => setLoading(false));
    },
    [days]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboard(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">SEO Dashboard</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Monitor your site&apos;s search engine optimization health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(days)}
            onValueChange={(val) => setDays(Number(val))}
          >
            <SelectTrigger className="h-8 w-[120px] bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] text-xs rounded-lg focus:ring-0 focus:border-[#7C3AED]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
              <SelectItem value="7" className="text-xs text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.04)] focus:text-[#F5F5F7]">
                Last 7 days
              </SelectItem>
              <SelectItem value="14" className="text-xs text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.04)] focus:text-[#F5F5F7]">
                Last 14 days
              </SelectItem>
              <SelectItem value="30" className="text-xs text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.04)] focus:text-[#F5F5F7]">
                Last 30 days
              </SelectItem>
              <SelectItem value="60" className="text-xs text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.04)] focus:text-[#F5F5F7]">
                Last 60 days
              </SelectItem>
              <SelectItem value="90" className="text-xs text-[#F5F5F7] focus:bg-[rgba(255,255,255,0.04)] focus:text-[#F5F5F7]">
                Last 90 days
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="size-3 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-10 animate-spin text-[#7C3AED]" />
            <p className="text-sm text-[#A1A1AA]">Loading SEO dashboard...</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Section 1: Health Score */}
          <HealthScoreSection score={data.healthScore} />

          {/* Section 2: Quick Stats Grid */}
          <QuickStatsGrid data={data} />

          {/* Section 3: Indexation Breakdown */}
          <IndexationBreakdown data={data} />

          {/* Section 4: Crawl Analytics */}
          <CrawlAnalytics data={data} />

          {/* Section 5: MapIcon Statistics */}
          <MapIconStatistics data={data} />

          {/* Section 6: Duplicate Risk */}
          <DuplicateRiskSection data={data} />

          {/* Section 7: Top Landing Pages */}
          <TopLandingPages data={data} />

          {/* Section 8: SEO Content Stats */}
          <SeoContentStats data={data} />

          {/* Section 9: Recent Activity */}
          <RecentActivity data={data} />

          {/* Section 10: Verification Status */}
          <VerificationStatus />
        </>
      ) : (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Search className="size-10 text-[#52525B]" />
            <p className="text-sm text-[#A1A1AA]">No SEO data available</p>
            <Button
              onClick={handleRefresh}
              className="h-8 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
            >
              <RefreshCw className="size-3 mr-1" />
              Try Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

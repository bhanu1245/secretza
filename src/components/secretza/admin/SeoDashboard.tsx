'use client';

import { useState, useEffect, useCallback, type ComponentType } from 'react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  FileText,
  FileQuestion,
  ShieldCheck,
  Search,
  Activity,
  BarChart3,
  Layers,
  Bot,
  Map as MapIcon,
  Link2,
  RotateCcw,
} from 'lucide-react';
import type { SeoDashboardMetrics } from '@/lib/seo-dashboard-metrics';
import { SeoHealthOverviewWidget } from '@/components/secretza/admin/seo-dashboard-v2/SeoHealthOverviewWidget';
import { SeoRegenerationMonitorWidget } from '@/components/secretza/admin/seo-dashboard-v2/SeoRegenerationMonitorWidget';
import { SeoSitemapDashboardWidget } from '@/components/secretza/admin/seo-dashboard-v2/SeoSitemapDashboardWidget';

type DashboardData = SeoDashboardMetrics & { loadTimeMs?: number };

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getHealthColor(score: number) {
  if (score >= 80) return { color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: 'Excellent' };
  if (score >= 60) return { color: '#EAB308', bg: 'rgba(234,179,8,0.1)', label: 'Good' };
  if (score >= 40) return { color: '#F97316', bg: 'rgba(249,115,22,0.1)', label: 'Needs Improvement' };
  return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'Critical' };
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bg: string;
}) {
  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg" style={{ backgroundColor: bg }}>
            <Icon className="size-4" style={{ color }} />
          </div>
          <div>
            <p className="text-lg font-bold text-[#F5F5F7]">{value}</p>
            <p className="text-[10px] text-[#A1A1AA]">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionChart({
  title,
  data,
  colors,
}: {
  title: string;
  data: Array<{ bucket: string; count: number }>;
  colors: string[];
}) {
  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#F5F5F7]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="bucket" tick={{ fill: '#A1A1AA', fontSize: 10 }} />
            <YAxis tick={{ fill: '#A1A1AA', fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#15151D',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function SeoDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDashboard = useCallback(
    (showToast = false) => {
      setLoading(true);
      const started = performance.now();
      fetch(`/api/seo/dashboard?days=${days}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then((res: DashboardData) => {
          setData(res);
          const clientMs = Math.round(performance.now() - started);
          if (showToast) {
            toast.success(`Dashboard refreshed (${res.loadTimeMs ?? clientMs}ms server)`);
          }
        })
        .catch(() => {
          toast.error(showToast ? 'Failed to refresh SEO dashboard' : 'Failed to load SEO dashboard');
        })
        .finally(() => setLoading(false));
    },
    [days],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-10 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-24 text-[#A1A1AA]">
        <Search className="size-10 mx-auto mb-4 text-[#52525B]" />
        <p>No SEO dashboard data</p>
        <Button onClick={() => fetchDashboard(true)} className="mt-4">Retry</Button>
      </div>
    );
  }

  const health = getHealthColor(data.healthScore);
  const issues = data.contentIssues;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">SEO Dashboard</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Live database metrics · loaded in {data.loadTimeMs ?? '—'}ms
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-[120px] bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)]">
              {[7, 14, 30, 60, 90].map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setLoading(true); fetchDashboard(true); }} disabled={loading} size="sm">
            {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : <RefreshCw className="size-3 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* V2 Widget: Health & Top-level metrics */}
      <SeoHealthOverviewWidget data={data} />

      {/* Quality averages */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Avg SEO Score" value={data.quality.avgSeoScore} icon={Activity} color="#7C3AED" bg="rgba(124,58,237,0.1)" />
        <StatCard label="Avg Uniqueness" value={data.quality.avgUniqueness} icon={Copy} color="#3B82F6" bg="rgba(59,130,246,0.1)" />
        <StatCard label="Avg Word Count" value={formatNumber(data.quality.avgWordCount)} icon={FileText} color="#10B981" bg="rgba(16,185,129,0.1)" />
        <StatCard label="Avg FAQ Count" value={data.quality.avgFaqCount} icon={FileQuestion} color="#F59E0B" bg="rgba(245,158,11,0.1)" />
        <StatCard label="Avg Internal Links" value={data.quality.avgInternalLinks} icon={Link2} color="#8B5CF6" bg="rgba(139,92,246,0.1)" />
      </div>

      {/* Risk counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Low Risk" value={formatNumber(data.risk.low)} icon={CheckCircle2} color="#10B981" bg="rgba(16,185,129,0.1)" />
        <StatCard label="Medium Risk" value={formatNumber(data.risk.medium)} icon={AlertTriangle} color="#F59E0B" bg="rgba(245,158,11,0.1)" />
        <StatCard label="High Risk" value={formatNumber(data.risk.high)} icon={XCircle} color="#EF4444" bg="rgba(239,68,68,0.1)" />
        <StatCard label="Unscored Risk" value={formatNumber(data.risk.unscored)} icon={Clock} color="#71717A" bg="rgba(113,113,122,0.1)" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistributionChart
          title="SEO Quality Distribution"
          data={data.charts.qualityDistribution}
          colors={['#EF4444', '#F97316', '#EAB308', '#10B981']}
        />
        <DistributionChart
          title="Duplicate Risk Distribution"
          data={data.charts.duplicateRiskDistribution}
          colors={['#10B981', '#F59E0B', '#EF4444', '#71717A']}
        />
        <DistributionChart
          title="Word Count Distribution"
          data={data.charts.wordCountDistribution}
          colors={['#EF4444', '#F59E0B', '#3B82F6', '#10B981']}
        />
        <DistributionChart
          title="Regeneration History (pages per run)"
          data={data.charts.regenerationHistory.map((r) => ({ bucket: r.date, count: r.pages }))}
          colors={['#7C3AED']}
        />
      </div>

      {/* Content issues + duplicates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Content & Metadata Issues</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            {[
              [`Below ${issues.minWordCount} words`, issues.belowMinWords],
              ['Missing meta description', issues.missingMetaDescription],
              ['Missing H1', issues.missingH1],
              ['Missing canonical', issues.missingCanonical],
              ['Missing featured image', issues.missingFeaturedImage],
              ['Missing FAQ', issues.missingFaq],
              ['Missing structured data', issues.missingStructuredData],
              [`Missing internal links (<${issues.minInternalLinks})`, issues.missingInternalLinks],
            ].map(([label, count]) => (
              <div key={String(label)} className="flex justify-between p-2 rounded bg-[#1E1E2A]">
                <span className="text-[#A1A1AA]">{label}</span>
                <span className="font-bold text-[#F5F5F7]">{count as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Duplicate Field Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[
              ['Duplicate title groups', data.duplicates.titleGroups, data.duplicates.pagesWithDuplicateTitle],
              ['Duplicate meta groups', data.duplicates.metaGroups, data.duplicates.pagesWithDuplicateMeta],
              ['Duplicate H1 groups', data.duplicates.h1Groups, data.duplicates.pagesWithDuplicateH1],
              ['Duplicate content groups', data.duplicates.contentHashGroups, data.duplicates.pagesWithDuplicateContent],
            ].map(([label, groups, pages]) => (
              <div key={String(label)} className="flex justify-between p-2 rounded bg-[#1E1E2A]">
                <span className="text-[#A1A1AA]">{label as string}</span>
                <span className="text-[#F5F5F7]">
                  <strong>{groups as number}</strong> groups · <strong>{pages as number}</strong> pages
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Audit summary */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <BarChart3 className="size-4" /> Audit Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div><p className="text-[#A1A1AA] text-xs">Pages audited</p><p className="text-xl font-bold">{formatNumber(data.auditSummary.totalPages)}</p></div>
          <div><p className="text-[#A1A1AA] text-xs">Below min words</p><p className="text-xl font-bold">{formatNumber(data.auditSummary.belowMinWords)}</p></div>
          <div><p className="text-[#A1A1AA] text-xs">Avg quality</p><p className="text-xl font-bold">{data.auditSummary.avgQuality}</p></div>
          <div><p className="text-[#A1A1AA] text-xs">Low risk</p><p className="text-xl font-bold text-emerald-400">{formatNumber(data.auditSummary.lowRisk)}</p></div>
          <div><p className="text-[#A1A1AA] text-xs">Medium risk</p><p className="text-xl font-bold text-amber-400">{formatNumber(data.auditSummary.mediumRisk)}</p></div>
          <div><p className="text-[#A1A1AA] text-xs">High risk</p><p className="text-xl font-bold text-red-400">{formatNumber(data.auditSummary.highRisk)}</p></div>
        </CardContent>
      </Card>

      {/* V2 Widget: Regeneration Monitor */}
      <div className="lg:col-span-full">
        <h2 className="text-lg font-bold text-[#F5F5F7] mt-8 mb-4 flex items-center gap-2">
          <RotateCcw className="size-5" /> SEO Regeneration Monitor
        </h2>
        <SeoRegenerationMonitorWidget />
      </div>

      {/* Duplicate risk pages */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7]">High / Medium Duplicate Risk Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {data.duplicateRiskPages.length === 0 ? (
            <p className="text-sm text-[#52525B] text-center py-6">No medium/high risk pages in database</p>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#A1A1AA] border-b border-[rgba(255,255,255,0.06)]">
                    <th className="text-left py-2">Slug</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Risk</th>
                    <th className="text-right py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duplicateRiskPages.map((p, i) => (
                    <tr key={i} className="border-b border-[rgba(255,255,255,0.04)]">
                      <td className="py-2 font-mono text-[#F5F5F7]">{p.slug}</td>
                      <td className="py-2 text-[#A1A1AA]">{p.type}</td>
                      <td className="py-2"><Badge variant="outline" className={getRiskBadge(p.risk)}>{p.risk}</Badge></td>
                      <td className="py-2 text-right">{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently updated */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7]">Recently Updated SEO Pages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentlyUpdated.map((p, i) => (
            <div key={i} className="flex justify-between items-center p-2 rounded bg-[#1E1E2A] text-xs">
              <span className="text-[#F5F5F7] font-mono">{p.pageType}/{p.pageSlug}</span>
              <span className="text-[#A1A1AA]">{formatTimeAgo(p.updatedAt)} · score {p.seoQualityScore ?? '—'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Indexation */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <Layers className="size-4" /> Indexation ({data.indexation.total} pages scored)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-[#A1A1AA]">
          Indexed: {data.indexation.indexed} · Noindex: {data.indexation.noindexed} · Low confidence: {data.indexation.lowConfidence}
        </CardContent>
      </Card>

      {/* Crawl summary */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <Bot className="size-4" /> Crawl Analytics (last {days} days)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-[#A1A1AA]">
          Total crawls: {formatNumber(data.crawl.totalCrawls)} · Googlebot: {formatNumber(data.crawl.googlebotCrawls)} · Bot crawls: {formatNumber(data.crawl.botCrawls)}
        </CardContent>
      </Card>

      {/* V2 Widget: Sitemap Dashboard */}
      <div className="lg:col-span-full">
        <h2 className="text-lg font-bold text-[#F5F5F7] mt-8 mb-4 flex items-center gap-2">
          <MapIcon className="size-5" /> Sitemap Dashboard
        </h2>
        <SeoSitemapDashboardWidget />
      </div>

      {/* Recent activity */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <Clock className="size-4" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-64 overflow-y-auto">
          {data.recentActivity.map((e, i) => (
            <div key={i} className="text-xs flex justify-between gap-2">
              <span className="text-[#F5F5F7]">{e.message}</span>
              <span className="text-[#52525B] shrink-0">{formatTimeAgo(e.timestamp)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Verification */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#F5F5F7] flex items-center gap-2">
            <ShieldCheck className="size-4" /> Search Engine Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.verifications.map((v) => (
            <div key={v.name} className="flex items-center justify-between p-2 rounded bg-[#1E1E2A] text-sm">
              <span>{v.name}</span>
              <Badge variant="outline" className={v.configured ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-400'}>
                {v.configured ? 'Configured' : 'Not configured'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

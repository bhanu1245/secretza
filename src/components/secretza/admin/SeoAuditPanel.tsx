'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { getSeoPagePublicUrl } from '@/lib/seo-public-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImageIcon,
  Link2,
  HelpCircle,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';

interface AuditPage {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  featuredImageUrl?: string;
  ogImageUrl?: string;
  imageAlt?: string | null;
  wordCount?: number | null;
  faqCount?: number | null;
  internalLinksCount?: number | null;
  uniquenessScore?: number | null;
  duplicateRisk?: string | null;
  seoQualityScore?: number | null;
  isPublished: boolean;
  noindex: boolean;
}

interface AuditSummary {
  totalPages: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  belowMinWords: number;
  avgQuality: { seoQualityScore: number | null };
  minWordCount: number;
}

interface AuditResponse {
  pages: AuditPage[];
  total: number;
  page: number;
  totalPages: number;
  summary: AuditSummary;
}

function riskBadge(risk: string | null | undefined) {
  const r = (risk ?? 'unknown').toLowerCase();
  if (r === 'low') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Low</Badge>;
  if (r === 'medium') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Medium</Badge>;
  if (r === 'high') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return 'text-zinc-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export default function SeoAuditPanel() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageType, setPageType] = useState<string>('all');
  const [duplicateRisk, setDuplicateRisk] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (pageType !== 'all') params.set('pageType', pageType);
      if (duplicateRisk !== 'all') params.set('duplicateRisk', duplicateRisk);
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch(`/api/seo/audit?${params}`);
      if (!res.ok) throw new Error('Failed to load audit');
      setData(await res.json());
    } catch {
      toast.error('Failed to load SEO audit data');
    } finally {
      setLoading(false);
    }
  }, [page, pageType, duplicateRisk, search]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#F5F5F7]">SEO Content Audit</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Uniqueness scores, duplicate risk, word counts, and metadata completeness
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAudit} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-4">
              <p className="text-xs text-[#A1A1AA]">Total Pages</p>
              <p className="text-2xl font-bold text-[#F5F5F7]">{summary.totalPages}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-4">
              <p className="text-xs text-[#A1A1AA]">Avg Quality</p>
              <p className={`text-2xl font-bold ${scoreColor(summary.avgQuality.seoQualityScore ?? 0)}`}>
                {summary.avgQuality.seoQualityScore?.toFixed(0) ?? '—'}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-400">Low Risk</p>
              <p className="text-2xl font-bold text-emerald-400">{summary.lowRisk}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-4">
              <p className="text-xs text-amber-400">Medium Risk</p>
              <p className="text-2xl font-bold text-amber-400">{summary.mediumRisk}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-4">
              <p className="text-xs text-red-400">High Risk</p>
              <p className="text-2xl font-bold text-red-400">{summary.highRisk}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-4">
              <p className="text-xs text-[#A1A1AA]">&lt; {summary.minWordCount} words</p>
              <p className="text-2xl font-bold text-amber-400">{summary.belowMinWords}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            placeholder="Search slug, title, H1…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-[#141419] border-[rgba(255,255,255,0.08)]"
          />
        </div>
        <Select value={pageType} onValueChange={(v) => { setPageType(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="city">City</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="category_city">Category+City</SelectItem>
            <SelectItem value="state">State</SelectItem>
            <SelectItem value="country">Country</SelectItem>
            <SelectItem value="longtail">Longtail</SelectItem>
          </SelectContent>
        </Select>
        <Select value={duplicateRisk} onValueChange={(v) => { setDuplicateRisk(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-[#141419] border-[rgba(255,255,255,0.08)]">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.pages.map((p) => {
            const expanded = expandedId === p.id;
            const publicUrl = getSeoPagePublicUrl({ pageType: p.pageType, pageSlug: p.pageSlug, canonicalUrl: p.canonicalUrl });
            const wordOk = (p.wordCount ?? 0) >= (summary?.minWordCount ?? 500);

            return (
              <Card key={p.id} className="bg-[#141419] border-[rgba(255,255,255,0.08)] overflow-hidden">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-[rgba(255,255,255,0.02)]"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{p.pageType}</Badge>
                        <span className="text-sm font-medium text-[#F5F5F7] truncate">{p.pageSlug}</span>
                        {riskBadge(p.duplicateRisk)}
                        {!wordOk && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                            Short content
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#A1A1AA] truncate">{p.title ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${scoreColor(p.seoQualityScore)}`}>
                          {p.seoQualityScore?.toFixed(0) ?? '—'}
                        </p>
                        <p className="text-[10px] text-[#A1A1AA]">SEO score</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#8B5CF6]">
                          {p.uniquenessScore?.toFixed(0) ?? '—'}%
                        </p>
                        <p className="text-[10px] text-[#A1A1AA]">Unique</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {expanded && (
                  <CardContent className="px-4 pb-4 pt-0 border-t border-[rgba(255,255,255,0.06)]">
                    <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
                      <AuditField icon={FileText} label="Title" value={p.title} />
                      <AuditField icon={FileText} label="H1" value={p.h1} />
                      <AuditField icon={FileText} label="Meta Description" value={p.metaDescription} className="md:col-span-2" />
                      <AuditField icon={Link2} label="Canonical" value={p.canonicalUrl} />
                      <AuditField icon={ImageIcon} label="OG / Featured Image" value={p.ogImageUrl ?? p.featuredImageUrl ?? '—'} />
                      <AuditField icon={ImageIcon} label="Twitter Image" value={p.ogImageUrl ?? 'Same as OG'} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <MetricPill icon={FileText} label="Word Count" value={String(p.wordCount ?? 0)} ok={wordOk} />
                      <MetricPill icon={HelpCircle} label="FAQ Count" value={String(p.faqCount ?? 0)} ok={(p.faqCount ?? 0) >= 5} />
                      <MetricPill icon={Link2} label="Internal Links" value={String(p.internalLinksCount ?? 0)} ok={(p.internalLinksCount ?? 0) >= 5} />
                      <MetricPill icon={BarChart3} label="Uniqueness" value={`${p.uniquenessScore?.toFixed(0) ?? 0}%`} ok={(p.uniquenessScore ?? 0) >= 70} />
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" asChild>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3 mr-1" /> View Page
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {data && data.pages.length === 0 && (
            <p className="text-center text-[#A1A1AA] py-8">No pages match your filters.</p>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-[#A1A1AA]">
                Page {data.page} of {data.totalPages} ({data.total} total)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditField({
  icon: Icon,
  label,
  value,
  className = '',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-[#A1A1AA] text-xs mb-1">
        <Icon className="size-3" /> {label}
      </div>
      <p className="text-[#F5F5F7] text-xs break-words">{value ?? '—'}</p>
    </div>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.06)] p-3">
      <div className="flex items-center justify-between mb-1">
        <Icon className="size-3.5 text-[#A1A1AA]" />
        {ok ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <AlertTriangle className="size-3.5 text-amber-400" />}
      </div>
      <p className="text-lg font-semibold text-[#F5F5F7]">{value}</p>
      <p className="text-[10px] text-[#A1A1AA]">{label}</p>
    </div>
  );
}

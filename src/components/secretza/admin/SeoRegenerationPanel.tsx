'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Loader2,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  History,
  Undo2,
  FlaskConical,
} from 'lucide-react';

type RegenerationMode =
  | 'all'
  | 'selected_cities'
  | 'duplicate_risk'
  | 'low_score'
  | 'below_words';

interface RunProgress {
  id: string;
  status: string;
  mode: string;
  dryRun: boolean;
  confirmed: boolean;
  batchSize: number;
  totalPages: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  remaining: number;
  avgUniqueness: number | null;
  avgSeoScore: number | null;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  createdByEmail: string | null;
  errorMessage: string | null;
}

interface RunReport {
  pagesUpdated: number;
  pagesSkipped: number;
  failures: number;
  averageUniqueness: number | null;
  averageSeoScore: number | null;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
}

interface RegenerationItem {
  id: string;
  pageSlug: string;
  pageType: string;
  status: string;
  predictedWords: number | null;
  predictedUnique: number | null;
  predictedScore: number | null;
  predictedRisk: string | null;
  error: string | null;
}

interface ContentVersion {
  id: string;
  pageSlug: string;
  pageType: string;
  title: string | null;
  wordCount: number | null;
  uniquenessScore: number | null;
  seoQualityScore: number | null;
  duplicateRisk: string | null;
  createdAt: string;
  rolledBackAt: string | null;
  createdByEmail: string | null;
}

const MODES: { value: RegenerationMode; label: string; description: string }[] = [
  { value: 'all', label: 'All Pages', description: 'Every SEO page matching the page type filter' },
  { value: 'selected_cities', label: 'Selected Cities', description: 'Comma-separated city slugs only' },
  { value: 'duplicate_risk', label: 'Duplicate-Risk Pages', description: 'Medium or high duplicate risk' },
  { value: 'low_score', label: 'Low-Score Pages', description: 'SEO quality score below threshold' },
  { value: 'below_words', label: 'Below 500 Words', description: 'Pages under minimum word count' },
];

const BATCH_SIZES = [10, 25, 50, 100];

function formatElapsed(ms: number | null) {
  if (ms == null) return '—';
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m ${sec % 60}s`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'dry_run_completed')
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
  if (s === 'processing' || s === 'queued')
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{status}</Badge>;
  if (s === 'awaiting_confirmation')
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Awaiting confirmation</Badge>;
  if (s === 'failed' || s === 'cancelled')
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function riskBadge(risk: string | null | undefined) {
  const r = (risk ?? 'unknown').toLowerCase();
  if (r === 'low') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">LOW</Badge>;
  if (r === 'medium') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">MEDIUM</Badge>;
  if (r === 'high') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">HIGH</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export default function SeoRegenerationPanel() {
  const [mode, setMode] = useState<RegenerationMode>('all');
  const [batchSize, setBatchSize] = useState(25);
  const [dryRun, setDryRun] = useState(true);
  const [pageTypeFilter, setPageTypeFilter] = useState('city');
  const [citySlugs, setCitySlugs] = useState('agra,ahmedabad,mumbai');
  const [lowScoreThreshold, setLowScoreThreshold] = useState(70);
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<RunProgress[]>([]);
  const [activeRun, setActiveRun] = useState<RunProgress | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [items, setItems] = useState<RegenerationItem[]>([]);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await apiFetch('/api/seo/regenerate?limit=20');
      if (!res.ok) throw new Error('Failed to load runs');
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch {
      toast.error('Failed to load regeneration runs');
    }
  }, []);

  const fetchRunDetail = useCallback(async (runId: string) => {
    try {
      const res = await apiFetch(`/api/seo/regenerate/${runId}`);
      if (!res.ok) throw new Error('Failed to load run');
      const data = await res.json();
      setActiveRun(data.run);
      setReport(data.report);
      setItems(data.items ?? []);
      setVersions(data.versions ?? []);
      return data.run as RunProgress;
    } catch {
      toast.error('Failed to load run details');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeRun) return;

    const active = ['queued', 'processing', 'awaiting_confirmation'].includes(activeRun.status);
    if (!active) return;

    pollRef.current = setInterval(() => {
      fetchRunDetail(activeRun.id);
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRun?.id, activeRun?.status, fetchRunDetail]);

  const buildPayload = () => ({
    mode,
    dryRun,
    confirmed: false,
    batchSize,
    pageTypeFilter: mode === 'selected_cities' ? 'city' : pageTypeFilter,
    citySlugs: mode === 'selected_cities'
      ? citySlugs.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    lowScoreThreshold: mode === 'low_score' ? lowScoreThreshold : undefined,
    duplicateRisks: mode === 'duplicate_risk' ? ['medium', 'high'] : undefined,
  });

  const startRun = async () => {
    setLoading(true);
    try {
      const endpoint = dryRun ? '/api/seo/regenerate/dry-run' : '/api/seo/regenerate';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start run');

      if (data.requiresConfirmation) {
        setActiveRun(data.run);
        setConfirmOpen(true);
        toast.info('Run queued — confirm before writes are applied');
      } else {
        setActiveRun(data.run);
        setReport(data.report);
        toast.success(dryRun ? 'Dry run completed' : 'Regeneration completed');
      }
      await fetchRuns();
      if (data.run?.id) await fetchRunDetail(data.run.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start run');
    } finally {
      setLoading(false);
    }
  };

  const confirmRun = async () => {
    if (!activeRun) return;
    setLoading(true);
    setConfirmOpen(false);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Confirm failed');
      setActiveRun(data.run);
      setReport(data.report);
      toast.success('Regeneration confirmed and processing');
      await fetchRuns();
      await fetchRunDetail(activeRun.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setLoading(false);
    }
  };

  const resumeRun = async () => {
    if (!activeRun) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ untilDone: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Resume failed');
      setActiveRun(data.run);
      setReport(data.report);
      toast.success('Processing resumed');
      await fetchRunDetail(activeRun.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Resume failed');
    } finally {
      setLoading(false);
    }
  };

  const cancelRun = async () => {
    if (!activeRun) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error('Cancel failed');
      setActiveRun(data.run);
      toast.success('Run cancelled');
      await fetchRuns();
    } catch {
      toast.error('Failed to cancel run');
    } finally {
      setLoading(false);
    }
  };

  const rollbackRun = async () => {
    if (!activeRun || !confirm('Rollback all pages from this run?')) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/${activeRun.id}/rollback`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Rollback failed');
      toast.success(`Rolled back ${data.rolledBack} page(s)`);
      await fetchRunDetail(activeRun.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  const rollbackVersion = async (versionId: string) => {
    if (!confirm('Rollback this page to the saved version?')) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/seo/regenerate/rollback/${versionId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Rollback failed');
      toast.success(`Rolled back ${data.pageSlug}`);
      if (activeRun) await fetchRunDetail(activeRun.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  const progress = activeRun;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#F5F5F7]">SEO Content Regeneration</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Bulk regenerate with dry-run preview, queue processing, version history, and rollback
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7] flex items-center gap-2">
              <Zap className="size-5 text-amber-400" />
              Regeneration Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as RegenerationMode)}>
                <SelectTrigger className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#71717A]">
                {MODES.find((m) => m.value === mode)?.description}
              </p>
            </div>

            {mode === 'selected_cities' && (
              <div className="space-y-2">
                <Label>City slugs (comma-separated)</Label>
                <Input
                  value={citySlugs}
                  onChange={(e) => setCitySlugs(e.target.value)}
                  placeholder="agra,ahmedabad,mumbai"
                  className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)]"
                />
              </div>
            )}

            {mode !== 'selected_cities' && (
              <div className="space-y-2">
                <Label>Page type filter</Label>
                <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                  <SelectTrigger className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="city">City</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="category_city">Category + City</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="longtail">Long-tail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === 'low_score' && (
              <div className="space-y-2">
                <Label>Low score threshold</Label>
                <Input
                  type="number"
                  value={lowScoreThreshold}
                  onChange={(e) => setLowScoreThreshold(Number(e.target.value))}
                  className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Batch size</Label>
              <div className="flex gap-2">
                {BATCH_SIZES.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={batchSize === size ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBatchSize(size)}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] p-3">
              <div>
                <Label htmlFor="dry-run" className="flex items-center gap-2">
                  <FlaskConical className="size-4 text-blue-400" />
                  Dry run mode
                </Label>
                <p className="text-xs text-[#71717A] mt-1">
                  Generate without saving — shows predicted scores only
                </p>
              </div>
              <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
            </div>

            {!dryRun && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-200">
                  Live regeneration requires explicit confirmation before any pages are written.
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={startRun}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : dryRun ? (
                <FlaskConical className="size-4 mr-2" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              {dryRun ? 'Start Dry Run' : 'Queue Live Regeneration'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7] flex items-center gap-2">
              <Clock className="size-5 text-blue-400" />
              Progress Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!progress ? (
              <p className="text-sm text-[#71717A]">Start a run to see progress here.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#A1A1AA]">Status</span>
                  {statusBadge(progress.status)}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: progress.totalPages },
                    { label: 'Queued', value: progress.queued },
                    { label: 'Processing', value: progress.processing },
                    { label: 'Completed', value: progress.completed },
                    { label: 'Failed', value: progress.failed },
                    { label: 'Skipped', value: progress.skipped },
                    { label: 'Remaining', value: progress.remaining },
                    { label: 'Elapsed', value: formatElapsed(progress.elapsedMs) },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-[#0B0B0F] p-3">
                      <p className="text-xs text-[#71717A]">{stat.label}</p>
                      <p className="text-lg font-semibold text-[#F5F5F7]">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {(progress.avgUniqueness != null || progress.avgSeoScore != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-[#0B0B0F] p-3">
                      <p className="text-xs text-[#71717A]">Avg Uniqueness</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {progress.avgUniqueness?.toFixed(1) ?? '—'}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#0B0B0F] p-3">
                      <p className="text-xs text-[#71717A]">Avg SEO Score</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {progress.avgSeoScore?.toFixed(1) ?? '—'}%
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-emerald-400">LOW: {progress.lowRiskCount}</span>
                  <span className="text-xs text-amber-400">MEDIUM: {progress.mediumRiskCount}</span>
                  <span className="text-xs text-red-400">HIGH: {progress.highRiskCount}</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {progress.status === 'awaiting_confirmation' && (
                    <Button size="sm" onClick={() => setConfirmOpen(true)}>
                      <CheckCircle2 className="size-4 mr-1" />
                      Confirm &amp; Write
                    </Button>
                  )}
                  {['queued', 'processing'].includes(progress.status) && (
                    <>
                      <Button size="sm" variant="outline" onClick={resumeRun} disabled={loading}>
                        <RotateCcw className="size-4 mr-1" />
                        Resume
                      </Button>
                      <Button size="sm" variant="destructive" onClick={cancelRun} disabled={loading}>
                        Cancel
                      </Button>
                    </>
                  )}
                  {progress.status === 'completed' && !progress.dryRun && (
                    <Button size="sm" variant="outline" onClick={rollbackRun} disabled={loading}>
                      <Undo2 className="size-4 mr-1" />
                      Rollback Run
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {report && (
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7]">Regeneration Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><span className="text-[#71717A]">Updated</span><p className="font-semibold text-[#F5F5F7]">{report.pagesUpdated}</p></div>
              <div><span className="text-[#71717A]">Skipped</span><p className="font-semibold text-[#F5F5F7]">{report.pagesSkipped}</p></div>
              <div><span className="text-[#71717A]">Failures</span><p className="font-semibold text-red-400">{report.failures}</p></div>
              <div><span className="text-[#71717A]">Avg Uniqueness</span><p className="font-semibold text-emerald-400">{report.averageUniqueness?.toFixed(1) ?? '—'}%</p></div>
              <div><span className="text-[#71717A]">Avg SEO Score</span><p className="font-semibold text-emerald-400">{report.averageSeoScore?.toFixed(1) ?? '—'}%</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7]">Recent Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#71717A] border-b border-[rgba(255,255,255,0.08)]">
                    <th className="pb-2 pr-4">Page</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Words</th>
                    <th className="pb-2 pr-4">Unique</th>
                    <th className="pb-2 pr-4">SEO</th>
                    <th className="pb-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[rgba(255,255,255,0.04)]">
                      <td className="py-2 pr-4 text-[#F5F5F7]">{item.pageSlug}</td>
                      <td className="py-2 pr-4">{item.status}</td>
                      <td className="py-2 pr-4">{item.predictedWords ?? '—'}</td>
                      <td className="py-2 pr-4">{item.predictedUnique?.toFixed(0) ?? '—'}%</td>
                      <td className="py-2 pr-4">{item.predictedScore?.toFixed(0) ?? '—'}%</td>
                      <td className="py-2">{riskBadge(item.predictedRisk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {versions.length > 0 && (
        <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F7] flex items-center gap-2">
              <History className="size-5" />
              Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[240px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#71717A] border-b border-[rgba(255,255,255,0.08)]">
                    <th className="pb-2 pr-4">Page</th>
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Words</th>
                    <th className="pb-2 pr-4">Saved</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="border-b border-[rgba(255,255,255,0.04)]">
                      <td className="py-2 pr-4 text-[#F5F5F7]">{v.pageSlug}</td>
                      <td className="py-2 pr-4 text-[#A1A1AA] truncate max-w-[200px]">{v.title ?? '—'}</td>
                      <td className="py-2 pr-4">{v.wordCount ?? '—'}</td>
                      <td className="py-2 pr-4 text-xs text-[#71717A]">
                        {new Date(v.createdAt).toLocaleString()}
                        {v.rolledBackAt && ' (rolled back)'}
                      </td>
                      <td className="py-2">
                        {!v.rolledBackAt && (
                          <Button size="sm" variant="ghost" onClick={() => rollbackVersion(v.id)} disabled={loading}>
                            <Undo2 className="size-3 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
        <CardHeader>
          <CardTitle className="text-[#F5F5F7]">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-[#71717A]">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => fetchRunDetail(run.id)}
                  className="w-full flex items-center justify-between rounded-lg bg-[#0B0B0F] p-3 text-left hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F7]">
                      {run.mode} · {run.dryRun ? 'DRY RUN' : 'LIVE'} · {run.totalPages} pages
                    </p>
                    <p className="text-xs text-[#71717A]">{run.createdByEmail ?? 'system'}</p>
                  </div>
                  {statusBadge(run.status)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#141419] border-[rgba(255,255,255,0.08)]">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Confirm Live Regeneration</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              You are about to write regenerated content to{' '}
              <strong>{activeRun?.totalPages ?? 0}</strong> pages. Previous content will be
              snapshotted for rollback. This action cannot be undone without rollback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmRun} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Yes, regenerate all pages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

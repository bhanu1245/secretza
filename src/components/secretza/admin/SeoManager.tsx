'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch, fetchCsrfToken } from '@/lib/api-client';
import { getSeoPagePublicUrl } from '@/lib/seo-public-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import AiGenerateButton from '@/components/secretza/seo/AiGenerateButton';
import SeoQualityMeter from '@/components/secretza/seo/SeoQualityMeter';
import AdminSeoGranularTools, {
  SeoGranularTriggerButtons,
  type SeoGranularMode,
} from '@/components/secretza/admin/AdminSeoGranularTools';
import AdminSeoKeywordGenerator, {
  SeoKeywordGeneratorTrigger,
} from '@/components/secretza/admin/AdminSeoKeywordGenerator';
import AdminSeoAdvancedGenerators, {
  SeoAdvancedGeneratorTriggers,
  type AdvancedGeneratorMode,
} from '@/components/secretza/admin/AdminSeoAdvancedGenerators';
import AdminSeoUrlRepair, {
  SeoUrlRepairTrigger,
} from '@/components/secretza/admin/AdminSeoUrlRepair';
import { useSeoQualityScore } from '@/hooks/useSeoQualityScore';
import { useTrackEvent } from '@/components/providers/AnalyticsProvider';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileQuestion,
  Globe,
  MapPin,
  Tag,
  LayoutGrid,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowUpDown,
  Loader2,
  CheckCircle,
  XCircle,
  Landmark,
  Flag,
  Zap,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ExternalLink,
} from 'lucide-react';

// ==========================================
// Types
// ==========================================
interface SeoPage {
  id: string;
  pageType: string;
  pageSlug: string;
  title: string;
  metaDescription: string | null;
  h1: string | null;
  introContent: string | null;
  noindex: boolean;
  canonicalUrl: string | null;
  isPublished: boolean;
  customData?: string | null;
  featuredImage?: string | null;
  featuredImageUrl?: string;
  imageAlt?: string | null;
  imageTitle?: string | null;
  imageCaption?: string | null;
  ogImageUrl?: string;
  faqs?: SeoFaq[];
  createdAt: string;
  updatedAt: string;
}

interface SeoFaq {
  id: string;
  seoPageId: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

interface SeoPagesResponse {
  pages: SeoPage[];
  total: number;
  page: number;
  totalPages: number;
}

interface SeoCityOption {
  id: string;
  slug: string;
  name: string;
  state?: { name: string; slug: string } | null;
}

interface SeoTypeStats {
  city: number;
  category: number;
  category_city: number;
  state: number;
  country: number;
  longtail: number;
  total: number;
}

type GenerateType = 'city' | 'category' | 'category_city' | 'state' | 'country' | 'longtail';

interface GenProgress {
  type: GenerateType;
  label: string;
  generated: number;
  skipped: number;
  total: number;
  totalMissing: number;
  batchCount: number;
  failed: number;
  isRunning: boolean;
}

type PageTypeOption = 'all' | 'city' | 'category' | 'category_city' | 'state' | 'country' | 'longtail';

const PAGE_TYPE_OPTIONS: { value: PageTypeOption; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'city', label: 'City' },
  { value: 'category', label: 'Category' },
  { value: 'category_city', label: 'Category+City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'longtail', label: 'Longtail' },
];

const PAGE_TYPE_COLORS: Record<string, string> = {
  city: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  category: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  category_city: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  state: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  country: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  longtail: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

const PAGE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  city: MapPin,
  category: Tag,
  category_city: LayoutGrid,
  state: Landmark,
  country: Flag,
  longtail: Zap,
};

// ==========================================
// SeoManager Component
// ==========================================
export default function SeoManager() {
  // List state
  const [pages, setPages] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageType, setPageType] = useState<PageTypeOption>('all');
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('search') || '';
    }
    return '';
  });
  const [isPublishedFilter, setIsPublishedFilter] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Edit page modal state
  const [editPage, setEditPage] = useState<SeoPage | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    metaDescription: '',
    h1: '',
    introContent: '',
    noindex: false,
    isPublished: true,
    canonicalUrl: '',
    schemaJson: '',
    featuredImage: '',
    imageAlt: '',
    imageTitle: '',
    imageCaption: '',
  });
  const [saving, setSaving] = useState(false);
  const trackEvent = useTrackEvent();
  const { result: editScore, loading: editScoreLoading } = useSeoQualityScore(
    {
      title: editForm.title,
      metaDescription: editForm.metaDescription,
      h1: editForm.h1,
      introContent: editForm.introContent,
      canonicalUrl: editForm.canonicalUrl,
      featuredImage: editForm.featuredImage,
    },
    {
      fetchUniqueness: Boolean(editPage),
      pageType: editPage?.pageType,
      pageSlug: editPage?.pageSlug,
      debounceMs: 600,
    },
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState(false);

  // Create page modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    pageType: 'city' as GenerateType,
    pageSlug: '',
    title: '',
    metaDescription: '',
    h1: '',
    introContent: '',
    canonicalUrl: '',
    schemaJson: '',
    isPublished: true,
    noindex: false,
    featuredImage: '',
    imageAlt: '',
    imageTitle: '',
    imageCaption: '',
  });
  const [creating, setCreating] = useState(false);

  // FAQ manager state
  const [faqPage, setFaqPage] = useState<SeoPage | null>(null);
  const [faqs, setFaqs] = useState<SeoFaq[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);

  // FAQ edit modal
  const [editFaq, setEditFaq] = useState<SeoFaq | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', sortOrder: 0 });
  const [savingFaq, setSavingFaq] = useState(false);
  const [isAddFaq, setIsAddFaq] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'page' | 'faq'; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk generate state
  const [batchSize, setBatchSize] = useState(100);
  const [processAllMissing, setProcessAllMissing] = useState(true);
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [granularMode, setGranularMode] = useState<SeoGranularMode | null>(null);
  const [keywordGeneratorOpen, setKeywordGeneratorOpen] = useState(false);
  const [advancedGeneratorMode, setAdvancedGeneratorMode] = useState<AdvancedGeneratorMode>(null);
  const [urlRepairOpen, setUrlRepairOpen] = useState(false);
  const [typeStats, setTypeStats] = useState<SeoTypeStats>({
    city: 0,
    category: 0,
    category_city: 0,
    state: 0,
    country: 0,
    longtail: 0,
    total: 0,
  });

  // City intro editor state
  const [cityIntroModal, setCityIntroModal] = useState<{ city: string; slug: string; content: string; id?: string } | null>(null);
  const [savingCityIntro, setSavingCityIntro] = useState(false);
  const [cityOptions, setCityOptions] = useState<SeoCityOption[]>([]);
  const [loadingCityOptions, setLoadingCityOptions] = useState(false);

  // ==========================================
  // Fetch SEO Pages
  // ==========================================
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/seo/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTypeStats({
          city: data.counts?.city ?? 0,
          category: data.counts?.category ?? 0,
          category_city: data.counts?.category_city ?? 0,
          state: data.counts?.state ?? 0,
          country: data.counts?.country ?? 0,
          longtail: data.counts?.longtail ?? 0,
          total: data.total ?? 0,
        });
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pageType !== 'all') params.set('pageType', pageType);
      if (search) params.set('search', search);
      if (isPublishedFilter !== null) params.set('isPublished', String(isPublishedFilter));
      params.set('page', String(currentPage));
      params.set('limit', String(limit));
      const res = await fetch(`/api/seo/pages?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data: SeoPagesResponse = await res.json();
        setPages(data.pages);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      toast.error('Failed to fetch SEO pages');
    } finally {
      setLoading(false);
    }
  }, [pageType, search, isPublishedFilter, currentPage]);

  useEffect(() => {
    fetchCsrfToken().catch(() => {
      // Fetched again on first mutation
    });
  }, []);

  useEffect(() => {
    fetchPages();
    fetchStats();
  }, [fetchPages, fetchStats]);

  const loadCityOptions = useCallback(async () => {
    setLoadingCityOptions(true);
    try {
      const res = await apiFetch('/api/seo/cities?limit=50');
      if (res.ok) {
        const data = await res.json();
        setCityOptions(data.cities || []);
      } else {
        toast.error('Failed to load cities from database');
      }
    } catch {
      toast.error('Failed to load cities from database');
    } finally {
      setLoadingCityOptions(false);
    }
  }, []);

  // ==========================================
  // Edit Page Handlers
  // ==========================================
  const openEditPage = (page: SeoPage) => {
    setEditPage(page);
    setEditForm({
      title: page.title || '',
      metaDescription: page.metaDescription || '',
      h1: page.h1 || '',
      introContent: page.introContent || '',
      noindex: page.noindex,
      isPublished: page.isPublished,
      canonicalUrl: page.canonicalUrl || '',
      schemaJson: page.customData || '',
      featuredImage: page.featuredImage || '',
      imageAlt: page.imageAlt || '',
      imageTitle: page.imageTitle || '',
      imageCaption: page.imageCaption || '',
    });
  };

  const uploadSeoImageFile = async (
    file: File,
    pageType: string,
    pageSlug: string,
  ): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pageType', pageType);
      formData.append('pageSlug', pageSlug);
      const res = await apiFetch('/api/upload/seo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload SEO image');
        return null;
      }
      toast.success('SEO image uploaded');
      return data.url || data.key || null;
    } catch {
      toast.error('Failed to upload SEO image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGeneratePageImage = async (page: SeoPage) => {
    setGeneratingImageId(page.id);
    try {
      const res = await apiFetch('/api/seo/generate-image', {
        method: 'POST',
        body: JSON.stringify({ pageId: page.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate SEO image');
        return;
      }
      toast.success('SEO image generated');
      fetchPages();
      if (editPage?.id === page.id) {
        setEditForm((f) => ({
          ...f,
          featuredImage: data.featuredImage || f.featuredImage,
          imageAlt: data.imageAlt || f.imageAlt,
        }));
      }
    } catch {
      toast.error('Failed to generate SEO image');
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleGenerateMissingImages = async () => {
    setGeneratingImages(true);
    try {
      const res = await apiFetch('/api/seo/generate-image', {
        method: 'POST',
        body: JSON.stringify({
          limit: 500,
          type: pageType !== 'all' ? pageType : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate SEO images');
        return;
      }
      toast.success(data.message || `Generated ${data.updated} image(s)`);
      fetchPages();
    } catch {
      toast.error('Failed to generate SEO images');
    } finally {
      setGeneratingImages(false);
    }
  };

  const handleSavePage = async () => {
    if (!editPage) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/seo/pages/${editPage.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title,
          metaDescription: editForm.metaDescription,
          h1: editForm.h1,
          introContent: editForm.introContent,
          noindex: editForm.noindex,
          isPublished: editForm.isPublished,
          canonicalUrl: editForm.canonicalUrl || null,
          customData: editForm.schemaJson || null,
          featuredImage: editForm.featuredImage || null,
          imageAlt: editForm.imageAlt || null,
          imageTitle: editForm.imageTitle || null,
          imageCaption: editForm.imageCaption || null,
        }),
      });
      if (res.ok) {
        toast.success('SEO page updated successfully');
        setEditPage(null);
        fetchPages();
        fetchStats();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update SEO page');
      }
    } catch {
      toast.error('Failed to update SEO page');
    } finally {
      setSaving(false);
    }
  };

  const runAiSeo = async (
    endpoint: 'title' | 'description' | 'improve',
    apply: (text: string) => void,
    eventName: string,
    extraBody?: Record<string, unknown>,
  ) => {
    if (!editPage) return;
    try {
      const res = await apiFetch(`/api/ai/seo/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({
          listingTitle: editForm.title || editForm.h1,
          city: editPage.pageSlug,
          pageType: editPage.pageType,
          ...extraBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'AI generation failed');
        return;
      }
      if (data.text) {
        apply(data.text);
        trackEvent(eventName, { surface: 'admin_seo', pageType: editPage.pageType });
        toast.success('AI content applied');
      }
    } catch {
      toast.error('AI generation failed');
    }
  };

  const handleQuickNoindex = async (page: SeoPage) => {
    try {
      const res = await apiFetch(`/api/seo/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ noindex: !page.noindex }),
      });
      if (res.ok) {
        toast.success(page.noindex ? 'Noindex removed — page is now indexable' : 'Noindex applied — page will be excluded from search engines');
        fetchPages();
      }
    } catch {
      toast.error('Failed to toggle noindex');
    }
  };

  // ==========================================
  // FAQ Handlers
  // ==========================================
  const openFaqManager = async (page: SeoPage) => {
    setFaqPage(page);
    setLoadingFaqs(true);
    try {
      const res = await fetch(`/api/seo/pages/${page.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFaqs((data.page?.faqs || []).sort((a: SeoFaq, b: SeoFaq) => a.sortOrder - b.sortOrder));
      }
    } catch {
      toast.error('Failed to load FAQs');
    } finally {
      setLoadingFaqs(false);
    }
  };

  const openEditFaq = (faq: SeoFaq) => {
    setEditFaq(faq);
    setFaqForm({ question: faq.question, answer: faq.answer, sortOrder: faq.sortOrder });
    setIsAddFaq(false);
  };

  const openAddFaq = () => {
    if (!faqPage) return;
    setEditFaq(null);
    setFaqForm({ question: '', answer: '', sortOrder: faqs.length + 1 });
    setIsAddFaq(true);
  };

  const handleSaveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      toast.error('Question and answer are required');
      return;
    }
    setSavingFaq(true);
    try {
      if (isAddFaq && faqPage) {
        const res = await apiFetch('/api/seo/faqs', {
          method: 'POST',
          body: JSON.stringify({
            seoPageId: faqPage.id,
            question: faqForm.question,
            answer: faqForm.answer,
            sortOrder: faqForm.sortOrder,
          }),
        });
        if (res.ok) {
          toast.success('FAQ created successfully');
          setEditFaq(null);
          openFaqManager(faqPage);
        } else {
          const err = await res.json();
          toast.error(err.error || 'Failed to create FAQ');
        }
      } else if (editFaq) {
        const res = await apiFetch('/api/seo/faqs', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editFaq.id,
            question: faqForm.question,
            answer: faqForm.answer,
            sortOrder: faqForm.sortOrder,
            isActive: editFaq.isActive,
          }),
        });
        if (res.ok) {
          toast.success('FAQ updated successfully');
          setEditFaq(null);
          if (faqPage) openFaqManager(faqPage);
        } else {
          const err = await res.json();
          toast.error(err.error || 'Failed to update FAQ');
        }
      }
    } catch {
      toast.error('Failed to save FAQ');
    } finally {
      setSavingFaq(false);
    }
  };

  const handleReorderFaq = async (faq: SeoFaq, direction: 'up' | 'down') => {
    const sorted = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((f) => f.id === faq.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const currentOrder = faq.sortOrder;
    const swapOrder = sorted[swapIdx].sortOrder;

    try {
      const res = await apiFetch('/api/seo/faqs', {
        method: 'PATCH',
        body: JSON.stringify({ id: faq.id, question: faq.question, answer: faq.answer, sortOrder: swapOrder, isActive: faq.isActive }),
      });
      if (res.ok) {
        const res2 = await apiFetch('/api/seo/faqs', {
          method: 'PATCH',
          body: JSON.stringify({ id: sorted[swapIdx].id, question: sorted[swapIdx].question, answer: sorted[swapIdx].answer, sortOrder: currentOrder, isActive: sorted[swapIdx].isActive }),
        });
        if (res2.ok && faqPage) {
          openFaqManager(faqPage);
        }
      }
    } catch {
      toast.error('Failed to reorder FAQ');
    }
  };

  // ==========================================
  // Delete Handlers
  // ==========================================
  const handleDeletePage = async () => {
    if (!deleteTarget || deleteTarget.type !== 'page') return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/seo/pages/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('SEO page deleted');
        setDeleteTarget(null);
        fetchPages();
      } else {
        toast.error('Failed to delete SEO page');
      }
    } catch {
      toast.error('Failed to delete SEO page');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteFaq = async () => {
    if (!deleteTarget || deleteTarget.type !== 'faq') return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/seo/faqs?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('FAQ deleted');
        setDeleteTarget(null);
        if (faqPage) openFaqManager(faqPage);
      } else {
        toast.error('Failed to delete FAQ');
      }
    } catch {
      toast.error('Failed to delete FAQ');
    } finally {
      setDeleting(false);
    }
  };

  // ==========================================
  // Bulk Generate (batch loop driver)
  // ==========================================

  /** Run one generate type to completion, respecting batchSize and processAllMissing. */
  const handleGenerate = async (type: GenerateType) => {
    const label = GENERATE_BUTTONS.find(b => b.type === type)?.label ?? type;
    let cumulativeGenerated = 0;
    let initialSkipped: number | null = null;
    let totalEntities = 0;
    let batchCount = 0;
    let failed = 0;

    setGenProgress({
      type, label,
      generated: 0, skipped: 0, total: 0, totalMissing: 0,
      batchCount: 0, failed: 0, isRunning: true,
    });

    try {
      while (true) {
        let data: Record<string, number> = { created: 0, skipped: 0, total: 0 };
        try {
          const res = await apiFetch('/api/seo/generate', {
            method: 'POST',
            body: JSON.stringify({
              type,
              limit: batchSize,
              countrySlug: 'india',
              skipExisting: true,
            }),
          });
          const raw = await res.json();
          if (!res.ok) {
            failed++;
            toast.error((raw.error as string) || `Failed to generate ${label} pages`);
            break;
          }
          data = raw as Record<string, number>;
        } catch {
          failed++;
          toast.error(`Network error generating ${label} pages`);
          break;
        }

        batchCount++;
        cumulativeGenerated += data.created ?? 0;
        totalEntities = data.total ?? 0;
        if (initialSkipped === null) initialSkipped = data.skipped ?? 0;
        const totalMissing = Math.max(0, totalEntities - (initialSkipped ?? 0));

        setGenProgress({
          type, label,
          generated: cumulativeGenerated,
          skipped: initialSkipped ?? 0,
          total: totalEntities,
          totalMissing,
          batchCount,
          failed,
          isRunning: true,
        });

        // Stop when nothing new was generated, or processAllMissing is OFF (single batch)
        if ((data.created ?? 0) === 0 || !processAllMissing) break;

        // Brief pause between batches to keep the UI responsive
        await new Promise<void>(r => setTimeout(r, 120));
      }
    } finally {
      setGenProgress(prev => prev ? { ...prev, isRunning: false } : null);
      fetchStats();
      fetchPages();
    }

    const totalMissing = Math.max(0, totalEntities - (initialSkipped ?? 0));
    if (failed === 0) {
      if (cumulativeGenerated > 0) {
        toast.success(
          `Generated ${cumulativeGenerated}${processAllMissing ? ' / ' + totalMissing : ''} ${label} page(s) in ${batchCount} batch${batchCount !== 1 ? 'es' : ''}`,
        );
      } else {
        toast.info(`All ${label} pages already exist (${initialSkipped ?? 0} skipped)`);
      }
    }
  };

  /** Run all types sequentially, each respecting batchSize / processAllMissing. */
  const handleGenerateAll = async () => {
    const types: GenerateType[] = ['city', 'category', 'state', 'country', 'category_city', 'longtail'];
    for (const type of types) {
      await handleGenerate(type);
    }
  };

  const handleCreatePage = async () => {
    if (!createForm.pageSlug.trim() || !createForm.pageType) {
      toast.error('Page type and slug are required');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch('/api/seo/pages', {
        method: 'POST',
        body: JSON.stringify({
          pageType: createForm.pageType,
          pageSlug: createForm.pageSlug.trim(),
          title: createForm.title || null,
          metaDescription: createForm.metaDescription || null,
          h1: createForm.h1 || null,
          introContent: createForm.introContent || null,
          canonicalUrl: createForm.canonicalUrl || null,
          customData: createForm.schemaJson || null,
          isPublished: createForm.isPublished,
          noindex: createForm.noindex,
          featuredImage: createForm.featuredImage || null,
          imageAlt: createForm.imageAlt || null,
          imageTitle: createForm.imageTitle || null,
          imageCaption: createForm.imageCaption || null,
          autoGenerateImage: !createForm.featuredImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create SEO page');
        return;
      }
      toast.success('SEO page created');
      setCreateModal(false);
      setCreateForm({
        pageType: 'city',
        pageSlug: '',
        title: '',
        metaDescription: '',
        h1: '',
        introContent: '',
        canonicalUrl: '',
        schemaJson: '',
        isPublished: true,
        noindex: false,
        featuredImage: '',
        imageAlt: '',
        imageTitle: '',
        imageCaption: '',
      });
      fetchPages();
      fetchStats();
    } catch {
      toast.error('Failed to create SEO page');
    } finally {
      setCreating(false);
    }
  };

  // ==========================================
  // City Intro Handlers
  // ==========================================
  const loadCityIntro = async (city: SeoCityOption) => {
    setCityIntroModal({ city: city.name, slug: city.slug, content: '', id: undefined });
    try {
      const res = await fetch(
        `/api/seo/pages?pageType=city&pageSlug=${encodeURIComponent(city.slug)}&limit=1`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        const page = data.pages?.[0];
        if (page) {
          setCityIntroModal({
            city: city.name,
            slug: city.slug,
            content: page.introContent || '',
            id: page.id,
          });
        }
      }
    } catch {
      toast.error('Failed to load city intro');
    }
  };

  const saveCityIntro = async () => {
    if (!cityIntroModal?.slug) return;
    setSavingCityIntro(true);
    try {
      if (cityIntroModal.id) {
        const res = await apiFetch(`/api/seo/pages/${cityIntroModal.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ introContent: cityIntroModal.content }),
        });
        if (res.ok) {
          toast.success(`${cityIntroModal.city} intro saved successfully`);
          setCityIntroModal(null);
          fetchPages();
        } else {
          const err = await res.json();
          toast.error(err.error || 'Failed to save city intro');
        }
        return;
      }

      const res = await apiFetch('/api/seo/pages', {
        method: 'POST',
        body: JSON.stringify({
          pageType: 'city',
          pageSlug: cityIntroModal.slug,
          title: `${cityIntroModal.city} - Adult Classifieds & Services`,
          metaDescription: `Discover verified adult services in ${cityIntroModal.city}. Browse premium listings with real photos and reviews on SecretZa.`,
          h1: `${cityIntroModal.city} Adult Classifieds & Services`,
          introContent: cityIntroModal.content,
        }),
      });
      if (res.ok) {
        toast.success(`${cityIntroModal.city} intro saved successfully`);
        setCityIntroModal(null);
        fetchPages();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save city intro');
      }
    } catch {
      toast.error('Failed to save city intro');
    } finally {
      setSavingCityIntro(false);
    }
  };

  // ==========================================
  // Reset filters
  // ==========================================
  const resetFilters = () => {
    setPageType('all');
    setSearch('');
    setIsPublishedFilter(null);
    setCurrentPage(1);
  };

  // ==========================================
  // Format slug for display
  // ==========================================
  const formatSlug = (slug: string) => {
    return slug.replace(/-/g, ' ').replace(/\//g, ' / ');
  };

  // ==========================================
  // Get page type icon
  // ==========================================
  const getPageTypeIcon = (type: string) => {
    const Icon = PAGE_TYPE_ICONS[type] || Globe;
    return <Icon className="size-3" />;
  };

  // ==========================================
  // FAQ Manager Panel
  // ==========================================
  if (faqPage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFaqPage(null)}
            className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] h-8 rounded-lg"
          >
            <ChevronLeft className="size-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#F5F5F7]">
              FAQs: {faqPage.pageSlug}
            </h2>
            <p className="text-sm text-[#A1A1AA] mt-0.5">
              {faqPage.title}
            </p>
          </div>
          <Button
            onClick={openAddFaq}
            className="h-8 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
          >
            <Plus className="size-3 mr-1" />
            Add FAQ
          </Button>
        </div>

        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-0">
            {loadingFaqs ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
              </div>
            ) : faqs.length === 0 ? (
              <div className="text-center py-12">
                <FileQuestion className="size-12 text-[#52525B] mx-auto mb-4" />
                <p className="text-[#F5F5F7] font-medium">No FAQs yet</p>
                <p className="text-sm text-[#A1A1AA] mt-1">
                  Add frequently asked questions to improve SEO.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                {faqs.map((faq, idx) => (
                  <div
                    key={faq.id}
                    className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-0.5 mt-1">
                        <button
                          onClick={() => handleReorderFaq(faq, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-[rgba(255,255,255,0.05)] text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                        <button
                          onClick={() => handleReorderFaq(faq, 'down')}
                          disabled={idx === faqs.length - 1}
                          className="p-1 rounded hover:bg-[rgba(255,255,255,0.05)] text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="size-3" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className="bg-[#7C3AED]/10 text-[#8B5CF6] border-[#7C3AED]/20 text-[10px] px-1.5 py-0 rounded-full"
                          >
                            #{faq.sortOrder}
                          </Badge>
                          {faq.isActive ? (
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 rounded-full">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[10px] px-1.5 py-0 rounded-full">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-[#F5F5F7] mb-1">{faq.question}</p>
                        <p className="text-xs text-[#A1A1AA] line-clamp-2">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEditFaq(faq)}
                          className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-[#8B5CF6] transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'faq', id: faq.id })}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ Edit/Add Dialog */}
        <Dialog open={!!editFaq || isAddFaq} onOpenChange={() => { setEditFaq(null); setIsAddFaq(false); }}>
          <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#F5F5F7] text-lg">
                {isAddFaq ? 'Add New FAQ' : 'Edit FAQ'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Question</label>
                <Input
                  value={faqForm.question}
                  onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="Enter the FAQ question..."
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Answer</label>
                <Textarea
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
                  placeholder="Enter the FAQ answer..."
                  rows={4}
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
                />
              </div>
              <div className="w-24">
                <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Sort Order</label>
                <Input
                  type="number"
                  value={faqForm.sortOrder}
                  onChange={(e) => setFaqForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  min={1}
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => { setEditFaq(null); setIsAddFaq(false); }}
                className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveFaq}
                disabled={savingFaq || !faqForm.question.trim() || !faqForm.answer.trim()}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
              >
                {savingFaq ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="size-4 mr-1" />
                )}
                {isAddFaq ? 'Create' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete FAQ Confirmation */}
        <Dialog open={!!deleteTarget && deleteTarget.type === 'faq'} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#F5F5F7]">Delete FAQ</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[#A1A1AA]">
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </p>
            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteFaq}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const GENERATE_BUTTONS: { type: GenerateType; label: string }[] = [
    { type: 'city', label: 'Cities' },
    { type: 'category', label: 'Categories' },
    { type: 'category_city', label: 'Category+City' },
    { type: 'state', label: 'States' },
    { type: 'country', label: 'Countries' },
    { type: 'longtail', label: 'Longtail' },
  ];
  const BATCH_SIZES = [10, 20, 50, 100, 500];
  const isGenerating = genProgress?.isRunning === true;
  const activeGenerateType = isGenerating ? genProgress?.type : null;

  // ==========================================
  // Main SEO Pages List View
  // ==========================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">SEO Management</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            {typeStats.total} SEO page{typeStats.total !== 1 ? 's' : ''} in database
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setCreateModal(true)}
            className="h-8 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
          >
            <Plus className="size-3 mr-1" />
            Create SEO Page
          </Button>
          <Button
            onClick={() => { fetchPages(); fetchStats(); }}
            variant="ghost"
            className="h-8 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] rounded-lg"
          >
            <RefreshCw className="size-3 mr-1" />
            Refresh
          </Button>
          <Button
            onClick={() => { setCityIntroModal({ city: '', slug: '', content: '' }); loadCityOptions(); }}
            variant="ghost"
            className="h-8 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] rounded-lg"
          >
            <MapPin className="size-3 mr-1" />
            Edit City Intros
          </Button>
        </div>
      </div>

      {/* Stats by type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {PAGE_TYPE_OPTIONS.filter((o) => o.value !== 'all').map((opt) => {
          const Icon = PAGE_TYPE_ICONS[opt.value] || Globe;
          const count = typeStats[opt.value as keyof SeoTypeStats] ?? 0;
          return (
            <Card key={opt.value} className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="size-3.5 text-[#8B5CF6]" />
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">{opt.label}</span>
                </div>
                <p className="text-xl font-bold text-[#F5F5F7] tabular-nums">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Generate card */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[#F5F5F7]">Automatic SEO Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Batch size selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#A1A1AA] shrink-0">Batch Size</span>
              <div className="flex rounded-lg overflow-hidden border border-[rgba(255,255,255,0.1)]">
                {BATCH_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => setBatchSize(size)}
                    disabled={isGenerating}
                    className={[
                      'px-2.5 py-1 text-[11px] font-medium transition-colors',
                      batchSize === size
                        ? 'bg-[#7C3AED] text-white'
                        : 'bg-[#1E1E2D] text-[#A1A1AA] hover:bg-[rgba(255,255,255,0.06)]',
                      'border-r border-[rgba(255,255,255,0.08)] last:border-r-0',
                    ].join(' ')}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Process All Missing toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch
                checked={processAllMissing}
                onCheckedChange={setProcessAllMissing}
                disabled={isGenerating}
                className="data-[state=checked]:bg-[#7C3AED]"
              />
              <span className="text-[11px] text-[#A1A1AA]">
                Process All Missing
                <span className="ml-1 text-[10px] text-[#6B6B7A]">
                  {processAllMissing ? '(loop until done)' : '(one batch only)'}
                </span>
              </span>
            </label>
          </div>

          {/* Generate buttons */}
          <div className="flex flex-wrap gap-2">
            {GENERATE_BUTTONS.map(({ type, label }) => {
              const isGranular = type === 'city' || type === 'category_city';
              const granularTarget: SeoGranularMode | null =
                type === 'city' ? 'single_city' : type === 'category_city' ? 'category_city' : null;

              return (
                <Button
                  key={type}
                  onClick={() => {
                    if (isGranular && granularTarget) {
                      setGranularMode(granularTarget);
                    } else {
                      handleGenerate(type);
                    }
                  }}
                  disabled={isGenerating || granularMode !== null}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  title={
                    isGranular
                      ? type === 'city'
                        ? 'Select a single city to generate'
                        : 'Select category and city to generate one page'
                      : undefined
                  }
                >
                  {activeGenerateType === type ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="size-3 mr-1" />
                  )}
                  Generate {label}
                  {isGranular && <MapPin className="size-3 ml-1 opacity-70" />}
                </Button>
              );
            })}
            <SeoGranularTriggerButtons
              onOpen={setGranularMode}
              disabled={isGenerating || granularMode !== null}
            />
            <SeoKeywordGeneratorTrigger
              onOpen={() => setKeywordGeneratorOpen(true)}
              disabled={isGenerating || granularMode !== null || keywordGeneratorOpen || advancedGeneratorMode !== null}
            />
            <SeoAdvancedGeneratorTriggers
              onOpen={setAdvancedGeneratorMode}
              disabled={isGenerating || granularMode !== null || keywordGeneratorOpen || advancedGeneratorMode !== null || urlRepairOpen}
            />
            <SeoUrlRepairTrigger
              onOpen={() => setUrlRepairOpen(true)}
              disabled={isGenerating || urlRepairOpen}
            />
            <Button
              onClick={handleGenerateAll}
              disabled={isGenerating}
              className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
            >
              {isGenerating && !activeGenerateType ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Plus className="size-3 mr-1" />
              )}
              Generate All Missing
            </Button>
            <Button
              onClick={handleGenerateMissingImages}
              disabled={generatingImages || isGenerating}
              className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
            >
              {generatingImages ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <ImageIcon className="size-3 mr-1" />
              )}
              Generate SEO Images
            </Button>
          </div>

          {/* Live progress indicator */}
          {genProgress && (
            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0E0E17] p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-[#F5F5F7] flex items-center gap-1.5">
                  {genProgress.isRunning && <Loader2 className="size-3 animate-spin text-[#7C3AED]" />}
                  {genProgress.isRunning ? `Generating ${genProgress.label}` : `${genProgress.label} complete`}
                  {genProgress.batchCount > 0 && (
                    <span className="text-[#6B6B7A] font-normal">
                      · Batch {genProgress.batchCount}
                    </span>
                  )}
                </span>
                {!genProgress.isRunning && (
                  <button
                    onClick={() => setGenProgress(null)}
                    className="text-[10px] text-[#6B6B7A] hover:text-[#A1A1AA]"
                  >
                    dismiss
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {genProgress.totalMissing > 0 && (
                <div className="w-full h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7C3AED] transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((genProgress.generated / genProgress.totalMissing) * 100))}%` }}
                  />
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                <div>
                  <p className="text-[10px] text-[#6B6B7A] uppercase tracking-wide">Generated</p>
                  <p className="text-sm font-semibold text-emerald-400 tabular-nums">
                    {genProgress.generated.toLocaleString()}
                    {genProgress.totalMissing > 0 && (
                      <span className="text-[#6B6B7A] font-normal"> / {genProgress.totalMissing.toLocaleString()}</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B6B7A] uppercase tracking-wide">Remaining</p>
                  <p className="text-sm font-semibold text-[#F5F5F7] tabular-nums">
                    {Math.max(0, genProgress.totalMissing - genProgress.generated).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B6B7A] uppercase tracking-wide">Skipped</p>
                  <p className="text-sm font-semibold text-amber-400 tabular-nums">
                    {genProgress.skipped.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B6B7A] uppercase tracking-wide">Failed</p>
                  <p className={`text-sm font-semibold tabular-nums ${genProgress.failed > 0 ? 'text-red-400' : 'text-[#6B6B7A]'}`}>
                    {genProgress.failed}
                  </p>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Filter Bar */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Page Type Filter */}
            <div className="flex gap-1.5 flex-wrap flex-1">
              {PAGE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setPageType(opt.value); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    pageType === opt.value
                      ? 'bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30'
                      : 'text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#A1A1AA]" />
              <Input
                placeholder="Search by slug..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-xs"
              />
            </div>

            {/* Published Toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => { setIsPublishedFilter(null); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isPublishedFilter === null
                    ? 'bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30'
                    : 'text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => { setIsPublishedFilter(true); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                  isPublishedFilter === true
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                <Eye className="size-3" />
                Published
              </button>
              <button
                onClick={() => { setIsPublishedFilter(false); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                  isPublishedFilter === false
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                <EyeOff className="size-3" />
                Unpublished
              </button>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(pageType !== 'all' || search || isPublishedFilter !== null) && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-[#52525B]">Active filters:</span>
              {pageType !== 'all' && (
                <Badge
                  variant="outline"
                  className="bg-[#7C3AED]/10 text-[#8B5CF6] border-[#7C3AED]/20 text-[10px] px-2 py-0 rounded-full cursor-pointer"
                  onClick={() => { setPageType('all'); setCurrentPage(1); }}
                >
                  {PAGE_TYPE_OPTIONS.find((o) => o.value === pageType)?.label} &times;
                </Badge>
              )}
              {search && (
                <Badge
                  variant="outline"
                  className="bg-[#7C3AED]/10 text-[#8B5CF6] border-[#7C3AED]/20 text-[10px] px-2 py-0 rounded-full cursor-pointer"
                  onClick={() => { setSearch(''); setCurrentPage(1); }}
                >
                  &quot;{search}&quot; &times;
                </Badge>
              )}
              {isPublishedFilter !== null && (
                <Badge
                  variant="outline"
                  className="bg-[#7C3AED]/10 text-[#8B5CF6] border-[#7C3AED]/20 text-[10px] px-2 py-0 rounded-full cursor-pointer"
                  onClick={() => { setIsPublishedFilter(null); setCurrentPage(1); }}
                >
                  {isPublishedFilter ? 'Published' : 'Unpublished'} &times;
                </Badge>
              )}
              <button
                onClick={resetFilters}
                className="text-[10px] text-[#8B5CF6] hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO Pages Table */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="size-12 text-[#52525B] mx-auto mb-4" />
              <p className="text-[#F5F5F7] font-medium">No SEO pages found</p>
              <p className="text-sm text-[#A1A1AA] mt-1">
                {search || pageType !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Generate SEO pages for cities to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-16">Image</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-24">Type</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Slug</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-24">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr
                      key={page.id}
                      className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    >
                      {/* Featured Image Preview */}
                      <td className="px-4 py-3">
                        <div className="w-12 h-8 rounded overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]">
                          <img
                            src={page.featuredImageUrl || '/brand/logo-icon-dark.svg'}
                            alt={page.imageAlt || page.title || page.pageSlug}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>

                      {/* Page Type */}
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${
                            PAGE_TYPE_COLORS[page.pageType] || 'bg-[rgba(255,255,255,0.04)] text-[#A1A1AA] border-[rgba(255,255,255,0.08)]'
                          }`}
                        >
                          {getPageTypeIcon(page.pageType)}
                          {page.pageType}
                        </Badge>
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-[#A1A1AA] font-mono">{formatSlug(page.pageSlug)}</span>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-[#F5F5F7] truncate max-w-[300px]">{page.title}</p>
                          {page.noindex && (
                            <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0 rounded-full flex-shrink-0">
                              Noindex
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {page.isPublished ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full">
                            <Eye className="size-3 mr-0.5" />
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[10px] px-2 py-0.5 rounded-full">
                            <EyeOff className="size-3 mr-0.5" />
                            Draft
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const path = getSeoPagePublicUrl(page);
                              window.open(path, '_blank', 'noopener,noreferrer');
                            }}
                            title="View public page"
                            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-emerald-400 transition-colors"
                          >
                            <ExternalLink className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleGeneratePageImage(page)}
                            title="Generate SEO image"
                            disabled={generatingImageId === page.id}
                            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-violet-400 transition-colors disabled:opacity-50"
                          >
                            {generatingImageId === page.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <ImageIcon className="size-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleQuickNoindex(page)}
                            title={page.noindex ? 'Remove noindex' : 'Add noindex'}
                            className={`p-1.5 rounded-md transition-colors ${
                              page.noindex
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'hover:bg-[rgba(255,255,255,0.05)] text-[#52525B] hover:text-amber-400'
                            }`}
                          >
                            <EyeOff className="size-3.5" />
                          </button>
                          <button
                            onClick={() => openEditPage(page)}
                            title="Edit"
                            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-[#8B5CF6] transition-colors"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => openFaqManager(page)}
                            title="Manage FAQs"
                            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-amber-400 transition-colors"
                          >
                            <FileQuestion className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: 'page', id: page.id })}
                            title="Delete"
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && pages.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
              <p className="text-xs text-[#52525B]">
                Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-[#F5F5F7] disabled:opacity-20 transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 text-xs font-medium rounded-md transition-all ${
                        currentPage === pageNum
                          ? 'bg-[#7C3AED] text-white'
                          : 'text-[#A1A1AA] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F5F5F7]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-[#F5F5F7] disabled:opacity-20 transition-colors"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Page Dialog */}
      <Dialog open={!!editPage} onOpenChange={() => setEditPage(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] text-lg flex items-center gap-2">
              <Pencil className="size-4 text-[#8B5CF6]" />
              Edit SEO Page
            </DialogTitle>
            {editPage && (
              <p className="text-xs text-[#A1A1AA]">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full mr-2 ${
                    PAGE_TYPE_COLORS[editPage.pageType] || ''
                  }`}
                >
                  {editPage.pageType}
                </Badge>
                <span className="font-mono">{editPage.pageSlug}</span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* SEO quality score */}
            <SeoQualityMeter result={editScore} loading={editScoreLoading} />

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#A1A1AA]">Title</label>
                <AiGenerateButton
                  label="Generate"
                  onGenerate={() => runAiSeo('title', (text) => setEditForm((f) => ({ ...f, title: text })), 'ai_generate_title')}
                  title="Generate an SEO title"
                />
              </div>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Page title..."
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
              />
            </div>

            {/* Meta Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#A1A1AA]">Meta Description</label>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${editForm.metaDescription.length > 160 ? 'text-red-400' : 'text-[#52525B]'}`}>
                    {editForm.metaDescription.length}/160
                  </span>
                  <AiGenerateButton
                    label="Generate"
                    onGenerate={() => runAiSeo('description', (text) => setEditForm((f) => ({ ...f, metaDescription: text.slice(0, 160) })), 'ai_generate_description')}
                    title="Generate an SEO description"
                  />
                </div>
              </div>
              <Textarea
                value={editForm.metaDescription}
                onChange={(e) => setEditForm((f) => ({ ...f, metaDescription: e.target.value.slice(0, 160) }))}
                placeholder="Meta description for search engines..."
                rows={3}
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
              />
            </div>

            {/* H1 */}
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">H1 Heading</label>
              <Input
                value={editForm.h1}
                onChange={(e) => setEditForm((f) => ({ ...f, h1: e.target.value }))}
                placeholder="Main heading..."
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
              />
            </div>

            {/* Intro Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#A1A1AA]">Intro Content</label>
                <AiGenerateButton
                  label="Improve"
                  disabled={!editForm.introContent.trim()}
                  onGenerate={() => runAiSeo('improve', (text) => setEditForm((f) => ({ ...f, introContent: text })), 'ai_improve_content', { content: editForm.introContent })}
                  title="Improve grammar and readability"
                />
              </div>
              <Textarea
                value={editForm.introContent}
                onChange={(e) => setEditForm((f) => ({ ...f, introContent: e.target.value }))}
                placeholder="Introductory content for the page..."
                rows={4}
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
              />
            </div>

            <Separator className="bg-[rgba(255,255,255,0.08)]" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#A1A1AA]">Featured Image</label>
                {editPage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={generatingImageId === editPage.id}
                    onClick={() => handleGeneratePageImage(editPage)}
                    className="h-7 text-[10px] text-violet-400"
                  >
                    {generatingImageId === editPage.id ? (
                      <Loader2 className="size-3 animate-spin mr-1" />
                    ) : (
                      <ImageIcon className="size-3 mr-1" />
                    )}
                    Generate
                  </Button>
                )}
              </div>
              {editForm.featuredImage && (
                <div className="mb-3 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)] aspect-[1200/630] max-h-40">
                  <img
                    src={editForm.featuredImage.startsWith('http') || editForm.featuredImage.startsWith('/')
                      ? editForm.featuredImage
                      : `/api/upload/file?key=${encodeURIComponent(editForm.featuredImage)}`}
                    alt={editForm.imageAlt || 'SEO featured image preview'}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                disabled={uploadingImage || !editPage}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !editPage) return;
                  const url = await uploadSeoImageFile(file, editPage.pageType, editPage.pageSlug);
                  if (url) {
                    setEditForm((f) => ({
                      ...f,
                      featuredImage: url,
                      imageAlt: f.imageAlt || f.h1 || f.title || editPage.pageSlug,
                    }));
                  }
                  e.target.value = '';
                }}
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Image Alt Text</label>
              <Input
                value={editForm.imageAlt}
                onChange={(e) => setEditForm((f) => ({ ...f, imageAlt: e.target.value }))}
                placeholder="Descriptive alt text for accessibility and SEO"
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Image Title</label>
              <Input
                value={editForm.imageTitle}
                onChange={(e) => setEditForm((f) => ({ ...f, imageTitle: e.target.value }))}
                placeholder="Optional image title attribute"
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-9 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Image Caption</label>
              <Input
                value={editForm.imageCaption}
                onChange={(e) => setEditForm((f) => ({ ...f, imageCaption: e.target.value }))}
                placeholder="Optional caption shown below the image"
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-9 rounded-lg text-sm"
              />
            </div>

            <Separator className="bg-[rgba(255,255,255,0.08)]" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#F5F5F7] font-medium">Published</p>
                <p className="text-[10px] text-[#A1A1AA]">Show this page publicly</p>
              </div>
              <Switch
                checked={editForm.isPublished}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, isPublished: checked }))}
              />
            </div>

            {/* Noindex */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#F5F5F7] font-medium">Noindex</p>
                <p className="text-[10px] text-[#A1A1AA]">Tell search engines not to index this page</p>
              </div>
              <Switch
                checked={editForm.noindex}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, noindex: checked }))}
              />
            </div>

            {/* Canonical URL */}
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Canonical URL</label>
              <Input
                value={editForm.canonicalUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, canonicalUrl: e.target.value }))}
                placeholder="/india/maharashtra/mumbai"
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm font-mono"
              />
            </div>

            {/* Schema JSON */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#A1A1AA]">Schema JSON</label>
                <span className="text-[10px] text-[#52525B]">Structured data (breadcrumb, FAQ)</span>
              </div>
              <Textarea
                value={editForm.schemaJson}
                onChange={(e) => setEditForm((f) => ({ ...f, schemaJson: e.target.value }))}
                placeholder='{"schemas":[...]}'
                rows={6}
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditPage(null)}
              className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePage}
              disabled={saving}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <CheckCircle className="size-4 mr-1" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create SEO Page Dialog */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] text-lg flex items-center gap-2">
              <Plus className="size-4 text-[#8B5CF6]" />
              Create SEO Page
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Page Type</label>
              <select
                value={createForm.pageType}
                onChange={(e) => setCreateForm((f) => ({ ...f, pageType: e.target.value as GenerateType }))}
                className="w-full h-9 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] text-[#F5F5F7] text-sm px-3"
              >
                {PAGE_TYPE_OPTIONS.filter((o) => o.value !== 'all').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Page Slug</label>
              <Input
                value={createForm.pageSlug}
                onChange={(e) => setCreateForm((f) => ({ ...f, pageSlug: e.target.value }))}
                placeholder="mumbai or escorts/mumbai"
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Title</label>
              <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Meta Description</label>
              <Textarea value={createForm.metaDescription} onChange={(e) => setCreateForm((f) => ({ ...f, metaDescription: e.target.value }))} rows={3} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">H1</label>
              <Input value={createForm.h1} onChange={(e) => setCreateForm((f) => ({ ...f, h1: e.target.value }))} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Intro Content</label>
              <Textarea value={createForm.introContent} onChange={(e) => setCreateForm((f) => ({ ...f, introContent: e.target.value }))} rows={4} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] resize-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Featured Image Upload</label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                disabled={uploadingImage || !createForm.pageSlug.trim()}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !createForm.pageSlug.trim()) return;
                  const url = await uploadSeoImageFile(file, createForm.pageType, createForm.pageSlug.trim());
                  if (url) {
                    setCreateForm((f) => ({
                      ...f,
                      featuredImage: url,
                      imageAlt: f.imageAlt || f.h1 || f.title || f.pageSlug,
                    }));
                  }
                  e.target.value = '';
                }}
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]"
              />
              {!createForm.featuredImage && (
                <p className="text-[10px] text-[#52525B] mt-1">Leave empty to auto-generate an SVG on create.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Image Alt Text</label>
              <Input value={createForm.imageAlt} onChange={(e) => setCreateForm((f) => ({ ...f, imageAlt: e.target.value }))} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Image Title</label>
              <Input value={createForm.imageTitle} onChange={(e) => setCreateForm((f) => ({ ...f, imageTitle: e.target.value }))} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Image Caption</label>
              <Input value={createForm.imageCaption} onChange={(e) => setCreateForm((f) => ({ ...f, imageCaption: e.target.value }))} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Canonical URL</label>
              <Input value={createForm.canonicalUrl} onChange={(e) => setCreateForm((f) => ({ ...f, canonicalUrl: e.target.value }))} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Schema JSON</label>
              <Textarea value={createForm.schemaJson} onChange={(e) => setCreateForm((f) => ({ ...f, schemaJson: e.target.value }))} rows={4} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] font-mono text-xs resize-none" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#F5F5F7]">Published</span>
              <Switch checked={createForm.isPublished} onCheckedChange={(c) => setCreateForm((f) => ({ ...f, isPublished: c }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#F5F5F7]">Noindex</span>
              <Switch checked={createForm.noindex} onCheckedChange={(c) => setCreateForm((f) => ({ ...f, noindex: c }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCreateModal(false)} className="text-[#A1A1AA]">Cancel</Button>
            <Button onClick={handleCreatePage} disabled={creating} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              {creating ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Page Confirmation */}
      <Dialog open={!!deleteTarget && deleteTarget.type === 'page'} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Delete SEO Page</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#A1A1AA]">
            Are you sure you want to delete this SEO page? All associated FAQs will also be deleted. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeletePage}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* City Intro Editor Dialog */}
      <Dialog open={!!cityIntroModal} onOpenChange={() => setCityIntroModal(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] text-lg flex items-center gap-2">
              <MapPin className="size-4 text-[#8B5CF6]" />
              Edit City Intro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Select City</label>
              {loadingCityOptions ? (
                <div className="flex items-center gap-2 py-4 text-sm text-[#A1A1AA]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading cities from database...
                </div>
              ) : cityOptions.length === 0 ? (
                <p className="text-sm text-[#A1A1AA] py-2">
                  No cities found. Generate SEO pages first.
                </p>
              ) : (
                <ScrollArea className="h-40 rounded-lg border border-[rgba(255,255,255,0.08)] p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {cityOptions.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => loadCityIntro(city)}
                        className={`px-2 py-1.5 text-xs rounded-lg transition-all text-left ${
                          cityIntroModal?.slug === city.slug
                            ? 'bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30'
                            : 'text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                        }`}
                      >
                        {city.name}
                        {city.state?.name ? (
                          <span className="block text-[10px] text-[#52525B]">{city.state.name}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            {cityIntroModal?.slug && (
              <div>
                <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Intro Content for {cityIntroModal.city}</label>
                <Textarea
                  value={cityIntroModal.content}
                  onChange={(e) => setCityIntroModal(prev => prev ? { ...prev, content: e.target.value } : null)}
                  rows={8}
                  className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
                  placeholder="Enter a custom intro paragraph for this city's SEO page..."
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCityIntroModal(null)} className="text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={saveCityIntro}
              disabled={savingCityIntro || !cityIntroModal?.slug}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
            >
              {savingCityIntro ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle className="size-4 mr-1" />}
              Save Intro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminSeoGranularTools
        mode={granularMode}
        onModeChange={setGranularMode}
        onComplete={() => {
          fetchPages();
          fetchStats();
        }}
        disabled={isGenerating}
      />

      <AdminSeoKeywordGenerator
        open={keywordGeneratorOpen}
        onOpenChange={setKeywordGeneratorOpen}
        onComplete={() => {
          fetchPages();
          fetchStats();
        }}
        disabled={isGenerating}
      />

      <AdminSeoAdvancedGenerators
        mode={advancedGeneratorMode}
        onModeChange={setAdvancedGeneratorMode}
        onComplete={() => {
          fetchPages();
          fetchStats();
        }}
        disabled={isGenerating}
      />

      <AdminSeoUrlRepair
        open={urlRepairOpen}
        onOpenChange={setUrlRepairOpen}
        onComplete={() => {
          fetchPages();
          fetchStats();
        }}
        disabled={isGenerating}
      />
    </div>
  );
}

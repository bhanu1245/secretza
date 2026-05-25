'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  customData?: Record<string, unknown> | null;
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
  const [search, setSearch] = useState('');
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
    canonicalUrl: '',
    customSeoBlock: '',
  });
  const [saving, setSaving] = useState(false);

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
  const [generating, setGenerating] = useState(false);

  // City intro editor state
  const [cityIntroModal, setCityIntroModal] = useState<{ city: string; slug: string; content: string; id?: string } | null>(null);
  const [savingCityIntro, setSavingCityIntro] = useState(false);

  // ==========================================
  // Fetch SEO Pages
  // ==========================================
  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pageType !== 'all') params.set('pageType', pageType);
      if (search) params.set('search', search);
      if (isPublishedFilter !== null) params.set('isPublished', String(isPublishedFilter));
      params.set('page', String(currentPage));
      params.set('limit', String(limit));
      params.set('XTransformPort', '3000');

      const res = await fetch(`/api/seo/pages?${params.toString()}`);
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
    fetchPages();
  }, [fetchPages]);

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
      canonicalUrl: page.canonicalUrl || '',
      customSeoBlock: '',
    });
  };

  const handleSavePage = async () => {
    if (!editPage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/seo/pages/${editPage.id}?XTransformPort=3000`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success('SEO page updated successfully');
        setEditPage(null);
        fetchPages();
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

  const handleQuickNoindex = async (page: SeoPage) => {
    try {
      const res = await fetch(`/api/seo/pages/${page.id}?XTransformPort=3000`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/seo/pages/${page.id}?XTransformPort=3000`);
      if (res.ok) {
        const data = await res.json();
        setFaqs((data.faqs || []).sort((a: SeoFaq, b: SeoFaq) => a.sortOrder - b.sortOrder));
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
        const res = await fetch('/api/seo/faqs?XTransformPort=3000', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch('/api/seo/faqs?XTransformPort=3000', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/seo/faqs?XTransformPort=3000', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: faq.id, question: faq.question, answer: faq.answer, sortOrder: swapOrder, isActive: faq.isActive }),
      });
      if (res.ok) {
        const res2 = await fetch('/api/seo/faqs?XTransformPort=3000', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/seo/pages/${deleteTarget.id}?XTransformPort=3000`, { method: 'DELETE' });
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
      const res = await fetch(`/api/seo/faqs?id=${deleteTarget.id}&XTransformPort=3000`, { method: 'DELETE' });
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
  // Bulk Generate
  // ==========================================
  const handleBulkGenerate = async () => {
    setGenerating(true);
    try {
      const cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow'];
      let created = 0;
      for (const city of cities) {
        const res = await fetch('/api/seo/pages?XTransformPort=3000', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageType: 'city',
            pageSlug: city,
            title: `${city.charAt(0).toUpperCase() + city.slice(1)} - Find Services in ${city.charAt(0).toUpperCase() + city.slice(1)}`,
            metaDescription: `Discover the best services in ${city.charAt(0).toUpperCase() + city.slice(1)}. Browse verified listings and find what you're looking for.`,
            h1: `Services in ${city.charAt(0).toUpperCase() + city.slice(1)}`,
            introContent: `Explore our comprehensive directory of services available in ${city.charAt(0).toUpperCase() + city.slice(1)}.`,
          }),
        });
        if (res.ok) created++;
      }
      toast.success(`Generated SEO pages for ${created} cities`);
      fetchPages();
    } catch {
      toast.error('Failed to generate SEO pages');
    } finally {
      setGenerating(false);
    }
  };

  // ==========================================
  // City Intro Handlers
  // ==========================================
  const loadCityIntro = async (slug: string) => {
    setCityIntroModal({ city: slug.charAt(0).toUpperCase() + slug.slice(1), slug, content: '' });
    try {
      const res = await fetch(`/api/seo/pages?pageType=city&search=${slug}&limit=1&XTransformPort=3000`);
      if (res.ok) {
        const data = await res.json();
        if (data.pages?.[0]?.introContent) {
          setCityIntroModal(prev => prev ? { ...prev, content: data.pages[0].introContent, id: data.pages[0].id } : null);
        }
      }
    } catch { /* empty */ }
  };

  const saveCityIntro = async () => {
    if (!cityIntroModal?.slug) return;
    setSavingCityIntro(true);
    try {
      const body = {
        pageType: 'city',
        pageSlug: cityIntroModal.slug,
        title: `${cityIntroModal.city} - Adult Classifieds & Services`,
        metaDescription: `Discover verified adult services in ${cityIntroModal.city}. Browse premium listings with real photos and reviews on Secretza.`,
        introContent: cityIntroModal.content,
      };
      const res = await fetch('/api/seo/pages?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(`${cityIntroModal.city} intro saved successfully`);
        setCityIntroModal(null);
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

  // ==========================================
  // Main SEO Pages List View
  // ==========================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">SEO Management</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            {total} SEO page{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleBulkGenerate}
            disabled={generating}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            {generating ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="size-3 mr-1" />
            )}
            Generate SEO for Cities
          </Button>
          <Button
            onClick={fetchPages}
            variant="ghost"
            className="h-8 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] rounded-lg"
          >
            <RefreshCw className="size-3 mr-1" />
            Refresh
          </Button>
          <Button
            onClick={() => setCityIntroModal({ city: '', slug: '', content: '' })}
            className="h-8 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg"
          >
            <MapPin className="size-3 mr-1" />
            Edit City Intros
          </Button>
        </div>
      </div>

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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
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
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Title</label>
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
                <span className={`text-[10px] ${editForm.metaDescription.length > 160 ? 'text-red-400' : 'text-[#52525B]'}`}>
                  {editForm.metaDescription.length}/160
                </span>
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
              <label className="text-xs font-medium text-[#A1A1AA] mb-1.5 block">Intro Content</label>
              <Textarea
                value={editForm.introContent}
                onChange={(e) => setEditForm((f) => ({ ...f, introContent: e.target.value }))}
                placeholder="Introductory content for the page..."
                rows={4}
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm resize-none"
              />
            </div>

            <Separator className="bg-[rgba(255,255,255,0.08)]" />

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
                placeholder="https://example.com/page"
                className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm font-mono"
              />
            </div>

            {/* Custom SEO Block */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#A1A1AA]">Custom SEO Block (HTML)</label>
                <span className="text-[10px] text-[#52525B]">Injected as extra content on the page</span>
              </div>
              <Textarea
                value={editForm.customSeoBlock}
                onChange={(e) => setEditForm((f) => ({ ...f, customSeoBlock: e.target.value }))}
                placeholder="Enter custom HTML content to inject on this page (e.g., featured content, promotional text)..."
                rows={4}
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
              <div className="grid grid-cols-4 gap-2">
                {['mumbai', 'delhi', 'bangalore', 'goa', 'hyderabad', 'chennai', 'pune', 'kolkata'].map((slug) => (
                  <button
                    key={slug}
                    onClick={() => loadCityIntro(slug)}
                    className={`px-2 py-1.5 text-xs rounded-lg transition-all capitalize ${
                      cityIntroModal?.slug === slug
                        ? 'bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30'
                        : 'text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                    }`}
                  >
                    {slug}
                  </button>
                ))}
              </div>
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
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildGeoCascadeUrl } from "@/lib/admin-geo-form";
import type { KeywordPageTypeOption } from "@/lib/seo-keyword-generation";

type GeoItem = { id: string; name: string; countryId?: string; stateId?: string };

type PreviewEntry = {
  keyword: string;
  slug: string;
  exists: boolean;
  willGenerate: boolean;
  canonicalUrl: string;
};

type PreviewResult = {
  keywordCount: number;
  toGenerate: number;
  toSkip: number;
  entries: PreviewEntry[];
  cityName?: string;
};

type AdminSeoKeywordGeneratorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  disabled?: boolean;
};

const PAGE_TYPE_OPTIONS: { value: KeywordPageTypeOption; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "longtail", label: "Longtail" },
  { value: "city", label: "City" },
  { value: "category", label: "Category" },
  { value: "custom", label: "Custom" },
];

const fieldClass =
  "w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50";

const textareaClass =
  "w-full min-h-[140px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50 resize-y";

export function SeoKeywordGeneratorTrigger({
  onOpen,
  disabled,
}: {
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
    >
      <FileText className="size-3 mr-1" />
      Generate Keyword SEO Pages
    </Button>
  );
}

export default function AdminSeoKeywordGenerator({
  open,
  onOpenChange,
  onComplete,
  disabled = false,
}: AdminSeoKeywordGeneratorProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === "admin";

  const [tab, setTab] = useState<"keywords" | "keyword_city">("keywords");
  const [keywordsText, setKeywordsText] = useState("");
  const [cityKeywordsText, setCityKeywordsText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [pageType, setPageType] = useState<KeywordPageTypeOption>("auto");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [loadingGeo, setLoadingGeo] = useState(false);

  const isBusy = generating || disabled;
  const activeKeywordsText = tab === "keywords" ? keywordsText : cityKeywordsText;

  const lineCount = useMemo(() => {
    const lines = activeKeywordsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (csvText.trim()) {
      const csvLines = csvText.split(/\r?\n/).filter((l) => l.trim());
      return lines.length + Math.max(0, csvLines.length - (csvLines[0]?.toLowerCase().includes("keyword") ? 1 : 0));
    }
    return lines.length;
  }, [activeKeywordsText, csvText]);

  const resetForm = useCallback(() => {
    setKeywordsText("");
    setCityKeywordsText("");
    setCsvText("");
    setPageType("auto");
    setPreview(null);
    setCountryId("");
    setStateId("");
    setCityId("");
    setStates([]);
    setCities([]);
    setTab("keywords");
  }, []);

  const loadCountries = useCallback(async () => {
    const res = await fetch("/api/admin/geo/countries?limit=100");
    const data = await res.json();
    if (res.ok) setCountries(data.items || []);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    void loadCountries();
  }, [open, loadCountries, resetForm]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId("");
      setCityId("");
      return;
    }
    const url = buildGeoCascadeUrl("states", { countryId });
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setStates(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [countryId]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      setCityId("");
      return;
    }
    const url = buildGeoCascadeUrl("cities", { stateId });
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setCities(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [stateId]);

  const fetchPreview = useCallback(async () => {
    const trimmed = activeKeywordsText.trim();
    if (!trimmed && !csvText.trim()) {
      setPreview(null);
      return;
    }
    if (tab === "keyword_city" && !cityId) {
      setPreview(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const res = await fetch("/api/admin/seo/generate-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          keywordsText: activeKeywordsText,
          csv: csvText,
          pageType,
          mode: tab,
          cityId: tab === "keyword_city" ? cityId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview");
      setPreview(data.preview ?? null);
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  }, [activeKeywordsText, csvText, pageType, tab, cityId]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void fetchPreview(), 400);
    return () => clearTimeout(timer);
  }, [open, fetchPreview]);

  const handleCsvUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    try {
      const text = await file.text();
      setCsvText(text);
      toast.success("CSV merged into keyword list");
    } catch {
      toast.error("Failed to read CSV file");
    }
  };

  const handleGenerate = async () => {
    if (!preview || preview.toGenerate === 0) {
      toast.info("No new pages to generate");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/admin/seo/generate-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordsText: activeKeywordsText,
          csv: csvText,
          pageType,
          mode: tab,
          cityId: tab === "keyword_city" ? cityId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      if (data.generated > 0) {
        toast.success(
          `Generated ${data.generated} SEO page${data.generated !== 1 ? "s" : ""}${
            data.skipped > 0 ? ` — skipped ${data.skipped} existing` : ""
          }${data.failed > 0 ? ` — ${data.failed} failed` : ""}`,
        );
      } else if (data.skipped > 0) {
        toast.info(`Skipped ${data.skipped} existing page${data.skipped !== 1 ? "s" : ""}`);
      } else {
        toast.success(data.message || "Generation complete");
      }

      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate SEO pages");
    } finally {
      setGenerating(false);
    }
  };

  if (!isAdmin) return null;

  const canGenerate =
    !!preview &&
    preview.toGenerate > 0 &&
    !loadingPreview &&
    !generating &&
    (tab !== "keyword_city" || !!cityId);

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7] flex items-center gap-2">
            <FileText className="size-4 text-amber-400" />
            Generate Keyword SEO Pages
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            Paste custom keywords to generate SEO pages with automatic content and duplicate protection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "keywords" | "keyword_city")}>
          <TabsList className="bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)]">
            <TabsTrigger value="keywords" className="text-xs data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white">
              Keywords
            </TabsTrigger>
            <TabsTrigger value="keyword_city" className="text-xs data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white">
              Keyword + City
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keywords" className="space-y-3 mt-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">
                Keywords <span className="text-red-400">*</span>
              </label>
              <textarea
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder={"Independent Escorts Bangalore\nVIP Escorts Bangalore\nLuxury Escorts Bangalore"}
                className={textareaClass}
                disabled={isBusy}
              />
              <p className="mt-1 text-[10px] text-[#6B6B7A]">One keyword per line</p>
            </div>
          </TabsContent>

          <TabsContent value="keyword_city" className="space-y-3 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Country</label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className={fieldClass}
                  disabled={isBusy || loadingGeo}
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">State</label>
                <select
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                  className={fieldClass}
                  disabled={!countryId || isBusy || loadingGeo}
                >
                  <option value="">Select state</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">City</label>
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className={fieldClass}
                  disabled={!stateId || isBusy || loadingGeo}
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">
                Keyword List <span className="text-red-400">*</span>
              </label>
              <textarea
                value={cityKeywordsText}
                onChange={(e) => setCityKeywordsText(e.target.value)}
                placeholder={"Independent Escorts\nVIP Escorts\nLuxury Escorts"}
                className={textareaClass}
                disabled={isBusy}
              />
              <p className="mt-1 text-[10px] text-[#6B6B7A]">
                Keywords are combined with the selected city (e.g. Independent Escorts + Bangalore)
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Page Type</label>
              <select
                value={pageType}
                onChange={(e) => setPageType(e.target.value as KeywordPageTypeOption)}
                className={fieldClass}
                disabled={isBusy}
              >
                {PAGE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">CSV Upload (optional)</label>
              <label className={`flex items-center gap-2 ${fieldClass} cursor-pointer`}>
                <Upload className="size-3.5 text-[#A1A1AA]" />
                <span className="text-xs text-[#A1A1AA]">Upload .csv file</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={isBusy}
                  onChange={(e) => void handleCsvUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              {csvText && (
                <p className="mt-1 text-[10px] text-emerald-400">CSV loaded — merged with textarea entries</p>
              )}
            </div>
          </div>

          {loadingPreview && (
            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
              <Loader2 className="size-3 animate-spin" />
              Loading preview...
            </div>
          )}

          {preview && !loadingPreview && (
            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0E0E17] p-3 space-y-3">
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-[#F5F5F7]">
                  Keywords entered: <strong>{preview.keywordCount}</strong>
                </span>
                <span className="text-emerald-400">
                  Will generate: <strong>{preview.toGenerate}</strong>
                </span>
                {preview.toSkip > 0 && (
                  <span className="text-[#A1A1AA]">
                    Skipping: <strong>{preview.toSkip}</strong>
                  </span>
                )}
                {preview.cityName && (
                  <span className="text-[#A1A1AA]">City: <strong>{preview.cityName}</strong></span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-[#6B6B7A] border-b border-[rgba(255,255,255,0.06)]">
                      <th className="py-1.5 pr-2 font-medium">Keyword</th>
                      <th className="py-1.5 pr-2 font-medium">Slug</th>
                      <th className="py-1.5 pr-2 font-medium">Exists?</th>
                      <th className="py-1.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entries.map((entry) => (
                      <tr key={`${entry.slug}-${entry.keyword}`} className="border-b border-[rgba(255,255,255,0.04)]">
                        <td className="py-1.5 pr-2 text-[#F5F5F7] max-w-[180px] truncate" title={entry.keyword}>
                          {entry.keyword}
                        </td>
                        <td className="py-1.5 pr-2 text-[#A1A1AA] font-mono text-[10px]">
                          {entry.canonicalUrl}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={entry.exists ? "text-amber-400" : "text-[#6B6B7A]"}>
                            {entry.exists ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <span className={entry.willGenerate ? "text-emerald-400" : "text-[#6B6B7A]"}>
                            {entry.willGenerate ? "Generate" : "Skip"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loadingPreview && lineCount > 0 && !preview && tab === "keyword_city" && !cityId && (
            <p className="text-xs text-amber-400">Select a city to preview keyword combinations.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="border-white/10 bg-transparent text-[#A1A1AA]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || isBusy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Generating SEO Pages...
              </>
            ) : (
              `Generate ${preview?.toGenerate ?? 0} Page${preview?.toGenerate !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Globe2, Layers3, Loader2, Tags } from "lucide-react";
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
import { buildGeoCascadeUrl } from "@/lib/admin-geo-form";
import type { AdvancedSeoGeneratorMode, AdvancedSeoPreview } from "@/lib/seo-advanced-generation-shared";
import {
  BULK_STRICT_THRESHOLD,
  BULK_WARNING_THRESHOLD,
} from "@/lib/seo-advanced-generation-shared";

export type AdvancedGeneratorMode = AdvancedSeoGeneratorMode | null;

type GeoItem = { id: string; name: string; countryId?: string; stateId?: string };
type CategoryItem = { id: string; name: string; slug: string };

const MODE_CONFIG: Record<
  AdvancedSeoGeneratorMode,
  {
    title: string;
    description: string;
    apiPath: string;
    icon: typeof Globe2;
    buttonLabel: string;
    buttonClass: string;
  }
> = {
  keyword_multi_city: {
    title: "Generate Keyword + Multiple Cities",
    description: "Generate SEO pages from keyword × city combinations across multiple locations.",
    apiPath: "/api/admin/seo/generate-keyword-multi-city",
    icon: Globe2,
    buttonLabel: "Generate Keyword + Multiple Cities",
    buttonClass: "bg-cyan-600 hover:bg-cyan-700",
  },
  city_category_longtail: {
    title: "Generate City + Category + Longtail",
    description: "Generate predefined longtail template pages for a city and category.",
    apiPath: "/api/admin/seo/generate-city-category-longtail",
    icon: Layers3,
    buttonLabel: "Generate City + Category + Longtail",
    buttonClass: "bg-indigo-600 hover:bg-indigo-700",
  },
  city_category_keywords: {
    title: "Generate City + Category + Custom Keywords",
    description: "Generate SEO pages from custom keyword prefixes combined with category and city.",
    apiPath: "/api/admin/seo/generate-city-category-keywords",
    icon: Tags,
    buttonLabel: "Generate City + Category + Custom Keywords",
    buttonClass: "bg-rose-600 hover:bg-rose-700",
  },
};

const fieldClass =
  "w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50";

const textareaClass =
  "w-full min-h-[120px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50 resize-y";

function PreviewPanel({ preview, showAllTitles }: { preview: AdvancedSeoPreview; showAllTitles?: boolean }) {
  const rows = showAllTitles ? preview.entries : preview.examples;

  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0E0E17] p-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {preview.cityNames.length > 0 && (
          <div>
            <span className="text-[#6B6B7A]">Cities:</span>{" "}
            <span className="text-[#F5F5F7]">{preview.cityCount}</span>
          </div>
        )}
        {preview.categoryName && (
          <div>
            <span className="text-[#6B6B7A]">Category:</span>{" "}
            <span className="text-[#F5F5F7]">{preview.categoryName}</span>
          </div>
        )}
        <div>
          <span className="text-[#6B6B7A]">Keywords:</span>{" "}
          <span className="text-[#F5F5F7]">{preview.keywordCount}</span>
        </div>
        {preview.templateCount !== undefined && (
          <div>
            <span className="text-[#6B6B7A]">Templates:</span>{" "}
            <span className="text-[#F5F5F7]">{preview.templateCount}</span>
          </div>
        )}
        <div>
          <span className="text-emerald-400">Generate:</span>{" "}
          <strong className="text-emerald-400">{preview.toGenerate}</strong>
        </div>
        <div>
          <span className="text-amber-400">Skip Existing:</span>{" "}
          <strong className="text-amber-400">{preview.toSkip}</strong>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <span className="text-[#6B6B7A]">Estimated Total:</span>{" "}
          <strong className="text-[#F5F5F7]">{preview.estimatedTotal} pages</strong>
        </div>
      </div>

      {preview.requiresStrictConfirmation && (
        <p className="text-xs text-red-400 font-medium">
          You are about to generate {preview.estimatedTotal}+ SEO pages (limit: {BULK_STRICT_THRESHOLD}+ requires
          double confirmation).
        </p>
      )}
      {preview.requiresBulkWarning && !preview.requiresStrictConfirmation && (
        <p className="text-xs text-amber-400">
          You are about to generate {preview.estimatedTotal}+ SEO pages ({BULK_WARNING_THRESHOLD}+ warning).
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[#0E0E17]">
              <tr className="text-[#6B6B7A] border-b border-[rgba(255,255,255,0.06)]">
                <th className="py-1.5 pr-2 font-medium">Keyword</th>
                <th className="py-1.5 pr-2 font-medium">Title</th>
                <th className="py-1.5 pr-2 font-medium">Slug</th>
                <th className="py-1.5 pr-2 font-medium">Exists</th>
                <th className="py-1.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={`${entry.slug}-${entry.keyword}`} className="border-b border-[rgba(255,255,255,0.04)]">
                  <td className="py-1.5 pr-2 text-[#F5F5F7] max-w-[140px] truncate" title={entry.keyword}>
                    {entry.keyword}
                  </td>
                  <td className="py-1.5 pr-2 text-[#A1A1AA] max-w-[160px] truncate" title={entry.title}>
                    {entry.title}
                  </td>
                  <td className="py-1.5 pr-2 text-[#A1A1AA] font-mono text-[10px]">{entry.canonicalUrl}</td>
                  <td className="py-1.5 pr-2">{entry.exists ? "Yes" : "No"}</td>
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
      )}

      {!showAllTitles && preview.entries.length > preview.examples.length && (
        <p className="text-[10px] text-[#6B6B7A]">
          Showing first {preview.examples.length} of {preview.entries.length} combinations
        </p>
      )}
    </div>
  );
}

type AdminSeoAdvancedGeneratorsProps = {
  mode: AdvancedGeneratorMode;
  onModeChange: (mode: AdvancedGeneratorMode) => void;
  onComplete?: () => void;
  disabled?: boolean;
};

export function SeoAdvancedGeneratorTriggers({
  onOpen,
  disabled,
}: {
  onOpen: (mode: AdvancedSeoGeneratorMode) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {(Object.keys(MODE_CONFIG) as AdvancedSeoGeneratorMode[]).map((mode) => {
        const config = MODE_CONFIG[mode];
        const Icon = config.icon;
        return (
          <Button
            key={mode}
            type="button"
            onClick={() => onOpen(mode)}
            disabled={disabled}
            className={`h-8 text-xs text-white rounded-lg ${config.buttonClass}`}
          >
            <Icon className="size-3 mr-1" />
            {config.buttonLabel}
          </Button>
        );
      })}
    </>
  );
}

export default function AdminSeoAdvancedGenerators({
  mode,
  onModeChange,
  onComplete,
  disabled = false,
}: AdminSeoAdvancedGeneratorsProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === "admin";

  const [keywordsText, setKeywordsText] = useState("");
  const [preview, setPreview] = useState<AdvancedSeoPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);

  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [loadingGeo, setLoadingGeo] = useState(false);

  const isOpen = mode !== null;
  const config = mode ? MODE_CONFIG[mode] : null;
  const isBusy = generating || disabled;

  const resetForm = useCallback(() => {
    setKeywordsText("");
    setPreview(null);
    setConfirmStep(0);
    setCountryId("");
    setStateId("");
    setCityId("");
    setSelectedCityIds([]);
    setCategoryId("");
    setStates([]);
    setCities([]);
  }, []);

  const loadCountries = useCallback(async () => {
    const res = await fetch("/api/admin/geo/countries?limit=100");
    const data = await res.json();
    if (res.ok) setCountries(data.items || []);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (res.ok) {
      const items = (data.categories ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
        parentId?: string | null;
      }>;
      setCategories(items.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name, slug: c.slug })));
    }
  }, []);

  const fetchCitiesForState = useCallback(async (sid: string): Promise<GeoItem[]> => {
    const url = buildGeoCascadeUrl("cities", { stateId: sid }, 500);
    if (!url) return [];
    const res = await fetch(url);
    const data = await res.json();
    return (data.items || []) as GeoItem[];
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }
    void loadCountries();
    void loadCategories();
  }, [isOpen, loadCountries, loadCategories, resetForm]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId("");
      setCities([]);
      setCityId("");
      if (mode === "keyword_multi_city") setSelectedCityIds([]);
      return;
    }
    const url = buildGeoCascadeUrl("states", { countryId }, 200);
    if (!url) return;
    setLoadingGeo(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setStates(data.items || []))
      .finally(() => setLoadingGeo(false));
  }, [countryId, mode]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      setCityId("");
      return;
    }
    setLoadingGeo(true);
    fetchCitiesForState(stateId)
      .then((items) => setCities(items))
      .finally(() => setLoadingGeo(false));
  }, [stateId, fetchCitiesForState]);

  const canFetchPreview = useMemo(() => {
    if (!mode) return false;
    if (mode === "keyword_multi_city") {
      return keywordsText.trim().length > 0 && selectedCityIds.length > 0;
    }
    if (mode === "city_category_longtail") {
      return !!cityId && !!categoryId;
    }
    return !!cityId && !!categoryId && keywordsText.trim().length > 0;
  }, [mode, keywordsText, selectedCityIds, cityId, categoryId]);

  const fetchPreview = useCallback(async () => {
    if (!mode || !config || !canFetchPreview) {
      setPreview(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const body: Record<string, unknown> = { preview: true };
      if (mode === "keyword_multi_city") {
        body.keywordsText = keywordsText;
        body.cityIds = selectedCityIds;
      } else if (mode === "city_category_longtail") {
        body.cityId = cityId;
        body.categoryId = categoryId;
      } else {
        body.cityId = cityId;
        body.categoryId = categoryId;
        body.keywordsText = keywordsText;
      }

      const res = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview");
      setPreview(data.preview ?? null);
      setConfirmStep(0);
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  }, [mode, config, canFetchPreview, keywordsText, selectedCityIds, cityId, categoryId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => void fetchPreview(), 450);
    return () => clearTimeout(timer);
  }, [isOpen, fetchPreview]);

  const toggleCitySelection = (id: string) => {
    setSelectedCityIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const selectAllInState = () => {
    setSelectedCityIds(cities.map((c) => c.id));
  };

  const selectAllInCountry = async () => {
    if (!countryId || states.length === 0) return;
    setLoadingGeo(true);
    try {
      const all: GeoItem[] = [];
      for (const state of states) {
        const items = await fetchCitiesForState(state.id);
        all.push(...items);
      }
      setSelectedCityIds(all.map((c) => c.id));
      toast.success(`Selected ${all.length} cities in country`);
    } catch {
      toast.error("Failed to load all cities");
    } finally {
      setLoadingGeo(false);
    }
  };

  const runGenerate = async () => {
    if (!mode || !config || !preview) return;

    setGenerating(true);
    try {
      const body: Record<string, unknown> = {};
      if (mode === "keyword_multi_city") {
        body.keywordsText = keywordsText;
        body.cityIds = selectedCityIds;
      } else if (mode === "city_category_longtail") {
        body.cityId = cityId;
        body.categoryId = categoryId;
      } else {
        body.cityId = cityId;
        body.categoryId = categoryId;
        body.keywordsText = keywordsText;
      }

      const res = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      }

      onModeChange(null);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate SEO pages");
    } finally {
      setGenerating(false);
      setConfirmStep(0);
    }
  };

  const handleGenerateClick = () => {
    if (!preview || preview.toGenerate === 0) {
      toast.info("No new pages to generate");
      return;
    }

    if (preview.requiresStrictConfirmation) {
      if (confirmStep === 0) {
        setConfirmStep(1);
        return;
      }
      if (confirmStep === 1) {
        setConfirmStep(2);
        return;
      }
    } else if (preview.requiresBulkWarning) {
      if (confirmStep === 0) {
        setConfirmStep(1);
        return;
      }
    }

    void runGenerate();
  };

  const confirmLabel = useMemo(() => {
    if (!preview) return "Generate";
    if (preview.requiresStrictConfirmation) {
      if (confirmStep === 0) return `Review ${preview.toGenerate} Pages`;
      if (confirmStep === 1) return `Confirm ${preview.estimatedTotal}+ Pages`;
      return "Final Confirm — Generate";
    }
    if (preview.requiresBulkWarning && confirmStep === 0) {
      return `Continue — ${preview.estimatedTotal}+ Pages`;
    }
    return `Generate ${preview.toGenerate} Page${preview.toGenerate !== 1 ? "s" : ""}`;
  }, [preview, confirmStep]);

  if (!isAdmin) return null;

  const showAllTitles = mode === "city_category_longtail";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(next) => !isBusy && onModeChange(next ? mode : null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7] flex items-center gap-2">
              {config && <config.icon className="size-4 text-[#7C3AED]" />}
              {config?.title}
            </DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">{config?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {mode === "keyword_multi_city" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">
                    Keywords <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    placeholder={"VIP Escorts\nLuxury Escorts\nIndependent Escorts"}
                    className={textareaClass}
                    disabled={isBusy}
                  />
                  <p className="mt-1 text-[10px] text-[#6B6B7A]">One keyword per line</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Country</label>
                    <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={fieldClass} disabled={isBusy || loadingGeo}>
                      <option value="">Select country</option>
                      {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">State (optional)</label>
                    <select value={stateId} onChange={(e) => setStateId(e.target.value)} className={fieldClass} disabled={!countryId || isBusy || loadingGeo}>
                      <option value="">All states</option>
                      {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-1">
                    <Button type="button" variant="outline" size="sm" disabled={!stateId || cities.length === 0 || isBusy} onClick={selectAllInState} className="text-[10px] h-8 border-white/10">
                      All in state
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!countryId || states.length === 0 || isBusy} onClick={() => void selectAllInCountry()} className="text-[10px] h-8 border-white/10">
                      All in country
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">
                    Cities <span className="text-red-400">*</span> ({selectedCityIds.length} selected)
                  </label>
                  <div className="max-h-[160px] overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0B0B0F] p-2 space-y-1">
                    {cities.length === 0 && (
                      <p className="text-xs text-[#6B6B7A] p-2">Select a state to list cities, or use &quot;All in country&quot;</p>
                    )}
                    {cities.map((city) => (
                      <label key={city.id} className="flex items-center gap-2 text-xs text-[#F5F5F7] cursor-pointer hover:bg-white/[0.03] px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCityIds.includes(city.id)}
                          onChange={() => toggleCitySelection(city.id)}
                          disabled={isBusy}
                          className="rounded border-white/20"
                        />
                        {city.name}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(mode === "city_category_longtail" || mode === "city_category_keywords") && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Country</label>
                    <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={fieldClass} disabled={isBusy || loadingGeo}>
                      <option value="">Select country</option>
                      {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">State</label>
                    <select value={stateId} onChange={(e) => setStateId(e.target.value)} className={fieldClass} disabled={!countryId || isBusy || loadingGeo}>
                      <option value="">Select state</option>
                      {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">City</label>
                    <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={fieldClass} disabled={!stateId || isBusy || loadingGeo}>
                      <option value="">Select city</option>
                      {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass} disabled={isBusy}>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {mode === "city_category_keywords" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">
                      Keywords <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      placeholder={"Russian\nVIP\nLuxury\nIndependent\nCelebrity"}
                      className={textareaClass}
                      disabled={isBusy}
                    />
                    <p className="mt-1 text-[10px] text-[#6B6B7A]">One keyword prefix per line</p>
                  </div>
                )}
              </>
            )}

            {loadingPreview && (
              <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                <Loader2 className="size-3 animate-spin" />
                Loading preview...
              </div>
            )}

            {preview && !loadingPreview && <PreviewPanel preview={preview} showAllTitles={showAllTitles} />}

            {confirmStep > 0 && preview && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                {preview.requiresStrictConfirmation && confirmStep < 2
                  ? `You are about to generate ${preview.estimatedTotal}+ SEO pages. ${
                      confirmStep === 1 ? "Click again for final confirmation." : "Please confirm to continue."
                    }`
                  : `You are about to generate ${preview.estimatedTotal}+ SEO pages. Continue?`}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onModeChange(null)} disabled={isBusy} className="border-white/10 bg-transparent text-[#A1A1AA]">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGenerateClick}
              disabled={!preview || preview.toGenerate === 0 || loadingPreview || isBusy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Generating SEO Pages...
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

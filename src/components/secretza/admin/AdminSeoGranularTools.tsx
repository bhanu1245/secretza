"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Layers, Loader2, MapPin } from "lucide-react";
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

export type SeoGranularMode = "city_pack" | "single_city" | "category_city";

type GeoItem = { id: string; name: string; countryId?: string; stateId?: string };

type CategoryItem = { id: string; name: string; slug: string };

export interface GranularSeoPreview {
  cityId: string;
  cityName: string;
  stateName: string;
  countryName: string;
  categoryName?: string;
  toGenerate: number;
  toSkip: number;
  total: number;
  breakdown: {
    city: number;
    categoryCity: number;
    longtail: number;
  };
}

type AdminSeoGranularToolsProps = {
  mode: SeoGranularMode | null;
  onModeChange: (mode: SeoGranularMode | null) => void;
  onComplete?: () => void;
  disabled?: boolean;
};

const MODE_CONFIG: Record<
  SeoGranularMode,
  {
    title: string;
    description: string;
    previewPath: string;
    generatePath: string;
    confirmLabel: string;
  }
> = {
  city_pack: {
    title: "Generate City SEO Pack",
    description:
      "Generate the city page, all category+city pages, and all longtail+city pages for one city only.",
    previewPath: "/api/admin/seo/generate-city-pack",
    generatePath: "/api/admin/seo/generate-city-pack",
    confirmLabel: "Generate Complete SEO Pack",
  },
  single_city: {
    title: "Generate Single City",
    description: "Generate only the city-level SEO page for the selected location.",
    previewPath: "/api/admin/seo/generate-city",
    generatePath: "/api/admin/seo/generate-city",
    confirmLabel: "Generate City Page",
  },
  category_city: {
    title: "Generate Category + City",
    description: "Generate one category+city SEO page for the selected combination.",
    previewPath: "/api/admin/seo/generate-category-city",
    generatePath: "/api/admin/seo/generate-category-city",
    confirmLabel: "Generate Category + City Page",
  },
};

const fieldClass =
  "w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0B0B0F] px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50";

export default function AdminSeoGranularTools({
  mode,
  onModeChange,
  onComplete,
  disabled = false,
}: AdminSeoGranularToolsProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === "admin";

  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [preview, setPreview] = useState<GranularSeoPreview | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isOpen = mode !== null;
  const config = mode ? MODE_CONFIG[mode] : null;
  const isBusy = generating || disabled;

  const resetForm = useCallback(() => {
    setCountryId("");
    setStateId("");
    setCityId("");
    setCategoryId("");
    setPreview(null);
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
      const items = (data.categories ?? data.items ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
        isActive?: boolean;
        parentId?: string | null;
      }>;
      setCategories(
        items
          .filter((c) => c.isActive !== false && !c.parentId)
          .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      );
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }
    void loadCountries();
    if (mode === "category_city") void loadCategories();
  }, [isOpen, mode, loadCountries, loadCategories, resetForm]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId("");
      setCityId("");
      setCategoryId("");
      setPreview(null);
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
      setCategoryId("");
      setPreview(null);
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

  useEffect(() => {
    if (!cityId || !config) {
      setPreview(null);
      return;
    }
    if (mode === "category_city" && !categoryId) {
      setPreview(null);
      return;
    }

    const params = new URLSearchParams({ cityId });
    if (mode === "category_city" && categoryId) {
      params.set("categoryId", categoryId);
    }

    setLoadingPreview(true);
    fetch(`${config.previewPath}?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load preview");
        setPreview(data.preview ?? null);
      })
      .catch((err) => {
        setPreview(null);
        toast.error(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => setLoadingPreview(false));
  }, [cityId, categoryId, mode, config]);

  const handleGenerate = async () => {
    if (!config || !cityId) return;
    if (mode === "category_city" && !categoryId) return;

    setGenerating(true);
    try {
      const body: Record<string, string> = { cityId };
      if (mode === "category_city") body.categoryId = categoryId;

      const res = await fetch(config.generatePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const cityLabel = data.cityName || preview?.cityName || "city";
      if (data.created > 0) {
        toast.success(
          `Generated ${data.created} SEO page(s) for ${cityLabel}${
            data.skipped > 0 ? ` (${data.skipped} already existed)` : ""
          }`,
        );
      } else if (data.skipped > 0) {
        toast.info(`All ${data.skipped} page(s) already exist for ${cityLabel}. Nothing to generate.`);
      } else {
        toast.success(data.message || "Generation complete");
      }

      onModeChange(null);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!isAdmin) return null;

  const canConfirm =
    !!cityId &&
    !!preview &&
    !loadingPreview &&
    !generating &&
    (mode !== "category_city" || !!categoryId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isBusy && onModeChange(open ? mode : null)}>
      <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F7] flex items-center gap-2">
            {mode === "city_pack" ? (
              <Layers className="size-4 text-[#7C3AED]" />
            ) : (
              <MapPin className="size-4 text-[#7C3AED]" />
            )}
            {config?.title}
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">{config?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
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
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {mode === "category_city" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1AA]">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={fieldClass}
                disabled={!cityId || isBusy}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingPreview && cityId && (mode !== "category_city" || categoryId) && (
            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
              <Loader2 className="size-3 animate-spin" />
              Loading preview...
            </div>
          )}

          {preview && !loadingPreview && (
            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0E0E17] p-3 space-y-1.5">
              <p className="text-sm text-[#F5F5F7]">
                <span className="text-[#A1A1AA]">City:</span> {preview.cityName}
              </p>
              {preview.categoryName && (
                <p className="text-sm text-[#F5F5F7]">
                  <span className="text-[#A1A1AA]">Category:</span> {preview.categoryName}
                </p>
              )}
              <p className="text-sm font-medium text-emerald-400">
                Pages to generate: {preview.toGenerate}
              </p>
              {preview.toSkip > 0 && (
                <p className="text-xs text-[#A1A1AA]">
                  {preview.toSkip} existing page{preview.toSkip !== 1 ? "s" : ""} will be skipped
                </p>
              )}
              {mode === "city_pack" && preview.toGenerate > 0 && (
                <p className="text-[10px] text-[#6B6B7A]">
                  Includes {preview.breakdown.city} city, {preview.breakdown.categoryCity} category+city,{" "}
                  {preview.breakdown.longtail} longtail pages
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onModeChange(null)}
            disabled={isBusy}
            className="border-white/10 bg-transparent text-[#A1A1AA]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!canConfirm || isBusy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              config?.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Standalone trigger buttons for the granular generation card. */
export function SeoGranularTriggerButtons({
  onOpen,
  disabled,
}: {
  onOpen: (mode: SeoGranularMode) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={() => onOpen("city_pack")}
      disabled={disabled}
      className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
    >
      <Layers className="size-3 mr-1" />
      Generate City SEO Pack
    </Button>
  );
}

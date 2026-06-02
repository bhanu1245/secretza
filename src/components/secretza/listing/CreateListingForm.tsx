"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigationStore } from "@/store/useAppStore";
import ImageUploader, { type UploadedImage } from "@/components/secretza/upload/ImageUploader";

const AUTOSAVE_INTERVAL_MS = 3000;
const DRAFT_VERSION = 2;

type Option = {
  id: string;
  name: string;
  slug: string;
  children?: Option[];
  states?: Array<Option & { cities?: Array<Option & { areas?: Option[] }> }>;
  cities?: Array<Option & { areas?: Option[] }>;
  areas?: Option[];
};

type ListingFormValues = {
  title: string;
  slug: string;
  description: string;
  age: string;
  whatsapp: string;
  telegram: string;
  contactEmail: string;
  contactPhone: string;
  categorySlug: string;
  subcategorySlug: string;
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  areaId: string;
  area: string;
  tags: string;
  services: string[];
  price: string;
  currency: string;
  pricingPlan: "normal" | "boost" | "featured" | "premium";
  images: UploadedImage[];
};

type ListingDraft = {
  version: number;
  savedAt: string;
  values: ListingFormValues;
};

interface CreateListingFormProps {
  editListingId?: string | null;
  editMode?: boolean;
}

const serviceOptions = [
  "Independent",
  "VIP",
  "Outcall",
  "Incall",
  "Massage",
  "Dating",
  "Travel",
  "Verified Photos",
];

const formSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters"),
  description: z.string().trim().min(20, "Description must be at least 20 characters"),
  categorySlug: z.string().min(1, "Select a category"),
  countrySlug: z.string().min(1, "Select a country"),
  citySlug: z.string().min(1, "Select a city"),
  price: z.coerce.number().min(0, "Price must be valid"),
  age: z.union([z.literal(""), z.coerce.number().int().min(18).max(99)]),
});

const emptyValues: ListingFormValues = {
  title: "",
  slug: "",
  description: "",
  age: "",
  whatsapp: "",
  telegram: "",
  contactEmail: "",
  contactPhone: "",
  categorySlug: "",
  subcategorySlug: "",
  countrySlug: "",
  stateSlug: "",
  citySlug: "",
  areaId: "",
  area: "",
  tags: "",
  services: [],
  price: "",
  currency: "USD",
  pricingPlan: "normal",
  images: [],
};

function getDraftKey(editMode?: boolean, editListingId?: string | null) {
  return editMode && editListingId
    ? `SecretZa:listing-draft:edit:${editListingId}`
    : "SecretZa:listing-draft:create";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function hasDraftContent(values: ListingFormValues) {
  return Boolean(
    values.title.trim() ||
      values.description.trim() ||
      values.price.trim() ||
      values.images.length > 0,
  );
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function storageKeyFromClientUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("blob:")) return null;
  if (trimmed.startsWith("listings/")) return trimmed;

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.pathname === "/api/upload/file") {
      return parsed.searchParams.get("key");
    }
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname.slice("/uploads/".length);
    }
  } catch {
    return null;
  }

  return null;
}

function isExistingListingImage(
  image: UploadedImage,
  existingImageKeys: Set<string>,
): boolean {
  const storageKey = storageKeyFromClientUrl(image.url || "");
  return (
    existingImageKeys.has(image.id) ||
    existingImageKeys.has(image.url) ||
    Boolean(storageKey && existingImageKeys.has(storageKey))
  );
}

function buildUploadResultsForSubmit(
  images: UploadedImage[],
  existingImageKeys: Set<string>,
) {
  return images
    .filter(
      (image) =>
        !image.isUploading &&
        !image.error &&
        image.url &&
        !image.url.startsWith("blob:"),
    )
    .filter((image) => !isExistingListingImage(image, existingImageKeys))
    .map((image) => {
      if (image.uploadResult) return image.uploadResult;
      const storageKey = storageKeyFromClientUrl(image.url);
      return {
        id: image.id,
        key: storageKey || "",
        storageKey: storageKey || "",
        url: image.url,
        sizeBytes: 0,
        mimeType: "image/jpeg",
      };
    })
    .filter((result) => result.url && (result.storageKey || result.key));
}

export default function CreateListingForm({
  editListingId = null,
  editMode = false,
}: CreateListingFormProps) {
  const navigate = useNavigationStore((s) => s.navigate);
  const draftKey = useMemo(
    () => getDraftKey(editMode, editListingId),
    [editListingId, editMode],
  );
  const [values, setValues] = useState<ListingFormValues>(emptyValues);
  const [categories, setCategories] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const latestValuesRef = useRef(values);
  const restoredDraftRef = useRef(false);
  const existingImageKeysRef = useRef<Set<string>>(new Set());

  const selectedCategory = categories.find((category) => category.slug === values.categorySlug);
  const selectedCountry = countries.find((country) => country.slug === values.countrySlug);
  const selectedState = selectedCountry?.states?.find((state) => state.slug === values.stateSlug);
  const selectedCity = selectedState?.cities?.find((city) => city.slug === values.citySlug);

  useEffect(() => {
    latestValuesRef.current = values;
  }, [values]);

  useEffect(() => {
    async function loadOptions() {
      const [categoryRes, countryRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/public/locations", { cache: "no-store" }),
      ]);
      const [categoryData, countryData] = await Promise.all([
        categoryRes.json(),
        countryRes.json(),
      ]);
      setCategories(categoryData.categories || []);
      setCountries(countryData.countries || []);
    }

    loadOptions().catch(() => {
      toast.error("Failed to load listing options");
    });
  }, []);

  useEffect(() => {
    restoredDraftRef.current = false;
    existingImageKeysRef.current = new Set();

    try {
      const storedDraft = window.localStorage.getItem(draftKey);
      if (!storedDraft) return;

      const draft = JSON.parse(storedDraft) as Partial<ListingDraft>;
      if (draft.version !== DRAFT_VERSION || !draft.values) return;

      setValues({ ...emptyValues, ...draft.values });
      restoredDraftRef.current = hasDraftContent(draft.values);
      setLastSavedAt(draft.savedAt || null);
    } catch {
      window.localStorage.removeItem(draftKey);
    } finally {
      setHydrated(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated || !editMode || !editListingId) return;

    let cancelled = false;

    async function loadListingForEdit() {
      try {
        if (!restoredDraftRef.current) setLoading(true);
        const response = await fetch(`/api/listings/${editListingId}`);
        const listing = await response.json();

        if (!response.ok) {
          throw new Error(listing.error || "Failed to load listing");
        }

        if (cancelled) return;

        existingImageKeysRef.current = new Set(
          (listing.listingImages || []).flatMap((img: UploadedImage) => {
            const storageKey = storageKeyFromClientUrl(img.url || "");
            return [img.id, img.url, storageKey].filter(Boolean) as string[];
          }),
        );

        if (restoredDraftRef.current) return;

        setValues({
          ...emptyValues,
          title: listing.title || "",
          slug: listing.slug || "",
          description: listing.description || "",
          age: listing.age?.toString() || "",
          whatsapp: listing.contact?.whatsapp || listing.whatsapp || "",
          telegram: listing.contact?.telegram || listing.telegram || "",
          contactEmail: listing.contact?.email || listing.contactEmail || "",
          contactPhone: listing.contact?.phone || listing.contactText || "",
          categorySlug: listing.category?.slug || "",
          subcategorySlug: listing.subcategory?.slug || "",
          countrySlug: listing.country?.slug || "",
          stateSlug: listing.state?.slug || "",
          citySlug: listing.city?.slug || "",
          area: listing.area || "",
          tags: Array.isArray(listing.tags) ? listing.tags.join(", ") : "",
          services: Array.isArray(listing.services) ? listing.services : [],
          price: listing.price?.toString() || "",
          currency: listing.currency || "USD",
          images: (listing.listingImages || []).map((img: UploadedImage) => ({
            ...img,
            isUploading: false,
            error: null,
          })),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load listing");
        navigate("dashboard", { tab: "listings" });
      } finally {
        if (!cancelled && !restoredDraftRef.current) setLoading(false);
      }
    }

    loadListingForEdit();

    return () => {
      cancelled = true;
    };
  }, [editListingId, editMode, hydrated, navigate]);

  const saveDraft = useCallback(() => {
    const currentValues = latestValuesRef.current;

    if (!hasDraftContent(currentValues)) {
      window.localStorage.removeItem(draftKey);
      setLastSavedAt(null);
      return;
    }

    const draft: ListingDraft = {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      values: currentValues,
    };

    window.localStorage.setItem(draftKey, JSON.stringify(draft));
    setLastSavedAt(draft.savedAt);
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated || loading) return;
    const intervalId = window.setInterval(saveDraft, AUTOSAVE_INTERVAL_MS);
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveDraft();
    };

    window.addEventListener("pagehide", saveDraft);
    document.addEventListener("visibilitychange", saveWhenHidden);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", saveDraft);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      saveDraft();
    };
  }, [hydrated, loading, saveDraft]);

  function updateField<K extends keyof ListingFormValues>(
    field: K,
    value: ListingFormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === "title" && !editMode ? { slug: slugify(String(value)) } : {}),
    }));
  }

  function toggleService(service: string) {
    setValues((current) => ({
      ...current,
      services: current.services.includes(service)
        ? current.services.filter((item) => item !== service)
        : [...current.services, service],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveDraft();

    const validation = formSchema.safeParse(values);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || "Please check the form");
      return;
    }

    try {
      setLoading(true);
      const submitValues = latestValuesRef.current;

      if (submitValues.images.some((image) => image.isUploading)) {
        toast.error("Please wait for all images to finish uploading");
        return;
      }

      if (submitValues.images.some((image) => image.url?.startsWith("blob:"))) {
        toast.error("Images are still processing. Wait a moment and try again.");
        return;
      }

      const galleryImages = submitValues.images
        .filter((image) => !image.isUploading && !image.error && image.url)
        .map((image) => image.url);
      const uploadResults = buildUploadResultsForSubmit(
        submitValues.images,
        editMode ? existingImageKeysRef.current : new Set<string>(),
      );

      if (editMode && process.env.NODE_ENV === "development") {
        console.log("[CreateListingForm] edit submit", {
          listingId: editListingId,
          galleryCount: galleryImages.length,
          uploadResultsCount: uploadResults.length,
          existingKeyCount: existingImageKeysRef.current.size,
          uploadResults: uploadResults.map((r) => ({
            url: r.url,
            storageKey: r.storageKey || r.key,
          })),
        });
      }

      const payload = {
        title: submitValues.title,
        slug: submitValues.slug,
        description: submitValues.description,
        age: submitValues.age || null,
        whatsapp: submitValues.whatsapp || null,
        telegram: submitValues.telegram || null,
        contactEmail: submitValues.contactEmail || null,
        contactPhone: submitValues.contactPhone || null,
        categorySlug: submitValues.categorySlug,
        subcategorySlug: submitValues.subcategorySlug || null,
        countrySlug: submitValues.countrySlug,
        stateSlug: submitValues.stateSlug || null,
        citySlug: submitValues.citySlug,
        areaId: submitValues.areaId || null,
        area: submitValues.area || null,
        tags: splitCsv(submitValues.tags),
        services: submitValues.services,
        price: Number(submitValues.price),
        currency: submitValues.currency,
        profileImage: galleryImages[0] || null,
        galleryImages,
        uploadResults,
        pricingPlan: submitValues.pricingPlan,
      };

      const response = await fetch(
        editMode && editListingId
          ? `/api/listings/${editListingId}`
          : "/api/listings/create",
        {
          method: editMode && editListingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to save listing");

      toast.success(editMode ? "Listing updated" : "Listing submitted for review");
      window.localStorage.removeItem(draftKey);
      window.localStorage.setItem("dashboardPage", "listings");
      navigate("dashboard", { tab: "listings" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">{editMode ? "Edit Listing" : "Create Listing"}</h1>
        <p className="text-sm text-zinc-400 mt-2">Complete all required sections for faster moderation approval.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Basic Info">
          <Input label="Title" value={values.title} onChange={(value) => updateField("title", value)} required />
          <Input label="Slug" value={values.slug} onChange={(value) => updateField("slug", slugify(value))} />
          <Textarea label="Description" value={values.description} onChange={(value) => updateField("description", value)} required />
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Age" type="number" value={values.age} onChange={(value) => updateField("age", value)} />
            <Input label="WhatsApp" value={values.whatsapp} onChange={(value) => updateField("whatsapp", value)} />
            <Input label="Telegram" value={values.telegram} onChange={(value) => updateField("telegram", value)} />
            <Input label="Mobile Phone" value={values.contactPhone} onChange={(value) => updateField("contactPhone", value)} />
            <Input label="Email" type="email" value={values.contactEmail} onChange={(value) => updateField("contactEmail", value)} />
          </div>
        </Section>

        <Section title="Category">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Category" value={values.categorySlug} onChange={(value) => setValues((current) => ({ ...current, categorySlug: value, subcategorySlug: "" }))} required>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
            </Select>
            <Select label="Subcategory" value={values.subcategorySlug} onChange={(value) => updateField("subcategorySlug", value)}>
              <option value="">Select subcategory</option>
              {selectedCategory?.children?.map((subcategory) => <option key={subcategory.id} value={subcategory.slug}>{subcategory.name}</option>)}
            </Select>
          </div>
        </Section>

        <Section title="Location">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Country" value={values.countrySlug} onChange={(value) => setValues((current) => ({ ...current, countrySlug: value, stateSlug: "", citySlug: "", areaId: "" }))} required>
              <option value="">Select country</option>
              {countries.map((country) => <option key={country.id} value={country.slug}>{country.name}</option>)}
            </Select>
            <Select label="State" value={values.stateSlug} onChange={(value) => setValues((current) => ({ ...current, stateSlug: value, citySlug: "", areaId: "" }))}>
              <option value="">Select state</option>
              {selectedCountry?.states?.map((state) => <option key={state.id} value={state.slug}>{state.name}</option>)}
            </Select>
            <Select label="City" value={values.citySlug} onChange={(value) => setValues((current) => ({ ...current, citySlug: value, areaId: "" }))} required>
              <option value="">Select city</option>
              {selectedState?.cities?.map((city) => <option key={city.id} value={city.slug}>{city.name}</option>)}
            </Select>
            <Select label="Area" value={values.areaId} onChange={(value) => updateField("areaId", value)}>
              <option value="">Select area</option>
              {selectedCity?.areas?.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </Select>
          </div>
          <Input label="Area / Landmark" value={values.area} onChange={(value) => updateField("area", value)} />
        </Section>

        <Section title="Media">
          <ImageUploader
            images={values.images}
            onImagesChange={(update) =>
              setValues((current) => {
                const nextImages =
                  typeof update === "function" ? update(current.images) : update;
                const nextValues = { ...current, images: nextImages };
                latestValuesRef.current = nextValues;
                return nextValues;
              })
            }
          />
        </Section>

        <Section title="Services">
          <Input label="Tags (comma separated)" value={values.tags} onChange={(value) => updateField("tags", value)} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {serviceOptions.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  values.services.includes(service)
                    ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                    : "border-white/10 bg-zinc-900 text-zinc-300 hover:bg-white/5"
                }`}
              >
                {service}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Pricing">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Price" type="number" value={values.price} onChange={(value) => updateField("price", value)} required />
            <Select label="Currency" value={values.currency} onChange={(value) => updateField("currency", value)}>
              {["USD", "INR", "EUR", "GBP", "AED"].map((currency) => <option key={currency}>{currency}</option>)}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["normal", "boost", "featured", "premium"] as const).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => updateField("pricingPlan", plan)}
                className={`rounded-xl border p-4 text-left capitalize ${
                  values.pricingPlan === plan
                    ? "border-violet-500/40 bg-violet-500/15"
                    : "border-white/10 bg-zinc-900"
                }`}
              >
                <span className="font-semibold">{plan}</span>
                <p className="text-xs text-zinc-400 mt-1">{plan === "normal" ? "Submit for review" : `Submit and continue to ${plan} payment`}</p>
              </button>
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-400">
            {lastSavedAt ? `Draft autosaved at ${new Date(lastSavedAt).toLocaleTimeString()}` : "Draft autosaves while you type."}
          </p>
          <button disabled={loading} className="rounded-xl bg-blue-600 px-8 py-4 font-semibold transition hover:bg-blue-700 disabled:opacity-60">
            {loading ? "Saving..." : editMode ? "Save Changes" : "Submit Listing"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#15151D] p-5 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}{required && " *"}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 outline-none focus:border-violet-500" />
    </label>
  );
}

function Textarea({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}{required && " *"}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} className="min-h-[180px] w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 outline-none focus:border-violet-500" />
    </label>
  );
}

function Select({ label, value, onChange, children, required }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-300">{label}{required && " *"}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 outline-none focus:border-violet-500">
        {children}
      </select>
    </label>
  );
}

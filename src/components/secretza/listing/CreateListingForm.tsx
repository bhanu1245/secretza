"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Mail,
  Send,
  Instagram,
  Globe,
  MessageSquare,
  Tag,
  Star,
  Sparkles,
  Package,
  Loader2,
  ShieldX,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categories,
  countries,
  pricingPackages,
} from "@/lib/mock-data";
import { useAuthStore } from "@/store/useAppStore";
import ImageUploader, { type UploadedImage } from "@/components/secretza/upload/ImageUploader";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Media" },
  { id: 3, label: "Contact" },
  { id: 4, label: "Pricing" },
  { id: 5, label: "Review" },
];

interface FormData {
  title: string;
  categorySlug: string;
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  description: string;
  email: string;
  telegram: string;
  instagram: string;
  website: string;
  customContact: string;
  packageId: string;
  couponCode: string;
  termsAccepted: boolean;
}

interface DraftData {
  formData: FormData;
  uploadedImages: UploadedImage[];
  currentStep: number;
  savedAt: string;
}

const DRAFT_KEY = "secretza_listing_draft";
const DRAFT_DEBOUNCE_MS = 2000;

const initialFormData: FormData = {
  title: "",
  categorySlug: "",
  countrySlug: "",
  stateSlug: "",
  citySlug: "",
  description: "",
  email: "",
  telegram: "",
  instagram: "",
  website: "",
  customContact: "",
  packageId: "",
  couponCode: "",
  termsAccepted: false,
};

interface CreateListingFormProps {
  editListingId?: string | null;
  editMode?: boolean;
}

export default function CreateListingForm({ editListingId, editMode }: CreateListingFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  // Edit mode support
  const isEditing = editMode && !!editListingId;
  const [isLoadingListing, setIsLoadingListing] = useState(false);

  // Real uploaded images state (replaces mock count)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // Draft debounce timer ref
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether draft was restored (to avoid showing toast multiple times)
  const draftRestoredRef = useRef(false);

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  // ── Edit Mode: Fetch existing listing data ──────────────────────────
  useEffect(() => {
    if (!isEditing || !editListingId) return;

    async function fetchListing() {
      setIsLoadingListing(true);
      try {
        const res = await fetch(`/api/listings/${editListingId}`);
        if (res.ok) {
          const data = await res.json();
          // Populate form fields from the fetched listing
          setFormData({
            title: data.title || "",
            categorySlug: data.category?.slug || "",
            countrySlug: data.country?.slug || "",
            stateSlug: data.state?.slug || "",
            citySlug: data.city?.slug || "",
            description: data.description || "",
            email: data.contact?.email || "",
            telegram: data.contact?.telegram || "",
            instagram: data.contact?.instagram || "",
            website: data.contact?.website || "",
            customContact: data.contact?.customText || "",
            packageId: "",
            couponCode: "",
            termsAccepted: true, // Pre-accept since editing
          });
          // Set images from listingImages (preferred) or legacy images
          if (data.listingImages && data.listingImages.length > 0) {
            setUploadedImages(data.listingImages.map((img: any) => ({
              id: img.id,
              url: img.url,
              thumbnailUrl: img.thumbnailUrl || img.url,
              sortOrder: img.sortOrder,
              isUploading: false,
              error: null,
            })));
          } else if (data.images && data.images.length > 0) {
            setUploadedImages(data.images.map((img: any, idx: number) => ({
              id: `existing-${idx}`,
              url: img.url,
              thumbnailUrl: img.url,
              sortOrder: idx,
              isUploading: false,
              error: null,
            })));
          }
          // Mark draft as restored to prevent the draft restore effect from overwriting
          draftRestoredRef.current = true;
        } else {
          toast.error("Failed to load listing", {
            description: "Could not load listing data.",
          });
        }
      } catch (err) {
        toast.error("Failed to load listing", {
          description: "Could not load listing data.",
        });
      } finally {
        setIsLoadingListing(false);
      }
    }
    fetchListing();
  }, [isEditing, editListingId]);

  // ── Draft Persistence: Save ──────────────────────────────────────────
  useEffect(() => {
    // Don't save if the form hasn't been touched at all
    const isBlank =
      formData.title === "" &&
      formData.categorySlug === "" &&
      formData.description === "" &&
      uploadedImages.length === 0;

    if (isBlank && currentStep === 1) {
      // Clear any existing draft if form is blank
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      return;
    }

    // Debounced save
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = setTimeout(() => {
      try {
        const draft: DraftData = {
          formData,
          uploadedImages,
          currentStep,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (err) {
        console.warn("[CreateListingForm] Failed to save draft:", err);
      }
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, [formData, uploadedImages, currentStep]);

  // ── Draft Persistence: Restore on mount ──────────────────────────────
  useEffect(() => {
    if (draftRestoredRef.current) return;

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;

      const draft: DraftData = JSON.parse(raw);

      // Restore form data
      if (draft.formData) {
        setFormData(draft.formData);
      }

      // Restore step
      if (typeof draft.currentStep === "number" && draft.currentStep >= 1 && draft.currentStep <= STEPS.length) {
        setCurrentStep(draft.currentStep);
      }

      // Restore images, filtering out any that had upload errors
      if (Array.isArray(draft.uploadedImages)) {
        const validImages = draft.uploadedImages.filter((img) => !img.error);
        if (validImages.length > 0) {
          setUploadedImages(validImages);
        }
      }

      draftRestoredRef.current = true;
      toast.success("Draft restored", {
        description: "Your previous form progress has been restored.",
      });
    } catch (err) {
      console.warn("[CreateListingForm] Failed to restore draft:", err);
      // Clear corrupted draft
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
  }, []);

  // ── Draft Persistence: Clear ─────────────────────────────────────────
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch { /* ignore */ }
    setFormData(initialFormData);
    setCurrentStep(1);
    setUploadedImages([]);
    setSubmitError(null);
    toast.success("Draft cleared");
  }, []);

  // Wrap setUploadedImages to support both direct value and functional updates
  const handleImagesChange = useCallback((update: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => {
    setUploadedImages((prev) => {
      if (typeof update === 'function') {
        return update(prev);
      }
      return update;
    });
  }, []);

  // Loading state for edit mode
  if (isLoadingListing) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#F5F5F7]">Edit Listing</h2>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-12 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-violet" />
          <p className="mt-4 text-sm text-[#A1A1AA]">Loading listing data...</p>
        </div>
      </div>
    );
  }

  // Auth guard: redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-lg text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/15 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="size-8 text-[#7C3AED]" />
        </div>
        <h2 className="text-xl font-bold text-[#F5F5F7] mb-2">Sign In Required</h2>
        <p className="text-sm text-[#A1A1AA] mb-6">You need to be signed in to create a listing.</p>
        <Button
          onClick={() => { setAuthModalTab("login"); setAuthModalOpen(true); }}
          className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-lg shadow-lg shadow-[#7C3AED]/25"
        >
          Sign In to Continue
        </Button>
      </div>
    );
  }

  // Verified guard: block unverified users
  if (!user.isVerified) {
    return (
      <div className="mx-auto max-w-lg text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
          <Mail className="size-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-[#F5F5F7] mb-2">Email Verification Required</h2>
        <p className="text-sm text-[#A1A1AA] mb-2">Please verify your email address before creating listings.</p>
        <p className="text-xs text-[#52525B]">Check your inbox for a verification link, or request a new one from your dashboard settings.</p>
      </div>
    );
  }

  // Derived geo data
  const selectedCountry = countries.find((c) => c.slug === formData.countrySlug);
  const selectedState = selectedCountry?.states?.find(
    (s) => s.slug === formData.stateSlug
  );
  const selectedCategory = categories.find(
    (c) => c.slug === formData.categorySlug
  );
  const selectedPackage = pricingPackages.find(
    (p) => p.id === formData.packageId
  );

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Reset dependent fields
    if (key === "countrySlug") {
      setFormData((prev) => ({ ...prev, countrySlug: value, stateSlug: "", citySlug: "" }));
    }
    if (key === "stateSlug") {
      setFormData((prev) => ({ ...prev, stateSlug: value, citySlug: "" }));
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return (
          formData.title.trim().length >= 3 &&
          formData.categorySlug &&
          formData.countrySlug &&
          formData.citySlug &&
          formData.description.trim().length >= 20
        );
      case 2:
        return uploadedImages.filter((img) => !img.isUploading && !img.error).length > 0;
      case 3:
        return true; // Contact info is optional
      case 4:
        return !!formData.packageId;
      case 5:
        return formData.termsAccepted;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Collect successfully uploaded image IDs
      const successfulImages = uploadedImages.filter(
        (img) => !img.isUploading && !img.error && !img.id.startsWith("temp-")
      );

      // Build image data for the legacy images field (backward compat)
      const imageData = successfulImages.map((img, idx) => ({
        url: img.url,
        alt: `Listing image ${idx + 1}`,
        isPrimary: idx === 0,
      }));

      // Collect image IDs for association with listing
      const imageIds = successfulImages.map((img) => img.id);

      const submitUrl = isEditing && editListingId
        ? `/api/listings/${editListingId}?XTransformPort=3000`
        : "/api/listings?XTransformPort=3000";
      const submitMethod = isEditing ? "PUT" : "POST";

      const res = await fetch(submitUrl, {
        method: submitMethod,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          categorySlug: formData.categorySlug,
          countrySlug: formData.countrySlug,
          stateSlug: formData.stateSlug,
          citySlug: formData.citySlug,
          tags: [],
          price: null,
          currency: "USD",
          contactEmail: formData.email || undefined,
          contactTelegram: formData.telegram || undefined,
          contactInstagram: formData.instagram || undefined,
          contactWebsite: formData.website || undefined,
          contactText: formData.customContact || undefined,
          images: imageData,
          imageIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || `Failed to ${isEditing ? "update" : "create"} listing. Please try again.`;
        setSubmitError(errorMsg);
        toast.error("Submission failed", {
          description: errorMsg,
        });
        return;
      }

      // Clear draft on successful submission
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }

      setSubmitted(true);
      toast.success(isEditing ? "Listing updated!" : "Listing submitted!", {
        description: isEditing
          ? "Your listing has been updated successfully."
          : "Your listing is now pending review.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[CreateListingForm] Submission failed:", message, err);
      const errorMsg = `Network error: ${message}. Please check your connection and try again.`;
      setSubmitError(errorMsg);
      toast.error("Network error", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-8 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="size-8 text-emerald-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[#F5F5F7]">
          {isEditing ? "Listing Updated!" : "Listing Submitted!"}
        </h2>
        <p className="mb-6 text-sm text-[#A1A1AA]">
          {isEditing
            ? "Your listing changes have been saved successfully."
            : "Your listing is now pending review. We'll notify you once it's approved and live. This usually takes less than 24 hours."}
        </p>
        <Button
          className="bg-violet hover:bg-violet-hover"
          onClick={() => {
            setSubmitted(false);
            setFormData(initialFormData);
            setCurrentStep(1);
            setUploadedImages([]);
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            toast.success(isEditing ? "Listing updated successfully!" : "Listing created successfully!");
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#F5F5F7]">{isEditing ? "Edit Listing" : "Create Listing"}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDraft}
              className="h-7 gap-1.5 px-2 text-xs text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" />
              Clear Draft
            </Button>
            <span className="text-sm text-[#A1A1AA]">
              Step {currentStep} of {STEPS.length}
            </span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="mt-2 flex justify-between">
          {STEPS.map((step) => (
            <span
              key={step.id}
              className={`text-xs ${
                step.id === currentStep
                  ? "font-semibold text-violet"
                  : step.id < currentStep
                  ? "text-[#A1A1AA]"
                  : "text-[#A1A1AA]/40"
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-6">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-4 text-base font-semibold text-[#F5F5F7]">
                Basic Information
              </h3>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="title" className="text-sm text-[#A1A1AA]">
                Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="e.g., Stunning Companion for Elite Events"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                maxLength={100}
              />
              <span className="text-xs text-[#A1A1AA]/60">
                {formData.title.length}/100 characters
              </span>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-[#A1A1AA]">
                Category <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.categorySlug || ""}
                onValueChange={(val) => updateField("categorySlug", val)}
              >
                <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
                  {categories
                    .filter((c) => c.isActive)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Country */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-[#A1A1AA]">
                Country <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.countrySlug || ""}
                onValueChange={(val) => updateField("countrySlug", val)}
              >
                <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
                  {countries
                    .filter((c) => c.isActive)
                    .map((country) => (
                      <SelectItem key={country.id} value={country.slug}>
                        {country.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* State */}
            {selectedCountry && selectedCountry.states && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-[#A1A1AA]">
                  State / Region
                </Label>
                <Select
                  value={formData.stateSlug || ""}
                  onValueChange={(val) => updateField("stateSlug", val)}
                >
                  <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
                    {selectedCountry.states
                      .filter((s) => s.isActive)
                      .map((state) => (
                        <SelectItem key={state.id} value={state.slug}>
                          {state.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* City */}
            {selectedState && selectedState.cities && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-[#A1A1AA]">
                  City <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formData.citySlug || ""}
                  onValueChange={(val) => updateField("citySlug", val)}
                >
                  <SelectTrigger className="w-full border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA]">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent className="border-[rgba(255,255,255,0.08)] bg-surface">
                    {selectedState.cities
                      .filter((c) => c.isActive)
                      .map((city) => (
                        <SelectItem key={city.id} value={city.slug}>
                          {city.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="description" className="text-sm text-[#A1A1AA]">
                Description <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your listing in detail..."
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="min-h-[120px] resize-none border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                maxLength={2000}
              />
              <span className="text-xs text-[#A1A1AA]/60">
                {formData.description.length}/2000 characters &middot; Minimum
                20 characters
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Media */}
        {currentStep === 2 && (
          <ImageUploader
            images={uploadedImages}
            onImagesChange={handleImagesChange}
            maxImages={20}
          />
        )}

        {/* Step 3: Contact */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-1 text-base font-semibold text-[#F5F5F7]">
                Contact Information
              </h3>
              <p className="text-sm text-[#A1A1AA]">
                Add your preferred contact methods. All fields are optional but
                at least one is recommended.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                  <Mail className="size-4" />
                  Email
                </Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                />
              </div>

              {/* Telegram */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                  <Send className="size-4" />
                  Telegram
                </Label>
                <Input
                  type="text"
                  placeholder="@username"
                  value={formData.telegram}
                  onChange={(e) => updateField("telegram", e.target.value)}
                  className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                />
              </div>

              {/* Instagram */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                  <Instagram className="size-4" />
                  Instagram
                </Label>
                <Input
                  type="text"
                  placeholder="@username"
                  value={formData.instagram}
                  onChange={(e) => updateField("instagram", e.target.value)}
                  className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                />
              </div>

              {/* Website */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                  <Globe className="size-4" />
                  Website
                </Label>
                <Input
                  type="url"
                  placeholder="https://yoursite.com"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                />
              </div>

              {/* Custom Contact Text */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                  <MessageSquare className="size-4" />
                  Custom Contact Text
                </Label>
                <Textarea
                  placeholder="e.g., WhatsApp available - text only"
                  value={formData.customContact}
                  onChange={(e) => updateField("customContact", e.target.value)}
                  className="resize-none border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40"
                  maxLength={200}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Pricing */}
        {currentStep === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-1 text-base font-semibold text-[#F5F5F7]">
                Choose a Package
              </h3>
              <p className="text-sm text-[#A1A1AA]">
                Select the package that best fits your needs. Upgrade anytime.
              </p>
            </div>

            {/* Package Cards */}
            <RadioGroup
              value={formData.packageId}
              onValueChange={(val) => updateField("packageId", val)}
              className="flex flex-col gap-3"
            >
              {pricingPackages.map((pkg) => (
                <label
                  key={pkg.id}
                  className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition ${
                    formData.packageId === pkg.id
                      ? "border-violet bg-violet/5"
                      : "border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/50 hover:border-[rgba(255,255,255,0.15)]"
                  }`}
                >
                  <RadioGroupItem value={pkg.id} className="sr-only" />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-[#F5F5F7]">
                          {pkg.name}
                        </span>
                        {pkg.isPopular && (
                          <Badge className="bg-violet text-[10px] border-0 px-1.5 py-0">
                            <Sparkles className="mr-1 size-3" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#A1A1AA]">
                        {pkg.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-violet">
                        {pkg.price === 0
                          ? "Free"
                          : `$${pkg.price}`}
                      </span>
                      {pkg.price > 0 && (
                        <span className="text-xs text-[#A1A1AA]">
                          /{pkg.duration}d
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pkg.features.map((feature) => (
                      <span
                        key={feature}
                        className="flex items-center gap-1 text-xs text-[#A1A1AA]"
                      >
                        <Check className="size-3 text-emerald-500" />
                        {feature}
                      </span>
                    ))}
                  </div>
                  {formData.packageId === pkg.id && (
                    <div className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-violet">
                      <Check className="size-3 text-white" />
                    </div>
                  )}
                </label>
              ))}
            </RadioGroup>

            {/* Coupon Code */}
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                <Tag className="size-4" />
                Coupon Code
              </Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter coupon code"
                  value={formData.couponCode}
                  onChange={(e) => updateField("couponCode", e.target.value)}
                  className="flex-1 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] placeholder:text-[#A1A1AA]/50 focus:border-violet/40 uppercase"
                />
                <Button
                  variant="outline"
                  className="shrink-0 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA] hover:bg-violet/10 hover:text-violet hover:border-violet/30"
                >
                  Apply
                </Button>
              </div>
            </div>

            {/* Price Summary */}
            {selectedPackage && (
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0B0B0F] p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
                  <Package className="size-4 text-violet" />
                  Order Summary
                </h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#A1A1AA]">
                      {selectedPackage.name} Package
                    </span>
                    <span className="text-[#F5F5F7]">
                      ${selectedPackage.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#A1A1AA]">Duration</span>
                    <span className="text-[#F5F5F7]">
                      {selectedPackage.duration} days
                    </span>
                  </div>
                  <Separator className="bg-[rgba(255,255,255,0.08)]" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#F5F5F7]">
                      Total
                    </span>
                    <span className="text-lg font-bold text-violet">
                      ${selectedPackage.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-1 text-base font-semibold text-[#F5F5F7]">
                Review Your Listing
              </h3>
              <p className="text-sm text-[#A1A1AA]">
                Please review all information before submitting.
              </p>
            </div>

            {/* Summary Sections */}
            <div className="flex flex-col gap-4">
              {/* Basic Info Summary */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/50 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                  Basic Information
                </h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-sm text-[#A1A1AA]">Title</span>
                    <span className="text-right text-sm font-medium text-[#F5F5F7]">
                      {formData.title}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-sm text-[#A1A1AA]">
                      Category
                    </span>
                    <span className="text-right text-sm font-medium text-[#F5F5F7]">
                      {selectedCategory?.name}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-sm text-[#A1A1AA]">
                      Location
                    </span>
                    <span className="text-right text-sm font-medium text-[#F5F5F7]">
                      {selectedCountry?.name}
                      {selectedState ? `, ${selectedState.name}` : ""}
                      {formData.citySlug
                        ? `, ${selectedState?.cities?.find((c) => c.slug === formData.citySlug)?.name}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-[#A1A1AA]">Description</span>
                    <p className="line-clamp-3 text-sm text-[#F5F5F7]/80">
                      {formData.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Media Summary */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/50 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                  Media
                </h4>
                <div className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                  <ImageIcon className="size-4 text-violet" />
                  {uploadedImages.filter((img) => !img.isUploading && !img.error).length} image{uploadedImages.filter((img) => !img.isUploading && !img.error).length !== 1 ? "s" : ""}{" "}
                  uploaded
                </div>
                {/* Image Thumbnails */}
                {uploadedImages.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {uploadedImages.filter((img) => !img.isUploading && !img.error).slice(0, 6).map((img) => (
                      <div key={img.id} className="relative size-14 shrink-0 overflow-hidden rounded-md bg-[#0B0B0F]">
                        <img
                          src={img.thumbnailUrl || img.url}
                          alt=""
                          className="size-full object-cover"
                        />
                        {img.sortOrder === 0 && (
                          <Badge className="absolute top-0.5 left-0.5 bg-violet text-[7px] border-0 px-1 py-0 leading-none">
                            Primary
                          </Badge>
                        )}
                      </div>
                    ))}
                    {uploadedImages.filter((img) => !img.isUploading && !img.error).length > 6 && (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-[#1E1E2A] text-xs text-[#A1A1AA]">
                        +{uploadedImages.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Summary */}
              {(formData.email ||
                formData.telegram ||
                formData.instagram ||
                formData.website ||
                formData.customContact) && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]/50 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                    Contact
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {formData.email && (
                      <div className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                        <Mail className="size-3.5 text-violet" />
                        {formData.email}
                      </div>
                    )}
                    {formData.telegram && (
                      <div className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                        <Send className="size-3.5 text-violet" />
                        {formData.telegram}
                      </div>
                    )}
                    {formData.instagram && (
                      <div className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                        <Instagram className="size-3.5 text-violet" />
                        {formData.instagram}
                      </div>
                    )}
                    {formData.website && (
                      <div className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                        <Globe className="size-3.5 text-violet" />
                        {formData.website}
                      </div>
                    )}
                    {formData.customContact && (
                      <div className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                        <MessageSquare className="size-3.5 text-violet" />
                        {formData.customContact}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Package Summary */}
              {selectedPackage && (
                <div className="rounded-xl border border-violet/20 bg-violet/5 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                    Package
                  </h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="size-4 text-violet" />
                      <span className="text-sm font-semibold text-[#F5F5F7]">
                        {selectedPackage.name}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-violet">
                      ${selectedPackage.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Terms */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2">
                <Checkbox
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) =>
                    updateField("termsAccepted", !!checked)
                  }
                  className="mt-0.5 border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-violet data-[state=checked]:border-violet"
                />
                <span className="text-xs leading-relaxed text-[#A1A1AA]">
                  I agree to the{" "}
                  <button type="button" className="text-violet hover:underline">
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button type="button" className="text-violet hover:underline">
                    Community Guidelines
                  </button>
                  . I confirm that all information provided is accurate and I am
                  at least 18 years old.
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          className={`border-[rgba(255,255,255,0.08)] bg-surface text-[#A1A1AA] hover:bg-[#1E1E2A] hover:text-[#F5F5F7] ${
            currentStep === 1 ? "invisible" : ""
          }`}
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {currentStep < STEPS.length ? (
            <Button
              className="bg-violet hover:bg-violet-hover disabled:opacity-40"
              disabled={!canGoNext()}
              onClick={handleNext}
            >
              Next
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button
              className="bg-violet hover:bg-violet-hover disabled:opacity-40"
              disabled={!canGoNext() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isEditing ? "Updating..." : "Submitting..."}
                </>
              ) : (
                isEditing ? "Update Listing" : "Submit Listing"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-400">{submitError}</p>
        </div>
      )}
    </div>
  );
}

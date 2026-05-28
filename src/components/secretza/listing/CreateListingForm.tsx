"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigationStore } from "@/store/useAppStore";

const AUTOSAVE_INTERVAL_MS = 3000;
const DRAFT_VERSION = 1;

type ListingFormValues = {
  title: string;
  description: string;
  price: string;
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

const emptyValues: ListingFormValues = {
  title: "",
  description: "",
  price: "",
};

function getDraftKey(editMode?: boolean, editListingId?: string | null) {
  if (editMode && editListingId) {
    return `secretza:listing-draft:edit:${editListingId}`;
  }

  return "secretza:listing-draft:create";
}

function hasDraftContent(values: ListingFormValues) {
  return Boolean(
    values.title.trim() ||
      values.description.trim() ||
      values.price.trim(),
  );
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
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const latestValuesRef = useRef(values);
  const restoredDraftRef = useRef(false);

  useEffect(() => {
    latestValuesRef.current = values;
  }, [values]);

  useEffect(() => {
    restoredDraftRef.current = false;

    try {
      const storedDraft = window.localStorage.getItem(draftKey);
      if (!storedDraft) return;

      const draft = JSON.parse(storedDraft) as Partial<ListingDraft>;
      if (draft.version !== DRAFT_VERSION || !draft.values) return;

      setValues({
        ...emptyValues,
        ...draft.values,
      });
      restoredDraftRef.current = hasDraftContent(draft.values);
      setLastSavedAt(draft.savedAt || null);
    } catch (error) {
      console.warn("Failed to restore listing draft", error);
    } finally {
      setDraftRestored(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftRestored || !editMode || !editListingId || restoredDraftRef.current) {
      return;
    }

    let cancelled = false;

    async function loadListingForEdit() {
      try {
        setLoading(true);
        const response = await fetch(`/api/listings/${editListingId}`);
        const listing = await response.json();

        if (!response.ok) {
          alert(listing.error || "Failed to load listing");
          navigate("dashboard", { tab: "listings" });
          return;
        }

        if (cancelled) return;

        setValues({
          title: listing.title || "",
          description: listing.description || "",
          price: listing.price?.toString() || "",
        });
      } catch (error) {
        console.error(error);
        alert("Failed to load listing");
        navigate("dashboard", { tab: "listings" });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadListingForEdit();

    return () => {
      cancelled = true;
    };
  }, [draftRestored, editListingId, editMode, navigate]);

  const saveDraft = useCallback(() => {
    const currentValues = latestValuesRef.current;

    try {
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
    } catch (error) {
      console.warn("Failed to save listing draft", error);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftRestored || loading) return;

    const intervalId = window.setInterval(saveDraft, AUTOSAVE_INTERVAL_MS);

    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        saveDraft();
      }
    };

    window.addEventListener("pagehide", saveDraft);
    document.addEventListener("visibilitychange", saveWhenHidden);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", saveDraft);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      saveDraft();
    };
  }, [draftRestored, loading, saveDraft]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDraftContent(latestValuesRef.current) || loading) return;

      saveDraft();
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [loading, saveDraft]);

  function updateField<K extends keyof ListingFormValues>(
    field: K,
    value: ListingFormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveDraft();

    try {
      setLoading(true);

      const response = await fetch(
        editMode && editListingId
          ? `/api/listings/${editListingId}`
          : "/api/listings/create",
        {
          method: editMode && editListingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: values.title,
            description: values.description,
            price: Number(values.price),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed");
        return;
      }

      alert(editMode ? "Listing updated successfully!" : "Listing created successfully!");
      console.log("[CreateListing] saved listing id", data.listing?.id);
      console.log("[CreateListing] saved userId", data.listing?.userId);

      window.localStorage.removeItem(draftKey);
      window.localStorage.setItem("dashboardPage", "listings");
      setValues(emptyValues);
      setLastSavedAt(null);
      navigate("dashboard", { tab: "listings" });
    } catch (error) {
      console.error(error);
      alert(editMode ? "Failed to update listing" : "Failed to create listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-10 text-white">
      <h1 className="text-5xl font-bold mb-8">
        {editMode ? "Edit Listing" : "Create New Listing"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="block mb-2 text-sm">
            Title
          </label>

          <input
            type="text"
            value={values.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
            placeholder="Listing title"
            required
          />
        </div>

        <div>
          <label className="block mb-2 text-sm">
            Description
          </label>

          <textarea
            value={values.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700 min-h-[180px]"
            placeholder="Write full description..."
            required
          />
        </div>

        <div>
          <label className="block mb-2 text-sm">
            Price
          </label>

          <input
            type="number"
            value={values.price}
            onChange={(e) => updateField("price", e.target.value)}
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700"
            placeholder="5000"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 transition px-8 py-4 rounded-xl font-semibold"
        >
          {loading
            ? editMode
              ? "Saving..."
              : "Creating..."
            : editMode
              ? "Save Changes"
              : "Create Listing"}
        </button>

        <p className="text-sm text-zinc-400">
          {lastSavedAt
            ? `Draft autosaved at ${new Date(lastSavedAt).toLocaleTimeString()}`
            : "Draft autosaves while you type."}
        </p>

      </form>
    </div>
  );
}
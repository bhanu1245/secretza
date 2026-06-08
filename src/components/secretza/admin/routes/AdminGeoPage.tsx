"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildGeoCascadeUrl,
  geoSubmitLabel,
  validateGeoForm,
  type GeoFormValues,
} from "@/lib/admin-geo-form";

type GeoType = "countries" | "states" | "cities" | "areas";

type GeoItem = {
  id: string;
  name: string;
  slug: string;
  code?: string;
  isActive: boolean;
  countryId?: string;
  stateId?: string;
  cityId?: string;
  country?: { id: string; name: string };
  state?: { id: string; name: string; country?: { id: string; name: string }; countryId?: string };
  city?: {
    id: string;
    name: string;
    stateId?: string;
    state?: { id: string; name: string; country?: { id: string; name: string } };
  };
  _count?: Record<string, number>;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const tabs: Array<{ id: GeoType; label: string; singular: string }> = [
  { id: "countries", label: "Countries", singular: "country" },
  { id: "states", label: "States", singular: "state" },
  { id: "cities", label: "Cities", singular: "city" },
  { id: "areas", label: "Areas", singular: "area" },
];

const emptyPagination: Pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };

const emptyForm: GeoFormValues = {
  name: "",
  slug: "",
  code: "",
  countryId: "",
  stateId: "",
  cityId: "",
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parentLabel(item: GeoItem, type: GeoType) {
  if (type === "states") return item.country?.name || "No country";
  if (type === "cities") {
    const country = item.state?.country?.name;
    const state = item.state?.name;
    return country && state ? `${state}, ${country}` : state || "No state";
  }
  if (type === "areas") {
    const city = item.city?.name;
    const state = item.city?.state?.name;
    const country = item.city?.state?.country?.name;
    return [city, state, country].filter(Boolean).join(", ") || "No city";
  }
  return item.code || "";
}

function fieldClass(disabled = false) {
  return `rounded-xl border border-white/10 bg-[#0B0B0F] px-3 py-2 text-sm outline-none ${
    disabled ? "cursor-not-allowed opacity-50" : ""
  }`;
}

function labelClass() {
  return "mb-1 block text-xs font-medium text-[#A1A1AA]";
}

export default function AdminGeoPage() {
  const [activeType, setActiveType] = useState<GeoType>("countries");
  const [items, setItems] = useState<GeoItem[]>([]);
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<GeoItem | null>(null);
  const [form, setForm] = useState<GeoFormValues>(emptyForm);

  const currentTab = tabs.find((tab) => tab.id === activeType) || tabs[0];

  const resetForm = useCallback(() => {
    setEditing(null);
    setForm(emptyForm);
  }, []);

  const loadCountries = useCallback(async () => {
    const countryRes = await fetch("/api/admin/geo/countries?limit=100");
    const countryData = await countryRes.json();
    setCountries(countryData.items || []);
  }, []);

  const loadStatesForCountry = useCallback(async (countryId: string) => {
    const url = buildGeoCascadeUrl("states", { countryId });
    if (!url) {
      setStates([]);
      return;
    }

    setLoadingStates(true);
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load states");
      setStates(data.items || []);
    } catch (error) {
      setStates([]);
      toast.error(error instanceof Error ? error.message : "Failed to load states");
    } finally {
      setLoadingStates(false);
    }
  }, []);

  const loadCitiesForState = useCallback(async (stateId: string) => {
    const url = buildGeoCascadeUrl("cities", { stateId });
    if (!url) {
      setCities([]);
      return;
    }

    setLoadingCities(true);
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load cities");
      setCities(data.items || []);
    } catch (error) {
      setCities([]);
      toast.error(error instanceof Error ? error.message : "Failed to load cities");
    } finally {
      setLoadingCities(false);
    }
  }, []);

  const loadItems = useCallback(async (page = pagination.page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/admin/geo/${activeType}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load geo records");
      setItems(data.items || []);
      setPagination(data.pagination || emptyPagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load geo records");
    } finally {
      setLoading(false);
    }
  }, [activeType, pagination.limit, pagination.page, search]);

  useEffect(() => {
    loadCountries().catch(() => toast.error("Failed to load countries"));
  }, [loadCountries]);

  useEffect(() => {
    if (activeType !== "cities" && activeType !== "areas") {
      setStates([]);
      return;
    }
    if (!form.countryId) {
      setStates([]);
      return;
    }
    loadStatesForCountry(form.countryId);
  }, [activeType, form.countryId, loadStatesForCountry]);

  useEffect(() => {
    if (activeType !== "cities" && activeType !== "areas") {
      setCities([]);
      return;
    }
    if (!form.stateId) {
      setCities([]);
      return;
    }
    loadCitiesForState(form.stateId);
  }, [activeType, form.stateId, loadCitiesForState]);

  useEffect(() => {
    resetForm();
    loadItems(1);
  }, [activeType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => loadItems(1), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  function startEdit(item: GeoItem) {
    const countryId =
      item.countryId ||
      item.country?.id ||
      item.state?.country?.id ||
      item.city?.state?.country?.id ||
      "";

    const stateId = item.stateId || item.state?.id || item.city?.state?.id || "";

    setEditing(item);
    setForm({
      name: item.name,
      slug: item.slug,
      code: item.code || "",
      countryId,
      stateId,
      cityId: item.cityId || item.city?.id || "",
    });
  }

  function updateCountry(countryId: string) {
    setForm((current) => ({
      ...current,
      countryId,
      stateId: "",
      cityId: "",
    }));
  }

  function updateState(stateId: string) {
    setForm((current) => ({
      ...current,
      stateId,
      cityId: "",
    }));
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();

    const validationError = validateGeoForm(activeType, form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const name = form.name.trim();
    const payload: Record<string, string | boolean> = {
      name,
      slug: form.slug.trim() || slugify(name),
    };
    if (editing) payload.id = editing.id;
    if (activeType === "countries") payload.code = form.code.trim() || slugify(name).slice(0, 2).toUpperCase();
    if (activeType === "states") payload.countryId = form.countryId;
    if (activeType === "cities") payload.stateId = form.stateId;
    if (activeType === "areas") payload.cityId = form.cityId;

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/geo/${activeType}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save geo record");
      toast.success(`${currentTab.singular} ${editing ? "updated" : "created"}`);
      resetForm();
      await Promise.all([
        loadCountries(),
        form.countryId ? loadStatesForCountry(form.countryId) : Promise.resolve(),
        form.stateId ? loadCitiesForState(form.stateId) : Promise.resolve(),
        loadItems(editing ? pagination.page : 1),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save geo record");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: GeoItem) {
    const response = await fetch(`/api/admin/geo/${activeType}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "Failed to update status");
      return;
    }
    await Promise.all([
      loadCountries(),
      form.countryId ? loadStatesForCountry(form.countryId) : Promise.resolve(),
      form.stateId ? loadCitiesForState(form.stateId) : Promise.resolve(),
      loadItems(),
    ]);
  }

  async function deleteItem(item: GeoItem) {
    if (!window.confirm(`Delete ${item.name}? Child records and listings may block this.`)) return;
    const response = await fetch(`/api/admin/geo/${activeType}?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "Failed to delete record");
      return;
    }
    toast.success(`${currentTab.singular} deleted`);
    await Promise.all([loadCountries(), loadItems(1)]);
  }

  const submitLabel = geoSubmitLabel(activeType, Boolean(editing));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Geo Management</h1>
        <p className="mt-1 text-sm text-[#A1A1AA]">Manage countries, states, cities, and areas used by listing forms.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={`rounded-lg border px-3 py-2 text-xs ${
              activeType === tab.id
                ? "border-[#7C3AED]/30 bg-[#7C3AED]/15 text-[#8B5CF6]"
                : "border-white/10 text-[#A1A1AA] hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={submitForm}
        className="space-y-4 rounded-2xl border border-white/10 bg-[#15151D] p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass()}>
              {activeType === "countries"
                ? "Country Name"
                : activeType === "states"
                  ? "State Name"
                  : activeType === "cities"
                    ? "City Name"
                    : "Area Name"}
            </label>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: editing ? current.slug : slugify(event.target.value),
                }))
              }
              placeholder="Name"
              required
              className={fieldClass()}
            />
          </div>

          <div>
            <label className={labelClass()}>Slug</label>
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
              placeholder="slug"
              required
              className={fieldClass()}
            />
          </div>

          {activeType === "countries" && (
            <div>
              <label className={labelClass()}>Code</label>
              <input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="IN"
                className={fieldClass()}
              />
            </div>
          )}

          {activeType === "states" && (
            <div>
              <label className={labelClass()}>Country</label>
              <select
                value={form.countryId}
                onChange={(event) => updateCountry(event.target.value)}
                required
                className={fieldClass()}
              >
                <option value="">Select country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeType === "cities" || activeType === "areas") && (
            <div>
              <label className={labelClass()}>Country</label>
              <select
                value={form.countryId}
                onChange={(event) => updateCountry(event.target.value)}
                required
                className={fieldClass()}
              >
                <option value="">Select country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeType === "cities" || activeType === "areas") && (
            <div>
              <label className={labelClass()}>State</label>
              <select
                value={form.stateId}
                onChange={(event) => updateState(event.target.value)}
                required
                disabled={!form.countryId || loadingStates}
                className={fieldClass(!form.countryId || loadingStates)}
              >
                <option value="">
                  {!form.countryId
                    ? "Select country first"
                    : loadingStates
                      ? "Loading states..."
                      : "Select state"}
                </option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeType === "areas" && (
            <div>
              <label className={labelClass()}>City</label>
              <select
                value={form.cityId}
                onChange={(event) => setForm((current) => ({ ...current, cityId: event.target.value }))}
                required
                disabled={!form.stateId || loadingCities}
                className={fieldClass(!form.stateId || loadingCities)}
              >
                <option value="">
                  {!form.stateId
                    ? "Select state first"
                    : loadingCities
                      ? "Loading cities..."
                      : "Select city"}
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-[#15151D]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-[#A1A1AA]">
            {loading ? "Loading..." : `${pagination.total} ${currentTab.label.toLowerCase()}`}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A1A1AA]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${currentTab.label.toLowerCase()}...`}
              className="w-full rounded-xl border border-white/10 bg-[#0B0B0F] py-2 pl-10 pr-3 text-sm outline-none"
            />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#A1A1AA]">No records found</div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_220px_130px_auto] lg:items-center">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[#A1A1AA]">{item.slug}</p>
                </div>
                <p className="text-sm text-[#A1A1AA]">{parentLabel(item, activeType)}</p>
                <span
                  className={`w-fit rounded-full px-2 py-1 text-xs ${
                    item.isActive ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                  }`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => startEdit(item)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                    <Edit2 className="mr-1 inline size-3" /> Edit
                  </button>
                  <button onClick={() => toggleItem(item)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                    {item.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300"
                  >
                    <Trash2 className="mr-1 inline size-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 p-4 text-sm text-[#A1A1AA]">
          <button
            disabled={pagination.page <= 1}
            onClick={() => loadItems(pagination.page - 1)}
            className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => loadItems(pagination.page + 1)}
            className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

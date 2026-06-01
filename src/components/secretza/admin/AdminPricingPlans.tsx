"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";

/**
 * PricingPlan — marketing metadata only.
 * Prices, durations, and limits are managed exclusively in
 * Admin → Payment Settings (PaymentSettings table).
 */
type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
};

const emptyPlan: Omit<Plan, "id"> = {
  name: "",
  slug: "",
  description: "",
  features: [],
  isActive: true,
  isPopular: false,
  sortOrder: 0,
};

export default function AdminPricingPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Partial<Plan>>(emptyPlan);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/pricing-plans");
    const data = await res.json();
    setPlans(data.plans || []);
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(load).catch(() => {
      toast.error("Failed to load pricing plans");
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const isEdit = Boolean(editing.id);
    const res = await fetch(isEdit ? `/api/admin/pricing-plans/${editing.id}` : "/api/admin/pricing-plans", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save plan");
      return;
    }
    toast.success("Pricing plan saved");
    setEditing(emptyPlan);
    await load();
  };

  const remove = async (plan: Plan) => {
    if (!confirm(`Delete ${plan.name}?`)) return;
    const res = await fetch(`/api/admin/pricing-plans/${plan.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete plan");
      return;
    }
    toast.success("Pricing plan deleted");
    await load();
  };

  const update = (key: keyof Plan, value: unknown) => {
    setEditing((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Pricing Plans</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Marketing copy for the public pricing page. Plan names, descriptions, and feature bullets only.</p>
      </div>

      {/* SOT notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <strong>Prices &amp; durations are managed in Admin → Payment Settings.</strong>{" "}
        This panel controls marketing display only (name, description, bullet points, display order).
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-6">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#F5F5F7]">{editing.id ? "Edit Plan" : "New Plan"}</h3>
            <button onClick={() => setEditing(emptyPlan)} className="text-xs text-[#8B5CF6] inline-flex items-center gap-1">
              <Plus className="size-3" /> New
            </button>
          </div>
          {(["name", "slug", "description"] as const).map((field) => (
            <input
              key={field}
              value={String(editing[field] || "")}
              onChange={(event) => update(field, event.target.value)}
              placeholder={field}
              className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          ))}
          <textarea
            value={(editing.features || []).join("\n")}
            onChange={(event) => update("features", event.target.value.split("\n"))}
            placeholder="Marketing bullet points, one per line"
            rows={5}
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <input
            type="number"
            value={Number(editing.sortOrder || 0)}
            onChange={(event) => update("sortOrder", Number(event.target.value))}
            placeholder="sortOrder"
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={editing.isActive !== false} onChange={(event) => update("isActive", event.target.checked)} />
            Active (show on pricing page)
          </label>
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={Boolean(editing.isPopular)} onChange={(event) => update("isPopular", event.target.checked)} />
            Show "Most Popular" badge
          </label>
          <button disabled={saving} onClick={save} className="w-full rounded-lg bg-[#7C3AED] py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60">
            <Save className="size-4 inline mr-2" /> {saving ? "Saving..." : "Save Plan"}
          </button>
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-[#A1A1AA]">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="p-8 text-sm text-[#A1A1AA]">No pricing plans yet.</div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.08)]">
              {plans.map((plan) => (
                <div key={plan.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#F5F5F7]">{plan.name}</h3>
                      {!plan.isActive && <span className="text-[10px] text-amber-300">Inactive</span>}
                      {plan.isPopular && <span className="text-[10px] text-[#8B5CF6]">Popular</span>}
                    </div>
                    <p className="text-xs text-[#A1A1AA]">{plan.slug} · order {plan.sortOrder}</p>
                    {plan.description && <p className="text-xs text-[#52525B] mt-0.5 truncate max-w-xs">{plan.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(plan)} className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-[#F5F5F7]">Edit</button>
                    <button onClick={() => remove(plan)} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300">
                      <Trash2 className="size-3 inline mr-1" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

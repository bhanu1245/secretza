"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, Tag } from "lucide-react";
import {
  COUPON_APPLIES_TO_LABELS,
  COUPON_APPLIES_TO_VALUES,
  type CouponAppliesTo,
} from "@/lib/coupon-scope";

type Coupon = {
  id: string;
  code: string;
  description?: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses: number;
  maxUsesPerUser: number;
  usedCount: number;
  appliesTo: CouponAppliesTo;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const emptyCoupon: Omit<Coupon, "id" | "usedCount" | "createdAt" | "updatedAt"> = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  maxUses: 0,
  maxUsesPerUser: 0,
  appliesTo: "all",
  isActive: true,
  expiresAt: null,
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<Partial<Coupon>>(emptyCoupon);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/coupons");
    if (!res.ok) {
      toast.error("Failed to load coupons");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCoupons(data.coupons || []);
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const save = async () => {
    setSaving(true);
    const isEdit = Boolean(editing.id);
    const payload = {
      ...editing,
      expiresAt: editing.expiresAt || null,
    };
    const res = await fetch(isEdit ? `/api/admin/coupons/${editing.id}` : "/api/admin/coupons", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save coupon");
      return;
    }
    toast.success(isEdit ? "Coupon updated" : "Coupon created");
    setEditing(emptyCoupon);
    await load();
  };

  const remove = async (coupon: Coupon) => {
    if (!confirm(`Delete coupon ${coupon.code}?`)) return;
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to delete coupon");
      return;
    }
    toast.success(data.softDeleted ? "Coupon deactivated (has usage history)" : "Coupon deleted");
    await load();
  };

  const update = (key: keyof Coupon, value: unknown) => {
    setEditing((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Coupons</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Create percentage or fixed discounts with expiry and usage limits.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Tag className="size-4 text-[#7C3AED]" />
              {editing.id ? "Edit Coupon" : "New Coupon"}
            </h3>
            <button
              onClick={() => setEditing(emptyCoupon)}
              className="text-xs text-[#8B5CF6] inline-flex items-center gap-1"
            >
              <Plus className="size-3" /> New
            </button>
          </div>

          <input
            value={String(editing.code || "")}
            onChange={(e) => update("code", e.target.value.toUpperCase())}
            placeholder="CODE (e.g. SAVE20)"
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <input
            value={String(editing.description || "")}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={editing.discountType || "percentage"}
              onChange={(e) => update("discountType", e.target.value)}
              className="rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
            <input
              type="number"
              min={0}
              step={editing.discountType === "percentage" ? 1 : 0.01}
              value={editing.discountValue ?? 0}
              onChange={(e) => update("discountValue", Number(e.target.value))}
              placeholder={editing.discountType === "percentage" ? "Discount %" : "Discount ₹"}
              className="rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              value={editing.maxUses ?? 0}
              onChange={(e) => update("maxUses", Number(e.target.value))}
              placeholder="Max uses (0 = unlimited)"
              className="rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
            />
            <input
              type="number"
              min={0}
              value={editing.maxUsesPerUser ?? 0}
              onChange={(e) => update("maxUsesPerUser", Number(e.target.value))}
              placeholder="Per user (0 = unlimited, 1 = one-time)"
              className="rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>

          <input
            type="datetime-local"
            value={
              editing.expiresAt
                ? new Date(editing.expiresAt).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              update("expiresAt", e.target.value ? new Date(e.target.value).toISOString() : null)
            }
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          />

          <select
            value={editing.appliesTo || "all"}
            onChange={(e) => update("appliesTo", e.target.value)}
            className="w-full rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7]"
          >
            {COUPON_APPLIES_TO_VALUES.map((value) => (
              <option key={value} value={value}>
                {COUPON_APPLIES_TO_LABELS[value]}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input
              type="checkbox"
              checked={Boolean(editing.isActive ?? true)}
              onChange={(e) => update("isActive", e.target.checked)}
            />
            Active
          </label>

          <button
            disabled={saving}
            onClick={save}
            className="w-full rounded-lg bg-[#7C3AED] py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60"
          >
            <Save className="size-4 inline mr-2" />
            {saving ? "Saving..." : editing.id ? "Update Coupon" : "Create Coupon"}
          </button>
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
            <h3 className="font-semibold text-[#F5F5F7]">All Coupons ({coupons.length})</h3>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-[#A1A1AA]">Loading...</p>
          ) : coupons.length === 0 ? (
            <p className="p-5 text-sm text-[#A1A1AA]">No coupons yet.</p>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.06)]">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#F5F5F7]">{coupon.code}</span>
                      {!coupon.isActive && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#A1A1AA] mt-1">
                      {coupon.discountType === "percentage"
                        ? `${coupon.discountValue}% off`
                        : `₹${coupon.discountValue} off`}
                      {" · "}
                      {COUPON_APPLIES_TO_LABELS[coupon.appliesTo ?? "all"]}
                      {" · "}
                      Used {coupon.usedCount}
                      {coupon.maxUses > 0 ? ` / ${coupon.maxUses}` : ""}
                      {coupon.maxUsesPerUser === 1 ? " · One-time per user" : ""}
                    </p>
                    {coupon.expiresAt && (
                      <p className="text-xs text-[#52525B] mt-1">
                        Expires {new Date(coupon.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(coupon)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(coupon)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="size-3.5 inline" />
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

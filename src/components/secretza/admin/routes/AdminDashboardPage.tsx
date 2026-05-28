"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { CreditCard, DollarSign, FileText, Users } from "lucide-react";

type AdminStats = {
  totalUsers: number;
  totalListings: number;
  pendingReview: number;
  pendingPayments: number;
  totalRevenue: number;
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#A1A1AA]">{label}</p>
        <div className="size-10 rounded-xl bg-[#7C3AED]/15 flex items-center justify-center">
          <Icon className="size-5 text-[#8B5CF6]" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-[#F5F5F7]">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/admin/stats");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load stats");
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      }
    }

    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">Overview of users, listings, payments, and revenue.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Users" value={stats?.totalUsers ?? "-"} icon={Users} />
        <StatCard label="Total Listings" value={stats?.totalListings ?? "-"} icon={FileText} />
        <StatCard label="Pending Listings" value={stats?.pendingReview ?? "-"} icon={FileText} />
        <StatCard label="Pending Payments" value={stats?.pendingPayments ?? "-"} icon={CreditCard} />
        <StatCard label="Revenue Summary" value={`₹${Math.round(stats?.totalRevenue ?? 0)}`} icon={DollarSign} />
      </div>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
        <h2 className="text-lg font-semibold">Revenue Summary Placeholder</h2>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          Detailed revenue charts can be added here once payment reporting is finalized.
        </p>
      </div>
    </div>
  );
}

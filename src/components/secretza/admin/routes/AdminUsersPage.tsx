"use client";

import { useEffect, useState } from "react";
import { Search, ShieldCheck, UserX } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isVerified: boolean;
  isSuspended: boolean;
  isPremium: boolean;
  createdAt: string;
  _count: { listings: number; payments: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        const response = await fetch(`/api/admin/users${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load users");
        setUsers(data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    const timer = window.setTimeout(loadUsers, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">View user accounts, roles, verification, and listing counts.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A1A1AA]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users..."
          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#7C3AED]/40"
        />
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D]">
        <div className="border-b border-[rgba(255,255,255,0.08)] px-4 py-3 text-xs uppercase tracking-wide text-[#A1A1AA]">
          {loading ? "Loading..." : `${users.length} users`}
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#A1A1AA]">No users found</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="grid gap-4 border-b border-[rgba(255,255,255,0.06)] p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{user.name || user.email}</h2>
                  <span className="rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/15 px-2 py-0.5 text-[10px] uppercase text-[#8B5CF6]">
                    {user.role}
                  </span>
                  {user.isVerified && <ShieldCheck className="size-4 text-emerald-400" />}
                  {user.isSuspended && <UserX className="size-4 text-red-400" />}
                </div>
                <p className="mt-1 text-sm text-[#A1A1AA]">{user.email}</p>
                <p className="mt-1 text-xs text-[#52525B]">
                  {user._count.listings} listings · {user._count.payments} payments · Joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="text-sm text-[#A1A1AA]">
                {user.isPremium ? "Premium" : "Standard"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  Grid3X3,
  Globe,
  CreditCard,
  Receipt,
  Tag,
  FileEdit,
  BarChart3,
  Settings,
  Menu,
  X,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  UserCheck,
  UserX,
  ShieldCheck,
  Star,
  Clock,
  MoreHorizontal,
  ArrowUpRight,
  Ban,
  BadgeCheck,
  Zap,
  ImageIcon,
  Flag,
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  ExternalLink,
  Upload,
  Plus,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AdminSocialSettings from "@/components/secretza/admin/AdminSocialSettings";
import { BRAND_NAME } from "@/lib/brand";
import { logError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/useAppStore";
import { formatNumber } from "@/lib/utils";
import {
  formatRevenueAmount,
  formatRevenueAxisTick,
  formatRevenueCompact,
} from "@/lib/currency-format";
import { DEFAULT_ADMIN_REVENUE_CURRENCY } from "@/lib/payment-settings";
import { DEFAULT_GA_MEASUREMENT_ID } from "@/lib/analytics-constants";
import type { ListingStatus, User, ModerationItem } from "@/lib/types";
import { toast } from "sonner";
import AdminGeoPage from "@/components/secretza/admin/routes/AdminGeoPage";
import SeoManager from "@/components/secretza/admin/SeoManager";
import SeoDashboard from "@/components/secretza/admin/SeoDashboard";
import SeoAuditPanel from "@/components/secretza/admin/SeoAuditPanel";
import SeoRegenerationPanel from "@/components/secretza/admin/SeoRegenerationPanel";
import { AdminReviewQueue, AdminReviewAnalytics } from "@/components/secretza/admin/AdminReviewPanel";
import CategoryManager from "@/components/secretza/admin/CategoryManager";
import { resolveAdminListingThumbnail } from "@/lib/listing-images";
import AdminPricingPlans from "@/components/secretza/admin/AdminPricingPlans";
import AdminCmsPages from "@/components/secretza/admin/AdminCmsPages";
import AdminReportsPage from "@/components/secretza/admin/AdminReportsPage";

interface AdminStatsData {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  pendingReview: number;
  totalRevenue: number;
  revenueCurrency?: string;
  featuredListings: number;
  premiumUsers: number;
  monthlyRevenue: Array<{ month: string; revenue: number; listings: number }>;
}

function RevenueChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  currency: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#15151D] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 shadow-xl">
        <p className="text-xs font-medium text-[#A1A1AA] mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {formatRevenueAmount(entry.value, currency)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// Extracted admin page components
export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<Array<{ month: string; revenue: number; listings: number }>>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  // Fetch admin stats + monthly revenue
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        const data = await response.json();
        if (data && !data.error) {
          setStats(data);
          if (data.monthlyRevenue && data.monthlyRevenue.length > 0) {
            setRevenueData(data.monthlyRevenue);
          }
        }
      } catch (error) {
        logError(error, { component: "AdminPanel" });
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  // Fetch recent listings
  useEffect(() => {
    const loadListings = async () => {
      try {
        const response = await fetch("/api/admin/listings");
        const data = await response.json();
        setListings(data.listings || []);
      } catch (error) {
        logError(error, { component: "AdminPanel" });
      }
    };
    loadListings();
  }, []);

  // Fetch pending listings for moderation queue
  useEffect(() => {
    const loadPending = async () => {
      try {
        const response = await fetch("/api/admin/listings?status=pending&limit=5");
        const data = await response.json();
        setPendingItems(data.listings || []);
      } catch {
        // silently fail
      }
    };
    loadPending();
  }, []);

  const recentListings = listings.slice(0, 5);
  const revenueCurrency = stats?.revenueCurrency ?? DEFAULT_ADMIN_REVENUE_CURRENCY;

  const statsCards = stats
    ? [
        { label: "Total Users", value: formatNumber(stats.totalUsers), icon: Users, color: "#7C3AED", bg: "rgba(124,58,237,0.1)" },
        { label: "Total Listings", value: formatNumber(stats.totalListings), icon: FileText, color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
        { label: "Active Listings", value: formatNumber(stats.activeListings), icon: TrendingUp, color: "#10B981", bg: "rgba(16,185,129,0.1)" },
        { label: "Pending Review", value: stats.pendingReview.toString(), icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
        {
          label: "Total Revenue",
          value: formatRevenueCompact(stats.totalRevenue, revenueCurrency),
          icon: IndianRupee,
          color: "#10B981",
          bg: "rgba(16,185,129,0.1)",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Dashboard</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Platform overview and key metrics.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.04)]">
                    <div className="w-4 h-4 bg-[rgba(255,255,255,0.08)] rounded animate-pulse" />
                  </div>
                  <div className="w-12 h-3 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
                </div>
                <div className="w-20 h-6 bg-[rgba(255,255,255,0.06)] rounded animate-pulse mb-1" />
                <div className="w-16 h-2.5 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : (
          statsCards.map((stat) => (
          <Card key={stat.label} className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(124,58,237,0.2)] transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-end mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="size-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-xl font-bold text-[#F5F5F7]">{stat.value}</p>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
          ))
        )}
      </div>

      {/* Revenue Chart + Moderation Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#F5F5F7]">Revenue Overview</CardTitle>
            <CardDescription className="text-xs text-[#A1A1AA]">
              Monthly revenue for the past 8 months ({revenueCurrency})
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#A1A1AA", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                  <YAxis
                    tick={{ fill: "#A1A1AA", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatRevenueAxisTick(v, revenueCurrency)}
                  />
                  <Tooltip
                    content={<RevenueChartTooltip currency={revenueCurrency} />}
                    cursor={{ fill: "rgba(124,58,237,0.05)" }}
                  />
                  <Bar dataKey="revenue" fill="#7C3AED" radius={[6, 6, 0, 0]} name={`Revenue (${revenueCurrency})`} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Moderation Queue Preview */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Shield className="size-4 text-[#F59E0B]" />
              Moderation Queue
            </CardTitle>
            <CardDescription className="text-xs text-[#A1A1AA]">
              {stats?.pendingReview ?? 0} items pending review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {pendingItems.length === 0 ? (
              <div className="text-center py-6">
                <ShieldCheck className="size-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-[#A1A1AA]">No pending items</p>
              </div>
            ) : (
              pendingItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.04)]">
                <div className="w-10 h-10 rounded-md bg-[rgba(255,255,255,0.04)] flex-shrink-0 flex items-center justify-center">
                  <FileText className="size-4 text-[#52525B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F5F5F7] truncate">{item.title}</p>
                  <p className="text-[10px] text-[#A1A1AA] mt-0.5">{item.category?.name || "Uncategorized"}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    (item.riskScore ?? 0) > 70
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : (item.riskScore ?? 0) > 30
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  }`}
                >
                  {item.riskScore ?? 0}
                </Badge>
              </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Listings */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-[#F5F5F7]">Recent Listings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="text-left px-6 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Listing</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">Views</th>
                </tr>
              </thead>
              <tbody>
                {recentListings.map((listing) => (
                  <tr key={listing.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={resolveAdminListingThumbnail(listing)} alt="" className="w-8 h-8 rounded-md object-cover" />
                        <span className="text-sm text-[#F5F5F7] truncate max-w-[200px]">{listing.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.category.name}</td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.city.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full">
                        {listing.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA] text-right">{listing.viewCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// Admin Users Page
// ==========================================
export function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Array<User & { listings: number }>>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersTotal, setUsersTotal] = useState(0);

  // Fetch real users from API
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/admin/users?limit=50");
        const data = await response.json();
        if (data && !data.error) {
          setUsersTotal(data.total || 0);
          setUsers(
            (data.users || []).map((u: any) => ({
              ...u,
              listings: u._count?.listings ?? 0,
            }))
          );
        }
      } catch (error) {
        logError(error, { component: "AdminPanel" });
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      !searchQuery ||
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSuspend = async (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const action = target.isSuspended ? "unsuspend" : "suspend";
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, isSuspended: !u.isSuspended } : u))
        );
        toast.success(`User ${action === "suspend" ? "suspended" : "unsuspended"}`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action} user`);
      }
    } catch {
      toast.error(`Network error while trying to ${action} user`);
    }
  };

  const toggleVerify = async (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, isVerified: !u.isVerified } : u))
        );
        toast.success(`User ${target.isVerified ? "unverified" : "verified"}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to verify user");
      }
    } catch {
      toast.error("Network error while trying to verify user");
    }
  };

  const changeRole = async (id: string, role: User["role"]) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setRole", role }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role } : u))
        );
        toast.success(`Role changed to ${role}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to change role");
      }
    } catch {
      toast.error("Network error while changing role");
    }
  };

  if (usersLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">Users</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">Loading users...</p>
        </div>
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#7C3AED]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">Users</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            {formatNumber(usersTotal)} total users
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-9 rounded-lg text-sm"
          />
        </div>
      </div>

      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  {["Name", "Email", "Role", "Status", "Listings", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {user.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm text-[#F5F5F7] font-medium">{user.name}</p>
                          {user.isPremium && (
                            <span className="text-[10px] text-amber-400">Premium</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          user.role === "admin"
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : user.role === "moderator"
                            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                            : "bg-[rgba(255,255,255,0.04)] text-[#A1A1AA] border-[rgba(255,255,255,0.08)]"
                        }`}
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {user.isSuspended && (
                          <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 rounded-full">
                            Suspended
                          </Badge>
                        )}
                        {user.isVerified ? (
                          <BadgeCheck className="size-4 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] text-[#52525B]">Unverified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{user.listings}</td>
                    <td className="px-4 py-3 text-xs text-[#52525B]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSuspend(user.id)}
                          title={user.isSuspended ? "Unsuspend" : "Suspend"}
                          className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                        >
                          {user.isSuspended ? (
                            <UserCheck className="size-3.5 text-emerald-400" />
                          ) : (
                            <Ban className="size-3.5 text-red-400" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleVerify(user.id)}
                          title={user.isVerified ? "Unverify" : "Verify"}
                          className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                        >
                          <ShieldCheck className={`size-3.5 ${user.isVerified ? "text-emerald-400" : "text-[#52525B]"}`} />
                        </button>
                        <select
                          value={user.role}
                          onChange={(e) => changeRole(user.id, e.target.value as User["role"])}
                          className="bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] text-[10px] text-[#A1A1AA] rounded px-1.5 py-1 h-7 focus:outline-none focus:border-[#7C3AED]"
                        >
                          <option value="user">User</option>
                          <option value="moderator">Mod</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// Admin Listings Page
// ==========================================
export function AdminListingsPage() {
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const statuses: (ListingStatus | "all")[] = ["all", "approved", "pending", "rejected", "expired"];

  useEffect(() => {
  const loadListings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/listings");
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Failed to load listings (${response.status})`);
      }

      setListings(data.listings || []);
    } catch (error) {
      logError(error, { component: "AdminPanel" });
      setError(error instanceof Error ? error.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  loadListings();
}, []);

  const handleListingAction = async (listingId: string, action: "approve" | "reject" | "feature" | "unfeature" | "delete") => {
    try {
      const res = await fetch(`/api/admin/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setListings((prev) => {
          if (action === "delete") return prev.filter((l) => l.id !== listingId);
          return prev.map((l) => {
            if (l.id !== listingId) return l;
            switch (action) {
              case "approve": return { ...l, status: "approved" };
              case "reject": return { ...l, status: "rejected" };
              case "feature": return { ...l, isFeatured: true };
              case "unfeature": return { ...l, isFeatured: false };
              default: return l;
            }
          });
        });
        toast.success(`Listing ${action === "delete" ? "deleted" : `${action}d`}`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action} listing`);
      }
    } catch {
      toast.error(`Network error while trying to ${action} listing`);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject" | "feature") => {
    const count = selected.size;
    for (const id of selected) {
      await handleListingAction(id, action);
    }
    setSelected(new Set());
    toast.success(`${count} listings ${action}d`);
  };

  const filteredListings = listings.filter(
    (l) => statusFilter === "all" || l.status === statusFilter
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredListings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredListings.map((l) => l.id)));
    }
  };

  if (loading) {
  return (
    <div className="p-6">
      Loading listings...
    </div>
  );
}
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Listings</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Manage all listings on the platform.
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-sm text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Filters & Bulk Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                statusFilter === status
                  ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                  : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs text-[#A1A1AA]">{selected.size} selected</span>
            <Button size="sm" onClick={() => handleBulkAction("approve")} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              <CheckCircle className="size-3 mr-1" /> Approve
            </Button>
            <Button size="sm" onClick={() => handleBulkAction("reject")} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg">
              <XCircle className="size-3 mr-1" /> Reject
            </Button>
            <Button size="sm" onClick={() => handleBulkAction("feature")} className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
              <Star className="size-3 mr-1" /> Feature
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={selected.size === filteredListings.length && filteredListings.length > 0}
                      onCheckedChange={toggleAll}
                      className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
                    />
                  </th>
                  {["Title", "Category", "Location", "Status", "Views", "Featured", "Date", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredListings.slice(0, 10).map((listing) => (
                  <tr key={listing.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selected.has(listing.id)}
                        onCheckedChange={() => toggleSelect(listing.id)}
                        className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <img src={resolveAdminListingThumbnail(listing)} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                        <span className="text-sm text-[#F5F5F7] truncate max-w-[200px]">{listing.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.category.name}</td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.city.name}, {listing.country.code}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          listing.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : listing.status === "pending"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : listing.status === "rejected"
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                        }`}
                      >
                        {listing.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A1A1AA]">{listing.viewCount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {listing.isFeatured ? (
                        <Star className="size-4 text-amber-400 fill-amber-400" />
                      ) : (
                        <span className="text-[10px] text-[#52525B]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525B]">
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedListingId(listing.id)}
                          className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#A1A1AA] hover:text-[#F5F5F7] transition-colors"
                          title="View"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleListingAction(listing.id, "approve")}
                          className="p-1.5 rounded-md hover:bg-emerald-500/10 text-[#A1A1AA] hover:text-emerald-400 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleListingAction(listing.id, "reject")}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleListingAction(listing.id, "delete")}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Listing Detail Dialog */}
      <Dialog
        open={!!selectedListingId}
        onOpenChange={(open) => !open && setSelectedListingId(null)}
      >
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">
              {listings.find((l) => l.id === selectedListingId)?.title || "Listing Details"}
            </DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Listing ID: {selectedListingId}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const listing = listings.find((l) => l.id === selectedListingId);
            if (!listing) return null;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-[#1E1E2A] p-3">
                    <span className="text-[10px] text-[#52525B] uppercase">Status</span>
                    <p className="text-[#F5F5F7] font-medium capitalize">{listing.status}</p>
                  </div>
                  <div className="rounded-lg bg-[#1E1E2A] p-3">
                    <span className="text-[10px] text-[#52525B] uppercase">Views</span>
                    <p className="text-[#F5F5F7] font-medium">{listing.viewCount?.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-[#1E1E2A] p-3">
                    <span className="text-[10px] text-[#52525B] uppercase">Category</span>
                    <p className="text-[#F5F5F7] font-medium">{listing.category?.name}</p>
                  </div>
                  <div className="rounded-lg bg-[#1E1E2A] p-3">
                    <span className="text-[10px] text-[#52525B] uppercase">Location</span>
                    <p className="text-[#F5F5F7] font-medium">{listing.city?.name}, {listing.country?.code}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-[#1E1E2A] p-3">
                  <span className="text-[10px] text-[#52525B] uppercase">Description</span>
                  <p className="text-sm text-[#A1A1AA] mt-1 line-clamp-4">{listing.description || "No description"}</p>
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleListingAction(listing.id, "approve");
                      setSelectedListingId(null);
                    }}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    <CheckCircle className="size-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      handleListingAction(listing.id, "reject");
                      setSelectedListingId(null);
                    }}
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    <XCircle className="size-3 mr-1" /> Reject
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// Image Moderation Sub-component
// ==========================================
export function ImageModerationPanel() {
  const [images, setImages] = useState<Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    mediumUrl: string;
    width: number;
    height: number;
    moderationStatus: string;
    moderationReason?: string;
    isFlagged: boolean;
    createdAt: string;
    listing?: { id: string; title: string; status: string; userId: string };
  }>>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, flagged: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/upload/moderate?status=${status}&limit=50`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load queue (${res.status})`);
      }
      const data = await res.json();
      setImages(data.images || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moderation queue");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages(statusFilter);
  }, [statusFilter, fetchImages]);

  const handleModerate = async (imageId: string, action: "approve" | "reject" | "flag") => {
    setProcessingId(imageId);
    try {
      const res = await fetch("/api/upload/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(imageId);
          return next;
        });
        toast.success(`Image ${action}d`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to moderate image");
      }
    } catch {
      toast.error("Failed to moderate image. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkModerate = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    setProcessingId("bulk");
    try {
      const res = await fetch("/api/upload/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [...selectedIds], action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.stats) setStats(data.stats);
        setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
        setSelectedIds(new Set());
        toast.success(`Bulk ${action}: ${data.results?.filter((r: { success: boolean }) => r.success).length ?? 0} images`);
        await fetchImages(statusFilter);
      } else {
        toast.error(data.error || "Bulk moderation failed");
      }
    } catch {
      toast.error("Bulk moderation failed");
    } finally {
      setProcessingId(null);
    }
  };

  const statusCounts = stats;

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["pending", "flagged", "rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === status
                ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {statusCounts[status as keyof typeof statusCounts] > 0 && (
              <span className="ml-1.5 text-[10px] opacity-60">{statusCounts[status as keyof typeof statusCounts]}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => fetchImages(statusFilter)}
          className="px-3 py-1.5 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-1"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
        {selectedIds.size > 0 && (
          <>
            <Button size="sm" onClick={() => handleBulkModerate("approve")} className="h-7 text-xs bg-emerald-600">
              Approve {selectedIds.size}
            </Button>
            <Button size="sm" onClick={() => handleBulkModerate("reject")} className="h-7 text-xs bg-red-600">
              Reject {selectedIds.size}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
      )}

      {/* Image Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="size-12 text-emerald-400 mx-auto mb-4" />
          <p className="text-[#F5F5F7] font-medium">No images to review</p>
          <p className="text-sm text-[#A1A1AA] mt-1">
            {statusFilter === "pending"
              ? "All images have been reviewed."
              : `No ${statusFilter} images found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="bg-[#15151D] border-[rgba(255,255,255,0.08)] overflow-hidden group">
              <div className="relative aspect-[3/4] overflow-hidden">
                <label className="absolute top-2 right-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(image.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(image.id);
                        else next.delete(image.id);
                        return next;
                      });
                    }}
                    className="size-4"
                  />
                </label>
                <img
                  src={image.mediumUrl || image.thumbnailUrl || image.url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {image.isFlagged && (
                  <Badge className="absolute top-2 left-2 bg-red-500/90 text-white border-0 text-[9px] px-1.5 py-0">
                    <Flag className="size-2.5 mr-0.5" />
                    Flagged
                  </Badge>
                )}
                {image.moderationReason && (
                  <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white border-0 text-[9px] px-1.5 py-0 max-w-[100px] truncate">
                    {image.moderationReason}
                  </Badge>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-[10px] text-white/80 truncate">
                    {image.listing?.title || "No listing"}
                  </p>
                  <p className="text-[9px] text-white/50">
                    {image.width}×{image.height}
                  </p>
                </div>
              </div>
              <div className="p-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={processingId === image.id}
                  onClick={() => handleModerate(image.id, "approve")}
                  className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  {processingId === image.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle className="size-3 mr-0.5" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  disabled={processingId === image.id}
                  onClick={() => handleModerate(image.id, "reject")}
                  className="h-7 px-2.5 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  <XCircle className="size-3" />
                </Button>
                <Button
                  size="sm"
                  disabled={processingId === image.id}
                  onClick={() => handleModerate(image.id, "flag")}
                  className="h-7 px-2.5 text-[10px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                >
                  <Flag className="size-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Admin Moderation Page
// ==========================================
export function AdminModerationPage() {
  const [tab, setTab] = useState("listings");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
  const loadItems = async () => {
    try {
      const response = await fetch("/api/admin/listings?status=pending");
      const data = await response.json();

      const moderationItems = (data.listings || []).map((listing: any) => ({
        listing,
        riskScore: listing.riskScore || 0,
        issues: [],
      }));

      setItems(moderationItems);
    } catch (error) {
      logError(error, { component: "AdminPanel" });
    }
  };

  loadItems();
}, []);

  const approveItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.listing.id !== id));
        toast.success("Listing approved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to approve listing");
      }
    } catch {
      toast.error("Network error while approving listing");
    }
  };

  const rejectItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.listing.id !== id));
        toast.success("Listing rejected");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reject listing");
      }
    } catch {
      toast.error("Network error while rejecting listing");
    }
  };

  const getRiskBadge = (score: number) => {
    if (score < 30) return { label: "Low Risk", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bar: "#10B981" };
    if (score < 70) return { label: "Medium Risk", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", bar: "#F59E0B" };
    return { label: "High Risk", color: "bg-red-500/15 text-red-400 border-red-500/30", bar: "#EF4444" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Moderation</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Review and moderate pending listings and images. AI-powered risk analysis helps prioritize reviews.
        </p>
      </div>

      {/* Tab Switcher */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)]">
          <TabsTrigger value="listings" className="text-xs data-[state=active]:bg-[#7C3AED]/15 data-[state=active]:text-[#8B5CF6]">
            <FileText className="size-3.5 mr-1.5" />
            Listings
          </TabsTrigger>
          <TabsTrigger value="images" className="text-xs data-[state=active]:bg-[#7C3AED]/15 data-[state=active]:text-[#8B5CF6]">
            <ImageIcon className="size-3.5 mr-1.5" />
            Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#F5F5F7]">{items.filter((i) => i.riskScore < 30).length}</p>
                  <p className="text-[10px] text-[#A1A1AA]">Low Risk (Auto-approve)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="size-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#F5F5F7]">{items.filter((i) => i.riskScore >= 30 && i.riskScore < 70).length}</p>
                  <p className="text-[10px] text-[#A1A1AA]">Medium Risk (Review needed)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Shield className="size-4 text-red-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#F5F5F7]">{items.filter((i) => i.riskScore >= 70).length}</p>
                  <p className="text-[10px] text-[#A1A1AA]">High Risk (Urgent review)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Moderation Queue */}
          {items.length === 0 ? (
            <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
              <CardContent className="py-16 text-center">
                <ShieldCheck className="size-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-[#F5F5F7] font-medium">All caught up!</p>
                <p className="text-sm text-[#A1A1AA] mt-1">No pending items to review.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const risk = getRiskBadge(item.riskScore);
                const thumbnail = resolveAdminListingThumbnail(item.listing);
                return (
                  <Card key={item.listing.id} className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(124,58,237,0.2)] transition-all">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Listing Preview */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <img
                            src={thumbnail}
                            alt={item.listing.title}
                            className="w-20 h-24 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-sm font-semibold text-[#F5F5F7] truncate">{item.listing.title}</h3>
                                <p className="text-xs text-[#A1A1AA] mt-0.5">
                                  {item.listing.category.name} &middot; {item.listing.city.name},{" "}
                                  {item.listing.country.name}
                                </p>
                                <p className="text-xs text-[#A1A1AA] mt-0.5">
                                  By {item.listing.user.name}
                                </p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${risk.color}`}>
                                {risk.label} ({item.riskScore})
                              </Badge>
                            </div>

                            {/* Risk Score Bar */}
                            <div className="mt-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-[#A1A1AA]">AI Risk Score</span>
                                <span className="text-[10px] font-bold" style={{ color: risk.bar }}>{item.riskScore}/100</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${item.riskScore}%`, backgroundColor: risk.bar }}
                                />
                              </div>
                            </div>

                            {/* Issues */}
                            {item.issues.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {item.issues.map((issue, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] px-2 py-0.5 rounded-full"
                                  >
                                    {issue}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex lg:flex-col gap-2 lg:items-end flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => approveItem(item.listing.id)}
                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg"
                          >
                            <CheckCircle className="size-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => rejectItem(item.listing.id)}
                            className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg"
                          >
                            <XCircle className="size-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImageModerationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==========================================
// Admin Settings Page
// ==========================================
export function AdminSettingsPage() {
  const [gaMeasurementId, setGaMeasurementId] = useState(DEFAULT_GA_MEASUREMENT_ID);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsSaving, setAnalyticsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/site-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const savedId = data?.analytics?.gaMeasurementId;
        if (!cancelled && typeof savedId === "string" && savedId.trim()) {
          setGaMeasurementId(savedId.trim().toUpperCase());
        }
      })
      .catch(() => {
        // Keep the provided production GA4 ID as the editable default.
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveAnalyticsSettings = async () => {
    setAnalyticsSaving(true);
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analytics: {
            gaMeasurementId,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to save analytics settings.");
      }

      const savedId = data?.analytics?.gaMeasurementId;
      if (typeof savedId === "string") {
        setGaMeasurementId(savedId);
      }
      alert("Settings saved.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setAnalyticsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Settings</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Configure platform settings and preferences.</p>
      </div>

      <AdminSocialSettings />

      {/* General Settings */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#F5F5F7]">General Settings</CardTitle>
          <CardDescription className="text-xs text-[#A1A1AA]">Basic platform configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#A1A1AA]">Site Name</Label>
              <Input defaultValue={BRAND_NAME} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-[#A1A1AA]">Site Description</Label>
              <Input defaultValue="Premium Adult Classifieds Platform" className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#A1A1AA]">Default Listing Duration (days)</Label>
              <Input type="number" defaultValue="30" className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-[#A1A1AA]">Auto-approve Threshold (risk score)</Label>
              <Input type="number" defaultValue="30" className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-[#A1A1AA]">Max Images Per Listing</Label>
              <Input type="number" defaultValue="20" className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UPI Payment Settings */}
      <UPIPaymentSettings />

      {/* SEO Settings */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#F5F5F7]">SEO Settings</CardTitle>
          <CardDescription className="text-xs text-[#A1A1AA]">Search engine optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#A1A1AA]">Meta Title</Label>
            <Input defaultValue={`${BRAND_NAME} - Premium Adult Classifieds`} className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#A1A1AA]">Meta Description</Label>
            <textarea
              rows={3}
              defaultValue={`Browse thousands of verified adult classifieds worldwide. Escorts, massage, dating and more on ${BRAND_NAME}.`}
              className="w-full bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] text-[#F5F5F7] rounded-lg px-3 py-2 text-sm placeholder:text-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#A1A1AA]">Analytics ID (GA4)</Label>
            <Input
              value={gaMeasurementId}
              onChange={(event) => setGaMeasurementId(event.target.value)}
              placeholder="G-XXXXXXXXXX"
              disabled={analyticsLoading || analyticsSaving}
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveAnalyticsSettings}
          disabled={analyticsLoading || analyticsSaving}
          className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-lg shadow-md shadow-[#7C3AED]/20"
        >
          {analyticsSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Types for Payment Settings Admin UI
// ==========================================
interface PricingTier {
  label: string;
  amount: number;
  durationMinutes?: number;
  durationDays?: number;
}

interface PaymentSettingsAdminData {
  id: string;
  upiId: string;
  whatsappNumber: string;
  boostPrice: number;
  featuredPrice: number;
  premiumPrice: number;
  qrImageUrl: string | null;
  instructions: string[];
  boostTiers: PricingTier[];
  featuredTiers: PricingTier[];
  premiumTiers: PricingTier[];
}

// ==========================================
// UPI Payment Settings Component
// ==========================================
export function UPIPaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettingsAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Local form state
  const [upiId, setUpiId] = useState("");
  const [upiError, setUpiError] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [boostPrice, setBoostPrice] = useState("");
  const [featuredPrice, setFeaturedPrice] = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  const [instructions, setInstructions] = useState("");
  const [boostTiers, setBoostTiers] = useState<PricingTier[]>([]);
  const [featuredTiers, setFeaturedTiers] = useState<PricingTier[]>([]);
  const [premiumTiers, setPremiumTiers] = useState<PricingTier[]>([]);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/payment-settings");
        if (res.ok) {
          const data = await res.json();
          const s = data.settings as PaymentSettingsAdminData;
          setSettings(s);
          setUpiId(s.upiId);
          setWhatsappNumber(s.whatsappNumber);
          setBoostPrice(String(s.boostPrice));
          setFeaturedPrice(String(s.featuredPrice));
          setPremiumPrice(String(s.premiumPrice));
          setInstructions(s.instructions.join("\n"));
          setBoostTiers(s.boostTiers || []);
          setFeaturedTiers(s.featuredTiers || []);
          setPremiumTiers(s.premiumTiers || []);
          setQrPreview(s.qrImageUrl);
        }
      } catch {
        // Keep defaults
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // UPI validation
  const handleUpiChange = (val: string) => {
    setUpiId(val);
    if (val && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9.\-]{2,}$/.test(val.trim())) {
      setUpiError(val.length > 0 ? "Invalid UPI format (expected: name@provider)" : "");
    } else {
      setUpiError("");
    }
  };

  // Phone validation
  const handlePhoneChange = (val: string) => {
    setWhatsappNumber(val);
    if (val && !/^\+?[1-9]\d{7,14}$/.test(val.trim())) {
      setPhoneError(val.length > 0 ? "Invalid phone (E.164, e.g. +919876543210)" : "");
    } else {
      setPhoneError("");
    }
  };

  // QR image upload
  const handleQrUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max 2MB for QR images." });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type", { description: "Use JPG, PNG, or WebP." });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("qrImage", file);
      const res = await fetch("/api/admin/payment-settings/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextUrl = data.qrImageUrl as string;
        setQrPreview(nextUrl);
        setSettings((current) => (current ? { ...current, qrImageUrl: nextUrl } : current));
        toast.success("QR uploaded", { description: "Payment QR image saved." });
      } else {
        console.error("[UPIPaymentSettings] QR upload failed", {
          status: res.status,
          error: data.error,
        });
        toast.error("Upload failed", { description: data.error || "Unknown error" });
      }
    } catch (error) {
      console.error("[UPIPaymentSettings] QR upload request failed", error);
      toast.error("Upload failed", { description: "Could not reach server." });
    } finally {
      setUploading(false);
    }
  };

  // Tier management helpers
  const addTier = (type: "boost" | "featured" | "premium") => {
    const newTier: PricingTier = { label: "", amount: 0 };
    if (type === "boost") {
      newTier.durationMinutes = 60;
      setBoostTiers([...boostTiers, newTier]);
    } else {
      newTier.durationDays = type === "featured" ? 7 : 30;
      if (type === "featured") setFeaturedTiers([...featuredTiers, newTier]);
      else setPremiumTiers([...premiumTiers, newTier]);
    }
  };

  const removeTier = (type: "boost" | "featured" | "premium", index: number) => {
    if (type === "boost") setBoostTiers(boostTiers.filter((_, i) => i !== index));
    else if (type === "featured") setFeaturedTiers(featuredTiers.filter((_, i) => i !== index));
    else setPremiumTiers(premiumTiers.filter((_, i) => i !== index));
  };

  const updateTier = (
    type: "boost" | "featured" | "premium",
    index: number,
    field: keyof PricingTier,
    value: string | number
  ) => {
    const updater = (tiers: PricingTier[]) =>
      tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t));
    if (type === "boost") setBoostTiers(updater(boostTiers));
    else if (type === "featured") setFeaturedTiers(updater(featuredTiers));
    else setPremiumTiers(updater(premiumTiers));
  };

  const handleSave = useCallback(async () => {
    // Validate before save
    if (upiError) {
      toast.error("Fix errors", { description: upiError });
      return;
    }
    if (phoneError) {
      toast.error("Fix errors", { description: phoneError });
      return;
    }
    if (!upiId.trim()) {
      toast.error("Missing field", { description: "UPI ID is required" });
      return;
    }
    if (!whatsappNumber.trim()) {
      toast.error("Missing field", { description: "WhatsApp number is required" });
      return;
    }

    setSaving(true);
    try {
      const instructionsArray = instructions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upiId: upiId.trim(),
          whatsappNumber: whatsappNumber.trim(),
          boostPrice: Number(boostPrice) || 0,
          featuredPrice: Number(featuredPrice) || 0,
          premiumPrice: Number(premiumPrice) || 0,
          instructions: instructionsArray,
          boostTiers,
          featuredTiers,
          premiumTiers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        toast.success("Payment settings updated", { description: "All pricing and UPI config saved." });
      } else {
        const err = await res.json();
        toast.error("Failed to save", { description: err.error || "Unknown error" });
      }
    } catch {
      toast.error("Network error", { description: "Could not reach server." });
    } finally {
      setSaving(false);
    }
  }, [upiId, upiError, whatsappNumber, phoneError, boostPrice, featuredPrice, premiumPrice, instructions, boostTiers, featuredTiers, premiumTiers]);

  if (loading) {
    return (
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="size-5 text-[#52525B] animate-spin" />
          <span className="text-sm text-[#52525B] ml-2">Loading payment settings...</span>
        </CardContent>
      </Card>
    );
  }

  // Tier editor sub-component
  const TierEditor = ({
    title,
    tiers,
    type,
    onChange,
  }: {
    title: string;
    tiers: PricingTier[];
    type: "boost" | "featured" | "premium";
    onChange: (tiers: PricingTier[]) => void;
  }) => {
    const isBoost = type === "boost";
    const durationLabel = isBoost ? "Minutes" : "Days";
    const durationField = isBoost ? "durationMinutes" : "durationDays";

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-[#A1A1AA] font-medium">{title}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
            onClick={() => addTier(type)}
          >
            <Plus className="size-3 mr-1" />
            Add Tier
          </Button>
        </div>
        {tiers.length === 0 ? (
          <p className="text-xs text-[#52525B] py-2">No tiers configured. Click &quot;Add Tier&quot; to add one.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {tiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.06)]">
                <Input
                  value={tier.label}
                  onChange={(e) => updateTier(type, idx, "label", e.target.value)}
                  placeholder="Tier name"
                  className="flex-1 h-8 text-xs bg-[#15151D] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] rounded-md"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[#52525B]">₹</span>
                  <Input
                    type="number"
                    value={tier.amount || ""}
                    onChange={(e) => updateTier(type, idx, "amount", Number(e.target.value))}
                    placeholder="0"
                    min="0"
                    className="w-20 h-8 text-xs bg-[#15151D] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] rounded-md"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[#52525B]">{durationLabel}</span>
                  <Input
                    type="number"
                    value={tier[durationField] || ""}
                    onChange={(e) => updateTier(type, idx, durationField, Number(e.target.value))}
                    placeholder="0"
                    min="1"
                    className="w-16 h-8 text-xs bg-[#15151D] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] rounded-md"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(type, idx)}
                  className="p-1 rounded text-[#52525B] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label="Remove tier"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-[#F5F5F7]">UPI Payment Settings</CardTitle>
        <CardDescription className="text-xs text-[#A1A1AA]">Configure UPI payment details, pricing tiers, and QR code</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code Upload */}
        <div className="space-y-2">
          <Label className="text-sm text-[#A1A1AA] font-medium">Payment QR Code</Label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] overflow-hidden flex items-center justify-center shrink-0">
              {uploading ? (
                <Loader2 className="size-5 text-[#52525B] animate-spin" />
              ) : qrPreview ? (
                <img src={qrPreview} alt="Payment QR" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-center px-2">
                  <ImageIcon className="size-4 text-[#52525B]" />
                  <span className="text-[10px] text-[#52525B]">No QR uploaded</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleQrUpload(file);
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.06)]"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="size-3.5 mr-1.5" />
                {uploading ? "Uploading..." : "Upload QR Image"}
              </Button>
              <p className="text-[10px] text-[#52525B]">JPG, PNG, or WebP — max 2MB</p>
            </div>
          </div>
        </div>

        {/* UPI ID & WhatsApp */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-[#A1A1AA]">UPI ID</Label>
            <Input
              value={upiId}
              onChange={(e) => handleUpiChange(e.target.value)}
              placeholder="SecretZa@ybl"
              className={`bg-[#1E1E2A] border h-10 rounded-lg text-[#F5F5F7] ${upiError ? "border-red-500/50" : "border-[rgba(255,255,255,0.08)]"}`}
            />
            {upiError && <p className="text-[10px] text-red-400">{upiError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-[#A1A1AA]">WhatsApp Number</Label>
            <Input
              value={whatsappNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+919876543210"
              className={`bg-[#1E1E2A] border h-10 rounded-lg text-[#F5F5F7] ${phoneError ? "border-red-500/50" : "border-[rgba(255,255,255,0.08)]"}`}
            />
            {phoneError && <p className="text-[10px] text-red-400">{phoneError}</p>}
          </div>
        </div>

        {/* Base Prices */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-[#A1A1AA]">Boost Price (₹)</Label>
            <Input
              type="number"
              value={boostPrice}
              onChange={(e) => setBoostPrice(e.target.value)}
              min="0"
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
            />
            <p className="text-[10px] text-[#52525B]">Default / base price</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-[#A1A1AA]">Featured Price (₹)</Label>
            <Input
              type="number"
              value={featuredPrice}
              onChange={(e) => setFeaturedPrice(e.target.value)}
              min="0"
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
            />
            <p className="text-[10px] text-[#52525B]">Default / base price</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-[#A1A1AA]">Premium Price (₹)</Label>
            <Input
              type="number"
              value={premiumPrice}
              onChange={(e) => setPremiumPrice(e.target.value)}
              min="0"
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
            />
            <p className="text-[10px] text-[#52525B]">Default / base price</p>
          </div>
        </div>

        {/* Pricing Tiers */}
        <Separator className="bg-[rgba(255,255,255,0.06)]" />
        <div className="space-y-4">
          <Label className="text-sm text-[#A1A1AA] font-medium">Pricing Tiers</Label>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TierEditor
              title="Boost Tiers"
              tiers={boostTiers}
              type="boost"
              onChange={setBoostTiers}
            />
            <TierEditor
              title="Featured Tiers"
              tiers={featuredTiers}
              type="featured"
              onChange={setFeaturedTiers}
            />
            <TierEditor
              title="Premium Tiers"
              tiers={premiumTiers}
              type="premium"
              onChange={setPremiumTiers}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-1.5">
          <Label className="text-sm text-[#A1A1AA] font-medium">Payment Instructions (one per line)</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder={"Open any UPI app...\nScan the QR code..."}
            className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] text-sm resize-none rounded-lg"
          />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving || !!upiError || !!phoneError}
          className="w-full gradient-violet hover:opacity-90 text-white font-semibold h-10"
        >
          {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          {saving ? "Saving..." : "Save Payment Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Manual Payment Queue Page
// ==========================================
interface ManualPaymentSubmission {
  id: string;
  userId: string;
  listingId: string | null;
  listing: { id: string; title: string; slug: string } | null;
  paymentType: "boost" | "feature" | "premium";
  amount: number;
  utrNumber: string;
  screenshotUrl: string | null;
  selectedPlan: string | null;
  paymentMethod: string | null;
  status: "pending" | "approved" | "rejected" | "proof_requested" | "duplicate";
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  };
}

export function ManualPaymentQueue() {
  const [submissions, setSubmissions] = useState<ManualPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialogs
  const [approveDialog, setApproveDialog] = useState<ManualPaymentSubmission | null>(null);
  const [rejectDialog, setRejectDialog] = useState<ManualPaymentSubmission | null>(null);
  const [proofDialog, setProofDialog] = useState<ManualPaymentSubmission | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<ManualPaymentSubmission | null>(null);
  const [screenshotDialog, setScreenshotDialog] = useState<string | null>(null);

  // Admin notes input
  const [adminNotes, setAdminNotes] = useState("");

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", "20");
      const res = await fetch(`/api/admin/payments/manual?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setTotalPages(data.totalPages || 1);
      } else {
        toast.error("Failed to fetch payment submissions");
      }
    } catch {
      toast.error("Network error fetching submissions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleAction = async (submissionId: string, action: string, notes?: string) => {
    setActionLoading(submissionId);
    try {
      const res = await fetch(`/api/admin/payments/manual/${submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNotes: notes || null }),
      });
      if (res.ok) {
        toast.success(`Payment ${action} successfully`);
        fetchSubmissions();
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to ${action} payment`);
      }
    } catch {
      toast.error(`Network error during ${action}`);
    } finally {
      setActionLoading(null);
      setApproveDialog(null);
      setRejectDialog(null);
      setProofDialog(null);
      setDuplicateDialog(null);
      setAdminNotes("");
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      rejected: "bg-red-500/15 text-red-400 border-red-500/30",
      proof_requested: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      duplicate: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    };
    const labels: Record<string, string> = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      proof_requested: "Proof Req.",
      duplicate: "Duplicate",
    };
    return (
      <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPaymentTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      boost: "bg-violet-500/15 text-violet-400 border-violet-500/30",
      feature: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      premium: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    };
    return (
      <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${styles[type] || ""}`}>
        {type}
      </Badge>
    );
  };

  const filterTabs = ["all", "pending", "approved", "rejected", "proof_requested", "duplicate"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">Payment Queue</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">Review and manage manual payment submissions.</p>
        </div>
        <button
          onClick={() => fetchSubmissions()}
          className="px-3 py-1.5 text-xs text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-1.5 w-fit"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === status
                ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            {status === "all" ? "All" : status === "proof_requested" ? "Proof Req." : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-[#7C3AED]" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="size-12 text-[#52525B] mx-auto mb-4" />
              <p className="text-[#F5F5F7] font-medium">No payment submissions</p>
              <p className="text-sm text-[#A1A1AA] mt-1">
                {statusFilter === "all" ? "No manual payments have been submitted yet." : `No ${statusFilter} payments found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    {["User", "Listing", "Plan", "Payment Type", "Amount", "UTR", "Screenshot", "Status", "Date", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {sub.user.name?.charAt(0)?.toUpperCase() || sub.user.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-[#F5F5F7] font-medium truncate max-w-[140px]">{sub.user.name || "—"}</p>
                            <p className="text-[10px] text-[#A1A1AA] truncate max-w-[140px]">{sub.user.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Listing */}
                      <td className="px-4 py-3">
                        {sub.listing ? (
                          <div className="min-w-0">
                            <p className="text-sm text-[#F5F5F7] font-medium truncate max-w-[160px]">{sub.listing.title}</p>
                            <p className="text-[10px] text-[#52525B] truncate max-w-[160px]">{sub.listing.slug}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-[#52525B]">—</span>
                        )}
                      </td>
                      {/* Plan */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#A1A1AA]">{sub.selectedPlan || "—"}</span>
                      </td>
                      {/* Payment Type */}
                      <td className="px-4 py-3">{getPaymentTypeBadge(sub.paymentType)}</td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-sm text-[#F5F5F7] font-medium">₹{sub.amount.toLocaleString("en-IN")}</td>
                      {/* UTR */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs text-[#A1A1AA] bg-[#1E1E2A] px-2 py-1 rounded font-mono">
                            {sub.utrNumber}
                          </code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(sub.utrNumber); toast.success("UTR copied"); }}
                            className="p-1 rounded hover:bg-[rgba(255,255,255,0.05)] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                            title="Copy UTR"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </td>
                      {/* Screenshot */}
                      <td className="px-4 py-3">
                        {sub.screenshotUrl ? (
                          <button
                            onClick={() => setScreenshotDialog(sub.screenshotUrl)}
                            className="w-12 h-12 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)] hover:border-[#7C3AED]/40 transition-colors"
                          >
                            <img src={sub.screenshotUrl} alt="Payment proof" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#52525B]">No image</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-[#52525B] whitespace-nowrap">{getRelativeTime(sub.createdAt)}</td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {sub.status === "pending" || sub.status === "proof_requested" ? (
                            <>
                              <button
                                onClick={() => setApproveDialog(sub)}
                                disabled={actionLoading === sub.id}
                                title="Approve"
                                className="p-1.5 rounded-md hover:bg-emerald-500/10 text-[#A1A1AA] hover:text-emerald-400 transition-colors disabled:opacity-40"
                              >
                                {actionLoading === sub.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                              </button>
                              <button
                                onClick={() => setRejectDialog(sub)}
                                disabled={actionLoading === sub.id}
                                title="Reject"
                                className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A1A1AA] hover:text-red-400 transition-colors disabled:opacity-40"
                              >
                                <XCircle className="size-3.5" />
                              </button>
                              <button
                                onClick={() => { setProofDialog(sub); setAdminNotes(""); }}
                                disabled={actionLoading === sub.id}
                                title="Request Proof"
                                className="p-1.5 rounded-md hover:bg-amber-500/10 text-[#A1A1AA] hover:text-amber-400 transition-colors disabled:opacity-40"
                              >
                                <AlertCircle className="size-3.5" />
                              </button>
                            </>
                          ) : null}
                          <button
                            onClick={() => setDuplicateDialog(sub)}
                            disabled={actionLoading === sub.id || sub.status === "duplicate"}
                            title="Mark Duplicate"
                            className="p-1.5 rounded-md hover:bg-zinc-500/10 text-[#A1A1AA] hover:text-zinc-400 transition-colors disabled:opacity-40"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && submissions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 text-xs bg-[#15151D] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg"
          >
            Previous
          </Button>
          <span className="text-xs text-[#A1A1AA]">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 text-xs bg-[#15151D] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg"
          >
            Next
          </Button>
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Approve Payment</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              This will activate the <span className="text-[#8B5CF6] font-medium capitalize">{approveDialog?.paymentType}</span> for {approveDialog?.user.name || approveDialog?.user.email}. Continue?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[#1E1E2A] rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[#A1A1AA]">Amount</span><span className="text-[#F5F5F7] font-medium">₹{approveDialog?.amount.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-[#A1A1AA]">UTR</span><code className="text-[#F5F5F7] font-mono">{approveDialog?.utrNumber}</code></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveDialog(null)} className="h-9 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg">Cancel</Button>
            <Button onClick={() => approveDialog && handleAction(approveDialog.id, "approve")} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Reject Payment</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Reject the <span className="text-red-400 font-medium capitalize">{rejectDialog?.paymentType}</span> payment from {rejectDialog?.user.name || rejectDialog?.user.email}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Reason (optional)</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g., Screenshot is unclear, UTR mismatch..."
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialog(null)} className="h-9 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg">Cancel</Button>
            <Button onClick={() => rejectDialog && handleAction(rejectDialog.id, "reject", adminNotes)} className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Proof Dialog */}
      <Dialog open={!!proofDialog} onOpenChange={() => setProofDialog(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Request Additional Proof</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Ask {proofDialog?.user.name || proofDialog?.user.email} to provide additional proof of payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Admin Notes / Instructions</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g., Please upload a clearer screenshot of the transaction..."
              className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] rounded-lg text-sm min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setProofDialog(null)} className="h-9 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg">Cancel</Button>
            <Button onClick={() => proofDialog && handleAction(proofDialog.id, "proof_requested", adminNotes)} className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Request Proof</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Duplicate Dialog */}
      <Dialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
        <DialogContent className="bg-[#15151D] border-[rgba(255,255,255,0.08)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F7]">Mark as Duplicate</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              Mark this payment as a duplicate of a previous transaction for {duplicateDialog?.user.name || duplicateDialog?.user.email}?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[#1E1E2A] rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[#A1A1AA]">UTR</span><code className="text-[#F5F5F7] font-mono">{duplicateDialog?.utrNumber}</code></div>
            <div className="flex justify-between"><span className="text-[#A1A1AA]">Current Status</span><span>{duplicateDialog && getStatusBadge(duplicateDialog.status)}</span></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDuplicateDialog(null)} className="h-9 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg">Cancel</Button>
            <Button onClick={() => duplicateDialog && handleAction(duplicateDialog.id, "duplicate")} className="h-9 text-xs bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg">Mark Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot Preview Dialog */}
      <Dialog open={!!screenshotDialog} onOpenChange={() => setScreenshotDialog(null)}>
        <DialogContent className="bg-[#0B0B0F] border-[rgba(255,255,255,0.08)] max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Payment Screenshot</DialogTitle>
            <DialogDescription>Full-size payment proof image</DialogDescription>
          </DialogHeader>
          {screenshotDialog && (
            <div className="flex flex-col items-center gap-3">
              <img src={screenshotDialog} alt="Payment proof" className="max-w-full max-h-[70vh] rounded-lg object-contain" />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(screenshotDialog, "_blank")}
                  className="h-8 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg"
                >
                  <ExternalLink className="size-3 mr-1" /> Open Full
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(screenshotDialog); toast.success("Link copied"); }}
                  className="h-8 text-xs bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:text-[#F5F5F7] rounded-lg"
                >
                  <Copy className="size-3 mr-1" /> Copy Link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// Placeholder Pages (Categories, Geo, Pricing, Payments, Coupons, CMS, Reports)
// ==========================================
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">{title}</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">{description}</p>
      </div>
      <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
        <CardContent className="py-20 text-center">
          <Settings className="size-12 text-[#52525B] mx-auto mb-4" />
          <p className="text-[#A1A1AA] font-medium">Coming Soon</p>
          <p className="text-xs text-[#52525B] mt-1">This section is under development.</p>
        </CardContent>
      </Card>
    </div>
  );
}
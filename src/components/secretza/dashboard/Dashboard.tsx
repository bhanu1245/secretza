"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Crown,
  Settings,
  LogOut,
  Eye,
  Edit3,
  Trash2,
  Zap,
  TrendingUp,
  Star,
  Menu,
  X,
  ChevronRight,
  Search,
  Bell,
  AlertTriangle,
  Loader2,
  Rocket,
  Clock,
  ArrowUpCircle,
  Mail,
  ShieldX,
  CheckCheck,
  Ban,
  Upload,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { logError } from "@/lib/logger";
import { getListingCoverImageWithPlaceholder } from "@/lib/listing-images";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuthStore, useNavigationStore } from "@/store/useAppStore";
import type { ListingStatus, Listing } from "@/lib/types";

// ==========================================
// Types
// ==========================================
type DashboardPage = "overview" | "listings" | "settings";

// ==========================================
// Status Badge Helper
// ==========================================
function StatusBadge({ status }: { status: ListingStatus }) {
  const styles: Record<ListingStatus, string> = {
    approved:
      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending:
      "bg-amber-500/15 text-amber-400 border-amber-500/30",
    rejected:
      "bg-red-500/15 text-red-400 border-red-500/30",
    expired:
      "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[status]}`}
    >
      {status}
    </Badge>
  );
}

// ==========================================
// Sidebar Navigation
// ==========================================
function SidebarNav({
  currentPage,
  onPageChange,
  isOpen,
  onClose,
  onCreateListing,
  onLogout,
  onUpgradePlan,
  userName,
  isPremium,
}: {
  currentPage: DashboardPage;
  onPageChange: (page: DashboardPage) => void;
  isOpen: boolean;
  onClose: () => void;
  onCreateListing: () => void;
  onLogout: () => void;
  onUpgradePlan: () => void;
  userName: string;
  isPremium: boolean;
}) {
  const navItems = [
    { id: "overview" as DashboardPage, label: "Overview", icon: LayoutDashboard },
    { id: "listings" as DashboardPage, label: "My Listings", icon: FileText },
    { id: "settings" as DashboardPage, label: "Account Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-[#15151D] border-r border-[rgba(255,255,255,0.08)] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo & Close */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[rgba(255,255,255,0.08)]">
          <div>
            <h1 className="text-lg font-bold text-[#F5F5F7]">Secretza</h1>
            <p className="text-xs text-[#A1A1AA]">Dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white font-bold text-sm">
              {userName?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F5F5F7] truncate">
                {userName || "User"}
              </p>
              {isPremium ? (
                <div className="flex items-center gap-1">
                  <Crown className="size-3 text-amber-400" />
                  <span className="text-xs text-amber-400">Premium</span>
                </div>
              ) : (
                <span className="text-xs text-[#A1A1AA]">Free Plan</span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/20"
                    : "text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            );
          })}

          <div className="pt-4">
            <Separator className="bg-[rgba(255,255,255,0.08)]" />
          </div>

          {/* Create Listing Button */}
          <button
            onClick={() => {
              onCreateListing();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] shadow-md shadow-[#7C3AED]/20 transition-all duration-200 mt-2"
          >
            <PlusCircle className="size-4" />
            Post New Ad
          </button>

          {/* Upgrade Plan */}
          {!isPremium && (
            <button
              onClick={() => { onUpgradePlan(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all duration-200 mt-1"
            >
              <Crown className="size-4" />
              Upgrade Plan
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[rgba(255,255,255,0.08)]">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

// ==========================================
// Time Formatting Helper
// ==========================================
function formatTimeAgoShort(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ==========================================
// Overview Page
// ==========================================
function OverviewPage({
  listings,
  onCreateListing,
  onUpgradeListing,
  onUpgradePremium,
  isVerified,
  loading,
}: {
  listings: Listing[];
  onCreateListing: () => void;
  onUpgradeListing: () => void;
  onUpgradePremium: () => void;
  isVerified: boolean;
  loading: boolean;
}) {
  const totalViews = listings.reduce((sum, l) => sum + l.viewCount, 0);
  const featuredCount = listings.filter((l) => l.isFeatured).length;

  const recentActivity = useMemo(() => {
    const activities: Array<{ text: string; time: string; type: string }> = [];

    // Show real listing events
    const sortedListings = [...listings].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 8);

    for (const l of sortedListings) {
      const timeAgo = formatTimeAgoShort(new Date(l.createdAt).toISOString());
      if (l.status === "approved") {
        activities.push({ text: `"${l.title}" is live`, time: timeAgo, type: "status" });
      } else if (l.status === "pending") {
        activities.push({ text: `"${l.title}" is pending review`, time: timeAgo, type: "status" });
      } else if (l.status === "rejected") {
        activities.push({ text: `"${l.title}" was rejected`, time: timeAgo, type: "expired" });
      } else if (l.status === "expired") {
        activities.push({ text: `"${l.title}" expired`, time: timeAgo, type: "expired" });
      }
      if (l.viewCount > 0) {
        activities.push({ text: `"${l.title}" has ${l.viewCount} views`, time: timeAgo, type: "view" });
      }
      if (l.isFeatured) {
        activities.push({ text: `"${l.title}" is featured`, time: timeAgo, type: "featured" });
      }
    }

    return activities.slice(0, 5);
  }, [listings]);

  const stats = [
    {
      label: "Total Listings",
      value: listings.length,
      icon: FileText,
      color: "#7C3AED",
      bg: "rgba(124,58,237,0.1)",
    },
    {
      label: "Active",
      value: listings.filter((l) => l.status === "approved").length,
      icon: TrendingUp,
      color: "#10B981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "Total Views",
      value: totalViews.toLocaleString(),
      icon: Eye,
      color: "#3B82F6",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      label: "Featured",
      value: featuredCount,
      icon: Star,
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.1)",
    },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#1E1E2A] rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-[#15151D] border border-[rgba(255,255,255,0.08)] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-[#15151D] border border-[rgba(255,255,255,0.08)] rounded-xl" />
          <div className="h-64 bg-[#15151D] border border-[rgba(255,255,255,0.08)] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verification Banner */}
      {!isVerified && <VerificationBanner />}

      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Overview</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Welcome back! Here&apos;s what&apos;s happening with your listings.
        </p>
      </div>

      {/* Empty State */}
      {!loading && listings.length === 0 && (
        <div className="text-center py-8">
          <FileText className="size-10 text-[#52525B] mx-auto mb-3" />
          <p className="text-[#A1A1AA] text-sm">No listings yet</p>
          <Button onClick={onCreateListing} className="mt-3 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white rounded-lg">
            <PlusCircle className="size-4 mr-2" />
            Create Your First Listing
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(124,58,237,0.2)] transition-all duration-300"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-[#F5F5F7] mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: stat.bg }}
                >
                  <stat.icon className="size-5" style={{ color: stat.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Bell className="size-4 text-[#7C3AED]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {recentActivity.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.type === "view"
                        ? "bg-blue-400"
                        : item.type === "status"
                        ? "bg-emerald-400"
                        : item.type === "featured"
                        ? "bg-amber-400"
                        : item.type === "upgrade"
                        ? "bg-violet-400"
                        : "bg-zinc-500"
                    }`}
                  />
                  <span className="text-sm text-[#F5F5F7]">{item.text}</span>
                </div>
                <span className="text-xs text-[#52525B] whitespace-nowrap ml-4">
                  {item.time}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#F5F5F7]">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={onCreateListing}
              className="w-full justify-start gap-3 h-11 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white shadow-md shadow-[#7C3AED]/20 rounded-lg"
            >
              <PlusCircle className="size-4" />
              Post New Ad
            </Button>
            <Button
              onClick={onUpgradeListing}
              variant="outline"
              className="w-full justify-start gap-3 h-11 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] hover:bg-[#26263A] hover:border-[rgba(255,255,255,0.15)] rounded-lg"
            >
              <Zap className="size-4 text-amber-400" />
              Upgrade Listing
            </Button>
            <Button
              onClick={onUpgradePremium}
              variant="outline"
              className="w-full justify-start gap-3 h-11 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] hover:bg-[#26263A] hover:border-[rgba(255,255,255,0.15)] rounded-lg"
            >
              <Crown className="size-4 text-amber-400" />
              Upgrade to Premium
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] hover:bg-[#26263A] hover:border-[rgba(255,255,255,0.15)] rounded-lg"
            >
              <Settings className="size-4 text-[#A1A1AA]" />
              Account Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==========================================
// Ranking Badge Component
// ==========================================
function RankingBadge({ listing }: { listing: Listing }) {
  const now = Date.now();
  const boostActive = listing.isBoosted && listing.boostUntil && new Date(listing.boostUntil).getTime() > now;
  const featuredActive = listing.isFeatured && listing.featuredUntil && new Date(listing.featuredUntil).getTime() > now;

  if (boostActive) {
    return (
      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] px-1.5 py-0 gap-1">
        <Rocket className="size-3" />
        Boosted
      </Badge>
    );
  }
  if (featuredActive) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 gap-1">
        <Star className="size-3 fill-amber-400" />
        Featured
      </Badge>
    );
  }
  return null;
}

// ==========================================
// Priority Score Bar
// ==========================================
function PriorityScoreBar({ score }: { score: number }) {
  const maxScore = 1600; // Theoretical max
  const percentage = Math.min(100, (score / maxScore) * 100);
  const color = score >= 1000 ? "from-violet-500 to-fuchsia-500" : score >= 500 ? "from-amber-500 to-orange-500" : "from-zinc-500 to-zinc-400";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-[10px] text-[#A1A1AA] font-mono w-10 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ==========================================
// My Listings Page
// ==========================================
function MyListingsPage({
  listings,
  onListingsChange,
}: {
  listings: Listing[];
  onListingsChange: (listings: Listing[]) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [localListings, setLocalListings] = useState<Listing[]>(listings);

  useEffect(() => {
    setLocalListings(listings);
  }, [listings]);

  useEffect(() => {
    if (listings.length === 0) {
      toast.info("No listings yet", { description: "Create your first listing to get started." });
    }
  }, []);

  const filteredListings = localListings.filter((l) => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = {
    all: localListings.length,
    approved: localListings.filter((l) => l.status === "approved").length,
    pending: localListings.filter((l) => l.status === "pending").length,
    expired: localListings.filter((l) => l.status === "expired").length,
    rejected: localListings.filter((l) => l.status === "rejected").length,
  };

  const navigate = useNavigationStore((s) => s.navigate);

  const handleBoost = useCallback((listingId: string, listingTitle?: string) => {
    navigate("payment-manual", {
      listingId,
      paymentType: "boost",
      listingTitle: listingTitle || "",
    });
  }, [navigate]);

  const handleFeature = useCallback((listingId: string, listingTitle?: string) => {
    navigate("payment-manual", {
      listingId,
      paymentType: "feature",
      listingTitle: listingTitle || "",
    });
  }, [navigate]);

  const handleEdit = useCallback(
  (listing: any) => {
    navigate("post-ad", {
      listingId: listing.id,
      mode: "edit",
    });
  },
  [navigate]
);

const handleDelete = async (id: string) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this listing?"
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/listings/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Delete failed");
    }

    const nextListings = localListings.filter((listing) => listing.id !== id);
    setLocalListings(nextListings);
    onListingsChange(nextListings);

    alert("Listing deleted successfully");
  } catch (error) {
    logError(error, { component: "Dashboard" });
    alert("Delete failed");
  }
};
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F7]">My Listings</h2>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Manage and track all your listings.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#A1A1AA]" />
          <Input
            placeholder="Search listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] placeholder:text-[#52525B] focus:border-[#7C3AED] h-10 rounded-lg"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "approved", "pending", "expired", "rejected"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                  statusFilter === status
                    ? "bg-[#7C3AED]/15 text-[#8B5CF6] border border-[#7C3AED]/30"
                    : "text-[#A1A1AA] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F5F5F7]"
                }`}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-1.5 text-[10px] opacity-60">
                  {statusCounts[status]}
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="size-12 text-[#52525B] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">No listings found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredListings.map((listing) => {
            const coverImage = getListingCoverImageWithPlaceholder(listing);
            return (
            <Card
              key={listing.id}
              className="bg-[#15151D] border-[rgba(255,255,255,0.08)] hover:border-[rgba(124,58,237,0.2)] transition-all duration-300 group overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative h-36 overflow-hidden">
                <img
                  src={coverImage.thumbnailUrl || coverImage.url}
                  alt={coverImage.alt || listing.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#15151D] via-transparent to-transparent" />
                <div className="absolute top-3 left-3">
                  <StatusBadge status={listing.status} />
                </div>
                <div className="absolute top-3 right-3">
                  <RankingBadge listing={listing} />
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#F5F5F7] line-clamp-1">
                    {listing.title}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    {listing.category.name} &middot; {listing.city.name},{" "}
                    {listing.country.name}
                  </p>
                </div>

                {/* Priority Score */}
                <PriorityScoreBar score={listing.priorityScore || 0} />

                <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" />
                    {listing.viewCount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUpCircle className="size-3" />
                    Rank {Math.round(listing.priorityScore || 0)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                   variant="outline"
                   size="sm"
                   onClick={() => handleEdit(listing)}
                   >
                   <Edit3 className="size-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBoost(listing.id, listing.title)}
                    className="flex-1 h-8 text-xs border-violet-500/20 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/30 rounded-lg"
                  >
                    <Zap className="size-3 mr-1" />
                    {listing.isBoosted ? "Boosted" : "Boost"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFeature(listing.id, listing.title)}
                    className="h-8 text-xs border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/30 rounded-lg px-2.5"
                  >
                    <Crown className="size-3" />
                  </Button>
                  <Button
  variant="outline"
  size="sm"
  onClick={() => handleDelete(listing.id)}
>
  <Trash2 className="size-3" />
</Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Account Settings Page
// ==========================================
function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<
    "profile" | "password" | "preferences" | "danger"
  >("profile");

  const sections = [
    { id: "profile" as const, label: "Profile Info" },
    { id: "password" as const, label: "Change Password" },
    { id: "preferences" as const, label: "Email Preferences" },
    { id: "danger" as const, label: "Danger Zone" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#F5F5F7]">Account Settings</h2>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Manage your account information and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 p-1 bg-[#1E1E2A] rounded-lg">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex-1 lg:flex-none px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 text-left ${
                  activeSection === section.id
                    ? "bg-[#7C3AED]/15 text-[#8B5CF6]"
                    : "text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <Card className="bg-[#15151D] border-[rgba(255,255,255,0.08)]">
            <CardContent className="p-6">
              {activeSection === "profile" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-[#F5F5F7]">
                    Profile Information
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white font-bold text-2xl">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#F5F5F7] hover:bg-[#26263A] rounded-lg"
                      >
                        Change Avatar
                      </Button>
                      <p className="text-xs text-[#A1A1AA] mt-1">
                        JPG, PNG or GIF. Max 2MB.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#A1A1AA]">Full Name</Label>
                      <Input
                        defaultValue={user?.name || ""}
                        className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#A1A1AA]">Email</Label>
                      <Input
                        defaultValue={user?.email || ""}
                        className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-sm text-[#A1A1AA]">Bio</Label>
                      <textarea
                        rows={3}
                        placeholder="Tell us about yourself..."
                        className="w-full bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] text-[#F5F5F7] rounded-lg px-3 py-2 text-sm placeholder:text-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 resize-none"
                      />
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-lg shadow-md shadow-[#7C3AED]/20">
                    Save Changes
                  </Button>
                </div>
              )}

              {activeSection === "password" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-[#F5F5F7]">
                    Change Password
                  </h3>
                  <div className="space-y-4 max-w-sm">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#A1A1AA]">
                        Current Password
                      </Label>
                      <Input
                        type="password"
                        className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#A1A1AA]">
                        New Password
                      </Label>
                      <Input
                        type="password"
                        className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#A1A1AA]">
                        Confirm New Password
                      </Label>
                      <Input
                        type="password"
                        className="bg-[#1E1E2A] border-[rgba(255,255,255,0.08)] text-[#F5F5F7] h-10 rounded-lg"
                      />
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-lg shadow-md shadow-[#7C3AED]/20">
                    Update Password
                  </Button>
                </div>
              )}

              {activeSection === "preferences" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-[#F5F5F7]">
                    Email Preferences
                  </h3>
                  <div className="space-y-4">
                    {[
                      {
                        label: "Listing updates",
                        desc: "Get notified when your listings are approved or rejected",
                      },
                      {
                        label: "New views & messages",
                        desc: "Receive alerts when someone views or messages your listing",
                      },
                      {
                        label: "Promotional emails",
                        desc: "Receive special offers and upgrade notifications",
                      },
                      {
                        label: "Weekly digest",
                        desc: "Get a weekly summary of your listing performance",
                      },
                    ].map((pref) => (
                      <div
                        key={pref.label}
                        className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.04)] last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#F5F5F7]">
                            {pref.label}
                          </p>
                          <p className="text-xs text-[#A1A1AA] mt-0.5">
                            {pref.desc}
                          </p>
                        </div>
                        <Checkbox
                          defaultChecked
                          className="border-[rgba(255,255,255,0.15)] data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
                        />
                      </div>
                    ))}
                  </div>
                  <Button className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-lg shadow-md shadow-[#7C3AED]/20">
                    Save Preferences
                  </Button>
                </div>
              )}

              {activeSection === "danger" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                    <AlertTriangle className="size-5" />
                    Danger Zone
                  </h3>
                  <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                    <p className="text-sm text-[#F5F5F7] font-medium">
                      Delete Account
                    </p>
                    <p className="text-xs text-[#A1A1AA] mt-1">
                      Permanently delete your account and all associated data.
                      This action cannot be undone.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 rounded-lg"
                    >
                      <Trash2 className="size-4 mr-2" />
                      Delete My Account
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Verification Banner
// ==========================================
function VerificationBanner() {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Verification email sent!", { description: data.message });
        setSent(true);
      } else {
        toast.error("Failed to send", { description: data.error || "Please try again." });
      }
    } catch {
      toast.error("Failed to send", { description: "Network error." });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
            <ShieldX className="size-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#F5F5F7]">Email not verified</p>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Verify your email to create listings, boost, and purchase features.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResend}
          disabled={resending || sent}
          className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-300 rounded-lg disabled:opacity-50"
        >
          {resending ? (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          ) : sent ? (
            <Mail className="size-3.5 mr-1.5" />
          ) : (
            <Mail className="size-3.5 mr-1.5" />
          )}
          {sent ? "Sent!" : "Resend Verification"}
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Login Prompt (Unauthenticated)
// ==========================================
function LoginPrompt() {
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0F] px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#7C3AED]/30">
          <LayoutDashboard className="size-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-[#F5F5F7] mb-2">
          Access Your Dashboard
        </h2>
        <p className="text-[#A1A1AA] mb-8">
          Sign in to manage your listings, track performance, and grow your audience on
          Secretza.
        </p>
        <Button
          onClick={() => {
            setAuthModalTab("login");
            setAuthModalOpen(true);
          }}
          className="h-12 px-8 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white rounded-xl shadow-lg shadow-[#7C3AED]/25 hover:shadow-[#7C3AED]/40 transition-all font-semibold"
        >
          Sign In to Continue
          <ChevronRight className="size-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Notification Bell with Sheet Dropdown
// ==========================================
interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=30");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when sheet opens
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Refresh when sheet opens
  const handleOpen = useCallback((val: boolean) => {
    setOpen(val);
    if (val) fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment_submitted":
        return <Upload className="size-4 text-blue-400" />;
      case "payment_approved":
        return <Circle className="size-4 text-emerald-400" />;
      case "payment_rejected":
        return <Ban className="size-4 text-red-400" />;
      case "payment_proof_requested":
        return <Upload className="size-4 text-amber-400" />;
      default:
        return <Bell className="size-4 text-[#A1A1AA]" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpen}>
        <button
          onClick={() => handleOpen(true)}
          className="relative p-2 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#7C3AED] text-[10px] font-bold text-white px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-[#15151D] border-[rgba(255,255,255,0.08)] p-0"
        >
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold text-[#F5F5F7] flex items-center gap-2">
                <Bell className="size-5 text-[#7C3AED]" />
                Notifications
                {unreadCount > 0 && (
                  <Badge className="bg-[#7C3AED]/15 text-[#8B5CF6] border-[#7C3AED]/20 text-[10px] px-1.5 py-0">
                    {unreadCount}
                  </Badge>
                )}
              </SheetTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] h-8 px-2"
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Notification List */}
          <ScrollArea className="h-[calc(100vh-80px)]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 text-[#52525B] animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-14 h-14 rounded-2xl bg-[#1E1E2A] flex items-center justify-center mb-4">
                  <Bell className="size-7 text-[#52525B]" />
                </div>
                <p className="text-sm font-medium text-[#A1A1AA]">No notifications yet</p>
                <p className="text-xs text-[#52525B] mt-1">
                  Payment updates will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) markAsRead(notif.id);
                    }}
                    className={`w-full text-left px-6 py-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                      !notif.isRead ? "bg-[#7C3AED]/[0.03]" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium leading-snug ${
                            !notif.isRead ? "text-[#F5F5F7]" : "text-[#A1A1AA]"
                          }`}>
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-[#7C3AED] mt-1.5" />
                          )}
                        </div>
                        {notif.message && (
                          <p className="text-xs text-[#52525B] mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                        )}
                        <p className="text-[10px] text-[#52525B] mt-1.5 flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatTimeAgo(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ==========================================
// Main Dashboard Component
// ==========================================
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigationStore((s) => s.navigate);

  // Local state for dashboard page — immune to Zustand store resets during HMR / strict mode
  const [currentPage, setCurrentPage] = useState<DashboardPage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboardPage") as DashboardPage;
      if (saved && ["overview", "listings", "settings"].includes(saved)) return saved;
    }
    return "overview";
  });

  // Ref to guard against stale nav.params.tab overwriting user's manual page choice
  const hasProcessedNavTab = useRef(false);

  // Sync local page state to Zustand store for cross-component consistency
  const setDashboardPage = useNavigationStore((s) => s.setDashboardPage);
  useEffect(() => {
    localStorage.setItem("dashboardPage", currentPage);
    setDashboardPage(currentPage);
  }, [currentPage, setDashboardPage]);

  // Handle navigation params from external components (e.g., Header "My Listings" button)
  const nav = useNavigationStore((s) => s.nav);
  useEffect(() => {
    if (hasProcessedNavTab.current) return;
    const tab = nav.params?.tab as string | undefined;
    if (tab && ["overview", "listings", "settings"].includes(tab)) {
      setCurrentPage(tab as DashboardPage);
      hasProcessedNavTab.current = true;
    }
  }, [nav.params?.tab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch real user listings
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    async function fetchUserListings() {
      try {
        const res = await fetch(`/api/listings?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          const listings = data.listings || [];
          console.log("[Dashboard] fetched listings count", listings.length);
          setUserListings(listings);
        } else {
          toast.error("Failed to load listings", { description: "Could not fetch your listings. Please try again." });
        }
      } catch {
        toast.error("Network error", { description: "Could not connect to the server." });
      } finally {
        setLoadingListings(false);
      }
    }
    fetchUserListings();
  }, [user?.id]);

  // Not authenticated — show login prompt
  if (!isAuthenticated || !user) {
    return <LoginPrompt />;
  }

  const handleCreateListing = () => {
    navigate("post-ad");
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    logout();
    toast.success("Signed out");
  };

  const handleUpgradePlan = () => {
    navigate("payment-manual", { paymentType: "premium" });
  };

  const handleUpgradeListing = () => {
    navigate("payment-manual", { paymentType: "boost" });
  };

  const handleUpgradePremium = () => {
    navigate("payment-manual", { paymentType: "premium" });
  };

  const pageTitle: Record<DashboardPage, string> = {
    overview: "Dashboard Overview",
    listings: "My Listings",
    settings: "Account Settings",
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] flex">
      {/* Sidebar */}
      <SidebarNav
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCreateListing={handleCreateListing}
        onLogout={handleLogout}
        onUpgradePlan={handleUpgradePlan}
        userName={user.name || "User"}
        isPremium={user.isPremium}
      />

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)]"
              >
                <Menu className="size-5" />
              </button>
              <h1 className="text-lg font-semibold text-[#F5F5F7] hidden sm:block">
                {pageTitle[currentPage]}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {currentPage === "overview" && (
            <OverviewPage
              listings={userListings}
              onCreateListing={handleCreateListing}
              onUpgradeListing={handleUpgradeListing}
              onUpgradePremium={handleUpgradePremium}
              isVerified={user.isVerified}
              loading={loadingListings}
            />
          )}
          {currentPage === "listings" && (
            <MyListingsPage
              listings={userListings}
              onListingsChange={setUserListings}
            />
          )}
          {currentPage === "settings" && <AccountSettingsPage />}
        </div>
      </main>
    </div>
  );
}

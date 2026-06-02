import type { ComponentType } from "react";
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
  Star,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

export type AdminRouteId =
  | "dashboard"
  | "users"
  | "listings"
  | "moderation"
  | "categories"
  | "geo"
  | "pricing"
  | "payments"
  | "reviews"
  | "review-analytics"
  | "coupons"
  | "cms"
  | "reports"
  | "seo"
  | "seo-dashboard"
  | "seo-audit"
  | "seo-regeneration"
  | "settings";

export type AdminNavItem = {
  id: AdminRouteId;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Moderators can access when true; admin-only when false */
  moderatorAllowed?: boolean;
};

/** Canonical admin navigation — single source of truth for /admin/* */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin", icon: LayoutDashboard, moderatorAllowed: true },
  { id: "users", label: "Users", href: "/admin/users", icon: Users, moderatorAllowed: false },
  { id: "listings", label: "Listings", href: "/admin/listings", icon: FileText, moderatorAllowed: true },
  { id: "moderation", label: "Moderation", href: "/admin/moderation", icon: Shield, moderatorAllowed: true },
  { id: "categories", label: "Categories", href: "/admin/categories", icon: Grid3X3, moderatorAllowed: false },
  { id: "geo", label: "Geo Management", href: "/admin/geo", icon: Globe, moderatorAllowed: false },
  { id: "pricing", label: "Pricing", href: "/admin/pricing", icon: CreditCard, moderatorAllowed: false },
  { id: "payments", label: "Payments", href: "/admin/payments", icon: Receipt, moderatorAllowed: false },
  { id: "reviews", label: "Reviews", href: "/admin/reviews", icon: Star, moderatorAllowed: true },
  { id: "review-analytics", label: "Review Analytics", href: "/admin/review-analytics", icon: BarChart3, moderatorAllowed: true },
  { id: "coupons", label: "Coupons", href: "/admin/coupons", icon: Tag, moderatorAllowed: false },
  { id: "cms", label: "CMS Pages", href: "/admin/cms", icon: FileEdit, moderatorAllowed: false },
  { id: "seo", label: "SEO", href: "/admin/seo", icon: Globe, moderatorAllowed: true },
  { id: "seo-dashboard", label: "SEO Dashboard", href: "/admin/seo/dashboard", icon: BarChart3, moderatorAllowed: true },
  { id: "seo-audit", label: "SEO Audit", href: "/admin/seo/audit", icon: ShieldCheck, moderatorAllowed: true },
  { id: "seo-regeneration", label: "SEO Regeneration", href: "/admin/seo/regeneration", icon: RefreshCw, moderatorAllowed: true },
  { id: "reports", label: "Reports", href: "/admin/reports", icon: BarChart3, moderatorAllowed: true },
  { id: "settings", label: "Settings", href: "/admin/settings", icon: Settings, moderatorAllowed: false },
];

const PATH_TO_ID = new Map<string, AdminRouteId>(
  ADMIN_NAV_ITEMS.map((item) => [item.href, item.id]),
);

/** Resolve admin route id from pathname (defaults to dashboard). */
export function adminRouteIdFromPath(pathname: string): AdminRouteId {
  const normalized = pathname.replace(/\/+$/, "") || "/admin";
  if (PATH_TO_ID.has(normalized)) {
    return PATH_TO_ID.get(normalized)!;
  }
  return "dashboard";
}

export function adminNavItemForPath(pathname: string): AdminNavItem {
  const id = adminRouteIdFromPath(pathname);
  return ADMIN_NAV_ITEMS.find((item) => item.id === id) ?? ADMIN_NAV_ITEMS[0];
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

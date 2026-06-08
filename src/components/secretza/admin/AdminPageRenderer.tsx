"use client";

import AdminGeoPage from "@/components/secretza/admin/routes/AdminGeoPage";
import SeoManager from "@/components/secretza/admin/SeoManager";
import SeoDashboard from "@/components/secretza/admin/SeoDashboard";
import SeoAuditPanel from "@/components/secretza/admin/SeoAuditPanel";
import SeoRegenerationPanel from "@/components/secretza/admin/SeoRegenerationPanel";
import { AdminReviewQueue, AdminReviewAnalytics } from "@/components/secretza/admin/AdminReviewPanel";
import CategoryManager from "@/components/secretza/admin/CategoryManager";
import AdminPricingPlans from "@/components/secretza/admin/AdminPricingPlans";
import AdminCmsPages from "@/components/secretza/admin/AdminCmsPages";
import AdminCoupons from "@/components/secretza/admin/AdminCoupons";
import AdminReportsPage from "@/components/secretza/admin/AdminReportsPage";
import AdminListingsPage from "@/components/secretza/admin/AdminListingsPage";
import AdminModerationPage from "@/components/secretza/admin/AdminModerationPage";
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminSettingsPage,
  ManualPaymentQueue,
  PlaceholderPage,
} from "@/components/secretza/admin/pages/AdminContentPages";
import { adminRouteIdFromPath, type AdminRouteId } from "@/lib/admin-routes";

function renderAdminPage(routeId: AdminRouteId) {
  switch (routeId) {
    case "dashboard":
      return <AdminDashboardPage />;
    case "users":
      return <AdminUsersPage />;
    case "listings":
      return <AdminListingsPage />;
    case "moderation":
      return <AdminModerationPage />;
    case "settings":
      return <AdminSettingsPage />;
    case "categories":
      return <CategoryManager />;
    case "geo":
      return <AdminGeoPage />;
    case "pricing":
      return <AdminPricingPlans />;
    case "payments":
      return <ManualPaymentQueue />;
    case "reviews":
      return <AdminReviewQueue />;
    case "review-analytics":
      return <AdminReviewAnalytics />;
    case "coupons":
      return <AdminCoupons />;
    case "cms":
      return <AdminCmsPages />;
    case "reports":
      return <AdminReportsPage />;
    case "seo":
      return <SeoManager />;
    case "seo-dashboard":
      return <SeoDashboard />;
    case "seo-audit":
      return <SeoAuditPanel />;
    case "seo-regeneration":
      return <SeoRegenerationPanel />;
    default:
      return <AdminDashboardPage />;
  }
}

export default function AdminPageRenderer({ pathname }: { pathname: string }) {
  const routeId = adminRouteIdFromPath(pathname);
  return renderAdminPage(routeId);
}

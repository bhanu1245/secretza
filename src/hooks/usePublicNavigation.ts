"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppView } from "@/lib/types";
import { useNavigationStore } from "@/store/useAppStore";
import {
  buildSpaDeepLink,
  isSpaHome,
  viewToPath,
} from "@/lib/public-navigation";

/**
 * Unified navigation for public shell (Header, Footer, MobileBottomNav, ListingCard).
 * On `/` uses Zustand SPA views; elsewhere uses Next.js routes or SPA deep-links.
 */
export function usePublicNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = useNavigationStore((s) => s.navigate);
  const isSpa = isSpaHome(pathname);

  const go = useCallback(
    (view: AppView, params: Record<string, string> = {}) => {
      if (isSpa) {
        navigate(view, params);
        return;
      }
      const path = viewToPath(view, params);
      router.push(path ?? buildSpaDeepLink(view, params));
    },
    [isSpa, navigate, router]
  );

  const goHome = useCallback(() => {
    if (isSpa) navigate("home");
    else router.push("/");
  }, [isSpa, navigate, router]);

  const goCategory = useCallback(
    (slug: string) => {
      go("category", { slug });
    },
    [go]
  );

  const goSearch = useCallback(
    (keyword?: string) => {
      go("search", keyword ? { keyword } : {});
    },
    [go]
  );

  const goPricing = useCallback(() => {
    go("pricing");
  }, [go]);

  const goPostAd = useCallback(() => {
    if (isSpa) {
      navigate("post-ad");
    } else {
      router.push("/create-listing");
    }
  }, [isSpa, navigate, router]);

  const goDashboard = useCallback(
    (tab?: "overview" | "listings" | "settings") => {
      go("dashboard", tab ? { tab } : {});
    },
    [go]
  );

  return {
    isSpa,
    go,
    goHome,
    goCategory,
    goSearch,
    goPricing,
    goPostAd,
    goDashboard,
    navigate,
    router,
  };
}

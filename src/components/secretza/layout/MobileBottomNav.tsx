"use client";

import { Home, Search, Plus, Heart, User } from "lucide-react";
import { useNavigationStore, useAuthStore } from "@/store/useAppStore";
import type { AppView } from "@/lib/types";

interface NavItem {
  label: string;
  icon: React.ElementType;
  view: AppView;
  params?: Record<string, string>;
  isCenter?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    icon: Home,
    view: "home",
  },
  {
    label: "Search",
    icon: Search,
    view: "search",
  },
  {
    label: "Post Ad",
    icon: Plus,
    view: "post-ad",
    isCenter: true,
  },
  {
    label: "Favorites",
    icon: Heart,
    view: "dashboard",
    params: { tab: "favorites" },
  },
  {
    label: "Profile",
    icon: User,
    view: "dashboard",
  },
];

export default function MobileBottomNav() {
  const { nav, navigate } = useNavigationStore();
  const { isAuthenticated, user, setAuthModalOpen, setAuthModalTab } = useAuthStore();

  const handleClick = (item: NavItem) => {
    // If navigating to favorites (dashboard+tab) or profile and not authenticated, open auth modal
    if (!isAuthenticated && item.view === "dashboard") {
      setAuthModalTab("login");
      setAuthModalOpen(true);
      return;
    }

    // If navigating to post-ad and not authenticated, redirect to register
    if (!isAuthenticated && item.view === "post-ad") {
      setAuthModalTab("register");
      setAuthModalOpen(true);
      return;
    }

    // Admin/moderator users: route Profile tab to admin panel
    const resolvedView = (item.view === "dashboard" && (user?.role === "admin" || user?.role === "moderator"))
      ? "admin"
      : item.view;

    navigate(resolvedView, item.params);
  };

  const isActive = (item: NavItem) => {
    if (item.isCenter) return false;
    return nav.view === item.view;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <button
                key={item.label}
                onClick={() => handleClick(item)}
                className="flex flex-col items-center justify-center -mt-5"
                aria-label={item.label}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full gradient-violet violet-glow shadow-lg shadow-violet/25">
                  <Icon className="size-5 text-white" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground mt-1">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.label}
              onClick={() => handleClick(item)}
              className="flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-colors"
              aria-label={item.label}
            >
              <Icon
                className={`size-5 transition-colors duration-200 ${
                  active
                    ? "text-violet"
                    : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  active ? "text-violet" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

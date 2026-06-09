import { create } from "zustand";
import type { AppView, NavigationState, User, SearchFilters } from "@/lib/types";

// ==========================================
// Navigation Store
// ==========================================
interface NavigationStore {
  nav: NavigationState;
  navigate: (view: AppView, params?: Record<string, string>) => void;
  goBack: () => void;
  history: NavigationState[];

  dashboardPage: "overview" | "listings" | "reviews" | "settings";
  setDashboardPage: (
    page: "overview" | "listings" | "reviews" | "settings"
  ) => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  nav: { view: "home", params: {} },
  history: [],

  dashboardPage: "overview" as "overview" | "listings" | "reviews" | "settings",

setDashboardPage: (page) => {
  localStorage.setItem("dashboardPage", page);
  set({ dashboardPage: page });
},
  navigate: (view, params = {}) => {
    const current = get().nav;
    set((state) => ({
      nav: { view, params },
      history: [...state.history, current],
    }));
  },
  goBack: () => {
    const history = get().history;
    if (history.length > 0) {
      const prev = history[history.length - 1];
      set({
        nav: prev,
        history: history.slice(0, -1),
      });
    } else {
      set({ nav: { view: "home", params: {} } });
    }
  },
}));

// ==========================================
// Auth Store
// ==========================================
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalTab: "login" | "register" | "forgot-password";
  setAuthModalOpen: (open: boolean) => void;
  setAuthModalTab: (tab: "login" | "register" | "forgot-password") => void;
  login: (user: User) => void;
  logout: () => void;
  // Session sync from NextAuth
  _hydrated: boolean;
  setHydrated: (val: boolean) => void;
  syncFromSession: (sessionUser: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
    isVerified?: boolean;
    isSuspended?: boolean;
    isPremium?: boolean;
    // NextAuth sessions are JSON-serialized over HTTP, so Date objects
    // become ISO strings by the time they reach the client. Accept both
    // to avoid a runtime "toISOString is not a function" error.
    premiumExpiry?: Date | string | null;
    provider?: string;
  } | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isAuthModalOpen: false,
  authModalTab: "login",
  _hydrated: false,
  setHydrated: (val) => set({ _hydrated: val }),
  setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
  setAuthModalTab: (tab) => set({ authModalTab: tab }),
  login: (user) => set({ user, isAuthenticated: true, isAuthModalOpen: false }),
  logout: () => set({ user: null, isAuthenticated: false }),
  syncFromSession: (sessionUser) => {
    if (sessionUser?.id) {
      set({
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
          name: sessionUser.name || null,
          avatar: sessionUser.image || null,
          role: (sessionUser.role as User["role"]) || "user",
          isVerified: sessionUser.isVerified ?? false,
          isSuspended: sessionUser.isSuspended ?? false,
          isPremium: sessionUser.isPremium ?? false,
          // premiumExpiry arrives as a Date on the first JWT sign-in and as an
          // ISO string on every subsequent request (JSON round-trip through the
          // JWT cookie and the /api/auth/session HTTP response). Handle both.
          premiumExpiry: sessionUser.premiumExpiry
            ? (sessionUser.premiumExpiry instanceof Date
                ? sessionUser.premiumExpiry.toISOString()
                : String(sessionUser.premiumExpiry))
            : null,
          provider: (sessionUser.provider as User["provider"]) || "email",
          createdAt: new Date().toISOString(),
        },
        isAuthenticated: true,
        _hydrated: true,
      });
    } else {
      set({ user: null, isAuthenticated: false, _hydrated: true });
    }
  },
}));

// ==========================================
// Search Store
// ==========================================
interface SearchStore {
  filters: SearchFilters;
  setFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: SearchFilters = {
  sortBy: "relevance",
  page: 1,
  limit: 20,
};

export const useSearchStore = create<SearchStore>((set) => ({
  filters: { ...defaultFilters },
  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}));

// ==========================================
// UI Store
// ==========================================
interface UIStore {
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isCreateListingOpen: boolean;
  setCreateListingOpen: (open: boolean) => void;
  selectedListingId: string | null;
  setSelectedListingId: (id: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  isCreateListingOpen: false,
  setCreateListingOpen: (open) => set({ isCreateListingOpen: open }),
  selectedListingId: null,
  setSelectedListingId: (id) => set({ selectedListingId: id }),
}));

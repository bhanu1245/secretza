"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useAuthStore, useNavigationStore } from "@/store/useAppStore";
import { ADMIN_HOME, isAdminRole } from "@/lib/admin-nav";

/**
 * Bridges NextAuth session state to Zustand auth store.
 * Must be placed inside the SessionProvider.
 *
 * Login detection logic:
 *   - On page load, if user is already authenticated, we mark them as
 *     "was already authenticated" WITHOUT triggering redirect.
 *   - Only when the session transitions from unauthenticated → authenticated
 *     WITHIN the same page lifecycle (i.e. wasAuthenticatedRef was explicitly
 *     set to false after the initial hydration pass) do we treat it as a
 *     new login and trigger the role-based redirect.
 */
export default function AuthSync() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const syncFromSession = useAuthStore((s) => s.syncFromSession);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const logout = useAuthStore((s) => s.logout);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const navigate = useNavigationStore((s) => s.navigate);
  const navView = useNavigationStore((s) => s.nav.view);
  const pathname = usePathname();
  const prevSessionRef = useRef<string | null>(null);
  const prevStatusRef = useRef<typeof status | null>(null);
  // Tracks whether we have completed at least one hydration cycle.
  // Once hydrated, a subsequent null→authenticated transition is a real login.
  const hydratedRef = useRef(false);

  const handleLoginRedirect = useCallback(
    (role: string | undefined) => {
      // Close the auth modal first
      setAuthModalOpen(false);

      // Redirect by role
      if (isAdminRole(role)) {
        router.push(ADMIN_HOME);
      } else {
        navigate("dashboard");
      }
    },
    [navigate, setAuthModalOpen, router],
  );

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      if (!session.user.id) {
        console.warn("[AuthSync] Authenticated session is missing user id; clearing client auth state");
        prevSessionRef.current = null;
        prevStatusRef.current = "unauthenticated";
        logout();
        setHydrated(true);
        hydratedRef.current = true;
        void signOut({ redirect: false });
        return;
      }

      const sessionKey = `${session.user.id}-${session.user.email}`;
      const previousSessionKey = prevSessionRef.current;
      const previousStatus = prevStatusRef.current;
      const isNewLogin =
        hydratedRef.current &&
        previousStatus === "unauthenticated" &&
        previousSessionKey === null;

      // Sync user data to Zustand store whenever session key changes
      if (previousSessionKey !== sessionKey) {
        prevSessionRef.current = sessionKey;
        syncFromSession({
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          role: session.user.role,
          isVerified: session.user.isVerified,
          isSuspended: session.user.isSuspended,
          isPremium: session.user.isPremium,
          premiumExpiry: session.user.premiumExpiry,
          provider: session.user.provider,
        });
      }

      // After first hydration completes, mark as hydrated.
      // If the user was already authenticated on page load, this is NOT a new login.
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        setHydrated(true);
        prevStatusRef.current = status;
        // No redirect — user was already logged in (page refresh / first visit)
        return;
      }

      if (isNewLogin) {
        const isCreatingListing =
          navView === "post-ad" || pathname === "/create-listing";

        if (!isCreatingListing) {
          setTimeout(() => {
            handleLoginRedirect(session.user.role);
          }, 100);
        } else {
          setAuthModalOpen(false);
        }
      }

      prevStatusRef.current = status;
    } else if (status === "unauthenticated") {
      // Clear session tracking — enables next login to be detected as "new"
      const hadSession = prevSessionRef.current !== null;
      prevSessionRef.current = null;
      prevStatusRef.current = status;

      if (hadSession) {
        // User was logged in and is now logged out
        logout();
      }

      if (!hydratedRef.current) {
        hydratedRef.current = true;
        setHydrated(true);
      }
    }
  }, [
    session,
    status,
    syncFromSession,
    logout,
    setHydrated,
    handleLoginRedirect,
    navView,
    pathname,
    setAuthModalOpen,
  ]);

  return null; // Renderless component
}

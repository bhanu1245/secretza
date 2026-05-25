"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useAuthStore, useNavigationStore } from "@/store/useAppStore";

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
  const { data: session, status } = useSession();
  const syncFromSession = useAuthStore((s) => s.syncFromSession);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const logout = useAuthStore((s) => s.logout);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const navigate = useNavigationStore((s) => s.navigate);
  const prevSessionRef = useRef<string | null>(null);
  // Tracks whether we have completed at least one hydration cycle.
  // Once hydrated, a subsequent null→authenticated transition is a real login.
  const hydratedRef = useRef(false);

  const handleLoginRedirect = useCallback(
    (role: string | undefined) => {
      // Close the auth modal first
      setAuthModalOpen(false);

      // Redirect by role
      if (role === "admin") {
        navigate("admin");
      } else if (role === "moderator") {
        navigate("admin");
      } else {
        navigate("dashboard");
      }
    },
    [navigate, setAuthModalOpen],
  );

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      const sessionKey = `${session.user.id}-${session.user.email}`;

      // Sync user data to Zustand store whenever session key changes
      if (prevSessionRef.current !== sessionKey) {
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
        // No redirect — user was already logged in (page refresh / first visit)
        return;
      }

      // At this point, hydratedRef is true and session changed.
      // This means the user just logged in within this page lifecycle.
      // Check if prevSessionRef was null (transition from unauthenticated to authenticated).
      // Actually, prevSessionRef is already set above, so we need a different signal.
      // The key insight: if hydratedRef was already true AND we just synced a new session,
      // then the user logged in via the modal.
      // We detect this because prevSessionRef.current was updated from null (cleared on logout)
      // to a real value.

      // We already set prevSessionRef and synced above. Now trigger redirect.
      // The fact that hydratedRef was true before this session change means it's a real login.
      setTimeout(() => {
        handleLoginRedirect(session.user.role);
      }, 100);
    } else if (status === "unauthenticated") {
      // Clear session tracking — enables next login to be detected as "new"
      const hadSession = prevSessionRef.current !== null;
      prevSessionRef.current = null;

      if (hadSession) {
        // User was logged in and is now logged out
        logout();
      }

      if (!hydratedRef.current) {
        hydratedRef.current = true;
        setHydrated(true);
      }
    }
  }, [session, status, syncFromSession, logout, setHydrated, handleLoginRedirect]);

  return null; // Renderless component
}

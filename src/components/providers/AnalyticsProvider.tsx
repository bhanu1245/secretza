"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

const NEXT_PUBLIC_GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const NEXT_PUBLIC_PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

// ---------------------------------------------------------------------------
// gtag type declarations
// ---------------------------------------------------------------------------

// Extend Window to include the gtag.js data layer
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}

// ---------------------------------------------------------------------------
// GA4 script loader
// ---------------------------------------------------------------------------

function loadGA4Script(gaId: string): void {
  if (typeof window === "undefined") return;
  if (window.dataLayer) return; // Already loaded

  window.dataLayer = window.dataLayer || [];

  // Inline gtag definition — must be set before loading the library
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };

  // Initial config
  window.gtag("js", new Date());
  window.gtag("config", gaId, {
    send_page_view: false, // We handle page views manually
  });

  // Inject the gtag.js script asynchronously
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);
}

// ---------------------------------------------------------------------------
// Plausible script loader
// ---------------------------------------------------------------------------

function loadPlausibleScript(domain: string): void {
  if (typeof window === "undefined") return;
  if (document.getElementById("plausible-script")) return; // Already loaded

  const script = document.createElement("script");
  script.id = "plausible-script";
  script.async = true;
  script.defer = true;
  script.dataset.domain = domain;
  script.src = "https://plausible.io/js/script.manual.js";
  document.head.appendChild(script);

  // Initialize Plausible with manual page views (we track ourselves)
  if (typeof window.plausible === "function") {
    window.plausible("enableAutoOutboundTracking");
  }
}

// Extend Window for Plausible
declare global {
  interface Window {
    plausible: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

// ---------------------------------------------------------------------------
// useTrackEvent hook
// ---------------------------------------------------------------------------

/**
 * Hook for tracking custom events from the client side.
 * Sends to GA4 (via gtag) and Plausible (via window.plausible) if configured.
 */
export function useTrackEvent() {
  return useCallback(
    (eventName: string, properties?: Record<string, string | number | boolean>) => {
      try {
        // GA4
        if (NEXT_PUBLIC_GA_ID && typeof window.gtag === "function") {
          window.gtag("event", eventName, properties);
        }

        // Plausible
        if (NEXT_PUBLIC_PLAUSIBLE_DOMAIN && typeof window.plausible === "function") {
          window.plausible(eventName, properties ? { props: properties } : undefined);
        }
      } catch {
        // Never let analytics break the UI
      }
    },
    [],
  );
}

// ---------------------------------------------------------------------------
// useTrackPageView hook
// ---------------------------------------------------------------------------

/**
 * Hook for manually triggering a page view event.
 * Useful when you need to track page views outside of automatic tracking.
 */
export function useTrackPageView() {
  return useCallback(
    (path: string, title?: string) => {
      try {
        // GA4
        if (NEXT_PUBLIC_GA_ID && typeof window.gtag === "function") {
          window.gtag("event", "page_view", {
            page_path: path,
            page_title: title ?? document.title,
          });
        }

        // Plausible
        if (NEXT_PUBLIC_PLAUSIBLE_DOMAIN && typeof window.plausible === "function") {
          window.plausible("pageview", { u: path });
        }
      } catch {
        // Never let analytics break the UI
      }
    },
    [],
  );
}

// ---------------------------------------------------------------------------
// AnalyticsProvider component
// ---------------------------------------------------------------------------

interface AnalyticsProviderProps {
  children: ReactNode;
}

/**
 * Client-side analytics provider.
 *
 * Responsibilities:
 *  1. Loads GA4 gtag.js if NEXT_PUBLIC_GA_ID is set
 *  2. Loads Plausible script if NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set
 *  3. Automatically tracks page views on route changes via usePathname
 *
 * Usage: wrap inside <SessionProvider> in layout.tsx.
 */
export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  // Load analytics scripts once on mount
  useEffect(() => {
    if (NEXT_PUBLIC_GA_ID) {
      loadGA4Script(NEXT_PUBLIC_GA_ID);
    }
    if (NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
      loadPlausibleScript(NEXT_PUBLIC_PLAUSIBLE_DOMAIN);
    }
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip duplicate tracking for the same path
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;

    // Small delay to ensure the new page's title has been applied to the DOM
    const timer = setTimeout(() => {
      const title = document.title;

      // GA4
      if (NEXT_PUBLIC_GA_ID && typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: pathname,
          page_title: title,
          page_location: window.location.href,
        });
      }

      // Plausible
      if (NEXT_PUBLIC_PLAUSIBLE_DOMAIN && typeof window.plausible === "function") {
        window.plausible("pageview", { u: pathname });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  return <>{children}</>;
}

"use client";

import { useEffect, useState } from "react";
import LogoMark from "@/components/brand/LogoMark";
import { Button } from "@/components/ui/button";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sz_age_gate";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EXIT_URL = "https://www.google.com";

// ─── Helpers (localStorage is not available in SSR) ──────────────────────────

function hasValidAcceptance(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    return Date.now() - ts < THIRTY_DAYS_MS;
  } catch {
    // Blocked in private-browsing with storage denied — allow through silently.
    return true;
  }
}

function persistAcceptance(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Best-effort.
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * 18+ Age Verification Gate.
 *
 * Renders nothing on the server (and therefore on the first SSR pass that
 * search-engine crawlers see), so it does not affect SEO metadata or
 * indexability. On the client, after hydration, it checks localStorage.
 * If no valid acceptance is stored (or it is older than 30 days) the modal
 * is displayed. The page content is always present in the DOM — only the
 * visual overlay is toggled.
 */
export default function AgeGate() {
  // Start hidden so the server render and initial client hydration both produce
  // null — preventing any hydration mismatch.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasValidAcceptance()) {
      setVisible(true);
    }
  }, []);

  // Scroll-lock: prevent the page from scrolling while the gate is open.
  useEffect(() => {
    if (visible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [visible]);

  if (!visible) return null;

  function handleEnter() {
    persistAcceptance();
    setVisible(false);
  }

  function handleExit() {
    window.location.href = EXIT_URL;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Age Verification"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      // Near-opaque overlay matching BRAND_COLORS.darkBg — covers all content
      // without using backdrop-filter (better GPU performance on mobile).
      style={{ background: "rgba(11,11,15,0.97)" }}
    >
      <div
        className={[
          "relative w-full max-w-md",
          "bg-card border border-border rounded-2xl",
          "px-7 py-9 sm:px-10 sm:py-12",
          "flex flex-col items-center gap-5 text-center",
        ].join(" ")}
      >
        {/* Brand mark */}
        <LogoMark size={52} theme="dark" idPrefix="age-gate" />

        {/* Warning badge */}
        <span
          className={[
            "inline-flex items-center gap-1.5",
            "px-3 py-1 rounded-full",
            "bg-destructive/15 border border-destructive/30",
            "text-destructive text-xs font-bold tracking-widest uppercase",
          ].join(" ")}
        >
          Adults Only · 18+
        </span>

        {/* Headline */}
        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            This website contains
            <br />adult content
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            You must be{" "}
            <strong className="text-foreground font-semibold">
              18 years of age or older
            </strong>{" "}
            to access this site. By entering you confirm that you meet the
            minimum age requirement in your jurisdiction and consent to viewing
            adult material.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mt-1">
          <Button
            size="lg"
            className="flex-1 font-semibold text-base"
            onClick={handleEnter}
          >
            I am 18+ — Enter
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 text-base"
            onClick={handleExit}
          >
            Exit
          </Button>
        </div>

        {/* Legal footnote */}
        <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xs">
          Your choice will be remembered for 30 days. SecretZa operates in
          compliance with applicable law. If you are under 18, please leave now.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  analyzeSeoContent,
  countWords,
  type SeoQualityResult,
} from "@/lib/seo-quality";

export interface SeoQualityFields {
  title?: string;
  metaDescription?: string;
  h1?: string;
  introContent?: string;
  canonicalUrl?: string;
  featuredImage?: string;
  faqCount?: number;
  internalLinksCount?: number;
}

export interface UseSeoQualityOptions {
  /** When true, fetch peer-based uniqueness from /api/seo/quality (admin SEO pages). */
  fetchUniqueness?: boolean;
  pageType?: string;
  pageSlug?: string;
  debounceMs?: number;
}

const NO_DUPLICATES = {
  title: false,
  metaDescription: false,
  h1: false,
  introContent: false,
  faqContent: false,
} as const;

/**
 * Real-time SEO quality scoring.
 * - Structural score is computed instantly on the client via the canonical
 *   seo-quality.ts engine (no network, no duplicate logic).
 * - When `fetchUniqueness` is enabled, peer-based uniqueness is fetched
 *   (debounced) from /api/seo/quality and replaces the structural result.
 */
export function useSeoQualityScore(
  fields: SeoQualityFields,
  options?: UseSeoQualityOptions,
): { result: SeoQualityResult; loading: boolean } {
  const debounceMs = options?.debounceMs ?? 500;
  const [serverResult, setServerResult] = useState<SeoQualityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const serialized = JSON.stringify(fields);

  const structural = useMemo<SeoQualityResult>(() => {
    return analyzeSeoContent({
      title: fields.title ?? "",
      metaDescription: fields.metaDescription ?? "",
      h1: fields.h1 ?? "",
      introContent: fields.introContent ?? "",
      canonicalUrl: fields.canonicalUrl,
      featuredImage: fields.featuredImage,
      faqCount: fields.faqCount ?? 0,
      internalLinksCount: fields.internalLinksCount ?? 0,
      wordCount: countWords(fields.introContent),
      uniquenessScore: 100,
      duplicateFields: { ...NO_DUPLICATES },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  const latestRequest = useRef(0);

  useEffect(() => {
    if (!options?.fetchUniqueness) {
      setServerResult(null);
      return;
    }
    const requestId = ++latestRequest.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/seo/quality", {
          method: "POST",
          body: JSON.stringify({ ...fields, pageType: options.pageType, pageSlug: options.pageSlug }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (requestId === latestRequest.current && data?.result) {
          setServerResult(data.result as SeoQualityResult);
        }
      } catch {
        // Scoring is best-effort; never block the UI.
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, options?.fetchUniqueness, options?.pageType, options?.pageSlug, debounceMs]);

  const result = options?.fetchUniqueness && serverResult ? serverResult : structural;
  return { result, loading };
}

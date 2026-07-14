/**
 * Run-scoped cache for SEO peer pages used in uniqueness scoring.
 * Cleared between regeneration batches to release memory.
 *
 * When a background job run is active (`beginSeoJobRun`), calls to
 * `clearSeoPeerCache` are silenced so the peer corpus survives across
 * all batches in a single job.  The cache is flushed once when the job
 * finishes (`endSeoJobRun`).
 */

import { db } from "@/lib/db";
import type { SeoPageSnapshot } from "@/lib/seo-quality";
import type { SeoPageType } from "@/lib/seo-page-service";

const peerCache = new Map<string, SeoPageSnapshot[]>();

// Job IDs that are currently being processed.  While this Set is non-empty,
// clearSeoPeerCache() is a no-op so the cache survives mid-job batch clears.
const activeJobRuns = new Set<string>();

/**
 * Signal that a job run has started.  Peer cache clears are suppressed
 * until the matching endSeoJobRun() call.
 */
export function beginSeoJobRun(jobId: string): void {
  activeJobRuns.add(jobId);
}

/**
 * Signal that a job run has finished.  Removes the lock and immediately
 * flushes the peer cache if no other jobs are still running.
 */
export function endSeoJobRun(jobId: string): void {
  activeJobRuns.delete(jobId);
  if (activeJobRuns.size === 0) {
    peerCache.clear();
    console.log("[seo-peer-cache] job run ended — peer cache flushed");
  }
}

export function getSeoPeerLimit(): number {
  const parsed = parseInt(process.env.SEO_REGEN_PEER_LIMIT ?? "75", 10);
  if (Number.isNaN(parsed)) return 75;
  return Math.min(Math.max(parsed, 10), 200);
}

async function fetchPeerPagesFromDb(pageType: SeoPageType): Promise<SeoPageSnapshot[]> {
  const pages = await db.seoPage.findMany({
    where: { pageType },
    select: {
      id: true,
      pageType: true,
      pageSlug: true,
      title: true,
      metaDescription: true,
      h1: true,
      introContent: true,
      faqs: {
        select: { question: true, answer: true },
        take: 8,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: getSeoPeerLimit(),
  });

  return pages.map((p) => ({
    id: p.id,
    pageType: p.pageType,
    pageSlug: p.pageSlug,
    title: p.title,
    metaDescription: p.metaDescription,
    h1: p.h1,
    introContent: p.introContent,
    faqText: p.faqs.map((f) => `${f.question} ${f.answer}`).join(" "),
  }));
}

/** Cached peer corpus for a page type (one DB load per batch/run). */
export async function getCachedPeerPages(
  pageType: SeoPageType,
  excludeSlug?: string,
): Promise<SeoPageSnapshot[]> {
  if (!peerCache.has(pageType)) {
    peerCache.set(pageType, await fetchPeerPagesFromDb(pageType));
  }

  const peers = peerCache.get(pageType)!;
  if (!excludeSlug) return peers;
  return peers.filter((p) => p.pageSlug !== excludeSlug);
}

/**
 * Release peer snapshots.  If a job run is active the call is silenced —
 * the cache will be flushed when endSeoJobRun() fires instead.
 */
export function clearSeoPeerCache(): void {
  if (activeJobRuns.size > 0) {
    console.log(
      `[seo-peer-cache] clear skipped — job run active (${[...activeJobRuns].join(",")}), peer cache retained`,
    );
    return;
  }
  peerCache.clear();
}

export function getSeoPeerCacheStats(): { pageTypes: string[]; totalPeers: number } {
  let totalPeers = 0;
  for (const peers of peerCache.values()) {
    totalPeers += peers.length;
  }
  return { pageTypes: [...peerCache.keys()], totalPeers };
}

// ==========================================
// SecretZa — Listing SEO V5 Lite: peer cache
// ==========================================
// Run-scoped cache of sibling listings (same category + city) used for
// uniqueness scoring. Mirrors seo-peer-cache.ts but reads the Listing table,
// not seoPage. Cleared on demand to release memory.

import { db } from "@/lib/db";

export interface ListingPeer {
  id: string;
  title: string;
  description: string;
}

const peerCache = new Map<string, ListingPeer[]>();

function getPeerLimit(): number {
  const parsed = parseInt(process.env.LISTING_PEER_LIMIT ?? "50", 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 10), 200);
}

async function fetchPeersFromDb(
  categorySlug: string,
  citySlug: string,
): Promise<ListingPeer[]> {
  const rows = await db.listing.findMany({
    where: {
      status: "approved",
      categorySlug,
      citySlug,
    },
    select: { id: true, title: true, description: true },
    orderBy: { updatedAt: "desc" },
    take: getPeerLimit(),
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    description: r.description ?? "",
  }));
}

/**
 * Get sibling listings for uniqueness comparison. Cached per category+city for
 * the duration of the run. Returns [] when location/category are missing.
 */
export async function getCachedListingPeers(
  categorySlug: string | null | undefined,
  citySlug: string | null | undefined,
  excludeId?: string | null,
): Promise<ListingPeer[]> {
  if (!categorySlug || !citySlug) return [];
  const key = `${categorySlug}:${citySlug}`;

  let peers = peerCache.get(key);
  if (!peers) {
    peers = await fetchPeersFromDb(categorySlug, citySlug);
    peerCache.set(key, peers);
  }

  return excludeId ? peers.filter((p) => p.id !== excludeId) : peers;
}

export function clearListingPeerCache(): void {
  peerCache.clear();
}

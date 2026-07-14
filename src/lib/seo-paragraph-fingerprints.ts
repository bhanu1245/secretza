/**
 * Paragraph fingerprint database — tracks hashes of all generated paragraphs
 * to prevent template reuse across SecretZa SEO pages.
 */
import { db } from "@/lib/db";
import { computeContentHash, normalizeForComparison } from "@/lib/seo-quality";
import type { SeoPageType } from "@/lib/seo-page-service";

const storeCache = new Map<string, Set<string>>();

/** Strip H2 sentinels and headings for fingerprinting body paragraphs. */
export function extractFingerprintParagraphs(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n\n+/)
    .map((p) =>
      p
        .replace(/^##H2::.*?##\s*/i, "")
        .replace(/^#{1,3}\s+.+$/gm, "")
        .trim(),
    )
    .filter((p) => p.length > 40);
}

export function fingerprintParagraph(para: string): string {
  return computeContentHash(normalizeForComparison(para));
}

async function loadFingerprintsFromDb(pageType: SeoPageType): Promise<Set<string>> {
  const pages = await db.seoPage.findMany({
    where: { pageType },
    select: { introContent: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const hashes = new Set<string>();
  for (const page of pages) {
    for (const para of extractFingerprintParagraphs(page.introContent)) {
      hashes.add(fingerprintParagraph(para));
    }
  }
  return hashes;
}

export async function getParagraphFingerprintStore(
  pageType: SeoPageType,
  forceRefresh = false,
): Promise<Set<string>> {
  if (!forceRefresh && storeCache.has(pageType)) {
    return storeCache.get(pageType)!;
  }
  const store = await loadFingerprintsFromDb(pageType);
  storeCache.set(pageType, store);
  return store;
}

export function registerParagraphFingerprints(
  store: Set<string>,
  introContent: string,
): void {
  for (const para of extractFingerprintParagraphs(introContent)) {
    store.add(fingerprintParagraph(para));
  }
}

export function hasDuplicateParagraph(
  store: Set<string>,
  para: string,
): boolean {
  return store.has(fingerprintParagraph(para));
}

export function countDuplicateParagraphs(
  store: Set<string>,
  introContent: string,
): number {
  let count = 0;
  for (const para of extractFingerprintParagraphs(introContent)) {
    if (hasDuplicateParagraph(store, para)) count++;
  }
  return count;
}

export function clearParagraphFingerprintCache(): void {
  storeCache.clear();
}

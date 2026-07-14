/**
 * V6.1 — Rewrite only duplicate sections; preserve unique content.
 */
import { db } from "@/lib/db";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import {
  applySectionConflictFixes,
  detectSectionConflicts,
  SECTION_SIMILARITY_THRESHOLD,
  type SectionConflict,
} from "@/lib/seo-content-fingerprints";
import {
  dedupeFingerprintParagraphs,
  rewriteSimilarParagraphs,
  semanticSimilarity,
} from "@/lib/seo-uniqueness-engine";
import { extractFingerprintParagraphs } from "@/lib/seo-paragraph-fingerprints";
import { getParagraphFingerprintStore } from "@/lib/seo-paragraph-fingerprints";
import type { SEOContent } from "@/lib/seo-content";
import type { SeoPageType } from "@/lib/seo-page-service";

export type PartialRegenResult = {
  content: SEOContent;
  mode: "partial";
  paragraphsRewritten: number;
  sectionsFixed: number;
  conflictsFixed: number;
  conflicts: SectionConflict[];
  generationTimeMs: number;
};

/**
 * Attempt partial regeneration — only rewrite duplicated paragraphs/sections.
 * Returns null if full regeneration is required (>50% paragraphs conflict or uniqueness < 50%).
 */
export async function tryPartialCityRegeneration(input: {
  pageType: string;
  pageSlug: string;
  cityName: string;
  existing: {
    id: string;
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    introContent: string | null;
    uniquenessScore: number | null;
    faqs: Array<{ question: string; answer: string }>;
    canonicalUrl?: string | null;
    featuredImage?: string | null;
    primaryKeyword?: string | null;
    secondaryKeywords?: string[] | null;
  };
  baseContent: SEOContent;
}): Promise<PartialRegenResult | null> {
  const start = Date.now();
  const intro = input.existing.introContent?.trim();
  if (!intro || intro.length < 200) return null;

  const priorUnique = input.existing.uniquenessScore ?? 0;
  if (priorUnique < 50) return null;

  const peers = await getCachedPeerPages(input.pageType as SeoPageType, input.pageSlug);
  const peerIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);

  const paragraphs = extractFingerprintParagraphs(intro);
  let dupCount = 0;
  for (const para of paragraphs) {
    for (const peer of peerIntros) {
      for (const pp of extractFingerprintParagraphs(peer)) {
        if (semanticSimilarity(para, pp) > SECTION_SIMILARITY_THRESHOLD) {
          dupCount++;
          break;
        }
      }
    }
  }

  if (paragraphs.length === 0) return null;
  const dupRatio = dupCount / paragraphs.length;
  if (dupRatio > 0.5) return null;

  const faqs = input.existing.faqs;
  const conflicts = detectSectionConflicts({
    title: input.existing.title ?? "",
    metaDescription: input.existing.metaDescription ?? "",
    h1: input.existing.h1 ?? "",
    introContent: intro,
    faqs,
    peers: peers.map((p) => ({
      pageSlug: p.pageSlug,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      introContent: p.introContent,
      faqText: p.faqText,
    })),
    excludeSlug: input.pageSlug,
  });

  if (conflicts.length === 0 && dupCount === 0) return null;

  const fingerprintStore = await getParagraphFingerprintStore(input.pageType as SeoPageType);
  let polished = rewriteSimilarParagraphs(
    intro,
    peerIntros,
    input.cityName,
    Date.now() % 1000,
    SECTION_SIMILARITY_THRESHOLD,
  );
  polished = dedupeFingerprintParagraphs(polished, fingerprintStore, input.cityName, 42);

  const paragraphsRewritten = polished !== intro ? dupCount : 0;
  const fixed = applySectionConflictFixes({
    title: input.existing.title ?? input.baseContent.title,
    metaDescription: input.existing.metaDescription ?? input.baseContent.metaDescription,
    h1: input.existing.h1 ?? input.baseContent.h1,
    introContent: polished,
    faqs: faqs.length > 0 ? faqs : input.baseContent.faqs,
    conflicts,
    cityName: input.cityName,
  });

  const title = fixed.title;
  const meta = fixed.metaDescription;
  const h1 = fixed.h1;
  const newFaqs = fixed.faqs;
  const sectionsFixed = paragraphsRewritten + fixed.fixedCount;

  const content: SEOContent = {
    ...input.baseContent,
    title,
    metaDescription: meta,
    h1,
    introParagraph: polished.split("\n\n")[0] ?? polished,
    fullIntroContent: polished,
    faqs: newFaqs,
    generationMeta: {
      engine: "v6.1",
      mode: "partial",
      paragraphsRewritten,
      sectionsFixed,
      conflictsFixed: conflicts.length,
      generationTimeMs: Date.now() - start,
      priorUniqueness: priorUnique,
    },
  };

  return {
    content,
    mode: "partial",
    paragraphsRewritten,
    sectionsFixed,
    conflictsFixed: conflicts.length,
    conflicts,
    generationTimeMs: Date.now() - start,
  };
}

/** Load existing page row for partial regen. */
export async function loadPageForPartialRegen(pageType: string, pageSlug: string) {
  return db.seoPage.findUnique({
    where: { pageType_pageSlug: { pageType, pageSlug } },
    include: { faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
}

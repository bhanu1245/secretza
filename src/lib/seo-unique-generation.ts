/**
 * Uniqueness-aware city SEO generation — multi-candidate selection,
 * fingerprint checks, auto-rewrite, and retry until threshold met.
 */
import { generateV5CitySEO, type V5CityContent } from "@/lib/seo-city-content-v5";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import {
  getParagraphFingerprintStore,
  registerParagraphFingerprints,
  clearParagraphFingerprintCache,
} from "@/lib/seo-paragraph-fingerprints";
import {
  CANDIDATE_COUNT,
  MAX_UNIQUENESS_ATTEMPTS,
  UNIQUENESS_MIN_ACCEPT,
  dedupeFingerprintParagraphs,
  meetsUniquenessTargets,
  rewriteSimilarParagraphs,
  scoreContentUniqueness,
  selectBestCandidate,
  type UniquenessScoreReport,
} from "@/lib/seo-uniqueness-engine";
import { computeCompositeUniqueness } from "@/lib/seo-quality";
import { pickWritingStyle } from "@/lib/seo-writing-styles";
import type { SeoPageType } from "@/lib/seo-page-service";

export type UniqueGenerationMeta = {
  writingStyle: string;
  attempt: number;
  candidateCount: number;
  uniquenessReport: UniquenessScoreReport;
  priorAttempts: number;
};

export type UniqueV5Result = V5CityContent & {
  uniquenessMeta: UniqueGenerationMeta;
};

function faqTextFrom(faqs: Array<{ question: string; answer: string }>): string {
  return faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
}

function polishIntro(
  intro: string,
  peerIntros: string[],
  cityName: string,
  salt: number,
  fingerprintStore: Set<string>,
): string {
  let polished = rewriteSimilarParagraphs(intro, peerIntros, cityName, salt);
  polished = dedupeFingerprintParagraphs(polished, fingerprintStore, cityName, salt + 1);
  return polished;
}

/**
 * Generate city content with uniqueness targeting (75–90%).
 * Never returns until threshold met or max attempts exhausted.
 */
export async function generateUniqueV5CitySEO(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  countrySlug = "india",
  options?: { excludePageId?: string; minUniqueness?: number },
): Promise<UniqueV5Result> {
  const pageType: SeoPageType = "city";
  const minTarget = options?.minUniqueness ?? UNIQUENESS_MIN_ACCEPT;

  const peers = await getCachedPeerPages(pageType, citySlug);
  const fingerprintStore = await getParagraphFingerprintStore(pageType);

  let bestResult: UniqueV5Result | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < MAX_UNIQUENESS_ATTEMPTS; attempt++) {
    const candidates: Array<{
      content: V5CityContent;
      introContent: string;
      faqText: string;
      title: string;
      metaDescription: string;
    }> = [];

    for (let c = 0; c < CANDIDATE_COUNT; c++) {
      const style = pickWritingStyle(citySlug, attempt * CANDIDATE_COUNT + c);
      const salt = attempt * 100 + c * 13;

      const generated = generateV5CitySEO(
        cityName,
        citySlug,
        stateName,
        stateSlug,
        dbAreas,
        countrySlug,
        { writingStyle: style, salt, attempt: attempt * CANDIDATE_COUNT + c },
      );

      const peerIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);
      const polishedIntro = polishIntro(
        generated.introContent,
        peerIntros,
        cityName,
        salt,
        fingerprintStore,
      );

      const content: V5CityContent = {
        ...generated,
        introContent: polishedIntro,
      };

      candidates.push({
        content,
        introContent: polishedIntro,
        faqText: faqTextFrom(content.faqs),
        title: content.title,
        metaDescription: content.metaDescription,
      });
    }

    const selected = selectBestCandidate(
      candidates,
      peers,
      citySlug,
      fingerprintStore,
    );
    if (!selected) continue;

    const report = selected.score;
    const style = pickWritingStyle(citySlug, attempt);
    const peerIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);
    const savedMetric = computeCompositeUniqueness({
      introContent: selected.content.introContent,
      faqText: faqTextFrom(selected.content.faqs),
      title: selected.content.title,
      metaDescription: selected.content.metaDescription,
      peerIntros,
      peerFaqs: peers.map((p) => p.faqText ?? ""),
      peerTitles: peers.map((p) => p.title ?? ""),
      peerMetas: peers.map((p) => p.metaDescription ?? ""),
    });

    const result: UniqueV5Result = {
      ...selected.content,
      uniquenessMeta: {
        writingStyle: style,
        attempt,
        candidateCount: CANDIDATE_COUNT,
        uniquenessReport: {
          ...report,
          overall: savedMetric.overall,
          paragraphMinScore: savedMetric.paragraphMinScore,
        },
        priorAttempts: attempt,
      },
    };

    if (savedMetric.overall > bestScore) {
      bestScore = savedMetric.overall;
      bestResult = result;
    }

    if (savedMetric.overall >= minTarget && meetsUniquenessTargets(report)) {
      registerParagraphFingerprints(fingerprintStore, result.introContent);
      return result;
    }
  }

  if (bestResult) {
    registerParagraphFingerprints(fingerprintStore, bestResult.introContent);
    return bestResult;
  }

  const fallback = generateV5CitySEO(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    dbAreas,
    countrySlug,
    { salt: 999, attempt: MAX_UNIQUENESS_ATTEMPTS },
  );
  const peerIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);
  const polishedIntro = polishIntro(
    fallback.introContent,
    peerIntros,
    cityName,
    999,
    fingerprintStore,
  );

  const report = scoreContentUniqueness({
    introContent: polishedIntro,
    faqText: faqTextFrom(fallback.faqs),
    title: fallback.title,
    metaDescription: fallback.metaDescription,
    peers,
    excludeSlug: citySlug,
    fingerprintStore,
  });

  registerParagraphFingerprints(fingerprintStore, polishedIntro);

  return {
    ...fallback,
    introContent: polishedIntro,
    uniquenessMeta: {
      writingStyle: "informational",
      attempt: MAX_UNIQUENESS_ATTEMPTS,
      candidateCount: 1,
      uniquenessReport: report,
      priorAttempts: MAX_UNIQUENESS_ATTEMPTS,
    },
  };
}

export { clearParagraphFingerprintCache };

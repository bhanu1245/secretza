/**
 * SEO V6.1 unique city generation — 3 candidates, 3 attempts, early-exit.
 */
import { generateV6CitySEO, type V6CityContent } from "@/lib/seo-city-content-v6";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import {
  getParagraphFingerprintStore,
  registerParagraphFingerprints,
  clearParagraphFingerprintCache,
} from "@/lib/seo-paragraph-fingerprints";
import {
  V6_CANDIDATE_COUNT,
  V6_MAX_ATTEMPTS,
  V6_SIMILARITY_REWRITE_THRESHOLD,
  dedupeFingerprintParagraphs,
  rewriteSimilarParagraphs,
  selectBestV6Candidate,
  shouldEarlyExitV61,
  shouldRetryV61,
  type UniquenessScoreReport,
  type V6CandidateScore,
} from "@/lib/seo-uniqueness-engine";
import { computeCompositeUniqueness } from "@/lib/seo-quality";
import {
  applySectionConflictFixes,
  detectSectionConflicts,
} from "@/lib/seo-content-fingerprints";
import { pickWritingStyle } from "@/lib/seo-writing-styles";
import type { SeoPageType } from "@/lib/seo-page-service";
import type { V6PageArchitecture } from "@/lib/seo-city-content-v6";
import type { CityListingContext } from "@/lib/seo-dynamic-listing-context";

export type V6GenerationMeta = {
  engine: "v6.1";
  mode: "full";
  writingStyle: string;
  architecture: string;
  attempt: number;
  candidateCount: number;
  candidateSelected: number;
  candidatesEvaluated: number;
  uniquenessReport: UniquenessScoreReport;
  v6Score: V6CandidateScore;
  localReferenceCount: number;
  paragraphsRewritten: number;
  intelligenceSource: string;
  retriesUsed: number;
  earlyExit: boolean;
  listingContextFetchedAt?: string;
  duplicateConflictsFixed?: number;
};

export type UniqueV6Result = V6CityContent & {
  uniquenessMeta: V6GenerationMeta;
};

const V6_ARCHITECTURES: V6PageArchitecture[] = [
  "tourism",
  "nightlife",
  "business_traveler",
  "local_resident",
  "transport_hub",
  "premium",
  "cultural",
];

const NARRATIVE_THEMES = [
  "economic_overview",
  "business_travel",
  "tourism",
  "nightlife",
  "students",
  "it_professionals",
  "festivals",
  "corporate_visitors",
  "weekend_travellers",
  "local_culture",
  "transport",
] as const;

function faqTextFrom(faqs: Array<{ question: string; answer: string }>): string {
  return faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
}

function localRefCorpus(content: V6CityContent): string[] {
  const i = content.localIntelligence;
  return [
    ...i.luxuryAreas,
    ...(i.premiumResidentialAreas ?? []),
    ...i.hotels,
    ...(i.businessHotels ?? []),
    ...(i.resorts ?? []),
    ...i.railwayStations,
    ...i.busStands,
    ...i.airports,
    ...i.shoppingMalls,
    ...i.itParks,
    ...i.touristAttractions,
    ...i.landmarks,
    ...i.markets,
    ...i.festivals,
    ...(i.foodStreets ?? []),
    ...i.nightlife,
    ...i.businessDistricts,
    ...(i.famousRoads ?? []),
    ...(i.historicMonuments ?? []),
  ];
}

function fixContentSectionConflicts(
  content: V6CityContent,
  peers: Awaited<ReturnType<typeof getCachedPeerPages>>,
  citySlug: string,
  cityName: string,
): { content: V6CityContent; conflictsFixed: number } {
  const conflicts = detectSectionConflicts({
    title: content.title,
    metaDescription: content.metaDescription,
    h1: content.h1,
    introContent: content.introContent,
    faqs: content.faqs,
    peers: peers.map((p) => ({
      pageSlug: p.pageSlug,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      introContent: p.introContent,
      faqText: p.faqText,
    })),
    excludeSlug: citySlug,
  });

  if (conflicts.length === 0) return { content, conflictsFixed: 0 };

  const fixed = applySectionConflictFixes({
    title: content.title,
    metaDescription: content.metaDescription,
    h1: content.h1,
    introContent: content.introContent,
    faqs: content.faqs,
    conflicts,
    cityName,
  });

  return {
    content: {
      ...content,
      title: fixed.title,
      metaDescription: fixed.metaDescription,
      h1: fixed.h1,
      introContent: fixed.introContent,
      faqs: fixed.faqs,
    },
    conflictsFixed: fixed.fixedCount,
  };
}

function polishIntroV6(
  intro: string,
  peerIntros: string[],
  cityName: string,
  salt: number,
  fingerprintStore: Set<string>,
): { intro: string; paragraphsRewritten: number } {
  const before = intro;
  let polished = rewriteSimilarParagraphs(
    intro,
    peerIntros,
    cityName,
    salt,
    V6_SIMILARITY_REWRITE_THRESHOLD,
  );
  polished = dedupeFingerprintParagraphs(polished, fingerprintStore, cityName, salt + 1);
  const beforeParas = before.split(/\n\n+/).length;
  const afterParas = polished.split(/\n\n+/).length;
  const rewritten = polished !== before ? Math.max(1, Math.abs(beforeParas - afterParas) + 1) : 0;
  return { intro: polished, paragraphsRewritten: rewritten };
}

/**
 * V6.1 fast generation — max 9 candidates, early exit when thresholds met.
 */
export async function generateUniqueV6CitySEO(
  cityName: string,
  citySlug: string,
  stateName: string,
  stateSlug: string,
  dbAreas?: string[],
  countrySlug = "india",
  options?: {
    excludePageId?: string;
    listingContext?: CityListingContext;
  },
): Promise<UniqueV6Result> {
  const pageType: SeoPageType = "city";
  const peers = await getCachedPeerPages(pageType, citySlug);
  const fingerprintStore = await getParagraphFingerprintStore(pageType);

  let bestResult: UniqueV6Result | null = null;
  let bestComposite = -1;
  let totalParagraphsRewritten = 0;
  let candidatesEvaluated = 0;
  let earlyExit = false;

  const maxAttempts = V6_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const theme = NARRATIVE_THEMES[(attempt + hashSlug(citySlug)) % NARRATIVE_THEMES.length]!;
    const candidates: Array<{
      content: V6CityContent;
      introContent: string;
      faqText: string;
      title: string;
      metaDescription: string;
      localRefs: string[];
      candidateIndex: number;
    }> = [];

    for (let c = 0; c < V6_CANDIDATE_COUNT; c++) {
      const style = pickWritingStyle(citySlug, attempt * V6_CANDIDATE_COUNT + c);
      const salt = attempt * 100 + c * 17;
      const architecture =
        V6_ARCHITECTURES[(attempt + c) % V6_ARCHITECTURES.length]!;

      const generated = generateV6CitySEO(
        cityName,
        citySlug,
        stateName,
        stateSlug,
        dbAreas,
        countrySlug,
        {
          writingStyle: style,
          salt,
          attempt: attempt * V6_CANDIDATE_COUNT + c,
          architecture,
          narrativeTheme: theme,
          listingContext: options?.listingContext,
        },
      );

      const peerIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);
      const { intro: polishedIntro, paragraphsRewritten } = polishIntroV6(
        generated.introContent,
        peerIntros,
        cityName,
        salt,
        fingerprintStore,
      );
      totalParagraphsRewritten += paragraphsRewritten;
      candidatesEvaluated++;

      const content: V6CityContent = {
        ...generated,
        introContent: polishedIntro,
      };

      candidates.push({
        content,
        introContent: polishedIntro,
        faqText: faqTextFrom(content.faqs),
        title: content.title,
        metaDescription: content.metaDescription,
        localRefs: localRefCorpus(content),
        candidateIndex: c,
      });
    }

    const selected = selectBestV6Candidate(candidates, peers, citySlug, fingerprintStore);
    if (!selected) continue;

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

    const seoScore = selected.score.seoEstimate;
    const uniqueness = savedMetric.overall;
    const report: UniquenessScoreReport = {
      ...selected.score,
      overall: uniqueness,
      paragraphMinScore: savedMetric.paragraphMinScore,
    };

    const candidateIdx =
      candidates.find((c) => c.content === selected.content)?.candidateIndex ?? 0;

    const { content: conflictFixed, conflictsFixed } = fixContentSectionConflicts(
      selected.content,
      peers,
      citySlug,
      cityName,
    );

    const result: UniqueV6Result = {
      ...conflictFixed,
      uniquenessMeta: {
        engine: "v6.1",
        mode: "full",
        writingStyle: conflictFixed.writingStyle,
        architecture: conflictFixed.architecture,
        attempt,
        candidateCount: V6_CANDIDATE_COUNT,
        candidateSelected: candidateIdx,
        candidatesEvaluated,
        uniquenessReport: report,
        v6Score: selected.score,
        localReferenceCount: conflictFixed.localReferenceCount,
        paragraphsRewritten: totalParagraphsRewritten,
        intelligenceSource: conflictFixed.localIntelligence.source,
        retriesUsed: attempt + 1,
        earlyExit: false,
        listingContextFetchedAt: options?.listingContext?.fetchedAt,
        duplicateConflictsFixed: conflictsFixed,
      },
    };

    if (selected.score.compositeScore > bestComposite) {
      bestComposite = selected.score.compositeScore;
      bestResult = result;
    }

    if (shouldEarlyExitV61(uniqueness, seoScore)) {
      earlyExit = true;
      result.uniquenessMeta.earlyExit = true;
      registerParagraphFingerprints(fingerprintStore, result.introContent);
      return result;
    }

    if (!shouldRetryV61(uniqueness, attempt, maxAttempts)) {
      break;
    }
  }

  if (bestResult) {
    bestResult.uniquenessMeta.earlyExit = earlyExit;
    registerParagraphFingerprints(fingerprintStore, bestResult.introContent);
    return bestResult;
  }

  const fallback = generateV6CitySEO(
    cityName,
    citySlug,
    stateName,
    stateSlug,
    dbAreas,
    countrySlug,
    { salt: 999, attempt: maxAttempts, listingContext: options?.listingContext },
  );

  return {
    ...fallback,
    uniquenessMeta: {
      engine: "v6.1",
      mode: "full",
      writingStyle: fallback.writingStyle,
      architecture: fallback.architecture,
      attempt: maxAttempts,
      candidateCount: 1,
      candidateSelected: 0,
      candidatesEvaluated: 1,
      uniquenessReport: emptyReport(),
      v6Score: emptyV6Score(),
      localReferenceCount: fallback.localReferenceCount,
      paragraphsRewritten: totalParagraphsRewritten,
      intelligenceSource: fallback.localIntelligence.source,
      retriesUsed: maxAttempts,
      earlyExit: false,
    },
  };
}

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) - h) + slug.charCodeAt(i);
  return Math.abs(h);
}

function emptyReport(): UniquenessScoreReport {
  return {
    overall: 0,
    introScore: 0,
    paragraphMinScore: 0,
    faqScore: 0,
    lexicalDiversity: 0,
    semanticPenalty: 0,
    duplicatePhraseCount: 0,
    fingerprintCollisions: 0,
    maxIntroSimilarity: 0,
    seoEstimate: 0,
  };
}

function emptyV6Score(): V6CandidateScore {
  return { ...emptyReport(), compositeScore: 0, localRelevance: 0, readability: 0 };
}

export { clearParagraphFingerprintCache };
